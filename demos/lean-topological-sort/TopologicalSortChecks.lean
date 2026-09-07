import TopologicalSortCore
import TopologicalSortTotal

/-! Semantic descriptions of the executable graph certificate checks. -/

namespace LeanTopologicalSort

/-- An edge is one complete endpoint pair in the flat input table. -/
def HasEdge (edges : Array Nat) (source target : Nat) : Prop :=
  ∃ pair < edges.size / 2,
    arrayGet edges (2 * pair) 0 = source ∧
    arrayGet edges (2 * pair + 1) 0 = target

theorem edgeExistsFrom_iff (edges : Array Nat) (source target fuel index : Nat) :
    edgeExistsFrom edges source target fuel index = true ↔
      ∃ offset < fuel, index + 2 * offset + 1 < edges.size ∧
        arrayGet edges (index + 2 * offset) 0 = source ∧
        arrayGet edges (index + 2 * offset + 1) 0 = target := by
  induction fuel generalizing index with
  | zero => simp [edgeExistsFrom]
  | succ fuel ih =>
      rw [edgeExistsFrom]
      by_cases bound : index + 1 < edges.size
      · simp only [bound, ↓reduceIte]
        simp only [Bool.and_eq_true, decide_eq_true_eq]
        constructor
        · intro found
          split at found
          next matched =>
            exact ⟨0, by omega, by simpa using bound, by simpa using matched⟩
          next unmatched =>
            rw [ih] at found
            obtain ⟨offset, below, bounded, first, second⟩ := found
            refine ⟨offset + 1, by omega, ?_, ?_, ?_⟩
            · omega
            · simpa [Nat.mul_add, Nat.add_assoc, Nat.add_comm, Nat.add_left_comm] using first
            · simpa [Nat.mul_add, Nat.add_assoc, Nat.add_comm, Nat.add_left_comm] using second
        · rintro ⟨offset, below, bounded, first, second⟩
          split
          next matched => rfl
          next unmatched =>
            rw [ih]
            have nonzero : offset ≠ 0 := by
              intro eq
              subst offset
              simp only [Nat.mul_zero, Nat.add_zero] at first second
              exact unmatched ⟨first, second⟩
            refine ⟨offset - 1, by omega, ?_, ?_, ?_⟩
            · omega
            · have eq : index + 2 + 2 * (offset - 1) = index + 2 * offset := by omega
              simpa [eq] using first
            · have eq : index + 2 + 2 * (offset - 1) = index + 2 * offset := by omega
              simpa [eq] using second
      · simp only [bound, ↓reduceIte, Bool.false_eq_true, false_iff, not_exists]
        rintro offset ⟨below, bounded, _⟩
        omega

theorem edgeExists_iff (edges : Array Nat) (source target : Nat) :
    edgeExists edges source target = true ↔ HasEdge edges source target := by
  rw [edgeExists, edgeExistsFrom_iff]
  simp only [Nat.zero_add, HasEdge]
  constructor
  · rintro ⟨pair, below, _, first, second⟩
    exact ⟨pair, below, first, second⟩
  · rintro ⟨pair, below, first, second⟩
    exact ⟨pair, below, by omega, first, second⟩

theorem cycleEdgeCheckFrom_iff (edges cycle : Array Nat) (fuel index : Nat) :
    cycleEdgeCheckFrom edges cycle fuel index = true ↔
      ∀ position, index ≤ position → position < index + fuel →
        HasEdge edges (arrayGet cycle position 0)
          (arrayGet cycle ((position + 1) % cycle.size) 0) := by
  induction fuel generalizing index with
  | zero =>
      simp only [cycleEdgeCheckFrom, true_iff, Nat.add_zero]
      intro position lower upper
      omega
  | succ fuel ih =>
      rw [cycleEdgeCheckFrom, Bool.and_eq_true, edgeExists_iff, ih]
      constructor
      · rintro ⟨first, rest⟩ position lower upper
        by_cases eq : position = index
        · simpa [eq] using first
        · exact rest position (by omega) (by omega)
      · intro all
        exact ⟨all index (by omega) (by omega),
          fun position lower upper => all position (by omega) (by omega)⟩

theorem cycleEdgeCheck_iff (edges cycle : Array Nat) :
    cycleEdgeCheck edges cycle = true ↔ cycle.size > 0 ∧
      ∀ position < cycle.size,
        HasEdge edges (arrayGet cycle position 0)
          (arrayGet cycle ((position + 1) % cycle.size) 0) := by
  simp only [cycleEdgeCheck, Array.isEmpty, decide_eq_true_eq]
  by_cases empty : cycle.size = 0
  · simp [empty]
  · simp [empty, cycleEdgeCheckFrom_iff, Nat.pos_of_ne_zero empty]

theorem arrayGet_set (values : Array α) (index query : Nat) (value fallback : α)
    (bound : query < values.size) :
    arrayGet (values.setIfInBounds index value) query fallback =
      if index = query then value else arrayGet values query fallback := by
  simp [arrayGet, Array.getD, bound, Array.getElem_setIfInBounds]

theorem orderUniqueFrom_iff (count : Nat) (order : Array Nat) (fuel index : Nat)
    (seen : Array Bool) (seenSize : seen.size = count) :
    orderUniqueFrom count order fuel index seen = true ↔
      (∀ position, index ≤ position → position < index + fuel →
        arrayGet order position count < count ∧
          arrayGet seen (arrayGet order position count) true = false) ∧
      (∀ first second, index ≤ first → first < second → second < index + fuel →
        arrayGet order first count ≠ arrayGet order second count) := by
  induction fuel generalizing index seen with
  | zero =>
      simp only [orderUniqueFrom, true_iff]
      constructor
      · intro position lower upper; omega
      · intro first second lower between upper; omega
  | succ fuel ih =>
      simp only [orderUniqueFrom, Bool.and_eq_true, decide_eq_true_eq, Bool.not_eq_true']
      rw [ih _ _ (by simpa using seenSize)]
      constructor
      · rintro ⟨⟨bounded, unseen⟩, all, distinct⟩
        constructor
        · intro position lower upper
          by_cases equal : position = index
          · simpa [equal] using And.intro bounded unseen
          · have info := all position (by omega) (by omega)
            rw [arrayGet_set _ _ _ _ _ (by omega)] at info
            split at info
            · simp_all
            · exact info
        · intro first second lower between upper
          by_cases equal : first = index
          · subst first
            have info := all second (by omega) (by omega)
            rw [arrayGet_set _ _ _ _ _ (by omega)] at info
            split at info
            · simp_all
            · assumption
          · exact distinct first second (by omega) between (by omega)
      · rintro ⟨all, distinct⟩
        refine ⟨all index (by omega) (by omega), ?_, ?_⟩
        · intro position lower upper
          have info := all position (by omega) (by omega)
          refine ⟨info.1, ?_⟩
          rw [arrayGet_set _ _ _ _ _ (by omega), if_neg]
          · exact info.2
          · exact distinct index position (by omega) (by omega) (by omega)
        · intro first second lower between upper
          exact distinct first second (by omega) between (by omega)

theorem permutationCheck_iff_indices (count : Nat) (order : Array Nat) :
    permutationCheck count order = true ↔ order.size = count ∧
      (∀ index < order.size, arrayGet order index count < count) ∧
      (∀ first second, first < second → second < order.size →
        arrayGet order first count ≠ arrayGet order second count) := by
  simp only [permutationCheck, Bool.and_eq_true, decide_eq_true_eq]
  rw [orderUniqueFrom_iff _ _ _ _ _ (by simp)]
  simp only [Nat.zero_le, Nat.zero_add, true_implies]
  constructor
  · rintro ⟨size, all, distinct⟩
    exact ⟨size, fun index below => (all index below).1, distinct⟩
  · rintro ⟨size, all, distinct⟩
    refine ⟨size, ?_, distinct⟩
    intro index below
    have bounded := all index below
    refine ⟨bounded, ?_⟩
    change (Array.replicate count false).getD (arrayGet order index count) true = false
    simp [Array.getD, bounded]

theorem perm_of_nodup_subset_length {xs ys : List Nat} (unique : xs.Nodup)
    (subset : xs ⊆ ys) (length : xs.length = ys.length) : xs.Perm ys := by
  induction xs generalizing ys with
  | nil =>
      have empty : ys = [] := by simpa using length.symm
      simp [empty]
  | cons x xs ih =>
      have parts := List.nodup_cons.mp unique
      have member : x ∈ ys := subset (by simp)
      have smaller : xs.Perm (ys.erase x) := by
        apply ih parts.2
        · intro value belongs
          rw [List.mem_erase_of_ne]
          · exact subset (by simp [belongs])
          · intro equal
            subst value
            exact parts.1 belongs
        · rw [List.length_erase_of_mem member]
          simp only [List.length_cons] at length
          omega
      exact (smaller.cons x).trans (List.perm_cons_erase member).symm

theorem permutationCheck_iff (count : Nat) (order : Array Nat) :
    permutationCheck count order = true ↔ order.toList.Perm (List.range count) := by
  rw [permutationCheck_iff_indices]
  constructor
  · rintro ⟨size, bounded, distinct⟩
    apply perm_of_nodup_subset_length
    · rw [List.nodup_iff_pairwise_ne, List.pairwise_iff_getElem]
      intro first second belowFirst belowSecond between
      have ne := distinct first second between (by simpa using belowSecond)
      simpa [arrayGet, Array.getD, show first < order.size by simpa using belowFirst,
        show second < order.size by simpa using belowSecond] using ne
    · intro value member
      rw [List.mem_range]
      obtain ⟨index, below, equal⟩ := List.mem_iff_getElem.mp member
      have bound := bounded index (by simpa using below)
      simpa [arrayGet, Array.getD, show index < order.size by simpa using below, ← equal] using bound
    · simpa using size
  · intro perm
    have unique := perm.symm.nodup List.nodup_range
    have nodup := (List.pairwise_iff_getElem.mp unique)
    refine ⟨by simpa using perm.length_eq, ?_, ?_⟩
    · intro index below
      have member : order[index] ∈ order.toList := by simp
      have bound := List.mem_range.mp (perm.subset member)
      simpa [arrayGet, Array.getD, below] using bound
    · intro first second between below
      have firstBelow : first < order.size := by omega
      have ne := nodup first second (by simpa using firstBelow) (by simpa using below) between
      simpa [arrayGet, Array.getD, firstBelow, below] using ne

theorem buildPositionsFrom_size (count : Nat) (order : Array Nat)
    (fuel index : Nat) (positions : Array Nat) :
    (buildPositionsFrom count order fuel index positions).size = positions.size := by
  induction fuel generalizing index positions with
  | zero => rfl
  | succ fuel ih => simp [buildPositionsFrom, ih]

theorem buildPositionsFrom_correct (count : Nat) (order : Array Nat)
    (fuel index : Nat) (positions : Array Nat) (size : positions.size = count)
    (bounded : ∀ position < index + fuel, arrayGet order position count < count)
    (distinct : ∀ first second, first < second → second < index + fuel →
      arrayGet order first count ≠ arrayGet order second count)
    (done : ∀ position < index,
      arrayGet positions (arrayGet order position count) count = position) :
    ∀ position < index + fuel,
      arrayGet (buildPositionsFrom count order fuel index positions)
        (arrayGet order position count) count = position := by
  induction fuel generalizing index positions with
  | zero => simpa [buildPositionsFrom] using done
  | succ fuel ih =>
      rw [buildPositionsFrom]
      have next := ih (index + 1)
        (positions.setIfInBounds (arrayGet order index count) index)
        (by simpa using size)
        (fun position below => bounded position (by omega))
        (fun first second between below => distinct first second between (by omega))
        (by
          intro position below
          rw [arrayGet_set _ _ _ _ _ (by have := bounded position (by omega); omega)]
          by_cases equal : position = index
          · simp [equal]
          · rw [if_neg]
            · exact done position (by omega)
            · exact Ne.symm (distinct position index (by omega) (by omega)))
      intro position below
      exact next position (by omega)

theorem idxOf_getElem_of_nodup (xs : List Nat) (unique : xs.Nodup)
    (index : Nat) (below : index < xs.length) : xs.idxOf xs[index] = index := by
  induction xs generalizing index with
  | nil => simp at below
  | cons x xs ih =>
      cases index with
      | zero => simp
      | succ index =>
          have tail := List.nodup_cons.mp unique
          have bounded : index < xs.length := by simpa using below
          have ne : x ≠ xs[index] := by
            intro eq
            have member : xs[index] ∈ xs := by simp
            exact tail.1 (eq ▸ member)
          simpa [List.idxOf_cons, cond_eq_ite, ne] using
            congrArg Nat.succ (ih tail.2 index bounded)

theorem buildPositions_lookup {count : Nat} {order : Array Nat}
    (permutation : order.toList.Perm (List.range count))
    {vertex : Nat} (member : vertex ∈ order.toList) :
    arrayGet (buildPositionsFrom count order order.size 0 (Array.replicate count count))
      vertex count = order.toList.idxOf vertex := by
  have checked := (permutationCheck_iff_indices count order).mp
    ((permutationCheck_iff count order).mpr permutation)
  have finished := buildPositionsFrom_correct count order order.size 0
    (Array.replicate count count) (by simp)
    (by simpa using checked.2.1) (by simpa using checked.2.2)
    (by intro position below; omega)
  obtain ⟨index, below, equal⟩ := List.mem_iff_getElem.mp member
  have bounded : index < order.size := by simpa using below
  have result := finished index (by simpa using bounded)
  have position := idxOf_getElem_of_nodup order.toList
    (permutation.symm.nodup List.nodup_range) index below
  have vertexPosition : order.toList.idxOf vertex = index := by simpa [equal] using position
  rw [vertexPosition]
  simpa [arrayGet, Array.getD, bounded, ← equal] using result

theorem edgeOrderCheckFrom_iff (edges positions : Array Nat) (fuel index : Nat) :
    edgeOrderCheckFrom edges positions fuel index = true ↔
      ∀ offset < fuel, index + 2 * offset + 1 < edges.size →
        arrayGet positions (arrayGet edges (index + 2 * offset) 0) positions.size <
          arrayGet positions (arrayGet edges (index + 2 * offset + 1) 0) positions.size := by
  induction fuel generalizing index with
  | zero => simp [edgeOrderCheckFrom]
  | succ fuel ih =>
      rw [edgeOrderCheckFrom]
      by_cases bound : index + 1 < edges.size
      · simp only [bound, ↓reduceIte, Bool.and_eq_true, decide_eq_true_eq, ih]
        constructor
        · rintro ⟨first, rest⟩ offset below bounded
          cases offset with
          | zero => simpa using first
          | succ offset =>
              have result := rest offset (by omega) (by omega)
              simpa [Nat.mul_add, Nat.add_assoc, Nat.add_comm, Nat.add_left_comm] using result
        · intro all
          refine ⟨by simpa using all 0 (by omega) (by simpa using bound), ?_⟩
          intro offset below bounded
          have result := all (offset + 1) (by omega) (by omega)
          simpa [Nat.mul_add, Nat.add_assoc, Nat.add_comm, Nat.add_left_comm] using result
      · simp only [bound, ↓reduceIte, true_iff]
        intro offset below bounded
        omega

theorem edgeOrderCheck_iff_positions (count : Nat) (edges order : Array Nat) :
    edgeOrderCheck count edges order = true ↔
      ∀ source target, HasEdge edges source target →
        arrayGet (buildPositionsFrom count order order.size 0 (Array.replicate count count)) source count <
        arrayGet (buildPositionsFrom count order order.size 0 (Array.replicate count count)) target count := by
  rw [edgeOrderCheck, edgeOrderCheckFrom_iff]
  simp only [Nat.zero_add, buildPositionsFrom_size, Array.size_replicate]
  constructor
  · intro all source target ⟨pair, below, first, second⟩
    simpa [first, second] using all pair below (by omega)
  · intro all pair below bounded
    exact all _ _ ⟨pair, below, rfl, rfl⟩

theorem edgesValid_endpoints {count : Nat} {edges : Array Nat}
    (valid : edgesValid count edges = true) {source target : Nat}
    (edge : HasEdge edges source target) : source < count ∧ target < count := by
  simp only [edgesValid, Bool.and_eq_true, decide_eq_true_eq] at valid
  have bounded := Array.all_eq_true'.mp valid.2
  obtain ⟨pair, below, first, second⟩ := edge
  have sourceBound : 2 * pair < edges.size := by omega
  have targetBound : 2 * pair + 1 < edges.size := by omega
  have sourceMem : arrayGet edges (2 * pair) 0 ∈ edges := by
    simp [arrayGet, Array.getD, sourceBound]
  have targetMem : arrayGet edges (2 * pair + 1) 0 ∈ edges := by
    simp [arrayGet, Array.getD, targetBound]
  constructor
  · simpa [first] using bounded _ sourceMem
  · simpa [second] using bounded _ targetMem

theorem orderCheck_of_total (count : Nat) (edges : Array Nat) (order : List Nat)
    (valid : edgesValid count edges = true)
    (ordered : Total.OrderValid (edgeExists edges) (List.range count) order) :
    IsTopologicalOrder count edges order.toArray := by
  constructor
  · exact (permutationCheck_iff _ _).mpr (by simpa using ordered.1)
  · rw [edgeOrderCheck_iff_positions]
    intro source target edge
    have bounds := edgesValid_endpoints valid edge
    have sourceRange : source ∈ List.range count := List.mem_range.mpr bounds.1
    have targetRange : target ∈ List.range count := List.mem_range.mpr bounds.2
    have sourceMem : source ∈ order.toArray.toList := by
      simpa using ordered.1.symm.subset sourceRange
    have targetMem : target ∈ order.toArray.toList := by
      simpa using ordered.1.symm.subset targetRange
    have perm : order.toArray.toList.Perm (List.range count) := by simpa using ordered.1
    rw [buildPositions_lookup perm sourceMem, buildPositions_lookup perm targetMem]
    simpa using ordered.2 source sourceRange target targetRange ((edgeExists_iff _ _ _).mpr edge)

theorem orderCheck_to_total (count : Nat) (edges order : Array Nat)
    (checked : IsTopologicalOrder count edges order) :
    Total.OrderValid (edgeExists edges) (List.range count) order.toList := by
  have permutation := (permutationCheck_iff count order).mp checked.1
  refine ⟨permutation, ?_⟩
  intro source sourceRange target targetRange edge
  have forward := (edgeOrderCheck_iff_positions count edges order).mp checked.2 source target
    ((edgeExists_iff edges source target).mp edge)
  rw [buildPositions_lookup permutation (permutation.symm.subset sourceRange),
    buildPositions_lookup permutation (permutation.symm.subset targetRange)] at forward
  exact forward

/-- Accepted orders contain every vertex exactly once, and every edge points
from an earlier position to a later position. -/
theorem topologicalOrder_iff_semantic (count : Nat) (edges order : Array Nat)
    (inputValid : edgesValid count edges = true) :
    IsTopologicalOrder count edges order ↔
      order.toList.Perm (List.range count) ∧
        ∀ source target, HasEdge edges source target →
          order.toList.idxOf source < order.toList.idxOf target := by
  constructor
  · intro checked
    have total := orderCheck_to_total count edges order checked
    refine ⟨total.1, ?_⟩
    intro source target edge
    have bounded := edgesValid_endpoints inputValid edge
    exact total.2 source (List.mem_range.mpr bounded.1) target
      (List.mem_range.mpr bounded.2) ((edgeExists_iff edges source target).mpr edge)
  · rintro ⟨permutation, ordered⟩
    have valid : Total.OrderValid (edgeExists edges) (List.range count) order.toList := by
      refine ⟨permutation, ?_⟩
      intro source _ target _ edge
      exact ordered source target ((edgeExists_iff edges source target).mp edge)
    simpa using orderCheck_of_total count edges order.toList inputValid valid

end LeanTopologicalSort
