import LeanBridge.Host.Python

namespace Workshop
open LeanBridge.Host.Python

def make (n : UInt32) : IO Box := Box.box n
def alias (box : Box) : IO Box := box.identity
def read (box : Box) : IO UInt32 := box.read
def setLevel (box : Box) (value : UInt32) : IO Unit := box.setLevel value
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

def checkedSet (box : Box) (value : UInt32) (label : String) : EIO String UInt32 := do
  (box.setLevel value).toEIO (fun _ => label)
  box.read.toEIO (fun _ => label)

def reportSet (box : Box) (value : UInt32) (label : String) : IO (Except String UInt32) :=
  (checkedSet box value label).toIO'

def setThenFail (box : Box) (value : UInt32) (label : String) : EIO String Unit := do
  let _ ← checkedSet box value label
  throw label

def choose (outer inner : Bool) (number : Int) (label : String) : Except Int (Except String UInt32) :=
  if outer then .error number else if inner then .ok (.error label) else .ok (.ok 42)

def typedChoice (outer inner : Bool) (number : Nat) (label : String) : EIO Nat (Except String UInt32) := do
  if outer then throw number
  return if inner then .error label else .ok 42

end Workshop
