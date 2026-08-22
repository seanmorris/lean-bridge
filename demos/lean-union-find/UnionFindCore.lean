import Init

/-!
An array-backed disjoint-set forest over finite natural-number indices.
The browser adapter supplies only an element count and undirected pairs.
-/

namespace LeanUnionFind

def arrayGet (values : Array α) (index : Nat) (fallback : α) : α :=
  values.getD index fallback

structure State where
  parent : Array Nat
  size : Array Nat
deriving Repr, DecidableEq

def State.initial (count : Nat) : State := {
  parent := (List.range count).toArray
  size := Array.replicate count 1
}

def findCompressFrom (count : Nat) : Nat → Nat → Array Nat → Nat × Array Nat
  | 0, vertex, parent => (vertex, parent)
  | fuel + 1, vertex, parent =>
      let next := arrayGet parent vertex vertex
      if next = vertex then (vertex, parent)
      else
        let result := findCompressFrom count fuel next parent
        (result.1, result.2.setIfInBounds vertex result.1)

def findCompress (count vertex : Nat) (state : State) : Nat × State :=
  let result := findCompressFrom count count vertex state.parent
  (result.1, { state with parent := result.2 })

def union (count left right : Nat) (state : State) : State :=
  let leftResult := findCompress count left state
  let leftRoot := leftResult.1
  let rightResult := findCompress count right leftResult.2
  let rightRoot := rightResult.1
  let compressed := rightResult.2
  if leftRoot = rightRoot then compressed
  else
    let leftSize := arrayGet compressed.size leftRoot 0
    let rightSize := arrayGet compressed.size rightRoot 0
    if leftSize < rightSize || (leftSize = rightSize && rightRoot < leftRoot) then {
      parent := compressed.parent.setIfInBounds leftRoot rightRoot
      size := compressed.size.setIfInBounds rightRoot (leftSize + rightSize)
    }
    else {
      parent := compressed.parent.setIfInBounds rightRoot leftRoot
      size := compressed.size.setIfInBounds leftRoot (leftSize + rightSize)
    }

def unionWithFlag (count left right : Nat) (state : State) : Bool × State :=
  let leftResult := findCompress count left state
  let leftRoot := leftResult.1
  let rightResult := findCompress count right leftResult.2
  let rightRoot := rightResult.1
  let compressed := rightResult.2
  if leftRoot = rightRoot then (false, compressed)
  else
    let leftSize := arrayGet compressed.size leftRoot 0
    let rightSize := arrayGet compressed.size rightRoot 0
    if leftSize < rightSize || (leftSize = rightSize && rightRoot < leftRoot) then
      (true, {
        parent := compressed.parent.setIfInBounds leftRoot rightRoot
        size := compressed.size.setIfInBounds rightRoot (leftSize + rightSize)
      })
    else
      (true, {
        parent := compressed.parent.setIfInBounds rightRoot leftRoot
        size := compressed.size.setIfInBounds leftRoot (leftSize + rightSize)
      })

def processLinksFrom (count : Nat) (links : Array Nat) : Nat → Nat → State → State
  | 0, _, state => state
  | fuel + 1, index, state =>
      if index + 1 < links.size then
        processLinksFrom count links fuel (index + 2)
          (union count (arrayGet links index count) (arrayGet links (index + 1) count) state)
      else state

def processLinks (count : Nat) (links : Array Nat) : State :=
  processLinksFrom count links (links.size / 2) 0 (State.initial count)

structure LinkBuild where
  forest : State
  selectedLinks : Array Nat
  selectedEdges : Array Nat

private def processLinksDetailedFrom (count : Nat) (links : Array Nat) :
    Nat → Nat → LinkBuild → LinkBuild
  | 0, _, state => state
  | fuel + 1, index, state =>
      if index + 1 < links.size then
        let left := arrayGet links index count
        let right := arrayGet links (index + 1) count
        let merged := unionWithFlag count left right state.forest
        let next := if merged.1 then {
          forest := merged.2
          selectedLinks := state.selectedLinks.push left |>.push right
          selectedEdges := state.selectedEdges.push (index / 2)
        } else { state with forest := merged.2 }
        processLinksDetailedFrom count links fuel (index + 2) next
      else state

def processLinksDetailed (count : Nat) (links : Array Nat) : LinkBuild :=
  processLinksDetailedFrom count links (links.size / 2) 0 {
    forest := State.initial count
    selectedLinks := #[]
    selectedEdges := #[]
  }

def compressAllFrom (count : Nat) : Nat → Nat → State → State
  | 0, _, state => state
  | fuel + 1, vertex, state =>
      let result := findCompress count vertex state
      compressAllFrom count fuel vertex.succ result.2

def compressAll (count : Nat) (state : State) : State :=
  compressAllFrom count count 0 state

def representatives (count : Nat) (state : State) : Array Nat :=
  (List.range count).toArray.map fun vertex => arrayGet state.parent vertex vertex

structure PartitionResult where
  representatives : Array Nat
  parent : Array Nat
  size : Array Nat
deriving Repr, DecidableEq

structure PartitionCertificate where
  parent : Array Nat
  depth : Array Nat
  edge : Array Nat
deriving Repr, DecidableEq

structure CertifiedPartition where
  result : PartitionResult
  certificate : PartitionCertificate
deriving Repr, DecidableEq

def partition (count : Nat) (links : Array Nat) : PartitionResult :=
  let state := compressAll count (processLinks count links)
  { representatives := representatives count state, parent := state.parent, size := state.size }

private def incrementDegrees (count : Nat) (links : Array Nat) : Nat → Nat → Array Nat → Array Nat
  | 0, _, degrees => degrees
  | fuel + 1, index, degrees =>
      if index + 1 < links.size then
        let left := arrayGet links index count
        let right := arrayGet links (index + 1) count
        let next := degrees.setIfInBounds left (arrayGet degrees left 0 + 1)
        let next := next.setIfInBounds right (arrayGet next right 0 + 1)
        incrementDegrees count links fuel (index + 2) next
      else degrees

private def offsetsFromDegrees : List Nat → Nat → Array Nat → Array Nat
  | [], _, offsets => offsets
  | degree :: rest, total, offsets =>
      offsetsFromDegrees rest (total + degree) (offsets.push (total + degree))

private def fillAdjacency (count : Nat) (links offsets : Array Nat) :
    Nat → Nat → Array Nat → Array Nat → Array Nat → Array Nat × Array Nat
  | 0, _, _, targets, edgeIds => (targets, edgeIds)
  | fuel + 1, index, cursor, targets, edgeIds =>
      if index + 1 < links.size then
        let left := arrayGet links index count
        let right := arrayGet links (index + 1) count
        let leftAt := arrayGet cursor left 0
        let nextCursor := cursor.setIfInBounds left leftAt.succ
        let rightAt := arrayGet nextCursor right 0
        let nextTargets := targets.setIfInBounds leftAt right
        let nextTargets := nextTargets.setIfInBounds rightAt left
        let nextEdgeIds := edgeIds.setIfInBounds leftAt (index / 2)
        let nextEdgeIds := nextEdgeIds.setIfInBounds rightAt (index / 2)
        let nextCursor := nextCursor.setIfInBounds right rightAt.succ
        fillAdjacency count links offsets fuel (index + 2) nextCursor nextTargets nextEdgeIds
      else (targets, edgeIds)

structure Adjacency where
  offsets : Array Nat
  targets : Array Nat
  edges : Array Nat

private def buildAdjacency (count : Nat) (links edgeIds : Array Nat) : Adjacency :=
  let degrees := incrementDegrees count links (links.size / 2) 0 (Array.replicate count 0)
  let offsets := offsetsFromDegrees degrees.toList 0 #[0]
  let edgeWords := links.size
  let filled := fillAdjacency count links offsets (links.size / 2) 0 offsets
    (Array.replicate edgeWords 0) (Array.replicate edgeWords 0)
  let edges := (List.range filled.2.size).toArray.map fun index =>
    arrayGet edgeIds (arrayGet filled.2 index 0) (arrayGet filled.2 index 0)
  { offsets, targets := filled.1, edges }

private def scanCertificateNeighbors (count source stop : Nat) (adjacency : Adjacency)
    (links representatives : Array Nat) : Nat → Nat → Array Bool → PartitionCertificate →
      Array Nat → Array Bool × PartitionCertificate × Array Nat
  | 0, _, seen, certificate, queue => (seen, certificate, queue)
  | fuel + 1, index, seen, certificate, queue =>
      if stop ≤ index then (seen, certificate, queue)
      else
        let target := arrayGet adjacency.targets index count
        if target < count && !arrayGet seen target true &&
            arrayGet representatives source count = arrayGet representatives target count then
          let edge := arrayGet adjacency.edges index (links.size / 2)
          let nextSeen := seen.setIfInBounds target true
          let nextCertificate := {
            parent := certificate.parent.setIfInBounds target source
            depth := certificate.depth.setIfInBounds target
              (arrayGet certificate.depth source 0 + 1)
            edge := certificate.edge.setIfInBounds target edge
          }
          scanCertificateNeighbors count source stop adjacency links representatives fuel index.succ
            nextSeen nextCertificate (queue.push target)
        else
          scanCertificateNeighbors count source stop adjacency links representatives fuel index.succ
            seen certificate queue

private def certificateLoop (count : Nat) (adjacency : Adjacency) (links representatives : Array Nat) :
    Nat → Nat → Array Bool → PartitionCertificate → Array Nat → PartitionCertificate
  | 0, _, _, certificate, _ => certificate
  | fuel + 1, head, seen, certificate, queue =>
      if queue.size ≤ head then certificate
      else
        let source := arrayGet queue head count
        let first := arrayGet adjacency.offsets source 0
        let stop := arrayGet adjacency.offsets source.succ first
        let scanned := scanCertificateNeighbors count source stop adjacency links representatives
          (stop - first + 1) first seen certificate queue
        certificateLoop count adjacency links representatives fuel head.succ scanned.1 scanned.2.1 scanned.2.2

def buildPartitionCertificate (count : Nat) (links certificateLinks certificateEdges
    representatives : Array Nat) :
    PartitionCertificate :=
  let adjacency := buildAdjacency count certificateLinks certificateEdges
  let empty : PartitionCertificate := {
    parent := Array.replicate count count
    depth := Array.replicate count 0
    edge := Array.replicate count (links.size / 2)
  }
  let roots := (List.range count).filter fun vertex => arrayGet representatives vertex count = vertex
  let seeded := roots.foldl (fun state root =>
    (state.1.setIfInBounds root true, {
      state.2.1 with parent := state.2.1.parent.setIfInBounds root root
    }, state.2.2.push root)) (Array.replicate count false, empty, #[])
  certificateLoop count adjacency links representatives count 0 seeded.1 seeded.2.1 seeded.2.2

def edgeMatches (links : Array Nat) (edge source target : Nat) : Bool :=
  let index := edge * 2
  index + 1 < links.size &&
    let left := arrayGet links index 0
    let right := arrayGet links (index + 1) 0
    ((left = source && right = target) || (left = target && right = source))

def certificateVertexCheck (count : Nat) (links representatives : Array Nat)
    (certificate : PartitionCertificate) (vertex : Nat) : Bool :=
  let representative := arrayGet representatives vertex count
  let parent := arrayGet certificate.parent vertex count
  if representative = vertex then parent = vertex && arrayGet certificate.depth vertex 1 = 0
  else parent < count &&
    arrayGet representatives parent count = representative &&
    arrayGet certificate.depth parent count < arrayGet certificate.depth vertex 0 &&
    edgeMatches links (arrayGet certificate.edge vertex (links.size / 2)) vertex parent

def allFrom (predicate : Nat → Bool) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, index => predicate index && allFrom predicate fuel index.succ

def partitionCertificateCheck (count : Nat) (links : Array Nat)
    (certified : CertifiedPartition) : Bool :=
  let result := certified.result
  let certificate := certified.certificate
  result.representatives.size = count && result.parent.size = count && result.size.size = count &&
    certificate.parent.size = count && certificate.depth.size = count &&
    certificate.edge.size = count &&
    allFrom (certificateVertexCheck count links result.representatives certificate) count 0 &&
    allFrom (fun edge =>
      let index := edge * 2
      arrayGet result.representatives (arrayGet links index count) count =
        arrayGet result.representatives (arrayGet links (index + 1) count) count)
      (links.size / 2) 0

def certifiedPartition (count : Nat) (links : Array Nat) : Option CertifiedPartition :=
  let built := processLinksDetailed count links
  let state := compressAll count built.forest
  let result : PartitionResult := {
    representatives := representatives count state
    parent := state.parent
    size := state.size
  }
  let certificate := buildPartitionCertificate count links built.selectedLinks built.selectedEdges
    result.representatives
  let certified : CertifiedPartition := { result := result, certificate := certificate }
  if partitionCertificateCheck count links certified then some certified else none

def linksValid (count : Nat) (links : Array Nat) : Bool :=
  links.size % 2 = 0 && links.all fun vertex => vertex < count

def operationsValid (count : Nat) (operations : Array Nat) : Bool :=
  operations.size % 3 = 0 &&
    (List.range (operations.size / 3)).all fun operation =>
      let index := operation * 3
      let opcode := arrayGet operations index 2
      let left := arrayGet operations (index + 1) count
      let right := arrayGet operations (index + 2) count
      (opcode = 0 || opcode = 1) && left < count && right < count

structure OperationState where
  forest : State
  queries : Array Nat

def processOperationsFrom (count : Nat) (operations : Array Nat) :
    Nat → Nat → OperationState → OperationState
  | 0, _, state => state
  | fuel + 1, index, state =>
      if index + 2 < operations.size then
        let opcode := arrayGet operations index 2
        let left := arrayGet operations (index + 1) count
        let right := arrayGet operations (index + 2) count
        if opcode = 0 then
          processOperationsFrom count operations fuel (index + 3)
            { state with forest := union count left right state.forest }
        else
          let leftResult := findCompress count left state.forest
          let rightResult := findCompress count right leftResult.2
          processOperationsFrom count operations fuel (index + 3) {
            forest := rightResult.2
            queries := state.queries.push (if leftResult.1 = rightResult.1 then 1 else 0)
          }
      else state

structure OperationResult where
  queries : Array Nat
  partition : PartitionResult
deriving Repr, DecidableEq

def runOperations (count : Nat) (operations : Array Nat) : OperationResult :=
  let processed := processOperationsFrom count operations (operations.size / 3) 0 {
    forest := State.initial count
    queries := #[]
  }
  let compressed := compressAll count processed.forest
  {
    queries := processed.queries
    partition := {
      representatives := representatives count compressed
      parent := compressed.parent
      size := compressed.size
    }
  }

def serializePartition (result : PartitionResult) : Array Nat :=
  result.representatives ++ result.parent ++ result.size

def serializeOperations (result : OperationResult) : Array Nat :=
  #[result.queries.size] ++ result.queries ++ serializePartition result.partition

@[export lean_union_find_partition]
def solvePartition (count : UInt32) (links : Array Nat) : Array Nat :=
  let total := count.toNat
  if linksValid total links then
    match certifiedPartition total links with
    | some certified => serializePartition certified.result
    | none => #[]
  else #[]

@[export lean_union_find_operations]
def solveOperations (count : UInt32) (operations : Array Nat) : Array Nat :=
  let total := count.toNat
  if operationsValid total operations then serializeOperations (runOperations total operations) else #[]

end LeanUnionFind
