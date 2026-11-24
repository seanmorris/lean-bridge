import LeanBridge.Host.Php

namespace Workshop
open LeanBridge.Host.Php

-- Only this immediate export invokes a PHP member directly.
def read (box : Box) : IO UInt32 := box.read

def relay (box : Box) (first second : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask do second (← first box)

def project (box : Box) (f : Box → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask (f box)

def select (n : UInt32) (f : UInt32 → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask (f n)

def either (box : Box) : Task (Except Box UInt32) := Task.pure (.error box)
def checked (box : Box) : EIO Box (Task UInt32) := throw box

structure Cursor where
  box : Box
  pending : IO.Ref Bool

def openCursor (box : Box) : BaseIO Cursor := return ⟨box, ← IO.mkRef true⟩
def pull (c : Cursor) : BaseIO (Task (Except Box (Option Box))) :=
  BaseIO.asTask do
    if ← c.pending.swap false then return .ok (some c.box)
    return .error c.box
def close (_ : Cursor) : BaseIO Unit := pure ()

def openBroken (box : Box) : BaseIO Cursor := openCursor box
def pullBroken (_ : Cursor) : BaseIO (Task (Except IO.Error (Option Box))) :=
  IO.asTask (throw (IO.userError "cursor failed"))
def closeBroken (_ : Cursor) : BaseIO Unit := pure ()

def faulty (box : Box) (f : Box → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask do
    let _ ← f box
    throw (IO.userError "worker failed")

def prepare (box : Box) (f : Box → IO UInt32) (refuse : Bool) : IO (Task (Except IO.Error UInt32)) := do
  if refuse then throw (IO.userError "factory refused")
  IO.asTask (f box)

end Workshop
