namespace Callables

-- Deliberately violates the host borrow when called after the exporting call.
-- The runtime must reject the expired token without touching its old context.
def retainCallback (callback : UInt32 → UInt32) : UInt32 → UInt32 :=
  fun value => callback value

end Callables
