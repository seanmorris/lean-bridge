prelude
import LeanBridge.Host.Javascript

namespace Workshop
open LeanBridge.Host.Javascript

def identity (b : Box) : IO Box := b.identity
def start (n : UInt32) : IO (Task Box) := do pure (Task.pure (← Box.create n))

def mapBox (b : Box) (f : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  BaseIO.asTask (f b).toBaseIO

def projectBox (b : Box) (f : Box → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  BaseIO.asTask (f b).toBaseIO

def selectBox (n : UInt32) (f : UInt32 → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  BaseIO.asTask (f n).toBaseIO

def relayBox (b : Box) (first second : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) :=
  BaseIO.asTask (do second (← first b) : IO Box).toBaseIO

end Workshop
