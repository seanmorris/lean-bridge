namespace NominalResults

abbrev Positive := { value : Nat // 0 < value }

structure Envelope where
  payload : Positive
  digit : Fin 3

inductive Event where
  | empty
  | box (value : Envelope)
  | choices (values : Array (Option (Except Positive Positive)))

abbrev EnvelopeAlias := Envelope
abbrev Group := Array (Option EnvelopeAlias)

structure Pair where
  left : Group
  right : Group

def scalar (value : Nat) : Positive := ⟨value + 1, Nat.zero_lt_succ value⟩
def produceEnvelope (value : Nat) : Envelope := ⟨scalar value, ⟨2, by decide⟩⟩
def arrayValues (value : Nat) : Array Positive := #[scalar value, scalar (value + 1)]
def listValues (value : Nat) : List Positive := [scalar value, scalar (value + 1)]
def optional (value : Nat) : Option Positive := if value == 0 then none else some (scalar value)
def product (value : Nat) : Positive × Positive := (scalar value, scalar (value + 1))
def branch (value : Nat) : Except Positive Positive :=
  if value == 0 then .error (scalar value) else .ok (scalar value)
def groupValues (value : Nat) : Group := #[none, some (produceEnvelope value)]
def pairValues (value : Nat) : Pair := ⟨groupValues value, groupValues (value + 1)⟩
def eventValue (value : Nat) : Event := .box (produceEnvelope value)
def eventEmpty (_ : Nat) : Event := .empty
def eventChoices (value : Nat) : Event := .choices #[none, some (.ok (scalar value)), some (.error (scalar (value + 1)))]
def noItems (_ : Nat) : Array Positive := #[]

-- Separate mixed-package checks select these only for host-produced inputs.
def checkedOne (value : Nat) : Option Positive :=
  if value < 100 then some (scalar value) else none
def checkedTwo (value : Nat) : Option Positive :=
  if value < 90 then some (scalar (value + 1)) else none
def echoGroups (value : Group) : Group := value
def echoPair (value : Pair) : Pair := value

-- These inputs have no selected constructor and must remain refused.
def uncheckedInput (value : Positive) : Nat := value.val
def uncheckedEnvelope (value : Envelope) : Nat := value.payload.val
def callbackResult (_ : Nat) : Nat → Positive := scalar

structure Generic (α : Type) where
  value : α
abbrev GenericPositive := Generic Positive
def genericResult (value : Nat) : GenericPositive := ⟨scalar value⟩

inductive Chain where
  | empty
  | node (value : Positive) (tail : Chain)
def recursiveResult (_ : Nat) : Chain := .empty

structure Proved where
  payload : Positive
  positive : 0 < payload.val
def checkedResult (value : Nat) : Proved := ⟨scalar value, (scalar value).property⟩

-- Existing unrefined recursion and Fin-only results must retain their mappings.
inductive PlainChain where
  | empty
  | node (value : Nat) (tail : PlainChain)
def plainRecursive (_ : Nat) : PlainChain := .empty
structure Digit where
  value : Fin 3
def finOnly (_ : Nat) : Digit := ⟨⟨2, by decide⟩⟩

end NominalResults
