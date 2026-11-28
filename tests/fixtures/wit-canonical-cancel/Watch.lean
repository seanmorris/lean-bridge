import Init.System.Promise

namespace Watch

structure Cursor where
  cooperate : Bool
  started : IO.Promise UInt32
  closed : IO.Promise UInt32
  release : IO.Promise Bool
  finished : IO.Promise UInt32
  closes : IO.Ref UInt32

initialize current : IO.Ref (Option Cursor) ← IO.mkRef none

def feed (cooperate : Bool) : BaseIO Cursor := do
  let c := Cursor.mk cooperate (← IO.Promise.new) (← IO.Promise.new)
    (← IO.Promise.new) (← IO.Promise.new) (← IO.mkRef 0)
  current.set (some c)
  return c

private def work (c : Cursor) : BaseIO (Option UInt32) := do
  c.started.resolve 1
  let _ ← IO.wait c.release.result?
  let cancelled ← IO.checkCanceled
  if cancelled && c.cooperate then
    c.finished.resolve 2
    return none
  -- A caller can abandon delivery, but cannot force uncooperative Lean code
  -- to stop. Distinguish cancelled late work from ordinary completion.
  c.finished.resolve (if cancelled then 3 else 4)
  return some 73

def advance (c : Cursor) : BaseIO (Task (Option UInt32)) := BaseIO.asTask (work c)

-- The standalone future has no cursor finalizer. The only way for the worker
-- to report 2 or 3 is for its own cancellation flag to have been set.
def watchTask (cooperate : Bool) : BaseIO (Task UInt32) := do
  let c ← feed cooperate
  BaseIO.asTask do return (← work c).getD 0

def ack (value : UInt32) : Task UInt32 := Task.pure value

def finish (c : Cursor) : BaseIO Unit := do
  c.closes.modify (· + 1)
  c.closed.resolve (← c.closes.get)

def event (which : UInt8) : BaseIO (Task UInt32) := do
  let some c ← current.get | return Task.pure 0
  let p := if which == 0 then c.started else if which == 1 then c.closed else c.finished
  return p.resultD 0

def release : BaseIO UInt32 := do
  let some c ← current.get | return 99
  let n ← c.closes.get
  c.release.resolve true
  return n

def closes : BaseIO UInt32 := do
  let some c ← current.get | return 99
  c.closes.get

end Watch
