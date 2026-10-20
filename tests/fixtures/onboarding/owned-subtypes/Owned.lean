namespace Owned

structure Ticket where
  serial : Nat
  label : String

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

structure CallbackPayload where
  count : Int
  bytes : ByteArray

structure CallbackBundle where
  primary : Ticket
  payload : CallbackPayload

def newTicket (serial : Nat) (label : String) : Ticket :=
  ⟨serial, label⟩

def serial (ticket : Ticket) : Nat := ticket.serial

def echoRecord (value : Bundle) : Bundle := value

def echoRecordAlternate (value : Bundle) : Bundle := value

def transferRecord (value : Bundle) : Bundle := value

def callbackRecord (value : CallbackBundle)
    (callback : CallbackBundle → CallbackBundle) : CallbackBundle :=
  callback value

end Owned
