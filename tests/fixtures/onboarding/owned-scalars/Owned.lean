namespace Owned

structure Ticket where
  serial : Nat
  label : String

structure Scalars where
  unit : Unit
  flag : Bool
  char : Char
  natural : Nat
  integer : Int
  u8 : UInt8
  u16 : UInt16
  u32 : UInt32
  u64 : UInt64
  i8 : Int8
  i16 : Int16
  i32 : Int32
  i64 : Int64
  word : USize
  signedWord : ISize
  f32 : Float32
  f64 : Float
  text : String
  bytes : ByteArray

structure Empty where

structure Packet where
  ticket : Ticket
  scalars : Scalars
  optional : Option (Option Unit)
  empty : Empty

def newTicket (serial : Nat) (label : String) : Ticket := ⟨serial, label⟩
def echo (value : Packet) : Packet := value
def makePacket (ticket : Ticket) : Packet := {
  ticket
  scalars := {
    unit := (), flag := true, char := Char.ofNat 0x1f331
    natural := 2^128 + 1, integer := -(2^128 + 1)
    u8 := 255, u16 := 65535, u32 := 4294967295, u64 := 18446744073709551615
    i8 := -128, i16 := -32768, i32 := -2147483648, i64 := -9223372036854775808
    word := 18446744073709551615, signedWord := -9223372036854775808
    f32 := 1.5, f64 := -2.25
    text := String.ofList ['A', Char.ofNat 0, Char.ofNat 0x1f331]
    bytes := ByteArray.mk #[0, 255, 1]
  }
  optional := some (some ())
  empty := {}
}

def inspect (value : Packet) : Bool :=
  let p := value.scalars
  value.ticket.serial == 42 && p.unit == () && p.flag && p.char.toNat == 0x1f331 &&
    p.natural == 2^128 + 1 && p.integer == -(2^128 + 1) &&
    p.u8 == 255 && p.u16 == 65535 && p.u32 == 4294967295 && p.u64 == 18446744073709551615 &&
    p.i8 == -128 && p.i16 == -32768 && p.i32 == -2147483648 && p.i64 == -9223372036854775808 &&
    p.word.toUInt64 == 18446744073709551615 && p.signedWord.toInt == -9223372036854775808 &&
    p.f32 == 1.5 && p.f64 == -2.25 &&
    p.text == String.ofList ['A', Char.ofNat 0, Char.ofNat 0x1f331] && p.bytes.data == #[0, 255, 1]

def optionCase (value : Packet) : UInt8 :=
  match value.optional with
  | none => 0
  | some none => 1
  | some (some ()) => 2

def bits32 (value : Packet) : UInt32 := value.scalars.f32.toBits
def bits64 (value : Packet) : UInt64 := value.scalars.f64.toBits
def units (value : List Unit) : List Unit := value

theorem echo_preserves (value : Packet) : echo value = value := rfl

end Owned
