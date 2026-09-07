import Dijkstra

/-!
Heuristic consistency, edge reweighting, and reachability certificates for
finite weighted graphs. These definitions do not refer to a grid or layout.
-/

namespace LeanAStar

open LeanDijkstra

/-- Along an edge, the estimate cannot fall by more than the edge costs. -/
def Consistent (graph : Graph) (heuristic : Nat → Nat) : Prop :=
  ∀ source target, graph.Edge source target →
    heuristic source ≤ graph.weight source target + heuristic target

def GoalHeuristic (graph : Graph) (heuristic : Nat → Nat) (goal : Nat) : Prop :=
  Consistent graph heuristic ∧ heuristic goal = 0

/-- Consistency makes these reduced edge weights nonnegative without loss from
natural-number subtraction. -/
def reducedGraph (graph : Graph) (heuristic : Nat → Nat) : Graph where
  size := graph.size
  outgoing := fun source => (graph.outgoing source).map fun edge =>
    { target := edge.target,
      weight := edge.weight + heuristic edge.target - heuristic source }

theorem findEdgeWeight_reduced (heuristic : Nat → Nat) (source target : Nat)
    (edges : List WeightedEdge) :
    findEdgeWeight target (edges.map fun edge =>
      { target := edge.target,
        weight := edge.weight + heuristic edge.target - heuristic source }) =
      (findEdgeWeight target edges).map (fun weight => weight + heuristic target - heuristic source) := by
  induction edges with
  | nil => rfl
  | cons edge rest ih =>
      simp only [List.map_cons, findEdgeWeight]
      by_cases same : edge.target = target
      · simp [same]
      · simp [same, ih]

theorem reduced_edgeWeight (graph : Graph) (heuristic : Nat → Nat)
    (source target : Nat) :
    (reducedGraph graph heuristic).edgeWeight? source target =
      (graph.edgeWeight? source target).map (fun weight => weight + heuristic target - heuristic source) := by
  exact findEdgeWeight_reduced heuristic source target (graph.outgoing source)

theorem reduced_edge_iff (graph : Graph) (heuristic : Nat → Nat)
    (source target : Nat) :
    (reducedGraph graph heuristic).Edge source target ↔ graph.Edge source target := by
  simp only [Graph.Edge, Graph.adjacent, reduced_edgeWeight, Option.isSome_map]
  rfl

theorem reduced_weight (graph : Graph) (heuristic : Nat → Nat)
    (source target : Nat) (edge : graph.Edge source target) :
    (reducedGraph graph heuristic).weight source target =
      graph.weight source target + heuristic target - heuristic source := by
  unfold Graph.weight
  rw [reduced_edgeWeight]
  have present := edge.2.2
  unfold Graph.adjacent at present
  cases found : graph.edgeWeight? source target with
  | none => simp [found] at present
  | some weight => simp

theorem reduced_walk_iff (graph : Graph) (heuristic : Nat → Nat)
    (start target : Nat) (path : List Nat) :
    Walk (reducedGraph graph heuristic) start target path ↔ Walk graph start target path := by
  induction path generalizing start with
  | nil => rfl
  | cons next rest ih => simp [Walk, reduced_edge_iff, ih]

/-- Every path changes by the same endpoint-dependent constant. -/
theorem reduced_pathCost_telescope (graph : Graph) (heuristic : Nat → Nat)
    (consistent : Consistent graph heuristic) (start target : Nat) (path : List Nat)
    (walk : Walk graph start target path) :
    pathCost (reducedGraph graph heuristic) start path + heuristic start =
      pathCost graph start path + heuristic target := by
  induction path generalizing start with
  | nil =>
      simp only [Walk] at walk
      simp [pathCost, costOfPath, walk]
  | cons next rest ih =>
      have tail := ih next walk.2
      have edge := reduced_weight graph heuristic start next walk.1
      have bounded := consistent start next walk.1
      have restored : (reducedGraph graph heuristic).weight start next + heuristic start =
          graph.weight start next + heuristic next := by
        rw [edge, Nat.sub_add_cancel bounded]
      simp only [pathCost, costOfPath] at tail ⊢
      omega

theorem reduced_shortest_iff (graph : Graph) (heuristic : Nat → Nat)
    (consistent : Consistent graph heuristic) (start target : Nat) (path : List Nat) :
    ShortestPath (reducedGraph graph heuristic) start target path ↔
      ShortestPath graph start target path := by
  constructor
  · rintro ⟨walk, shortest⟩
    have originalWalk := (reduced_walk_iff graph heuristic start target path).mp walk
    refine ⟨originalWalk, ?_⟩
    intro alternative alternativeWalk
    have comparison := shortest alternative
      ((reduced_walk_iff graph heuristic start target alternative).mpr alternativeWalk)
    have chosen := reduced_pathCost_telescope graph heuristic consistent start target path originalWalk
    have other := reduced_pathCost_telescope graph heuristic consistent start target alternative alternativeWalk
    omega
  · rintro ⟨walk, shortest⟩
    refine ⟨(reduced_walk_iff graph heuristic start target path).mpr walk, ?_⟩
    intro alternative alternativeWalk
    have originalAlternative :=
      (reduced_walk_iff graph heuristic start target alternative).mp alternativeWalk
    have comparison := shortest alternative originalAlternative
    have chosen := reduced_pathCost_telescope graph heuristic consistent start target path walk
    have other := reduced_pathCost_telescope graph heuristic consistent start target alternative originalAlternative
    omega

/-- A consistent estimate that is zero at the goal never exceeds the cost of
any walk to that goal. -/
theorem consistent_admissible (graph : Graph) (heuristic : Nat → Nat) (goal : Nat)
    (valid : GoalHeuristic graph heuristic goal) (start : Nat) (path : List Nat)
    (walk : Walk graph start goal path) : heuristic start ≤ pathCost graph start path := by
  have telescope := reduced_pathCost_telescope graph heuristic valid.1 start goal path walk
  rw [valid.2, Nat.add_zero] at telescope
  omega

theorem zero_consistent (graph : Graph) : Consistent graph (fun _ => 0) := by
  intro source target edge
  simp

theorem zero_reducedGraph (graph : Graph) : reducedGraph graph (fun _ => 0) = graph := by
  cases graph with
  | mk size outgoing =>
      simp only [reducedGraph, Nat.add_zero, Nat.sub_zero]
      congr
      funext source
      have identity : (fun edge : WeightedEdge => { target := edge.target, weight := edge.weight }) = id := rfl
      simp [identity]

/-- A set containing the source and closed under outgoing edges contains every
vertex reached by a walk from that source. -/
theorem cut_contains_walk (graph : Graph) (inside : Nat → Bool)
    (closed : ∀ source target, graph.Edge source target → inside source = true → inside target = true)
    (start target : Nat) (path : List Nat) (present : inside start = true)
    (walk : Walk graph start target path) : inside target = true := by
  induction path generalizing start with
  | nil => simpa [Walk] using walk ▸ present
  | cons next rest ih => exact ih next (closed start next walk.1 present) walk.2

theorem cut_unreachable (graph : Graph) (inside : Nat → Bool) (start target : Nat)
    (sourceInside : inside start = true) (targetOutside : inside target = false)
    (closed : ∀ source target, graph.Edge source target → inside source = true → inside target = true) :
    ¬∃ path, Walk graph start target path := by
  rintro ⟨path, walk⟩
  have reached := cut_contains_walk graph inside closed start target path sourceInside walk
  simp [targetOutside] at reached

/-- The target-cost cap inherits feasibility from heuristic consistency. -/
theorem heuristic_cap_feasible (graph : Graph) (heuristic : Nat → Nat)
    (consistent : Consistent graph heuristic) (cost source target : Nat)
    (edge : graph.Edge source target) :
    cost - heuristic target ≤ cost - heuristic source + graph.weight source target := by
  have bounded := consistent source target edge
  omega

/-- Checking only rows below their heuristic cap suffices to certify all edge
inequalities used by the shortest-path theorem. -/
theorem capped_labels_feasible (graph : Graph) (heuristic distance : Nat → Nat)
    (consistent : Consistent graph heuristic) (cost start : Nat)
    (sourceZero : distance start = 0)
    (checked : ∀ source target, graph.Edge source target →
      distance source < cost - heuristic source →
      min (distance target) (cost - heuristic target) ≤ distance source + graph.weight source target) :
    FeasibleLabels graph (fun vertex => min (distance vertex) (cost - heuristic vertex)) start := by
  refine ⟨by simp [sourceZero], ?_⟩
  intro source target edge
  dsimp only
  by_cases below : distance source < cost - heuristic source
  · rw [Nat.min_eq_left (Nat.le_of_lt below)]
    exact checked source target edge below
  · have cap := heuristic_cap_feasible graph heuristic consistent cost source target edge
    rw [Nat.min_eq_right (by omega : cost - heuristic source ≤ distance source)]
    exact Nat.le_trans (Nat.min_le_right _ _) cap

def astarLabel (heuristic distance : Nat → Nat) (cost vertex : Nat) : Nat :=
  min (distance vertex) (cost - heuristic vertex)

/-- Rows at their heuristic cap follow directly from consistency and need no
edge-by-edge certificate work. -/
def astarLabelsCheck (graph : Graph) (heuristic distance : Nat → Nat)
    (cost start : Nat) : Bool :=
  decide (astarLabel heuristic distance cost start = 0) &&
    allUpTo graph.size fun source =>
      if distance source < cost - heuristic source then
        (graph.outgoing source).all fun edge =>
          if edge.target < graph.size then
            decide (astarLabel heuristic distance cost edge.target ≤
              astarLabel heuristic distance cost source + edge.weight)
          else true
      else true

theorem astarLabelsCheck_sound (graph : Graph) (heuristic distance : Nat → Nat)
    (cost start : Nat) (consistent : Consistent graph heuristic)
    (checked : astarLabelsCheck graph heuristic distance cost start = true) :
    FeasibleLabels graph (astarLabel heuristic distance cost) start := by
  simp only [astarLabelsCheck, Bool.and_eq_true, decide_eq_true_eq] at checked
  refine ⟨checked.1, ?_⟩
  intro source target edge
  by_cases below : distance source < cost - heuristic source
  · have sourceCheck := allUpTo_get _ graph.size source checked.2 edge.1
    simp only [below, ↓reduceIte] at sourceCheck
    have adjacent := edge.2.2
    unfold Graph.adjacent at adjacent
    cases found : graph.edgeWeight? source target with
    | none => simp [found] at adjacent
    | some weight =>
        obtain ⟨candidate, member, targetEq, weightEq⟩ :=
          findEdgeWeight_some_mem target weight (graph.outgoing source) found
        have accepted := List.all_eq_true.mp sourceCheck candidate member
        have bounded : candidate.target < graph.size := by simpa [targetEq] using edge.2.1
        simp only [bounded, ↓reduceIte, decide_eq_true_eq] at accepted
        simpa [Graph.weight, found, targetEq, weightEq] using accepted
  · have cap := heuristic_cap_feasible graph heuristic consistent cost source target edge
    unfold astarLabel
    rw [Nat.min_eq_right (by omega : cost - heuristic source ≤ distance source)]
    exact Nat.le_trans (Nat.min_le_right _ _) cap

theorem astar_certificate_shortest (graph : Graph) (heuristic distance : Nat → Nat)
    (cost start target : Nat) (path : List Nat)
    (valid : GoalHeuristic graph heuristic target)
    (checked : astarLabelsCheck graph heuristic distance cost start = true)
    (targetCost : distance target = cost)
    (walk : Walk graph start target path) (exactCost : pathCost graph start path = cost) :
    ShortestPath graph start target path := by
  apply certificate_shortest graph (astarLabel heuristic distance cost) start target path
    (astarLabelsCheck_sound graph heuristic distance cost start valid.1 checked) walk
  simpa [astarLabel, targetCost, valid.2] using exactCost

def graphCutCheck (graph : Graph) (inside : Nat → Bool) (start target : Nat) : Bool :=
  inside start && !inside target &&
    allUpTo graph.size fun source =>
      if inside source then
        (graph.outgoing source).all fun edge =>
          if edge.target < graph.size then inside edge.target else true
      else true

theorem graphCutCheck_sound (graph : Graph) (inside : Nat → Bool) (start target : Nat)
    (checked : graphCutCheck graph inside start target = true) :
    ¬∃ path, Walk graph start target path := by
  simp only [graphCutCheck, Bool.and_eq_true, Bool.not_eq_true'] at checked
  apply cut_unreachable graph inside start target checked.1.1 checked.1.2
  intro source next edge sourceInside
  have sourceCheck := allUpTo_get _ graph.size source checked.2 edge.1
  simp only [sourceInside, ↓reduceIte] at sourceCheck
  have adjacent := edge.2.2
  unfold Graph.adjacent at adjacent
  cases found : graph.edgeWeight? source next with
  | none => simp [found] at adjacent
  | some weight =>
      obtain ⟨candidate, member, targetEq, _⟩ :=
        findEdgeWeight_some_mem next weight (graph.outgoing source) found
      have accepted := List.all_eq_true.mp sourceCheck candidate member
      have bounded : candidate.target < graph.size := by simpa [targetEq] using edge.2.1
      simp only [bounded, ↓reduceIte] at accepted
      simpa [targetEq] using accepted

end LeanAStar
