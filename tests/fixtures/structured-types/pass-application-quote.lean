namespace Owned

-- An identity, not a newly constructed price function.
def passApplicationQuote (quote : UInt32 → UInt32) : UInt32 → UInt32 := quote

-- The first callback's registration is live while the second calls it.
def visitApplicationQuote (quote : UInt32 → UInt32)
    (visit : (UInt32 → UInt32) → UInt32 → UInt32) (units : UInt32) : UInt32 :=
  visit quote units

end Owned
