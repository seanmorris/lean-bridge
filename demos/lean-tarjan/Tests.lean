import Tarjan

namespace LeanTarjan.Tests

def empty : Input := ⟨0, #[0], #[]⟩
def isolated : Input := ⟨3, #[0, 0, 0, 0], #[]⟩
def linked : Input := ⟨5, #[0, 1, 3, 4, 5, 5], #[1, 0, 2, 3, 2]⟩
def cycle : Input := ⟨4, #[0, 1, 2, 3, 4], #[1, 2, 3, 0]⟩
def duplicates : Input := ⟨2, #[0, 3, 5], #[0, 1, 1, 0, 1]⟩

def observe (input : Input) : Option (Array Nat × Bool) :=
  (prepare input).map fun prepared =>
    let result := solvePrepared prepared
    (result.labels, result.usedFallback)

#guard observe empty = some (#[], false)
#guard observe isolated = some (#[0, 1, 2], false)
#guard observe linked = some (#[0, 0, 2, 2, 4], false)
#guard observe cycle = some (#[0, 0, 0, 0], false)
#guard observe duplicates = some (#[0, 0], false)
#guard (fallback linked).labels = #[0, 0, 2, 2, 4]
#guard (fallback cycle).labels = #[0, 0, 0, 0]
#guard (fallback empty).labels = #[]
#guard (prepare { linked with offsets := #[0, 5] }).isNone
#guard (prepare { linked with offsets := #[0, 3, 2, 4, 5, 5] }).isNone
#guard (prepare { linked with targets := #[1, 0, 5, 3, 2] }).isNone

-- A deliberately corrupted candidate must not be accepted.
def damaged : Candidate := ⟨#[0, 0, 0, 0, 0], #[0, 0, 0, 0, 0],
  buildForest 5 #[0, 0, 0, 0, 0] linked.offsets linked.targets #[] false,
  buildForest 5 #[0, 0, 0, 0, 0] linked.offsets linked.targets #[] false⟩
#guard !certificateCheck linked damaged
#guard (certify linked damaged).isNone

-- Even an incorrect reverse index in an internal prepared value cannot corrupt
-- the public result: the certificate rejects it and the total solver runs.
def wrongReverse : Option Prepared := (prepare linked).map fun prepared =>
  { prepared with reverse := ⟨#[0, 0, 0, 0, 0, 0], #[], #[]⟩ }
#guard wrongReverse.map (fun prepared => (solvePrepared prepared).usedFallback) = some true
#guard wrongReverse.map (fun prepared => (solvePrepared prepared).labels) = some #[0, 0, 2, 2, 4]

example (input : Input) (shape : shapeCheck input = true) :
    ∃ prepared, prepare input = some prepared ∧
      PartitionSpec input.count input.edge (solvePrepared prepared).labels :=
  solve_total input shape

example (prepared : Prepared) (u v : Nat) (hu : u < prepared.input.count)
    (hv : v < prepared.input.count) :
    (solveExport prepared)[u]? = (solveExport prepared)[v]? ↔
      Mutual prepared.input.count prepared.input.edge u v :=
  exported_same_iff prepared u v hu hv

#print axioms solve_total
#print axioms exported_same_iff
#print axioms condensation_acyclic

end LeanTarjan.Tests
