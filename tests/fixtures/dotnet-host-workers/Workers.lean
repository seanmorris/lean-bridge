import Workshop

namespace Workers
open LeanBridge.Host.Dotnet

def identityNow (box : Box) : Box := box
def identityBase (box : Box) : BaseIO Box := pure box
def echo (box : Box) : Task Box := Task.pure box
def scalar (x : UInt32) : Task UInt32 := Task.pure (x + 1)
def relay (box : Box) (f : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask (f box)
def recover (box : Box) (f : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  IO.asTask do try f box catch _ => pure box
def outcome (box : Box) : Task (Except Box UInt32) := Task.pure (.error box)
def reject (box : Box) : EIO Box (Task UInt32) := throw box

structure Cursor where
  box : Box
  first : IO.Ref Bool
def series (box : Box) : BaseIO Cursor := return ⟨box, ← IO.mkRef true⟩
def next (cursor : Cursor) : BaseIO (Task (Except Box (Option Box))) := BaseIO.asTask do
  if ← cursor.first.swap false then return .ok (some cursor.box)
  return .error cursor.box
def close (_ : Cursor) : BaseIO Unit := pure ()

def seriesIO (box : Box) : BaseIO Cursor := series box
def nextIO (cursor : Cursor) : BaseIO (Task (Except IO.Error (Option Box))) := IO.asTask do
  if ← cursor.first.swap false then return some cursor.box
  throw (IO.userError "CLR cursor ended")
def closeIO (_ : Cursor) : BaseIO Unit := pure ()
end Workers
