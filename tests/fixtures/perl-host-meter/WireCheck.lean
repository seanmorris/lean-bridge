import LeanBridge.Host.Perl
open LeanBridge.Host.Perl

@[export lbp_test_explain]
def explainFault (e : IO.Error) : String := toString e

@[export lbp_test_child]
def borrowFromReceiver (owner : Box) : IO Box := owner.child

@[export lbp_test_child_of]
def borrowFromParameter (actor keeper : Box) : IO Box := actor.child_of keeper

@[export lbp_test_wire]
def checkWire (b : Box) : IO Box := do
  b.echo_unit ()
  unless !(← b.echo_bool true) do throw (IO.userError "bool")
  unless (← b.echo_char '🐝') == '🦋' do throw (IO.userError "char")
  unless (← b.echo_uint8 255) == 254 do throw (IO.userError "uint8")
  unless (← b.echo_uint16 65535) == 65534 do throw (IO.userError "uint16")
  unless (← b.echo_uint32 4294967295) == 4294967294 do throw (IO.userError "uint32")
  unless (← b.echo_uint64 18446744073709551615) == 18446744073709551614 do throw (IO.userError "uint64")
  unless (← b.echo_usize 18446744073709551615) == 18446744073709551614 do throw (IO.userError "usize")
  unless (← b.echo_int8 (-128)) == -127 do throw (IO.userError "int8")
  unless (← b.echo_int16 (-32768)) == -32767 do throw (IO.userError "int16")
  unless (← b.echo_int32 (-2147483648)) == -2147483647 do throw (IO.userError "int32")
  unless (← b.echo_int64 (-9223372036854775808)) == -9223372036854775807 do throw (IO.userError "int64")
  unless (← b.echo_isize (-9223372036854775808)) == -9223372036854775807 do throw (IO.userError "isize")
  unless (← b.echo_float32 (Float32.ofBits 1)).toBits == 0x80000001 do throw (IO.userError "float32")
  unless (← b.echo_float64 (Float.ofBits 1)).toBits == 0x8000000000000001 do throw (IO.userError "float64")
  let text := String.ofList ['🐝', Char.ofNat 0, 'a']
  unless (← b.echo_string text) == text ++ "!" do throw (IO.userError "string")
  let bytes := ByteArray.mk #[0,128,255]
  unless (← b.echo_bytes bytes).data == #[42,128,255] && bytes.data == #[0,128,255] do throw (IO.userError "bytes")
  unless (← b.echo_nat (2^160)) == 2^160+7 do throw (IO.userError "nat")
  unless (← b.echo_int (-(2^160))) == -(2^160)-7 do throw (IO.userError "int")
  let created ← Box.create 41
  created.setLevel 42
  unless (← created.getLevel) == 42 && (← created.read) == 42 do throw (IO.userError "ctor/property")
  b.identity
