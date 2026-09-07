import DinicCore
import FlowCertificate
import FlowReference

namespace LeanDinic

structure CertifiedResult (network : Network) where
  solution : Solution
  phaseCount : Nat
  augmentationCount : Nat
  usedFallback : Bool
  correct : Solves network solution

def fallback (prepared : Prepared) : CertifiedResult prepared.network :=
  let valid := networkCheck_sound prepared.network prepared.valid
  ⟨referenceSolve prepared.network, 0, 0, true,
    referenceSolve_correct prepared.network valid⟩

/-- Every returned result has capacity, conservation, and global optimality
proofs. Dinic's candidate takes the linear certificate path. The total finite
reference is used if that candidate fails any certificate condition. -/
def solvePrepared (prepared : Prepared) : CertifiedResult prepared.network :=
  let state := dinicRaw prepared
  let proposed := solutionFrom prepared state
  if checked : certificateCheck prepared.network proposed = true then
    ⟨proposed, state.phases, state.augmentations, false,
      certificateCheck_sound prepared.network proposed
        (networkCheck_sound prepared.network prepared.valid) checked⟩
  else fallback prepared

def wordBase : Nat := 4294967296

def lowWord (value : Nat) : Nat := value % wordBase

def highWord (value : Nat) : Nat := value / wordBase

/-- Header: status, flow low/high, cut capacity low/high, vertex/edge counts,
phase count, augmentation low/high, fallback flag. Edge flows and cut flags
follow the eleven header words. The browser bounds sizes and input capacities
so all totals fit in two words without truncation. -/
def serialize (network : Network) (result : CertifiedResult network) : Array Nat :=
  let cutValue := cutCapacityFast network result.solution.cut
  #[0, lowWord result.solution.value, highWord result.solution.value,
    lowWord cutValue, highWord cutValue, network.vertexCount, network.edges.size,
    result.phaseCount, lowWord result.augmentationCount, highWord result.augmentationCount,
    if result.usedFallback then 1 else 0] ++ result.solution.flows ++
    result.solution.cut.map (fun member => if member then 1 else 0)

@[export lean_dinic_prepare]
def prepareExport (count source sink : Nat) (edges : Array Nat) : Option Prepared :=
  if edges.size % 3 = 0 then prepare ⟨count, source, sink, parseEdges edges⟩ else none

@[export lean_dinic_solve]
def solveExport (prepared : Prepared) : Array Nat :=
  serialize prepared.network (solvePrepared prepared)

@[export lean_dinic_solve_total]
def solveTotalExport (prepared : Prepared) : Array Nat :=
  serialize prepared.network (fallback prepared)

theorem solve_prepared_correct (prepared : Prepared) :
    Solves prepared.network (solvePrepared prepared).solution :=
  (solvePrepared prepared).correct

theorem solve_maximum_flow (prepared : Prepared) :
    MaximumFlow prepared.network (solvePrepared prepared).solution.flows
      (solvePrepared prepared).solution.value :=
  (solve_prepared_correct prepared).1

theorem solve_minimum_cut (prepared : Prepared) :
    MinimumCut prepared.network (solvePrepared prepared).solution.cut :=
  (solve_prepared_correct prepared).2

theorem solve_flow_cut_equal (prepared : Prepared) :
    (solvePrepared prepared).solution.value =
      cutCapacity prepared.network (solvePrepared prepared).solution.cut :=
  solves_flow_cut_equal prepared.network (solvePrepared prepared).solution
    (networkCheck_sound prepared.network prepared.valid) (solve_prepared_correct prepared)

theorem solve_prepared_certificate (prepared : Prepared) :
    certificateCheck prepared.network (solvePrepared prepared).solution = true := by
  apply (certificateCheck_iff _ _).mpr
  exact ⟨(solve_maximum_flow prepared).1, (solve_minimum_cut prepared).1, solve_flow_cut_equal prepared⟩

theorem solve_total (network : Network) (checked : networkCheck network = true) :
    ∃ prepared, prepare network = some prepared ∧ Solves network (solvePrepared prepared).solution := by
  exact ⟨⟨network, residualGraph network, checked⟩, by simp [prepare, checked],
    (solvePrepared ⟨network, residualGraph network, checked⟩).correct⟩

theorem word_roundtrip (value : Nat) : lowWord value + wordBase * highWord value = value := by
  exact Nat.mod_add_div value wordBase

theorem lowWord_bounded (value : Nat) : lowWord value < wordBase := by
  exact Nat.mod_lt value (by decide)

theorem serialize_size (network : Network) (result : CertifiedResult network) :
    (serialize network result).size = 11 + network.edges.size + network.vertexCount := by
  have flowSize := result.correct.1.1.1
  have cutSize := result.correct.2.1.1
  simp [serialize, flowSize, cutSize, Nat.add_assoc]

theorem solveExport_no_failure (prepared : Prepared) :
    (solveExport prepared).size = 11 + prepared.network.edges.size + prepared.network.vertexCount :=
  serialize_size prepared.network (solvePrepared prepared)

def decodeSolution (network : Network) (words : Array Nat) : Solution :=
  ⟨Array.ofFn (fun edge : Fin network.edges.size => get words (11 + edge.val) 0),
    Array.ofFn (fun vertex : Fin network.vertexCount =>
      get words (11 + network.edges.size + vertex.val) 0 != 0),
    get words 1 0 + wordBase * get words 2 0⟩

theorem serialize_flow (network : Network) (result : CertifiedResult network)
    (edge : Nat) (bound : edge < network.edges.size) :
    (serialize network result)[11 + edge]? = result.solution.flows[edge]? := by
  have flowSize := result.correct.1.1.1
  unfold serialize
  rw [Array.getElem?_append_left (by simp [flowSize]; omega)]
  rw [Array.getElem?_append_right (by simp)]
  simp

theorem serialize_cut (network : Network) (result : CertifiedResult network)
    (vertex : Nat) (bound : vertex < network.vertexCount) :
    (serialize network result)[11 + network.edges.size + vertex]? =
      some (if cutAt result.solution.cut vertex then 1 else 0) := by
  have flowSize := result.correct.1.1.1
  have cutSize := result.correct.2.1.1
  unfold serialize
  rw [Array.getElem?_append_right (by simp [flowSize])]
  have inside : vertex < result.solution.cut.size := by omega
  simp [flowSize, cutAt, Array.getElem?_eq_getElem inside]

theorem serialize_value (network : Network) (result : CertifiedResult network) :
    get (serialize network result) 1 0 + wordBase * get (serialize network result) 2 0 =
      result.solution.value := by
  simp only [get, Array.getD_eq_getD_getElem?]
  unfold serialize
  rw [Array.getElem?_append_left (by simp; omega),
    Array.getElem?_append_left (by simp), Array.getElem?_append_left (by simp; omega),
    Array.getElem?_append_left (by simp)]
  exact word_roundtrip result.solution.value

theorem decode_serialize (network : Network) (result : CertifiedResult network) :
    decodeSolution network (serialize network result) = result.solution := by
  have flows : (decodeSolution network (serialize network result)).flows = result.solution.flows := by
    apply Array.ext
    · simp [decodeSolution, result.correct.1.1.1]
    · intro index left right
      have bound : index < network.edges.size := by simpa [decodeSolution] using left
      simp [decodeSolution, get, Array.getD_eq_getD_getElem?, serialize_flow network result index bound,
        Array.getElem?_eq_getElem right]
  have cut : (decodeSolution network (serialize network result)).cut = result.solution.cut := by
    apply Array.ext
    · simp [decodeSolution, result.correct.2.1.1]
    · intro index left right
      have bound : index < network.vertexCount := by simpa [decodeSolution] using left
      simp only [decodeSolution, Array.getElem_ofFn, get, Array.getD_eq_getD_getElem?,
        serialize_cut network result index bound, Option.getD_some]
      simp only [cutAt, Array.getElem?_eq_getElem right, Option.getD_some]
      cases result.solution.cut[index] <;> rfl
  have value := serialize_value network result
  have same (left right : Solution) (hf : left.flows = right.flows)
      (hc : left.cut = right.cut) (hv : left.value = right.value) : left = right := by
    cases left; cases right; cases hf; cases hc; cases hv; rfl
  exact same _ _ flows cut value

/-- The arrays and split-word value actually returned through the FFI encode
a maximum feasible flow and a minimum source/sink cut, with no search premise. -/
theorem exported_optimal (prepared : Prepared) :
    Solves prepared.network (decodeSolution prepared.network (solveExport prepared)) := by
  rw [solveExport, decode_serialize]
  exact solve_prepared_correct prepared

theorem exported_total_optimal (prepared : Prepared) :
    Solves prepared.network (decodeSolution prepared.network (solveTotalExport prepared)) := by
  rw [solveTotalExport, decode_serialize]
  exact (fallback prepared).correct

theorem exported_flow_cut_equal (prepared : Prepared) :
    (decodeSolution prepared.network (solveExport prepared)).value =
      cutCapacity prepared.network (decodeSolution prepared.network (solveExport prepared)).cut := by
  rw [solveExport, decode_serialize]
  exact solve_flow_cut_equal prepared

theorem exported_certificate (prepared : Prepared) :
    certificateCheck prepared.network (decodeSolution prepared.network (solveExport prepared)) = true := by
  rw [solveExport, decode_serialize]
  exact solve_prepared_certificate prepared

theorem highWord_bounded (value : Nat) (bound : value < wordBase * wordBase) :
    highWord value < wordBase := by
  unfold highWord
  exact (Nat.div_lt_iff_lt_mul (by decide : 0 < wordBase)).mpr bound

theorem serialize_words_bounded (network : Network) (result : CertifiedResult network)
    (valid : network.Valid) (vertices : network.vertexCount ≤ 65536)
    (edges : network.edges.size ≤ 1000000)
    (capacities : ∀ index, index < network.edges.size → (network.edges[index]!).capacity < wordBase)
    (phases : result.phaseCount < wordBase)
    (augmentations : result.augmentationCount < wordBase * wordBase) :
    ∀ word ∈ serialize network result, word < wordBase := by
  have capBound := totalCapacity_uniform_bound network (wordBase - 1) (by
    intro index bound
    have capacity := capacities index bound
    omega)
  have sizeBound : network.edges.size * (wordBase - 1) ≤ 1000000 * (wordBase - 1) :=
    Nat.mul_le_mul_right _ edges
  have totalBound : totalCapacity network < wordBase * wordBase := by
    unfold wordBase at capBound sizeBound ⊢
    omega
  have flowBound : result.solution.value < wordBase * wordBase :=
    Nat.lt_of_le_of_lt (feasible_value_bounded network result.solution.flows result.solution.value valid result.correct.1.1) totalBound
  have cutBound : cutCapacityFast network result.solution.cut < wordBase * wordBase := by
    rw [cutCapacityFast_eq]
    exact Nat.lt_of_le_of_lt (cutCapacity_bounded network result.solution.cut) totalBound
  intro word member
  simp only [serialize, Array.mem_append] at member
  rcases member with (header | flow) | cut
  · simp only [List.mem_toArray, List.mem_cons, List.not_mem_nil, or_false] at header
    rcases header with zero | flowLow | flowHigh | cutLow | cutHigh | count | edgeCount | phase | augLow | augHigh | flag
    · subst word; decide
    · subst word; exact lowWord_bounded _
    · subst word; exact highWord_bounded _ flowBound
    · subst word; exact lowWord_bounded _
    · subst word; exact highWord_bounded _ cutBound
    · subst word; unfold wordBase; omega
    · subst word; unfold wordBase; omega
    · subst word; exact phases
    · subst word; exact lowWord_bounded _
    · subst word; exact highWord_bounded _ augmentations
    · subst word; split <;> decide
  · obtain ⟨index, bound, same⟩ := Array.mem_iff_getElem.mp flow
    have networkBound : index < network.edges.size := by rw [← result.correct.1.1.1]; exact bound
    have cap := result.correct.1.1.2.1 index networkBound
    have size := capacities index networkBound
    simp only [flowAt, Array.getElem?_eq_getElem bound, Option.getD_some, same] at cap
    omega
  · obtain ⟨flag, _, same⟩ := Array.mem_map.mp cut
    cases flag <;> simp only [Bool.false_eq_true, ↓reduceIte] at same <;> subst word <;> decide

theorem solvePrepared_phase_bound (prepared : Prepared) :
    (solvePrepared prepared).phaseCount ≤ prepared.network.vertexCount := by
  unfold solvePrepared
  dsimp only
  split
  · exact dinicRaw_phase_bound prepared
  · simp [fallback]

theorem solvePrepared_augmentation_bound (prepared : Prepared) :
    (solvePrepared prepared).augmentationCount ≤
      prepared.network.vertexCount * (prepared.residual.arcs.size + 1) := by
  unfold solvePrepared
  dsimp only
  split
  · exact dinicRaw_augmentation_bound prepared
  · simp [fallback]

theorem solveExport_words_bounded (prepared : Prepared)
    (vertices : prepared.network.vertexCount ≤ 65536)
    (edges : prepared.network.edges.size ≤ 1000000)
    (capacities : ∀ index, index < prepared.network.edges.size →
      (prepared.network.edges[index]!).capacity < wordBase)
    (arcs : prepared.residual.arcs.size = 2 * prepared.network.edges.size) :
    ∀ word ∈ solveExport prepared, word < wordBase := by
  apply serialize_words_bounded _ _ (networkCheck_sound prepared.network prepared.valid) vertices edges capacities
  · have bound := solvePrepared_phase_bound prepared
    unfold wordBase
    omega
  · have bound := solvePrepared_augmentation_bound prepared
    rw [arcs] at bound
    have countBound : 2 * prepared.network.edges.size + 1 ≤ 2 * 1000000 + 1 := by omega
    have large := Nat.mul_le_mul vertices countBound
    unfold wordBase
    omega

theorem solveTotalExport_words_bounded (prepared : Prepared)
    (vertices : prepared.network.vertexCount ≤ 65536)
    (edges : prepared.network.edges.size ≤ 1000000)
    (capacities : ∀ index, index < prepared.network.edges.size →
      (prepared.network.edges[index]!).capacity < wordBase) :
    ∀ word ∈ solveTotalExport prepared, word < wordBase := by
  apply serialize_words_bounded _ _ (networkCheck_sound prepared.network prepared.valid) vertices edges capacities
  · simp [fallback, wordBase]
  · simp [fallback, wordBase]

theorem prepare_residual_shape (network : Network) (prepared : Prepared)
    (created : prepare network = some prepared) :
    prepared.residual.arcs.size = 2 * prepared.network.edges.size := by
  unfold prepare at created
  split at created
  · cases created
    exact residualGraph_arcs_size network
  · simp at created

end LeanDinic
