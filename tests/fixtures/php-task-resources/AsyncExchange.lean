import Depot

namespace AsyncExchange
open Shared

def revisit (t : Ticket) (reject : Bool) : BaseIO (Task (Except IO.Error Ticket)) :=
  IO.asTask do
    if reject then throw (IO.userError "ticket unavailable")
    return t

end AsyncExchange
