import LeanBridge.Host.Php

namespace Station
open LeanBridge.Host.Php

structure Panel where
  primaryMeter : Box
  caption : String
  limit : UInt32
  serial : Nat
  backupMeter : Box

def mirror (meter : Box) : IO Panel := pure ⟨meter, "both", 7, 0, meter⟩

def swap (panel : Panel) : IO Panel := do
  let level ← panel.primaryMeter.read
  return ⟨panel.backupMeter, panel.caption ++ "!", panel.limit + level, panel.serial + 1, panel.primaryMeter⟩

def combined (left right : Panel) : IO UInt32 := do
  return (← left.primaryMeter.read) + (← right.backupMeter.read) + left.limit + right.limit

structure Banner where
  leftCaption : String
  meter : Box
  rightCaption : String

def banner (meter : Box) (caption : String) : IO Banner := pure ⟨caption, meter, caption⟩

def chooseMeter (panel : Panel) : IO (UInt32 → IO Box) :=
  pure fun choice => if choice == 0 then pure panel.primaryMeter else pure panel.backupMeter

end Station
