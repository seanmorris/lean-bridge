import Std
import FloodFillCore

/-!
Correctness proofs for the exact CSR implementation exported by
`FloodFillCore.lean`.
-/

namespace LeanFloodFill

theorem walk_rcons (vertexCount : Nat) (offsets targets : Array Nat)
    (enabled allowed : Array Bool) (current target next : Nat) : ∀ path,
    Walk vertexCount offsets targets enabled allowed current target path →
    CsrEdge vertexCount offsets targets enabled target next →
    arrayGet allowed next false = true →
    Walk vertexCount offsets targets enabled allowed current next (path ++ [next]) := by
  intro path walk edge permitted
  induction path generalizing current with
  | nil =>
      simp only [Walk] at walk
      subst target
      exact ⟨edge, permitted, rfl⟩
  | cons vertex rest ih =>
      rcases walk with ⟨firstEdge, firstAllowed, tail⟩
      exact ⟨firstEdge, firstAllowed, ih vertex tail⟩

theorem closureFrom_adjacentFrom (vertexCount source : Nat) (targets : Array Nat)
    (enabled allowed visited : Array Bool) (stop target : Nat) : ∀ fuel index,
    csrAdjacentFrom targets enabled stop target fuel index = true →
    closureFrom vertexCount source targets enabled allowed visited stop fuel index = true →
    target < vertexCount → arrayGet allowed target false = true →
    arrayGet visited target false = true := by
  intro fuel index adjacent closed targetBound targetAllowed
  induction fuel generalizing index with
  | zero => simp [csrAdjacentFrom] at adjacent
  | succ fuel ih =>
      by_cases stopped : stop ≤ index
      · simp [csrAdjacentFrom, stopped] at adjacent
      · simp only [csrAdjacentFrom, closureFrom, if_neg stopped] at adjacent closed
        let candidate := arrayGet targets index 0
        by_cases found : arrayGet enabled index false && candidate = target
        · dsimp [candidate] at found
          simp [found] at adjacent
          have closedParts := closed
          simp only [Bool.and_eq_true] at closedParts
          have head := closedParts.1
          simp only [Bool.and_eq_true, decide_eq_true_eq] at found
          have enabledHere : arrayGet enabled index false = true := found.1
          have candidateEq : candidate = target := found.2
          dsimp [candidate] at candidateEq
          rw [candidateEq] at head
          simp [enabledHere, targetAllowed, Nat.not_le.mpr targetBound] at head
          exact head
        · dsimp [candidate] at found
          simp [found] at adjacent
          simp only [Bool.and_eq_true] at closed
          exact ih index.succ adjacent closed.2

theorem closureCheck_edge (vertexCount : Nat) (offsets targets : Array Nat)
    (enabled allowed visited : Array Bool)
    (checked : closureCheck vertexCount offsets targets enabled allowed visited = true)
    (source target : Nat) (sourceVisited : arrayGet visited source false = true)
    (edge : CsrEdge vertexCount offsets targets enabled source target)
    (targetAllowed : arrayGet allowed target false = true) :
    arrayGet visited target false = true := by
  rcases edge with ⟨sourceBound, targetBound, adjacent⟩
  have sourceMember : source ∈ List.range vertexCount := List.mem_range.mpr sourceBound
  have sourceCheck := (List.all_eq_true.mp checked) source sourceMember
  simp only [sourceVisited, if_true] at sourceCheck
  simp only [csrAdjacent] at adjacent
  exact closureFrom_adjacentFrom vertexCount source targets enabled allowed visited
    (arrayGet offsets source.succ 0) target
    (arrayGet offsets source.succ 0 - arrayGet offsets source 0 + 1)
    (arrayGet offsets source 0) adjacent sourceCheck targetBound targetAllowed

theorem parentCheck_reachable (vertexCount : Nat) (offsets targets : Array Nat)
    (enabled allowed : Array Bool) (start : Nat) (state : FloodState)
    (startBound : start < vertexCount)
    (startAllowed : arrayGet allowed start false = true)
    (checked : parentCheck vertexCount offsets targets enabled allowed start state = true) :
    ∀ vertex, vertex < vertexCount → arrayGet state.visited vertex false = true →
      Reachable vertexCount offsets targets enabled allowed start vertex := by
  intro vertex vertexBound vertexVisited
  generalize rankEq : arrayGet state.rank vertex 0 = rank
  induction rank using Nat.strongRecOn generalizing vertex with
  | ind rank ih =>
      have member : vertex ∈ List.range vertexCount := List.mem_range.mpr vertexBound
      have vertexCheck := (List.all_eq_true.mp checked) vertex member
      simp only [vertexVisited, if_true, Bool.and_eq_true] at vertexCheck
      rcases vertexCheck with ⟨vertexAllowed, parentPart⟩
      by_cases isStart : vertex = start
      · subst vertex
        exact ⟨startBound, startAllowed, [], rfl⟩
      · simp only [isStart, if_false] at parentPart
        let parent := arrayGet state.parent vertex vertexCount
        change (parent < vertexCount && arrayGet state.visited parent false &&
          arrayGet state.rank parent 0 < arrayGet state.rank vertex 0 &&
          csrAdjacent offsets targets enabled parent vertex) = true at parentPart
        simp only [Bool.and_eq_true, decide_eq_true_eq] at parentPart
        have parentBound := parentPart.1.1.1
        have parentVisited := parentPart.1.1.2
        have parentRank := parentPart.1.2
        have parentAdjacent := parentPart.2
        have parentReachable := ih (arrayGet state.rank parent 0) (by omega)
          parent parentBound parentVisited rfl
        rcases parentReachable with ⟨_, _, path, walk⟩
        refine ⟨startBound, startAllowed, path ++ [vertex], ?_⟩
        exact walk_rcons vertexCount offsets targets enabled allowed start parent vertex path walk
          ⟨parentBound, vertexBound, parentAdjacent⟩ vertexAllowed

theorem closureCheck_complete (vertexCount : Nat) (offsets targets : Array Nat)
    (enabled allowed visited : Array Bool)
    (checked : closureCheck vertexCount offsets targets enabled allowed visited = true) :
    ∀ current target path,
      arrayGet visited current false = true →
      Walk vertexCount offsets targets enabled allowed current target path →
      arrayGet visited target false = true := by
  intro current target path currentVisited walk
  induction path generalizing current with
  | nil =>
      simp only [Walk] at walk
      subst target
      exact currentVisited
  | cons next rest ih =>
      rcases walk with ⟨edge, nextAllowed, tail⟩
      have nextVisited := closureCheck_edge vertexCount offsets targets enabled allowed visited
        checked current next currentVisited edge nextAllowed
      exact ih next nextVisited tail

theorem floodCertificate_exact (vertexCount : Nat) (offsets targets : Array Nat)
    (enabled allowed : Array Bool) (start : Nat) (state : FloodState)
    (certificate : FloodCertificate vertexCount offsets targets enabled allowed start state) :
    ∀ vertex, vertex < vertexCount →
      (arrayGet state.visited vertex false = true ↔
        Reachable vertexCount offsets targets enabled allowed start vertex) := by
  intro vertex vertexBound
  constructor
  · intro visited
    exact parentCheck_reachable vertexCount offsets targets enabled allowed start state
      certificate.2.2.2.1 certificate.2.2.2.2.1 certificate.2.2.2.2.2.2.1
      vertex vertexBound visited
  · rintro ⟨_, _, path, walk⟩
    exact closureCheck_complete vertexCount offsets targets enabled allowed state.visited
      certificate.2.2.2.2.2.2.2 start vertex path certificate.2.2.2.2.2.1 walk

/-- The optimized CSR flood-fill result is exactly directed restricted reachability. -/
theorem floodFillCsr_correct (vertexCount : Nat) (offsets targets enabledFlags allowedFlags : Array Nat)
    (start : Nat) (state : FloodState)
    (found : floodFillCsr vertexCount offsets targets enabledFlags allowedFlags start = some state) :
    ∀ vertex, vertex < vertexCount →
      (arrayGet state.visited vertex false = true ↔
        Reachable vertexCount offsets targets (natFlagsToBool enabledFlags)
          (natFlagsToBool allowedFlags) start vertex) := by
  simp only [floodFillCsr] at found
  generalize rawEq : floodRawCsr vertexCount offsets targets enabledFlags allowedFlags start = raw at found
  split at found
  · rename_i certificate
    simp only [Option.some.injEq] at found
    subst state
    exact floodCertificate_exact vertexCount offsets targets (natFlagsToBool enabledFlags)
      (natFlagsToBool allowedFlags) start raw certificate
  · simp at found

def CapabilitiesSubset (left right : List Nat) : Prop :=
  ∀ capability, capability ∈ left → capability ∈ right

def capabilityEnabled (requirements : Array Nat) (capabilityCount : Nat)
    (capabilities : List Nat) : Array Bool :=
  natFlagsToBool (edgeFlagsForCapabilities requirements capabilityCount capabilities)

@[simp] theorem capabilityEnabled_size (requirements : Array Nat) (capabilityCount : Nat)
    (capabilities : List Nat) :
    (capabilityEnabled requirements capabilityCount capabilities).size = requirements.size := by
  simp [capabilityEnabled, natFlagsToBool, edgeFlagsForCapabilities]

theorem capabilityEnabled_get (requirements : Array Nat) (capabilityCount : Nat)
    (capabilities : List Nat) (index : Nat) :
    arrayGet (capabilityEnabled requirements capabilityCount capabilities) index false =
      if index < requirements.size then
        decide (arrayGet requirements index capabilityCount = capabilityCount ∨
          arrayGet requirements index capabilityCount ∈ capabilities)
      else false := by
  by_cases bound : index < requirements.size
  · simp only [capabilityEnabled, natFlagsToBool, edgeFlagsForCapabilities, arrayGet,
      Array.getD, Array.size_map, bound, dite_true]
    by_cases unrestricted : requirements[index] = capabilityCount <;>
      by_cases present : requirements[index] ∈ capabilities <;>
        simp [unrestricted, present] <;> exact bound
  · simp [capabilityEnabled, natFlagsToBool, edgeFlagsForCapabilities, arrayGet,
      Array.getD, bound]

theorem capabilityEnabled_mono (requirements : Array Nat) (capabilityCount : Nat)
    (left right : List Nat) (subset : CapabilitiesSubset left right) (index : Nat)
    (enabled : arrayGet (capabilityEnabled requirements capabilityCount left) index false = true) :
    arrayGet (capabilityEnabled requirements capabilityCount right) index false = true := by
  rw [capabilityEnabled_get] at enabled ⊢
  by_cases bound : index < requirements.size
  · simp only [bound, if_true, decide_eq_true_eq] at enabled ⊢
    rcases enabled with unrestricted | present
    · exact Or.inl unrestricted
    · exact Or.inr (subset _ present)
  · simp [bound] at enabled

theorem csrAdjacentFrom_mono (targets : Array Nat) (left right : Array Bool)
    (pointwise : ∀ index, arrayGet left index false = true →
      arrayGet right index false = true) (stop target : Nat) : ∀ fuel index,
    csrAdjacentFrom targets left stop target fuel index = true →
    csrAdjacentFrom targets right stop target fuel index = true := by
  intro fuel index adjacent
  induction fuel generalizing index with
  | zero => simp [csrAdjacentFrom] at adjacent
  | succ fuel ih =>
      by_cases stopped : stop ≤ index
      · simp [csrAdjacentFrom, stopped] at adjacent
      · simp only [csrAdjacentFrom, if_neg stopped] at adjacent ⊢
        by_cases found : arrayGet left index false && arrayGet targets index 0 = target
        · simp [found] at adjacent
          simp only [Bool.and_eq_true, decide_eq_true_eq] at found
          have rightEnabled := pointwise index found.1
          simp [rightEnabled, found.2]
        · simp [found] at adjacent
          by_cases rightFound : arrayGet right index false && arrayGet targets index 0 = target
          · simp [rightFound]
          · simp [rightFound, ih index.succ adjacent]

theorem csrEdge_mono (vertexCount : Nat) (offsets targets : Array Nat)
    (left right : Array Bool)
    (pointwise : ∀ index, arrayGet left index false = true →
      arrayGet right index false = true)
    (source target : Nat)
    (edge : CsrEdge vertexCount offsets targets left source target) :
    CsrEdge vertexCount offsets targets right source target := by
  rcases edge with ⟨sourceBound, targetBound, adjacent⟩
  refine ⟨sourceBound, targetBound, ?_⟩
  simp only [csrAdjacent] at adjacent ⊢
  exact csrAdjacentFrom_mono targets left right pointwise
    (arrayGet offsets source.succ 0) target
    (arrayGet offsets source.succ 0 - arrayGet offsets source 0 + 1)
    (arrayGet offsets source 0) adjacent

theorem walk_mono (vertexCount : Nat) (offsets targets : Array Nat)
    (left right allowed : Array Bool)
    (pointwise : ∀ index, arrayGet left index false = true →
      arrayGet right index false = true) : ∀ current target path,
    Walk vertexCount offsets targets left allowed current target path →
    Walk vertexCount offsets targets right allowed current target path := by
  intro current target path walk
  induction path generalizing current with
  | nil => exact walk
  | cons next rest ih =>
      rcases walk with ⟨edge, permitted, tail⟩
      exact ⟨csrEdge_mono vertexCount offsets targets left right pointwise current next edge,
        permitted, ih next tail⟩

theorem reachable_capabilities_mono (vertexCount capabilityCount : Nat)
    (offsets targets requirements allowedFlags : Array Nat) (start target : Nat)
    (left right : List Nat) (subset : CapabilitiesSubset left right)
    (reachable : Reachable vertexCount offsets targets
      (capabilityEnabled requirements capabilityCount left)
      (natFlagsToBool allowedFlags) start target) :
    Reachable vertexCount offsets targets
      (capabilityEnabled requirements capabilityCount right)
      (natFlagsToBool allowedFlags) start target := by
  rcases reachable with ⟨startBound, startAllowed, path, walk⟩
  refine ⟨startBound, startAllowed, path, ?_⟩
  exact walk_mono vertexCount offsets targets
    (capabilityEnabled requirements capabilityCount left)
    (capabilityEnabled requirements capabilityCount right)
    (natFlagsToBool allowedFlags)
    (capabilityEnabled_mono requirements capabilityCount left right subset) start target path walk

def CapabilityClosed (vertexCount capabilityCount : Nat) (offsets targets requirements
    allowedFlags grants : Array Nat) (start : Nat) (capabilities : List Nat) : Prop :=
  ∀ vertex, vertex < vertexCount →
    Reachable vertexCount offsets targets
      (capabilityEnabled requirements capabilityCount capabilities)
      (natFlagsToBool allowedFlags) start vertex →
    arrayGet grants vertex capabilityCount < capabilityCount →
    arrayGet grants vertex capabilityCount ∈ capabilities

theorem capabilitiesSubset_refl (capabilities : List Nat) :
    CapabilitiesSubset capabilities capabilities := by
  intro capability member
  exact member

theorem capabilitiesSubset_trans {first second third : List Nat}
    (firstSecond : CapabilitiesSubset first second)
    (secondThird : CapabilitiesSubset second third) :
    CapabilitiesSubset first third := by
  intro capability member
  exact secondThird capability (firstSecond capability member)

theorem discoverFrom_extends (capabilityCount : Nat) (grants : Array Nat)
    (visited : Array Bool) : ∀ vertices capabilities,
    CapabilitiesSubset capabilities
      (discoverFrom capabilityCount grants visited vertices capabilities) := by
  intro vertices capabilities
  induction vertices generalizing capabilities with
  | nil => exact capabilitiesSubset_refl capabilities
  | cons vertex rest ih =>
      simp only [discoverFrom]
      let grant := arrayGet grants vertex capabilityCount
      by_cases discovered : arrayGet visited vertex false && grant < capabilityCount
      · dsimp [grant] at discovered
        simp [discovered]
        exact capabilitiesSubset_trans
          (fun capability member => List.mem_insert_of_mem member)
          (ih (capabilities.insert grant))
      · dsimp [grant] at discovered
        simp [discovered]
        exact ih capabilities

theorem discoverCapabilities_extends (vertexCount capabilityCount : Nat)
    (grants : Array Nat) (visited : Array Bool) (capabilities : List Nat) :
    CapabilitiesSubset capabilities
      (discoverCapabilities vertexCount capabilityCount grants visited capabilities) :=
  discoverFrom_extends capabilityCount grants visited (List.range vertexCount) capabilities

theorem discoverFrom_subset (capabilityCount : Nat) (grants : Array Nat)
    (visited : Array Bool) (candidate : List Nat) : ∀ vertices capabilities,
    CapabilitiesSubset capabilities candidate →
    (∀ vertex, vertex ∈ vertices → arrayGet visited vertex false = true →
      arrayGet grants vertex capabilityCount < capabilityCount →
      arrayGet grants vertex capabilityCount ∈ candidate) →
    CapabilitiesSubset (discoverFrom capabilityCount grants visited vertices capabilities)
      candidate := by
  intro vertices capabilities subset grantsIncluded
  induction vertices generalizing capabilities with
  | nil => exact subset
  | cons vertex rest ih =>
      simp only [discoverFrom]
      let grant := arrayGet grants vertex capabilityCount
      by_cases discovered : arrayGet visited vertex false && grant < capabilityCount
      · dsimp [grant] at discovered
        simp [discovered]
        simp only [Bool.and_eq_true, decide_eq_true_eq] at discovered
        have grantIncluded : grant ∈ candidate := grantsIncluded vertex (by simp)
          discovered.1 discovered.2
        apply ih (capabilities.insert grant)
        · intro capability member
          rw [List.mem_insert_iff] at member
          rcases member with equal | previous
          · subst capability
            exact grantIncluded
          · exact subset capability previous
        · intro next nextMember
          exact grantsIncluded next (by simp [nextMember])
      · dsimp [grant] at discovered
        simp [discovered]
        apply ih capabilities subset
        intro next nextMember
        exact grantsIncluded next (by simp [nextMember])

theorem discoverFrom_contains (capabilityCount : Nat) (grants : Array Nat)
    (visited : Array Bool) : ∀ vertices capabilities vertex,
    vertex ∈ vertices → arrayGet visited vertex false = true →
    arrayGet grants vertex capabilityCount < capabilityCount →
    arrayGet grants vertex capabilityCount ∈
      discoverFrom capabilityCount grants visited vertices capabilities := by
  intro vertices capabilities vertex member visitedVertex validGrant
  induction vertices generalizing capabilities with
  | nil => simp at member
  | cons current rest ih =>
      simp only [discoverFrom]
      let grant := arrayGet grants current capabilityCount
      by_cases discovered : arrayGet visited current false && grant < capabilityCount
      · dsimp [grant] at discovered
        simp [discovered]
        by_cases same : current = vertex
        · subst current
          exact discoverFrom_extends capabilityCount grants visited rest
            (capabilities.insert (arrayGet grants vertex capabilityCount)) _
            List.mem_insert_self
        · exact ih (capabilities.insert grant) (by simpa [Ne.symm same] using member)
      · dsimp [grant] at discovered
        simp [discovered]
        have notCurrent : current ≠ vertex := by
          intro equal
          subst current
          apply discovered
          simp [visitedVertex, validGrant]
        exact ih capabilities (by simpa [Ne.symm notCurrent] using member)

theorem discoverCapabilities_contains (vertexCount capabilityCount : Nat)
    (grants : Array Nat) (visited : Array Bool) (capabilities : List Nat)
    (vertex : Nat) (vertexBound : vertex < vertexCount)
    (visitedVertex : arrayGet visited vertex false = true)
    (validGrant : arrayGet grants vertex capabilityCount < capabilityCount) :
    arrayGet grants vertex capabilityCount ∈
      discoverCapabilities vertexCount capabilityCount grants visited capabilities := by
  exact discoverFrom_contains capabilityCount grants visited (List.range vertexCount)
    capabilities vertex (List.mem_range.mpr vertexBound) visitedVertex validGrant

def LeastCapabilityClosure (vertexCount capabilityCount : Nat) (offsets targets requirements
    allowedFlags grants : Array Nat) (start : Nat) (initial final : List Nat) : Prop :=
  CapabilitiesSubset initial final ∧
    CapabilityClosed vertexCount capabilityCount offsets targets requirements allowedFlags grants
      start final ∧
    ∀ candidate, CapabilitiesSubset initial candidate →
      CapabilityClosed vertexCount capabilityCount offsets targets requirements allowedFlags grants
        start candidate → CapabilitiesSubset final candidate

theorem discoverCapabilities_subset_closed (vertexCount capabilityCount : Nat)
    (offsets targets requirements allowedFlags grants : Array Nat) (start : Nat)
    (current candidate : List Nat) (subset : CapabilitiesSubset current candidate)
    (closed : CapabilityClosed vertexCount capabilityCount offsets targets requirements
      allowedFlags grants start candidate) (flood : FloodState)
    (found : floodFillCsr vertexCount offsets targets
      (edgeFlagsForCapabilities requirements capabilityCount current) allowedFlags start = some flood) :
    CapabilitiesSubset
      (discoverCapabilities vertexCount capabilityCount grants flood.visited current) candidate := by
  apply discoverFrom_subset capabilityCount grants flood.visited candidate
    (List.range vertexCount) current subset
  intro vertex member visited validGrant
  have vertexBound := List.mem_range.mp member
  have reachableCurrent : Reachable vertexCount offsets targets
      (capabilityEnabled requirements capabilityCount current)
      (natFlagsToBool allowedFlags) start vertex := by
    simpa [capabilityEnabled] using
      (floodFillCsr_correct vertexCount offsets targets
        (edgeFlagsForCapabilities requirements capabilityCount current) allowedFlags start flood found
        vertex vertexBound).mp visited
  have reachableCandidate := reachable_capabilities_mono vertexCount capabilityCount offsets targets
    requirements allowedFlags start vertex current candidate subset reachableCurrent
  exact closed vertex vertexBound reachableCandidate validGrant

theorem capabilityLoop_extends (vertexCount capabilityCount : Nat)
    (offsets targets requirements allowedFlags grants : Array Nat) (start : Nat) :
    ∀ fuel initial result,
    capabilityLoop vertexCount capabilityCount offsets targets requirements allowedFlags grants
      start fuel initial = some result →
    CapabilitiesSubset initial result.capabilities := by
  intro fuel initial result found
  induction fuel generalizing initial result with
  | zero => simp [capabilityLoop] at found
  | succ fuel ih =>
      simp only [capabilityLoop] at found
      let edgeFlags := edgeFlagsForCapabilities requirements capabilityCount initial
      cases floodEq : floodFillCsr vertexCount offsets targets edgeFlags allowedFlags start with
      | none => simp [edgeFlags, floodEq] at found
      | some flood =>
          simp only [edgeFlags, floodEq] at found
          let discovered := discoverCapabilities vertexCount capabilityCount grants flood.visited initial
          split at found
          · simp only [Option.some.injEq] at found
            subst result
            exact capabilitiesSubset_refl initial
          · exact capabilitiesSubset_trans
              (discoverCapabilities_extends vertexCount capabilityCount grants flood.visited initial)
              (ih discovered result found)

theorem capabilityLoop_closed (vertexCount capabilityCount : Nat)
    (offsets targets requirements allowedFlags grants : Array Nat) (start : Nat) :
    ∀ fuel initial result,
    capabilityLoop vertexCount capabilityCount offsets targets requirements allowedFlags grants
      start fuel initial = some result →
    CapabilityClosed vertexCount capabilityCount offsets targets requirements allowedFlags grants
      start result.capabilities := by
  intro fuel initial result found
  induction fuel generalizing initial result with
  | zero => simp [capabilityLoop] at found
  | succ fuel ih =>
      simp only [capabilityLoop] at found
      let edgeFlags := edgeFlagsForCapabilities requirements capabilityCount initial
      cases floodEq : floodFillCsr vertexCount offsets targets edgeFlags allowedFlags start with
      | none => simp [edgeFlags, floodEq] at found
      | some flood =>
          simp only [edgeFlags, floodEq] at found
          let discovered := discoverCapabilities vertexCount capabilityCount grants flood.visited initial
          split at found
          · rename_i stable
            simp only [Option.some.injEq] at found
            subst result
            intro vertex vertexBound reachable validGrant
            have visited := (floodFillCsr_correct vertexCount offsets targets edgeFlags allowedFlags
              start flood floodEq vertex vertexBound).mpr (by
                simpa [capabilityEnabled, edgeFlags] using reachable)
            have granted := discoverCapabilities_contains vertexCount capabilityCount grants
              flood.visited initial vertex vertexBound visited validGrant
            simpa [discovered, stable] using granted
          · exact ih discovered result found

theorem capabilityLoop_least (vertexCount capabilityCount : Nat)
    (offsets targets requirements allowedFlags grants : Array Nat) (start : Nat)
    (candidate : List Nat)
    (candidateClosed : CapabilityClosed vertexCount capabilityCount offsets targets
      requirements allowedFlags grants start candidate) : ∀ fuel initial result,
    CapabilitiesSubset initial candidate →
    capabilityLoop vertexCount capabilityCount offsets targets requirements allowedFlags grants
      start fuel initial = some result →
    CapabilitiesSubset result.capabilities candidate := by
  intro fuel initial result initialSubset found
  induction fuel generalizing initial result with
  | zero => simp [capabilityLoop] at found
  | succ fuel ih =>
      simp only [capabilityLoop] at found
      let edgeFlags := edgeFlagsForCapabilities requirements capabilityCount initial
      cases floodEq : floodFillCsr vertexCount offsets targets edgeFlags allowedFlags start with
      | none => simp [edgeFlags, floodEq] at found
      | some flood =>
          simp only [edgeFlags, floodEq] at found
          let discovered := discoverCapabilities vertexCount capabilityCount grants flood.visited initial
          split at found
          · simp only [Option.some.injEq] at found
            subst result
            exact initialSubset
          · have discoveredSubset := discoverCapabilities_subset_closed vertexCount capabilityCount
              offsets targets requirements allowedFlags grants start initial candidate initialSubset
              candidateClosed flood (by simpa [edgeFlags] using floodEq)
            exact ih discovered result discoveredSubset found

/-!
The capability loop exposes its fixed-point result only after every newly
reachable grant has stabilized.  The theorem below is intentionally stated on
that exact optimized operation; helper lemmas establish the least-fixed-point
property in the remainder of this module.
-/

theorem capabilityLoop_reachable (vertexCount capabilityCount : Nat)
    (offsets targets requirements allowedFlags grants : Array Nat)
    (start : Nat) : ∀ fuel capabilities result,
    capabilityLoop vertexCount capabilityCount offsets targets requirements
      allowedFlags grants start fuel capabilities = some result →
    ∀ vertex, vertex < vertexCount →
      (arrayGet result.flood.visited vertex false = true ↔
        Reachable vertexCount offsets targets
          (capabilityEnabled requirements capabilityCount result.capabilities)
          (natFlagsToBool allowedFlags) start vertex) := by
  intro fuel capabilities result found
  induction fuel generalizing capabilities result with
  | zero => simp [capabilityLoop] at found
  | succ fuel ih =>
      simp only [capabilityLoop] at found
      generalize edgeEq : edgeFlagsForCapabilities requirements capabilityCount
        capabilities = edgeFlags at found
      cases floodEq : floodFillCsr vertexCount offsets targets edgeFlags allowedFlags start with
      | none => simp [floodEq] at found
      | some flood =>
          simp only [floodEq] at found
          generalize discoveredEq : discoverCapabilities vertexCount capabilityCount grants
            flood.visited capabilities = discovered at found
          split at found
          · rename_i stable
            simp only [Option.some.injEq] at found
            subst result
            subst discovered
            simpa [capabilityEnabled, edgeEq] using
              floodFillCsr_correct vertexCount offsets targets edgeFlags allowedFlags start flood
                floodEq
          · exact ih discovered result found

theorem capabilityClosureCsr_reachable (vertexCount capabilityCount : Nat)
    (offsets targets requirements allowedFlags grants initialCapabilities : Array Nat)
    (start : Nat) (result : CapabilityResult)
    (found : capabilityClosureCsr vertexCount capabilityCount offsets targets requirements
      allowedFlags grants initialCapabilities start = some result) :
    ∀ vertex, vertex < vertexCount →
      (arrayGet result.flood.visited vertex false = true ↔
        Reachable vertexCount offsets targets
          (capabilityEnabled requirements capabilityCount result.capabilities)
          (natFlagsToBool allowedFlags) start vertex) := by
  exact capabilityLoop_reachable vertexCount capabilityCount offsets targets requirements
    allowedFlags grants start (capabilityCount + 1) initialCapabilities.toList result found

theorem capabilityClosureCsr_least (vertexCount capabilityCount : Nat)
    (offsets targets requirements allowedFlags grants initialCapabilities : Array Nat)
    (start : Nat) (result : CapabilityResult)
    (found : capabilityClosureCsr vertexCount capabilityCount offsets targets requirements
      allowedFlags grants initialCapabilities start = some result) :
    LeastCapabilityClosure vertexCount capabilityCount offsets targets requirements allowedFlags
      grants start initialCapabilities.toList result.capabilities := by
  refine ⟨?_, ?_, ?_⟩
  · exact capabilityLoop_extends vertexCount capabilityCount offsets targets requirements
      allowedFlags grants start (capabilityCount + 1) initialCapabilities.toList result found
  · exact capabilityLoop_closed vertexCount capabilityCount offsets targets requirements
      allowedFlags grants start (capabilityCount + 1) initialCapabilities.toList result found
  · intro candidate initialSubset candidateClosed
    exact capabilityLoop_least vertexCount capabilityCount offsets targets requirements
      allowedFlags grants start candidate candidateClosed (capabilityCount + 1)
      initialCapabilities.toList result initialSubset found

/-- The optimized capability result is exact and is the least stable capability closure. -/
theorem capabilityClosureCsr_correct (vertexCount capabilityCount : Nat)
    (offsets targets requirements allowedFlags grants initialCapabilities : Array Nat)
    (start : Nat) (result : CapabilityResult)
    (found : capabilityClosureCsr vertexCount capabilityCount offsets targets requirements
      allowedFlags grants initialCapabilities start = some result) :
    (∀ vertex, vertex < vertexCount →
      (arrayGet result.flood.visited vertex false = true ↔
        Reachable vertexCount offsets targets
          (capabilityEnabled requirements capabilityCount result.capabilities)
          (natFlagsToBool allowedFlags) start vertex)) ∧
    LeastCapabilityClosure vertexCount capabilityCount offsets targets requirements allowedFlags
      grants start initialCapabilities.toList result.capabilities := by
  exact ⟨capabilityClosureCsr_reachable vertexCount capabilityCount offsets targets requirements
      allowedFlags grants initialCapabilities start result found,
    capabilityClosureCsr_least vertexCount capabilityCount offsets targets requirements
      allowedFlags grants initialCapabilities start result found⟩

end LeanFloodFill
