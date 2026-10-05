namespace Owned

/- Ticket is explicitly selected as a resource by the author configuration.
   Its fields are values, but the bridge must preserve its nominal identity. -/
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
def callbackRecord (value : Bundle) (callback : Bundle → Bundle) : Bundle :=
  callback value
def callbackRecursive (value : Tree) (callback : Tree → Tree) : Tree :=
  callback value
def makeRecord (captured : Bundle) : Bool → Bundle → Bundle :=
  fun useCaptured supplied => if useCaptured then captured else supplied
def makeRecursive (captured : Tree) : Bool → Tree → Tree :=
  fun useCaptured supplied => if useCaptured then captured else supplied

/- An aggregate lease does not authorize retaining borrowed host callbacks. -/
structure HiddenCallback where
  callback : Bundle → Bundle

def hiddenCallback (value : HiddenCallback) : HiddenCallback := value

theorem primary_bundle (first : Ticket) (spare : Option Ticket)
    (peers : Array Ticket) (history : List Ticket) (data : Payload) :
    primary (bundle first spare peers history data) = first := rfl

theorem captured_record (captured supplied : Bundle) :
    makeRecord captured true supplied = captured := rfl

theorem supplied_record (captured supplied : Bundle) :
    makeRecord captured false supplied = supplied := rfl

end Owned
