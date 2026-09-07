import Init

/-! Iterative Tarjan search over a generic directed CSR graph. Index, low-link,
active component stack, and DFS frames are separate state fields. -/

namespace LeanTarjan

@[inline] def get (values : Array α) (index : Nat) (fallback : α) : α :=
  values.getD index fallback

/-- Check vertices in ascending order without using one stack frame per vertex. -/
def allFrom (predicate : Nat → Bool) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, first => predicate first && allFrom predicate fuel (first + 1)

def allUpTo (count : Nat) (predicate : Nat → Bool) : Bool :=
  allFrom predicate count 0

structure Input where
  count : Nat
  offsets : Array Nat
  targets : Array Nat

def shapeCheck (input : Input) : Bool :=
  input.offsets.size == input.count + 1 && get input.offsets 0 0 == 0 &&
  get input.offsets input.count 0 == input.targets.size &&
  allUpTo input.count (fun vertex =>
    get input.offsets vertex 0 ≤ get input.offsets (vertex + 1) 0 &&
    get input.offsets (vertex + 1) 0 ≤ input.targets.size) &&
  input.targets.all (fun vertex => vertex < input.count)

def adjacentFrom (targets : Array Nat) (stop target : Nat) : Nat → Nat → Bool
  | 0, _ => false
  | fuel + 1, index =>
      if index < stop && index < targets.size then
        get targets index targets.size == target ||
          adjacentFrom targets stop target fuel (index + 1)
      else false

def Input.edge (input : Input) (source target : Nat) : Bool :=
  let first := get input.offsets source 0
  let stop := get input.offsets (source + 1) 0
  adjacentFrom input.targets stop target (stop - first) first

def edgeWitness (input : Input) (source target index : Nat) : Bool :=
  source < input.count && target < input.count && index < input.targets.size &&
    get input.offsets source 0 ≤ index && index < get input.offsets (source + 1) 0 &&
    get input.targets index input.count == target

structure ReverseGraph where
  offsets : Array Nat
  targets : Array Nat
  original : Array Nat

private def countIncoming (input : Input) : Nat → Nat → Array Nat → Array Nat
  | 0, _, counts => counts
  | fuel + 1, index, counts =>
      let vertex := get input.targets index input.count
      countIncoming input fuel (index + 1)
        (counts.setIfInBounds vertex (get counts vertex 0 + 1))

private def prefixOffsets (counts : Array Nat) : Nat → Nat → Nat → Array Nat → Array Nat
  | 0, _, _, offsets => offsets
  | fuel + 1, vertex, total, offsets =>
      let next := total + get counts vertex 0
      prefixOffsets counts fuel (vertex + 1) next (offsets.push next)

private def reverseRow (input : Input) (source stop : Nat) :
    Nat → Nat → Array Nat → Array Nat → Array Nat → Array Nat × Array Nat × Array Nat
  | 0, _, cursor, targets, original => (cursor, targets, original)
  | fuel + 1, index, cursor, targets, original =>
      if index < stop then
        let vertex := get input.targets index input.count
        let position := get cursor vertex 0
        reverseRow input source stop fuel (index + 1)
          (cursor.setIfInBounds vertex (position + 1))
          (targets.setIfInBounds position source) (original.setIfInBounds position index)
      else (cursor, targets, original)

private def reverseRows (input : Input) :
    Nat → Nat → Array Nat → Array Nat → Array Nat → Array Nat × Array Nat × Array Nat
  | 0, _, cursor, targets, original => (cursor, targets, original)
  | fuel + 1, source, cursor, targets, original =>
      let first := get input.offsets source 0
      let stop := get input.offsets (source + 1) 0
      let next := reverseRow input source stop (stop - first) first cursor targets original
      reverseRows input fuel (source + 1) next.1 next.2.1 next.2.2

def reverseGraph (input : Input) : ReverseGraph :=
  let counts := countIncoming input input.targets.size 0 (Array.replicate input.count 0)
  let offsets := prefixOffsets counts input.count 0 0 #[0]
  let filled := reverseRows input input.count 0 offsets
    (Array.replicate input.targets.size 0) (Array.replicate input.targets.size 0)
  ⟨offsets, filled.2.1, filled.2.2⟩

structure Prepared where
  input : Input
  reverse : ReverseGraph
  valid : shapeCheck input = true

def prepare (input : Input) : Option Prepared :=
  if valid : shapeCheck input = true then some ⟨input, reverseGraph input, valid⟩ else none

structure SearchState where
  nextIndex : Nat
  componentCount : Nat
  index : Array Nat
  low : Array Nat
  active : Array Bool
  stack : List Nat
  frames : List Nat
  cursor : Array Nat
  labels : Array Nat
  popOrder : Array Nat

def initialState (input : Input) : SearchState :=
  ⟨0, 0, Array.replicate input.count input.count, Array.replicate input.count input.count,
    Array.replicate input.count false, [], [], input.offsets,
    Array.replicate input.count input.count, Array.replicate input.count input.count⟩

def discover (vertex : Nat) (state : SearchState) : SearchState :=
  { state with
    nextIndex := state.nextIndex + 1
    index := state.index.setIfInBounds vertex state.nextIndex
    low := state.low.setIfInBounds vertex state.nextIndex
    active := state.active.setIfInBounds vertex true
    stack := vertex :: state.stack
    frames := vertex :: state.frames }

def lowerLink (vertex proposed : Nat) (state : SearchState) : SearchState :=
  { state with low := state.low.setIfInBounds vertex (min (get state.low vertex proposed) proposed) }

/-- Remove a prefix of the active stack through the root, accumulating members.
The recursive call is in tail position even for a large single component. -/
def popThrough (root : Nat) : List Nat → List Nat → List Nat × List Nat
  | [], members => (members, [])
  | vertex :: rest, members =>
      if vertex = root then (vertex :: members, rest)
      else popThrough root rest (vertex :: members)

private def labelMembers (representative order : Nat) :
    List Nat → Array Nat → Array Nat → Array Bool → Array Nat × Array Nat × Array Bool
  | [], labels, orders, active => (labels, orders, active)
  | vertex :: rest, labels, orders, active =>
      labelMembers representative order rest (labels.setIfInBounds vertex representative)
        (orders.setIfInBounds vertex order) (active.setIfInBounds vertex false)

def closeComponent (count vertex : Nat) (state : SearchState) : SearchState :=
  let popped := popThrough vertex state.stack []
  let representative := popped.1.foldl min count
  let assigned := labelMembers representative state.componentCount popped.1
    state.labels state.popOrder state.active
  { state with
    componentCount := state.componentCount + 1
    stack := popped.2, labels := assigned.1, popOrder := assigned.2.1, active := assigned.2.2 }

def dfsLoop (input : Input) : Nat → SearchState → SearchState
  | 0, state => state
  | fuel + 1, state =>
      match state.frames with
      | [] => state
      | vertex :: parents =>
          let cursor := get state.cursor vertex 0
          let stop := get input.offsets (vertex + 1) 0
          if cursor < stop then
            let target := get input.targets cursor input.count
            let advanced := { state with cursor := state.cursor.setIfInBounds vertex (cursor + 1) }
            if target < input.count then
              if get state.index target input.count = input.count then
                dfsLoop input fuel (discover target advanced)
              else if get state.active target false then
                dfsLoop input fuel (lowerLink vertex (get state.index target input.count) advanced)
              else dfsLoop input fuel advanced
            else dfsLoop input fuel advanced
          else
            let popped := { state with frames := parents }
            let closed := if get state.low vertex input.count = get state.index vertex input.count
              then closeComponent input.count vertex popped else popped
            match parents with
            | [] => dfsLoop input fuel closed
            | parent :: _ =>
                dfsLoop input fuel (lowerLink parent (get closed.low vertex input.count) closed)

private def startVertices (input : Input) : Nat → Nat → SearchState → SearchState
  | 0, _, state => state
  | fuel + 1, vertex, state =>
      let next := if get state.index vertex input.count = input.count then
          dfsLoop input (input.targets.size + input.count + 1) (discover vertex state)
        else state
      startVertices input fuel (vertex + 1) next

def tarjanRaw (input : Input) : SearchState :=
  startVertices input input.count 0 (initialState input)

structure Forest where
  parent : Array Nat
  rank : Array Nat
  witness : Array Nat
  visited : Array Bool
  queue : Array Nat
  head : Nat

/-- Compute scalar metadata before handing this helper ownership of the arrays.
Keeping the old forest live during its field updates would copy every array. -/
private def enqueueForest (source target rank witness : Nat) (forest : Forest) : Forest :=
  { forest with
    parent := forest.parent.setIfInBounds target source
    rank := forest.rank.setIfInBounds target rank
    witness := forest.witness.setIfInBounds target witness
    visited := forest.visited.setIfInBounds target true
    queue := forest.queue.push target }

private def seedRoots (labels : Array Nat) (count : Nat) : Nat → Nat → Forest → Forest
  | 0, _, forest => forest
  | fuel + 1, vertex, forest =>
      let next := if get labels vertex count = vertex then
          { forest with
            visited := forest.visited.setIfInBounds vertex true
            queue := forest.queue.push vertex } else forest
      seedRoots labels count fuel (vertex + 1) next

private def forestRow (count source : Nat) (labels targets original : Array Nat)
    (reverse : Bool) (stop : Nat) : Nat → Nat → Forest → Forest
  | 0, _, forest => forest
  | fuel + 1, index, forest =>
      if index < stop then
        let target := get targets index count
        let next := if target < count && !get forest.visited target true &&
            get labels source count == get labels target count then
          enqueueForest source target (get forest.rank source 0 + 1)
            (if reverse then get original index original.size else index) forest
          else forest
        forestRow count source labels targets original reverse stop fuel (index + 1) next
      else forest

private def forestLoop (count : Nat) (labels offsets targets original : Array Nat)
    (reverse : Bool) : Nat → Forest → Forest
  | 0, forest => forest
  | fuel + 1, forest =>
      if forest.head < forest.queue.size then
        let source := get forest.queue forest.head count
        let first := get offsets source 0
        let stop := get offsets (source + 1) 0
        let next := forestRow count source labels targets original reverse stop
          (stop - first) first { forest with head := forest.head + 1 }
        forestLoop count labels offsets targets original reverse fuel next
      else forest

def buildForest (count : Nat) (labels offsets targets original : Array Nat)
    (reverse : Bool) : Forest :=
  let roots := seedRoots labels count count 0 {
    parent := Array.replicate count count
    rank := Array.replicate count 0
    witness := Array.replicate count targets.size
    visited := Array.replicate count false
    queue := #[], head := 0 }
  forestLoop count labels offsets targets original reverse count roots

structure Candidate where
  labels : Array Nat
  popOrder : Array Nat
  forward : Forest
  backward : Forest

def candidate (prepared : Prepared) : Candidate :=
  let input := prepared.input
  let state := tarjanRaw input
  let forward := buildForest input.count state.labels input.offsets input.targets #[] false
  let backward := buildForest input.count state.labels prepared.reverse.offsets
    prepared.reverse.targets prepared.reverse.original true
  ⟨state.labels, state.popOrder, forward, backward⟩

def treeCheck (input : Input) (labels : Array Nat) (forest : Forest) (reverse : Bool)
    (vertex : Nat) : Bool :=
  if vertex = get labels vertex labels.size then true else
    let parent := get forest.parent vertex input.count
    parent < input.count && get labels parent labels.size == get labels vertex labels.size &&
      get forest.rank parent 0 < get forest.rank vertex 0 &&
      (if reverse then edgeWitness input vertex parent (get forest.witness vertex input.targets.size)
        else edgeWitness input parent vertex (get forest.witness vertex input.targets.size))

def descendingFrom (input : Input) (result : Candidate) (source stop : Nat) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, index =>
      if index < stop && index < input.targets.size then
        let target := get input.targets index input.count
        let left := get result.labels source result.labels.size
        let right := get result.labels target result.labels.size
        (left == right || get result.popOrder right 0 < get result.popOrder left 0) &&
          descendingFrom input result source stop fuel (index + 1)
      else true

def certificateCheck (input : Input) (result : Candidate) : Bool :=
  result.labels.size == input.count && allUpTo input.count fun vertex =>
    let label := get result.labels vertex result.labels.size
    let first := get input.offsets vertex 0
    let stop := get input.offsets (vertex + 1) 0
    label < input.count && get result.labels label result.labels.size == label &&
      treeCheck input result.labels result.forward false vertex &&
      treeCheck input result.labels result.backward true vertex &&
      descendingFrom input result vertex stop (stop - first) first

end LeanTarjan
