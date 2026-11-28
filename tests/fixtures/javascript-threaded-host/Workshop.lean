prelude
import LeanBridge.Host.Javascript

namespace Workshop
open LeanBridge.Host.Javascript

def identity (b : Box) : IO Box := b.identity

def work (b : Box) (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  BaseIO.asTask <| (do
    let n ← b.read
    if n == 99 then throw (IO.userError "worker rejected 99")
    f n : IO UInt32).toBaseIO

def start (n : UInt32) : IO (Task Box) := do
  let b ← Box.create n
  if n == 99 then throw (IO.userError "factory rejected 99")
  pure (Task.pure b)

def either (b : Box) : Task (Except Box UInt32) := Task.pure (.error b)

def checked (b : Box) : EIO Box (Task UInt32) := throw b

structure Cursor where
  box : Box
  pending : IO.Ref Bool

def openCursor (b : Box) : BaseIO Cursor := do pure ⟨b, ← IO.mkRef true⟩
def pull (c : Cursor) : BaseIO (Task (Except IO.Error (Option Box))) :=
  BaseIO.asTask <| (do
    if !(← c.pending.swap false) then return none
    let b ← c.box.identity
    if (← b.read) == 99 then throw (IO.userError "cursor rejected 99")
    return some b : IO (Option Box)).toBaseIO
def close (c : Cursor) : BaseIO Unit := do
  discard <| (c.box.setLevel 0).toBaseIO

end Workshop
