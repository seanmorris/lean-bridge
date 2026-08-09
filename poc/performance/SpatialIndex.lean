import OrderedSearch

namespace LeanBridge.Performance

inductive SpatialError where
  | unsupportedDimension
  | dimensionMismatch
  | invalidRange
  | duplicatePointId
  | emptyIndex
deriving Repr, BEq

structure NearestResult where
  pointId : UInt32
  coordinates : Array Int32
  squaredDistance : UInt64
deriving Repr, BEq

structure SpatialIndex where
  dimensions : Nat
  points : Array Point
deriving Repr, BEq

private def supportedDimension (dimensions : Nat) : Bool :=
  dimensions == 2 || dimensions == 4 || dimensions == 8

private def validPoint (dimensions : Nat) (point : Point) : Bool :=
  point.coordinates.size == dimensions &&
    point.coordinates.all fun value => -32768 <= value && value <= 32767

private def uniqueIds : List Point → List UInt32 → Bool
  | [], _ => true
  | point :: tail, seen =>
      if seen.contains point.id then false
      else uniqueIds tail (point.id :: seen)

def buildIndex (dimensions : Nat) (points : Array Point) : Except SpatialError SpatialIndex := do
  if !supportedDimension dimensions then throw .unsupportedDimension
  if !points.all (validPoint dimensions) then throw .dimensionMismatch
  if !uniqueIds points.toList [] then throw .duplicatePointId
  return { dimensions, points := points.qsort fun left right => comparePoint left right == .lt }

@[export lean_bridge_performance_index_build]
def buildIndexExport (dimensions : UInt32) (points : Array Point) : Except SpatialError SpatialIndex :=
  buildIndex dimensions.toNat points

private def squaredDistanceList : List Int32 → List Int32 → Nat
  | left :: leftTail, right :: rightTail =>
      let difference := (left.toInt - right.toInt).natAbs
      difference * difference + squaredDistanceList leftTail rightTail
  | _, _ => 0

def squaredDistance (left right : Array Int32) : UInt64 :=
  UInt64.ofNat (squaredDistanceList left.toList right.toList)

private def chooseNearest
    (query : Array Int32)
    (best : Point × UInt64)
    (candidate : Point) : Point × UInt64 :=
  let distance := squaredDistance candidate.coordinates query
  if distance < best.2 || (distance == best.2 && candidate.id < best.1.id) then
    (candidate, distance)
  else
    best

@[export lean_bridge_performance_index_nearest]
def nearest (index : SpatialIndex) (query : Array Int32) : Except SpatialError NearestResult := do
  if query.size != index.dimensions then throw .dimensionMismatch
  match index.points.toList with
  | [] => throw .emptyIndex
  | first :: tail =>
      let result := tail.foldl (chooseNearest query) (first, squaredDistance first.coordinates query)
      return {
        pointId := result.1.id
        coordinates := result.1.coordinates
        squaredDistance := result.2
      }

private def insideRange : List Int32 → List Int32 → List Int32 → Bool
  | coordinate :: coordinates, minimum :: minimums, maximum :: maximums =>
      minimum <= coordinate && coordinate <= maximum &&
        insideRange coordinates minimums maximums
  | [], [], [] => true
  | _, _, _ => false

private def validRange : List Int32 → List Int32 → Bool
  | minimum :: minimums, maximum :: maximums =>
      minimum <= maximum && validRange minimums maximums
  | [], [] => true
  | _, _ => false

@[export lean_bridge_performance_index_range]
def range
    (index : SpatialIndex)
    (minimum maximum : Array Int32) : Except SpatialError (Array UInt32) := do
  if minimum.size != index.dimensions || maximum.size != index.dimensions then
    throw .dimensionMismatch
  if !validRange minimum.toList maximum.toList then throw .invalidRange
  return (index.points.foldl (fun ids point =>
    if insideRange point.coordinates.toList minimum.toList maximum.toList then
      ids.push point.id
    else ids) #[]).qsort (· < ·)

@[export lean_bridge_performance_index_insert]
def insert (index : SpatialIndex) (point : Point) : Except SpatialError SpatialIndex := do
  if !validPoint index.dimensions point then throw .dimensionMismatch
  if index.points.any fun candidate => candidate.id == point.id then throw .duplicatePointId
  return { index with points := (index.points.push point).qsort fun left right => comparePoint left right == .lt }

@[export lean_bridge_performance_index_size]
def indexSize (index : SpatialIndex) : UInt32 := UInt32.ofNat index.points.size

end LeanBridge.Performance
