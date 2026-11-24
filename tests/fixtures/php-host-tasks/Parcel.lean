import LeanBridge.Host.Php

namespace Workshop

-- The same copied bytes have a checked PHP representation and temporary C
-- storage. They count once, not twice, against the wire's aggregate limit.
def countBytes (box : LeanBridge.Host.Php.Box) (payload : ByteArray) : Task UInt32 :=
  let _ := box
  Task.pure payload.size.toUInt32

end Workshop
