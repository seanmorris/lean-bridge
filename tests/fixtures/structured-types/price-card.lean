namespace Owned
structure PriceCard where
  quote : UInt32 → UInt32
  rebate : UInt32 → UInt32
  label : String
  base : UInt32
def compareCards (left right : PriceCard) : UInt32 :=
  left.quote (right.rebate left.base) + right.quote (left.rebate right.base) +
    10 * left.label.utf8ByteSize.toUInt32 + right.label.utf8ByteSize.toUInt32
end Owned
