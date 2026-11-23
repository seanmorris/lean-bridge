prelude
import Init.System.Promise
import Init.Data.SInt.Basic
set_option autoImplicit false
namespace Meter

initialize waiting : IO.Ref (Option (IO.Promise Bool)) ← IO.mkRef none

def parked (value : Int64) : BaseIO (Task Int64) := do
  let gate ← IO.Promise.new
  waiting.set (some gate)
  BaseIO.asTask do
    let _ ← IO.wait gate.result?
    return value

def resume : BaseIO (Task Bool) := do
  if let some gate ← waiting.get then
    gate.resolve true
    waiting.set none
    return Task.pure true
  return Task.pure false

def immediate (value : UInt32) : Task UInt32 := Task.pure (value + 1)

end Meter
