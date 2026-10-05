namespace Arrays

def reverseUnit (xs : Array (Array Unit)) := xs.reverse.map Array.reverse
def reverseBool (xs : Array (Array Bool)) := xs.reverse.map Array.reverse
def reverseUInt8 (xs : Array (Array UInt8)) := xs.reverse.map Array.reverse
def reverseUInt16 (xs : Array (Array UInt16)) := xs.reverse.map Array.reverse
def reverseUInt32 (xs : Array (Array UInt32)) := xs.reverse.map Array.reverse
def reverseUInt64 (xs : Array (Array UInt64)) := xs.reverse.map Array.reverse
def reverseInt8 (xs : Array (Array Int8)) := xs.reverse.map Array.reverse
def reverseInt16 (xs : Array (Array Int16)) := xs.reverse.map Array.reverse
def reverseInt32 (xs : Array (Array Int32)) := xs.reverse.map Array.reverse
def reverseInt64 (xs : Array (Array Int64)) := xs.reverse.map Array.reverse
def reverseNat (xs : Array (Array Nat)) := xs.reverse.map Array.reverse
def reverseInt (xs : Array (Array Int)) := xs.reverse.map Array.reverse
def reverseFloat32 (xs : Array (Array Float32)) := xs.reverse.map Array.reverse
def reverseFloat64 (xs : Array (Array Float)) := xs.reverse.map Array.reverse
def reverseString (xs : Array (Array String)) := xs.reverse.map Array.reverse
def reverseBytes (xs : Array (Array ByteArray)) := xs.reverse.map Array.reverse
def reverseChar (xs : Array (Array Char)) := xs.reverse.map Array.reverse
def reverseUSize (xs : Array (Array USize)) := xs.reverse.map Array.reverse
def reverseISize (xs : Array (Array ISize)) := xs.reverse.map Array.reverse

def add (offset : Int) (xs : Array (Array Int)) := xs.map (·.map (· + offset))
def total (xs : Array (Array Nat)) : Nat := xs.foldl (fun n row => row.foldl (· + ·) n) 0
def words : Array (Array String) := #[#["\uFEFFLean", "🌱\x00"], #[]]
def duplicate (xs : Array ByteArray) : Array ByteArray := xs ++ xs
def size (xs : Array Unit) : USize := xs.size.toUSize

-- Interpret boxed elements in Lean, independently of the reverse/copy encoder.
def checkElements (u : Array Unit) (b : Array Bool)
    (u8 : Array UInt8) (u16 : Array UInt16) (u32 : Array UInt32) (u64 : Array UInt64)
    (i8 : Array Int8) (i16 : Array Int16) (i32 : Array Int32) (i64 : Array Int64)
    (n : Array Nat) (z : Array Int) (f32 : Array Float32) (f64 : Array Float)
    (s : Array String) (bytes : Array ByteArray) (c : Array Char)
    (us : Array USize) (isz : Array ISize) : Bool :=
  u.size == 1 && b[0]! &&
  u8[0]! + 1 == 0 && u16[0]! + 1 == 0 && u32[0]! + 1 == 0 && u64[0]! + 1 == 0 &&
  i8[0]! + 1 == -127 && i16[0]! + 1 == -32767 &&
  i32[0]! + 1 == -2147483647 && i64[0]! + 1 == -9223372036854775807 &&
  n[0]! + 1 == 2^200 + 1 && z[0]! + 1 == -(2^200) + 1 &&
  f32[0]!.toBits == (Float32.ofBits 0x80000000).toBits && f64[0]! + 0.25 == 3.5 &&
  s[0]! == "🌱\x00" && bytes[0]!.size == 3 && bytes[0]![0]! == 255 &&
  c[0]!.toNat == 0x1f331 && us[0]! + 1 == 0 && isz[0]! + 1 == -2147483647

end Arrays
