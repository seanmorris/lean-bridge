import LeanBridge.Host.Ruby

namespace Station
open LeanBridge.Host.Ruby

structure Panel where
  activeMeter : Box
  threshold : UInt32
  spareMeter : Box

def mirror (meter : Box) : IO Panel := pure ⟨meter, 1, meter⟩

def switchMeters (panel : Panel) : IO Panel := do
  let level ← panel.activeMeter.read
  return ⟨panel.spareMeter, panel.threshold + level, panel.activeMeter⟩

def current (panel : Panel) : IO Box := pure panel.activeMeter

def combined (left right : Panel) : IO UInt32 := do
  return (← left.activeMeter.read) + (← right.spareMeter.read) + left.threshold + right.threshold
end Station
