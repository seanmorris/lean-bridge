import FloodFill

namespace LeanFloodFill.Tests

open LeanFloodFill

def chainOffsets : Array Nat := #[0, 1, 2, 3, 3]
def chainTargets : Array Nat := #[1, 2, 3]
def allEdges : Array Nat := #[1, 1, 1]
def allVertices : Array Nat := #[1, 1, 1, 1]

def chainVertices : Array Nat :=
  match floodFillCsr 4 chainOffsets chainTargets allEdges allVertices 0 with
  | some state => visitedVertices 4 state
  | none => #[]

example : chainVertices = #[0, 1, 2, 3] := by native_decide

def ledgeEdges : Array Nat := #[1, 0, 1]

def ledgeVertices : Array Nat :=
  match floodFillCsr 4 chainOffsets chainTargets ledgeEdges allVertices 0 with
  | some state => visitedVertices 4 state
  | none => #[]

example : ledgeVertices = #[0, 1] := by native_decide

example (state : FloodState)
    (found : floodFillCsr 4 chainOffsets chainTargets allEdges allVertices 0 = some state) :
    ∀ vertex, vertex < 4 →
      (arrayGet state.visited vertex false = true ↔
        Reachable 4 chainOffsets chainTargets (natFlagsToBool allEdges)
          (natFlagsToBool allVertices) 0 vertex) :=
  floodFillCsr_correct 4 chainOffsets chainTargets allEdges allVertices 0 state found

def chainRequirements : Array Nat := #[2, 0, 1]
def chainGrants : Array Nat := #[2, 0, 1, 2]

def capabilityResult : Option CapabilityResult :=
  capabilityClosureCsr 4 2 chainOffsets chainTargets chainRequirements allVertices
    chainGrants #[] 0

def capabilityVertices : Array Nat :=
  match capabilityResult with
  | some result => visitedVertices 4 result.flood
  | none => #[]

def capabilityKeys : List Nat :=
  match capabilityResult with
  | some result => result.capabilities
  | none => []

example : capabilityVertices = #[0, 1, 2, 3] := by native_decide
example : 0 ∈ capabilityKeys ∧ 1 ∈ capabilityKeys := by native_decide

example (result : CapabilityResult) (found : capabilityResult = some result) :
    LeastCapabilityClosure 4 2 chainOffsets chainTargets chainRequirements allVertices
      chainGrants 0 [] result.capabilities := by
  exact (capabilityClosureCsr_correct 4 2 chainOffsets chainTargets chainRequirements
    allVertices chainGrants #[] 0 result found).2

end LeanFloodFill.Tests
