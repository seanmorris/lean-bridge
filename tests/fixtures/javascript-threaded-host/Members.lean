prelude
import GeneratedProbe
open LeanBridge.Host.Javascript

@[extern "lb_jst_test_worker_check"] opaque assertWorker : BaseIO Unit

private def useBox (b : Box) (mode : UInt32) : IO UInt32 := do
  if mode == 1 then
    try b.read catch _ => pure 73
  else if mode == 2 then
    try b.read catch _ => throw (IO.userError "JavaScript host member failed")
  else if mode == 3 then
    let alias ← b.identity
    let other ← Box.create 21
    alias.setLevel (← other.getLevel)
    alias.read
  else if mode == 4 then generatedProbe 0
  else b.read

@[export lb_jst_test_start_member] def startMember (b : Box) (mode : UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  BaseIO.asTask do
    assertWorker
    (useBox b mode).toBaseIO

@[export lb_jst_test_direct_read] def directRead (b : Box) : IO UInt32 := b.read
