namespace NestedCheckedRecords

/-- A positive word represented on the wire by its natural-number payload. -/
abbrev Word := { value : Nat // 0 < value }

/-- Reject zero without changing accepted words. -/
def mkWord (value : Nat) : Option Word :=
  if positive : 0 < value then some ⟨value, positive⟩ else none

/-- Normalize every word to the positive successor of its input. -/
def normalizeWord (value : Nat) : Option Word :=
  some ⟨Nat.succ value, Nat.succ_pos value⟩

/-- A proof-backed record whose payload fields are themselves checked. -/
structure Packet where
  digit : Fin 10
  word : Word
  linked : digit.val ≤ word.val

/-- Preserve a packet whose checked payload fields satisfy the outer relation. -/
def mkPacket (digit : Fin 10) (word : Word) : Option Packet :=
  if linked : digit.val ≤ word.val then some ⟨digit, word, linked⟩ else none

/-- Preserve the digit and normalize the word so the outer relation always holds. -/
def normalizePacket (digit : Fin 10) (word : Word) : Option Packet :=
  let normalizedWord : Word := ⟨Nat.succ digit.val, Nat.succ_pos digit.val⟩
  let _ := word
  some ⟨digit, normalizedWord, Nat.le_succ digit.val⟩

/-- A plain copied record containing a checked record. -/
structure Holder where
  packet : Packet
  tag : Nat

/-- A copied variant containing a checked record in one active case. -/
inductive Choice where
  | empty
  | packet (value : Packet)

def packetFrom (value : Nat) : Packet :=
  ⟨⟨0, by decide⟩, ⟨Nat.succ value, Nat.succ_pos value⟩, Nat.zero_le _⟩

@[noinline] def first (value : Packet) : Nat := value.word.val
@[noinline] def second (value : Packet) : Nat := value.word.val
@[noinline] def pair (left right : Packet) : Nat := left.word.val + right.word.val
@[noinline] def inArray (values : Array Packet) : Nat := values.foldl (fun total value => total + value.word.val) 0
@[noinline] def inList (values : List Packet) : Nat := values.foldl (fun total value => total + value.word.val) 0
@[noinline] def inOption (value : Option Packet) : Nat := value.map (·.word.val) |>.getD 0
@[noinline] def inProduct (value : Packet × Packet) : Nat := value.1.word.val + value.2.word.val
@[noinline] def inExcept (value : Except Packet Packet) : Nat :=
  match value with
  | .ok packet => packet.word.val
  | .error packet => packet.word.val
@[noinline] def inHolder (value : Holder) : Nat := value.packet.word.val + value.tag
@[noinline] def inChoice (value : Choice) : Nat :=
  match value with
  | .empty => 0
  | .packet packet => packet.word.val
@[noinline] def echoArray (values : Array Packet) : Array Packet := values

/-- Lean-produced checked records need no input constructor. -/
def produceOption (value : Nat) : Option Packet := some (packetFrom value)
def produceArray (value : Nat) : Array Packet := #[packetFrom value, packetFrom (value + 1)]

end NestedCheckedRecords
