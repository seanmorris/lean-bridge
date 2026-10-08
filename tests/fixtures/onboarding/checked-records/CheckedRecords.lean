namespace CheckedRecords

/-- A closed interval: the proof relates the two payload fields. -/
structure Interval where
  lo : Nat
  hi : Nat
  ordered : lo ≤ hi

/-- An array whose size is the value index. -/
structure Sized (n : Nat) where
  data : Array Nat
  sized : data.size = n

/-- Exactly three numbers. -/
abbrev Triple := Sized 3

/-- A value between two indices, with one proof for each bound. -/
structure Bounded (lo hi : Nat) where
  value : Nat
  above : lo ≤ value
  below : value < hi

/-- A percentage from 0 to 100. -/
abbrev Percent := Bounded 0 101

/-- Checked constructors: the only way a host payload becomes a checked record. -/
def mkInterval (lo hi : Nat) : Option Interval :=
  if h : lo ≤ hi then some ⟨lo, hi, h⟩ else none
def mkTriple (data : Array Nat) : Option Triple :=
  if h : data.size = 3 then some ⟨data, h⟩ else none
/-- A normalizing constructor: the payload is sorted before it is checked. -/
def sortedTriple (data : Array Nat) : Option Triple :=
  let sorted := data.qsort (· < ·)
  if h : sorted.size = 3 then some ⟨sorted, h⟩ else none
def mkPercent (value : Nat) : Option Percent :=
  if h : 0 ≤ value ∧ value < 101 then some ⟨value, h.1, h.2⟩ else none

/-- The width of a checked interval. -/
def width (value : Interval) : Nat := value.hi - value.lo

/-- Two checked arguments: the second is refused after the first passed. -/
def span (left right : Interval) : Nat := right.hi - left.lo

/-- The sum of exactly three numbers. -/
def total (value : Triple) : Nat := value.data.foldl (· + ·) 0

/-- The first number, as the caller ordered it. -/
def firstOf (value : Triple) : Nat := value.data[0]'(by rw [value.sized]; decide)

/-- The first number after the sorting constructor ran: normalization is visible only to Lean. -/
def smallest (value : Triple) : Nat := value.data[0]'(by rw [value.sized]; decide)

/-- An unchecked argument before a checked one, and a Lean-produced checked result. -/
def scale (factor : Nat) (value : Triple) : Triple := ⟨value.data.map (· * factor), by simp [value.sized]⟩

/-- A result-only checked record: Lean produces the proof. -/
def repeated (value : Nat) : Triple := ⟨#[value, value, value], rfl⟩

/-- The distance from a checked percentage to 100. -/
def complement (value : Percent) : Nat := 100 - value.value

end CheckedRecords
