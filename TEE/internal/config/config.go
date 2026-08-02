package config

import (
	"os"
	"strconv"
	"time"
)

const (
	Version = "0.1.0"

	OPTypeProof     = "MINPROOF"
	OPCommandVerify = "MINVERIFY"

	OPTypeRisk        = "RISK"
	OPCommandCalculate = "CALCULATE"

	TimeoutShutdown = 5 * time.Second
)

var (
	ExtensionPort   = 8080
	SignPort        = 9090
	TypesServerPort = 8100
)

func init() {
	ep := os.Getenv("EXTENSION_PORT")
	sp := os.Getenv("SIGN_PORT")
	tp := os.Getenv("TYPES_SERVER_PORT")

	if ep != "" {
		if v, err := strconv.Atoi(ep); err == nil {
			ExtensionPort = v
		}
	}
	if sp != "" {
		if v, err := strconv.Atoi(sp); err == nil {
			SignPort = v
		}
	}
	if tp != "" {
		if v, err := strconv.Atoi(tp); err == nil {
			TypesServerPort = v
		}
	}
}
