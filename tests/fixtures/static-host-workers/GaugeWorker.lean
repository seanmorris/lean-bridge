import LeanBridge.Host.WitWasi

namespace Gauge
open LeanBridge.Host.WitWasi

structure Cursor where
  box : Box
  gate : IO.Promise Bool

initialize active : IO.Ref (Option (IO.Promise Bool)) ← IO.mkRef none
initialize pulls : IO.Ref UInt32 ← IO.mkRef 0
initialize closes : IO.Ref UInt32 ← IO.mkRef 0

def finite (box : Box) : BaseIO Cursor := do
  let gate ← IO.Promise.new
  active.set (some gate)
  return ⟨box, gate⟩

def next (cursor : Cursor) : BaseIO (Task (Option Box)) := do
  pulls.modify (· + 1)
  return cursor.gate.result?.map (fun _ => some cursor.box)

def finish (_ : Cursor) : BaseIO Unit := closes.modify (· + 1)

def release : BaseIO UInt32 := do
  if let some gate ← active.swap none then gate.resolve true
  return ← closes.get

def counts : BaseIO UInt64 := do
  return (← pulls.get).toUInt64 * 4294967296 + (← closes.get).toUInt64

def read (box : Box) : IO UInt32 := box.getLevel

end Gauge
