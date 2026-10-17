namespace MutualCheckedRecords

/-- A positive word represented by its natural-number payload. -/
abbrev Positive := { value : Nat // 0 < value }

/-- Check and normalize a word by adding one. -/
def plusOne (value : Nat) : Option Positive :=
  if value < 100 then some ⟨value + 1, Nat.zero_lt_succ value⟩ else none

/-- A distinct per-site word constructor. -/
def plusTwo (value : Nat) : Option Positive :=
  if value < 90 then some ⟨value + 2, by omega⟩ else none

-- A checked record and plain variant form one finite recursive graph.
mutual
structure Envelope where
  value : Positive
  mode : Fin 3
  next : Option Step
  linked : mode.val ≤ value.val
inductive Step where
  | stop
  | more (packet : Envelope)
end

/-- Validate every envelope with the constructor selected at this export site. -/
def mkEnvelope (value : Positive) (mode : Fin 3) (next : Option Step) : Option Envelope :=
  if linked : mode.val ≤ value.val then some ⟨value, mode, next, linked⟩ else none

/-- A distinct outer constructor with the same proof obligation. -/
def normalizeEnvelope (value : Positive) (mode : Fin 3) (next : Option Step) : Option Envelope :=
  if linked : mode.val ≤ value.val then some ⟨value, mode, next, linked⟩ else none

mutual
def totalEnvelope : Envelope → Nat
  | ⟨value, _, none, _⟩ => value.val
  | ⟨value, _, some next, _⟩ => value.val + totalStep next
def totalStep : Step → Nat
  | .stop => 0
  | .more packet => totalEnvelope packet
end

abbrev EnvelopeAlias := Envelope
abbrev Groups := Array (Option EnvelopeAlias)

@[noinline] def first (value : Envelope) : Nat := value.value.val
@[noinline] def second (value : Envelope) : Nat := value.value.val
@[noinline] def echo (value : Envelope) : Envelope := value
@[noinline] def groups (values : Groups) : Nat := values.size
@[noinline] def echoGroups (values : Groups) : Groups := values

def positive (value : Nat) : Positive :=
  ⟨value + 1, Nat.zero_lt_succ value⟩

def produce (value : Nat) : Envelope :=
  ⟨positive value, ⟨1, by decide⟩,
    some (.more ⟨positive (value + 1), ⟨2, by decide⟩, none, by simp [positive]⟩),
    by simp [positive]⟩

end MutualCheckedRecords
