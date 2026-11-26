prelude
import Init.System.Promise

namespace Budget

def single (n : UInt32) (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask (f n)

-- The author gives f a single invocation and g the default (many).
def probe (n : UInt32) (f g : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask do
    let a ← f n
    let b ← g a
    let c ← g b
    f c

-- Catch the first failure inside Lean and try the same registration again.
def retry (n : UInt32) (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask do
    let _ ← try f n catch _ => pure n
    f n

-- The same JS function may be registered independently in both slots.
def pair (n : UInt32) (f g : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask do g (← f n)

end Budget
