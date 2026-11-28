namespace Companions

initialize counter : IO.Ref UInt32 ← IO.mkRef 0

def plain (n : UInt32) : UInt32 := n + 1

def bump (n : UInt32) : BaseIO UInt32 := do
  let next := (← counter.get) + n
  counter.set next
  return next

def doubled (n : UInt32) : Task UInt32 := Task.pure (n * 2)
def finish (path : String) : IO Unit := IO.FS.writeFile path "closed"

end Companions
