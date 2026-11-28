import Retained

namespace CppTasks

def factory (f : UInt32 → IO UInt32) (reject : Bool) : IO (Task (Except IO.Error UInt32)) := do
  if reject then throw (IO.userError "early factory IO")
  IO.asTask (f 9)

def localFactory (reject : Bool) : IO (Task (Except IO.Error UInt32)) := do
  if reject then throw (IO.userError "eager factory IO")
  IO.asTask (pure 11)

def park : BaseIO (Task UInt32) := BaseIO.asTask do
  while !(← IO.checkCanceled) do IO.sleep 2
  return 0

end CppTasks
