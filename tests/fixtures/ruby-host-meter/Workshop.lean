import LeanBridge.Host.Ruby

namespace Workshop
open LeanBridge.Host.Ruby

def make (value : UInt32) : IO Box := Box.create value
def read (box : Box) : IO UInt32 := box.read
def update (box : Box) (value : UInt32) : IO UInt32 := do
  box.setLevel value
  box.getLevel
def identity (box : Box) : IO Box := box.identity
def mapped (box : Box) : EIO String UInt32 :=
  box.read.toEIO (fun _ => "host read failed")

end Workshop
