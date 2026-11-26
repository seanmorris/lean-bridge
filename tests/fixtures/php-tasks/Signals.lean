namespace Signals

def reading (n : UInt32) : Task UInt32 := Task.pure (n + 1)

end Signals
