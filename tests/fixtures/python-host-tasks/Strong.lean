import LeanBridge.Host.Python
namespace Strong
open LeanBridge.Host.Python

def pinned (owner : Pinned) (n : UInt32) (f : Pinned → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask do return (← f owner) + n

end Strong
