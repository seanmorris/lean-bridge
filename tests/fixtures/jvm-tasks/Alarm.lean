import Std.Sync.Mutex
namespace Alarm
initialize gate : Std.Mutex Bool ← Std.Mutex.new false
def reset : IO Unit := gate.atomically (set false)
def release : IO Unit := gate.atomically (set true)
def wait (n : UInt32) : BaseIO (Task UInt32) := BaseIO.asTask do
  for _ in [:30000] do
    if (← IO.checkCanceled) || (← gate.atomically get) then break
    IO.sleep 2
  return n
def owner : IO String := IO.FS.readFile "/proc/thread-self/stat"
end Alarm
