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

end Corpus.Wire
