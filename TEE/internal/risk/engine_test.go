package risk

import (
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"

	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/crypto"
)

func TestCalculateRiskParameters_Bootstrap(t *testing.T) {
	cfg := DefaultConfig()
	lpTotalCapital := 100000.0
	oiLong := 5000.0
	oiShort := 4000.0
	avgLong := 2000.0
	avgShort := 2000.0
	currentPrice := 2000.0
	volatility := 0.15

	maxLong, maxShort, spreadL, spreadS, activation, _ := CalculateRiskParameters(
		cfg, lpTotalCapital, oiLong, oiShort, avgLong, avgShort, currentPrice, volatility,
	)

	if activation != 0.0 {
		t.Errorf("expected activation 0.0 in bootstrap mode, got %f", activation)
	}

	if spreadL != 30.0 || spreadS != 30.0 {
		t.Errorf("expected base spread 30 bps, got long=%f short=%f", spreadL, spreadS)
	}

	// En mode Bootstrap (activation=0), cushion = 95% = 95,000. maxTotalOI = min(75000, 95000 * 3) = 75,000.
	// asymLong = 0.5, asymShort = 0.5 => 37,500 par côté.
	if maxLong != 37500.0 || maxShort != 37500.0 {
		t.Errorf("expected maxOI 37500 per side in bootstrap mode, got long=%f short=%f", maxLong, maxShort)
	}
}

func TestCalculateRiskParameters_SkewCap(t *testing.T) {
	cfg := DefaultConfig()
	lpTotalCapital := 100000.0
	oiLong := 60000.0 // 60% of 100k
	oiShort := 40000.0
	avgLong := 2000.0
	avgShort := 2000.0
	currentPrice := 2000.0
	volatility := 0.15

	maxLong, _, spreadL, _, _, _ := CalculateRiskParameters(
		cfg, lpTotalCapital, oiLong, oiShort, avgLong, avgShort, currentPrice, volatility,
	)

	if maxLong != oiLong {
		t.Errorf("expected maxLong to be capped at current oiLong %f, got %f", oiLong, maxLong)
	}

	if spreadL != 100.0 {
		t.Errorf("expected spreadLong to be max 100 bps on skew cap, got %f", spreadL)
	}
}

func TestPythVolatilityFetcher(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// Simulate 65 data points
		closes := "["
		times := "["
		for i := 0; i < 65; i++ {
			if i > 0 {
				closes += ","
				times += ","
			}
			closes += "2000.0"
			times += "1684127160"
		}
		closes += "]"
		times += "]"
		w.Write([]byte(`{"s":"ok","t":` + times + `,"c":` + closes + `}`))
	}))
	defer mockServer.Close()

	vol, err := FetchPythVolatility(mockServer.URL, "Metal.XAU/USD", mockServer.Client())
	if err != nil {
		t.Fatalf("unexpected error fetching volatility: %v", err)
	}

	if vol != 0.075 { // Minimum floor cap
		t.Errorf("expected vol 0.075 for flat prices, got %f", vol)
	}
}

func TestSignRiskProof(t *testing.T) {
	// Dummy private key
	privKeyHex := "0xe12f9b03327a875c2d5bf9b40a75cd2effeed46ea508ee595c6bc708c386da8c"
	privKey, _ := crypto.HexToECDSA("e12f9b03327a875c2d5bf9b40a75cd2effeed46ea508ee595c6bc708c386da8c")
	expectedSigner := crypto.PubkeyToAddress(privKey.PublicKey)

	proof := &types.RiskProof{
		AssetHash:   Bytes32FromHex("0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55"),
		MaxOILong:   big.NewInt(75000),
		MaxOIShort:  big.NewInt(75000),
		SpreadLong:  big.NewInt(300), // 3 bps * 100
		SpreadShort: big.NewInt(300),
		Timestamp:   1700000000,
	}

	err := SignRiskProof(proof, privKeyHex)
	if err != nil {
		t.Fatalf("failed to sign proof: %v", err)
	}

	if len(proof.Signature) != 65 {
		t.Fatalf("expected 65 bytes signature, got %d", len(proof.Signature))
	}

	// Verify signature recovery
	sig := make([]byte, 65)
	copy(sig, proof.Signature)
	if sig[64] >= 27 {
		sig[64] -= 27
	}

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
	ethHash := crypto.Keccak256([]byte("\x19Ethereum Signed Message:\n32" + string(hash)))

	pubKey, err := crypto.SigToPub(ethHash, sig)
	if err != nil {
		t.Fatalf("failed to recover pubkey: %v", err)
	}

	recoveredAddress := crypto.PubkeyToAddress(*pubKey)
	if recoveredAddress != expectedSigner {
		t.Errorf("expected signer %s, got %s", expectedSigner.Hex(), recoveredAddress.Hex())
	}
}
