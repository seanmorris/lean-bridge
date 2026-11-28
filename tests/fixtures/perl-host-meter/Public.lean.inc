
namespace Workshop
open LeanBridge.Host.Perl
def reply (ok : Bool) : Except String (Except UInt32 String) :=
  if ok then .ok (.error 23) else .error "no"
def replaced (b : LeanBridge.Host.Perl.Box) : IO UInt32 := do
  try b.read catch _ => throw (IO.userError "Perl host member failed")
def plain : IO UInt32 := pure 37
def chooseObject (box : Box) (ok : Bool) : Except Box (Except String Box) :=
  if ok then .ok (.ok box) else .error box
def rejectObject (box : Box) : EIO (Except String (Except Box String)) Unit :=
  throw (.ok (.error box))
def exhaust (box : Box) : IO Unit := do
  for _ in [:66] do
    try let _ ← box.read catch _ => pure ()
end Workshop
