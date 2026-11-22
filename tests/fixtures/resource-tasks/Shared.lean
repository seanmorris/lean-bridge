import Std.Sync.Mutex

namespace Shared

structure Ticket where
  counter : Std.Mutex UInt32
  label : String
  descriptor : IO.FS.Handle

structure Badge where
  counter : Std.Mutex UInt32
  label : String

end Shared
