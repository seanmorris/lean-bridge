namespace Pulls

initialize closes : IO.Ref UInt32 ← IO.mkRef 0
initialize pulls : IO.Ref UInt32 ← IO.mkRef 0

structure Cursor where
  pos : IO.Ref UInt32
  limit : UInt32

def counts : BaseIO UInt32 := do return (← pulls.get) * 100 + (← closes.get)
def sequence (n : UInt32) : BaseIO Cursor := do return ⟨← IO.mkRef 0, n⟩
def checked (n : UInt32) : EIO String Cursor := do
  if n == 0 then throw "open"
  sequence n
def units (n : UInt32) : IO Cursor := sequence n
def replies (n : UInt32) : BaseIO Cursor := sequence n

def advance (c : Cursor) : BaseIO UInt32 := do
  pulls.modify (· + 1)
  let n ← c.pos.get
  c.pos.set (n + 1)
  return n
def next (c : Cursor) : BaseIO (Option UInt32) := do
  let n ← advance c
  return if n < c.limit then some n else none
def nextChecked (c : Cursor) : EIO String (Option UInt32) := do
  let n ← advance c
  if n == c.limit then throw "pull λ"
  return some n
def nextUnit (c : Cursor) : IO (Option Unit) := do
  if (← advance c) == c.limit then throw (IO.userError "unit step")
  return some ()
def nextReply (c : Cursor) : BaseIO (Option (Except String UInt32)) := do
  let n ← advance c
  if n >= c.limit then return none
  return some (if n == 0 then .error "value λ" else .ok n)
def finish (_ : Cursor) : BaseIO Unit := closes.modify (· + 1)
end Pulls
