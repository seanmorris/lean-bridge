import Workshop

namespace Workers
open LeanBridge.Host.Python

def relay (box : Box) (f : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask (f box)

def project (box : Box) (f : Box → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask (f box)

def fallback (box : Box) (f : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask do
    try f box catch _ => return box

def choose (value : UInt32) (f : UInt32 → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask (f value)

def outcome (box : Box) : Task (Except Box UInt32) := Task.pure (.error box)
def reject (box : Box) : EIO Box (Task UInt32) := throw box

structure Cursor where
  box : Box
  first : IO.Ref Bool

def openCursor (box : Box) : BaseIO Cursor := return ⟨box, ← IO.mkRef true⟩
def pull (c : Cursor) : BaseIO (Task (Except Box (Option Box))) := BaseIO.asTask do
  if ← c.first.swap false then return .ok (some c.box)
  return .error c.box
def close (_ : Cursor) : BaseIO Unit := pure ()

def openErrorCursor (box : Box) : BaseIO Cursor := openCursor box
def pullIO (c : Cursor) : BaseIO (Task (Except IO.Error (Option Box))) := IO.asTask do
  if ← c.first.swap false then return some c.box
  throw (IO.userError "worker cursor ended with IO.Error")
def closeIO (_ : Cursor) : BaseIO Unit := pure ()

def scalar (n : UInt32) : Task UInt32 := Task.pure (n + 1)

end Workers
