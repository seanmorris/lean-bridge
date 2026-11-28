import Workshop

open LeanBridge.Host.Javascript
namespace Outcomes

def branch (takeError : Bool) (box : Box) : IO (Except String (Except Box UInt32)) := do
  if takeError then return .ok (.error box)
  return .ok (.ok (← box.read))

def typed (box : Box) : EIO (Except UInt32 Box) UInt32 :=
  throw (.ok box)

def ordinaryFailure (value : UInt32) : IO UInt32 :=
  if value == 7 || value == 4294967295 then
    throw (IO.userError s!"reading {value} refused")
  else pure value

end Outcomes
