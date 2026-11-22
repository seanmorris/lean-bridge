import Shared

namespace Desk
open Shared

def issue (n : UInt32) : IO Ticket :=
  return ⟨← Std.Mutex.new n, "desk", ← IO.FS.Handle.mk "/dev/null" .read⟩
def badge (n : UInt32) : IO Badge := return ⟨← Std.Mutex.new n, "badge"⟩
def count (t : Ticket) : IO UInt32 := t.counter.atomically get
def checkTicket (reject : Bool) (t : Ticket) : EIO Ticket Ticket :=
  if reject then throw t else pure t

end Desk
