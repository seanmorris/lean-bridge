import Init

/-! Sweep-and-prune over closed intervals. A box has an arbitrary number of
integer coordinates. Touching boundaries and zero-width intervals overlap. -/

namespace LeanSweep

structure Box where
  lower : Array Int
  upper : Array Int
  deriving Inhabited, Repr, DecidableEq

structure Entry where
  id : Nat
  box : Box
  deriving Inhabited, Repr, DecidableEq

abbrev Pair := Nat × Nat

@[inline] def pairOf (left right : Entry) : Pair :=
  (min left.id right.id, max left.id right.id)

@[inline] def lowerAt (axis : Nat) (entry : Entry) : Int :=
  entry.box.lower[axis]?.getD 0

@[inline] def upperAt (axis : Nat) (entry : Entry) : Int :=
  entry.box.upper[axis]?.getD 0

def overlapAxis (axis : Nat) (left right : Entry) : Prop :=
  lowerAt axis left ≤ upperAt axis right ∧ lowerAt axis right ≤ upperAt axis left

instance (axis : Nat) (left right : Entry) : Decidable (overlapAxis axis left right) :=
  inferInstanceAs (Decidable (_ ∧ _))

def Overlap (dimensions : Nat) (left right : Entry) : Prop :=
  ∀ axis, axis < dimensions → overlapAxis axis left right

def ValidBox (dimensions : Nat) (box : Box) : Prop :=
  box.lower.size = dimensions ∧ box.upper.size = dimensions ∧
    ∀ axis, axis < dimensions → box.lower[axis]?.getD 0 ≤ box.upper[axis]?.getD 0

def AxisValid (axis : Nat) (entries : List Entry) : Prop :=
  ∀ entry ∈ entries, lowerAt axis entry ≤ upperAt axis entry

def StartSorted (axis : Nat) (entries : List Entry) : Prop :=
  entries.Pairwise (fun left right => lowerAt axis left ≤ lowerAt axis right)

def Before (axis : Nat) (active remaining : List Entry) : Prop :=
  ∀ old ∈ active, ∀ next ∈ remaining, lowerAt axis old ≤ lowerAt axis next

def UniqueIds (entries : List Entry) : Prop :=
  (entries.map Entry.id).Nodup

/-- At the current sweep coordinate, the active set contains exactly the
processed intervals whose closed right endpoints have not expired. -/
def ActiveInvariant (axis : Nat) (current : Entry) (processed active : List Entry) : Prop :=
  ∀ entry, entry ∈ active ↔ entry ∈ processed ∧ lowerAt axis current ≤ upperAt axis entry

def keepActive (axis : Nat) (current : Entry) (active : List Entry) : List Entry :=
  active.filter (fun old => decide (lowerAt axis current ≤ upperAt axis old))

/-- The semantic sweep uses the same active-set pruning and emission order as
the compiled array-accumulating implementation. -/
def sweepPairs (axis : Nat) : List Entry → List Entry → List Pair
  | [], _ => []
  | current :: rest, active =>
      let live := keepActive axis current active
      live.map (pairOf current) ++ sweepPairs axis rest (current :: live)

/-- Pairs still to emit: at least one endpoint remains unprocessed. -/
def PendingPair (axis : Nat) (active remaining : List Entry) (pair : Pair) : Prop :=
  ∃ current ∈ remaining, ∃ other ∈ active ++ remaining,
    current.id ≠ other.id ∧ pair = pairOf current other ∧ overlapAxis axis current other

def AxisPair (axis : Nat) (entries : List Entry) (pair : Pair) : Prop :=
  ∃ left ∈ entries, ∃ right ∈ entries,
    left.id < right.id ∧ pair = (left.id, right.id) ∧ overlapAxis axis left right

def BoxPair (dimensions : Nat) (entries : List Entry) (pair : Pair) : Prop :=
  ∃ left ∈ entries, ∃ right ∈ entries,
    left.id < right.id ∧ pair = (left.id, right.id) ∧ Overlap dimensions left right

end LeanSweep
