import LeanBridge.Host.Cpp

namespace Workshop
open LeanBridge.Host.Cpp

def childOf (box : Box) : IO Dial := box.child
def preferDial (box : Box) (dial : Dial) : IO Dial := box.prefer dial
def keepDial (box : Box) (dial : Dial) : IO UInt32 := box.keep dial
def takeDial (box : Box) (dial : Dial) : IO UInt32 := box.takeOwned dial
def readDial (dial : Dial) : IO UInt32 := dial.read
def leasedDial (dial : Dial) : IO Dial := dial.leased
def exactInt (i : Int) : IO Int := pure i
def innerRead (box : Box) : IO UInt32 := do
  let dial ← box.child
  dial.read

end Workshop
