import Pulse

namespace Extra

def delayedInt (n : Int) : BaseIO (Task Int) := do
  let gate ← Pulse.late false 0
  return gate.map (fun _ => n)

end Extra
