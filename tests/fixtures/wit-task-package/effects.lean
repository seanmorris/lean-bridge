namespace Meter

-- Startup failure, successful worker completion and returned Except are independent.
def checked (mode : UInt8) (v : UInt32) (msg : String) :
    EIO UInt32 (Task (Except UInt32 (Except String UInt32))) := do
  if mode == 1 then throw v
  if mode == 2 then return Task.pure (.error v)
  if mode == 3 then return Task.pure (.ok (.error msg))
  return Task.pure (.ok (.ok v))

-- Both failures use the same text. The phase must come from the protocol.
def phase (mode : UInt8) (msg : String) : IO (Task (Except IO.Error UInt32)) := do
  if mode == 1 then throw (IO.userError msg)
  BaseIO.asTask do
    return if mode == 2 then .error (IO.userError msg) else .ok 97

def branch (mode : UInt8) (msg : String) : EIO (Except String UInt16) (Task String) := do
  if mode == 1 then throw (.error msg)
  if mode == 2 then throw (.ok 65535)
  return Task.pure msg

end Meter
