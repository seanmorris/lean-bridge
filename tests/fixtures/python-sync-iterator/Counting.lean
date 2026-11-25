namespace Counting

initialize opened : IO.Ref Nat ← IO.mkRef 0
initialize pulled : IO.Ref Nat ← IO.mkRef 0
initialize closed : IO.Ref Nat ← IO.mkRef 0

structure Cursor where
  pos : IO.Ref Nat
  atError : Nat

def counts : BaseIO Nat := do
  return (← opened.get) * 10000 + (← pulled.get) * 100 + (← closed.get)

def numbers (atError : Nat) : BaseIO Cursor := do
  opened.modify (· + 1)
  return ⟨← IO.mkRef 0, atError⟩

def checked (atError : Nat) : EIO String Cursor := do
  if atError == 0 then throw "factory"
  numbers atError

def units (n : Nat) : IO Cursor := numbers n

def advance (c : Cursor) : BaseIO Nat := do
  pulled.modify (· + 1)
  let n ← c.pos.get
  c.pos.set (n + 1)
  return n

def next (c : Cursor) : BaseIO (Option Nat) := do
  let n ← advance c
  return if n < 3 then some n else none

def checkedNext (c : Cursor) : EIO String (Option Nat) := do
  let n ← advance c
  if n == c.atError then throw "step"
  return some n

def nextUnit (c : Cursor) : IO (Option Unit) := do
  let n ← advance c
  if n == c.atError then throw (IO.userError "unit step")
  return if n < 2 then some () else none

def finish (_ : Cursor) : BaseIO Unit := closed.modify (· + 1)
def threaded (c : Cursor) : BaseIO (Task (Option Nat)) := do return Task.pure (← next c)
def writes (_ : Cursor) : BaseIO Unit := do
  discard <| (IO.FS.writeFile "ungranted" "closed").toBaseIO

end Counting
