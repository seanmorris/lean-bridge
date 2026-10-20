namespace CheckedRecordValueIndices

/-- An array whose size is the closed natural-number index. -/
structure Sized (n : Nat) where
  data : Array Nat
  sized : data.size = n

/-- A payload guarded by a closed boolean index. -/
structure Flagged (flag : Bool) where
  count : Nat
  set : (count == 0) = flag

/-- A payload guarded by the length of a closed string index. -/
structure Labeled (label : String) where
  size : Nat
  named : label.length = size

/-- One generic carrier covers closed Nat, Bool and String indices. -/
structure Token (alpha : Type) (index : alpha) where
  count : Nat
  fixed : index = index

abbrev On := Flagged true
abbrev Off := Flagged false
abbrev Ab := Labeled "ab"
abbrev EmptySized := Sized 0
abbrev ZeroToken := Token Nat 0
abbrev WideToken := Token Nat 340282366920938463463374607431768211457
abbrev EmptyToken := Token String ""
abbrev UnicodeToken := Token String "λ🌱"

/-- Exact, site-selected constructors for host-supplied records. -/
def mkOn (count : Nat) : Option On :=
  if h : (count == 0) = true then some ⟨count, h⟩ else none
def mkOff (count : Nat) : Option Off :=
  if h : (count == 0) = false then some ⟨count, h⟩ else none
def mkAb (size : Nat) : Option Ab :=
  if h : "ab".length = size then some ⟨size, h⟩ else none
def mkEmptySized (data : Array Nat) : Option EmptySized :=
  if h : data.size = 0 then some ⟨data, h⟩ else none
def mkZeroToken (count : Nat) : Option ZeroToken := some ⟨count, rfl⟩
def mkWideToken (count : Nat) : Option WideToken := some ⟨count, rfl⟩
def mkEmptyToken (count : Nat) : Option EmptyToken := some ⟨count, rfl⟩
def mkUnicodeToken (count : Nat) : Option UnicodeToken := some ⟨count, rfl⟩

@[noinline] def trueBoolIndex (value : On) : Nat := value.count
@[noinline] def falseBoolIndex (value : Off) : Nat := value.count
@[noinline] def abStringIndex (value : Ab) : Nat := value.size
@[noinline] def emptyStringIndex (value : EmptyToken) : Nat := value.count
@[noinline] def unicodeStringIndex (value : UnicodeToken) : Nat := value.count
@[noinline] def emptySizedIndex (value : EmptySized) : Nat := value.data.size
@[noinline] def zeroNatIndex (value : ZeroToken) : Nat := value.count
@[noinline] def wideNatIndex (value : WideToken) : Nat := value.count

/-- Lean-produced records need no host-side checked constructor. -/
@[noinline] def produceTrueBool : On := ⟨0, rfl⟩
@[noinline] def produceFalseBool : Off := ⟨1, rfl⟩
@[noinline] def produceAb : Ab := ⟨"ab".length, rfl⟩
@[noinline] def produceEmptyString (count : Nat) : EmptyToken := ⟨count, rfl⟩
@[noinline] def produceUnicodeString (count : Nat) : UnicodeToken := ⟨count, rfl⟩
@[noinline] def produceEmptySized : EmptySized := ⟨#[], rfl⟩
@[noinline] def produceZeroNat (count : Nat) : ZeroToken := ⟨count, rfl⟩
@[noinline] def produceWideNat (count : Nat) : WideToken := ⟨count, rfl⟩

end CheckedRecordValueIndices
