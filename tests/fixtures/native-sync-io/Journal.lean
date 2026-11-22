namespace Journal

initialize ticks : IO.Ref UInt32 ← IO.mkRef 0

def bump (amount : UInt32) : BaseIO UInt32 := do
  let next := (← ticks.get) + amount
  ticks.set next
  return next

def count : BaseIO UInt32 := ticks.get

def store (path text : String) : IO Unit := IO.FS.writeFile path text
def read (path : String) : IO String := IO.FS.readFile path

-- The same two tags and payloads can be thrown or returned, independently.
def choose (reject tag : Bool) (text : String) : EIO (Except UInt32 String) (Except UInt32 String) := do
  let payload : Except UInt32 String := if tag then .ok text else .error 37
  if reject then throw payload else return payload

def echo (value : UInt32) : UInt32 := value

end Journal
