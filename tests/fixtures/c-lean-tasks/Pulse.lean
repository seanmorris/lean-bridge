import Std.Sync.Mutex

namespace Pulse

initialize gate : Std.Mutex Bool ← Std.Mutex.new false
initialize phase : Std.Mutex UInt32 ← Std.Mutex.new 0
initialize requested : Std.Mutex UInt32 ← Std.Mutex.new 0
initialize closed : Std.Mutex UInt32 ← Std.Mutex.new 0
private def mark (v : UInt32) : BaseIO Unit := phase.atomically (set v)
def reset : IO Unit := do gate.atomically (set false); mark 0
def release : IO Unit := gate.atomically (set true)
def state : IO UInt32 := phase.atomically get
def pulls : IO UInt32 := requested.atomically get
def closes : IO UInt32 := closed.atomically get

private def waitForGate (cooperate : Bool) : BaseIO Unit := do
  mark 1
  repeat
    if cooperate && (← IO.checkCanceled) then mark 2; return
    if ← gate.atomically get then mark 3; return
    IO.sleep 2

def late (cooperate : Bool) (v : Int64) : BaseIO (Task Int64) := BaseIO.asTask do
  waitForGate cooperate
  return v

def bytes (v : ByteArray) : Task ByteArray := Task.pure v
def checked (rejectStart rejectValue : Bool) (text : String) : EIO String (Task (Except String UInt32)) := do
  if rejectStart then throw text
  return Task.pure (if rejectValue then .error text else .ok 42)
def ioTask (reject : Bool) : IO (Task Unit) := do
  if reject then throw (IO.userError "IO refusal")
  return Task.pure ()

structure Cursor where
  position : Std.Mutex UInt32
  fail : Bool
  paused : Bool
  label : String
def series (fail paused : Bool) (label : String) : IO Cursor := do
  return ⟨← Std.Mutex.new 0, fail, paused, label⟩
def next (c : Cursor) : BaseIO (Task (Except UInt16 (Option (Except String UInt32)))) := BaseIO.asTask do
  requested.atomically (modify (· + 1))
  if c.paused then waitForGate false
  let n ← c.position.atomically do let n ← get; set (n + 1); return n
  if n == 0 then return .ok (some (.error c.label))
  if n == 1 && c.fail then return .error 413
  if n == 1 then return .ok (some (.ok 73))
  return .ok none
def close (_ : Cursor) : BaseIO Unit := closed.atomically (modify (· + 1))

end Pulse
