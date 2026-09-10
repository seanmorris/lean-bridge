import AStarCore
import AStarChecks
import AStarTotal

namespace LeanAStar
open LeanDijkstra

def ResultValid (input : Input) (answer : Option (List Nat)) (cost : Nat) : Prop :=
  match answer with
  | some path => ShortestPath input.graph input.start input.target path ∧
      pathCost input.graph input.start path = cost
  | none => (∀ path, ¬Walk input.graph input.start input.target path) ∧ cost = 0

structure CertifiedResult (input : Input) where
  answer : Option (List Nat)
  cost : Nat
  expanded : Array Nat
  usedFallback : Bool
  valid : ResultValid input answer cost

/-- Certify the actual early-exit heap result using heuristic-capped labels,
or certify exhaustion using a closed reachable set. -/
def certify (prepared : Prepared) (state : State) : Option (CertifiedResult prepared.input) :=
  let input := prepared.input
  match reconstruct state.previous input.start input.count
      (input.count + 1) input.target [] with
  | some path =>
      let cost := arrayGet state.distance input.target 0
      if checked : labelsCheck input state cost = true ∧
          csrPathCost? input.count input.offsets input.targets input.weights
            input.target input.start path = some cost then
        have goal := heuristicCheck_sound input prepared.heuristicValid
        have feasible := labelsCheck_sound input state cost goal.1 checked.1
        have pathValid := csrPathCost_sound input.count input.offsets input.targets
          input.weights input.target input.start path cost checked.2
        have exactCost : pathCost input.graph input.start path =
            labels input state cost input.target := by
          calc
            pathCost input.graph input.start path = cost := pathValid.2
            _ = labels input state cost input.target := by simp [labels, cost, goal.2]
        some ⟨some path, cost, state.expanded, false,
          certificate_shortest input.graph (labels input state cost) input.start input.target
            path feasible pathValid.1 exactCost, pathValid.2⟩
      else none
  | none =>
      if checked : cutCheck input state.closed = true then
        some ⟨none, 0, state.expanded, false, cutCheck_sound input state.closed checked, rfl⟩
      else none

def fallback (prepared : Prepared) (expanded : Array Nat) : CertifiedResult prepared.input :=
  let input := prepared.input
  let answer := Total.totalShortest input.graph input.start input.target prepared.bounds
  match found : answer.val with
  | some path =>
      ⟨some path, pathCost input.graph input.start path, expanded, true,
        by simpa [Total.AnswerValid, found] using answer.property, rfl⟩
  | none =>
      ⟨none, 0, expanded, true,
        by simpa [Total.AnswerValid, found] using answer.property, rfl⟩

def solvePrepared (prepared : Prepared) : CertifiedResult prepared.input :=
  let state := searchPrepared prepared
  match certify prepared state with
  | some result => result
  | none => fallback prepared state.expanded

/-- Wire format: tag, cost, fallback flag, path length, expansion length,
then the path (including its source), then the expansion trace. -/
def serialize (input : Input) (result : CertifiedResult input) : Array Nat :=
  let path := match result.answer with
    | some path => (input.start :: path).toArray
    | none => #[]
  #[if result.answer.isSome then 0 else 1, result.cost,
    if result.usedFallback then 1 else 0, path.size, result.expanded.size] ++
    path ++ result.expanded

@[export lean_astar_prepare]
def prepareExport (count start target : UInt32)
    (offsets targets weights heuristic : Array Nat) : Option Prepared :=
  prepare ⟨count.toNat, start.toNat, target.toNat, offsets, targets, weights, heuristic⟩

@[export lean_astar_solve]
def solveExport (prepared : Prepared) : Array Nat :=
  serialize prepared.input (solvePrepared prepared)

@[export lean_astar_solve_total]
def solveTotalExport (prepared : Prepared) : Array Nat :=
  serialize prepared.input (fallback prepared #[])

theorem solve_prepared_correct (prepared : Prepared) :
    ResultValid prepared.input (solvePrepared prepared).answer (solvePrepared prepared).cost :=
  (solvePrepared prepared).valid

theorem solve_path_shortest (prepared : Prepared) (path : List Nat)
    (found : (solvePrepared prepared).answer = some path) :
    ShortestPath prepared.input.graph prepared.input.start prepared.input.target path := by
  have valid := solve_prepared_correct prepared
  simp only [ResultValid, found] at valid
  exact valid.1

theorem solve_unreachable (prepared : Prepared)
    (missing : (solvePrepared prepared).answer = none) :
    ∀ path, ¬Walk prepared.input.graph prepared.input.start prepared.input.target path := by
  have valid := solve_prepared_correct prepared
  simp only [ResultValid, missing] at valid
  exact valid.1

/-- Every valid request prepares and returns a shortest path or a proved
unreachable answer. There is no successful-search or fuel premise. -/
theorem solve_total (input : Input)
    (bounds : input.start < input.count ∧ input.target < input.count)
    (shape : shapeCheck input = true) (heuristic : heuristicCheck input = true) :
    ∃ prepared, prepare input = some prepared ∧
      ResultValid input (solvePrepared prepared).answer (solvePrepared prepared).cost := by
  let prepared : Prepared := ⟨input, bounds, shape, heuristic, searchInfinity input, rfl⟩
  exact ⟨prepared, by simp [prepare, bounds, shape, heuristic, prepared],
    (solvePrepared prepared).valid⟩

/-- Correctness of the exact serialized function called by the C bridge. -/
theorem exported_search_correct (prepared : Prepared) :
    ∃ result : CertifiedResult prepared.input,
      ResultValid prepared.input result.answer result.cost ∧
      solveExport prepared = serialize prepared.input result :=
  ⟨solvePrepared prepared, (solvePrepared prepared).valid, rfl⟩

theorem exported_total_correct (prepared : Prepared) :
    ∃ result : CertifiedResult prepared.input,
      ResultValid prepared.input result.answer result.cost ∧
      solveTotalExport prepared = serialize prepared.input result :=
  ⟨fallback prepared #[], (fallback prepared #[]).valid, rfl⟩

theorem prepare_isSome_iff (input : Input) :
    (prepare input).isSome = true ↔
      (input.start < input.count ∧ input.target < input.count) ∧
        shapeCheck input = true ∧ heuristicCheck input = true := by
  by_cases bounds : input.start < input.count ∧ input.target < input.count
  · by_cases shape : shapeCheck input = true
    · by_cases heuristic : heuristicCheck input = true <;>
        simp [prepare, bounds, shape, heuristic]
    · simp [prepare, bounds, shape]
  · simp [prepare, bounds]

/-- The foreign preparation entry point accepts exactly the documented Lean
vertex, CSR-shape, and heuristic conditions. -/
theorem prepareExport_valid_iff (count start target : UInt32)
    (offsets targets weights heuristic : Array Nat) :
    let input : Input := ⟨count.toNat, start.toNat, target.toNat, offsets, targets, weights, heuristic⟩
    (prepareExport count start target offsets targets weights heuristic).isSome = true ↔
      (input.start < input.count ∧ input.target < input.count) ∧
        shapeCheck input = true ∧ heuristicCheck input = true :=
  prepare_isSome_iff _

theorem serialize_tag (input : Input) (result : CertifiedResult input) :
    (serialize input result)[0]? = some (if result.answer.isSome then 0 else 1) := by
  cases found : result.answer <;> simp [serialize, found, Array.getElem?_append]

theorem solveExport_no_failure (prepared : Prepared) :
    (solveExport prepared)[0]? = some 0 ∨ (solveExport prepared)[0]? = some 1 := by
  rw [solveExport, serialize_tag]
  cases (solvePrepared prepared).answer <;> simp

/-- The no-route tag means that no walk exists, and every unreachable request
returns that tag. -/
theorem solveExport_unreachable_iff (prepared : Prepared) :
    (solveExport prepared)[0]? = some 1 ↔
      ∀ path, ¬Walk prepared.input.graph prepared.input.start prepared.input.target path := by
  rw [solveExport, serialize_tag]
  cases found : (solvePrepared prepared).answer with
  | none =>
      simp only [Option.isSome_none, Bool.false_eq_true, ↓reduceIte, true_iff]
      exact solve_unreachable prepared found
  | some path =>
      simp only [Option.isSome_some, ↓reduceIte, Option.some.injEq, Nat.zero_ne_one, false_iff]
      intro impossible
      exact impossible path (solve_path_shortest prepared path found).1

theorem serialize_path_starts_at_source (input : Input) (result : CertifiedResult input)
    (path : List Nat) (found : result.answer = some path) :
    (serialize input result)[3]? = some (path.length + 1) ∧
      (serialize input result)[5]? = some input.start := by
  simp [serialize, found, Array.getElem?_append]

end LeanAStar
