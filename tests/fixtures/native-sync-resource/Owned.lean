import Shared

namespace Owned
open Shared

def fresh (n : UInt32) : IO Badge := return ⟨← Std.Mutex.new n, "owned"⟩
def increment (b : Badge) (n : UInt32) : BaseIO Unit := b.counter.atomically (modify (· + n))
def read (b : Badge) : BaseIO UInt32 := b.counter.atomically get
def letter (c : Char) : BaseIO Char := pure c
def checked (reject : Bool) (b : Badge) : EIO Badge Badge :=
  if reject then throw b else pure b

def later (b : Badge) : BaseIO (Task Badge) := BaseIO.asTask do
  increment b 1
  return b

end Owned
