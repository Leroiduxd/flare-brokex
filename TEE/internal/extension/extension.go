package extension

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/types"

	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"

	"github.com/flare-foundation/tee-node/pkg/processorutils"
)

type Extension struct {
	mu     sync.RWMutex
	Server *http.Server

	proofCount int
	lastValue  string
}

func New(extensionPort, signPort int) *Extension {
	e := &Extension{}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /state", e.stateHandler)
	mux.HandleFunc("POST /action", e.actionHandler)

	e.Server = &http.Server{Addr: fmt.Sprintf(":%d", extensionPort), Handler: mux}
	return e
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

func (e *Extension) processRisk(action teetypes.Action, df *instruction.DataFixed) (int, []byte) {
	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandCalculate):
		ar := e.processVerify(action, df)
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
