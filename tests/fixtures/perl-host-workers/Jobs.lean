import Workshop

namespace Jobs
open LeanBridge.Host.Perl

def echo (box : Box) : BaseIO (Task Box) := BaseIO.asTask (pure box)
def scalar (n : UInt32) : Task UInt32 := Task.pure (n + 1)
def relay (box : Box) (visit : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask (visit box)
def recover (box : Box) (visit : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask do try visit box catch _ => pure box
def refuse (box : Box) : EIO Box (Task UInt32) := throw box
def outcome (box : Box) : Task (Except Box UInt32) := Task.pure (.error box)

structure Cursor where
  box : Box
  fail : Bool
  first : IO.Ref Bool
def boxes (box : Box) (fail : Bool) : BaseIO Cursor := return ⟨box, fail, ← IO.mkRef true⟩
def next (c : Cursor) : BaseIO (Task (Except Box (Option Box))) := BaseIO.asTask do
  if ← c.first.swap false then return .ok (some c.box)
  return if c.fail then .error c.box else .ok none
def close (_ : Cursor) : BaseIO Unit := pure ()

def ioBoxes (box : Box) : BaseIO Cursor := boxes box true
def ioNext (c : Cursor) : BaseIO (Task (Except IO.Error (Option Box))) := IO.asTask do
  if ← c.first.swap false then return some c.box
  throw (IO.userError "Perl cursor ended")
def ioClose (_ : Cursor) : BaseIO Unit := pure ()
end Jobs
