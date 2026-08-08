# Brokex — Multi-Asset Perpetual Trading on Flare

Brokex is a multi-asset perpetual trading protocol built on Flare, live today with gold (XAU/USD) and XRP (XRP/USD) sharing a single liquidity vault. It's not another crypto perp DEX — the goal is bringing **real-world assets** (metals, forex, equities) fully on-chain, with crypto pairs like XRP serving as an early proof of the model, not the destination.

**Live app:** [flare.brokex.trade](https://flare.brokex.trade)
**Demo video:** [youtu.be/eGcqtpdJDW8](https://youtu.be/eGcqtpdJDW8)

This repo contains the full stack: smart contracts, the TEE risk-engine extension, backend, and frontend. Everything is self-hosted on a single VPS — no managed infra, no external dependencies beyond Flare itself. The two components that matter most, and that this README covers in depth, are the **smart contracts** and the **TEE risk engine**.

---

## Why this architecture

Most perp DEXs force a trade-off between three flawed models:

- **Order-book DEXs** track real market prices accurately, but your open orders are visible — other participants can see and trade around a resting order instead of the price simply reflecting the asset. They also need deep two-sided liquidity per asset, which means either raising large capital or paying a market maker.
- **AMM-based perps** solve the liquidity problem with a synthetic price derived from pool ratios, but that price drifts from the real market under size or volatility, and the pricing formulas are often opaque.
- **Single-asset vault models** (deposit BTC, settle PnL in BTC) are simple but don't scale — every new asset needs its own dedicated vault with its own liquidity depth.

Brokex uses a **single shared vault** instead: every listed asset settles against the same USDC pool, priced entirely off Flare's FTSOv2 — never computed from Brokex's own liquidity. One modest pool of capital backs trading across every market simultaneously, which is what makes listing RWAs (metals, forex) viable without needing pre-existing crypto-native liquidity for each one.

This "the house is the counterparty" design (known in TradFi as a "Book B" model) has one unavoidable structural tension: when the trader wins, the vault loses, and vice versa. Normally you just have to trust the operator not to lean on that. Brokex's answer is to move the risk engine off its own servers entirely and into a **Trusted Execution Environment (TEE)** via Flare's Confidential Compute (FCC), so the logic is enforced by hardware-attested computation, not by discretion — see [TEE Risk Engine](#tee-risk-engine) below.

---

## Smart Contracts

Two contracts, deliberately kept small and auditable.

### `BrokexCore.sol` — Trading & Risk Engine

The trading engine. Handles position opening/closing, order types (market/limit/stop), exposure accounting, and settlement. All monetary values and percentages use 1e6 fixed-point precision throughout.

**Key mechanics:**

- **Pricing.** Every entry, exit, and liquidation price is read live from Flare's `FTSOv2` via `getFeedById()` — a plain `view` call, no signed oracle proof needed, no staleness risk. Prices are normalized to 1e6 decimals on read.
- **Spread.** Entry/exit spreads are supplied per-trade by the TEE-signed `RiskProof` (see below), but are hard-capped in the contract itself at `MAX_SPREAD_ALLOWED = 1_000` (0.10%) — the TEE can compute within that ceiling, but can never exceed it, and neither can the contract owner.
- **Commission & borrow fee.** Commission is capped at `MAX_COMMISSION_ALLOWED` (1.0%) and charged once on open, transferred straight to the vault. Instead of a funding rate, positions accrue a flat **hourly borrow fee** (`borrowRateHourly`, capped at `MAX_BORROW_RATE_ALLOWED`) deducted from PnL at close. This is a deliberate design choice: a funding rate is built to penalize whichever side is crowded and pressure winners to close — Brokex doesn't do that. Once a position is open, a trader can hold it as long as they want, on the same flat terms as everyone else.
- **Capital locking & solvency.** Every open position locks its proportional share of vault capital immediately (`lockedCapitalBps` against the dominant side's open interest) — a payment guarantee the vault can never spend, redirect, or run out of. `getFreeCapital()` nets out locked capital and pending LP withdrawals from the raw vault balance before any new trade is allowed to increase exposure.
- **PnL & liquidation.** Gross PnL and the liquidation threshold (90–98% of margin, configurable per asset within that band) are plain, public contract math — not an off-chain decision. A **profit cap** (`profitCap`, e.g. 10% of OI) bounds maximum trader payout per position; keepers batch-trigger closes once a position crosses it.
- **No discretion at settlement.** Closing a position runs through fixed contract logic — there is no admin approval step, no ability for the protocol to block a close or withhold a payout.

### `BrokexVault.sol` — LP Pool & Token (bUSDC)

Holds LP capital, trading commissions, and net settlements — **never** active trader margin, which lives entirely in `BrokexCore`. Implements a minimal ERC20 for LP shares (`bUSDC`).

**Key mechanics:**

- **LP pricing.** NAV = vault USDC balance minus net protocol unrealized PnL (pulled live from Core via `verifyAndComputeUnrealizedPnL()`). LP share price is recomputed from NAV on every deposit and withdrawal settlement — never left stale during actual money movement.
- **Deposits** are instant: `deposit(usdcAmount)` or `depositLP(lpAmount)`, minted/priced against the fresh NAV.
- **Withdrawals are two-step FIFO**, by design:
  1. `requestWithdraw(lpAmount)` — instant, free, no oracle read needed. LP tokens are locked immediately and queued.
  2. `processWithdrawalQueue()` — a keeper processes the queue in strict order (`queueHead → queueTail`) against a fresh LP price, paying out as free liquidity allows. Nobody can queue-jump; there's no advantage to withdrawing "first" beyond simply being earlier in the queue.
- This is intentional: Brokex isn't optimizing for the highest advertised LP yield, it's optimizing for LPs staying deposited — sustainable, predictable growth over aggressive short-term returns, while keeping terms fair enough to traders that they keep coming back.

---

## TEE Risk Engine

This is the core of Brokex's Confidential Compute integration, and the piece that resolves the Book B conflict of interest described above.

### Why a TEE at all

The industry default answer to "how do you make an operator-controlled system trustworthy" is full public transparency — publish everything, make it all open. For a Book B model, that actually backfires: if risk parameters (spread, max exposure) are public and static, they become exploitable by anyone who can see them; if the operator can freely adjust them, you're back to trusting a person. Brokex's position is that full transparency isn't the right goal here — **verifiable fairness** is. A TEE gives both sides of that: the risk logic is hidden from view (so it can't be gamed), but its execution is hardware-attested and its output is cryptographically provable (so it can't be silently tampered with either) — a fair deal for LPs, traders, and the protocol owner alike.

### How it works, end to end

1. **Trigger.** `BrokexCore` emits `TradeEvent(tradeId)` on every open/close.
2. **Listener** (`internal/listener`) subscribes to this event over a Flare WebSocket connection and, on every trigger, recalculates risk parameters per listed asset (currently gold and XRP).
3. **Risk calculation** (`internal/risk`) computes the current market volatility (pulled from Pyth's price history API), then derives:
   - Max open interest per side (long/short), using a CPPI-style capital allocation model that scales risk appetite with vault capital and current exposure skew
   - Bootstrap vs. active risk mode — a low-OI "bootstrap" phase allows wider initial capacity, ramping down toward tighter limits as OI grows
   - Dynamic spread per side, widening with volatility and with directional skew (an Avellaneda-Stoikov-style asymmetry: the more one-sided the book gets, the wider the penalized side's spread gets, up to `MaxSpreadBps`)
   - A stress-PnL factor that shrinks max exposure further if unrealized vault PnL crosses a configured threshold
4. **Signing.** The computed parameters (`assetHash`, `maxOILong`, `maxOIShort`, `spreadLong`, `spreadShort`, `timestamp`) are ABI-encoded, hashed, and signed with `ecdsa` inside the TEE process — this becomes the `RiskProof`.
5. **On-chain verification.** Every `openMarketPosition` / `closePositionMarket` / `batchExecute` call on `BrokexCore` requires a valid `RiskProof`. The contract reconstructs the same hash, recovers the signer via `ecrecover`, and checks it matches the registered `teeSigner` — plus a freshness check (`maxProofAge`) so stale proofs are rejected. No proof, no trade.

The extension itself (`extension.go`) exposes a small HTTP surface (`/state`, `/risk-params`, `/risk-proofs`, `/action`) and integrates with Flare's TEE extension/instruction framework (`go-flare-common`, `tee-node`) — trade-triggered recalculation happens automatically via the WebSocket listener, with a REST fallback for on-demand risk computation.

### What this buys LPs and traders

- LPs get exposure limits that actually respond to real portfolio skew and volatility, computed the same way every time, with no manual override.
- Traders get spread and exposure caps that are hardcoded ceilings in the contract regardless of what the TEE outputs — the TEE can only make things *safer* within those bounds, never worse than the published maximum.
- Nobody, including the Brokex team, can quietly widen a spread or cap someone's exposure unfairly — the computation is out of anyone's hands once it's running.

---

## Frontend & Backend

- **Frontend:** React. Kept deliberately simple and sober — no dashboard overload, no unnecessary complexity. The goal is that a first-time DeFi user and an experienced trader can both open the app and immediately understand what they're looking at and what a trade will do.
- **Backend:** Node.js, using SQLite for local data. Handles indexing, serving trade/position data to the frontend, and coordinating with the keeper layer.
- **Hosting:** Everything — frontend, backend, and the TEE extension process — is self-hosted on a single VPS. No managed cloud infra, no third-party service dependencies beyond Flare and the price oracle. Simple and inexpensive to run, which matters for a lean, capital-efficient protocol.

---

## Status

Brokex started as a testnet product on Pharos Network, where the Book B model and vault architecture were already validated with real usage — the full stack was live and functional before the Flare deployment began. For Flare, the protocol was ported with FTSOv2 as the live pricing source, and the FCC TEE risk-engine integration was built and validated end-to-end on Coston2. The product is live and testable today with two assets, gold and XRP, at **flare.brokex.trade**. The goal is to reach Flare mainnet as fast as possible.

---

## Links

- **App:** [flare.brokex.trade](https://flare.brokex.trade)
- **Demo video:** [youtu.be/eGcqtpdJDW8](https://youtu.be/eGcqtpdJDW8)
- **GitHub:** [github.com/Leroiduxd/flare-brokex](https://github.com/Leroiduxd/flare-brokex)
