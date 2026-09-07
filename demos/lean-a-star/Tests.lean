import AStar

open LeanAStar LeanDijkstra

namespace LeanAStar.Tests

def diamond : Input :=
  ⟨4, 0, 3, #[0, 2, 3, 4, 4], #[1, 2, 3, 3], #[4, 1, 1, 1], #[2, 1, 1, 0]⟩

def disconnected : Input :=
  ⟨4, 0, 3, #[0, 1, 1, 2, 2], #[1, 3], #[1, 1], #[0, 0, 0, 0]⟩

def zeroCycle : Input :=
  ⟨3, 0, 2, #[0, 1, 3, 3], #[1, 0, 2], #[0, 0, 0], #[0, 0, 0]⟩

def sameGoal : Input :=
  ⟨3, 1, 1, #[0, 0, 0, 0], #[], #[], #[0, 0, 0]⟩

def noEdges : Input :=
  ⟨2, 0, 1, #[0, 0, 0], #[], #[], #[0, 0]⟩

/-- Observe the public prepared solver without discarding the certified
unreachable result or its distinction from rejected input. -/
def observe (input : Input) : Option (Option (List Nat) × Nat × Bool) :=
  (prepare input).map fun prepared =>
    let result := solvePrepared prepared
    (result.answer, result.cost, result.usedFallback)

#guard observe diamond = some (some [2, 3], 2, false)
#guard observe disconnected = some (none, 0, false)
#guard observe zeroCycle = some (some [1, 2], 0, false)
#guard observe sameGoal = some (some [], 0, false)
#guard observe noEdges = some (none, 0, false)

def diamondPrepared : Prepared :=
  ⟨diamond, by decide, by simp [shapeCheck, diamond, allUpTo, arrayGet, Array.getD], by decide⟩
def disconnectedPrepared : Prepared :=
  ⟨disconnected, by decide, by simp [shapeCheck, disconnected, allUpTo, arrayGet, Array.getD], by decide⟩
def sameGoalPrepared : Prepared :=
  ⟨sameGoal, by decide, by simp [shapeCheck, sameGoal, allUpTo, arrayGet, Array.getD], by decide⟩

-- The internal path excludes its source; the wire path includes it exactly once.
#guard solveExport diamondPrepared = #[0, 2, 0, 3, 3, 0, 2, 3, 0, 2, 3]
#guard solveExport sameGoalPrepared = #[0, 0, 0, 1, 1, 1, 1]
#guard (solveExport disconnectedPrepared)[0]? = some 1
#guard (solveExport disconnectedPrepared)[3]? = some 0

-- Malformed CSR, vertex bounds, and inconsistent or nonzero goal estimates fail preparation.
#guard (prepare { diamond with offsets := #[0, 2] }).isNone
#guard (prepare { diamond with offsets := #[0, 3, 2, 4, 4] }).isNone
#guard (prepare { diamond with targets := #[1, 4, 3, 3] }).isNone
#guard (prepare { diamond with weights := #[4, 1, 1] }).isNone
#guard (prepare { diamond with heuristic := #[2, 1, 1] }).isNone
#guard (prepare { diamond with start := 4 }).isNone
#guard (prepare { diamond with target := 4 }).isNone
#guard (prepare { diamond with heuristic := #[3, 1, 1, 0] }).isNone
#guard (prepare { diamond with heuristic := #[2, 1, 1, 1] }).isNone
#guard (prepare ⟨0, 0, 0, #[0], #[], #[], #[]⟩).isNone

-- A stale distance must not expand its vertex. This queue contains only a stale entry.
def staleFrontier : Frontier :=
  ⟨#[⟨1, 99, 100⟩], ⟨#[0, 4, 1, 2], #[4, 0, 0, 2], #[true, false, false, false], #[0]⟩⟩
#guard (searchLoop diamond 100 1 staleFrontier).expanded = #[0]
#guard (searchLoop diamond 100 1 staleFrontier).distance = staleFrontier.state.distance
#guard (searchLoop diamond 100 1 staleFrontier).closed = staleFrontier.state.closed

-- The generic Lean model selects the first parallel edge. A cheaper duplicate
-- can invalidate the heap candidate; the total fallback still returns that model's optimum.
def parallelEdges : Input :=
  ⟨3, 0, 2, #[0, 2, 3, 3], #[1, 1, 2], #[5, 1, 1], #[0, 0, 0]⟩
#guard observe parallelEdges = some (some [1, 2], 6, true)
#guard (fallback diamondPrepared #[]).answer = some [2, 3]
#guard (fallback diamondPrepared #[]).cost = 2
#guard (fallback disconnectedPrepared #[]).answer = none

example (prepared : Prepared) (path : List Nat)
    (found : (solvePrepared prepared).answer = some path) :
    ShortestPath prepared.input.graph prepared.input.start prepared.input.target path :=
  solve_path_shortest prepared path found

example (prepared : Prepared) (missing : (solvePrepared prepared).answer = none) :
    ∀ path, ¬Walk prepared.input.graph prepared.input.start prepared.input.target path :=
  solve_unreachable prepared missing

example (prepared : Prepared) :
    ResultValid prepared.input (solvePrepared prepared).answer (solvePrepared prepared).cost :=
  solve_prepared_correct prepared

example (input : Input)
    (bounds : input.start < input.count ∧ input.target < input.count)
    (shape : shapeCheck input = true) (heuristic : heuristicCheck input = true) :
    ∃ prepared, prepare input = some prepared ∧
      ResultValid input (solvePrepared prepared).answer (solvePrepared prepared).cost :=
  solve_total input bounds shape heuristic

#check solve_total
#check solve_path_shortest
#check solve_unreachable
#check exported_search_correct
#check exported_total_correct
#check prepareExport_valid_iff
#check solveExport_no_failure
#check solveExport_unreachable_iff
#check serialize_path_starts_at_source
#check consistent_admissible
#check reduced_shortest_iff
#print axioms solve_total
#print axioms exported_search_correct
#print axioms heuristicCheck_sound
#print axioms labelsCheck_sound
#print axioms cutCheck_sound
#print axioms solveExport_no_failure
#print axioms solveExport_unreachable_iff

end LeanAStar.Tests
