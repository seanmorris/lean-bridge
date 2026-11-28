prelude
import Init.System.Promise
import Init.Data.SInt.Basic
namespace Latches

initialize gates : IO.Ref (List (UInt32 × IO.Promise Bool)) ← IO.mkRef []

def parked (slot : UInt32) (value : Int64) : BaseIO (Task Int64) := do
  let gate ← IO.Promise.new
  gates.modify (fun xs => (slot,gate) :: xs)
  BaseIO.asTask do
    let _ ← IO.wait gate.result?
    return value

def release (slot : UInt32) : BaseIO Bool := do
  let xs ← gates.get
  let some (_,gate) := xs.find? (fun x => x.1 == slot) | return false
  gates.set (xs.filter (fun x => x.1 != slot))
  gate.resolve true
  return true

end Latches
