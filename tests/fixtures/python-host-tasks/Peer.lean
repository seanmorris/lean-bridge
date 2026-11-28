import Workshop
namespace Peer
open LeanBridge.Host.Python

def exchange (value : Box) (reply : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask (reply value)

end Peer
