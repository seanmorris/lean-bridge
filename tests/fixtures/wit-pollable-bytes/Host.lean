import Packet
namespace Host

def wake (slot : UInt32) : BaseIO (Task Bool) := do
  return Task.pure (← Packet.release slot)

def counts : BaseIO (Task UInt32) := do
  return Task.pure (← Packet.closed)

def through (factory : Bool) (transform : ByteArray → IO ByteArray) (value : ByteArray) :
    IO (Task (Except IO.Error ByteArray)) := do
  if factory then return Task.pure (.ok (← transform value))
  IO.asTask (transform value)

end Host
