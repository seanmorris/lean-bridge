namespace InheritedCheckedRecords

/-- A positive word represented by its natural-number payload. -/
abbrev Word := { value : Nat // 0 < value }

def mkWord (value : Nat) : Option Word :=
  if positive : 0 < value then some ⟨value, positive⟩ else none

/-- A visibly normalizing field constructor. -/
def normalizeWord (value : Nat) : Option Word :=
  some ⟨Nat.succ value, Nat.succ_pos value⟩

/-- The checked parent. Its proof relates two transported payload fields. -/
structure Span where
  lo : Nat
  hi : Nat
  ordered : lo ≤ hi

def mkSpan (lo hi : Nat) : Option Span :=
  if ordered : lo ≤ hi then some ⟨lo, hi, ordered⟩ else none

/-- Normalize every pair to a span from zero to its sum. -/
def normalizeSpan (lo hi : Nat) : Option Span :=
  some ⟨0, lo + hi, Nat.zero_le _⟩

/-- A checked child keeps its checked parent as Lean's `toSpan` subobject field. -/
structure Ticket extends Span where
  word : Word
  linked : hi ≤ word.val

def mkTicket (toSpan : Span) (word : Word) : Option Ticket :=
  if linked : toSpan.hi ≤ word.val then some ⟨toSpan, word, linked⟩ else none

/-- Normalize the child payload while retaining the already checked parent. -/
def normalizeTicket (toSpan : Span) (word : Word) : Option Ticket :=
  let normalized : Word := ⟨Nat.succ toSpan.hi, Nat.succ_pos toSpan.hi⟩
  let _ := word
  some ⟨toSpan, normalized, Nat.le_succ toSpan.hi⟩

/-- A second inheritance level with its own refined payload and proof. -/
structure Stamped extends Ticket where
  mark : Fin 8
  stamped : mark.val ≤ word.val

def mkStamped (toTicket : Ticket) (mark : Fin 8) : Option Stamped :=
  if stamped : mark.val ≤ toTicket.word.val then some ⟨toTicket, mark, stamped⟩ else none

def normalizeStamped (toTicket : Ticket) (mark : Fin 8) : Option Stamped :=
  let _ := mark
  some ⟨toTicket, ⟨0, by decide⟩, Nat.zero_le _⟩

/-- A source alias must retain its own nominal edge without duplicating the record. -/
abbrev TicketAlias := Ticket

def ticketFrom (value : Nat) : Ticket :=
  let span : Span := ⟨value, value, Nat.le_refl value⟩
  let word : Word := ⟨Nat.succ value, Nat.succ_pos value⟩
  ⟨span, word, Nat.le_succ value⟩

def stampedFrom (value : Nat) : Stamped :=
  ⟨ticketFrom value, ⟨0, by decide⟩, Nat.zero_le _⟩

@[noinline] def first (value : Ticket) : Nat := value.lo + value.hi + value.word.val
@[noinline] def normalized (value : Ticket) : Nat := value.lo + value.hi + value.word.val
@[noinline] def pair (left right : Ticket) : Nat := left.word.val + right.word.val
@[noinline] def aliased (value : TicketAlias) : Nat := value.word.val
@[noinline] def nested (value : Stamped) : Nat := value.word.val + value.mark.val
@[noinline] def echo (value : Ticket) : Ticket := value

/-- Lean produces every erased proof on results; no host constructor is selected. -/
def produce (value : Nat) : Ticket := ticketFrom value
def produceStamped (value : Nat) : Stamped := stampedFrom value

end InheritedCheckedRecords
