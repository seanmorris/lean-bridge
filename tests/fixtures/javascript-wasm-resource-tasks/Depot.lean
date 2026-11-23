prelude
import Shared
namespace Depot
open Shared
def make (value : UInt32) : IO Ticket := return ⟨value, ← IO.mkRef value⟩
def badge (value : UInt32) : IO Badge := return ⟨value, ← IO.mkRef value⟩
def read (t : Ticket) : IO UInt32 := t.count.get
def alias (t : Ticket) : IO Ticket := pure t
def checked (reject : Bool) (t : Ticket) : EIO Ticket (Task Ticket) := do
  if reject then throw t
  return Task.pure t
initialize gate : IO.Ref (Option (IO.Promise UInt32)) ← IO.mkRef none
def pending (t : Ticket) : BaseIO (Task Ticket) := do
  let next ← IO.Promise.new
  gate.set (some next)
  BaseIO.asTask do
    if let some n ← IO.wait next.result? then t.count.modify (· + n)
    return t
def release (n : UInt32) : IO Unit := do
  if let some p ← gate.get then p.resolve n
  gate.set none
structure Cursor where
  ticket : Ticket
  first : IO.Ref Bool
  reject : Bool
def stream (t : Ticket) (reject : Bool) : IO Cursor := return ⟨t,← IO.mkRef true,reject⟩
def next (c : Cursor) : BaseIO (Task (Except Ticket (Option Ticket))) := do
  let first ← c.first.get
  c.first.set false
  return Task.pure (if first then .ok (some c.ticket) else if c.reject then .error c.ticket else .ok none)
initialize closed : IO.Ref UInt32 ← IO.mkRef 0
def close (_ : Cursor) : BaseIO Unit := closed.modify (· + 1)
def closes : IO UInt32 := closed.get
end Depot
