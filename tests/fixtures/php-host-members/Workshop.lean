import LeanBridge.Host.Php

namespace Workshop
open LeanBridge.Host.Php

def make (value : UInt32) : IO Box := Box.create value
def read (box : Box) : IO UInt32 := box.read
def update (box : Box) (value : UInt32) : IO UInt32 := do
  box.setLevel value
  box.getLevel
def identity (box : Box) : IO Box := box.identity
def mapped (box : Box) : EIO String UInt32 :=
  box.read.toEIO (fun _ => "host read failed")

-- The object in a successful value and the object in a thrown error have
-- the same nominal type, but they travel through different channels.
def choose (box : Box) (yes : Bool) : Except UInt32 Box :=
  if yes then .ok box else .error 17
def failWith (box : Box) : EIO Box UInt32 := throw box

end Workshop
