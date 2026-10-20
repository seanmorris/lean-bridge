namespace Owned

opaque Ticket : Type

def checkedCount (value : Int) : Option { count : Int // 0 ≤ count } :=
  if proof : 0 ≤ value then some ⟨value, proof⟩ else none

def checkedCountAlternate (value : Int) : Option { count : Int // 0 ≤ count } :=
  checkedCount value

structure Payload where
  count : { count : Int // 0 ≤ count }
  bytes : ByteArray

structure Bundle where
  primary : Ticket
  spare : Option Ticket
  peers : Array Ticket
  history : List Ticket
  payload : Payload

def echoRecord (value : Bundle) : Bundle := value

def echoRecordAlternate (value : Bundle) : Bundle := value

end Owned
