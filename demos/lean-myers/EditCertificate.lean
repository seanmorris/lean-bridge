import MyersCore
import EditProofs
import ArrayScriptCheck

/-! A shortest script is certified by local inequalities on a truncated band
potential. The inequalities bound every possible edit path, including paths
which leave the stored band. The checker never visits the full edit grid when
the candidate edit distance is small. -/

namespace LeanMyers

def allBelow : Nat → (Nat → Bool) → Bool
  | 0, _ => true
  | count + 1, predicate => predicate count && allBelow count predicate

def localCheck (input : Input) (distance : Nat) (values : Array Nat) (row column : Nat) : Bool :=
  let current := bandValue input distance values row column
  (if row < input.left.size then bandValue input distance values (row + 1) column ≤ current + 1 else true) &&
    (if column < input.right.size then bandValue input distance values row (column + 1) ≤ current + 1 else true) &&
    (if row < input.left.size && column < input.right.size &&
        get input.left row 0 = get input.right column 0 then
      bandValue input distance values (row + 1) (column + 1) ≤ current else true)

def bandCheck (input : Input) (distance : Nat) (values : Array Nat) : Bool :=
  if distance = 0 then true
  else allBelow (input.left.size + 1) fun row =>
      allBelow (bandWidth input distance) fun slot =>
        let column := bandFirst distance row + slot
        if column ≤ input.right.size && inBand distance row column then
          localCheck input distance values row column else true

def certificateCheck (input : Input) (proposed : Candidate) : Bool :=
  let distance := proposed.solution.distance
  let values := proposed.potential
  arrayScriptCheck input proposed.solution &&
    values.size == (input.left.size + 1) * bandWidth input distance &&
    values.all (fun value => value ≤ distance) &&
    bandValue input distance values 0 0 == 0 &&
    bandValue input distance values input.left.size input.right.size == distance &&
    bandCheck input distance values

theorem allBelow_iff (count : Nat) (predicate : Nat → Bool) :
    allBelow count predicate = true ↔ ∀ index, index < count → predicate index = true := by
  induction count with
  | zero => simp [allBelow]
  | succ count ih =>
      simp only [allBelow, Bool.and_eq_true, ih]
      constructor
      · rintro ⟨last, rest⟩ index bound
        by_cases equal : index = count
        · simpa [equal] using last
        · exact rest index (by omega)
      · intro every
        exact ⟨every count (by omega), fun index bound => every index (by omega)⟩

theorem band_slot_bound (input : Input) (distance row column : Nat)
    (columnBound : column ≤ input.right.size) (inside : inBand distance row column) :
    column - bandFirst distance row < bandWidth input distance ∧
      bandFirst distance row + (column - bandFirst distance row) = column := by
  unfold inBand at inside
  unfold bandFirst bandWidth
  omega

theorem bandValue_bounded (input : Input) (distance : Nat) (values : Array Nat)
    (bounded : values.all (fun value => value ≤ distance) = true) (row column : Nat) :
    bandValue input distance values row column ≤ distance := by
  unfold bandValue
  split
  · unfold get Array.getD
    split
    next inside =>
      have item := Array.all_eq_true.mp bounded _ inside
      simpa using item
    · exact Nat.le_refl _
  · exact Nat.le_refl _

theorem bandCheck_inside (input : Input) (distance : Nat) (values : Array Nat)
    (checked : bandCheck input distance values = true) (row column : Nat)
    (rowBound : row ≤ input.left.size) (columnBound : column ≤ input.right.size)
    (inside : inBand distance row column) : localCheck input distance values row column = true := by
  have nonzero : distance ≠ 0 := by unfold inBand at inside; omega
  simp only [bandCheck, nonzero, ↓reduceIte] at checked
  have rows := (allBelow_iff _ _).mp checked row (by omega)
  obtain ⟨slotBound, same⟩ := band_slot_bound input distance row column columnBound inside
  have cell := (allBelow_iff _ _).mp rows (column - bandFirst distance row) slotBound
  simpa [same, columnBound, inside] using cell

theorem bandCheck_bounds (input : Input) (distance : Nat) (values : Array Nat)
    (bounded : values.all (fun value => value ≤ distance) = true)
    (checked : bandCheck input distance values = true) :
    PotentialBounds input.left.toList input.right.toList (bandValue input distance values) := by
  constructor
  · intro row column rowBound columnBound
    simp only [Array.length_toList] at rowBound columnBound
    by_cases inside : inBand distance row column
    · have cell := bandCheck_inside input distance values checked row column (by simpa using Nat.le_of_lt rowBound)
        (by simpa using columnBound) inside
      simp only [localCheck, Bool.and_eq_true] at cell
      simpa [rowBound] using cell.1.1
    · rw [bandValue_outside _ _ _ _ _ inside]
      exact Nat.le_trans (bandValue_bounded _ _ _ bounded _ _) (by omega)
  · intro row column rowBound columnBound
    simp only [Array.length_toList] at rowBound columnBound
    by_cases inside : inBand distance row column
    · have cell := bandCheck_inside input distance values checked row column (by simpa using rowBound)
        (by simpa using Nat.le_of_lt columnBound) inside
      simp only [localCheck, Bool.and_eq_true] at cell
      simpa [columnBound] using cell.1.2
    · rw [bandValue_outside _ _ _ _ _ inside]
      exact Nat.le_trans (bandValue_bounded _ _ _ bounded _ _) (by omega)
  · intro row column rowBound columnBound matching
    simp only [Array.length_toList] at rowBound columnBound
    by_cases inside : inBand distance row column
    · have cell := bandCheck_inside input distance values checked row column (by simpa using Nat.le_of_lt rowBound)
        (by simpa using Nat.le_of_lt columnBound) inside
      simp only [localCheck, Bool.and_eq_true] at cell
      have equal : get input.left row 0 = get input.right column 0 := by
        simpa [get, Array.getD, rowBound, columnBound] using matching
      simpa [rowBound, columnBound, equal] using cell.2
    · rw [bandValue_outside _ _ _ _ _ inside]
      exact bandValue_bounded _ _ _ bounded _ _

theorem certificateCheck_sound (input : Input) (proposed : Candidate)
    (checked : certificateCheck input proposed = true) : Solves input proposed.solution := by
  simp only [certificateCheck, arrayScriptCheck_equivalent, Bool.and_eq_true, beq_iff_eq] at checked
  have valid := inputScriptCheck_iff input proposed.solution.operations |>.mp checked.1.1.1.1.1.1
  have cost := checked.1.1.1.1.1.2
  have bounded := checked.1.1.1.2
  have initial := checked.1.1.2
  have final := checked.1.2
  have potential := bandCheck_bounds input proposed.solution.distance proposed.potential bounded checked.2
  refine ⟨?_, cost.symm⟩
  apply potential_certifies_optimal input.left.toList input.right.toList proposed.solution.operations.toList
    (bandValue input proposed.solution.distance proposed.potential) potential initial
  · simpa [cost] using final
  · exact valid

end LeanMyers
