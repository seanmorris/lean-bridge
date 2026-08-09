import SpatialIndex

namespace LeanBridge.Performance

structure RangeChecksum where
  pointIds : Array UInt32
  checksum : UInt64
deriving Repr, BEq

@[export lean_bridge_performance_range_checksum]
def rangeChecksum
    (index : SpatialIndex)
    (minimum maximum : Array Int32) : Except SpatialError RangeChecksum := do
  let pointIds ← range index minimum maximum
  return {
    pointIds
    checksum := pointIds.foldl (fun sum id => sum + id.toUInt64) 0
  }

end LeanBridge.Performance
