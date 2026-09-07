import Init

/-!
Executable, generic Dijkstra implementation.  This module intentionally imports
only Lean's `Init` runtime so the generated C can be linked into a small browser
Wasm component.  `Dijkstra.lean` proves this implementation correct.
-/

namespace LeanDijkstra

structure WeightedEdge where
  target : Nat
  weight : Nat
deriving DecidableEq

structure Graph where
  size : Nat
  outgoing : Nat → List WeightedEdge

def findEdgeWeight (target : Nat) : List WeightedEdge → Option Nat
  | [] => none
  | edge :: rest =>
      if edge.target = target then some edge.weight else findEdgeWeight target rest

def Graph.edgeWeight? (graph : Graph) (source target : Nat) : Option Nat :=
  findEdgeWeight target (graph.outgoing source)

def Graph.adjacent (graph : Graph) (source target : Nat) : Bool :=
  (graph.edgeWeight? source target).isSome

def Graph.weight (graph : Graph) (source target : Nat) : Nat :=
  (graph.edgeWeight? source target).getD 0

def Graph.Edge (graph : Graph) (source target : Nat) : Prop :=
  source < graph.size ∧ target < graph.size ∧ graph.adjacent source target = true

instance (graph : Graph) (source target : Nat) : Decidable (graph.Edge source target) :=
  inferInstanceAs (Decidable
    (source < graph.size ∧ target < graph.size ∧ graph.adjacent source target = true))

def Walk (graph : Graph) (current target : Nat) : List Nat → Prop
  | [] => current = target
  | next :: rest => graph.Edge current next ∧ Walk graph next target rest

instance walkDecidable (graph : Graph) (current target : Nat) (path : List Nat) :
    Decidable (Walk graph current target path) :=
  match path with
  | [] => inferInstanceAs (Decidable (current = target))
  | next :: rest =>
      have _ : Decidable (Walk graph next target rest) :=
        walkDecidable graph next target rest
      instDecidableAnd

def costOfPath (weight : Nat → Nat → Nat) (initial current : Nat) : List Nat → Nat
  | [] => initial
  | next :: rest => weight current next + costOfPath weight initial next rest

def pathCost (graph : Graph) (current : Nat) (path : List Nat) : Nat :=
  costOfPath graph.weight 0 current path

def ShortestPath (graph : Graph) (current target : Nat) (path : List Nat) : Prop :=
  Walk graph current target path ∧
    ∀ alternative, Walk graph current target alternative →
      pathCost graph current path ≤ pathCost graph current alternative

def FeasibleLabels (graph : Graph) (distance : Nat → Nat) (start : Nat) : Prop :=
  distance start = 0 ∧
    ∀ source target, graph.Edge source target →
      distance target ≤ distance source + graph.weight source target

structure SearchState where
  distance : Array Nat
  previous : Array Nat
  visited : Array Bool

structure QueueEntry where
  vertex : Nat
  distance : Nat
deriving Inhabited

def arrayGet (values : Array α) (index : Nat) (fallback : α) : α :=
  values.getD index fallback

private def swapEntries (heap : Array QueueEntry) (left right : Nat) : Array QueueEntry :=
  let leftEntry := arrayGet heap left default
  let rightEntry := arrayGet heap right default
  (heap.setIfInBounds left rightEntry).setIfInBounds right leftEntry

private def bubbleUp : Nat → Nat → Array QueueEntry → Array QueueEntry
  | 0, _, heap => heap
  | fuel + 1, index, heap =>
      if index = 0 then heap
      else
        let parent := (index - 1) / 2
        if (arrayGet heap index default).distance < (arrayGet heap parent default).distance then
          bubbleUp fuel parent (swapEntries heap index parent)
        else heap

private def heapPush (heap : Array QueueEntry) (entry : QueueEntry) : Array QueueEntry :=
  bubbleUp heap.size heap.size (heap.push entry)

private def siftDown : Nat → Nat → Array QueueEntry → Array QueueEntry
  | 0, _, heap => heap
  | fuel + 1, index, heap =>
      let left := index * 2 + 1
      if heap.size ≤ left then heap
      else
        let right := left + 1
        let child :=
          if right < heap.size &&
              (arrayGet heap right default).distance < (arrayGet heap left default).distance
          then right else left
        if (arrayGet heap child default).distance < (arrayGet heap index default).distance then
          siftDown fuel child (swapEntries heap index child)
        else heap

private def heapRemoveRoot (heap : Array QueueEntry) : Array QueueEntry :=
  let last := arrayGet heap (heap.size - 1) default
  let shortened := heap.pop
  if shortened.isEmpty then shortened
  else siftDown shortened.size 0 (shortened.setIfInBounds 0 last)

private structure Relaxed where
  distance : Array Nat
  previous : Array Nat
  queue : Array QueueEntry

private def relaxFrom (graph : Graph) (source sourceDistance infinity : Nat)
    (visited : Array Bool) :
    List WeightedEdge → Array Nat → Array Nat → Array QueueEntry → Relaxed
  | [], distance, previous, queue => { distance, previous, queue }
  | edge :: rest, distance, previous, queue =>
      if edge.target < graph.size && !arrayGet visited edge.target true then
        let alternative := sourceDistance + edge.weight
        if alternative < arrayGet distance edge.target infinity then
          relaxFrom graph source sourceDistance infinity visited rest
            (distance.setIfInBounds edge.target alternative)
            (previous.setIfInBounds edge.target source)
            (heapPush queue { vertex := edge.target, distance := alternative })
        else relaxFrom graph source sourceDistance infinity visited rest distance previous queue
      else relaxFrom graph source sourceDistance infinity visited rest distance previous queue

def dijkstraLoop (graph : Graph) (infinity : Nat) :
    Nat → Array QueueEntry → SearchState → SearchState
  | 0, _, state => state
  | fuel + 1, queue, state =>
      if queue.isEmpty then state
      else
        let entry := arrayGet queue 0 default
        let remaining := heapRemoveRoot queue
        if arrayGet state.visited entry.vertex true ||
            entry.distance != arrayGet state.distance entry.vertex infinity then
          dijkstraLoop graph infinity fuel remaining state
        else
          let visited := state.visited.setIfInBounds entry.vertex true
          let relaxed := relaxFrom graph entry.vertex entry.distance infinity visited
            (graph.outgoing entry.vertex) state.distance state.previous remaining
          dijkstraLoop graph infinity fuel relaxed.queue
            { distance := relaxed.distance, previous := relaxed.previous, visited }

private def initialState (graph : Graph) (start infinity : Nat) : SearchState :=
  { distance := Array.ofFn fun index : Fin graph.size =>
      if index.val = start then 0 else infinity
    previous := Array.replicate graph.size graph.size
    visited := Array.replicate graph.size false }

private structure GraphStats where
  maximumWeight : Nat
  edgeCount : Nat

private def graphStats (graph : Graph) : GraphStats :=
  (List.range graph.size).foldl (fun stats source =>
    (graph.outgoing source).foldl (fun current edge =>
      { maximumWeight := max current.maximumWeight edge.weight
        edgeCount := current.edgeCount + 1 }) stats)
    { maximumWeight := 0, edgeCount := 0 }

def infinity (graph : Graph) : Nat :=
  ((graphStats graph).maximumWeight + 1) * (graph.size + 1)

private def reconstruct (previous : Array Nat) (start sentinel : Nat) :
    Nat → Nat → List Nat → Option (List Nat)
  | 0, _, _ => none
  | fuel + 1, current, path =>
      if current = start then some path
      else
        let parent := arrayGet previous current sentinel
        if parent = sentinel then none
        else reconstruct previous start sentinel fuel parent (current :: path)

structure SearchResult where
  state : SearchState
  path : Option (List Nat)
  unreachable : Nat
  cutoff : Nat

def dijkstraRaw (graph : Graph) (start target : Nat) : SearchResult :=
  let stats := graphStats graph
  let unreachable := (stats.maximumWeight + 1) * (graph.size + 1)
  let state := dijkstraLoop graph unreachable (stats.edgeCount + graph.size + 1)
    #[{ vertex := start, distance := 0 }] (initialState graph start unreachable)
  { state
    path := reconstruct state.previous start graph.size (graph.size + 1) target []
    unreachable
    cutoff := unreachable }

def resultDistance (result : SearchResult) (vertex : Nat) : Nat :=
  min (arrayGet result.state.distance vertex result.unreachable) result.cutoff

def feasibleLabelsCheck (graph : Graph) (distance : Nat → Nat) (start : Nat) : Bool :=
  decide (distance start = 0) &&
    (List.range graph.size).all fun source =>
      (graph.outgoing source).all fun edge =>
        if edge.target < graph.size then
          decide (distance edge.target ≤ distance source + edge.weight)
        else true

def ResultCertificate (graph : Graph) (start target : Nat)
    (result : SearchResult) (path : List Nat) : Prop :=
  feasibleLabelsCheck graph (resultDistance result) start = true ∧
    Walk graph start target path ∧
    pathCost graph start path = resultDistance result target

instance resultCertificateDecidable (graph : Graph) (start target : Nat)
    (result : SearchResult) (path : List Nat) :
    Decidable (ResultCertificate graph start target result path) := by
  unfold ResultCertificate
  infer_instance

def dijkstraRec (graph : Graph) (start target : Nat) : Option (List Nat) :=
  let result := dijkstraRaw graph start target
  match result.path with
  | none => none
  | some path =>
      if ResultCertificate graph start target result path then some path else none

def dijkstra (graph : Graph) (start target : Nat) : Option (List Nat) :=
  dijkstraRec graph start target

/-! Generic compressed-sparse-row foreign-function adapter. -/

def csrOutgoing (targets weights : Array Nat) (stop : Nat) :
    Nat → Nat → List WeightedEdge
  | 0, _ => []
  | fuel + 1, index =>
      if stop ≤ index then []
      else
        { target := arrayGet targets index 0
          weight := arrayGet weights index 0 } ::
        csrOutgoing targets weights stop fuel index.succ

def csrEdgeWeightFrom (targets weights : Array Nat) (stop target : Nat) :
    Nat → Nat → Option Nat
  | 0, _ => none
  | fuel + 1, index =>
      if stop ≤ index then none
      else if arrayGet targets index 0 = target then some (arrayGet weights index 0)
      else csrEdgeWeightFrom targets weights stop target fuel index.succ

def csrEdgeWeight? (offsets targets weights : Array Nat) (source target : Nat) : Option Nat :=
  let first := arrayGet offsets source 0
  let stop := arrayGet offsets source.succ 0
  csrEdgeWeightFrom targets weights stop target (stop - first + 1) first

def csrPathCost? (vertexCount : Nat) (offsets targets weights : Array Nat)
    (target : Nat) : Nat → List Nat → Option Nat
  | current, [] => if current = target then some 0 else none
  | current, next :: rest =>
      if current < vertexCount && next < vertexCount then
        match csrEdgeWeight? offsets targets weights current next,
            csrPathCost? vertexCount offsets targets weights target next rest with
        | some weight, some tailCost => some (weight + tailCost)
        | _, _ => none
      else none

def csrGraph (vertexCount : Nat) (offsets targets weights : Array Nat) : Graph where
  size := vertexCount
  outgoing := fun source =>
    let first := arrayGet offsets source 0
    let stop := arrayGet offsets source.succ 0
    csrOutgoing targets weights stop (stop - first + 1) first

private structure BucketQueue where
  buckets : Array (List QueueEntry)
  current : Nat
  count : Nat

private def pushBucket (bucketCount : Nat) (queue : BucketQueue)
    (vertex distance : Nat) : BucketQueue :=
  let index := distance % bucketCount
  let bucket := arrayGet queue.buckets index []
  { queue with
    buckets := queue.buckets.setIfInBounds index ({ vertex, distance } :: bucket)
    count := queue.count + 1 }

private structure BucketPop where
  entry : QueueEntry
  queue : BucketQueue

private def popBucket (bucketCount : Nat) : Nat → BucketQueue → Option BucketPop
  | 0, _ => none
  | fuel + 1, queue =>
      if queue.count = 0 then none
      else
        let index := queue.current % bucketCount
        match arrayGet queue.buckets index [] with
        | entry :: rest =>
            some {
              entry
              queue := { queue with
                buckets := queue.buckets.setIfInBounds index rest
                count := queue.count - 1 }
            }
        | [] => popBucket bucketCount fuel { queue with current := queue.current + 1 }

private structure BucketRelaxed where
  distance : Array Nat
  previous : Array Nat
  queue : BucketQueue

private def relaxBucket (vertexCount bucketCount source sourceDistance infinity : Nat)
    (targets weights : Array Nat) (stop : Nat) :
    Nat → Nat → Array Nat → Array Nat → BucketQueue → BucketRelaxed
  | 0, _, distance, previous, queue => { distance, previous, queue }
  | fuel + 1, index, distance, previous, queue =>
      if stop ≤ index then { distance, previous, queue }
      else
        let target := arrayGet targets index 0
        let weight := arrayGet weights index 0
        if target < vertexCount then
          let alternative := sourceDistance + weight
          if alternative < arrayGet distance target infinity then
            relaxBucket vertexCount bucketCount source sourceDistance infinity targets weights stop
              fuel index.succ (distance.setIfInBounds target alternative)
              (previous.setIfInBounds target source)
              (pushBucket bucketCount queue target alternative)
          else relaxBucket vertexCount bucketCount source sourceDistance infinity targets weights stop
            fuel index.succ distance previous queue
        else relaxBucket vertexCount bucketCount source sourceDistance infinity targets weights stop
          fuel index.succ distance previous queue

private def dijkstraBucketLoop (vertexCount bucketCount : Nat)
    (offsets targets weights : Array Nat) (target infinity : Nat) :
    Nat → BucketQueue → SearchState → SearchState
  | 0, _, state => state
  | fuel + 1, queue, state =>
      match popBucket bucketCount (bucketCount + 1) queue with
      | none => state
      | some popped =>
          let vertex := popped.entry.vertex
          let entryDistance := popped.entry.distance
          if entryDistance != arrayGet state.distance vertex infinity then
            dijkstraBucketLoop vertexCount bucketCount offsets targets weights target infinity
              fuel popped.queue state
          else if vertex = target then state
          else
            let first := arrayGet offsets vertex 0
            let stop := arrayGet offsets vertex.succ 0
            let relaxed := relaxBucket vertexCount bucketCount vertex entryDistance infinity
              targets weights stop (stop - first + 1) first state.distance state.previous popped.queue
            dijkstraBucketLoop vertexCount bucketCount offsets targets weights target infinity fuel
              relaxed.queue
              { distance := relaxed.distance, previous := relaxed.previous, visited := state.visited }

private def initialStateForSize (vertexCount start infinity : Nat) : SearchState :=
  { distance := Array.ofFn fun index : Fin vertexCount =>
      if index.val = start then 0 else infinity
    previous := Array.replicate vertexCount vertexCount
    visited := #[] }

def dijkstraRawCsr (vertexCount : Nat) (offsets targets weights : Array Nat)
    (maximumWeight start target : Nat) : SearchResult :=
  let unreachable := (maximumWeight + 1) * (vertexCount + 1)
  let bucketCount := maximumWeight + 1
  let initialQueue := pushBucket bucketCount {
    buckets := Array.replicate bucketCount []
    current := 0
    count := 0
  } start 0
  let state := dijkstraBucketLoop vertexCount bucketCount offsets targets weights target unreachable
    (targets.size + vertexCount + 1) initialQueue
    (initialStateForSize vertexCount start unreachable)
  { state
    path := reconstruct state.previous start vertexCount (vertexCount + 1) target []
    unreachable
    cutoff := arrayGet state.distance target unreachable }

def csrFeasibleFrom (vertexCount source : Nat) (targets weights : Array Nat)
    (stop : Nat) (distance : Nat → Nat) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, index =>
      if stop ≤ index then true
      else
        let target := arrayGet targets index 0
        let weight := arrayGet weights index 0
        (if target < vertexCount then
          decide (distance target ≤ distance source + weight)
        else true) &&
          csrFeasibleFrom vertexCount source targets weights stop distance fuel index.succ

def allUpTo : Nat → (Nat → Bool) → Bool
  | 0, _ => true
  | count + 1, predicate => allUpTo count predicate && predicate count

def csrFeasibleLabelsCheck (vertexCount : Nat) (offsets targets weights : Array Nat)
    (distance : Nat → Nat) (start cutoff : Nat) : Bool :=
  decide (distance start = 0) &&
    allUpTo vertexCount fun source =>
      if cutoff ≤ distance source then true
      else
        let first := arrayGet offsets source 0
        let stop := arrayGet offsets source.succ 0
        csrFeasibleFrom vertexCount source targets weights stop distance (stop - first + 1) first

def CsrResultCertificate (vertexCount : Nat) (offsets targets weights : Array Nat)
    (start target : Nat) (result : SearchResult) (path : List Nat) : Prop :=
  csrFeasibleLabelsCheck vertexCount offsets targets weights (resultDistance result) start
      result.cutoff = true ∧
    csrPathCost? vertexCount offsets targets weights target start path =
      some (resultDistance result target)

instance csrResultCertificateDecidable (vertexCount : Nat) (offsets targets weights : Array Nat)
    (start target : Nat) (result : SearchResult) (path : List Nat) :
    Decidable (CsrResultCertificate vertexCount offsets targets weights start target result path) := by
  unfold CsrResultCertificate
  infer_instance

def dijkstraCsr (vertexCount : Nat) (offsets targets weights : Array Nat)
    (maximumWeight start target : Nat) : Option (List Nat) :=
  let result := dijkstraRawCsr vertexCount offsets targets weights maximumWeight start target
  match result.path with
  | none => none
  | some path =>
      if CsrResultCertificate vertexCount offsets targets weights start target result path then
        some path
      else none

/-- Generic compressed-sparse-row entry point used by the browser runtime. -/
@[export lean_dijkstra_solve_csr]
def solveCsr (vertexCount start target maximumWeight : UInt32)
    (offsets targets weights : Array Nat) : Array Nat :=
  let count := vertexCount.toNat
  let startNat := start.toNat
  let targetNat := target.toNat
  if offsets.size = count + 1 && targets.size = weights.size &&
      startNat < count && targetNat < count then
    match dijkstraCsr count offsets targets weights maximumWeight.toNat startNat targetNat with
    | some path => (startNat :: path).toArray
    | none => #[]
  else #[]

end LeanDijkstra
