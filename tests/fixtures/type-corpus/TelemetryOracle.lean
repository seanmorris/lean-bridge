import Corpus.Wire
import Telemetry.Readings
import Telemetry.Pending

open Lean Corpus.Wire Telemetry.Readings

def frameJson (value : Frame) : Json := record "Frame" [
  ("samples", array (array (natural ∘ UInt32.toNat)) value.samples),
  ("counter", natural value.counter), ("bias", integer value.bias),
  ("title", text value.title), ("valid", boolean value.valid)]

def main : IO Unit := IO.println <| (Json.mkObj ([
  ("dependency", natural (measureTick 7).toNat),
  ("bool-as-number", natural (measureTick 1).toNat),
  ("wrong-boolean", boolean (invertStatus true)),
  ("bad-nested", array (array (natural ∘ UInt32.toNat)) (rotateRows #[#[0]])),
  ("float32-wrong-type", floating32 (halveSample 1)),
  ("float64-wrong-type", floating64 (halveMeasure 1)),
  ("exact-large", natural (accumulate (2^4096 + 1) 3)),
  ("zero", natural (accumulate 0 0)),
  ("signed-large", integer (calibrate (-(2^4096)) 7)),
  ("text", text (channelLabel "a\x00λ🌿" "end")),
  ("empty-text", text (channelLabel "" "")),
  ("array", array (natural ∘ UInt32.toNat) (offsetSamples #[0, 4294967295, 41] 1)),
  ("empty-array", array (natural ∘ UInt32.toNat) (offsetSamples #[] 1)),
  ("nested-array", array (array (natural ∘ UInt32.toNat)) (rotateRows #[#[1, 2], #[], #[3]])),
  ("record", frameJson (advanceFrame ⟨#[#[1, 2], #[]], 2^4096, -7, "frame\x00λ", true⟩)),
  ("u64-wrap", natural (wrapClock 18446744073709551615).toNat),
  ("i64-wrap", integer (nextOffset 9223372036854775807).toInt),
  ("bool", boolean (invertStatus false)),
  ("unit", marker (acknowledge ())),
  ("bytes", bytes (mirrorPayload ⟨#[0, 255, 128, 65]⟩)),
  ("empty-bytes", bytes (mirrorPayload ⟨#[]⟩)),
  ("uint8-wrap", natural (advanceTag 255).toNat),
  ("uint8-zero", natural (advanceTag 0).toNat),
  ("uint16-wrap", natural (advanceSequence 65535).toNat),
  ("uint16-zero", natural (advanceSequence 0).toNat),
  ("int8-wrap", integer (raiseGrade 127).toInt),
  ("int8-zero", integer (raiseGrade 0).toInt),
  ("int16-wrap", integer (raiseLevel 32767).toInt),
  ("int16-zero", integer (raiseLevel 0).toInt),
  ("int32-wrap", integer (raiseBaseline 2147483647).toInt),
  ("int32-zero", integer (raiseBaseline 0).toInt)]
  ++ float32Cases halveSample ++ float64Cases halveMeasure)).compress
