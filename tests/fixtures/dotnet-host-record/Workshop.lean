import LeanBridge.Host.Dotnet

namespace Gauge
open LeanBridge.Host.Dotnet

structure Pair where
  lead : Box
  sample : ByteArray
  sequence : Nat
  spare : Box

def createPair (meter : Box) : IO Pair := pure ⟨meter, ByteArray.empty, 0, meter⟩

def flip (pair : Pair) : IO Pair := do
  let current ← pair.lead.read
  return ⟨pair.spare, pair.sample.push current.toUInt8, pair.sequence + 1, pair.lead⟩

def sumRead (left right : Pair) : IO UInt32 := do
  return (← left.lead.read) + (← right.spare.read)

def choose (pair : Pair) : IO (Bool → IO Box) :=
  pure fun first => pure (if first then pair.lead else pair.spare)

structure Reading where
  held : ByteArray
  sourceMeter : Box
  spareBytes : ByteArray

def duplicateSample (meter : Box) (bytes : ByteArray) : IO Reading :=
  pure ⟨bytes, meter, bytes⟩

end Gauge
