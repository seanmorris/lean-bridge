import FlowPaths
import FlowAugment

namespace LeanDinic

/-- A vertex-simple residual walk can choose concrete original edge identities
without repeating any identity, including in graphs with antiparallel edges. -/
theorem residualWalk_edge_distinct (network : Network) (flows : Array Nat) (source target : Nat)
    (vertices : List Nat) (walk : ResidualWalk network flows source target vertices)
    (simple : (source :: vertices).Nodup) :
    ∃ steps, ResidualPath network flows source target steps ∧ (steps.map Prod.fst).Nodup ∧
      ∀ index ∈ steps.map Prod.fst,
        (network.edges[index]!).source ∈ source :: vertices ∧
        (network.edges[index]!).target ∈ source :: vertices := by
  induction vertices generalizing source with
  | nil =>
      subst source
      exact ⟨[], .refl target, by simp, by simp⟩
  | cons next rest ih =>
      obtain ⟨steps, path, distinct, endpoints⟩ := ih next walk.2 (List.nodup_cons.mp simple).2
      obtain ⟨index, bound, forward | reverse⟩ := walk.1
      · have unused : index ∉ steps.map Prod.fst := by
          intro member
          have occurs := (endpoints index member).1
          rw [forward.1] at occurs
          exact (List.nodup_cons.mp simple).1 occurs
        refine ⟨(index, true) :: steps, .cons ⟨bound, by simpa using forward⟩ path,
          by simpa using List.nodup_cons.mpr ⟨unused, distinct⟩, ?_⟩
        intro other member
        simp only [List.map_cons, List.mem_cons] at member
        rcases member with same | later
        · subst other
          simp [forward.1, forward.2.1]
        · have pair := endpoints other later
          exact ⟨List.mem_cons_of_mem source pair.1, List.mem_cons_of_mem source pair.2⟩
      · have unused : index ∉ steps.map Prod.fst := by
          intro member
          have occurs := (endpoints index member).2
          rw [reverse.1] at occurs
          exact (List.nodup_cons.mp simple).1 occurs
        refine ⟨(index, false) :: steps, .cons ⟨bound, by simpa using reverse⟩ path,
          by simpa using List.nodup_cons.mpr ⟨unused, distinct⟩, ?_⟩
        intro other member
        simp only [List.map_cons, List.mem_cons] at member
        rcases member with same | later
        · subst other
          simp [reverse.1, reverse.2.1]
        · have pair := endpoints other later
          exact ⟨List.mem_cons_of_mem source pair.1, List.mem_cons_of_mem source pair.2⟩

theorem residualReachable_edge_distinct (network : Network) (flows : Array Nat) (source target : Nat)
    (reachable : ResidualReachable network flows source target) :
    ∃ steps, ResidualPath network flows source target steps ∧ (steps.map Prod.fst).Nodup := by
  obtain ⟨vertices, walk⟩ := reachable
  obtain ⟨simple, simpleWalk, simpleVertices⟩ := residualWalk_simple network flows source target vertices walk
  obtain ⟨steps, path, distinct, _⟩ := residualWalk_edge_distinct network flows source target simple simpleWalk simpleVertices
  exact ⟨steps, path, distinct⟩

theorem maximumFlow_no_residual_path (network : Network) (flows : Array Nat) (value : Nat)
    (maximum : MaximumFlow network flows value) :
    ¬ ResidualReachable network flows network.source network.sink := by
  intro reachable
  obtain ⟨steps, path, distinct⟩ := residualReachable_edge_distinct network flows network.source network.sink reachable
  have augmented := augmentUnitPath_feasible network flows value steps maximum.1 distinct path
  have impossible := maximum.2 (augmentUnitPath steps flows) (value + 1) augmented
  omega

/-- The integer max-flow/min-cut theorem: every maximum feasible flow has a
source/sink cut whose capacity equals its value. Residual path augmentation and
cycle erasure establish this independently of the optimized Dinic search. -/
theorem maximumFlow_matching_cut (network : Network) (flows : Array Nat) (value : Nat)
    (valid : network.Valid) (maximum : MaximumFlow network flows value) :
    ∃ cut, IsCut network cut ∧ value = cutCapacity network cut := by
  have blocked := maximumFlow_no_residual_path network flows value maximum
  exact ⟨residualCut network flows, residualCut_valid network flows valid blocked,
    residualCut_equal network flows value valid maximum.1 blocked⟩

/-- Any separately chosen maximum flow and minimum cut have equal values. This
also covers the total reference fallback, not just certified fast-path output. -/
theorem maximumFlow_minimumCut_equal (network : Network) (flows : Array Nat) (value : Nat)
    (cut : Array Bool) (valid : network.Valid) (maximum : MaximumFlow network flows value)
    (minimum : MinimumCut network cut) : value = cutCapacity network cut := by
  obtain ⟨matching, isCut, equal⟩ := maximumFlow_matching_cut network flows value valid maximum
  have lower := flow_cut_upper_bound network flows value cut valid maximum.1 minimum.1
  have upper := minimum.2 matching isCut
  omega

theorem solves_flow_cut_equal (network : Network) (solution : Solution)
    (valid : network.Valid) (correct : Solves network solution) :
    solution.value = cutCapacity network solution.cut :=
  maximumFlow_minimumCut_equal network solution.flows solution.value solution.cut valid correct.1 correct.2

end LeanDinic
