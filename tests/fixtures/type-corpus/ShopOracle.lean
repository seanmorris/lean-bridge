import Corpus.Wire
import Shop.Pricing
import Shop.Pending

open Lean Corpus.Wire Shop.Pricing

def basketJson (value : Basket) : Json := record "Basket" [
  ("label", text value.label), ("units", natural value.units),
  ("credit", integer value.credit),
  ("batches", array (array (natural ∘ UInt32.toNat)) value.batches),
  ("active", boolean value.active)]

def main : IO Unit := IO.println <| (Json.mkObj ([
  ("dependency", natural (quoteUnits 7).toNat),
  ("bool-as-number", natural (quoteUnits 1).toNat),
  ("float32-wrong-type", floating32 (reverseRate 1)),
  ("float64-wrong-type", floating64 (reversePrice 1)),
  ("exact-large", natural (basketTotal (2^4096 + 1) 3)),
  ("zero", natural (basketTotal 0 0)),
  ("signed-large", integer (refund (-(2^4096)) 7)),
  ("text", text (receiptLabel "a\x00λ🌿" "end")),
  ("empty-text", text (receiptLabel "" "")),
  ("array", array (natural ∘ UInt32.toNat) (restock #[0, 4294967295, 41] 1)),
  ("empty-array", array (natural ∘ UInt32.toNat) (restock #[] 1)),
  ("nested-array", array (array (natural ∘ UInt32.toNat)) (regroup #[#[1, 2], #[], #[3]])),
  ("record", basketJson (revise ⟨"basket\x00λ", 2^4096, -7, #[#[1, 2], #[]], true⟩)),
  ("u64-wrap", natural (nextSerial 18446744073709551615).toNat),
  ("i64-wrap", integer (previousBalance (-9223372036854775808)).toInt),
  ("bool", boolean (enabled false)),
  ("unit", marker (keepMarker ())),
  ("bytes", bytes (reverseBlob ⟨#[0, 255, 128, 65]⟩)),
  ("empty-bytes", bytes (reverseBlob ⟨#[]⟩)),
  ("uint8-wrap", natural (nextTag 255).toNat),
  ("uint8-zero", natural (nextTag 0).toNat),
  ("uint16-wrap", natural (nextBatch 65535).toNat),
  ("uint16-zero", natural (nextBatch 0).toNat),
  ("int8-wrap", integer (reduceGrade (-128)).toInt),
  ("int8-zero", integer (reduceGrade 0).toInt),
  ("int16-wrap", integer (reduceStock (-32768)).toInt),
  ("int16-zero", integer (reduceStock 0).toInt),
  ("int32-wrap", integer (reduceOffset (-2147483648)).toInt),
  ("int32-zero", integer (reduceOffset 0).toInt)]
  ++ float32Cases reverseRate ++ float64Cases reversePrice)).compress
