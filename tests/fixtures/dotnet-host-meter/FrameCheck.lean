import LeanBridge.Host.Dotnet
open LeanBridge.Host.Dotnet

@[export lb_dn_test_through] def through (n : UInt32) : IO UInt32 := do
  return (← Box.observe n) + 1

@[export lb_dn_test_first] def firstError (n : UInt32) : IO UInt32 := do
  try Box.observe n catch first =>
    try let _ ← Box.observe (n + 1) catch _ => pure ()
    throw first

@[export lb_dn_test_mapped] def mapped (n : UInt32) : IO (Except String UInt32) :=
  EIO.toIO' ((Box.observe n).toEIO (fun _ => "mapped in Lean"))

@[export lb_dn_test_replace] def replaced (n : UInt32) : IO UInt32 := do
  try Box.observe n catch _ => throw (IO.userError "CLR host member failed")

@[export lb_dn_test_swallow] def swallowed (n : UInt32) : IO UInt32 := do
  try Box.observe n catch _ => return 999
