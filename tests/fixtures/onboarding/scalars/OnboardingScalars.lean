namespace OnboardingScalars

/-- Add arbitrary-precision natural numbers. -/
def add (left right : Nat) : Nat := left + right
/-- A zero-argument function. -/
def answer : Nat := 42
/-- Preserve unit. -/
def unit (value : Unit) : Unit := value
/-- Preserve a boolean. -/
def boolean (value : Bool) : Bool := value
/-- Preserve UInt8. -/
def u8 (value : UInt8) : UInt8 := value
/-- Preserve UInt16. -/
def u16 (value : UInt16) : UInt16 := value
/-- Preserve UInt32. -/
def u32 (value : UInt32) : UInt32 := value
/-- Preserve UInt64. -/
def u64 (value : UInt64) : UInt64 := value
/-- Preserve Int8. -/
def i8 (value : Int8) : Int8 := value
/-- Preserve Int16. -/
def i16 (value : Int16) : Int16 := value
/-- Preserve Int32. -/
def i32 (value : Int32) : Int32 := value
/-- Preserve Int64. -/
def i64 (value : Int64) : Int64 := value
/-- Preserve arbitrary-precision signed integers. -/
def integer (value : Int) : Int := value
/-- Negate arbitrary-precision integers. -/
def negate (value : Int) : Int := -value
/-- Preserve an IEEE single-precision value. -/
def f32 (value : Float32) : Float32 := value
/-- Preserve an IEEE double-precision value. -/
def f64 (value : Float) : Float := value
/-- Preserve Unicode text, including embedded NUL. -/
def text (value : String) : String := value
/-- Copy a byte array. -/
def bytes (value : ByteArray) : ByteArray := value
/-- Exercise mixed types and more than two arguments. -/
def mixed (enabled : Bool) (count : UInt32) (label : String) (value : Nat) : Nat :=
  if enabled then value + count.toNat + label.length else value

end OnboardingScalars
