import Metrics

namespace Telemetry.Readings

structure Frame where
  samples : Array (Array UInt32)
  counter : Nat
  bias : Int
  title : String
  valid : Bool

def measureTick (tick : UInt32) : UInt32 := Metrics.measure tick + 1
def accumulate (total : Nat) (samples : UInt32) : Nat := total + samples.toNat
def calibrate (reading offset : Int) : Int := reading + offset
def channelLabel (channel suffix : String) : String := suffix ++ ":" ++ channel
def offsetSamples (values : Array UInt32) (offset : UInt32) : Array UInt32 :=
  values.map (offset + ·)
def rotateRows (values : Array (Array UInt32)) : Array (Array UInt32) :=
  values.map Array.reverse
def advanceFrame (frame : Frame) : Frame :=
  { frame with counter := frame.counter + 2, bias := frame.bias + 1
               samples := frame.samples.map Array.reverse, valid := !frame.valid }
def wrapClock (clock : UInt64) : UInt64 := clock + 2
def nextOffset (offset : Int64) : Int64 := offset + 1
def invertStatus (flag : Bool) : Bool := !flag
def acknowledge (marker : Unit) : Unit := marker
def mirrorPayload (bytes : ByteArray) : ByteArray := ⟨bytes.data.reverse⟩

theorem accumulate_zero (total : Nat) : accumulate total 0 = total := by
  simp [accumulate]
theorem advanceFrame_title (frame : Frame) :
    (advanceFrame frame).title = frame.title := rfl
theorem rotateRows_twice (values : Array (Array UInt32)) :
    rotateRows (rotateRows values) = values := by
  simp [rotateRows, Array.map_map, Function.comp_def]

end Telemetry.Readings
