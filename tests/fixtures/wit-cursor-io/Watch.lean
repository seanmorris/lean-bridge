namespace Watch

initialize closedCount : IO.Ref UInt32 ← IO.mkRef 0

structure Cursor where
  position : IO.Ref UInt32
  failing : Bool

def feed (failing : Bool) : BaseIO Cursor := return ⟨← IO.mkRef 0, failing⟩
private def nextValue (c : Cursor) : BaseIO (Option (Except String UInt32)) := do
  let i ← c.position.get
  c.position.set (i + 1)
  if i == 0 then return some (.ok 73)
  if i == 1 then return some (.error "boom")
  return none
def pull (c : Cursor) : BaseIO (Task (Except IO.Error (Option (Except String UInt32)))) := IO.asTask do
  if let some v ← nextValue c then return some v
  if c.failing then throw (IO.userError "boom")
  return none
def close (_ : Cursor) : BaseIO Unit := closedCount.modify (· + 1)

def business : BaseIO Cursor := feed true
def businessPull (c : Cursor) : BaseIO (Task (Except String (Option (Except String UInt32)))) := BaseIO.asTask do
  if let some v ← nextValue c then return .ok (some v)
  return .error "boom"
def businessClose (c : Cursor) : BaseIO Unit := close c

def closedNow : BaseIO UInt32 := closedCount.get
def closed : BaseIO (Task UInt32) := return Task.pure (← closedNow)
end Watch
