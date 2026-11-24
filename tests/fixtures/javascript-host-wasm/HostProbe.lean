import Workshop

/-- Enter the actual application, mutate one alias, then read through the other. -/
@[export lb_meter_probe] def exercise (n : UInt32) : IO UInt32 := do
  let box ← Workshop.make n
  let alias ← Workshop.identity box
  let level ← Workshop.update alias (n + 1)
  unless level == n + 1 do throw (IO.userError "getter mismatch")
  match ← (Workshop.mapped box).toBaseIO with
  | .ok answer => return answer
  | .error message =>
    unless message == "host read failed" do throw (IO.userError "wrong mapped error")
    return 0xdecafbad
