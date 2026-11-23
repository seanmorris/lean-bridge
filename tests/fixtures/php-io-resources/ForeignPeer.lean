import Shared

namespace ForeignPeer
open Shared

def issue : IO Ticket :=
  return ⟨← Std.Mutex.new 7, "foreign", "extra field", ← IO.FS.Handle.mk "/dev/null" .read⟩
def aliasTicket (t : Ticket) : Ticket := t
def aliasBadge (b : Badge) : Badge := b
def label (t : Ticket) : String := t.label

end ForeignPeer
