import Depot

namespace Exchange
open Shared

def revisit (t : Ticket) (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error Ticket)) := IO.asTask do
  let n ← f (← t.counter.atomically get)
  t.counter.atomically (set n)
  return t

end Exchange
