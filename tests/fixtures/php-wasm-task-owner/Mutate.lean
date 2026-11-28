prelude
import Shared
namespace Mutate

def usingCallback (t : Shared.Ticket) (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error Shared.Ticket)) :=
  IO.asTask do
    let count ← f (← t.count.get)
    t.count.set count
    return t

end Mutate
