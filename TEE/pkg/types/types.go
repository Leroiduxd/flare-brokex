package types

import (
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
