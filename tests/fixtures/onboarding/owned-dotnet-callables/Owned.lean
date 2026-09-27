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

def withFunction (value : Bundle) (callback : (Bundle → Bundle) → Bundle → Bundle) : Bundle :=
  callback id value

def viaUnit (callback : Unit → Unit) (value : Unit) : Unit := callback value
def viaBool (callback : Bool → Bool) (value : Bool) : Bool := callback value
def viaChar (callback : Char → Char) (value : Char) : Char := callback value
def viaNat (callback : Nat → Nat) (value : Nat) : Nat := callback value
def viaInt (callback : Int → Int) (value : Int) : Int := callback value
def viaU8 (callback : UInt8 → UInt8) (value : UInt8) : UInt8 := callback value
def viaU16 (callback : UInt16 → UInt16) (value : UInt16) : UInt16 := callback value
def viaU32 (callback : UInt32 → UInt32) (value : UInt32) : UInt32 := callback value
def viaU64 (callback : UInt64 → UInt64) (value : UInt64) : UInt64 := callback value
def viaI8 (callback : Int8 → Int8) (value : Int8) : Int8 := callback value
def viaI16 (callback : Int16 → Int16) (value : Int16) : Int16 := callback value
def viaI32 (callback : Int32 → Int32) (value : Int32) : Int32 := callback value
def viaI64 (callback : Int64 → Int64) (value : Int64) : Int64 := callback value
def viaUsize (callback : USize → USize) (value : USize) : USize := callback value
def viaIsize (callback : ISize → ISize) (value : ISize) : ISize := callback value
def viaF32 (callback : Float32 → Float32) (value : Float32) : Float32 := callback value
def viaF64 (callback : Float → Float) (value : Float) : Float := callback value
def viaString (callback : String → String) (value : String) : String := callback value
def viaBytes (callback : ByteArray → ByteArray) (value : ByteArray) : ByteArray := callback value

end Owned
