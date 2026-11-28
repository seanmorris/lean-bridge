import LeanBridge.Host.WitWasi

namespace Gauge
open LeanBridge.Host.WitWasi

def increase (box : Box) (amount : UInt32) : EIO String UInt32 := do
  let value ← box.getLevel.toEIO (fun _ => "read failed")
  (box.setLevel (value + amount)).toEIO (fun _ => "write failed")
  box.getLevel.toEIO (fun _ => "read failed")

def reject (box : Box) : EIO Box UInt32 := throw box

end Gauge
