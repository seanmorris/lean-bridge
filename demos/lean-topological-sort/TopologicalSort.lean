import TopologicalSortCore
import TopologicalSortTotal
import TopologicalSortChecks
import TopologicalSortCycleLemmas

/-!
The proof layer for the executable topological-sort component.
-/

namespace LeanTopologicalSort

/-- A constructive result for every well-formed finite graph. The proofs of
source removal, predecessor chasing, and the checker correspondences erase. -/
def guaranteedResult (count : Nat) (edges : Array Nat)
    (inputValid : edgesValid count edges = true) :
    { result : Result // ResultValid count edges result } :=
  match Total.solve (edgeExists edges) (List.range count) List.nodup_range with
  | .inl order => ⟨.order order.val.toArray,
      orderCheck_of_total count edges order.val inputValid order.property⟩
  | .inr cycle => ⟨.cycle cycle.val.toArray,
      cycleCheck_of_total count edges cycle.val cycle.property⟩

/-- Keep the optimized checked candidate when available. Otherwise the total
solver constructs a result with its correctness proof, without another check. -/
def solveCertified (count : Nat) (edges : Array Nat) :
    Option { result : Result // ResultValid count edges result } :=
  match solveFastCertified count edges with
  | some result => some result
  | none =>
      if inputValid : edgesValid count edges = true then
        some (guaranteedResult count edges inputValid)
      else none

def solve (count : Nat) (edges : Array Nat) : Option Result :=
  (solveCertified count edges).map Subtype.val

/-- Diagnostic entry point that exercises the guaranteed branch directly. -/
def solveTotal (count : Nat) (edges : Array Nat) : Option Result :=
  if inputValid : edgesValid count edges = true then
    some (guaranteedResult count edges inputValid).val
  else none

@[export lean_topological_sort_solve]
def solveGraph (count : UInt32) (edges : Array Nat) : Array Nat :=
  serialize (solve count.toNat edges)

@[export lean_topological_sort_total]
def solveTotalGraph (count : UInt32) (edges : Array Nat) : Array Nat :=
  serialize (solveTotal count.toNat edges)

theorem topologicalCheck_sound {count : Nat} {edges order : Array Nat}
    (checked : decide (IsTopologicalOrder count edges order) = true) :
    IsTopologicalOrder count edges order := by
  exact of_decide_eq_true checked

theorem cycleCheck_sound {count : Nat} {edges cycle : Array Nat}
    (checked : decide (DirectedCycle count edges cycle) = true) :
    DirectedCycle count edges cycle := by
  exact of_decide_eq_true checked

theorem topologicalOrder_covers {count : Nat} {edges order : Array Nat}
    (valid : IsTopologicalOrder count edges order) :
    permutationCheck count order = true := by
  exact valid.1

theorem topologicalOrder_respects_edges {count : Nat} {edges order : Array Nat}
    (valid : IsTopologicalOrder count edges order) : edgeOrderCheck count edges order = true := by
  exact valid.2

theorem directedCycle_nonempty {count : Nat} {edges cycle : Array Nat}
    (valid : DirectedCycle count edges cycle) : cycle.size > 0 := by
  exact valid.1

theorem directedCycle_edges_exist {count : Nat} {edges cycle : Array Nat}
    (valid : DirectedCycle count edges cycle) : cycleEdgeCheck edges cycle = true := by
  exact valid.2.2.2

theorem solve_result_correct {count : Nat} {edges : Array Nat} {result : Result}
    (computed : solve count edges = some result) :
    ResultValid count edges result := by
  unfold solve at computed
  cases found : solveCertified count edges with
  | none => simp_all
  | some certified =>
      have valid := certified.property
      simp_all

theorem solve_order_correct {count : Nat} {edges order : Array Nat}
    (result : solve count edges = some (.order order)) :
    IsTopologicalOrder count edges order := by
  exact solve_result_correct result

theorem solve_cycle_correct {count : Nat} {edges cycle : Array Nat}
    (result : solve count edges = some (.cycle cycle)) :
    DirectedCycle count edges cycle := by
  exact solve_result_correct result

/-- Every well-formed input returns a correct result, with no successful-return
or fuel hypothesis. -/
theorem solve_total (count : Nat) (edges : Array Nat)
    (inputValid : edgesValid count edges = true) :
    ∃ result, solve count edges = some result ∧ ResultValid count edges result := by
  cases found : solveFastCertified count edges with
  | none =>
      exact ⟨(guaranteedResult count edges inputValid).val,
        by simp [solve, solveCertified, found, inputValid],
        (guaranteedResult count edges inputValid).property⟩
  | some result =>
      exact ⟨result.val, by simp [solve, solveCertified, found], result.property⟩

theorem solveTotal_total (count : Nat) (edges : Array Nat)
    (inputValid : edgesValid count edges = true) :
    ∃ result, solveTotal count edges = some result ∧ ResultValid count edges result := by
  exact ⟨(guaranteedResult count edges inputValid).val,
    by simp [solveTotal, inputValid], (guaranteedResult count edges inputValid).property⟩

/-- The exact Wasm entry point serializes a valid ordering or cycle for every
well-formed input graph. -/
theorem solveGraph_total (count : UInt32) (edges : Array Nat)
    (inputValid : edgesValid count.toNat edges = true) :
    ∃ result, ResultValid count.toNat edges result ∧
      solveGraph count edges = serialize (some result) := by
  obtain ⟨result, computed, valid⟩ := solve_total count.toNat edges inputValid
  exact ⟨result, valid, by simp [solveGraph, computed]⟩

theorem solveGraph_no_failure (count : UInt32) (edges : Array Nat)
    (inputValid : edgesValid count.toNat edges = true) :
    (solveGraph count edges)[0]? = some 0 ∨ (solveGraph count edges)[0]? = some 1 := by
  obtain ⟨result, _, computed⟩ := solveGraph_total count edges inputValid
  rw [computed]
  cases result <;> simp [serialize, Array.getElem?_append]

end LeanTopologicalSort
