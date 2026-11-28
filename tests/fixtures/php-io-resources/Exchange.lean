import Shared

namespace Exchange
open Shared

def choose (reject : Bool) (t : Ticket) : EIO Ticket Ticket :=
  if reject then throw t else pure t

end Exchange
