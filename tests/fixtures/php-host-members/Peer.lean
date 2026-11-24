import Workshop

namespace Peer
open LeanBridge.Host.Php

def transient (value : UInt32) : IO UInt32 := do
  let box ← Box.create value
  box.read

def mappedTransient (value : UInt32) : EIO String UInt32 :=
  (transient value).toEIO (fun _ => "transient failed")

def ioFail (value : UInt32) : IO UInt32 := do
  let _ ← transient value
  throw (IO.userError "peer IO failed")

def watch (box : Box) : IO Key := box.child
def watchFrom (resolver parent : Box) : IO Key := resolver.childOf parent
def keepKey (key : Key) : IO Key := key.identity

end Peer
