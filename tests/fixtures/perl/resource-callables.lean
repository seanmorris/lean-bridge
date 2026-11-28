namespace Workshop

structure Badge where
  value : UInt32
  label : String

def newBadge (value : UInt32) : Badge := ⟨value, "badge"⟩
def inspectWith (value : Counter) (visit : Counter → UInt32) : UInt32 := visit value
def inspectFresh (value : UInt32) (visit : Counter → UInt32) : UInt32 := visit (newCounter value)
-- Project the returned resource inside Lean, including while a host failure is pending.
def exchangeWith (delta : UInt32) (value : Counter) (visit : UInt32 → Counter → Counter) : UInt32 :=
  (visit delta value).value
def chooseWith (value : UInt32) (choose : UInt32 → Counter) : UInt32 := (choose value).value
def keepFactory (choose : UInt32 → Counter) : UInt32 → Counter := fun n => choose n
def counterReader (offset : UInt32) : Counter → UInt32 := fun c => c.value + offset
def namedCounter (value : Counter) : String → Counter := fun _ => value

end Workshop
