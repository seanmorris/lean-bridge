namespace Signals

structure Cursor where
  value : Nat

def constant (value : Nat) : Cursor := ⟨value⟩
def checked (value : Nat) (reject : Bool) : IO Cursor := do
  if reject then throw (IO.userError "signal unavailable")
  return ⟨value⟩

def pull (c : Cursor) : BaseIO (Task (Option Nat)) :=
  pure (Task.pure (if c.value == 0 then none else some c.value))
def stop (_ : Cursor) : BaseIO Unit := pure ()

end Signals
