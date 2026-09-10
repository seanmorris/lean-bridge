import AStarCore
import AStarPotential

/-! The CSR certificate checks implement the generic graph predicates. -/

namespace LeanAStar

open LeanDijkstra

theorem heuristicFrom_eq (input : Input) (source stop fuel index : Nat) :
    heuristicFrom input source stop fuel index =
      (csrOutgoing input.targets input.weights stop fuel index).all fun edge =>
        if edge.target < input.count then
          decide (input.h source ≤ edge.weight + input.h edge.target)
        else true := by
  induction fuel generalizing index with
  | zero => rfl
  | succ fuel ih =>
      simp only [heuristicFrom, csrOutgoing]
      split
      · rfl
      · simp only [List.all_cons]
        rw [ih]

/-- The prepared heuristic is zero at the goal and consistent on every edge
of the graph actually searched. -/
theorem heuristicCheck_sound (input : Input)
    (checked : heuristicCheck input = true) :
    GoalHeuristic input.graph input.h input.target := by
  simp only [heuristicCheck, Bool.and_eq_true, beq_iff_eq] at checked
  refine ⟨?_, checked.1⟩
  intro source target edge
  have sourceCheck := allUpTo_get _ input.count source checked.2 edge.1
  simp only [heuristicFrom_eq] at sourceCheck
  have adjacent := edge.2.2
  unfold Graph.adjacent at adjacent
  cases found : input.graph.edgeWeight? source target with
  | none => simp [found] at adjacent
  | some weight =>
      obtain ⟨candidate, member, targetEq, weightEq⟩ :=
        findEdgeWeight_some_mem target weight (input.graph.outgoing source) found
      have accepted := List.all_eq_true.mp sourceCheck candidate member
      have bounded : candidate.target < input.count := by
        simpa [targetEq, Input.graph, csrGraph] using edge.2.1
      simp only [bounded, ↓reduceIte, decide_eq_true_eq] at accepted
      simpa [Graph.weight, found, targetEq, weightEq] using accepted

/-- Caching the source label preserves the shared CSR certificate predicate. -/
theorem labelsFrom_eq (input : Input) (state : State)
    (cutoff source stop fuel index : Nat) :
    labelsFrom input state cutoff (labels input state cutoff source) stop fuel index =
      csrFeasibleFrom input.count source input.targets input.weights stop
        (labels input state cutoff) fuel index := by
  induction fuel generalizing index with
  | zero => rfl
  | succ fuel ih =>
      simp only [labelsFrom, csrFeasibleFrom]
      split
      · rfl
      · rw [ih]

theorem labelsCheck_eq (input : Input) (state : State) (cutoff : Nat) :
    labelsCheck input state cutoff =
      astarLabelsCheck input.graph input.h
        (fun vertex => arrayGet state.distance vertex 0) cutoff input.start := by
  simp only [labelsCheck, labelsFrom_eq]
  simp only [astarLabelsCheck, Input.graph, csrGraph,
    csrFeasibleFrom_eq, labels, astarLabel]
  rfl

theorem labelsCheck_sound (input : Input) (state : State) (cutoff : Nat)
    (consistent : Consistent input.graph input.h)
    (checked : labelsCheck input state cutoff = true) :
    FeasibleLabels input.graph (labels input state cutoff) input.start := by
  rw [labelsCheck_eq] at checked
  exact astarLabelsCheck_sound input.graph input.h
    (fun vertex => arrayGet state.distance vertex 0) cutoff input.start
    consistent checked

theorem cutFrom_eq (input : Input) (closed : Array Bool) (stop fuel index : Nat) :
    cutFrom input closed stop fuel index =
      (csrOutgoing input.targets input.weights stop fuel index).all fun edge =>
        if edge.target < input.count then arrayGet closed edge.target false else true := by
  induction fuel generalizing index with
  | zero => rfl
  | succ fuel ih =>
      simp only [cutFrom, csrOutgoing]
      split
      · rfl
      · simp only [List.all_cons]
        rw [ih]

theorem cutCheck_eq (input : Input) (closed : Array Bool) :
    cutCheck input closed = graphCutCheck input.graph
      (fun vertex => arrayGet closed vertex false) input.start input.target := by
  simp only [cutCheck, graphCutCheck, Input.graph, csrGraph, cutFrom_eq]

theorem cutCheck_sound (input : Input) (closed : Array Bool)
    (checked : cutCheck input closed = true) :
    ∀ path, ¬Walk input.graph input.start input.target path := by
  rw [cutCheck_eq] at checked
  have impossible := graphCutCheck_sound input.graph (fun vertex => arrayGet closed vertex false)
    input.start input.target checked
  intro path walk
  exact impossible ⟨path, walk⟩

end LeanAStar
