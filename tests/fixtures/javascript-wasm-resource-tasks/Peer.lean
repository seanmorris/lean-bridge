prelude
import Shared
namespace Peer
def bump (t : Shared.Ticket) (n : UInt32) : IO (Task Shared.Ticket) := do
  t.count.modify (· + n)
  return Task.pure t
end Peer
