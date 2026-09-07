import SweepCore
import SweepProofs

namespace LeanSweep

theorem sorted_prepared_valid (prepared : Prepared) :
    AxisValid prepared.axis (sortEntries prepared.axis prepared.entries).toList := by
  intro entry member
  exact prepared_valid_axis prepared prepared.axis (prepared_axis prepared) entry
    ((sortEntries_perm _ _).mem_iff.mp member)

theorem sorted_prepared_unique (prepared : Prepared) :
    UniqueIds (sortEntries prepared.axis prepared.entries).toList := by
  exact ((sortEntries_perm prepared.axis prepared.entries).map Entry.id).nodup_iff.mpr
    (prepared_unique prepared)

/-- Every projected overlap is emitted, and no separated projection is emitted. -/
theorem solve_candidates_exact (prepared : Prepared) (pair : Pair) :
    pair ∈ (solvePrepared prepared).candidates ↔
      AxisPair prepared.axis prepared.entries.toList pair := by
  rw [← Array.mem_toList_iff, solvePrepared, candidatePairs_refines]
  rw [sweepPairs_axis_exact prepared.axis _ (sorted_prepared_valid prepared)
    (sortEntries_sorted _ _) (sorted_prepared_unique prepared)]
  exact axisPair_perm _ _ _ (sortEntries_perm _ _) pair

theorem solve_candidates_unique (prepared : Prepared) :
    (solvePrepared prepared).candidates.toList.Nodup := by
  simp only [solvePrepared, candidatePairs_refines]
  exact sweepPairs_axis_nodup _ _ (sorted_prepared_valid prepared)
    (sortEntries_sorted _ _) (sorted_prepared_unique prepared)

theorem pairOverlapCheck_correct (prepared : Prepared) (left right : Entry)
    (leftMember : left ∈ prepared.entries.toList) (rightMember : right ∈ prepared.entries.toList) :
    pairOverlapCheck prepared (left.id, right.id) = true ↔ Overlap prepared.dimensions left right := by
  simp only [pairOverlapCheck, prepared_lookup prepared left leftMember,
    prepared_lookup prepared right rightMember, overlapCheck_iff]

/-- Exact closed-box intersection after all-axis filtering, for every
accepted input and either supported browser dimension. -/
theorem solve_overlaps_exact (prepared : Prepared) (pair : Pair) :
    pair ∈ (solvePrepared prepared).overlaps ↔
      BoxPair prepared.dimensions prepared.entries.toList pair := by
  change pair ∈ (solvePrepared prepared).candidates.filter (pairOverlapCheck prepared) ↔ _
  rw [Array.mem_filter, solve_candidates_exact]
  constructor
  · rintro ⟨⟨left, leftMember, right, rightMember, ordered, same, _⟩, checked⟩
    refine ⟨left, leftMember, right, rightMember, ordered, same, ?_⟩
    exact (pairOverlapCheck_correct prepared left right leftMember rightMember).mp
      (by simpa [same] using checked)
  · rintro ⟨left, leftMember, right, rightMember, ordered, same, overlap⟩
    refine ⟨⟨left, leftMember, right, rightMember, ordered, same,
      overlap prepared.axis (prepared_axis prepared)⟩, ?_⟩
    simpa [same] using (pairOverlapCheck_correct prepared left right leftMember rightMember).mpr overlap

theorem solve_overlaps_subset (prepared : Prepared) (pair : Pair)
    (member : pair ∈ (solvePrepared prepared).overlaps) :
    pair ∈ (solvePrepared prepared).candidates := (Array.mem_filter.mp member).1

theorem solve_overlaps_unique (prepared : Prepared) :
    (solvePrepared prepared).overlaps.toList.Nodup := by
  change ((solvePrepared prepared).candidates.filter (pairOverlapCheck prepared)).toList.Nodup
  rw [Array.toList_filter]
  exact (solve_candidates_unique prepared).filter _

theorem solve_pair_canonical_bounded (prepared : Prepared) (pair : Pair)
    (member : pair ∈ (solvePrepared prepared).candidates) :
    pair.1 < pair.2 ∧ pair.2 < prepared.entries.size := by
  obtain ⟨left, _, right, rightMember, ordered, same, _⟩ :=
    (solve_candidates_exact prepared pair).mp member
  rw [same]
  exact ⟨ordered, prepared_member_id_bound prepared right rightMember⟩

theorem solve_candidate_count_bounded (prepared : Prepared) :
    (solvePrepared prepared).candidates.size ≤ prepared.entries.size * prepared.entries.size := by
  have bound := sweepPairs_length_le prepared.axis
    (sortEntries prepared.axis prepared.entries).toList []
  change (candidatePairs prepared.axis prepared.entries).size ≤ _
  rw [← Array.length_toList, candidatePairs_refines]
  simpa [sortEntries] using bound

theorem solve_overlap_count_bounded (prepared : Prepared) :
    (solvePrepared prepared).overlaps.size ≤ (solvePrepared prepared).candidates.size := by
  exact Array.size_filter_le

theorem solve_candidate_count_choose (prepared : Prepared) :
    (solvePrepared prepared).candidates.size ≤
      prepared.entries.size * (prepared.entries.size - 1) / 2 := by
  have bound := sweepPairs_length_choose prepared.axis
    (sortEntries prepared.axis prepared.entries).toList
  change (candidatePairs prepared.axis prepared.entries).size ≤ _
  rw [← Array.length_toList, candidatePairs_refines]
  simpa [sortEntries] using bound

def getWord (words : Array Nat) (index : Nat) : Nat := words[index]?.getD 0

def flattenPairs (pairs : Array Pair) : Array Nat :=
  Array.ofFn (fun index : Fin (2 * pairs.size) =>
    let pair := pairs[index.val / 2]'(by omega)
    if index.val % 2 = 0 then pair.1 else pair.2)

theorem flattenPairs_size (pairs : Array Pair) : (flattenPairs pairs).size = 2 * pairs.size := by
  simp [flattenPairs]

theorem flattenPairs_first (pairs : Array Pair) (index : Nat) (bound : index < pairs.size) :
    getWord (flattenPairs pairs) (2 * index) = pairs[index].1 := by
  have inside : 2 * index < (flattenPairs pairs).size := by rw [flattenPairs_size]; omega
  unfold getWord
  rw [Array.getElem?_eq_getElem inside]
  simp [flattenPairs]

theorem flattenPairs_second (pairs : Array Pair) (index : Nat) (bound : index < pairs.size) :
    getWord (flattenPairs pairs) (2 * index + 1) = pairs[index].2 := by
  have inside : 2 * index + 1 < (flattenPairs pairs).size := by rw [flattenPairs_size]; omega
  unfold getWord
  rw [Array.getElem?_eq_getElem inside]
  have half : (2 * index + 1) / 2 = index := by omega
  simp [flattenPairs, Nat.add_mod, half]

/-- Header: status, box count, dimensions, axis, candidate count, overlap
count. Canonical candidate ID pairs precede the exact overlap ID pairs. -/
def serialize (prepared : Prepared) (result : Result) : Array Nat :=
  #[0, prepared.entries.size, prepared.dimensions, prepared.axis,
    result.candidates.size, result.overlaps.size] ++ flattenPairs result.candidates ++
    flattenPairs result.overlaps

@[export lean_sweep_prepare]
def prepareExport (bounds : Array Int) (dimensions axis : Nat) : Option Prepared :=
  prepare bounds dimensions axis

@[export lean_sweep_solve]
def solveExport (prepared : Prepared) : Array Nat := serialize prepared (solvePrepared prepared)

theorem serialize_size (prepared : Prepared) (result : Result) :
    (serialize prepared result).size = 6 + 2 * result.candidates.size + 2 * result.overlaps.size := by
  simp [serialize, flattenPairs_size, Nat.add_assoc]

theorem serialize_candidate_count (prepared : Prepared) (result : Result) :
    getWord (serialize prepared result) 4 = result.candidates.size := by
  simp only [getWord, serialize]
  rw [Array.getElem?_append_left (by simp; omega), Array.getElem?_append_left (by simp)]
  rfl

theorem serialize_overlap_count (prepared : Prepared) (result : Result) :
    getWord (serialize prepared result) 5 = result.overlaps.size := by
  simp only [getWord, serialize]
  rw [Array.getElem?_append_left (by simp; omega), Array.getElem?_append_left (by simp)]
  rfl

theorem serialize_candidate_word (prepared : Prepared) (result : Result) (index : Nat)
    (bound : index < 2 * result.candidates.size) :
    getWord (serialize prepared result) (6 + index) = getWord (flattenPairs result.candidates) index := by
  simp only [getWord, serialize]
  rw [Array.getElem?_append_left (by simp [flattenPairs_size]; omega)]
  rw [Array.getElem?_append_right (by simp)]
  simp

theorem serialize_overlap_word (prepared : Prepared) (result : Result) (index : Nat) :
    getWord (serialize prepared result) (6 + 2 * result.candidates.size + index) =
      getWord (flattenPairs result.overlaps) index := by
  simp only [getWord, serialize]
  rw [Array.getElem?_append_right (by simp [flattenPairs_size])]
  simp [flattenPairs_size]

def decodePairs (words : Array Nat) (offset count : Nat) : Array Pair :=
  Array.ofFn (fun index : Fin count =>
    (getWord words (offset + 2 * index.val), getWord words (offset + 2 * index.val + 1)))

def decodeResult (words : Array Nat) : Result :=
  ⟨decodePairs words 6 (getWord words 4),
    decodePairs words (6 + 2 * getWord words 4) (getWord words 5)⟩

theorem decode_serialize (prepared : Prepared) (result : Result) :
    decodeResult (serialize prepared result) = result := by
  have candidates : (decodeResult (serialize prepared result)).candidates = result.candidates := by
    apply Array.ext
    · simp [decodeResult, decodePairs, serialize_candidate_count]
    · intro index _ bound
      simp only [decodeResult, decodePairs, Array.getElem_ofFn]
      rw [serialize_candidate_word prepared result (2 * index) (by omega)]
      rw [Nat.add_assoc, serialize_candidate_word prepared result (2 * index + 1) (by omega)]
      simp [flattenPairs_first _ _ bound, flattenPairs_second _ _ bound]
  have overlaps : (decodeResult (serialize prepared result)).overlaps = result.overlaps := by
    apply Array.ext
    · simp [decodeResult, decodePairs, serialize_overlap_count]
    · intro index _ bound
      simp only [decodeResult, decodePairs, Array.getElem_ofFn, serialize_candidate_count]
      rw [serialize_overlap_word, Nat.add_assoc, serialize_overlap_word]
      simp [flattenPairs_first _ _ bound, flattenPairs_second _ _ bound]
  have same (left right : Result) (hc : left.candidates = right.candidates)
      (ho : left.overlaps = right.overlaps) : left = right := by
    cases left; cases right; cases hc; cases ho; rfl
  exact same _ _ candidates overlaps

/-- The candidate words crossing the FFI are exactly the projected overlaps. -/
theorem exported_candidates_exact (prepared : Prepared) (pair : Pair) :
    pair ∈ (decodeResult (solveExport prepared)).candidates ↔
      AxisPair prepared.axis prepared.entries.toList pair := by
  rw [solveExport, decode_serialize]
  exact solve_candidates_exact prepared pair

/-- The final pair words crossing the FFI are exactly the intersecting boxes. -/
theorem exported_overlaps_exact (prepared : Prepared) (pair : Pair) :
    pair ∈ (decodeResult (solveExport prepared)).overlaps ↔
      BoxPair prepared.dimensions prepared.entries.toList pair := by
  rw [solveExport, decode_serialize]
  exact solve_overlaps_exact prepared pair

theorem exported_candidates_unique (prepared : Prepared) :
    (decodeResult (solveExport prepared)).candidates.toList.Nodup := by
  rw [solveExport, decode_serialize]
  exact solve_candidates_unique prepared

theorem exported_overlaps_unique (prepared : Prepared) :
    (decodeResult (solveExport prepared)).overlaps.toList.Nodup := by
  rw [solveExport, decode_serialize]
  exact solve_overlaps_unique prepared

def Solves (prepared : Prepared) (result : Result) : Prop :=
  (∀ pair, pair ∈ result.candidates ↔ AxisPair prepared.axis prepared.entries.toList pair) ∧
  (∀ pair, pair ∈ result.overlaps ↔ BoxPair prepared.dimensions prepared.entries.toList pair) ∧
  result.candidates.toList.Nodup ∧ result.overlaps.toList.Nodup

/-- The compiled export returns every projected pair and every exact box
intersection, with no extra or duplicate pairs. -/
theorem solve_total (prepared : Prepared) : Solves prepared (decodeResult (solveExport prepared)) :=
  ⟨exported_candidates_exact prepared, exported_overlaps_exact prepared,
    exported_candidates_unique prepared, exported_overlaps_unique prepared⟩

theorem flattenPairs_words_bounded (pairs : Array Pair) (limit : Nat)
    (bounded : ∀ pair ∈ pairs, pair.1 < limit ∧ pair.2 < limit) :
    ∀ word ∈ flattenPairs pairs, word < limit := by
  intro word member
  obtain ⟨index, equal⟩ := Array.mem_ofFn.mp member
  subst word
  have inside : index.val / 2 < pairs.size := by have := index.isLt; omega
  have bounds := bounded pairs[index.val / 2] (Array.getElem_mem inside)
  dsimp
  split <;> omega

theorem solveExport_words_bounded (prepared : Prepared) :
    ∀ word ∈ solveExport prepared, word < 4294967296 := by
  have count := prepared_count prepared
  have dimensions := prepared_dimensions prepared
  have axis := prepared_axis prepared
  have candidateCount := solve_candidate_count_bounded prepared
  have overlapCount := solve_overlap_count_bounded prepared
  have quadratic : prepared.entries.size * prepared.entries.size ≤ 1048576 := by
    exact Nat.mul_le_mul count count
  have pairsBound : ∀ pair ∈ (solvePrepared prepared).candidates,
      pair.1 < 4294967296 ∧ pair.2 < 4294967296 := by
    intro pair member
    have bounded := solve_pair_canonical_bounded prepared pair member
    omega
  intro word member
  simp only [solveExport, serialize, Array.mem_append] at member
  rcases member with (header | candidate) | overlap
  · simp only [List.mem_toArray, List.mem_cons, List.not_mem_nil, or_false] at header
    rcases header with status | boxes | dims | chosen | candidates | overlaps <;> omega
  · exact flattenPairs_words_bounded _ _ pairsBound word candidate
  · exact flattenPairs_words_bounded _ _
      (fun pair member => pairsBound pair (solve_overlaps_subset prepared pair member)) word overlap

theorem solveExport_capacity_bounded (prepared : Prepared) :
    (solveExport prepared).size ≤
      6 + 4 * (prepared.entries.size * (prepared.entries.size - 1) / 2) := by
  have candidateCount := solve_candidate_count_choose prepared
  have overlapCount := solve_overlap_count_bounded prepared
  rw [solveExport, serialize_size]
  omega

theorem solveExport_size_bounded (prepared : Prepared) :
    (solveExport prepared).size ≤ 2095110 := by
  have count := prepared_count prepared
  have capacity := solveExport_capacity_bounded prepared
  have previous : prepared.entries.size - 1 ≤ 1023 := by omega
  have quadratic : prepared.entries.size * (prepared.entries.size - 1) ≤ 1047552 :=
    Nat.mul_le_mul count previous
  omega

end LeanSweep
