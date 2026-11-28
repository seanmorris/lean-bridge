import Packet

namespace PacketCompose

-- Same public contract as Packet.packet. An object host cannot block its
-- owner on IO.wait. Return a continuation on the promise's task instead.
def packet (slot : UInt32) (mode : UInt8) (left right : ByteArray) :
    EIO ByteArray (Task (Except ByteArray ByteArray)) := do
  if mode == 255 then throw right
  let gate ← IO.Promise.new
  Packet.gates.modify (fun xs => (slot, gate) :: xs)
  return gate.result?.map fun _ => if mode == 0 then .ok left else .error right

end PacketCompose
