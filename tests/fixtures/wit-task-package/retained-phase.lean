prelude
import Init.System.Promise
set_option autoImplicit false

namespace Meter

def through (factory leanError : Bool) (transform : UInt32 → IO UInt32) :
    IO (Task (Except IO.Error UInt32)) := do
  let call : IO UInt32 := do
    if leanError then throw (IO.userError "same message")
    transform 11
  if factory then
    let value ← call
    return Task.pure (.ok value)
  IO.asTask call

end Meter
