namespace Meter
structure Feed where
  mode : UInt8
  limit : UInt32
  position : IO.Ref UInt32

initialize feedPulls : IO.Ref UInt32 ← IO.mkRef 0
initialize feedCloses : IO.Ref UInt32 ← IO.mkRef 0
initialize feedGate : IO.Ref (Option (IO.Promise Bool)) ← IO.mkRef none

def feed (mode : UInt8) (limit : UInt32) : EIO UInt32 Feed := do
  if mode == 255 then throw limit
  return ⟨mode, limit, ← IO.mkRef 0⟩

def advance (c : Feed) : BaseIO (Task (Except UInt16 (Option (Except String Int64)))) := do
  let n ← c.position.get
  feedPulls.modify (· + 1)
  c.position.set (n + 1)
  if c.mode == 1 then return Task.pure (.error 65535)
  if n >= c.limit then return Task.pure (.ok none)
  if c.mode == 2 then return Task.pure (.ok (some (.error "item")))
  if c.mode == 3 then
    let gate ← IO.Promise.new
    feedGate.set (some gate)
    BaseIO.asTask do
      let _ ← IO.wait gate.result?
      return .ok (some (.ok (-37)))
  else return Task.pure (.ok (some (.ok (Int64.ofInt n.toNat))))

def finish (_ : Feed) : BaseIO Unit := feedCloses.modify (· + 1)
-- Same signature, different cleanup: a reviewed protocol must refuse this substitution.
def alternateFinish (_ : Feed) : BaseIO Unit := pure ()

-- Test instrumentation is a second independent stream; it never pulls Feed.
structure Gauge where
  sample : UInt64
  sent : IO.Ref Bool
def gauge (wake : Bool) : BaseIO Gauge := do
  if wake then
    if let some gate ← feedGate.get then gate.resolve true
    feedGate.set none
  let p ← feedPulls.get
  let c ← feedCloses.get
  return ⟨p.toUInt64 * 4294967296 + c.toUInt64, ← IO.mkRef false⟩
def sample (g : Gauge) : BaseIO (Task (Option UInt64)) := do
  if ← g.sent.get then return Task.pure none
  g.sent.set true
  return Task.pure (some g.sample)
def closeGauge (_ : Gauge) : BaseIO Unit := pure ()
end Meter
