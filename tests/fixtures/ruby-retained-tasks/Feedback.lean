import Retained

namespace Feedback

def once (n : UInt32) (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask (f n)

def early (reject : Bool) (f : UInt32 → IO UInt32) : IO (Task (Except IO.Error UInt32)) := do
  if reject then throw (IO.userError "early Ruby factory")
  IO.asTask (f 9)

end Feedback
