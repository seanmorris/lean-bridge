namespace Owned

structure Ticket where
  serial : Nat
  label : String

structure Payload where
  count : Int
  bytes : ByteArray

structure Bundle where
  primary : Ticket
  spare : Option Ticket
  peers : Array Ticket
  history : List Ticket
  payload : Payload

inductive Tree where
  | leaf (ticket : Ticket)
  | branch (children : Array Tree)

def newTicket (serial : Nat) (label : String) : Ticket := ⟨serial, label⟩
def serial (ticket : Ticket) : Nat := ticket.serial
def echoRecord (value : Bundle) : Bundle := value
def callbackRecord (value : Bundle) (callback : Bundle → Bundle) : Bundle := callback value
def callbackRecursive (value : Tree) (callback : Tree → Tree) : Tree := callback value
def twice (value : Bundle) (callback : Bundle → Bundle) : Bundle := callback (callback value)
def repeatedly (value : Bundle) (callback : Bundle → Bundle) (count : Nat) : Bundle :=
  count.rec value (fun _ value => callback value)
def retainCallback (callback : Bundle → Bundle) : Bundle → Bundle := callback
def identityClosure (_ : Unit) : Bundle → Bundle := id
def factory (callback : Unit → Ticket) : Ticket := callback ()
def construct (ticket : Ticket) (callback : Ticket → Bundle) : Bundle := callback ticket

theorem twice_identity (value : Bundle) : twice value id = value := rfl
theorem factory_identity (ticket : Ticket) : factory (fun _ => ticket) = ticket := rfl

end Owned
