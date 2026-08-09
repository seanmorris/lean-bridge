import SpatialConsumer

open LeanBridge.Performance

private def assertEqual [BEq α] [Repr α] (label : String) (actual expected : α) : IO Unit :=
  if actual == expected then pure ()
  else throw <| IO.userError s!"{label}: expected {repr expected}, received {repr actual}"

private def expectRight [Repr ε] (label : String) : Except ε α → IO α
  | .ok value => pure value
  | .error error => throw <| IO.userError s!"{label}: received {repr error}"

private def point (id : UInt32) (coordinates : Array Int32) : Point :=
  { id, coordinates }

def main : IO Unit := do
  let points := #[
    point 10 #[-3, 4],
    point 11 #[0, 0],
    point 12 #[0, 7],
    point 13 #[2, -1],
    point 14 #[2, -1],
    point 15 #[9, 9]
  ]
  assertEqual "lower bound before" (pointLowerBound points #[-4, 99]) 0
  assertEqual "lower bound duplicate" (pointLowerBound points #[2, -1]) 3
  assertEqual "lower bound after" (pointLowerBound points #[10, 0]) 6

  let index ← expectRight "build" (buildIndex 2 points)
  assertEqual "initial size" (indexSize index) 6
  let nearestInitial ← expectRight "nearest initial" (nearest index #[1, 0])
  assertEqual "nearest initial id" nearestInitial.pointId 11
  assertEqual "nearest initial distance" nearestInitial.squaredDistance 1
  let nearestDuplicate ← expectRight "nearest duplicate" (nearest index #[2, -1])
  assertEqual "nearest duplicate id" nearestDuplicate.pointId 13

  let rangeInitial ← expectRight "range initial" (range index #[0, -1] #[2, 7])
  assertEqual "range initial ids" rangeInitial #[11, 12, 13, 14]
  let updated ← expectRight "insert" (insert index (point 16 #[1, 1]))
  assertEqual "updated size" (indexSize updated) 7
  let nearestUpdated ← expectRight "nearest updated" (nearest updated #[1, 1])
  assertEqual "nearest updated id" nearestUpdated.pointId 16

  let consumed ← expectRight "consumer handoff" (rangeChecksum updated #[0, -1] #[2, 7])
  assertEqual "consumer ids" consumed.pointIds #[11, 12, 13, 14, 16]
  assertEqual "consumer checksum" consumed.checksum 66
  IO.println "performance reference vectors passed"
