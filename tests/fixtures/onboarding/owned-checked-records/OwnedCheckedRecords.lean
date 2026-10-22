namespace OwnedCheckedRecords

/-- An identity resource carried by lease. -/
structure Ticket where
  serial : Nat
  label : String

/-- Shape A: a copied checked record. The proof relates its two payload fields. -/
structure Window where
  lo : Nat
  hi : Nat
  ordered : lo ≤ hi

@[noinline] def mkWindow (lo hi : Nat) : Option Window :=
  if h : lo ≤ hi then some ⟨lo, hi, h⟩ else none

/-- An owned aggregate whose copied field is a checked record. -/
structure Booking where
  holder : Ticket
  window : Window

/-- Shape B: an owned checked record. It holds a resource field and its proof
relates a payload field to the resource's serial. -/
structure Claim where
  holder : Ticket
  quota : Nat
  bounded : quota ≤ holder.serial

@[noinline] def mkClaim (holder : Ticket) (quota : Nat) : Option Claim :=
  if h : quota ≤ holder.serial then some ⟨holder, quota, h⟩ else none

/-- A checked Subtype field below the owned checked record keeps its own direction. -/
abbrev Positive := { value : Nat // 0 < value }

def checkedPositive (value : Nat) : Option Positive :=
  if h : 0 < value then some ⟨value, h⟩ else none

structure Grant where
  holder : Ticket
  weight : Positive
  limit : Nat
  within : weight.val ≤ limit

def mkGrant (holder : Ticket) (weight : Positive) (limit : Nat) : Option Grant :=
  if h : weight.val ≤ limit then some ⟨holder, weight, limit, h⟩ else none

def newTicket (serial : Nat) (label : String) : Ticket := ⟨serial, label⟩

def serial (ticket : Ticket) : Nat := ticket.serial

/-- Shape A both ways: the input window runs mkWindow, the result projects it. -/
def echoBooking (value : Booking) : Booking := value

def bookingSpan (value : Booking) : Nat := value.window.hi - value.window.lo

/-- Shape B both ways: the input claim runs mkClaim after the ticket is borrowed. -/
def echoClaim (value : Claim) : Claim := value

def claimQuota (value : Claim) : Nat := value.quota

/-- Transfer: the claim moves into Lean and comes back as a new lease. -/
def transferClaim (value : Claim) : Claim := value

/-- Nested direction: the Positive field runs before mkGrant. -/
def echoGrant (value : Grant) : Grant := value

/-- Containers keep the direction of their site. -/
def echoClaims (values : Array Claim) : Array Claim := values

def firstClaim (values : Array (Option Claim)) : Option Claim :=
  (values.findSome? id)

/-- Result-only: Lean produces an owned checked record from a resource. -/
def claimFor (holder : Ticket) : Option Claim := mkClaim holder 0

end OwnedCheckedRecords
