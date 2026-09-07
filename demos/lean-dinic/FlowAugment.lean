import FlowProofs

/-! Unit augmentation along an edge-distinct residual path. This proof is
independent of the optimized search and its iteration bounds. -/

namespace LeanDinic

def ResidualStep (network : Network) (flows : Array Nat)
    (source target index : Nat) (forward : Bool) : Prop :=
  index < network.edges.size ∧
    if forward then
      (network.edges[index]!).source = source ∧ (network.edges[index]!).target = target ∧
        flowAt flows index < (network.edges[index]!).capacity
    else
      (network.edges[index]!).target = source ∧ (network.edges[index]!).source = target ∧
        0 < flowAt flows index

inductive ResidualPath (network : Network) (flows : Array Nat) :
    Nat → Nat → List (Nat × Bool) → Prop
  | refl (vertex : Nat) : ResidualPath network flows vertex vertex []
  | cons {source middle target index forward rest} :
      ResidualStep network flows source middle index forward →
      ResidualPath network flows middle target rest →
      ResidualPath network flows source target ((index, forward) :: rest)

def updateUnitFlow (flows : Array Nat) (index : Nat) (forward : Bool) : Array Nat :=
  flows.modify index (fun amount => if forward then amount + 1 else amount - 1)

def augmentUnitPath : List (Nat × Bool) → Array Nat → Array Nat
  | [], flows => flows
  | (index, forward) :: rest, flows =>
      augmentUnitPath rest (updateUnitFlow flows index forward)

theorem updateUnitFlow_size (flows : Array Nat) (index : Nat) (forward : Bool) :
    (updateUnitFlow flows index forward).size = flows.size := by simp [updateUnitFlow]

theorem updateUnitFlow_at (flows : Array Nat) (index query : Nat) (forward : Bool)
    (bound : query < flows.size) :
    flowAt (updateUnitFlow flows index forward) query =
      if index = query then
        if forward then flowAt flows query + 1 else flowAt flows query - 1
      else flowAt flows query := by
  simp only [updateUnitFlow, flowAt, Array.getElem?_modify]
  by_cases same : index = query <;> simp [same, Array.getElem?_eq_getElem bound]

theorem updateUnitFlow_other (flows : Array Nat) (index query : Nat) (forward : Bool)
    (different : index ≠ query) :
    flowAt (updateUnitFlow flows index forward) query = flowAt flows query := by
  simp [updateUnitFlow, flowAt, Array.getElem?_modify, different]

theorem updateUnitFlow_capacity (network : Network) (flows : Array Nat)
    (source target index : Nat) (forward : Bool) (size : flows.size = network.edges.size)
    (capacity : ∀ query, query < network.edges.size → flowAt flows query ≤ (network.edges[query]!).capacity)
    (step : ResidualStep network flows source target index forward) :
    ∀ query, query < network.edges.size →
      flowAt (updateUnitFlow flows index forward) query ≤ (network.edges[query]!).capacity := by
  intro query bound
  rw [updateUnitFlow_at _ _ _ _ (by omega)]
  by_cases same : index = query
  · subst query
    simp only [↓reduceIte]
    cases forward <;> simp only [ResidualStep, Bool.false_eq_true, ↓reduceIte] at step ⊢
    · exact Nat.le_trans (Nat.sub_le _ _) (capacity index bound)
    · omega
  · simpa [same] using capacity query bound

theorem residualStep_update_other (network : Network) (flows : Array Nat)
    (source target index changed : Nat) (forward direction : Bool)
    (different : changed ≠ index) (step : ResidualStep network flows source target index forward) :
    ResidualStep network (updateUnitFlow flows changed direction) source target index forward := by
  simpa [ResidualStep, updateUnitFlow_other _ _ _ _ different] using step

theorem residualPath_update_other (network : Network) (flows : Array Nat)
    (source target changed : Nat) (direction : Bool) (path : List (Nat × Bool))
    (unused : changed ∉ path.map Prod.fst) (walk : ResidualPath network flows source target path) :
    ResidualPath network (updateUnitFlow flows changed direction) source target path := by
  induction walk with
  | refl vertex => exact .refl vertex
  | @cons source middle target index forward rest step walk ih =>
      simp only [List.map_cons, List.mem_cons, not_or] at unused
      exact .cons (residualStep_update_other _ _ _ _ _ _ _ _ unused.1 step) (ih unused.2)

theorem updateUnitFlow_divergence (network : Network) (flows : Array Nat)
    (source target index vertex : Nat) (forward : Bool) (size : flows.size = network.edges.size)
    (step : ResidualStep network flows source target index forward) :
    divergence network (updateUnitFlow flows index forward) vertex = divergence network flows vertex +
      (if source = vertex then 1 else 0) - (if target = vertex then 1 else 0) := by
  let delta : Int := (if source = vertex then 1 else 0) - (if target = vertex then 1 else 0)
  have change (query : Nat) (bound : query < network.edges.size) :
      ((if (network.edges[query]!).source = vertex then (flowAt (updateUnitFlow flows index forward) query : Int) else 0) -
        (if (network.edges[query]!).target = vertex then (flowAt (updateUnitFlow flows index forward) query : Int) else 0)) =
      ((if (network.edges[query]!).source = vertex then (flowAt flows query : Int) else 0) -
        (if (network.edges[query]!).target = vertex then (flowAt flows query : Int) else 0)) +
        (if query = index then delta else 0) := by
    by_cases same : query = index
    · subst query
      rw [updateUnitFlow_at _ _ _ _ (by omega)]
      simp only [↓reduceIte]
      cases forward <;> simp only [ResidualStep, Bool.false_eq_true, ↓reduceIte] at step ⊢
      · rw [step.2.1, step.2.2.1]
        by_cases sourceEq : source = vertex <;> by_cases targetEq : target = vertex <;>
          simp [sourceEq, targetEq, delta] <;> omega
      · rw [step.2.1, step.2.2.1]
        by_cases sourceEq : source = vertex <;> by_cases targetEq : target = vertex <;>
          simp [sourceEq, targetEq, delta] <;> omega
    · rw [updateUnitFlow_other _ _ _ _ (Ne.symm same)]
      simp [same]
  unfold divergence
  rw [sumInt_congr _ _ _ change, sumInt_add, sumInt_delta]
  simp only [step.1, ↓reduceIte]
  dsimp [delta]
  omega

theorem augmentUnitPath_size (path : List (Nat × Bool)) (flows : Array Nat) :
    (augmentUnitPath path flows).size = flows.size := by
  induction path generalizing flows with
  | nil => rfl
  | cons item rest ih =>
      simpa [augmentUnitPath, updateUnitFlow_size] using ih (updateUnitFlow flows item.1 item.2)

theorem augmentUnitPath_capacity (network : Network) (flows : Array Nat)
    (source target : Nat) (path : List (Nat × Bool))
    (size : flows.size = network.edges.size)
    (capacity : ∀ query, query < network.edges.size → flowAt flows query ≤ (network.edges[query]!).capacity)
    (distinct : (path.map Prod.fst).Nodup) (walk : ResidualPath network flows source target path) :
    ∀ query, query < network.edges.size →
      flowAt (augmentUnitPath path flows) query ≤ (network.edges[query]!).capacity := by
  induction path generalizing flows source with
  | nil => exact capacity
  | cons item rest ih =>
      cases walk with
      | @cons _ middle _ index forward _ step tail =>
          simp only [List.map_cons, List.nodup_cons] at distinct
          apply ih (updateUnitFlow flows index forward) middle
          · simpa [updateUnitFlow_size] using size
          · exact updateUnitFlow_capacity _ _ _ _ _ _ size capacity step
          · exact distinct.2
          · exact residualPath_update_other _ _ _ _ _ _ _ distinct.1 tail

theorem augmentUnitPath_divergence (network : Network) (flows : Array Nat)
    (source target vertex : Nat) (path : List (Nat × Bool))
    (size : flows.size = network.edges.size) (distinct : (path.map Prod.fst).Nodup)
    (walk : ResidualPath network flows source target path) :
    divergence network (augmentUnitPath path flows) vertex = divergence network flows vertex +
      (if source = vertex then 1 else 0) - (if target = vertex then 1 else 0) := by
  induction path generalizing flows source with
  | nil => cases walk; simp [augmentUnitPath]
  | cons item rest ih =>
      cases walk with
      | cons step tail =>
          simp only [List.map_cons, List.nodup_cons] at distinct
          rw [augmentUnitPath, ih _ _ (by simpa [updateUnitFlow_size] using size) distinct.2
            (residualPath_update_other _ _ _ _ _ _ _ distinct.1 tail)]
          rw [updateUnitFlow_divergence _ _ _ _ _ _ _ size step]
          omega

/-- Sending one unit along an edge-distinct residual source/sink path increases
the feasible flow value by one while preserving every capacity and balance. -/
theorem augmentUnitPath_feasible (network : Network) (flows : Array Nat) (value : Nat)
    (path : List (Nat × Bool)) (feasible : Feasible network flows value)
    (distinct : (path.map Prod.fst).Nodup)
    (walk : ResidualPath network flows network.source network.sink path) :
    Feasible network (augmentUnitPath path flows) (value + 1) := by
  refine ⟨by simpa [augmentUnitPath_size] using feasible.1,
    augmentUnitPath_capacity _ _ _ _ _ feasible.1 feasible.2.1 distinct walk, ?_⟩
  intro vertex bound
  rw [augmentUnitPath_divergence _ _ _ _ _ _ feasible.1 distinct walk, feasible.2.2 vertex bound]
  simp only [terminalBalance]
  by_cases sourceEq : vertex = network.source <;> by_cases sinkEq : vertex = network.sink <;>
    simp [sourceEq, sinkEq, eq_comm] <;> omega

end LeanDinic
