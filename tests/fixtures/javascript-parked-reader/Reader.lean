prelude
import Init.System.Promise

namespace Reader

structure Cursor where
  offset : UInt32
  entered : IO.Promise UInt32
  gate : IO.Promise UInt32
  finished : IO.Promise UInt32

-- Only the owner agent accesses these refs. Workers communicate by resolving
-- promises, and never mutate the state used by another worker or the owner.
initialize current : IO.Ref (Option Cursor) ← IO.mkRef none
initialize requested : IO.Ref UInt32 ← IO.mkRef 0
initialize finalized : IO.Ref UInt32 ← IO.mkRef 0

def openCursor (offset : UInt32) : IO Cursor := do
  let cursor := Cursor.mk offset (← IO.Promise.new) (← IO.Promise.new) (← IO.Promise.new)
  current.set (some cursor)
  return cursor

def next (c : Cursor) : BaseIO (Task (Except UInt16 (Option UInt32))) := do
  requested.modify (· + 1)
  BaseIO.asTask do
    c.entered.resolve 1
    -- Deliberately noncooperative. Cancelling delivery must not free c or
    -- resurrect the cancelled reader when this worker eventually finishes.
    let n := (← IO.wait c.gate.result?).getD 0
    let item := n + c.offset
    c.finished.resolve item
    return .ok (some item)

def close (_ : Cursor) : BaseIO Unit := finalized.modify (· + 1)
def pulls : IO UInt32 := requested.get
def closes : IO UInt32 := finalized.get
def entered : BaseIO (Task UInt32) := do
  let some c ← current.get | return Task.pure 0
  return c.entered.resultD 0
def finished : BaseIO (Task UInt32) := do
  let some c ← current.get | return Task.pure 0
  return c.finished.resultD 0
def release (n : UInt32) : IO Unit := do
  if let some c ← current.get then c.gate.resolve n
def sibling (n : UInt32) : Task UInt32 := Task.pure (n + 1)

end Reader
