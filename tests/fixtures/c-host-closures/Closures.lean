import LeanBridge.Host.C

namespace Closures
open LeanBridge.Host.C

def remember (captured : Box) : IO (Box → IO Box) := do
  let _ ← captured.read
  pure fun supplied => do
    let _ ← supplied.read
    let _ ← captured.read
    pure captured

def reader (captured : Box) : IO (UInt32 → IO UInt32) :=
  pure fun n => do return (← captured.read) + n

def identityReader (captured : Box) : IO (UInt32 → IO Box) :=
  pure fun _ => captured.identity

def fileReader : IO (String → IO String) := pure fun path => IO.FS.readFile path
def echoBox (box : Box) : BaseIO (Task Box) := pure (.pure box)
end Closures
