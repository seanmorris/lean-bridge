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
  decide

example (path : List Nat)
    (found : dijkstraCsr 4 diamondOffsets diamondTargets diamondWeights 4 0 3 = some path) :
    ShortestPath (csrGraph 4 diamondOffsets diamondTargets diamondWeights) 0 3 path :=
  dijkstraCsr_correct 4 diamondOffsets diamondTargets diamondWeights 4 0 3 path found

example : costOfPath (fun _ _ => 1) 0 7 [8, 9, 10] = 3 := by decide

-- Exercise both sides of the allocation threshold and the full unsigned
-- 32-bit range. The final path cost can exceed the 32-bit input word width.
#guard dijkstraCsr 2 #[0, 1, 1] #[1] #[4095] 4095 0 1 = some [1]
#guard dijkstraCsr 2 #[0, 1, 1] #[1] #[4096] 4096 0 1 = some [1]
#guard dijkstraCsr 2 #[0, 1, 1] #[1] #[4294967295] 4294967295 0 1 = some [1]
#guard dijkstraCsr 3 #[0, 1, 2, 2] #[1, 2] #[4294967295, 4294967295]
  4294967295 0 2 = some [1, 2]
#guard csrPathCost? 3 #[0, 1, 2, 2] #[1, 2] #[4294967295, 4294967295]
  2 0 [1, 2] = some 8589934590
#guard dijkstraCsr 3 #[0, 2, 3, 3] #[1, 2, 2] #[4294967295, 4294967294, 1]
  4294967295 0 2 = some [2]
#guard dijkstraCsr 3 #[0, 1, 1, 1] #[1] #[4294967295] 4294967295 0 2 = none
#guard solveCsr 2 0 1 4294967295 #[0, 1, 1] #[1] #[4294967295] = #[0, 1]

#print axioms dijkstraRawCsr_large_uses_heap
#print axioms bucket_storage_bounded
#print axioms dijkstraCsr_correct

end LeanDijkstra.Tests
