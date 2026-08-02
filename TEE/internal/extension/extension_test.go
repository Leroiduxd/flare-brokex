package extension

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"
)

func toHash(s string) common.Hash { return teeutils.ToHash(s) }

func buildTestAction(opType, opCommand common.Hash, originalMessage []byte) teetypes.Action {
	type dataFixed struct {
		InstructionID      common.Hash    `json:"instructionId"`
		TeeID              common.Address `json:"teeId"`
		Timestamp          uint64         `json:"timestamp"`
		RewardEpochID      uint32         `json:"rewardEpochId"`
		OPType             common.Hash    `json:"opType"`
		OPCommand          common.Hash    `json:"opCommand"`
		Cosigners          []string       `json:"cosigners"`
		CosignersThreshold uint64         `json:"cosignersThreshold"`
		OriginalMessage    hexutil.Bytes  `json:"originalMessage"`
	}

	df := dataFixed{
		OPType:          opType,
		OPCommand:       opCommand,
		OriginalMessage: originalMessage,
	}
	msg, _ := json.Marshal(df)

	return teetypes.Action{
		Data: teetypes.ActionData{
			ID:            common.HexToHash("0x1234"),
			SubmissionTag: "submit",
			Message:       msg,
		},
	}
}

func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}

func TestProcessAction_UnknownOPType(t *testing.T) {
	e := &Extension{}
	action := buildTestAction(
		toHash("UNKNOWN_TYPE"),
		toHash(config.OPCommandVerify),
		nil,
	)

	status, body := e.processAction(action)

	if status != http.StatusNotImplemented {
		t.Fatalf("expected status %d, got %d", http.StatusNotImplemented, status)
	}

	bodyStr := string(body)
	if !contains(bodyStr, "unsupported op type") {
		t.Error("expected body to contain 'unsupported op type'")
	}
}

func TestProcessAction_UnknownOPCommand(t *testing.T) {
	e := &Extension{}
	action := buildTestAction(
		toHash(config.OPTypeProof),
		toHash("UNKNOWN_COMMAND"),
		nil,
	)

	status, body := e.processAction(action)

	if status != http.StatusNotImplemented {
		t.Fatalf("expected status %d, got %d", http.StatusNotImplemented, status)
	}

	bodyStr := string(body)
	if !contains(bodyStr, "unsupported op command") {
		t.Error("expected body to contain 'unsupported op command'")
	}
}

func TestProcessAction_ValidVerify(t *testing.T) {
	e := &Extension{}

	payload := []byte("hello-flare")
	action := buildTestAction(
		toHash(config.OPTypeProof),
		toHash(config.OPCommandVerify),
		payload,
	)

	status, body := e.processAction(action)

	if status != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, status, body)
	}

	var result teetypes.ActionResult
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("failed to unmarshal ActionResult: %v", err)
	}

	if result.Status != 1 {
		t.Fatalf("expected ActionResult.Status=1 (success), got %d: %s", result.Status, result.Log)
	}

	var resp types.VerifyResponse
	if err := json.Unmarshal(result.Data, &resp); err != nil {
		t.Fatalf("failed to unmarshal VerifyResponse: %v", err)
	}

	if resp.ReceivedValue != "hello-flare" {
		t.Errorf("expected ReceivedValue 'hello-flare', got %q", resp.ReceivedValue)
	}
	if resp.Status != "VERIFIED" {
		t.Errorf("expected Status 'VERIFIED', got %q", resp.Status)
	}
}
