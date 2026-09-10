import DijkstraCore

/-! Generic CSR A* candidate. Graph validation and the result proofs live in
the other AStar modules. No terrain or coordinate definitions occur here. -/

namespace LeanAStar
open LeanDijkstra

structure Input where
  count : Nat
  start : Nat
  target : Nat
  offsets : Array Nat
  targets : Array Nat
  weights : Array Nat
  heuristic : Array Nat

def Input.graph (input : Input) : Graph :=
  csrGraph input.count input.offsets input.targets input.weights

@[inline] def Input.h (input : Input) (vertex : Nat) : Nat :=
  arrayGet input.heuristic vertex 0

def shapeCheck (input : Input) : Bool :=
  input.offsets.size == input.count + 1 &&
  input.targets.size == input.weights.size && input.heuristic.size == input.count &&
  arrayGet input.offsets 0 0 == 0 &&
  arrayGet input.offsets input.count 0 == input.targets.size &&
  allUpTo input.count (fun vertex =>
    arrayGet input.offsets vertex 0 ≤ arrayGet input.offsets (vertex + 1) 0 &&
    arrayGet input.offsets (vertex + 1) 0 ≤ input.targets.size) &&
  input.targets.all (fun vertex => vertex < input.count)

def heuristicFrom (input : Input) (source stop : Nat) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, index =>
      if stop ≤ index then true else
        (if arrayGet input.targets index 0 < input.count then
          decide (input.h source ≤ arrayGet input.weights index 0 +
            input.h (arrayGet input.targets index 0)) else true) &&
        heuristicFrom input source stop fuel (index + 1)

def heuristicCheck (input : Input) : Bool :=
  input.h input.target == 0 && allUpTo input.count fun source =>
    let first := arrayGet input.offsets source 0
    let stop := arrayGet input.offsets (source + 1) 0
    heuristicFrom input source stop (stop - first + 1) first

def searchInfinity (input : Input) : Nat :=
  (input.weights.foldl max 0 + 1) * (input.count + 1)

structure Prepared where
  input : Input
  bounds : input.start < input.count ∧ input.target < input.count
  shape : shapeCheck input = true
  heuristicValid : heuristicCheck input = true
  infinity : Nat
  infinityValid : infinity = searchInfinity input

def prepare (input : Input) : Option Prepared :=
  if bounds : input.start < input.count ∧ input.target < input.count then
    if shape : shapeCheck input = true then
      if heuristicValid : heuristicCheck input = true then
        some ⟨input, bounds, shape, heuristicValid, searchInfinity input, rfl⟩
      else none
    else none
  else none

structure Entry where
  vertex : Nat
  distance : Nat
  priority : Nat
deriving Inhabited

/-- Prefer larger g when f ties, then use vertex id for reproducibility. -/
@[inline] def entryBefore (left right : Entry) : Bool :=
  left.priority < right.priority ||
    (left.priority == right.priority &&
      (right.distance < left.distance ||
        (left.distance == right.distance && left.vertex < right.vertex)))

private def up (entry : Entry) : Nat → Nat → Array Entry → Array Entry
  | 0, index, heap => heap.setIfInBounds index entry
  | fuel + 1, index, heap =>
      if index = 0 then heap.setIfInBounds index entry else
        let parent := (index - 1) / 2
        let parentEntry := arrayGet heap parent default
        if entryBefore entry parentEntry then
          up entry fuel parent (heap.setIfInBounds index parentEntry)
        else heap.setIfInBounds index entry

private def push (heap : Array Entry) (entry : Entry) : Array Entry :=
  up entry heap.size heap.size (heap.push default)

private def down (entry : Entry) : Nat → Nat → Array Entry → Array Entry
  | 0, index, heap => heap.setIfInBounds index entry
  | fuel + 1, index, heap =>
      let left := 2 * index + 1
      if heap.size ≤ left then heap.setIfInBounds index entry else
        let right := left + 1
        let child := if right < heap.size &&
            entryBefore (arrayGet heap right default) (arrayGet heap left default)
          then right else left
        let childEntry := arrayGet heap child default
        if entryBefore childEntry entry then
          down entry fuel child (heap.setIfInBounds index childEntry)
        else heap.setIfInBounds index entry

private def pop (heap : Array Entry) : Array Entry :=
  let last := arrayGet heap (heap.size - 1) default
  let rest := heap.pop
  if rest.isEmpty then rest else down last rest.size 0 rest

structure State where
  distance : Array Nat
  previous : Array Nat
  closed : Array Bool
  expanded : Array Nat

structure Frontier where
  queue : Array Entry
  state : State

def isStale (infinity : Nat) (state : State) (entry : Entry) : Bool :=
  arrayGet state.closed entry.vertex true ||
    entry.distance != arrayGet state.distance entry.vertex infinity

-- Pass the owned arrays through the loop directly. Rebuilding State and
-- Frontier after every improving edge would allocate two short-lived objects.
private def relax (input : Input) (source sourceDistance infinity stop : Nat) :
    Nat → Nat → Array Entry → Array Nat → Array Nat → Array Bool → Array Nat → Frontier
  | 0, _, queue, distance, previous, closed, expanded =>
      ⟨queue, ⟨distance, previous, closed, expanded⟩⟩
  | fuel + 1, index, queue, distance, previous, closed, expanded =>
      if stop ≤ index then ⟨queue, ⟨distance, previous, closed, expanded⟩⟩ else
        let vertex := arrayGet input.targets index input.count
        let alternative := sourceDistance + arrayGet input.weights index 0
        if vertex < input.count && !arrayGet closed vertex true &&
            alternative < arrayGet distance vertex infinity then
          relax input source sourceDistance infinity stop fuel (index + 1)
            (push queue ⟨vertex, alternative, alternative + input.h vertex⟩)
            (distance.setIfInBounds vertex alternative)
            (previous.setIfInBounds vertex source) closed expanded
        else relax input source sourceDistance infinity stop fuel (index + 1)
          queue distance previous closed expanded

def searchLoop (input : Input) (infinity : Nat) : Nat → Frontier → State
  | 0, frontier => frontier.state
  | fuel + 1, frontier =>
      if frontier.queue.isEmpty then frontier.state else
        let entry := arrayGet frontier.queue 0 default
        let remaining := pop frontier.queue
        if isStale infinity frontier.state entry then
          searchLoop input infinity fuel { frontier with queue := remaining }
        else
          let state := { frontier.state with
            closed := frontier.state.closed.setIfInBounds entry.vertex true
            expanded := frontier.state.expanded.push entry.vertex }
          if entry.vertex = input.target then state else
            let first := arrayGet input.offsets entry.vertex 0
            let stop := arrayGet input.offsets (entry.vertex + 1) 0
            searchLoop input infinity fuel
              (relax input entry.vertex entry.distance infinity stop (stop - first + 1)
                first remaining state.distance state.previous state.closed state.expanded)

/-- Stale heap entries are discarded without changing any search-state field. -/
theorem searchLoop_stale (input : Input) (infinity fuel : Nat) (frontier : Frontier)
    (nonempty : frontier.queue.isEmpty = false)
    (stale : isStale infinity frontier.state (arrayGet frontier.queue 0 default) = true) :
    searchLoop input infinity (fuel + 1) frontier =
      searchLoop input infinity fuel { frontier with queue := pop frontier.queue } := by
  simp [searchLoop, nonempty, stale]

private def searchWithInfinity (input : Input) (infinity : Nat) : State :=
  searchLoop input infinity (input.targets.size + input.count + 1) {
    queue := #[⟨input.start, 0, input.h input.start⟩]
    state := {
      distance := (Array.replicate input.count infinity).setIfInBounds input.start 0
      previous := Array.replicate input.count input.count
      closed := Array.replicate input.count false
      expanded := #[] }
  }

def searchRaw (input : Input) : State :=
  searchWithInfinity input (searchInfinity input)

/-- Preparation computes the graph's distance sentinel once, not on every run. -/
def searchPrepared (prepared : Prepared) : State :=
  searchWithInfinity prepared.input prepared.infinity

theorem searchPrepared_eq_searchRaw (prepared : Prepared) :
    searchPrepared prepared = searchRaw prepared.input := by
  simp only [searchPrepared, searchRaw, prepared.infinityValid]

def reconstruct (previous : Array Nat) (start sentinel : Nat) :
    Nat → Nat → List Nat → Option (List Nat)
  | 0, _, _ => none
  | fuel + 1, current, path =>
      if current = start then some path else
        let parent := arrayGet previous current sentinel
        if parent = sentinel then none else
          reconstruct previous start sentinel fuel parent (current :: path)

@[inline] def labels (input : Input) (state : State) (cutoff vertex : Nat) : Nat :=
  min (arrayGet state.distance vertex 0) (cutoff - input.h vertex)

/-- Check a row using its cached source label, with no label-function closure. -/
def labelsFrom (input : Input) (state : State) (cutoff sourceLabel stop : Nat) :
    Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, index =>
      if stop ≤ index then true else
        let target := arrayGet input.targets index 0
        let weight := arrayGet input.weights index 0
        (if target < input.count then
          decide (labels input state cutoff target ≤ sourceLabel + weight)
        else true) && labelsFrom input state cutoff sourceLabel stop fuel (index + 1)

def labelsCheck (input : Input) (state : State) (cutoff : Nat) : Bool :=
  labels input state cutoff input.start == 0 && allUpTo input.count fun source =>
    if arrayGet state.distance source 0 < cutoff - input.h source then
      let first := arrayGet input.offsets source 0
      let stop := arrayGet input.offsets (source + 1) 0
      labelsFrom input state cutoff (labels input state cutoff source) stop
        (stop - first + 1) first
    else true

def cutFrom (input : Input) (closed : Array Bool) (stop : Nat) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, index =>
      if stop ≤ index then true else
        (if arrayGet input.targets index 0 < input.count then
          arrayGet closed (arrayGet input.targets index 0) false else true) &&
        cutFrom input closed stop fuel (index + 1)

def cutCheck (input : Input) (closed : Array Bool) : Bool :=
  arrayGet closed input.start false && !arrayGet closed input.target false &&
    allUpTo input.count fun source =>
      if arrayGet closed source false then
        let first := arrayGet input.offsets source 0
        let stop := arrayGet input.offsets (source + 1) 0
        cutFrom input closed stop (stop - first + 1) first
      else true

end LeanAStar
