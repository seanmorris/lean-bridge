namespace Variants

inductive Signal where
  | idle
  | stopped
  | data (count : UInt32) (label : String)
  | marker (value : Unit)

inductive Mode where
  | first
  | second
  | third

structure Packet where
  current : Signal
  events : List Signal
  fallback : Option Signal
  modes : Array Mode

inductive Nested where
  | empty
  | packet (value : Packet)
  | outcome (value : Except String (Signal × Mode))

inductive Scalars where
  | absent
  | all (unit : Unit) (bool : Bool) (u8 : UInt8) (u16 : UInt16)
      (u32 : UInt32) (u64 : UInt64) (i8 : Int8) (i16 : Int16)
      (i32 : Int32) (i64 : Int64) (natural : Nat) (integer : Int)
      (f32 : Float32) (f64 : Float) (text : String) (bytes : ByteArray)
      (char : Char) (word : USize) (signedWord : ISize)

inductive Anonymous where
  | number : UInt32 → Anonymous
  | pair : UInt32 → String → Anonymous
  | collision (arg1 : UInt32) : String → Anonymous

inductive One where
  | only (value : UInt32)

inductive Buffers where
  | empty
  | pair (first : ByteArray) (second : ByteArray)

def echo (value : Signal) : Signal := value
def mode (value : Mode) : Mode := value
def nested (value : Nested) : Nested := value
def signals (value : Array (List Signal)) : Array (List Signal) := value.map List.reverse
def scalars (value : Scalars) : Scalars := value
def anonymous (value : Anonymous) : Anonymous := value
def one (value : One) : One := match value with | .only n => .only (n + 1)

def next (value : Signal) : Signal :=
  match value with
  | .idle => .stopped
  | .stopped => .marker ()
  | .marker _ => .data 42 "ready"
  | .data n text => .data (n + 1) (text ++ "!")

def code (value : Signal) : UInt32 :=
  match value with
  | .idle => 7
  | .stopped => 13
  | .marker _ => 29
  | .data n text => n + text.utf8ByteSize.toUInt32

def make (value : UInt32) : Signal := if value == 0 then .idle else .data value "made"
def inspect (value : Scalars) : Bool :=
  match value with
  | .absent => false
  | .all _ b u8 u16 u32 u64 i8 i16 i32 i64 n i f32 f64 s bytes c w sw =>
    b && u8 == 255 && u16 == 65535 && u32 == 4294967295 && u64 == 18446744073709551615 &&
    i8 == -128 && i16 == -32768 && i32 == -2147483648 && i64 == -9223372036854775808 &&
    n == 2^5120 + 19 && i == -(2^5120 + 31) && f32 == 1.5 && f64 == -2.25 &&
    s == "A\x00🌱" && bytes == ⟨#[0, 255, 1]⟩ && c == '🌱' && w == 4294967295 && sw == -2147483648

def duplicate (value : ByteArray) : Buffers := .pair value value
def produce (size : Nat) : Buffers := .pair ⟨Array.replicate size.toUSize.toNat 17⟩ ⟨#[1]⟩

end Variants
