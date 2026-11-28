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

structure Cursor where
  position : Std.Mutex Nat
  base : Nat
  count : Nat
  failAt : Nat
  paused : Bool
  cooperate : Bool
  label : String

structure Counts where
  opens : Nat := 0
  pulls : Nat := 0
  closes : Nat := 0
  deriving Inhabited

initialize counts : Std.Mutex Counts ← Std.Mutex.new {}
def opens : IO Nat := counts.atomically (return (← get).opens)
def pulls : IO Nat := counts.atomically (return (← get).pulls)
def closes : IO Nat := counts.atomically (return (← get).closes)

def series (base count failAt : Nat) (paused cooperate reject : Bool) (label : String) : EIO String Cursor := do
  if reject then throw label
  let position ← Std.Mutex.new 0
  counts.atomically (modify fun s => { s with opens := s.opens + 1 })
  return { position, base, count, failAt, paused, cooperate, label }

def nextSeries (c : Cursor) : BaseIO (Task (Except String (Option (Except String Nat)))) := BaseIO.asTask do
  counts.atomically (modify fun s => { s with pulls := s.pulls + 1 })
  let i ← c.position.atomically do let i ← get; set (i + 1); return i
  if c.paused then
    if let .error e ← step c.cooperate c.label then return .error e
  if i ≥ c.count then return .ok none
  if i == c.failAt then return .error c.label
  return .ok (some (if i % 2 == 0 then .ok (c.base + i) else .error c.label))

def closeSeries (_ : Cursor) : BaseIO Unit :=
  counts.atomically (modify fun s => { s with closes := s.closes + 1 })

structure UnitCursor where
  remaining : Std.Mutex Nat

def units (n : Nat) : BaseIO UnitCursor := return ⟨← Std.Mutex.new n⟩
def nextUnit (c : UnitCursor) : BaseIO (Task (Option Unit)) := do
  let value ← c.remaining.atomically do
    let n ← get
    if n == 0 then return none
    set (n - 1)
    return some ()
  return Task.pure value
def closeUnits (_ : UnitCursor) : BaseIO Unit := pure ()

end Timers
