import Std.Sync.Mutex

namespace Wide

initialize entries : Std.Mutex UInt32 ← Std.Mutex.new 0
initialize closed : Std.Mutex UInt32 ← Std.Mutex.new 0
initialize gate : Std.Mutex Bool ← Std.Mutex.new false
def calls : IO UInt32 := entries.atomically get
def closes : IO UInt32 := closed.atomically get
def openGate : IO Unit := gate.atomically (set true)
def sum (n : Nat) (z : Int) : BaseIO (Task Int) := do
  entries.atomically (modify (· + 1))
  return Task.pure ((n : Int) + z)
def late (z : Int) : BaseIO (Task Int) := BaseIO.asTask do
  repeat
    if ← gate.atomically get then break
    IO.sleep 1
  return z
def huge (bits : UInt32) : Task Nat := Task.pure (1 <<< bits.toNat)
def checked (failStart failValue : Bool) (n : Nat) (z : Int) : EIO Int (Task (Except Int (Except Nat Int))) := do
  if failStart then throw z
  return Task.pure (if failValue then .error z else .ok (if z < 0 then .error n else .ok z))

structure Cursor where
  position : Std.Mutex UInt32
  terminal : Bool
  n : Nat
  z : Int
def series (reject terminal : Bool) (n : Nat) (z : Int) : EIO Nat Cursor := do
  if reject then throw n
  return ⟨← Std.Mutex.new 0, terminal, n, z⟩
def next (c : Cursor) : BaseIO (Task (Except Int (Option (Except Nat Int)))) := do
  let pos ← c.position.atomically do let pos ← get; set (pos + 1); return pos
  return Task.pure (if pos == 0 then .ok (some (.error c.n)) else if pos == 1 && c.terminal then .error c.z
    else if pos == 1 then .ok (some (.ok c.z)) else .ok none)
def close (_ : Cursor) : BaseIO Unit := closed.atomically (modify (· + 1))

end Wide
