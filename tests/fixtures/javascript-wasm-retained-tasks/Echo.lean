prelude
import Init.System.Promise
namespace Echo

def twice (n : UInt32) : UInt32 := 2 * n

def relay (n : UInt32) (f : UInt32 → IO UInt32) : IO (Task UInt32) := do
  return Task.pure (← f n)

end Echo
