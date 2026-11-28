import LeanBridge.Host.Python

namespace Closures
open LeanBridge.Host.Python

def remember (captured : Box) : IO (Box → IO Box) := do
  let _ ← captured.read
  pure fun supplied => do
    let _ ← supplied.read
    let _ ← captured.read
    pure captured

def reader (captured : Box) : IO (UInt32 → IO UInt32) :=
  pure fun extra => do
    return (← captured.read) + extra

-- Its filesystem effect occurs on invocation, not during factory execution.
def fileReader : IO (String → IO String) := pure fun path => IO.FS.readFile path

def job (value : UInt32) : BaseIO (Task UInt32) := pure (.pure value)
def echoBox (value : Box) : BaseIO (Task Box) := pure (.pure value)
end Closures
