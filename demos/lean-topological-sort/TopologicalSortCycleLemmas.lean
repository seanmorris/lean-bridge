import TopologicalSortChecks
import TopologicalSortTotal

namespace LeanTopologicalSort

theorem walk_adjacent (edge : Nat → Nat → Bool) (path : List Nat)
    (walk : Total.Walk edge path) (index : Nat) (bound : index + 1 < path.length) :
    edge (path.getD index 0) (path.getD (index + 1) 0) = true := by
  induction path generalizing index with
  | nil => simp at bound
  | cons first rest ih =>
      cases rest with
      | nil => simp at bound
      | cons second rest =>
          cases index with
          | zero => simpa using walk.1
          | succ index =>
              exact ih walk.2 index (by simpa using bound)

/-- The constructive cycle witness satisfies the same executable certificate
predicate as the optimized solver's cycle witness. -/
theorem cycleCheck_of_total (count : Nat) (edges : Array Nat) (cycle : List Nat)
    (valid : Total.CycleValid (edgeExists edges) (List.range count) cycle) :
    DirectedCycle count edges cycle.toArray := by
  have positive : 0 < cycle.length := List.length_pos_iff.mpr valid.2.1
  refine ⟨by simpa using positive, by simpa using valid.1, ?_, ?_⟩
  · simp only [Array.all_eq_true', List.mem_toArray, decide_eq_true_eq]
    intro vertex member
    exact List.mem_range.mp (valid.2.2.1 member)
  · apply (cycleEdgeCheck_iff edges cycle.toArray).mpr
    refine ⟨by simpa using positive, ?_⟩
    intro index below
    have below' : index < cycle.length := by simpa using below
    have walkEdge := walk_adjacent (edgeExists edges) (cycle ++ [cycle.headD 0])
      valid.2.2.2 index (by simpa using below')
    apply (edgeExists_iff edges _ _).mp
    by_cases nextBelow : index + 1 < cycle.length
    · have modulo : (index + 1) % cycle.length = index + 1 := Nat.mod_eq_of_lt nextBelow
      simpa [arrayGet, Array.getD, below', nextBelow, modulo,
        List.getElem?_append_left below', List.getElem?_append_left nextBelow] using walkEdge
    · have last : index + 1 = cycle.length := by omega
      have modulo : (index + 1) % cycle.length = 0 := by simp [last]
      simpa [arrayGet, Array.getD, below', positive, modulo,
        List.getElem?_append_left below', last, List.head?_eq_getElem?] using walkEdge

end LeanTopologicalSort
