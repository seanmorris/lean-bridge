prelude
import Init.System.Promise
namespace Relay

def worker (n : UInt32) (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask (f n)

def factory (n : UInt32) (f : UInt32 → IO UInt32) : IO (Task UInt32) := do
  return Task.pure (← f n)

def twice (n : UInt32) (f g : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask do g (← f n)

def recover (n : UInt32) (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask do
    try f n catch _ => pure (n + 1)

def text (s : String) (f : String → IO String) : BaseIO (Task (Except IO.Error String)) :=
  IO.asTask (f s)

def laterError (reject : Bool) (f : UInt32 → IO UInt32) : IO (Task (Except IO.Error UInt32)) := do
  if reject then throw (IO.userError "factory refused")
  IO.asTask do
    let _ ← f 9
    throw (IO.userError "worker refused")

def add (n : UInt32) : UInt32 := n + 1

def replace (n : UInt32) (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask do
    try f n catch _ => throw (IO.userError "JavaScript callback failed")

def propagate (n : UInt32) (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask do
    try f n catch e => throw e

def checked (reject : Bool) (f : UInt32 → IO UInt32) : EIO UInt32 (Task (Except String UInt32)) := do
  if reject then throw 413
  match ← (f 10).toBaseIO with
  | .ok n => return Task.pure (.ok n)
  | .error _ => return Task.pure (.error "caught")
end Relay
