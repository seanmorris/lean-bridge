namespace Relay

def run (s : String) (f : String → IO String) : BaseIO (Task (Except IO.Error String)) :=
  IO.asTask do f (← f s)

def direct (n : UInt32) : Task UInt32 := Task.pure (n + 1)

end Relay
