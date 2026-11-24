import LeanBridge.Host.Jvm
open LeanBridge.Host.Jvm

@[export lb_test_jvm_through]
def through (n : UInt32) : IO UInt32 := do
  return (← Box.observe n) + 1

@[export lb_test_jvm_mapped]
def mapped (n : UInt32) : IO (Except String UInt32) :=
  EIO.toIO' ((Box.observe n).toEIO (fun _ => "mapped in Lean"))

@[export lb_test_jvm_replace]
def replaced (n : UInt32) : IO UInt32 := do
  try Box.observe n catch _ => throw (IO.userError "JVM host member failed")

@[export lb_test_jvm_first]
def firstError (n : UInt32) : IO UInt32 := do
  try Box.observe n catch first =>
    try let _ ← Box.observe (n + 1) catch _ => pure ()
    throw first
