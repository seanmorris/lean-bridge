prelude
import Init.System.Promise

namespace Jobs

def checked (rejectStart rejectValue : Bool) (v : UInt32) : EIO UInt32 (Task (Except UInt32 UInt32)) := do
  if rejectStart then throw v
  return Task.pure (if rejectValue then .error v else .ok (v + 7))

def ioStart (fail : Bool) : IO (Task UInt32) := do
  if fail then throw (IO.userError "factory failed")
  return Task.pure 41

def terminal (fail : Bool) : BaseIO (Task (Except IO.Error UInt32)) := BaseIO.asTask do
  return if fail then .error (IO.userError "worker failed") else .ok 97

initialize pending : IO.Ref (Option (IO.Promise UInt32)) ← IO.mkRef none

def hold : BaseIO (Task UInt32) := do
  let gate ← IO.Promise.new
  pending.set (some gate)
  BaseIO.asTask do
    let some v ← IO.wait gate.result? | return 0
    return if ← IO.checkCanceled then 1001 else v

def release (v : UInt32) : IO Unit := do
  if let some gate ← pending.get then gate.resolve v
  pending.set none

initialize closed : IO.Ref UInt32 ← IO.mkRef 0
def closes : IO UInt32 := closed.get

structure Cursor where
  position : IO.Ref UInt32
  count : UInt32

def series (count : UInt32) : IO Cursor := do return ⟨← IO.mkRef 0, count⟩
def next (c : Cursor) : BaseIO (Task (Except UInt16 (Option UInt32))) := do
  let n ← c.position.get
  c.position.set (n + 1)
  if c.count == 413 then return Task.pure (.error 413)
  return Task.pure (.ok (if n < c.count then some n else none))
def close (_ : Cursor) : BaseIO Unit := closed.modify (· + 1)

end Jobs
