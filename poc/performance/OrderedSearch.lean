namespace LeanBridge.Performance

structure Point where
  id : UInt32
  coordinates : Array Int32
deriving Repr, BEq, Inhabited

@[export lean_bridge_performance_make_point]
def makePoint (id : UInt32) (coordinates : Array Int32) : Point :=
  { id, coordinates }

def compareCoordinates : List Int32 → List Int32 → Ordering
  | [], [] => .eq
  | [], _ :: _ => .lt
  | _ :: _, [] => .gt
  | left :: leftTail, right :: rightTail =>
      match compare left right with
      | .eq => compareCoordinates leftTail rightTail
      | order => order

def comparePoint (left right : Point) : Ordering :=
  match compareCoordinates left.coordinates.toList right.coordinates.toList with
  | .eq => compare left.id right.id
  | order => order

private def lowerBoundLoop
    (points : Array Point)
    (query : Array Int32)
    (lower upper fuel : Nat) : Nat :=
  match fuel with
  | 0 => lower
  | fuel + 1 =>
      if lower < upper then
        let middle := lower + (upper - lower) / 2
        let point := points[middle]!
        if compareCoordinates point.coordinates.toList query.toList == .lt then
          lowerBoundLoop points query (middle + 1) upper fuel
        else
          lowerBoundLoop points query lower middle fuel
      else
        lower

@[export lean_bridge_performance_point_lower_bound]
def pointLowerBound (points : Array Point) (query : Array Int32) : UInt32 :=
  UInt32.ofNat (lowerBoundLoop points query 0 points.size (points.size + 1))

theorem pointLowerBound_empty (query : Array Int32) :
    pointLowerBound #[] query = 0 := by
  rfl

end LeanBridge.Performance
