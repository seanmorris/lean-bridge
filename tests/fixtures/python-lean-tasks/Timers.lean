import Std.Sync.Mutex

namespace Timers

def immediate (n : Nat) : Task Nat := Task.pure (n + 1)
def compute (v : String) : Task String := Task.spawn fun _ => v ++ "!"
def later (n : Nat) : BaseIO (Task Nat) := BaseIO.asTask do
  IO.sleep 15
  return n * 3

initialize gate : Std.Mutex Bool ← Std.Mutex.new false
initialize phase : Std.Mutex UInt32 ← Std.Mutex.new 0

private def mark (v : UInt32) : BaseIO Unit := phase.atomically (set v)

def reset : IO Unit := do gate.atomically (set false); mark 0
def release : IO Unit := gate.atomically (set true)
def state : IO UInt32 := phase.atomically get

def step (cooperate : Bool) (v : String) : BaseIO (Except String String) := do
  mark 1
  for _ in [:30000] do
    if cooperate && (← IO.checkCanceled) then
      mark 2
      return .error "cancelled in Lean"
    if ← gate.atomically get then
      mark 3
      return .ok v
    IO.sleep 2
  mark 4
  return .error "gate timed out"

def openTask (cooperate : Bool) (v : String) : IO (Task (Except String String)) :=
  BaseIO.asTask (step cooperate v)

def startChecked (rejectStart rejectValue : Bool) (v : String) : EIO String (Task (Except String Nat)) := do
  if rejectStart then throw v
  return Task.pure (if rejectValue then .error v else .ok v.length)

def startIO (reject : Bool) : IO (Task UInt32) := do
  if reject then throw (IO.userError "start refused")
  return Task.pure 47

end Timers
