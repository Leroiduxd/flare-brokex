package types

import "extension-scaffold/pkg/decoder"

func RegisterDecoders(r *decoder.Registry) {
	r.Register(
		decoder.RegistryKey{OPType: "MINPROOF", OPCommand: "MINVERIFY", Kind: decoder.KindResult},
		decoder.NewJSONDecoder[VerifyResponse](),
	)
}
