namespace Records

structure Primitives where
  unit : Unit
  flag : Bool
  u8 : UInt8
  u16 : UInt16
  u32 : UInt32
  u64 : UInt64
  i8 : Int8
  i16 : Int16
  i32 : Int32
  i64 : Int64
  natural : Nat
  integer : Int
  f32 : Float32
  f64 : Float
  text : String
  bytes : ByteArray
  char : Char
  usize : USize
  isize : ISize

structure Empty where
structure Single where
  value : UInt64
structure Count where
  value : Nat
structure Pair where
  first : UInt32
  second : String
structure Reversed where
  second : String
  first : UInt32
structure Packet where
  label : String
  values : Array (Array Primitives)
  empty : Empty
  single : Single
  count : Count
  pair : Pair
  reversed : Reversed

def inspect (p : Primitives) : Bool :=
  p.flag && p.u8 + 1 == 0 && p.u16 + 1 == 0 && p.u32 + 1 == 0 && p.u64 + 1 == 0 &&
  p.i8 + 1 == -127 && p.i16 + 1 == -32767 &&
  p.i32 + 1 == -2147483647 && p.i64 + 1 == -9223372036854775807 &&
  p.natural + 1 == 2^200 + 1 && p.integer + 1 == -(2^200) + 1 &&
  p.f32.toBits == (Float32.ofBits 0x80000000).toBits && p.f64 + 0.25 == 3.5 &&
  p.text == "🌱\x00" && p.bytes.size == 3 && p.bytes[0]! == 255 &&
  p.char.toNat == 0x1f331 && p.usize + 1 == 0 && p.isize + 1 == -2147483647

def shuffle (packet : Packet) : Packet :=
  { packet with
    label := packet.label ++ "!"
    values := packet.values.reverse.map Array.reverse
    single := ⟨packet.single.value + 1⟩
    count := ⟨packet.count.value + 7⟩
    pair := ⟨packet.pair.first + 1, packet.pair.second ++ "p"⟩
    reversed := ⟨packet.reversed.second ++ "r", packet.reversed.first + 2⟩ }

def reverse (values : Array Primitives) : Array Primitives := values.reverse
def empty (_value : Empty) : Empty := ⟨⟩
def single (value : Single) : Single := ⟨value.value + 1⟩
def count (value : Count) : Count := ⟨value.value + 1⟩
def make : Pair := ⟨42, "\uFEFF🌱\x00"⟩
def duplicate (value : Packet) : Array Packet := #[value, value]

end Records
