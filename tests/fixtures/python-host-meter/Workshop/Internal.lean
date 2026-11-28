import LeanBridge.Host.Python
namespace Workshop.Internal
open LeanBridge.Host.Python
def level (box : Box) : IO UInt32 := box.read
end Workshop.Internal
