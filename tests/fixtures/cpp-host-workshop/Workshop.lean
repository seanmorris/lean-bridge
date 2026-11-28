import LeanBridge.Host.Cpp

namespace Workshop
open LeanBridge.Host.Cpp

def make (value : UInt32) : IO Box := Box.create value
def read (box : Box) : IO UInt32 := box.read
def update (box : Box) (value : UInt32) : IO UInt32 := do
  box.setLevel value
  box.getLevel
def identity (box : Box) : IO Box := box.identity
def mapped (box : Box) : EIO String UInt32 := box.read.toEIO (fun _ => "host read failed")
def choose (box : Box) (yes : Bool) : Except UInt32 Box := if yes then .ok box else .error 17
def failWith (box : Box) : EIO Box UInt32 := throw box

def readOnline (box : Box) : IO UInt32 := do
  let n ← box.read
  if n == 0 then throw <| IO.userError "meter disconnected"
  return n
def text (box : Box) (s : String) : IO String := box.echoText s
def bytes (box : Box) (b : ByteArray) : IO ByteArray := box.echoBytes b
def shift (box : Box) (n : Int) : IO Int := box.shift n
def natural (n : Nat) : IO Nat := pure n
end Workshop
