import LeanBridge.Host.Perl
open LeanBridge.Host.Perl

@[export lb_test_perl_through]
def through (n : UInt32) : IO UInt32 := do return (← Box.observe n) + 1

@[export lb_test_perl_mapped]
def mapped (n : UInt32) : IO (Except String UInt32) :=
  EIO.toIO' ((Box.observe n).toEIO (fun _ => "mapped in Lean"))

@[export lb_test_perl_replace]
def replaced (n : UInt32) : IO UInt32 := do
  try Box.observe n catch _ => throw (IO.userError "Perl host member failed")

@[export lb_test_perl_first]
def firstError (n : UInt32) : IO UInt32 := do
  try Box.observe n catch first =>
    try let _ ← Box.observe (n + 1) catch _ => pure ()
    throw first

@[export lb_test_perl_repeat]
def repeatFailures (n : UInt32) : IO UInt32 := do
  for _ in [0:70] do
    try let _ ← Box.observe n catch _ => pure ()
  return 0
