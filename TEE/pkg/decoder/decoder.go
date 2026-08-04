package decoder

import (
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
)

type DataKind string

const (
	KindMessage DataKind = "message"
	KindResult  DataKind = "result"
)

type Decoder interface {
	Decode(message []byte) (teetypes.ActionData, error)
}
