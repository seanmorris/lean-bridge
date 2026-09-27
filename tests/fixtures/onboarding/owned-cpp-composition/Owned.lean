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

inductive Choice where
  | empty
  | one (ticket : Ticket)
  | pair (first second : Ticket)
  | many (tickets : Array Ticket)

inductive Tree where
  | leaf (ticket : Ticket)
  | branch (children : Array Tree)

inductive Chain where
  | stop
  | link (ticket : Ticket) (next : Option Chain)

structure Mixed where
  ticket : Ticket
  markers : Array (Option (Option Bool))
  unit : Option Unit
  result : Except Ticket Bundle
  signed : Int
  unsigned : Nat
  scalar : Char
  precise : Float
  approximate : Float32
  bytes : ByteArray
  words : List UInt64
  product : Ticket × (Option Ticket × Payload)
  chain : Chain

abbrev TicketRow := Array (Option Ticket)
abbrev BundleAlias := Bundle

def newTicket (serial : Nat) (label : String) : Ticket := ⟨serial, label⟩
def serial (ticket : Ticket) : Nat := ticket.serial
def label (ticket : Ticket) : String := ticket.label
def retainTicket (ticket : Ticket) : Ticket := ticket
def bundle (primary : Ticket) (spare : Option Ticket) (peers : Array Ticket)
    (history : List Ticket) (payload : Payload) : Bundle :=
  ⟨primary, spare, peers, history, payload⟩
def primary (value : Bundle) : Ticket := value.primary
def payload (value : Bundle) : Payload := value.payload
def echoArray (value : Array Ticket) : Array Ticket := value
def echoList (value : List Ticket) : List Ticket := value
def echoOption (value : Option Ticket) : Option Ticket := value
def echoResult (value : Except Ticket Bundle) : Except Ticket Bundle := value
def echoTuple (value : Ticket × (Option Ticket × Payload)) :
    Ticket × (Option Ticket × Payload) := value
def echoRecord (value : Bundle) : Bundle := value
def echoVariant (value : Choice) : Choice := value
def echoAlias (value : BundleAlias) : BundleAlias := value
def echoRow (value : TicketRow) : TicketRow := value
def echoRecursive (value : Tree) : Tree := value
def echoNested (value : Array (List (Option (Except Ticket Bundle)))) :
    Array (List (Option (Except Ticket Bundle))) := value
def callbackRecord (value : Bundle) (callback : Bundle → Bundle) : Bundle := callback value
def callbackRecursive (value : Tree) (callback : Tree → Tree) : Tree := callback value
def makeRecord (captured : Bundle) : Bool → Bundle → Bundle :=
  fun useCaptured supplied => if useCaptured then captured else supplied
def makeRecursive (captured : Tree) : Bool → Tree → Tree :=
  fun useCaptured supplied => if useCaptured then captured else supplied
def twice (value : Bundle) (callback : Bundle → Bundle) : Bundle := callback (callback value)
def repeatedly (value : Bundle) (callback : Bundle → Bundle) (count : Nat) : Bundle :=
  count.rec value (fun _ value => callback value)
def retainCallback (callback : Bundle → Bundle) : Bundle → Bundle := callback
def identityClosure (_ : Unit) : Bundle → Bundle := id
def factory (callback : Unit → Ticket) : Ticket := callback ()
def construct (ticket : Ticket) (callback : Ticket → Bundle) : Bundle := callback ticket
def echoChain (value : Chain) : Chain := value
def echoMixed (value : Mixed) : Mixed := value
def dispatch (captured : Bundle) : (Bundle → Bundle) → Bundle := fun callback => callback captured

theorem echo_chain_identity (value : Chain) : echoChain value = value := rfl
theorem dispatch_identity (value : Bundle) : dispatch value id = value := rfl

end Owned
