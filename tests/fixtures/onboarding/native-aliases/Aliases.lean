namespace Aliases

abbrev AUnit := Unit
abbrev ABool := Bool
abbrev AU8 := UInt8
abbrev AU16 := UInt16
abbrev AU32 := UInt32
abbrev AU64 := UInt64
abbrev AI8 := Int8
abbrev AI16 := Int16
abbrev AI32 := Int32
abbrev AI64 := Int64
abbrev ANat := Nat
abbrev AInt := Int
abbrev AF32 := Float32
abbrev AF64 := Float
abbrev AText := String
abbrev ABytes := ByteArray
abbrev AChar := Char
abbrev AWord := USize
abbrev ASignedWord := ISize

structure Scalars where
  v_unit : AUnit
  v_bool : ABool
  v_uint8 : AU8
  v_uint16 : AU16
  v_uint32 : AU32
  v_uint64 : AU64
  v_int8 : AI8
  v_int16 : AI16
  v_int32 : AI32
  v_int64 : AI64
  v_nat : ANat
  v_int : AInt
  v_float32 : AF32
  v_float64 : AF64
  v_string : AText
  v_bytes : ABytes
  v_char : AChar
  v_usize : AWord
  v_isize : ASignedWord

abbrev ScalarsView := Scalars

abbrev Count := AU32
def OtherCount := UInt32
abbrev Rows := Array (List Count)
abbrev Maybe := Option (Option AUnit)
abbrev Outcome := Except AText (Count × ABytes)

structure Packet where
  count : Count
  text : AText
  rows : Rows
  maybe : Maybe
  outcome : Outcome

abbrev PacketView := Packet
abbrev Packets := List PacketView

def echo_unit (value : AUnit) : AUnit := value
def echo_bool (value : ABool) : ABool := value
def echo_uint8 (value : AU8) : AU8 := value
def echo_uint16 (value : AU16) : AU16 := value
def echo_uint32 (value : AU32) : AU32 := value
def echo_uint64 (value : AU64) : AU64 := value
def echo_int8 (value : AI8) : AI8 := value
def echo_int16 (value : AI16) : AI16 := value
def echo_int32 (value : AI32) : AI32 := value
def echo_int64 (value : AI64) : AI64 := value
def echo_nat (value : ANat) : ANat := value
def echo_int (value : AInt) : AInt := value
def echo_float32 (value : AF32) : AF32 := value
def echo_float64 (value : AF64) : AF64 := value
def echo_string (value : AText) : AText := value
def echo_bytes (value : ABytes) : ABytes := value
def echo_char (value : AChar) : AChar := value
def echo_usize (value : AWord) : AWord := value
def echo_isize (value : ASignedWord) : ASignedWord := value

def echo_scalars (value : ScalarsView) : ScalarsView := value
def inspect (value : ScalarsView) : Bool :=
  value.v_bool && value.v_uint8 == 255 && value.v_uint16 == 65535 &&
  value.v_uint32 == 4294967295 && value.v_uint64 == 18446744073709551615 &&
  value.v_int8 == -128 && value.v_int16 == -32768 && value.v_int32 == -2147483648 &&
  value.v_int64 == -9223372036854775808 && value.v_nat == 2^5120 + 19 &&
  value.v_int == -(2^5120 + 31) && value.v_float32 == 1.5 && value.v_float64 == -2.25 &&
  value.v_string == "A\x00🌱" && value.v_bytes == ⟨#[0, 255, 1]⟩ &&
  value.v_char == '🌱' && value.v_usize == 4294967295 && value.v_isize == -2147483648

def increment (value : Count) : OtherCount := value + 1
def make : Count := 41
def label : AText := "alias🌱"
def change_packet (value : PacketView) : PacketView := { value with count := value.count + 1 }
def reverse_packets (value : Packets) : Packets := value.reverse
def reverse_rows (value : Rows) : Rows := value.map List.reverse
def echo_maybe (value : Maybe) : Maybe := value
def echo_outcome (value : Outcome) : Outcome := value
def duplicate (value : ABytes) : Outcome := .ok (7, value ++ value)
def produce (count : ANat) : ABytes := ByteArray.mk (Array.replicate count 7)

end Aliases
