import Shared

namespace Counter
open Shared

def issue (n : UInt32) : IO Ticket :=
  return ⟨← Std.Mutex.new n, "counter", ← IO.FS.Handle.mk "/dev/null" .read⟩
def bump (t : Ticket) : IO Ticket := do
  t.counter.atomically (modify (· + 1))
  return t
def readBadge (b : Badge) : IO UInt32 := b.counter.atomically get
end Counter
