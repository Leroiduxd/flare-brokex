package risk

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"net/http"
	"strings"
	"time"

	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/crypto"
)

type RiskEngineConfig struct {
	BootstrapThreshold    float64
	RampUpSize            float64
	HardCapAbsolute       float64
	MaxSkewRatio          float64
	CppiMultiplier        float64
	StressPnlThresholdBps float64
	BaseSpreadBps         float64
	MaxSpreadBps          float64
	VolatilityDefault     float64
	PythApiUrl            string
}

func DefaultConfig() RiskEngineConfig {
	return RiskEngineConfig{
		BootstrapThreshold:    7000.0,
		RampUpSize:            43000.0,
		HardCapAbsolute:       75000.0,
		MaxSkewRatio:          0.60,
		CppiMultiplier:        3.0,
		StressPnlThresholdBps: 2000.0, // 20%
		BaseSpreadBps:         30.0,   // 3 bps
		MaxSpreadBps:          100.0,  // 10 bps
		VolatilityDefault:     0.15,   // 15%
		PythApiUrl:            "https://benchmarks.pyth.network/v1/shims/tradingview/history",
	}
}

type PythHistoryResponse struct {
	Status string    `json:"s"`
	Time   []int64   `json:"t"`
	Close  []float64 `json:"c"`
}

// ComputeUnrealizedPnL calcule le net PnL (positif = les traders gagnent / le vault perd).
func ComputeUnrealizedPnL(oiLong, oiShort, avgLong, avgShort, currentPrice *big.Float) *big.Float {
	zero := big.NewFloat(0)
	pnlLong := big.NewFloat(0)
	pnlShort := big.NewFloat(0)

	// Long PnL
	if avgLong.Cmp(zero) > 0 {
		if currentPrice.Cmp(avgLong) >= 0 {
			diff := new(big.Float).Sub(currentPrice, avgLong)
			ratio := new(big.Float).Quo(diff, avgLong)
			pnlLong = new(big.Float).Mul(oiLong, ratio)
		} else {
			diff := new(big.Float).Sub(avgLong, currentPrice)
			ratio := new(big.Float).Quo(diff, avgLong)
			pnlLong = new(big.Float).Mul(oiLong, ratio)
			pnlLong.Neg(pnlLong)
		}
	}

	// Short PnL
	if avgShort.Cmp(zero) > 0 {
		if avgShort.Cmp(currentPrice) >= 0 {
			diff := new(big.Float).Sub(avgShort, currentPrice)
			ratio := new(big.Float).Quo(diff, avgShort)
			pnlShort = new(big.Float).Mul(oiShort, ratio)
		} else {
			diff := new(big.Float).Sub(currentPrice, avgShort)
			ratio := new(big.Float).Quo(diff, avgShort)
			pnlShort = new(big.Float).Mul(oiShort, ratio)
			pnlShort.Neg(pnlShort)
		}
	}

	// Net PnL (shorts + longs)
	netPnL := new(big.Float).Add(pnlLong, pnlShort)
	return netPnL
}

func FetchPythVolatility(apiUrl, symbol string, httpClient *http.Client) (float64, error) {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}
	now := time.Now().Unix()
	from := now - 24*3600

	url := fmt.Sprintf("%s?symbol=%s&resolution=1&from=%d&to=%d", apiUrl, symbol, from, now)
	resp, err := httpClient.Get(url)
	if err != nil {
		return 0.15, err
	}
	defer resp.Body.Close()

	var history PythHistoryResponse
	if err := json.NewDecoder(resp.Body).Decode(&history); err != nil {
		return 0.15, err
	}

	if len(history.Close) < 60 {
		return 0.15, nil
	}

	returns := make([]float64, 0, len(history.Close)-1)
	for i := 1; i < len(history.Close); i++ {
		if history.Close[i-1] > 0 {
			ret := (history.Close[i] - history.Close[i-1]) / history.Close[i-1]
			returns = append(returns, ret)
		}
	}

	if len(returns) == 0 {
		return 0.15, nil
	}

	// Standard deviation
	var sum float64
	for _, r := range returns {
		sum += r
	}
	mean := sum / float64(len(returns))

	var varSum float64
	for _, r := range returns {
		varSum += (r - mean) * (r - mean)
	}
	volHourly := math.Sqrt(varSum / float64(len(returns)))
	volAnnualized := volHourly * math.Sqrt(8760)

	// Cap 7.5% - 30%
	if volAnnualized < 0.075 {
		volAnnualized = 0.075
	}
	if volAnnualized > 0.30 {
		volAnnualized = 0.30
	}

	return volAnnualized, nil
}

func CalculateRiskParameters(
	cfg RiskEngineConfig,
	lpTotalCapital float64,
	oiLong float64,
	oiShort float64,
	avgLong float64,
	avgShort float64,
	currentPrice float64,
	volatility float64,
) (maxOILong float64, maxOIShort float64, spreadLong float64, spreadShort float64, riskActivation float64, pnlStressRatio float64) {
	// 1. Calculate PnL stress ratio
	netPnL := 0.0
	if avgLong > 0 {
		if currentPrice >= avgLong {
			netPnL += oiLong * (currentPrice - avgLong) / avgLong
		} else {
			netPnL -= oiLong * (avgLong - currentPrice) / avgLong
		}
	}
	if avgShort > 0 {
		if avgShort >= currentPrice {
			netPnL += oiShort * (avgShort - currentPrice) / avgShort
		} else {
			netPnL -= oiShort * (currentPrice - avgShort) / avgShort
		}
	}

	if lpTotalCapital > 0 {
		pnlStressRatio = math.Abs(netPnL) / lpTotalCapital
	}

	// 2. Mode Bootstrap vs Risk
	if oiLong < cfg.BootstrapThreshold && oiShort < cfg.BootstrapThreshold {
		riskActivation = 0.0
	} else {
		totalOI := oiLong + oiShort
		if totalOI <= cfg.BootstrapThreshold*2 {
			riskActivation = 0.0
		} else {
			riskActivation = math.Min(1.0, (totalOI-cfg.BootstrapThreshold*2)/cfg.RampUpSize)
		}
	}

	// 3. Capital Risquable (CPPI)
	cushionBootstrap := lpTotalCapital * 0.95
	cushionRisk := lpTotalCapital * 0.20
	cushion := cushionBootstrap*(1.0-riskActivation) + cushionRisk*riskActivation
	maxTotalOI := math.Min(cfg.HardCapAbsolute, cushion*cfg.CppiMultiplier)

	// 4. Asymétrie Skew (Avellaneda-Stoikov)
	totalOI := oiLong + oiShort
	skewLong := 0.5
	if totalOI > 0 {
		skewLong = oiLong / totalOI
	}
	skewShort := 1.0 - skewLong

	asymLong := 0.5
	asymShort := 0.5
	if riskActivation > 0 {
		deviation := skewLong - 0.5
		asymLong = 0.5 - deviation*2.0*riskActivation
		asymShort = 0.5 + deviation*2.0*riskActivation
		if asymLong < 0.15 {
			asymLong = 0.15
		}
		if asymLong > 0.85 {
			asymLong = 0.85
		}
		if asymShort < 0.15 {
			asymShort = 0.15
		}
		if asymShort > 0.85 {
			asymShort = 0.85
		}
	}

	maxOILong = maxTotalOI * asymLong
	maxOIShort = maxTotalOI * asymShort

	// 5. Stress PnL Reduction
	stressFactor := 1.0
	if riskActivation > 0 {
		stressFactor = 1.0 - pnlStressRatio*2.0*riskActivation
		if stressFactor < 0.3 {
			stressFactor = 0.3
		}
	}
	if pnlStressRatio >= (cfg.StressPnlThresholdBps / 10000.0) {
		stressFactor = 0.5
		maxTotalOI *= 0.5
	}
	maxOILong *= stressFactor
	maxOIShort *= stressFactor

	// 6. Blocage Skew Max & Spreads initialisation
	spreadLong = cfg.BaseSpreadBps
	spreadShort = cfg.BaseSpreadBps

	if skewLong >= cfg.MaxSkewRatio {
		maxOILong = oiLong
		spreadLong = cfg.MaxSpreadBps
	}
	if skewShort >= cfg.MaxSkewRatio {
		maxOIShort = oiShort
		spreadShort = cfg.MaxSpreadBps
	}

	// 7. Floor Minimum (si non bloqué par skew cap)
	minOrderSize := 1000.0
	if skewLong < cfg.MaxSkewRatio && maxOILong < oiLong+minOrderSize {
		maxOILong = oiLong + minOrderSize
	}
	if skewShort < cfg.MaxSkewRatio && maxOIShort < oiShort+minOrderSize {
		maxOIShort = oiShort + minOrderSize
	}

	// 8. Volatility Premium & Dynamic Spread
	volPremium := 0.0
	if volatility > 0.25 {
		volPremium = 5.0
	} else if volatility > 0.20 {
		volPremium = 2.0
	}

	if skewLong < cfg.MaxSkewRatio {
		spreadLong = cfg.BaseSpreadBps + volPremium
		if riskActivation > 0 && skewLong > 0.5 {
			penaltyMax := cfg.MaxSpreadBps - cfg.BaseSpreadBps
			spreadLong = math.Min(cfg.MaxSpreadBps, spreadLong+penaltyMax*(skewLong-0.5)*2.0*riskActivation)
		}
	}

	if skewShort < cfg.MaxSkewRatio {
		spreadShort = cfg.BaseSpreadBps + volPremium
		if riskActivation > 0 && skewShort > 0.5 {
			penaltyMax := cfg.MaxSpreadBps - cfg.BaseSpreadBps
			spreadShort = math.Min(cfg.MaxSpreadBps, spreadShort+penaltyMax*(skewShort-0.5)*2.0*riskActivation)
		}
	}

	return maxOILong, maxOIShort, spreadLong, spreadShort, riskActivation, pnlStressRatio
}

func SignRiskProof(proof *types.RiskProof, privateKeyHex string) error {
	cleanHex := strings.TrimPrefix(privateKeyHex, "0x")
	privKey, err := crypto.HexToECDSA(cleanHex)
	if err != nil {
		return fmt.Errorf("invalid private key: %w", err)
	}

	// ABI Encode message: keccak256(abi.encode(assetHash, maxOILong, maxOIShort, spreadLong, spreadShort, timestamp))
	// Each uint256 is 32 bytes big-endian
	buf := make([]byte, 32*6)
	copy(buf[0:32], proof.AssetHash[:])

	maxOILongBytes := proof.MaxOILong.Bytes()
	copy(buf[64-len(maxOILongBytes):32*2], maxOILongBytes)

	maxOIShortBytes := proof.MaxOIShort.Bytes()
	copy(buf[96-len(maxOIShortBytes):32*3], maxOIShortBytes)

	spreadLongBytes := proof.SpreadLong.Bytes()
	copy(buf[128-len(spreadLongBytes):32*4], spreadLongBytes)

	spreadShortBytes := proof.SpreadShort.Bytes()
	copy(buf[160-len(spreadShortBytes):32*5], spreadShortBytes)

	tsBytes := new(big.Int).SetUint64(proof.Timestamp).Bytes()
	copy(buf[192-len(tsBytes):32*6], tsBytes)

	hash := crypto.Keccak256(buf)
	ethHash := crypto.Keccak256([]byte(fmt.Sprintf("\x19Ethereum Signed Message:\n32%s", string(hash))))

	sig, err := crypto.Sign(ethHash, privKey)
	if err != nil {
		return fmt.Errorf("signing failed: %w", err)
	}

	// Adjust V for Ethereum (27 or 28)
	if len(sig) == 65 && (sig[64] == 0 || sig[64] == 1) {
		sig[64] += 27
	}

	proof.Signature = sig
	return nil
}

func Bytes32FromHex(hexStr string) [32]byte {
	clean := strings.TrimPrefix(hexStr, "0x")
	bytes, _ := hex.DecodeString(clean)
	var res [32]byte
	copy(res[32-len(bytes):], bytes)
	return res
}
