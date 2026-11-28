import Shared

namespace Depot
open Shared

def make (n : UInt32) (label : String) : IO Ticket :=
  return ⟨← Std.Mutex.new n, label, ← IO.FS.Handle.mk "/dev/null" .read⟩
def badge (n : UInt32) : IO Badge := return ⟨← Std.Mutex.new n, "badge"⟩
def count (t : Ticket) : IO UInt32 := t.counter.atomically get
def add (t : Ticket) (n : UInt32) : IO Unit := t.counter.atomically (modify (· + n))
def alias (t : Ticket) : IO Ticket := pure t

initialize gate : Std.Mutex Bool ← Std.Mutex.new false
initialize phase : Std.Mutex UInt32 ← Std.Mutex.new 0
initialize closed : Std.Mutex UInt32 ← Std.Mutex.new 0
def state : IO UInt32 := phase.atomically get
private def mark (n : UInt32) : BaseIO Unit := phase.atomically (set n)
def reset : IO Unit := do gate.atomically (set false); mark 0
def release : IO Unit := gate.atomically (set true)
def closes : IO UInt32 := closed.atomically get

def pending (t : Ticket) (cooperate : Bool) : BaseIO (Task Ticket) := BaseIO.asTask do
  mark 1
  repeat
    if cooperate && (← IO.checkCanceled) then
      mark 2
      return t
    if ← gate.atomically get then break
    IO.sleep 1
  t.counter.atomically (modify (· + 1))
  mark 3
  return t

def checked (reject : Bool) (t : Ticket) : EIO Ticket (Task Ticket) := do
  if reject then throw t
  return Task.pure t

structure Cursor where
  t : Ticket
  reject : Bool
  first : Std.Mutex Bool

def tickets (t : Ticket) (reject : Bool) : IO Cursor := return ⟨t, reject, ← Std.Mutex.new true⟩
def next (c : Cursor) : BaseIO (Task (Except Ticket (Option Ticket))) := BaseIO.asTask do
  if ← c.first.atomically (do let v ← get; set false; return v) then return .ok (some c.t)
  if c.reject then return .error c.t
  return .ok none
def close (c : Cursor) : BaseIO Unit := do
  closed.atomically (modify (· + 1))
  if c.t.label == "retire-probe" then
    let _ ← (IO.FS.writeFile "retired-close-ran.txt" "user close ran").toBaseIO
    pure ()

end Depot
