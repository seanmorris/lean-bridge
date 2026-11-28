namespace Meter

def chain (first : UInt32 → IO UInt32) (initial : UInt32) (second : UInt32 → IO UInt32) :
    IO (Task (Except IO.Error UInt32)) :=
  IO.asTask do second (← first initial)

def routed (mode : UInt8) (input : String) (rewrite : String → IO String) :
    EIO UInt32 (Task (Except IO.Error (Except String String))) := do
  if mode == 1 then throw 3737844653
  if mode == 2 then return Task.pure (.ok (.error input))
  IO.asTask do
    if mode == 3 then throw (IO.userError input)
    return .ok (← rewrite input)

end Meter
