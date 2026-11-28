namespace Dials

initialize opens : IO.Ref UInt32 ← IO.mkRef 0
initialize pulls : IO.Ref UInt32 ← IO.mkRef 0
initialize closes : IO.Ref UInt32 ← IO.mkRef 0

structure Cursor where
  pos : IO.Ref UInt32
  limit : UInt32

def counts : BaseIO UInt32 := do
  return (← opens.get) * 10000 + (← pulls.get) * 100 + (← closes.get)

def sequence (limit : UInt32) : BaseIO Cursor := do
  opens.modify (· + 1)
  return ⟨← IO.mkRef 0, limit⟩

def checked (limit : UInt32) : EIO String Cursor := do
  if limit == 0 then throw "factory"
  sequence limit

def units (limit : UInt32) : IO Cursor := sequence limit

def advance (c : Cursor) : BaseIO UInt32 := do
  pulls.modify (· + 1)
  let n ← c.pos.get
  c.pos.set (n + 1)
  return n

def next (c : Cursor) : BaseIO (Option UInt32) := do
  let n ← advance c
  return if n < c.limit then some n else none

def checkedNext (c : Cursor) : EIO String (Option UInt32) := do
  let n ← advance c
  if n == c.limit then throw "step"
  return some n

def nextUnit (c : Cursor) : IO (Option Unit) := do
  let n ← advance c
  if n == c.limit then throw (IO.userError "unit step")
  return if n < 2 then some () else none

def finish (_ : Cursor) : BaseIO Unit := do
  closes.modify (· + 1)
  discard <| (IO.FS.writeFile "state" "closed").toBaseIO

end Dials
