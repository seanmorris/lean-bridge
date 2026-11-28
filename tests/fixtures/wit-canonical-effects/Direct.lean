namespace Direct

def inspect (ok : Bool) (s : String) : EIO String (Except String UInt32) := do
  if !ok then throw s
  return .error s

def scalar (ok : Bool) (v : Int64) : EIO UInt64 (Task Int64) := do
  if !ok then throw 18446744073709551615
  return Task.pure v

def returned (s : String) : Task (Except String UInt32) :=
  Task.pure (.error s)

end Direct
