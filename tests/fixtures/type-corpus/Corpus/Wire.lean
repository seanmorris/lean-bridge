import Lean

namespace Corpus.Wire

open Lean

def integer (value : Int) : Json := Json.mkObj [("integer", toJson (toString value))]
def natural (value : Nat) : Json := integer (Int.ofNat value)
def text (value : String) : Json := Json.mkObj [("string", toJson value)]
def boolean (value : Bool) : Json := Json.mkObj [("bool", toJson value)]
def marker (_ : Unit) : Json := Json.mkObj [("unit", toJson true)]
def bytes (value : ByteArray) : Json :=
  Json.mkObj [("bytes", toJson (value.data.map UInt8.toNat))]
def array (encode : α → Json) (values : Array α) : Json :=
  Json.mkObj [("array", Json.arr (values.map encode))]
def record (name : String) (fields : List (String × Json)) : Json :=
  Json.mkObj [("record", toJson name), ("fields", Json.mkObj fields)]

-- Compare exact bits for finite values, signed zero and infinities. NaN payloads
-- are intentionally not specified by these cases; only classification is checked.
def floating32 (value : Float32) : Json :=
  Json.mkObj [("float32", toJson (if value.isNaN then "nan" else toString value.toBits.toNat))]
def floating64 (value : Float) : Json :=
  Json.mkObj [("float64", toJson (if value.isNaN then "nan" else toString value.toBits.toNat))]

def float32Cases (operation : Float32 → Float32) : List (String × Json) :=
  [("finite", 0x3fc00000), ("zero", 0), ("negative-zero", 0x80000000),
   ("subnormal", 1), ("largest", 0x7f7fffff), ("positive-infinity", 0x7f800000),
   ("negative-infinity", 0xff800000), ("nan", 0x7fc00000)].map
    fun (name, bits) => ("float32-" ++ name, floating32 (operation (Float32.ofBits bits)))
def float64Cases (operation : Float → Float) : List (String × Json) :=
  [("finite", 0x3ff8000000000000), ("zero", 0), ("negative-zero", 0x8000000000000000),
   ("subnormal", 1), ("largest", 0x7fefffffffffffff), ("positive-infinity", 0x7ff0000000000000),
   ("negative-infinity", 0xfff0000000000000), ("nan", 0x7ff8000000000000)].map
    fun (name, bits) => ("float64-" ++ name, floating64 (operation (Float.ofBits bits)))

end Corpus.Wire
