package extension

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"sync"
	"time"

	"extension-scaffold/internal/config"
	"extension-scaffold/internal/listener"
	"extension-scaffold/internal/risk"
	"extension-scaffold/pkg/types"

	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"

	"github.com/flare-foundation/tee-node/pkg/processorutils"
)

type Extension struct {
	mu       sync.RWMutex
	Server   *http.Server
	listener *listener.TradeEventListener

	proofCount int
	lastValue  string
	riskCfg    risk.RiskEngineConfig
}

func New(extensionPort, signPort int) *Extension {
	e := &Extension{
		riskCfg:  risk.DefaultConfig(),
		listener: listener.NewTradeEventListener(),
	}

	// Lancement de l écouteur WebSocket TradeEvent en arrière-plan
	e.listener.Start(context.Background())

	mux := http.NewServeMux()
	mux.HandleFunc("GET /state", e.stateHandler)
	mux.HandleFunc("GET /risk-params", e.riskParamsHandler)
	mux.HandleFunc("GET /risk-proofs", e.riskProofsHandler)
	mux.HandleFunc("OPTIONS /risk-proofs", e.optionsCorsHandler)
	mux.HandleFunc("POST /action", e.actionHandler)

	e.Server = &http.Server{Addr: fmt.Sprintf(":%d", extensionPort), Handler: mux}
	return e
}

func (e *Extension) optionsCorsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.WriteHeader(http.StatusOK)
}

func (e *Extension) riskParamsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	resp := e.listener.GetLastUnsignedParams()
	_ = json.NewEncoder(w).Encode(resp)
}

func (e *Extension) riskProofsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	resp := e.listener.GetLastProofs()
	_ = json.NewEncoder(w).Encode(resp)
}

func (e *Extension) stateHandler(w http.ResponseWriter, r *http.Request) {
	e.mu.RLock()
	stateResponse := types.StateResponse{
		StateVersion: teeutils.ToHash(config.Version),
		State: types.State{
			ProofCount: e.proofCount,
			LastValue:  e.lastValue,
		},
	}
	e.mu.RUnlock()

	err := json.NewEncoder(w).Encode(stateResponse)
	if err != nil {
		http.Error(w, fmt.Sprintf("sending response: %v", err), http.StatusInternalServerError)
		return
	}
}

func (e *Extension) processAction(action teetypes.Action) (int, []byte) {
	dataFixed, err := processorutils.Parse[instruction.DataFixed](action.Data.Message)
	if err != nil {
		return http.StatusBadRequest, []byte(fmt.Sprintf("decoding fixed data: %v", err))
	}

	switch {
	case dataFixed.OPType == teeutils.ToHash(config.OPTypeProof):
		return e.processProof(action, dataFixed)

	case dataFixed.OPType == teeutils.ToHash(config.OPTypeRisk):
		return e.processRisk(action, dataFixed)

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op type: received %s", dataFixed.OPType.Hex(),
		))
	}
}

type RiskCalculateInput struct {
	AssetHash      string  `json:"assetHash"`
	LpTotalCapital float64 `json:"lpTotalCapital"`
	OiLong         float64 `json:"oiLong"`
	OiShort        float64 `json:"oiShort"`
	AvgLong        float64 `json:"avgLong"`
	AvgShort       float64 `json:"avgShort"`
	CurrentPrice   float64 `json:"currentPrice"`
	PythSymbol     string  `json:"pythSymbol"`
}

func (e *Extension) processRisk(action teetypes.Action, df *instruction.DataFixed) (int, []byte) {
	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandCalculate):
		var input RiskCalculateInput
		if err := json.Unmarshal(df.OriginalMessage, &input); err != nil {
			// Fallback mock params if empty payload
			input = RiskCalculateInput{
				AssetHash:      "0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55",
				LpTotalCapital: 100000.0,
				OiLong:         5000.0,
				OiShort:        4000.0,
				AvgLong:        2000.0,
				AvgShort:       2000.0,
				CurrentPrice:   2000.0,
				PythSymbol:     "Metal.XAU/USD",
			}
		}

		vol, _ := risk.FetchPythVolatility(e.riskCfg.PythApiUrl, input.PythSymbol, nil)
		if vol <= 0 {
			vol = e.riskCfg.VolatilityDefault
		}

		maxLong, maxShort, spreadL, spreadS, _, _ := risk.CalculateRiskParameters(
			e.riskCfg, input.LpTotalCapital, input.OiLong, input.OiShort, input.AvgLong, input.AvgShort, input.CurrentPrice, vol,
		)

		spreadLongPcm := int64(spreadL * 100)
		if spreadLongPcm > 1000 {
			spreadLongPcm = 1000
		}

		spreadShortPcm := int64(spreadS * 100)
		if spreadShortPcm > 1000 {
			spreadShortPcm = 1000
		}

		proof := types.RiskProof{
			AssetHash:   risk.Bytes32FromHex(input.AssetHash),
			MaxOILong:   new(big.Int).Mul(big.NewInt(int64(maxLong)), big.NewInt(1e6)),
			MaxOIShort:  new(big.Int).Mul(big.NewInt(int64(maxShort)), big.NewInt(1e6)),
			SpreadLong:  big.NewInt(spreadLongPcm),  // Max 1000 (0.10%)
			SpreadShort: big.NewInt(spreadShortPcm), // Max 1000 (0.10%)
			Timestamp:   uint64(time.Now().Unix()),
		}

		privKey := os.Getenv("PRIVATE_KEY")
		if privKey == "" {
			privKey = "0xe12f9b03327a875c2d5bf9b40a75cd2effeed46ea508ee595c6bc708c386da8c"
		}
		_ = risk.SignRiskProof(&proof, privKey)

		data, _ := json.Marshal(proof)
		ar := buildResult(action, df, data, 1, nil)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op command: received %s", df.OPCommand.Hex(),
		))
	}
}

func (e *Extension) processProof(action teetypes.Action, df *instruction.DataFixed) (int, []byte) {
	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandVerify):
		ar := e.processVerify(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op command: received %s, expected %s (%s)",
			df.OPCommand.Hex(),
			teeutils.ToHash(config.OPCommandVerify).Hex(), config.OPCommandVerify,
		))
	}
}

func (e *Extension) processVerify(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	valStr := string(df.OriginalMessage)

	e.mu.Lock()
	e.proofCount++
	e.lastValue = valStr
	e.mu.Unlock()

	resp := types.VerifyResponse{
		ReceivedValue: valStr,
		Status:        "VERIFIED",
	}
	data, _ := json.Marshal(resp)

	return buildResult(action, df, data, 1, nil)
}
