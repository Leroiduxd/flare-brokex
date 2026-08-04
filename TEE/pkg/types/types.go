package types

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

type VerifyResponse struct {
	ReceivedValue string `json:"receivedValue"`
	Status        string `json:"status"`
}

type State struct {
	ProofCount int    `json:"proofCount"`
	LastValue  string `json:"lastValue"`
}

type StateResponse struct {
	StateVersion common.Hash `json:"stateVersion"`
	State        State       `json:"state"`
}

// Risk Engine Structs

type AssetConfig struct {
	FtsoFeedId         [21]byte `json:"ftsoFeedId"`
	MinLeverage        *big.Int `json:"minLeverage"`
	MaxLeverage        *big.Int `json:"maxLeverage"`
	MinTradeSize       *big.Int `json:"minTradeSize"`
	CommissionBps      *big.Int `json:"commissionBps"`
	BorrowRateHourly   *big.Int `json:"borrowRateHourly"`
	ProfitCap          *big.Int `json:"profitCap"`
	ExecutionTolerance *big.Int `json:"executionTolerance"`
	MaxProofAge        *big.Int `json:"maxProofAge"`
	MaxTraderOI        *big.Int `json:"maxTraderOI"`
	MaxGlobalOI        *big.Int `json:"maxGlobalOI"`
	LockedCapitalBps   *big.Int `json:"lockedCapitalBps"`
	LiqThresholdBps    *big.Int `json:"liqThresholdBps"`
	Listed             bool     `json:"listed"`
	Frozen             bool     `json:"frozen"`
}

type AssetSnapshot struct {
	AssetHash          [32]byte    `json:"assetHash"`
	OpenInterestLong   *big.Int    `json:"openInterestLong"`
	OpenInterestShort  *big.Int    `json:"openInterestShort"`
	TotalOpenInterest  *big.Int    `json:"totalOpenInterest"`
	AvgEntryPriceLong  *big.Int    `json:"avgEntryPriceLong"`
	AvgEntryPriceShort *big.Int    `json:"avgEntryPriceShort"`
	Config             AssetConfig `json:"config"`
}

type ProtocolSnapshot struct {
	LastTradeId      *big.Int       `json:"lastTradeId"`
	Paused           bool           `json:"paused"`
	EmergencyMode    bool           `json:"emergencyMode"`
	CoreOwner        common.Address `json:"coreOwner"`
	TeeSigner        common.Address `json:"teeSigner"`
	LpTotalCapital   *big.Int       `json:"lpTotalCapital"`
	LpFreeCapital    *big.Int       `json:"lpFreeCapital"`
	LpLockedCapital  *big.Int       `json:"lpLockedCapital"`
	VaultUsageBps    *big.Int       `json:"vaultUsageBps"`
	VaultOwner       common.Address `json:"vaultOwner"`
	VaultCore        common.Address `json:"vaultCore"`
	CoreLocked       bool           `json:"coreLocked"`
	LpTotalSupply    *big.Int       `json:"lpTotalSupply"`
	LpLastKnownPrice *big.Int       `json:"lpLastKnownPrice"`
	RequiredFreeUSDC *big.Int       `json:"requiredFreeUSDC"`
	TotalPendingLP   *big.Int       `json:"totalPendingLP"`
}

type UnsignedRiskParams struct {
	AssetHash      string  `json:"assetHash"`
	MaxOILong      uint64  `json:"maxOILong"`
	MaxOIShort     uint64  `json:"maxOIShort"`
	SpreadLongBps  float64 `json:"spreadLongBps"`
	SpreadShortBps float64 `json:"spreadShortBps"`
	RiskActivation float64 `json:"riskActivation"`
	PnlStressRatio float64 `json:"pnlStressRatio"`
	Volatility     float64 `json:"volatility"`
	Timestamp      int64   `json:"timestamp"`
}

type RiskProof struct {
	AssetHash   [32]byte `json:"assetHash"`
	MaxOILong   *big.Int `json:"maxOILong"`
	MaxOIShort  *big.Int `json:"maxOIShort"`
	SpreadLong  *big.Int `json:"spreadLong"`  // bps * 100
	SpreadShort *big.Int `json:"spreadShort"` // bps * 100
	Timestamp   uint64   `json:"timestamp"`
	Signature   []byte   `json:"signature"`
}
