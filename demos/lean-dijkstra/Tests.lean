import Dijkstra

namespace LeanDijkstra.Tests

open LeanDijkstra

def weightedDiamond : Graph where
  size := 4
  outgoing := fun
    | 0 => [{ target := 1, weight := 4 }, { target := 2, weight := 1 }]
    | 1 => [{ target := 3, weight := 1 }]
    | 2 => [{ target := 3, weight := 1 }]
    | _ => []

example : dijkstra weightedDiamond 0 3 = some [2, 3] := by decide

example (path : List Nat) (found : dijkstra weightedDiamond 0 3 = some path) :
    ShortestPath weightedDiamond 0 3 path :=
  dijkstra_correct weightedDiamond 0 3 path found

def diamondOffsets : Array Nat := #[0, 2, 3, 4, 4]
def diamondTargets : Array Nat := #[1, 2, 3, 3]
def diamondWeights : Array Nat := #[4, 1, 1, 1]

example : dijkstraCsr 4 diamondOffsets diamondTargets diamondWeights 4 0 3 = some [2, 3] := by
  native_decide

example (path : List Nat)
    (found : dijkstraCsr 4 diamondOffsets diamondTargets diamondWeights 4 0 3 = some path) :
    ShortestPath (csrGraph 4 diamondOffsets diamondTargets diamondWeights) 0 3 path :=
  dijkstraCsr_correct 4 diamondOffsets diamondTargets diamondWeights 4 0 3 path found

example : costOfPath (fun _ _ => 1) 0 7 [8, 9, 10] = 3 := by decide

end LeanDijkstra.Tests
