import Workshop

namespace Jobs
open LeanBridge.Host.Rust

def echo (box : Box) : Task Box := Task.pure box
def relay (box : Box) (f : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask (f box)
def reject (box : Box) : EIO Box (Task UInt32) := throw box
def outcome (box : Box) : Task (Except Box UInt32) := Task.pure (.error box)

structure Cursor where
  box : Box
  first : IO.Ref Bool
def series (box : Box) : BaseIO Cursor := return ⟨box, ← IO.mkRef true⟩
def next (c : Cursor) : BaseIO (Task (Except Box (Option Box))) := BaseIO.asTask do
  if ← c.first.swap false then return .ok (some c.box)
  return .error c.box
def close (_ : Cursor) : BaseIO Unit := pure ()

private def indirect (b : Box) := b.read
def forbidden (b : Box) := IO.asTask (indirect b)
def forbiddenPull (c : Cursor) : BaseIO (Task (Except IO.Error (Option Box))) := IO.asTask do
  let _ ← indirect c.box
  return some c.box

end Jobs
