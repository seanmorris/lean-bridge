namespace Callables

def combine (left : String) (right : UInt64)
    (first : String → UInt64 → String) (second : String → String) : String :=
  second (first left right)

end Callables
