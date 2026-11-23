namespace Ledger

initialize total : IO.Ref USize ← IO.mkRef 0

def add (amount : USize) : IO USize := do
  let value := (← total.get) + amount
  total.set value
  return value

def readTotal : BaseIO USize := total.get

def choose (fail tag : Bool) (message : String) : EIO (Except UInt32 String) (Except UInt32 String) := do
  let reply : Except UInt32 String := if tag then .ok message else .error 4000000000
  if fail then throw reply else return reply

def signed (value : ISize) : BaseIO ISize := pure value
def magnitude (value : Int) : IO Int := pure value
def wide (value : UInt64) : IO UInt64 := pure value
def ioFailure : IO Unit := throw (.userError "ledger offline")

end Ledger
