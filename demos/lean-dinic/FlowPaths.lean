import FlowProofs

/-! Residual reachability and loop-free paths, used to connect maximum integer
flows with their residual minimum cuts. -/

namespace LeanDinic

def ResidualEdge (network : Network) (flows : Array Nat) (source target : Nat) : Prop :=
  ∃ index, index < network.edges.size ∧
    (((network.edges[index]!).source = source ∧ (network.edges[index]!).target = target ∧
        flowAt flows index < (network.edges[index]!).capacity) ∨
     ((network.edges[index]!).target = source ∧ (network.edges[index]!).source = target ∧
        0 < flowAt flows index))

def ResidualWalk (network : Network) (flows : Array Nat) (current target : Nat) : List Nat → Prop
  | [] => current = target
  | next :: rest => ResidualEdge network flows current next ∧ ResidualWalk network flows next target rest

def ResidualReachable (network : Network) (flows : Array Nat) (source target : Nat) : Prop :=
  ∃ path, ResidualWalk network flows source target path

theorem residualWalk_suffix (network : Network) (flows : Array Nat) (source target vertex : Nat)
    (path : List Nat) (walk : ResidualWalk network flows source target path)
    (simple : (source :: path).Nodup) (member : vertex ∈ source :: path) :
    ∃ suffix, ResidualWalk network flows vertex target suffix ∧ (vertex :: suffix).Nodup := by
  induction path generalizing source with
  | nil =>
      simp only [List.mem_singleton] at member
      subst vertex
      exact ⟨[], walk, simple⟩
  | cons next rest ih =>
      rcases List.mem_cons.mp member with same | later
      · subst vertex
        exact ⟨next :: rest, walk, simple⟩
      · exact ih next walk.2 (List.nodup_cons.mp simple).2 later

/-- Erasing cycles preserves endpoints and residual edges. -/
theorem residualWalk_simple (network : Network) (flows : Array Nat) (source target : Nat)
    (path : List Nat) (walk : ResidualWalk network flows source target path) :
    ∃ simplePath, ResidualWalk network flows source target simplePath ∧ (source :: simplePath).Nodup := by
  classical
  induction path generalizing source with
  | nil => exact ⟨[], walk, by simp⟩
  | cons next rest ih =>
      obtain ⟨simpleRest, tailWalk, tailSimple⟩ := ih next walk.2
      by_cases repeated : source ∈ next :: simpleRest
      · exact residualWalk_suffix network flows next target source simpleRest tailWalk tailSimple repeated
      · exact ⟨next :: simpleRest, ⟨walk.1, tailWalk⟩, List.nodup_cons.mpr ⟨repeated, tailSimple⟩⟩

theorem residualWalk_append (network : Network) (flows : Array Nat) (source middle target : Nat)
    (first second : List Nat) (left : ResidualWalk network flows source middle first)
    (right : ResidualWalk network flows middle target second) :
    ResidualWalk network flows source target (first ++ second) := by
  induction first generalizing source with
  | nil => subst source; exact right
  | cons next rest ih => exact ⟨left.1, ih next left.2⟩

theorem residualReachable_refl (network : Network) (flows : Array Nat) (vertex : Nat) :
    ResidualReachable network flows vertex vertex := ⟨[], rfl⟩

theorem residualReachable_step (network : Network) (flows : Array Nat) (source middle target : Nat)
    (reachable : ResidualReachable network flows source middle) (edge : ResidualEdge network flows middle target) :
    ResidualReachable network flows source target := by
  obtain ⟨path, walk⟩ := reachable
  exact ⟨path ++ [target], residualWalk_append network flows source middle target path [target] walk ⟨edge, rfl⟩⟩

noncomputable def residualCut (network : Network) (flows : Array Nat) : Array Bool :=
  open Classical in
  Array.ofFn (fun vertex : Fin network.vertexCount => decide (ResidualReachable network flows network.source vertex.val))

theorem residualCut_at (network : Network) (flows : Array Nat) (vertex : Nat)
    (bound : vertex < network.vertexCount) :
    cutAt (residualCut network flows) vertex = true ↔ ResidualReachable network flows network.source vertex := by
  classical
  simp [residualCut, cutAt, bound]

theorem residualCut_valid (network : Network) (flows : Array Nat) (valid : network.Valid)
    (blocked : ¬ ResidualReachable network flows network.source network.sink) :
    IsCut network (residualCut network flows) := by
  refine ⟨by simp [residualCut], ?_, ?_⟩
  · exact (residualCut_at _ _ _ valid.1).mpr (residualReachable_refl _ _ _)
  · cases flag : cutAt (residualCut network flows) network.sink
    · rfl
    · exact False.elim (blocked ((residualCut_at _ _ _ valid.2.1).mp flag))

theorem residualCut_closed (network : Network) (flows : Array Nat) (source target : Nat)
    (sourceBound : source < network.vertexCount) (targetBound : target < network.vertexCount)
    (reachable : cutAt (residualCut network flows) source = true)
    (edge : ResidualEdge network flows source target) : cutAt (residualCut network flows) target = true := by
  apply (residualCut_at _ _ _ targetBound).mpr
  exact residualReachable_step _ _ _ _ _ ((residualCut_at _ _ _ sourceBound).mp reachable) edge

theorem residualCut_crossing_edges (network : Network) (flows : Array Nat) (value : Nat)
    (valid : network.Valid) (feasible : Feasible network flows value) (index : Nat)
    (bound : index < network.edges.size) :
    (cutAt (residualCut network flows) (network.edges[index]!).source = true →
      cutAt (residualCut network flows) (network.edges[index]!).target = false →
      flowAt flows index = (network.edges[index]!).capacity) ∧
    (cutAt (residualCut network flows) (network.edges[index]!).source = false →
      cutAt (residualCut network flows) (network.edges[index]!).target = true → flowAt flows index = 0) := by
  have endpoints := valid.2.2.2 index bound
  constructor
  · intro source target
    have capacity := feasible.2.1 index bound
    apply Classical.byContradiction
    intro unequal
    have residual : ResidualEdge network flows (network.edges[index]!).source (network.edges[index]!).target :=
      ⟨index, bound, Or.inl ⟨rfl, rfl, by omega⟩⟩
    have reachable := residualCut_closed network flows _ _ endpoints.1 endpoints.2 source residual
    simp [target] at reachable
  · intro source target
    apply Classical.byContradiction
    intro nonzero
    have residual : ResidualEdge network flows (network.edges[index]!).target (network.edges[index]!).source :=
      ⟨index, bound, Or.inr ⟨rfl, rfl, by omega⟩⟩
    have reachable := residualCut_closed network flows _ _ endpoints.2 endpoints.1 target residual
    simp [source] at reachable

/-- A feasible flow with no residual route to the sink exactly fills its
residual cut, providing the matching witness required by the certificate. -/
theorem residualCut_equal (network : Network) (flows : Array Nat) (value : Nat)
    (valid : network.Valid) (feasible : Feasible network flows value)
    (blocked : ¬ ResidualReachable network flows network.source network.sink) :
    value = cutCapacity network (residualCut network flows) := by
  have balance := feasible_cut_balance network flows value (residualCut network flows) valid feasible
    (residualCut_valid network flows valid blocked)
  have equal := sumInt_congr network.edges.size
    (fun index =>
      (if cutAt (residualCut network flows) (network.edges[index]!).source then (flowAt flows index : Int) else 0) -
      (if cutAt (residualCut network flows) (network.edges[index]!).target then (flowAt flows index : Int) else 0))
    (fun index => ((if cutAt (residualCut network flows) (network.edges[index]!).source && !cutAt (residualCut network flows) (network.edges[index]!).target
      then (network.edges[index]!).capacity else 0 : Nat) : Int)) (by
      intro index bound
      have crossings := residualCut_crossing_edges network flows value valid feasible index bound
      cases source : cutAt (residualCut network flows) (network.edges[index]!).source <;>
        cases target : cutAt (residualCut network flows) (network.edges[index]!).target
      · simp
      · simp [crossings.2 source target]
      · simp [crossings.1 source target]
      · simp)
  rw [balance, sumInt_nat] at equal
  exact_mod_cast equal

end LeanDinic
