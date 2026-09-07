import TarjanReachability

/-!
Cached Boolean Floyd–Warshall reference, followed by canonical component labels.
Each matrix stage performs count² constant-time lookups, for O(count³) time.
-/

namespace LeanTarjan

abbrev ReachMatrix (count : Nat) := Vector (Vector Bool count) count

def matrixAt {count : Nat} (matrix : ReachMatrix count) (source target : Nat) : Bool :=
  if sourceBound : source < count then
    if targetBound : target < count then matrix[source][target] else false
  else false

def initialMatrix (count : Nat) (edge : Nat → Nat → Bool) : ReachMatrix count :=
  Vector.ofFn fun source => Vector.ofFn fun target =>
    source.val == target.val || edge source.val target.val

def matrixStep {count : Nat} (matrix : ReachMatrix count) (pivot : Fin count) : ReachMatrix count :=
  Vector.ofFn fun source => Vector.ofFn fun target =>
    matrix[source.val][target.val] || (matrix[source.val][pivot.val] && matrix[pivot.val][target.val])

def closureStages (count : Nat) (edge : Nat → Nat → Bool) :
    (allowed : List Nat) → (∀ vertex ∈ allowed, vertex < count) → ReachMatrix count
  | [], _ => initialMatrix count edge
  | pivot :: rest, bounded =>
      let matrix := closureStages count edge rest (fun vertex mem => bounded vertex (by simp [mem]))
      matrixStep matrix ⟨pivot, bounded pivot (by simp)⟩

theorem closureStages_correct (count : Nat) (edge : Nat → Nat → Bool)
    (allowed : List Nat) (bounded : ∀ vertex ∈ allowed, vertex < count)
    (source target : Fin count) :
    (closureStages count edge allowed bounded)[source.val][target.val] = true ↔
      Via count edge allowed source.val target.val := by
  induction allowed generalizing source target with
  | nil =>
      simp [closureStages, initialMatrix, via_nil, Edge, source.isLt, target.isLt]
  | cons pivot rest ih =>
      simp only [closureStages, matrixStep, Vector.getElem_ofFn,
        Bool.or_eq_true, Bool.and_eq_true]
      rw [via_cons, ih _ source target,
        ih _ source ⟨pivot, bounded pivot (by simp)⟩,
        ih _ ⟨pivot, bounded pivot (by simp)⟩ target]

def transitiveClosure (count : Nat) (edge : Nat → Nat → Bool) : ReachMatrix count :=
  closureStages count edge (List.range count) (fun _ member => List.mem_range.mp member)

theorem transitiveClosure_correct (count : Nat) (edge : Nat → Nat → Bool)
    (source target : Nat) (sourceBound : source < count) (targetBound : target < count) :
    matrixAt (transitiveClosure count edge) source target = true ↔
      Reachable count edge source target := by
  simp only [matrixAt, sourceBound, targetBound, ↓reduceDIte, transitiveClosure]
  exact (closureStages_correct count edge _ _ ⟨source, sourceBound⟩ ⟨target, targetBound⟩).trans
    (via_range_iff count edge source target)

def mutualCheck {count : Nat} (matrix : ReachMatrix count) (source target : Nat) : Bool :=
  matrixAt matrix source target && matrixAt matrix target source

theorem mutualCheck_correct (count : Nat) (edge : Nat → Nat → Bool)
    (source target : Nat) (sourceBound : source < count) (targetBound : target < count) :
    mutualCheck (transitiveClosure count edge) source target = true ↔
      Mutual count edge source target := by
  simp only [mutualCheck, Bool.and_eq_true, Mutual,
    transitiveClosure_correct count edge source target sourceBound targetBound,
    transitiveClosure_correct count edge target source targetBound sourceBound]

def representative {count : Nat} (matrix : ReachMatrix count) (vertex : Nat) : Nat :=
  ((List.range count).find? (mutualCheck matrix vertex)).getD vertex

theorem find_congr (vertices : List Nat) (left right : Nat → Bool)
    (agree : ∀ vertex ∈ vertices, left vertex = right vertex) :
    vertices.find? left = vertices.find? right := by
  induction vertices with
  | nil => rfl
  | cons vertex rest ih =>
      simp only [List.find?_cons]
      rw [agree vertex (by simp), ih (fun next mem => agree next (by simp [mem]))]

theorem representative_found (count : Nat) (edge : Nat → Nat → Bool)
    (vertex : Nat) (bound : vertex < count) :
    ∃ root, (List.range count).find? (mutualCheck (transitiveClosure count edge) vertex) = some root ∧
      root < count ∧ Mutual count edge vertex root := by
  cases found : (List.range count).find? (mutualCheck (transitiveClosure count edge) vertex) with
  | none =>
      have absent := List.find?_eq_none.mp found vertex (List.mem_range.mpr bound)
      have present := (mutualCheck_correct count edge vertex vertex bound bound).mpr
        (mutual_refl count edge vertex bound)
      exact False.elim (absent present)
  | some root =>
      have rootBound := List.mem_range.mp (List.mem_of_find?_eq_some found)
      exact ⟨root, rfl, rootBound,
        (mutualCheck_correct count edge vertex root bound rootBound).mp (List.find?_some found)⟩

theorem representative_spec (count : Nat) (edge : Nat → Nat → Bool)
    (vertex : Nat) (bound : vertex < count) :
    representative (transitiveClosure count edge) vertex < count ∧
      Mutual count edge vertex (representative (transitiveClosure count edge) vertex) := by
  obtain ⟨root, found, rootBound, connected⟩ := representative_found count edge vertex bound
  simpa [representative, found] using And.intro rootBound connected

theorem representative_eq_iff (count : Nat) (edge : Nat → Nat → Bool)
    (source target : Nat) (sourceBound : source < count) (targetBound : target < count) :
    representative (transitiveClosure count edge) source =
      representative (transitiveClosure count edge) target ↔ Mutual count edge source target := by
  constructor
  · intro same
    have left := (representative_spec count edge source sourceBound).2
    have right := (representative_spec count edge target targetBound).2
    rw [same] at left
    exact mutual_trans left (mutual_symm right)
  · intro connected
    have checks : ∀ candidate ∈ List.range count,
        mutualCheck (transitiveClosure count edge) source candidate =
          mutualCheck (transitiveClosure count edge) target candidate := by
      intro candidate member
      have candidateBound := List.mem_range.mp member
      apply Bool.eq_iff_iff.mpr
      rw [mutualCheck_correct count edge source candidate sourceBound candidateBound,
        mutualCheck_correct count edge target candidate targetBound candidateBound]
      exact ⟨fun left => mutual_trans (mutual_symm connected) left,
        fun right => mutual_trans connected right⟩
    have sameFind :
        (List.range count).find? (mutualCheck (transitiveClosure count edge) source) =
          (List.range count).find? (mutualCheck (transitiveClosure count edge) target) := by
      exact find_congr _ _ _ checks
    obtain ⟨root, found, _, _⟩ := representative_found count edge source sourceBound
    simp [representative, ← sameFind, found]

def totalLabels (count : Nat) (edge : Nat → Nat → Bool) : Array Nat :=
  let matrix := transitiveClosure count edge
  Array.ofFn fun vertex : Fin count => representative matrix vertex.val

theorem totalLabels_correct (count : Nat) (edge : Nat → Nat → Bool) :
    PartitionSpec count edge (totalLabels count edge) := by
  have getLabel : ∀ vertex, vertex < count →
      labelAt (totalLabels count edge) vertex = representative (transitiveClosure count edge) vertex := by
    intro vertex bound
    simp [labelAt, totalLabels, Array.getD, bound]
  refine ⟨by simp [totalLabels], ?_, ?_, ?_⟩
  · intro vertex bound
    rw [getLabel vertex bound]
    exact (representative_spec count edge vertex bound).1
  · intro vertex bound
    have spec := representative_spec count edge vertex bound
    rw [getLabel vertex bound, getLabel _ spec.1]
    exact (representative_eq_iff count edge _ vertex spec.1 bound).mpr (mutual_symm spec.2)
  · intro source sourceBound target targetBound
    rw [getLabel source sourceBound, getLabel target targetBound]
    exact representative_eq_iff count edge source target sourceBound targetBound

end LeanTarjan
