import Shared

namespace LeaseFactory
open Shared

-- PHP may have closed its last handle before either branch returns.
def lend (ticket : Ticket) (accept : UInt32 → IO Bool) : EIO Ticket (Task Ticket) := do
  let counter ← ticket.counter.atomically get
  match ← (accept counter).toBaseIO with
  | .ok true => return Task.pure ticket
  | _ => throw ticket

end LeaseFactory
