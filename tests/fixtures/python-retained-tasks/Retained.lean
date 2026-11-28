import Std.Sync.Mutex

namespace Retained

def repeatCall (s : String) (f : String → IO String) : BaseIO (Task (Except IO.Error String)) :=
  IO.asTask do f (← f s)

-- Calls before and after task creation must both run Python on the owner loop.
def duringStart (f : String → IO String) (g : String → IO String) (s : String) :
    IO (Task (Except IO.Error String)) := do
  let first ← f s
  let worker ← IO.asTask (g first)
  let second ← match ← IO.wait worker with
    | .ok value => pure value
    | .error error => throw error
  IO.asTask (f second)

def recover (f : Nat → IO Nat) (n : Nat) : BaseIO (Task (Except String Nat)) := BaseIO.asTask do
  match ← (f n).toBaseIO with
  | .ok x => return .ok x
  | .error _ => return .error "caught in Lean"

def replaceError (f : Nat → IO Nat) : BaseIO (Task (Except IO.Error Nat)) := IO.asTask do
  try f 0 catch _ => throw (IO.userError "identical")

def typedStart (f : ByteArray → IO ByteArray) (reject : Bool) (v : ByteArray) :
    EIO String (Task (Except IO.Error ByteArray)) := do
  if reject then throw "factory refused"
  IO.asTask (f v)

def plain (n : UInt32) : IO UInt32 := pure (n + 1)
def terminal (reject : Bool) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask do if reject then throw (IO.userError "late IO") else return 42

initialize held : IO.Ref (Option (UInt32 → IO UInt32)) ← IO.mkRef none
def remember (f : UInt32 → IO UInt32) : IO (Task UInt32) := do
  held.set (some f)
  return Task.pure 17
def useExpired : BaseIO (Task (Except IO.Error UInt32)) := IO.asTask do
  let some f ← held.get | throw (IO.userError "missing closure")
  f 7
def forget : IO Unit := held.set none

initialize gate : Std.Mutex Bool ← Std.Mutex.new false
initialize phase : Std.Mutex UInt32 ← Std.Mutex.new 0
private def mark (n : UInt32) : BaseIO Unit := phase.atomically (set n)
def reset : IO Unit := do gate.atomically (set false); mark 0
def release : IO Unit := gate.atomically (set true)
def state : IO UInt32 := phase.atomically get
def queued (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) := IO.asTask do
  mark 3
  while !(← gate.atomically get) do IO.sleep 1
  try
    let n ← f 7
    mark 5
    return n
  catch e =>
    mark 4
    throw e
def cancelLate (f : UInt32 → IO UInt32) : IO (Task (Except IO.Error UInt32)) := do
  mark 1
  while !(← gate.atomically get) do IO.sleep 1
  IO.asTask do
    for _ in [:10000] do
      if ← IO.checkCanceled then mark 2; return 0
      IO.sleep 1
    f 99

-- One real task exercises every copied scalar both as a callback input and as a reply.
def scalarTour
    (f0 : Unit → IO Bool)
    (f1 : Bool → IO Char)
    (f2 : Char → IO String)
    (f3 : String → IO ByteArray)
    (f4 : ByteArray → IO Nat)
    (f5 : Nat → IO Int)
    (f6 : Int → IO UInt8)
    (f7 : UInt8 → IO UInt16)
    (f8 : UInt16 → IO UInt32)
    (f9 : UInt32 → IO UInt64)
    (f10 : UInt64 → IO USize)
    (f11 : USize → IO Int8)
    (f12 : Int8 → IO Int16)
    (f13 : Int16 → IO Int32)
    (f14 : Int32 → IO Int64)
    (f15 : Int64 → IO ISize)
    (f16 : ISize → IO Float32)
    (f17 : Float32 → IO Float)
    (f18 : Float → IO Unit)
    : BaseIO (Task (Except IO.Error Unit)) := IO.asTask do
  let x0 ← f0 ()
  let x1 ← f1 x0
  let x2 ← f2 x1
  let x3 ← f3 x2
  let x4 ← f4 x3
  let x5 ← f5 x4
  let x6 ← f6 x5
  let x7 ← f7 x6
  let x8 ← f8 x7
  let x9 ← f9 x8
  let x10 ← f10 x9
  let x11 ← f11 x10
  let x12 ← f12 x11
  let x13 ← f13 x12
  let x14 ← f14 x13
  let x15 ← f15 x14
  let x16 ← f16 x15
  let x17 ← f17 x16
  f18 x17

end Retained
