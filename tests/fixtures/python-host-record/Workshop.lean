import LeanBridge.Host.Python

namespace Workshop
open LeanBridge.Host.Python

structure Rack where
  primary : Box
  offset : UInt32
  backup : Box

def shared (box : Box) : IO Rack := pure ⟨box, 0, box⟩

def reorder (rack : Rack) : IO Rack := do
  let n ← rack.primary.read
  return ⟨rack.backup, rack.offset + n, rack.primary⟩

def selectPrimary (rack : Rack) : IO Box := pure rack.primary

def weigh (rack : Rack) (amount : UInt32) : IO UInt32 := do
  return (← rack.primary.read) + rack.offset + amount
end Workshop
