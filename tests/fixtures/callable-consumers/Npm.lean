namespace Callables

def retainCallback (callback : UInt32 → UInt32) : UInt32 → UInt32 := fun value => callback value

def combine (left : String) (right : UInt64)
    (first : String → UInt64 → String) (second : String → String) : String := second (first left right)

def apply16 (callback : UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 →
    UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32) : UInt32 :=
  callback 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16

def make16 (captured : UInt32) : UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 →
    UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 → UInt32 :=
  fun a b c d e f g h i j k l m n o p => captured + a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p

end Callables
