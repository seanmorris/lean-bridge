import Budget

namespace FactoryFault

-- This ordinary IO error shares the policy message, not the policy identity.
def start (n : UInt32) (f : UInt32 → IO UInt32) : IO (Task (Except IO.Error UInt32)) := do
  if n == 0 then throw (IO.userError "callback-already-invoked")
  IO.asTask (f n)

end FactoryFault
