import Init

/-!
Generic directed flood fill and monotone capability closure.  This executable
module imports only Lean's small `Init` runtime so it can be linked into the
browser Wasm component.  `FloodFill.lean` proves the checked results correct.
-/

namespace LeanFloodFill

def arrayGet (values : Array α) (index : Nat) (fallback : α) : α :=
  values.getD index fallback

def csrAdjacentFrom (targets : Array Nat) (enabled : Array Bool) (stop target : Nat) :
    Nat → Nat → Bool
  | 0, _ => false
  | fuel + 1, index =>
      if stop ≤ index then false
      else if arrayGet enabled index false && arrayGet targets index 0 = target then true
      else csrAdjacentFrom targets enabled stop target fuel index.succ

def csrAdjacent (offsets targets : Array Nat) (enabled : Array Bool)
    (source target : Nat) : Bool :=
  let first := arrayGet offsets source 0
  let stop := arrayGet offsets source.succ 0
  csrAdjacentFrom targets enabled stop target (stop - first + 1) first

def CsrEdge (vertexCount : Nat) (offsets targets : Array Nat) (enabled : Array Bool)
    (source target : Nat) : Prop :=
  source < vertexCount ∧ target < vertexCount ∧
    csrAdjacent offsets targets enabled source target = true

instance csrEdgeDecidable (vertexCount : Nat) (offsets targets : Array Nat)
    (enabled : Array Bool) (source target : Nat) :
    Decidable (CsrEdge vertexCount offsets targets enabled source target) := by
  unfold CsrEdge
  infer_instance

def Walk (vertexCount : Nat) (offsets targets : Array Nat) (enabled : Array Bool)
    (allowed : Array Bool) (current target : Nat) : List Nat → Prop
  | [] => current = target
  | next :: rest =>
      CsrEdge vertexCount offsets targets enabled current next ∧
        arrayGet allowed next false = true ∧
        Walk vertexCount offsets targets enabled allowed next target rest

instance walkDecidable (vertexCount : Nat) (offsets targets : Array Nat)
    (enabled allowed : Array Bool) (current target : Nat) (path : List Nat) :
    Decidable (Walk vertexCount offsets targets enabled allowed current target path) :=
  match path with
  | [] => inferInstanceAs (Decidable (current = target))
  | next :: rest =>
      have _ : Decidable
          (Walk vertexCount offsets targets enabled allowed next target rest) :=
        walkDecidable vertexCount offsets targets enabled allowed next target rest
      instDecidableAnd

def Reachable (vertexCount : Nat) (offsets targets : Array Nat) (enabled allowed : Array Bool)
    (start target : Nat) : Prop :=
  start < vertexCount ∧ arrayGet allowed start false = true ∧
    ∃ path, Walk vertexCount offsets targets enabled allowed start target path

structure FloodState where
  visited : Array Bool
  parent : Array Nat
  rank : Array Nat
  queue : Array Nat
  head : Nat

private def scanNeighbors (vertexCount source : Nat) (targets enabled allowed : Array Nat)
    (stop : Nat) : Nat → Nat → FloodState → FloodState
  | 0, _, state => state
  | fuel + 1, index, state =>
      if stop ≤ index then state
      else
        let target := arrayGet targets index 0
        if arrayGet enabled index 0 != 0 && target < vertexCount &&
            arrayGet allowed target 0 != 0 && !arrayGet state.visited target true then
          scanNeighbors vertexCount source targets enabled allowed stop fuel index.succ {
            state with
            visited := state.visited.setIfInBounds target true
            parent := state.parent.setIfInBounds target source
            rank := state.rank.setIfInBounds target (arrayGet state.rank source 0 + 1)
            queue := state.queue.push target
          }
        else scanNeighbors vertexCount source targets enabled allowed stop fuel index.succ state

private def floodLoop (vertexCount : Nat) (offsets targets enabled allowed : Array Nat) :
    Nat → FloodState → FloodState
  | 0, state => state
  | fuel + 1, state =>
      if state.queue.size ≤ state.head then state
      else
        let source := arrayGet state.queue state.head vertexCount
        let first := arrayGet offsets source 0
        let stop := arrayGet offsets source.succ first
        let next := scanNeighbors vertexCount source targets enabled allowed stop
          (stop - first + 1) first { state with head := state.head + 1 }
        floodLoop vertexCount offsets targets enabled allowed fuel next

def floodRawCsr (vertexCount : Nat) (offsets targets enabled allowed : Array Nat)
    (start : Nat) : FloodState :=
  let permitted := start < vertexCount && arrayGet allowed start 0 != 0
  let visited := Array.replicate vertexCount false
  let initial : FloodState := {
    visited := if permitted then visited.setIfInBounds start true else visited
    parent := Array.replicate vertexCount vertexCount
    rank := Array.replicate vertexCount 0
    queue := if permitted then #[start] else #[]
    head := 0
  }
  floodLoop vertexCount offsets targets enabled allowed vertexCount initial

def natFlagsToBool (values : Array Nat) : Array Bool :=
  values.map fun value => value != 0

def parentCheck (vertexCount : Nat) (offsets targets : Array Nat) (enabled allowed : Array Bool)
    (start : Nat) (state : FloodState) : Bool :=
  (List.range vertexCount).all fun vertex =>
    if arrayGet state.visited vertex false then
      arrayGet allowed vertex false &&
        (if vertex = start then true
        else
          let parent := arrayGet state.parent vertex vertexCount
          parent < vertexCount && arrayGet state.visited parent false &&
            arrayGet state.rank parent 0 < arrayGet state.rank vertex 0 &&
            csrAdjacent offsets targets enabled parent vertex)
    else true

def closureFrom (vertexCount source : Nat) (targets : Array Nat) (enabled allowed visited : Array Bool)
    (stop : Nat) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, index =>
      if stop ≤ index then true
      else
        let target := arrayGet targets index 0
        ((!arrayGet enabled index false) || vertexCount ≤ target ||
          (!arrayGet allowed target false) || arrayGet visited target false) &&
          closureFrom vertexCount source targets enabled allowed visited stop fuel index.succ

def closureCheck (vertexCount : Nat) (offsets targets : Array Nat)
    (enabled allowed visited : Array Bool) : Bool :=
  (List.range vertexCount).all fun source =>
    if arrayGet visited source false then
      let first := arrayGet offsets source 0
      let stop := arrayGet offsets source.succ 0
      closureFrom vertexCount source targets enabled allowed visited stop
        (stop - first + 1) first
    else true

def FloodCertificate (vertexCount : Nat) (offsets targets : Array Nat)
    (enabled allowed : Array Bool) (start : Nat) (state : FloodState) : Prop :=
  state.visited.size = vertexCount ∧ state.parent.size = vertexCount ∧
    state.rank.size = vertexCount ∧ start < vertexCount ∧
    arrayGet allowed start false = true ∧ arrayGet state.visited start false = true ∧
    parentCheck vertexCount offsets targets enabled allowed start state = true ∧
    closureCheck vertexCount offsets targets enabled allowed state.visited = true

instance floodCertificateDecidable (vertexCount : Nat) (offsets targets : Array Nat)
    (enabled allowed : Array Bool) (start : Nat) (state : FloodState) :
    Decidable (FloodCertificate vertexCount offsets targets enabled allowed start state) := by
  unfold FloodCertificate
  infer_instance

def floodFillCsr (vertexCount : Nat) (offsets targets enabledFlags allowedFlags : Array Nat)
    (start : Nat) : Option FloodState :=
  let enabled := natFlagsToBool enabledFlags
  let allowed := natFlagsToBool allowedFlags
  let state := floodRawCsr vertexCount offsets targets enabledFlags allowedFlags start
  if FloodCertificate vertexCount offsets targets enabled allowed start state then some state else none

def visitedVertices (vertexCount : Nat) (state : FloodState) : Array Nat :=
  ((List.range vertexCount).filter fun vertex => arrayGet state.visited vertex false).toArray

def edgeFlagsForCapabilities (requirements : Array Nat) (capabilityCount : Nat)
    (capabilities : List Nat) : Array Nat :=
  requirements.map fun requirement =>
    if requirement = capabilityCount || requirement ∈ capabilities then 1 else 0

def discoverFrom (capabilityCount : Nat) (grants : Array Nat)
    (visited : Array Bool) : List Nat → List Nat → List Nat
  | [], capabilities => capabilities
  | vertex :: rest, capabilities =>
    let grant := arrayGet grants vertex capabilityCount
    let discovered := if arrayGet visited vertex false && grant < capabilityCount then
      capabilities.insert grant
    else capabilities
    discoverFrom capabilityCount grants visited rest discovered

def discoverCapabilities (vertexCount capabilityCount : Nat) (grants : Array Nat)
    (visited : Array Bool) (capabilities : List Nat) : List Nat :=
  discoverFrom capabilityCount grants visited (List.range vertexCount) capabilities

structure CapabilityResult where
  flood : FloodState
  capabilities : List Nat

def capabilityLoop (vertexCount capabilityCount : Nat) (offsets targets requirements
    allowedFlags grants : Array Nat) (start : Nat) : Nat → List Nat → Option CapabilityResult
  | 0, _ => none
  | fuel + 1, capabilities =>
      let edgeFlags := edgeFlagsForCapabilities requirements capabilityCount capabilities
      match floodFillCsr vertexCount offsets targets edgeFlags allowedFlags start with
      | none => none
      | some flood =>
          let discovered := discoverCapabilities vertexCount capabilityCount grants
            flood.visited capabilities
          if discovered = capabilities then some { flood, capabilities }
          else capabilityLoop vertexCount capabilityCount offsets targets requirements allowedFlags
            grants start fuel discovered

def capabilityClosureCsr (vertexCount capabilityCount : Nat) (offsets targets requirements
    allowedFlags grants initialCapabilities : Array Nat) (start : Nat) : Option CapabilityResult :=
  capabilityLoop vertexCount capabilityCount offsets targets requirements allowedFlags grants start
    (capabilityCount + 1) initialCapabilities.toList

private def validCsr (vertexCount : Nat) (offsets targets parallels : Array Nat) : Bool :=
  offsets.size = vertexCount + 1 && parallels.size = targets.size

@[export lean_flood_fill_solve_csr]
def solveCsr (vertexCount start : UInt32) (offsets targets enabled allowed : Array Nat) : Array Nat :=
  let count := vertexCount.toNat
  let source := start.toNat
  if validCsr count offsets targets enabled && allowed.size = count && source < count then
    match floodFillCsr count offsets targets enabled allowed source with
    | some state => visitedVertices count state
    | none => #[]
  else #[]

@[export lean_capability_closure_solve_csr]
def solveCapabilityCsr (vertexCount capabilityCount start : UInt32)
    (offsets targets requirements allowed grants initialCapabilities : Array Nat) : Array Nat :=
  let count := vertexCount.toNat
  let capabilityTotal := capabilityCount.toNat
  let source := start.toNat
  if validCsr count offsets targets requirements && allowed.size = count && grants.size = count &&
      source < count && initialCapabilities.all (fun capability => capability < capabilityTotal) then
    match capabilityClosureCsr count capabilityTotal offsets targets requirements allowed grants
      initialCapabilities source with
    | none => #[]
    | some result =>
        let vertices := visitedVertices count result.flood
        #[vertices.size] ++ vertices ++ result.capabilities.toArray
  else #[]

end LeanFloodFill
