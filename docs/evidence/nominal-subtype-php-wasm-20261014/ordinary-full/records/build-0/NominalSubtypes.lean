namespace NominalSubtypes

abbrev Positive := { value : Nat // 0 < value }

def scalar (value : Nat) : Positive := ⟨value + 1, Nat.zero_lt_succ value⟩

def plusOne (value : Nat) : Option Positive :=
  if value < 100 then some (scalar value) else none

def plusTwo (value : Nat) : Option Positive :=
  if value < 90 then some (scalar (value + 1)) else none

structure Envelope where
  payload : Positive
  digit : Fin 3

structure Pair where
  left : Envelope
  right : Envelope

inductive Event where
  | empty
  | box (value : Envelope)
  | choices (values : Array (Option (Except Positive Positive)))

abbrev EnvelopeAlias := Envelope
abbrev Group := Array (Option EnvelopeAlias)

structure AliasPair where
  left : Group
  right : Group

def first (value : Envelope) : Nat := value.payload.val
def second (value : Envelope) : Nat := value.payload.val
def combine (left right : Envelope) : Nat := left.payload.val * 100 + right.payload.val
def nested (value : Pair) : Nat := combine value.left value.right
def eventFirst : Event → Nat
  | .empty => 0
  | .box value => first value
  | .choices values => values.foldl (fun sum value => sum + match value with
      | none => 0
      | some (.ok value) => value.val
      | some (.error value) => value.val) 0
def eventSecond (value : Event) : Nat := eventFirst value
def echoEnvelope (value : Envelope) : Envelope := value
def aliases (left right : Group) : Nat :=
  (left ++ right).foldl (fun sum item => sum + match item with
    | none => 0
    | some value => value.payload.val) 0
def inspectAliasPair (value : AliasPair) : Nat := aliases value.left value.right
def echoGroups (value : Group) : Group := value
def echoPair (value : AliasPair) : AliasPair := value
def echoEvent (value : Event) : Event := value
def plainFin (value : Fin 3) : Nat := value.val

-- These exports require no host-selected input constructor, even in a package
-- containing no other exports. Results deliberately exceed the input limits.
def produceEnvelope (value : Nat) : Envelope := ⟨scalar value, ⟨2, by decide⟩⟩
def arrayValues (value : Nat) : Array Positive := #[scalar value, scalar (value + 1)]
def listValues (value : Nat) : List Positive := [scalar value, scalar (value + 1)]
def optional (value : Nat) : Option Positive := if value == 0 then none else some (scalar value)
def product (value : Nat) : Positive × Positive := (scalar value, scalar (value + 1))
def branch (value : Nat) : Except Positive Positive :=
  if value == 0 then .error (scalar value) else .ok (scalar value)
def groupValues (value : Nat) : Group := #[none, some (produceEnvelope value)]
def pairValues (value : Nat) : AliasPair := ⟨groupValues value, groupValues (value + 1)⟩
def eventValue (value : Nat) : Event := .box (produceEnvelope value)
def eventEmpty (_ : Nat) : Event := .empty
def eventChoices (value : Nat) : Event := .choices #[none, some (.ok (scalar value)), some (.error (scalar (value + 1)))]
def noItems (_ : Nat) : Array Positive := #[]

end NominalSubtypes
