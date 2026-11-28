import Workshop.Internal
namespace Workshop
open LeanBridge.Host.Python
def readLevel (box : Box) : IO UInt32 := Internal.level box
end Workshop
