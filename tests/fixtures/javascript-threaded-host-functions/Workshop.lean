prelude
import LeanBridge.Host.Javascript

namespace Workshop
open LeanBridge.Host.Javascript

def identity (b : Box) : IO Box := b.identity
def start (n : UInt32) : IO (Task Box) := do pure (Task.pure (← Box.create n))

def remember (captured : Box) : IO (Box → IO Box) := do
  let _ ← captured.read
  pure fun supplied => do
    let _ ← supplied.read
    let _ ← captured.read
    pure captured

def reader (captured : Box) : IO (UInt32 → IO UInt32) := pure fun n => do
  if n == 0 then throw (IO.userError "zero refused")
  return (← captured.read) + n

def mapBox (b : Box) (f : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  BaseIO.asTask (f b).toBaseIO
end Workshop
