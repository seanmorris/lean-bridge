prelude
import LeanBridge.Host.Php

namespace Workshop
open LeanBridge.Host.Php

def makeBox (v : UInt32) : IO Box := Box.create v
def fromClass (v : UInt32) : IO Box := Box.fromValue v
def getLevel (box : Box) : IO UInt32 := box.getLevel
def setLevel (box : Box) (v : UInt32) : IO Unit := box.setLevel v
def sameBox (box : Box) : IO Box := box.identity
def recoverRead (box : Box) : IO UInt32 := do
  try box.read catch _ => pure 99

end Workshop
