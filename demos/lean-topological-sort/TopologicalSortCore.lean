import Init

/-!
Generic topological sorting for finite directed graphs represented by flat endpoint pairs.
The browser demo is only an adapter. This module knows nothing about builds, tasks, or layouts.
-/

namespace LeanTopologicalSort

def arrayGet (values : Array α) (index : Nat) (fallback : α) : α :=
  values.getD index fallback

def edgesValid (count : Nat) (edges : Array Nat) : Bool :=
  edges.size % 2 = 0 && edges.all fun vertex => vertex < count

def edgeExistsFrom (edges : Array Nat) (source target : Nat) : Nat → Nat → Bool
  | 0, _ => false
  | fuel + 1, index =>
      if index + 1 < edges.size then
        if arrayGet edges index 0 = source && arrayGet edges (index + 1) 0 = target then true
        else edgeExistsFrom edges source target fuel (index + 2)
      else false

def edgeExists (edges : Array Nat) (source target : Nat) : Bool :=
  edgeExistsFrom edges source target (edges.size / 2) 0

private structure GraphData where
  indegree : Array Nat
  offsets : Array Nat
  targets : Array Nat

private def countDegreesFrom (count : Nat) (edges : Array Nat) :
    Nat → Nat → Array Nat → Array Nat → Array Nat × Array Nat
  | 0, _, outgoing, incoming => (outgoing, incoming)
  | fuel + 1, index, outgoing, incoming =>
      if index + 1 < edges.size then
        let source := arrayGet edges index count
        let target := arrayGet edges (index + 1) count
        countDegreesFrom count edges fuel (index + 2)
          (outgoing.setIfInBounds source (arrayGet outgoing source 0 + 1))
          (incoming.setIfInBounds target (arrayGet incoming target 0 + 1))
      else (outgoing, incoming)

private def buildOffsetsFrom (degrees : Array Nat) : Nat → Nat → Nat → Array Nat → Array Nat
  | 0, _, _, offsets => offsets
  | fuel + 1, vertex, total, offsets =>
      let next := total + arrayGet degrees vertex 0
      buildOffsetsFrom degrees fuel vertex.succ next (offsets.push next)

private def fillTargetsFrom (count : Nat) (edges : Array Nat) :
    Nat → Nat → Array Nat → Array Nat → Array Nat
  | 0, _, _, targets => targets
  | fuel + 1, index, cursor, targets =>
      if index + 1 < edges.size then
        let source := arrayGet edges index count
        let target := arrayGet edges (index + 1) count
        let position := arrayGet cursor source 0
        fillTargetsFrom count edges fuel (index + 2)
          (cursor.setIfInBounds source position.succ)
          (targets.setIfInBounds position target)
      else targets

private def buildGraph (count : Nat) (edges : Array Nat) : GraphData :=
  let degrees := countDegreesFrom count edges (edges.size / 2) 0
    (Array.replicate count 0) (Array.replicate count 0)
  let offsets := buildOffsetsFrom degrees.1 count 0 0 #[0]
  let targets := fillTargetsFrom count edges (edges.size / 2) 0 offsets
    (Array.replicate (edges.size / 2) 0)
  { indegree := degrees.2, offsets, targets }

private def enqueueZeroes (indegree : Array Nat) : Nat → Nat → Array Nat → Array Nat
  | 0, _, queue => queue
  | fuel + 1, vertex, queue =>
      enqueueZeroes indegree fuel vertex.succ
        (if arrayGet indegree vertex 0 = 0 then queue.push vertex else queue)

private structure KahnState where
  indegree : Array Nat
  queue : Array Nat
  head : Nat
  order : Array Nat

private def releaseNeighbors (targets : Array Nat) (stop : Nat) :
    Nat → Nat → Array Nat → Array Nat → Array Nat × Array Nat
  | 0, _, indegree, queue => (indegree, queue)
  | fuel + 1, index, indegree, queue =>
      if stop ≤ index then (indegree, queue)
      else
        let target := arrayGet targets index indegree.size
        let degree := arrayGet indegree target 0
        let nextDegree := degree - 1
        releaseNeighbors targets stop fuel index.succ
          (indegree.setIfInBounds target nextDegree)
          (if nextDegree = 0 then queue.push target else queue)

private def kahnLoop (graph : GraphData) : Nat → KahnState → KahnState
  | 0, state => state
  | fuel + 1, state =>
      if state.queue.size ≤ state.head then state
      else
        let source := arrayGet state.queue state.head graph.indegree.size
        let first := arrayGet graph.offsets source 0
        let stop := arrayGet graph.offsets source.succ first
        let released := releaseNeighbors graph.targets stop (stop - first + 1) first
          state.indegree state.queue
        kahnLoop graph fuel {
          indegree := released.1
          queue := released.2
          head := state.head + 1
          order := state.order.push source
        }

private def kahn (count : Nat) (edges : Array Nat) : KahnState :=
  let graph := buildGraph count edges
  let queue := enqueueZeroes graph.indegree count 0 #[]
  kahnLoop graph count { indegree := graph.indegree, queue, head := 0, order := #[] }

private def firstResidualFrom (indegree : Array Nat) : Nat → Nat → Option Nat
  | 0, _ => none
  | fuel + 1, vertex =>
      if arrayGet indegree vertex 0 > 0 then some vertex
      else firstResidualFrom indegree fuel vertex.succ

private def incomingResidualFrom (count : Nat) (edges indegree : Array Nat) (target : Nat) :
    Nat → Nat → Option Nat
  | 0, _ => none
  | fuel + 1, index =>
      if index + 1 < edges.size then
        let source := arrayGet edges index count
        if arrayGet edges (index + 1) count = target && arrayGet indegree source 0 > 0 then
          some source
        else incomingResidualFrom count edges indegree target fuel (index + 2)
      else none

private def reverseSlice (values : Array Nat) (first : Nat) : Array Nat :=
  (values.toList.drop first).reverse.toArray

private def chaseCycle (count : Nat) (edges indegree : Array Nat) :
    Nat → Nat → Array Nat → Array Nat → Option (Array Nat)
  | 0, _, _, _ => none
  | fuel + 1, current, positions, chain =>
      let position := arrayGet positions current count
      if position < count then some (reverseSlice chain position)
      else
        let nextPositions := positions.setIfInBounds current chain.size
        let nextChain := chain.push current
        match incomingResidualFrom count edges indegree current (edges.size / 2) 0 with
        | none => none
        | some predecessor => chaseCycle count edges indegree fuel predecessor nextPositions nextChain

private def findCycle (count : Nat) (edges indegree : Array Nat) : Option (Array Nat) :=
  match firstResidualFrom indegree count 0 with
  | none => none
  | some start => chaseCycle count edges indegree (count + 1) start
      (Array.replicate count count) #[]

def buildPositionsFrom (count : Nat) (order : Array Nat) :
    Nat → Nat → Array Nat → Array Nat
  | 0, _, positions => positions
  | fuel + 1, index, positions =>
      let vertex := arrayGet order index count
      buildPositionsFrom count order fuel index.succ
        (positions.setIfInBounds vertex index)

def orderUniqueFrom (count : Nat) (order : Array Nat) :
    Nat → Nat → Array Bool → Bool
  | 0, _, _ => true
  | fuel + 1, index, seen =>
      let vertex := arrayGet order index count
      vertex < count && !arrayGet seen vertex true &&
        orderUniqueFrom count order fuel index.succ (seen.setIfInBounds vertex true)

def permutationCheck (count : Nat) (order : Array Nat) : Bool :=
  order.size = count && orderUniqueFrom count order order.size 0 (Array.replicate count false)

def edgeOrderCheckFrom (edges positions : Array Nat) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, index =>
      if index + 1 < edges.size then
        arrayGet positions (arrayGet edges index 0) positions.size <
            arrayGet positions (arrayGet edges (index + 1) 0) positions.size &&
          edgeOrderCheckFrom edges positions fuel (index + 2)
      else true

def edgeOrderCheck (count : Nat) (edges order : Array Nat) : Bool :=
  let positions := buildPositionsFrom count order order.size 0 (Array.replicate count count)
  edgeOrderCheckFrom edges positions (edges.size / 2) 0

def IsTopologicalOrder (count : Nat) (edges order : Array Nat) : Prop :=
  permutationCheck count order = true ∧ edgeOrderCheck count edges order = true

instance (count : Nat) (edges order : Array Nat) :
    Decidable (IsTopologicalOrder count edges order) := by
  unfold IsTopologicalOrder
  infer_instance

def cycleEdgeCheckFrom (edges cycle : Array Nat) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, index =>
      let source := arrayGet cycle index 0
      let target := arrayGet cycle ((index + 1) % cycle.size) 0
      edgeExists edges source target && cycleEdgeCheckFrom edges cycle fuel index.succ

def cycleEdgeCheck (edges cycle : Array Nat) : Bool :=
  if cycle.isEmpty then false else cycleEdgeCheckFrom edges cycle cycle.size 0

def DirectedCycle (count : Nat) (edges cycle : Array Nat) : Prop :=
  cycle.size > 0 ∧ cycle.toList.Nodup ∧
    cycle.all (fun vertex => vertex < count) = true ∧ cycleEdgeCheck edges cycle = true

instance (count : Nat) (edges cycle : Array Nat) :
    Decidable (DirectedCycle count edges cycle) := by
  unfold DirectedCycle
  infer_instance

inductive Result where
  | order (vertices : Array Nat)
  | cycle (vertices : Array Nat)
deriving Repr, DecidableEq

def ResultValid (count : Nat) (edges : Array Nat) : Result → Prop
  | Result.order vertices => IsTopologicalOrder count edges vertices
  | Result.cycle vertices => DirectedCycle count edges vertices

def solveFastCertified (count : Nat) (edges : Array Nat) :
    Option { result : Result // ResultValid count edges result } :=
  if edgesValid count edges then
    let state := kahn count edges
    if state.order.size = count then
      if valid : IsTopologicalOrder count edges state.order then
        some ⟨.order state.order, valid⟩
      else none
    else
      match findCycle count edges state.indegree with
      | some cycle =>
          if valid : DirectedCycle count edges cycle then some ⟨.cycle cycle, valid⟩ else none
      | none => none
  else none

def solveFast (count : Nat) (edges : Array Nat) : Option Result :=
  (solveFastCertified count edges).map Subtype.val

def serialize : Option Result → Array Nat
  | some (.order vertices) => #[0] ++ vertices
  | some (.cycle vertices) => #[1] ++ vertices
  | none => #[2]

end LeanTopologicalSort
