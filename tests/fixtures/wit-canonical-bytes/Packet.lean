import Init.System.Promise
namespace Packet

initialize gates : IO.Ref (List (UInt32 × IO.Promise Bool)) ← IO.mkRef []

def packet (slot : UInt32) (mode : UInt8) (left right : ByteArray) :
    EIO ByteArray (Task (Except ByteArray ByteArray)) := do
  if mode == 255 then throw right
  let gate ← IO.Promise.new
  gates.modify (fun xs => (slot, gate) :: xs)
  BaseIO.asTask do
    let _ ← IO.wait gate.result?
    return if mode == 0 then .ok left else .error right

def release (slot : UInt32) : BaseIO Bool := do
  let xs ← gates.get
  let some (_, gate) := xs.find? (fun x => x.1 == slot) | return false
  gates.set (xs.filter (fun x => x.1 != slot))
  gate.resolve true
  return true

structure Chunks where
  bytes : ByteArray
  position : IO.Ref UInt32

initialize closes : IO.Ref UInt32 ← IO.mkRef 0
def chunks (value : ByteArray) : BaseIO Chunks := do
  return ⟨value, ← IO.mkRef 0⟩
def next (c : Chunks) : BaseIO (Task (Except ByteArray (Option ByteArray))) := do
  let i ← c.position.get
  c.position.set (i + 1)
  if i == 0 then return Task.pure (.ok (some c.bytes))
  if i == 1 then return Task.pure (.ok (some ByteArray.empty))
  return Task.pure (.error c.bytes)
def finish (_ : Chunks) : BaseIO Unit := closes.modify (· + 1)
def closed : BaseIO UInt32 := closes.get

end Packet
