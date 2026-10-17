namespace RecursiveCheckedRecords

/-- A positive word represented by its natural-number payload. -/
abbrev Positive := { value : Nat // 0 < value }

/-- Check and normalize a word by adding one. -/
def plusOne (value : Nat) : Option Positive :=
  if value < 100 then some ⟨value + 1, Nat.zero_lt_succ value⟩ else none

/-- A distinct per-site word constructor. -/
def plusTwo (value : Nat) : Option Positive :=
  if value < 90 then some ⟨value + 2, by omega⟩ else none

/-- A recursive checked record. Proofs never cross the package boundary. -/
structure Packet where
  value : Positive
  digit : Fin 3
  tail : Option Packet
  linked : digit.val ≤ value.val

/-- Preserve a packet when its current payload satisfies the outer relation. -/
def mkPacket (value : Positive) (digit : Fin 3) (tail : Option Packet) : Option Packet :=
  if linked : digit.val ≤ value.val then some ⟨value, digit, tail, linked⟩ else none

/-- Normalize the current value while preserving the already checked tail. -/
def normalizePacket (value : Positive) (digit : Fin 3) (tail : Option Packet) : Option Packet :=
  let normalized : Positive := ⟨digit.val + 1, Nat.zero_lt_succ digit.val⟩
  let _ := value
  some ⟨normalized, digit, tail, Nat.le_succ digit.val⟩

abbrev PacketAlias := Packet
abbrev Groups := Array (Option PacketAlias)

@[noinline] def first (value : Packet) : Nat := value.value.val
@[noinline] def second (value : Packet) : Nat := value.value.val
@[noinline] def echo (value : Packet) : Packet := value
@[noinline] def groups (values : Groups) : Nat := values.size
@[noinline] def echoGroups (values : Groups) : Groups := values

def positive (value : Nat) : Positive :=
  ⟨value + 1, Nat.zero_lt_succ value⟩

def produce (value : Nat) : Packet :=
  ⟨positive value, ⟨1, by decide⟩,
    some ⟨positive (value + 1), ⟨2, by decide⟩, none, by simp [positive]⟩,
    by simp [positive]⟩

end RecursiveCheckedRecords
