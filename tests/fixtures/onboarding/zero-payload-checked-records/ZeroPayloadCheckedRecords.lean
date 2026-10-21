namespace ZeroPayloadCheckedRecords

/-- A proof-only checked record: no runtime field, one erased proof. -/
structure Witness where
  positive : 0 < 1

/-- A Unit-bearing checked record: one runtime `Unit` field beside an erased proof. -/
structure Token where
  tag : Unit
  fresh : True

/-- A plain empty record: no fields and no proofs, so it is never a checked record. -/
structure Marker where

/-- Checked constructors: a nullary constructor is the only proof source for a `Witness`. -/
@[noinline] def mkWitness : Option Witness := some ⟨Nat.zero_lt_one⟩
@[noinline] def mkToken (tag : Unit) : Option Token := some ⟨tag, trivial⟩

/-- Count a checked proof-only input. -/
@[noinline] def witnessCount (value : Witness) : Nat := 1
/-- Read the unit tag of a checked token input. -/
@[noinline] def tokenTag (value : Token) : Unit := value.tag
/-- Lean produces the proof; the host receives the empty carrier. -/
@[noinline] def produceWitness : Witness := ⟨Nat.zero_lt_one⟩
@[noinline] def produceToken : Token := ⟨(), trivial⟩
/-- Containers of zero-payload results keep their length and presence. -/
@[noinline] def witnesses (count : Nat) : Array Witness :=
  (List.replicate count (⟨Nat.zero_lt_one⟩ : Witness)).toArray
@[noinline] def maybeWitness (present : Bool) : Option Witness :=
  if present then some ⟨Nat.zero_lt_one⟩ else none
/-- A plain empty record crosses as an ordinary copied record in both directions. -/
@[noinline] def markerCount (value : Marker) : Nat := 0
@[noinline] def produceMarker : Marker := Marker.mk

end ZeroPayloadCheckedRecords
