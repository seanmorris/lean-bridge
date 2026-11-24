import Workshop

namespace Workers
open LeanBridge.Host.Ruby

def relay (b : Box) (f : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask (f b)

def fallback (b : Box) (f : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask do
    try f b catch _ => return b

def outcome (b : Box) : Task (Except Box UInt32) := Task.pure (.error b)
def reject (b : Box) : EIO Box (Task UInt32) := throw b
def checkPair (b : Box) (_n : UInt8) : Task Box := Task.pure b
def scalar (n : UInt32) : Task UInt32 := Task.pure (n + 1)
def weakEcho (v : Leaf) : Task Leaf := Task.pure v
def readLeaf (v : Leaf) : IO UInt32 := v.read
def plain (box : Box) : Box := box
def lifted (box : Box) : BaseIO Box := pure box

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
  throw (IO.userError "Ruby cursor ended")
def closeIO (_ : Cursor) : BaseIO Unit := pure ()

end Workers
