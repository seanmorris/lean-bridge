namespace NominalConversion

abbrev Positive := { value : Nat // 0 < value }

def plusOne (value : Nat) : Option Positive :=
  if value < 100 then some ⟨value + 1, Nat.zero_lt_succ value⟩ else none

def plusTwo (value : Nat) : Option Positive :=
  if value < 90 then some ⟨value + 2, Nat.zero_lt_succ (value + 1)⟩ else none

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
def echo (value : Envelope) : Envelope := value
def produce (value : Nat) : Envelope := ⟨⟨value + 1, Nat.zero_lt_succ value⟩, ⟨2, by decide⟩⟩
def produceEvent (value : Nat) : Event := .box (produce value)

end NominalConversion
