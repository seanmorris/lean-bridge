namespace Telemetry.Pending

def checkedCount (value : Int) : Except String Nat :=
  if value < 0 then .error "negative reading" else .ok value.toNat

end Telemetry.Pending
