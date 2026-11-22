namespace Parking

-- The callback is deliberately never called. Only broker retirement should
-- wake the C descriptor; closing the handle then cancels the parked worker.
def untilCanceled (callback : UInt32 → IO UInt32) : BaseIO (Task UInt32) := BaseIO.asTask do
  let _ := callback
  while !(← IO.checkCanceled) do IO.sleep 1
  return 0

end Parking
