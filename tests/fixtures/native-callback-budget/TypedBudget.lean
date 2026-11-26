import Budget

namespace TypedBudget

def checked (n : UInt32) (f : UInt32 → IO UInt32) : EIO UInt32 (Task (Except IO.Error UInt32)) := do
  if n == 0 then throw 73
  IO.asTask do f (← f n)

end TypedBudget
