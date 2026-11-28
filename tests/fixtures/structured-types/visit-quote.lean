namespace Owned

-- The callback receives the function itself. Its captured value belongs to
-- this invocation, not to a Tariff record or to the application.
def visitQuote (base : UInt32) (visit : (UInt32 → UInt32) → UInt32 → UInt32)
    (units : UInt32) : UInt32 :=
  visit (fun n => base + n) units

end Owned
