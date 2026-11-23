prelude
import Init.System.Promise
namespace Shared
structure Ticket where
  issuedAt : UInt32
  count : IO.Ref UInt32
structure Badge where
  level : UInt32
  count : IO.Ref UInt32
end Shared
