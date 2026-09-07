import SweepProofs
import Init.Data.Array.Sort

namespace LeanSweep

@[inline] def entryLe (axis : Nat) (left right : Entry) : Bool :=
  decide (lowerAt axis left ≤ lowerAt axis right)

def sortEntries (axis : Nat) (entries : Array Entry) : Array Entry :=
  entries.mergeSort (entryLe axis)

theorem sortEntries_perm (axis : Nat) (entries : Array Entry) :
    (sortEntries axis entries).toList.Perm entries.toList := by
  simpa [sortEntries, Array.perm_iff_toList_perm] using
    (Array.mergeSort_perm (xs := entries) (le := entryLe axis))

theorem sortEntries_sorted (axis : Nat) (entries : Array Entry) :
    (sortEntries axis entries).toList.Pairwise
      (fun left right => lowerAt axis left ≤ lowerAt axis right) := by
  have trans (a b c : Entry) (ab : entryLe axis a b = true)
      (bc : entryLe axis b c = true) : entryLe axis a c = true := by
    simp only [entryLe, decide_eq_true_eq] at *
    omega
  have total (a b : Entry) : (entryLe axis a b || entryLe axis b a) = true := by
    simp only [entryLe, Bool.or_eq_true, decide_eq_true_eq]
    omega
  simpa [sortEntries, entryLe] using Array.pairwise_mergeSort trans total (xs := entries)

/-- An owned output array grows once for each projected candidate. -/
def emitPairs (current : Entry) (active : List Entry) (output : Array Pair) : Array Pair :=
  active.foldl (fun pairs old => pairs.push (pairOf current old)) output

theorem emitPairs_toList (current : Entry) (active : List Entry) (output : Array Pair) :
    (emitPairs current active output).toList =
      output.toList ++ active.map (pairOf current) := by
  induction active generalizing output with
  | nil => simp [emitPairs]
  | cons old rest ih =>
    simp [emitPairs, List.foldl_cons, List.map_cons] at *

/-- Sweep sorted starts, retain intervals whose closed right endpoint has
not expired, then append each active pair to the owned result array. -/
def sweepArray (axis : Nat) : List Entry → List Entry → Array Pair → Array Pair
  | [], _, output => output
  | current :: rest, active, output =>
    let live := keepActive axis current active
    sweepArray axis rest (current :: live) (emitPairs current live output)

theorem sweepArray_refines (axis : Nat) (remaining active : List Entry) (output : Array Pair) :
    (sweepArray axis remaining active output).toList =
      output.toList ++ sweepPairs axis remaining active := by
  induction remaining generalizing active output with
  | nil => simp [sweepArray, sweepPairs]
  | cons current rest ih =>
    simp only [sweepArray, sweepPairs]
    rw [ih, emitPairs_toList, List.append_assoc]

def candidatePairs (axis : Nat) (entries : Array Entry) : Array Pair :=
  sweepArray axis (sortEntries axis entries).toList [] #[]

theorem candidatePairs_refines (axis : Nat) (entries : Array Entry) :
    (candidatePairs axis entries).toList =
      sweepPairs axis (sortEntries axis entries).toList [] := by
  simp [candidatePairs, sweepArray_refines]

def parseEntries (bounds : Array Int) (dimensions : Nat) : Array Entry :=
  Array.ofFn (fun index : Fin (bounds.size / (2 * dimensions)) =>
    Entry.mk index.val
      (Box.mk
        (Array.ofFn (fun coordinate : Fin dimensions =>
          bounds[index.val * (2 * dimensions) + coordinate.val]?.getD 0))
        (Array.ofFn (fun coordinate : Fin dimensions =>
          bounds[index.val * (2 * dimensions) + dimensions + coordinate.val]?.getD 0))))

theorem parseEntries_size (bounds : Array Int) (dimensions : Nat) :
    (parseEntries bounds dimensions).size = bounds.size / (2 * dimensions) := by
  simp [parseEntries]

theorem parseEntries_id (bounds : Array Int) (dimensions index : Nat)
    (bound : index < (parseEntries bounds dimensions).size) :
    (parseEntries bounds dimensions)[index].id = index := by
  simp [parseEntries]

theorem parseEntries_lower (bounds : Array Int) (dimensions index coordinate : Nat)
    (indexBound : index < (parseEntries bounds dimensions).size)
    (coordinateBound : coordinate < dimensions) :
    lowerAt coordinate (parseEntries bounds dimensions)[index] =
      bounds[index * (2 * dimensions) + coordinate]?.getD 0 := by
  simp only [lowerAt, parseEntries, Array.getElem_ofFn]
  rw [Array.getElem?_eq_getElem (by simpa using coordinateBound)]
  simp

theorem parseEntries_upper (bounds : Array Int) (dimensions index coordinate : Nat)
    (indexBound : index < (parseEntries bounds dimensions).size)
    (coordinateBound : coordinate < dimensions) :
    upperAt coordinate (parseEntries bounds dimensions)[index] =
      bounds[index * (2 * dimensions) + dimensions + coordinate]?.getD 0 := by
  simp only [upperAt, parseEntries, Array.getElem_ofFn]
  rw [Array.getElem?_eq_getElem (by simpa using coordinateBound)]
  simp

theorem parseEntries_unique (bounds : Array Int) (dimensions : Nat) :
    UniqueIds (parseEntries bounds dimensions).toList := by
  unfold UniqueIds
  rw [List.nodup_iff_pairwise_ne, List.pairwise_map, List.pairwise_iff_getElem]
  intro left right leftBound rightBound ordered
  simp only [Array.getElem_toList]
  rw [parseEntries_id, parseEntries_id]
  omega

def boxCheck (dimensions : Nat) (entry : Entry) : Bool :=
  (List.range dimensions).all (fun axis => decide (lowerAt axis entry ≤ upperAt axis entry))

def inputCheck (bounds : Array Int) (dimensions axis : Nat) (entries : Array Entry) : Bool :=
  (dimensions == 2 || dimensions == 3) && axis < dimensions &&
  bounds.size % (2 * dimensions) == 0 && entries.size ≤ 1024 &&
  bounds.all (fun value => decide (-2147483648 ≤ value ∧ value ≤ 2147483647)) &&
  entries.all (boxCheck dimensions)

structure Prepared where
  bounds : Array Int
  dimensions : Nat
  axis : Nat
  entries : Array Entry
  parsed : entries = parseEntries bounds dimensions
  valid : inputCheck bounds dimensions axis entries = true

def prepare (bounds : Array Int) (dimensions axis : Nat) : Option Prepared :=
  let entries := parseEntries bounds dimensions
  if checked : inputCheck bounds dimensions axis entries = true then
    some ⟨bounds, dimensions, axis, entries, rfl, checked⟩
  else none

theorem prepare_exists_iff (bounds : Array Int) (dimensions axis : Nat) :
    (∃ prepared, prepare bounds dimensions axis = some prepared) ↔
      inputCheck bounds dimensions axis (parseEntries bounds dimensions) = true := by
  unfold prepare
  dsimp only
  split <;> simp_all

theorem prepared_unique (prepared : Prepared) : UniqueIds prepared.entries.toList := by
  rw [prepared.parsed]
  exact parseEntries_unique _ _

theorem prepared_axis (prepared : Prepared) : prepared.axis < prepared.dimensions := by
  have checked := prepared.valid
  simp only [inputCheck, Bool.and_eq_true, decide_eq_true_eq] at checked
  exact checked.1.1.1.1.2

theorem prepared_count (prepared : Prepared) : prepared.entries.size ≤ 1024 := by
  have checked := prepared.valid
  simp only [inputCheck, Bool.and_eq_true, decide_eq_true_eq] at checked
  exact checked.1.1.2

theorem prepared_dimensions (prepared : Prepared) :
    prepared.dimensions = 2 ∨ prepared.dimensions = 3 := by
  have checked := prepared.valid
  simp only [inputCheck, Bool.and_eq_true, Bool.or_eq_true, beq_iff_eq,
    decide_eq_true_eq] at checked
  exact checked.1.1.1.1.1

theorem prepared_valid_axis (prepared : Prepared) (axis : Nat)
    (axisBound : axis < prepared.dimensions) : AxisValid axis prepared.entries.toList := by
  have checked := prepared.valid
  simp only [inputCheck, Bool.and_eq_true] at checked
  have boxes := checked.2
  rw [Array.all_eq_true] at boxes
  intro entry member
  obtain ⟨index, bound, equal⟩ := Array.mem_iff_getElem.mp (by simpa using member)
  have box := boxes index bound
  simp only [boxCheck, List.all_eq_true, List.mem_range, decide_eq_true_eq] at box
  subst entry
  exact box axis axisBound

@[inline] def entryAt (entries : Array Entry) (index : Nat) : Entry := entries[index]?.getD default

theorem prepared_lookup (prepared : Prepared) (entry : Entry)
    (member : entry ∈ prepared.entries.toList) :
    entryAt prepared.entries entry.id = entry := by
  obtain ⟨index, bound, equal⟩ := Array.mem_iff_getElem.mp (by simpa using member)
  have identified : prepared.entries[index].id = index := by
    simp [prepared.parsed, parseEntries]
  subst entry
  simp [entryAt, identified, Array.getElem?_eq_getElem bound]

theorem prepared_member_id_bound (prepared : Prepared) (entry : Entry)
    (member : entry ∈ prepared.entries.toList) : entry.id < prepared.entries.size := by
  obtain ⟨index, bound, equal⟩ := Array.mem_iff_getElem.mp (by simpa using member)
  have identified : prepared.entries[index].id = index := by
    simp [prepared.parsed, parseEntries]
  subst entry
  omega

def overlapCheck : Nat → Entry → Entry → Bool
  | 0, _, _ => true
  | dimension + 1, left, right =>
    decide (overlapAxis dimension left right) && overlapCheck dimension left right

theorem overlapCheck_iff (dimensions : Nat) (left right : Entry) :
    overlapCheck dimensions left right = true ↔ Overlap dimensions left right := by
  induction dimensions with
  | zero => simp [overlapCheck, Overlap]
  | succ dimension ih =>
    simp only [overlapCheck, Bool.and_eq_true, decide_eq_true_eq, ih, Overlap]
    constructor
    · rintro ⟨last, earlier⟩ axis bound
      by_cases equal : axis = dimension
      · simpa [equal] using last
      · exact earlier axis (by omega)
    · intro all
      exact ⟨all dimension (by omega), fun axis bound => all axis (by omega)⟩

@[inline] def pairOverlapCheck (prepared : Prepared) (pair : Pair) : Bool :=
  overlapCheck prepared.dimensions
    (entryAt prepared.entries pair.1) (entryAt prepared.entries pair.2)

structure Result where
  candidates : Array Pair
  overlaps : Array Pair
  deriving Repr, DecidableEq

def solvePrepared (prepared : Prepared) : Result :=
  let candidates := candidatePairs prepared.axis prepared.entries
  ⟨candidates, candidates.filter (pairOverlapCheck prepared)⟩

theorem pairOverlapCheck_pairOf (prepared : Prepared) (left right : Entry)
    (leftMember : left ∈ prepared.entries.toList) (rightMember : right ∈ prepared.entries.toList) :
    pairOverlapCheck prepared (pairOf left right) = overlapCheck prepared.dimensions left right := by
  by_cases ordered : left.id ≤ right.id
  · simp [pairOverlapCheck, pairOf, Nat.min_eq_left ordered, Nat.max_eq_right ordered,
      prepared_lookup prepared left leftMember, prepared_lookup prepared right rightMember]
  · have reverse : right.id ≤ left.id := by omega
    simp only [pairOverlapCheck, pairOf, Nat.min_eq_right reverse, Nat.max_eq_left reverse,
      prepared_lookup prepared left leftMember, prepared_lookup prepared right rightMember]
    apply Bool.eq_iff_iff.mpr
    rw [overlapCheck_iff, overlapCheck_iff]
    exact overlap_comm _ _ _

/-- Both outputs grow in the same active-set pass. Testing the entries here
avoids a second traversal and two ID lookups per projected candidate. -/
def emitFused (dimensions : Nat) (current : Entry) : List Entry → Result → Result
  | [], output => output
  | old :: rest, output =>
    let pair := pairOf current old
    emitFused dimensions current rest
      ⟨output.candidates.push pair,
        if overlapCheck dimensions current old then output.overlaps.push pair else output.overlaps⟩

theorem emitFused_candidates (dimensions : Nat) (current : Entry) (active : List Entry)
    (output : Result) :
    (emitFused dimensions current active output).candidates = emitPairs current active output.candidates := by
  induction active generalizing output with
  | nil => rfl
  | cons old rest ih =>
    simp [emitFused, ih, emitPairs, List.foldl_cons]

theorem emitFused_filtered (prepared : Prepared) (current : Entry) (active : List Entry)
    (currentMember : current ∈ prepared.entries.toList)
    (activeMembers : ∀ entry ∈ active, entry ∈ prepared.entries.toList)
    (output : Result) (filtered : output.overlaps = output.candidates.filter (pairOverlapCheck prepared)) :
    (emitFused prepared.dimensions current active output).overlaps =
      (emitFused prepared.dimensions current active output).candidates.filter (pairOverlapCheck prepared) := by
  induction active generalizing output with
  | nil => exact filtered
  | cons old rest ih =>
    apply ih (fun entry member => activeMembers entry (by simp [member]))
    rw [Array.filter_push,
      pairOverlapCheck_pairOf prepared current old currentMember (activeMembers old (by simp))]
    simp [filtered]

def pruneEmit (dimensions axis : Nat) (current : Entry) :
    List Entry → List Entry → Result → List Entry × Result
  | [], reversed, output => (reversed.reverse, output)
  | old :: rest, reversed, output =>
    if lowerAt axis current ≤ upperAt axis old then
      let pair := pairOf current old
      let next : Result := ⟨output.candidates.push pair,
        if overlapCheck dimensions current old then output.overlaps.push pair else output.overlaps⟩
      pruneEmit dimensions axis current rest (old :: reversed) next
    else pruneEmit dimensions axis current rest reversed output

theorem pruneEmit_refines (dimensions axis : Nat) (current : Entry) (active reversed : List Entry)
    (output : Result) :
    pruneEmit dimensions axis current active reversed output =
      (reversed.reverse ++ keepActive axis current active,
        emitFused dimensions current (keepActive axis current active) output) := by
  induction active generalizing reversed output with
  | nil => simp [pruneEmit, keepActive, emitFused]
  | cons old rest ih =>
    by_cases live : lowerAt axis current ≤ upperAt axis old
    · simp [pruneEmit, live, ih, keepActive, emitFused, List.append_assoc]
    · simp [pruneEmit, live, ih, keepActive]

def sweepFused (dimensions axis : Nat) : List Entry → List Entry → Result → Result
  | [], _, output => output
  | current :: rest, active, output =>
    let live := keepActive axis current active
    sweepFused dimensions axis rest (current :: live) (emitFused dimensions current live output)

def sweepPruned (dimensions axis : Nat) : List Entry → List Entry → Result → Result
  | [], _, output => output
  | current :: rest, active, output =>
    let (live, emitted) := pruneEmit dimensions axis current active [] output
    sweepPruned dimensions axis rest (current :: live) emitted

theorem sweepPruned_refines (dimensions axis : Nat) (remaining active : List Entry) (output : Result) :
    sweepPruned dimensions axis remaining active output =
      sweepFused dimensions axis remaining active output := by
  induction remaining generalizing active output with
  | nil => rfl
  | cons current rest ih => simp [sweepPruned, pruneEmit_refines, ih, sweepFused]

@[csimp] theorem sweepFused_eq_sweepPruned : @sweepFused = @sweepPruned := by
  funext dimensions axis remaining active output
  exact (sweepPruned_refines dimensions axis remaining active output).symm

theorem sweepFused_candidates (dimensions axis : Nat) (remaining active : List Entry) (output : Result) :
    (sweepFused dimensions axis remaining active output).candidates =
      sweepArray axis remaining active output.candidates := by
  induction remaining generalizing active output with
  | nil => rfl
  | cons current rest ih => simp [sweepFused, sweepArray, ih, emitFused_candidates]

theorem sweepFused_filtered (prepared : Prepared) (remaining active : List Entry)
    (remainingMembers : ∀ entry ∈ remaining, entry ∈ prepared.entries.toList)
    (activeMembers : ∀ entry ∈ active, entry ∈ prepared.entries.toList)
    (output : Result) (filtered : output.overlaps = output.candidates.filter (pairOverlapCheck prepared)) :
    (sweepFused prepared.dimensions prepared.axis remaining active output).overlaps =
      (sweepFused prepared.dimensions prepared.axis remaining active output).candidates.filter
        (pairOverlapCheck prepared) := by
  induction remaining generalizing active output with
  | nil => exact filtered
  | cons current rest ih =>
    have currentMember := remainingMembers current (by simp)
    have liveMembers : ∀ entry ∈ keepActive prepared.axis current active,
        entry ∈ prepared.entries.toList := by
      intro entry member
      exact activeMembers entry (keepActive_subset _ _ _ _ member)
    apply ih (current :: keepActive prepared.axis current active)
      (fun entry member => remainingMembers entry (by simp [member]))
      (fun entry member => ?_)
      (emitFused prepared.dimensions current (keepActive prepared.axis current active) output)
      (emitFused_filtered prepared current _ currentMember liveMembers output filtered)
    rcases List.mem_cons.mp member with rfl | member
    · exact currentMember
    · exact liveMembers entry member

def solveFused (prepared : Prepared) : Result :=
  sweepFused prepared.dimensions prepared.axis
    (sortEntries prepared.axis prepared.entries).toList [] ⟨#[], #[]⟩

theorem solveFused_refines (prepared : Prepared) : solveFused prepared = solvePrepared prepared := by
  have candidates : (solveFused prepared).candidates = (solvePrepared prepared).candidates := by
    simp [solveFused, solvePrepared, candidatePairs, sweepFused_candidates]
  have filtered := sweepFused_filtered prepared
    (sortEntries prepared.axis prepared.entries).toList []
    (fun entry member => (sortEntries_perm _ _).mem_iff.mp member)
    (by simp) ⟨#[], #[]⟩ (by simp)
  have overlaps : (solveFused prepared).overlaps = (solvePrepared prepared).overlaps := by
    change (solveFused prepared).overlaps = (solvePrepared prepared).candidates.filter (pairOverlapCheck prepared)
    rw [← candidates]
    exact filtered
  have same (left right : Result) (hc : left.candidates = right.candidates)
      (ho : left.overlaps = right.overlaps) : left = right := by
    cases left; cases right; cases hc; cases ho; rfl
  exact same _ _ candidates overlaps

/-- Lean's compiler uses the fused loop only after checking this exact
function equality. All exported guarantees therefore apply to that loop. -/
@[csimp] theorem solvePrepared_eq_solveFused : @solvePrepared = @solveFused := by
  funext prepared
  exact (solveFused_refines prepared).symm

end LeanSweep
