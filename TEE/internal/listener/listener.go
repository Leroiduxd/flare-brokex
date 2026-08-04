package listener

import (
	"context"
	"log"
	"math/big"
	"os"
	"sync"
	"time"

	"extension-scaffold/internal/risk"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	ethTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// TradeEvent signature: keccak256("TradeEvent(uint256)")
var TradeEventTopic = crypto.Keccak256Hash([]byte("TradeEvent(uint256)"))

type AssetParamsConfig struct {
	AssetHashStr  string
	AssetHash     [32]byte
	PythSymbol    string
	MockPrice     float64
}

type TradeEventListener struct {
	wssUrl        string
	rpcUrl        string
	coreAddress   common.Address
	lensAddress   common.Address
	assets        map[string]AssetParamsConfig
	privateKeyHex string
	riskCfg       risk.RiskEngineConfig

	mu             sync.RWMutex
	lastCalcParams map[string]types.UnsignedRiskParams
	lastProofs     map[string]*types.RiskProof
}

func NewTradeEventListener() *TradeEventListener {
	wssUrl := os.Getenv("COSTON2_WSS_URL")
	if wssUrl == "" {
		wssUrl = "wss://coston2-api.flare.network/ext/C/ws"
	}

	rpcUrl := os.Getenv("RPC_URL")
	if rpcUrl == "" {
		rpcUrl = "https://coston2-api.flare.network/ext/C/rpc"
	}

	coreAddrStr := os.Getenv("BROKEX_CORE_ADDRESS")
	if coreAddrStr == "" {
		coreAddrStr = "0x5620dA2B418577b94a74B121eD61B5B84962AC93"
	}

	lensAddrStr := os.Getenv("BROKEX_LENS_ADDRESS")
	if lensAddrStr == "" {
		lensAddrStr = "0x9565CCDaEF44430c2B099455ff028712F94E8859"
	}

	vaultAddrStr := os.Getenv("BROKEX_VAULT_ADDRESS")
	if vaultAddrStr == "" {
		vaultAddrStr = "0xC73dab4Db123cC6e206d65f8DE6590dd0531a1D3"
	}
	_ = vaultAddrStr

	goldHashStr := os.Getenv("GOLD_ASSET_HASH")
	if goldHashStr == "" {
		goldHashStr = "0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55"
	}

	xrpHashStr := os.Getenv("XRP_ASSET_HASH")
	if xrpHashStr == "" {
		xrpHashStr = "0x0aa350274fca23e3884be19de980198b13f2ea293ea26921055ab6a20770c7f2"
	}

	privKey := os.Getenv("PRIVATE_KEY")
	if privKey == "" {
		privKey = "0xe12f9b03327a875c2d5bf9b40a75cd2effeed46ea508ee595c6bc708c386da8c"
	}

	assets := map[string]AssetParamsConfig{
		"GOLD": {
			AssetHashStr: goldHashStr,
			AssetHash:    risk.Bytes32FromHex(goldHashStr),
			PythSymbol:   "Metal.XAU/USD",
			MockPrice:    2000.0,
		},
		"XRP": {
			AssetHashStr: xrpHashStr,
			AssetHash:    risk.Bytes32FromHex(xrpHashStr),
			PythSymbol:   "Crypto.XRP/USD",
			MockPrice:    0.60,
		},
	}

	return &TradeEventListener{
		wssUrl:         wssUrl,
		rpcUrl:         rpcUrl,
		coreAddress:    common.HexToAddress(coreAddrStr),
		lensAddress:    common.HexToAddress(lensAddrStr),
		assets:         assets,
		privateKeyHex:  privKey,
		riskCfg:        risk.DefaultConfig(),
		lastCalcParams: make(map[string]types.UnsignedRiskParams),
		lastProofs:     make(map[string]*types.RiskProof),
	}
}

func (l *TradeEventListener) GetLastUnsignedParams() map[string]types.UnsignedRiskParams {
	l.mu.RLock()
	defer l.mu.RUnlock()
	res := make(map[string]types.UnsignedRiskParams)
	for key, asset := range l.assets {
		if val, ok := l.lastCalcParams[key]; ok {
			res[key] = val
		} else {
			res[key] = types.UnsignedRiskParams{
				AssetHash:      asset.AssetHashStr,
				MaxOILong:      37500000000,
				MaxOIShort:     37500000000,
				SpreadLongBps:  30,
				SpreadShortBps: 30,
				RiskActivation: 0,
				PnlStressRatio: 0,
				Volatility:     0.075,
				Timestamp:      time.Now().Unix(),
			}
		}
	}
	return res
}

func (l *TradeEventListener) GetLastProofs() map[string]*types.RiskProof {
	l.mu.RLock()
	defer l.mu.RUnlock()
	res := make(map[string]*types.RiskProof)
	for key, proof := range l.lastProofs {
		res[key] = proof
	}
	return res
}

func (l *TradeEventListener) RecalculateRisk() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	for name, asset := range l.assets {
		vol, _ := risk.FetchPythVolatility(l.riskCfg.PythApiUrl, asset.PythSymbol, nil)
		if vol <= 0 {
			vol = l.riskCfg.VolatilityDefault
		}

		lpTotalCapital := 100000.0
		oiLong := 5000.0
		oiShort := 4000.0
		avgLong := asset.MockPrice
		avgShort := asset.MockPrice
		currentPrice := asset.MockPrice

		maxLong, maxShort, spreadL, spreadS, activation, pnlRatio := risk.CalculateRiskParameters(
			l.riskCfg, lpTotalCapital, oiLong, oiShort, avgLong, avgShort, currentPrice, vol,
		)

		l.lastCalcParams[name] = types.UnsignedRiskParams{
			AssetHash:      asset.AssetHashStr,
			MaxOILong:      uint64(maxLong * 1e6),
			MaxOIShort:     uint64(maxShort * 1e6),
			SpreadLongBps:  spreadL,
			SpreadShortBps: spreadS,
			RiskActivation: activation,
			PnlStressRatio: pnlRatio,
			Volatility:     vol,
			Timestamp:      time.Now().Unix(),
		}

		spreadLongPcm := int64(spreadL * 100)
		if spreadLongPcm > 1000 {
			spreadLongPcm = 1000
		}

		spreadShortPcm := int64(spreadS * 100)
		if spreadShortPcm > 1000 {
			spreadShortPcm = 1000
		}

		proof := &types.RiskProof{
			AssetHash:   asset.AssetHash,
			MaxOILong:   new(big.Int).Mul(big.NewInt(int64(maxLong)), big.NewInt(1e6)),
			MaxOIShort:  new(big.Int).Mul(big.NewInt(int64(maxShort)), big.NewInt(1e6)),
			SpreadLong:  big.NewInt(spreadLongPcm),  // Max 1000 (0.10%)
			SpreadShort: big.NewInt(spreadShortPcm), // Max 1000 (0.10%)
			Timestamp:   uint64(time.Now().Unix()),
		}
		_ = risk.SignRiskProof(proof, l.privateKeyHex)
		l.lastProofs[name] = proof

		log.Printf("[TEE RISK] Recalculated %s: MaxLong=%.0f MaxShort=%.0f SpreadL=%.0fbps", name, maxLong, maxShort, spreadL)
	}
	return nil
}

func (l *TradeEventListener) Start(ctx context.Context) {
	// Initial calculation
	_ = l.RecalculateRisk()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				log.Printf("[TEE WS] Connecting to WebSocket: %s", l.wssUrl)
				client, err := ethclient.Dial(l.wssUrl)
				if err != nil {
					log.Printf("[TEE WS Error] Failed to connect WSS: %v. Retrying in 5s...", err)
					time.Sleep(5 * time.Second)
					continue
				}

				query := ethereum.FilterQuery{
					Addresses: []common.Address{l.coreAddress},
					Topics:    [][]common.Hash{{TradeEventTopic}},
				}

				logs := make(chan ethTypes.Log)
				sub, err := client.SubscribeFilterLogs(ctx, query, logs)
				if err != nil {
					log.Printf("[TEE WS Error] Failed to subscribe TradeEvent: %v. Retrying in 5s...", err)
					client.Close()
					time.Sleep(5 * time.Second)
					continue
				}

				log.Printf("[TEE WS] Successfully subscribed to TradeEvent on BrokexCore: %s", l.coreAddress.Hex())

				for {
					select {
					case <-ctx.Done():
						sub.Unsubscribe()
						client.Close()
						return
					case err := <-sub.Err():
						log.Printf("[TEE WS Subscription Error]: %v. Reconnecting...", err)
						sub.Unsubscribe()
						client.Close()
						goto Reconnect
					case vLog := <-logs:
						tradeId := big.NewInt(0)
						if len(vLog.Topics) > 1 {
							tradeId = vLog.Topics[1].Big()
						}
						log.Printf("[TEE EVENT] TradeEvent received! TradeID: %s. Recalculating risk limits...", tradeId.String())
						_ = l.RecalculateRisk()
					}
				}
			Reconnect:
				time.Sleep(3 * time.Second)
			}
		}
	}()
}
