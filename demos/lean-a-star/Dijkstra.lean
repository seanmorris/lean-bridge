import Init
import DijkstraCore

/-!
Proof port for `DijkstraCore.lean`, following fetburner/coq-dijkstra.  The Coq
development's increasing/monotone cost extension specializes here to ordinary
addition of natural edge weights.  All executable definitions live in
`DijkstraCore`; this file adds the path-cost lemmas and correctness theorems.
-/

namespace LeanDijkstra

@[simp] theorem costOfPath_cons (weight : Nat → Nat → Nat) (initial current next : Nat)
    (rest : List Nat) :
    costOfPath weight initial current (next :: rest) =
      weight current next + costOfPath weight initial next rest := by
  rfl

theorem costOfPath_increase (weight : Nat → Nat → Nat) (initial current : Nat) :
    ∀ path, initial ≤ costOfPath weight initial current path := by
  intro path
  induction path generalizing current with
  | nil => simp [costOfPath]
  | cons next rest ih =>
      simp only [costOfPath]
      have tail := ih next
      omega

theorem costOfPath_rcons (weight : Nat → Nat → Nat) (initial current final : Nat) :
    ∀ path,
      costOfPath weight initial current (path ++ [final]) =
        costOfPath weight
          (initial + weight (path.getLast?.getD current) final) current path := by
  intro path
  induction path generalizing current with
  | nil =>
      simp only [List.nil_append, costOfPath, List.getLast?_nil, Option.getD_none]
      omega
  | cons next rest ih =>
      simp only [List.cons_append, costOfPath, List.getLast?_cons]
      rw [ih]
      simp only [Option.getD_some]

theorem feasibleLabels_lowerBound
    (graph : Graph) (distance : Nat → Nat) (start current target : Nat)
    (labels : FeasibleLabels graph distance start) :
    ∀ path, Walk graph current target path →
      distance target ≤ distance current + pathCost graph current path := by
  intro path walk
  induction path generalizing current with
  | nil =>
      simp only [Walk] at walk
      subst target
      simp [pathCost, costOfPath]
  | cons next rest ih =>
      rcases walk with ⟨edge, tail⟩
      have edgeBound := labels.2 current next edge
      have tailBound := ih next tail
      simp only [pathCost, costOfPath] at tailBound ⊢
      omega

theorem certificate_shortest
    (graph : Graph) (distance : Nat → Nat) (start target : Nat) (path : List Nat)
    (labels : FeasibleLabels graph distance start)
    (walk : Walk graph start target path)
    (exact : pathCost graph start path = distance target) :
    ShortestPath graph start target path := by
  refine ⟨walk, ?_⟩
  intro alternative alternativeWalk
  have bound := feasibleLabels_lowerBound graph distance start start target labels
    alternative alternativeWalk
  rw [labels.1, Nat.zero_add] at bound
  rwa [exact]

theorem findEdgeWeight_some_mem (target weight : Nat) : ∀ edges,
    findEdgeWeight target edges = some weight →
      ∃ edge, edge ∈ edges ∧ edge.target = target ∧ edge.weight = weight := by
  intro edges found
  induction edges with
  | nil => simp [findEdgeWeight] at found
  | cons edge rest ih =>
      simp only [findEdgeWeight] at found
      split at found
      · rename_i matchEq
        simp only [Option.some.injEq] at found
        exact ⟨edge, by simp, matchEq, found⟩
      · rcases ih found with ⟨candidate, member, targetEq, weightEq⟩
        exact ⟨candidate, by simp [member], targetEq, weightEq⟩

theorem feasibleLabelsCheck_sound (graph : Graph) (distance : Nat → Nat) (start : Nat)
    (checked : feasibleLabelsCheck graph distance start = true) :
    FeasibleLabels graph distance start := by
  simp only [feasibleLabelsCheck, Bool.and_eq_true, decide_eq_true_eq] at checked
  refine ⟨checked.1, ?_⟩
  intro source target edge
  rcases edge with ⟨sourceBound, targetBound, adjacent⟩
  have sourceMem : source ∈ List.range graph.size := List.mem_range.mpr sourceBound
  have sourceCheck := (List.all_eq_true.mp checked.2) source sourceMem
  unfold Graph.adjacent Graph.edgeWeight? at adjacent
  cases found : findEdgeWeight target (graph.outgoing source) with
  | none => simp [found] at adjacent
  | some weight =>
    rcases findEdgeWeight_some_mem target weight (graph.outgoing source) found with
      ⟨candidate, member, targetEq, weightEq⟩
    have edgeCheck := (List.all_eq_true.mp sourceCheck) candidate member
    simp only [targetEq, if_pos targetBound, decide_eq_true_eq] at edgeCheck
    simpa [Graph.weight, Graph.edgeWeight?, found, weightEq] using edgeCheck

theorem csrFeasibleFrom_eq (vertexCount source : Nat) (targets weights : Array Nat)
    (stop : Nat) (distance : Nat → Nat) : ∀ fuel index,
    csrFeasibleFrom vertexCount source targets weights stop distance fuel index =
      (csrOutgoing targets weights stop fuel index).all fun edge =>
        if edge.target < vertexCount then
          decide (distance edge.target ≤ distance source + edge.weight)
        else true := by
  intro fuel index
  induction fuel generalizing index with
  | zero => rfl
  | succ fuel ih =>
      simp only [csrFeasibleFrom, csrOutgoing]
      split
      · rfl
      · simp only [List.all_cons]
        rw [ih]

theorem csrEdgeWeightFrom_eq (targets weights : Array Nat) (stop target : Nat) :
    ∀ fuel index,
    csrEdgeWeightFrom targets weights stop target fuel index =
      findEdgeWeight target (csrOutgoing targets weights stop fuel index) := by
  intro fuel index
  induction fuel generalizing index with
  | zero => rfl
  | succ fuel ih =>
      simp only [csrEdgeWeightFrom, csrOutgoing]
      by_cases stopped : stop ≤ index
      · simp [stopped, findEdgeWeight]
      · simp only [stopped, if_false, findEdgeWeight]
        by_cases found : arrayGet targets index 0 = target
        · simp [found]
        · simp [found, ih]

theorem csrEdgeWeight_eq (vertexCount : Nat) (offsets targets weights : Array Nat)
    (source target : Nat) :
    csrEdgeWeight? offsets targets weights source target =
      (csrGraph vertexCount offsets targets weights).edgeWeight? source target := by
  simp only [csrEdgeWeight?, Graph.edgeWeight?, csrGraph]
  exact csrEdgeWeightFrom_eq targets weights (arrayGet offsets source.succ 0) target
    (arrayGet offsets source.succ 0 - arrayGet offsets source 0 + 1)
    (arrayGet offsets source 0)

theorem csrPathCost_sound (vertexCount : Nat) (offsets targets weights : Array Nat)
    (target : Nat) : ∀ current path cost,
    csrPathCost? vertexCount offsets targets weights target current path = some cost →
      Walk (csrGraph vertexCount offsets targets weights) current target path ∧
      pathCost (csrGraph vertexCount offsets targets weights) current path = cost := by
  intro current path cost found
  induction path generalizing current cost with
  | nil =>
      simp only [csrPathCost?] at found
      split at found
      · rename_i endpoint
        simp only [Option.some.injEq] at found
        subst current
        subst cost
        exact ⟨rfl, rfl⟩
      · simp at found
  | cons next rest ih =>
      simp only [csrPathCost?] at found
      split at found
      · rename_i bounds
        simp only [Bool.and_eq_true, decide_eq_true_eq] at bounds
        cases edgeEq : csrEdgeWeight? offsets targets weights current next with
        | none => simp [edgeEq] at found
        | some weight =>
            cases tailEq : csrPathCost? vertexCount offsets targets weights target next rest with
            | none => simp [edgeEq, tailEq] at found
            | some tailCost =>
                simp only [edgeEq, tailEq, Option.some.injEq] at found
                subst cost
                have graphEdgeWeight :
                    (csrGraph vertexCount offsets targets weights).edgeWeight? current next =
                      some weight := by
                  rw [← csrEdgeWeight_eq]
                  exact edgeEq
                rcases ih next tailCost tailEq with ⟨tailWalk, tailCostEq⟩
                have edge :
                    (csrGraph vertexCount offsets targets weights).Edge current next :=
                  ⟨bounds.1, bounds.2, by simp [Graph.adjacent, graphEdgeWeight]⟩
                refine ⟨⟨edge, tailWalk⟩, ?_⟩
                change (csrGraph vertexCount offsets targets weights).weight current next +
                  pathCost (csrGraph vertexCount offsets targets weights) next rest =
                    weight + tailCost
                simp [Graph.weight, graphEdgeWeight, tailCostEq]
      · simp at found

theorem allUpTo_eq_range_all (predicate : Nat → Bool) : ∀ count,
    allUpTo count predicate = (List.range count).all predicate := by
  intro count
  induction count with
  | zero => rfl
  | succ count ih =>
      simp [allUpTo, List.range_succ, ih, Bool.and_comm]

theorem allUpTo_get (predicate : Nat → Bool) (count index : Nat)
    (checked : allUpTo count predicate = true) (bound : index < count) :
    predicate index = true := by
  induction count with
  | zero => omega
  | succ count ih =>
      simp only [allUpTo, Bool.and_eq_true] at checked
      by_cases last : index = count
      · subst index
        exact checked.2
      · exact ih checked.1 (by omega)

theorem csrFeasibleLabelsCheck_sound (vertexCount : Nat) (offsets targets weights : Array Nat)
    (distance : Nat → Nat) (start cutoff : Nat)
    (bounded : ∀ vertex, distance vertex ≤ cutoff)
    (checked : csrFeasibleLabelsCheck vertexCount offsets targets weights distance start cutoff = true) :
    FeasibleLabels (csrGraph vertexCount offsets targets weights) distance start := by
  simp only [csrFeasibleLabelsCheck, Bool.and_eq_true, decide_eq_true_eq] at checked
  refine ⟨checked.1, ?_⟩
  intro source target edge
  rcases edge with ⟨sourceBound, targetBound, adjacent⟩
  have sourceCheck := allUpTo_get _ vertexCount source checked.2 sourceBound
  by_cases capped : cutoff ≤ distance source
  · exact Nat.le_trans (bounded target) (by omega)
  · simp only [capped, if_false] at sourceCheck
    rw [csrFeasibleFrom_eq] at sourceCheck
    unfold Graph.adjacent Graph.edgeWeight? csrGraph at adjacent
    cases found : findEdgeWeight target
        (csrOutgoing targets weights (arrayGet offsets source.succ 0)
          (arrayGet offsets source.succ 0 - arrayGet offsets source 0 + 1)
          (arrayGet offsets source 0)) with
    | none => simp [found] at adjacent
    | some weight =>
        rcases findEdgeWeight_some_mem target weight _ found with
          ⟨candidate, member, targetEq, weightEq⟩
        have edgeCheck := (List.all_eq_true.mp sourceCheck) candidate member
        have candidateBound : candidate.target < vertexCount := by simpa [targetEq]
        have candidateCheck :
            distance candidate.target ≤ distance source + candidate.weight := by
          simpa [candidateBound] using edgeCheck
        simpa [Graph.weight, Graph.edgeWeight?, csrGraph, found, targetEq, weightEq]
          using candidateCheck

/-- Recursive correctness counterpart of Coq's `dijkstra_rec_correct`. -/
theorem dijkstraRec_correct (graph : Graph) (start target : Nat) (path : List Nat)
    (found : dijkstraRec graph start target = some path) :
    ShortestPath graph start target path := by
  simp only [dijkstraRec] at found
  generalize hresult : dijkstraRaw graph start target = result at found
  cases hpath : result.path with
  | none => simp [hpath] at found
  | some candidate =>
      simp only [hpath] at found
      split at found
      · rename_i certificate
        simp only [Option.some.injEq] at found
        subst path
        exact certificate_shortest graph (resultDistance result) start target candidate
          (feasibleLabelsCheck_sound graph (resultDistance result) start certificate.1)
          certificate.2.1 certificate.2.2
      · simp at found

/-- Top-level correctness counterpart of Coq's `dijkstra_correct`. -/
theorem dijkstra_correct (graph : Graph) (start target : Nat) (path : List Nat)
    (found : dijkstra graph start target = some path) :
    ShortestPath graph start target path :=
  dijkstraRec_correct graph start target path found

/-- The direct CSR execution path satisfies the same generic graph specification. -/
theorem dijkstraCsr_correct (vertexCount : Nat) (offsets targets weights : Array Nat)
    (maximumWeight start target : Nat) (path : List Nat)
    (found : dijkstraCsr vertexCount offsets targets weights maximumWeight start target = some path) :
    ShortestPath (csrGraph vertexCount offsets targets weights) start target path := by
  simp only [dijkstraCsr] at found
  generalize hresult : dijkstraRawCsr vertexCount offsets targets weights maximumWeight start target = result at found
  cases hpath : result.path with
  | none => simp [hpath] at found
  | some candidate =>
      simp only [hpath] at found
      split at found
      · rename_i certificate
        simp only [Option.some.injEq] at found
        subst path
        have pathSound := csrPathCost_sound vertexCount offsets targets weights target
          start candidate (resultDistance result target) certificate.2
        exact certificate_shortest (csrGraph vertexCount offsets targets weights)
          (resultDistance result) start target candidate
          (csrFeasibleLabelsCheck_sound vertexCount offsets targets weights
            (resultDistance result) start result.cutoff
            (fun vertex => Nat.min_le_right _ _) certificate.1)
          pathSound.1 pathSound.2
      · simp at found

end LeanDijkstra
