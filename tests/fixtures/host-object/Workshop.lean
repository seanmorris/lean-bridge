import LeanBridge.Host.Python

namespace Workshop
open LeanBridge.Host.Python

def make (n : UInt32) : IO Box := Box.box n
def alias (box : Box) : IO Box := box.identity
def read (box : Box) : IO UInt32 := box.read
def setLevel (box : Box) (n : UInt32) : IO Unit := box.setLevel n
def scale (box : Box) (n : Float32) : IO Float32 := box.scale n
def finish (box : Box) : IO UInt32 := box.finish
def live : IO UInt32 := Box.live
def same (a b : Box) : IO Bool := a.sameAs b
def replaceError (box : Box) : IO Unit := do
  try box.setLevel 999 catch _ => throw (IO.userError "replacement from Lean")
initialize held : IO.Ref (Option Box) ← IO.mkRef none
def keep (box : Box) : IO Unit := held.set (some box)
def readHeld : IO UInt32 := do
  let some box ← held.get | throw (IO.userError "no saved box")
  box.read
def forget : IO Unit := held.set none

end Workshop
