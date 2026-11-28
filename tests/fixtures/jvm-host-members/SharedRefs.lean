import LeanBridge.Host.Jvm
open LeanBridge.Host.Jvm

@[export lb_test_explain]
def explain (e : IO.Error) : String := toString e

@[export lb_compare_wrappers]
unsafe def compareWrappers (a b : Box) : IO Bool := pure (ptrEq a b)

@[export lb_box_self]
def boxSelf (box : Box) : IO Box := box.identity

@[export lb_key_self]
def keySelf (key : Key) : IO Key := key.identity

@[export lb_box_corpus]
def corpus (box : Box) : IO Box := do
  box.echo_unit ()
  unless (← box.echo_bool true) == false do throw (IO.userError "Bool")
  unless (← box.echo_char '🐝') == '🦋' do throw (IO.userError "Char")
  unless (← box.echo_uint8 255) == 254 do throw (IO.userError "UInt8")
  unless (← box.echo_uint16 65535) == 65534 do throw (IO.userError "UInt16")
  unless (← box.echo_uint32 4294967295) == 4294967294 do throw (IO.userError "UInt32")
  unless (← box.echo_uint64 18446744073709551615) == 18446744073709551614 do throw (IO.userError "UInt64")
  unless (← box.echo_usize 18446744073709551615) == 18446744073709551614 do throw (IO.userError "USize")
  unless (← box.echo_int8 (-128)) == -127 do throw (IO.userError "Int8")
  unless (← box.echo_int16 (-32768)) == -32767 do throw (IO.userError "Int16")
  unless (← box.echo_int32 (-2147483648)) == -2147483647 do throw (IO.userError "Int32")
  unless (← box.echo_int64 (-9223372036854775808)) == -9223372036854775807 do throw (IO.userError "Int64")
  unless (← box.echo_isize (-9223372036854775808)) == -9223372036854775807 do throw (IO.userError "ISize")
  -- Match Lean's own observer (4.32.2 canonicalizes NaN in toBits).
  unless (← box.echo_float32 (Float32.ofBits 0x80000000)).toBits == (Float32.ofBits 0x7fc00042).toBits do throw (IO.userError "Float32 NaN")
  unless (← box.echo_float64 (Float.ofBits 0x8000000000000000)).toBits == (Float.ofBits 0x7ff8000000000042).toBits do throw (IO.userError "Float NaN")
  unless (← box.echo_float32 (Float32.ofBits 1)).toBits == 0x80000001 do throw (IO.userError "Float32 subnormal")
  unless (← box.echo_float64 (Float.ofBits 1)).toBits == 0x8000000000000001 do throw (IO.userError "Float subnormal")
  let text := String.ofList ['🐝', Char.ofNat 0, 'a']
  unless (← box.echo_string text) == text ++ "!" do throw (IO.userError "String")
  let bytes := ByteArray.mk #[0, 128, 255]
  unless (← box.echo_bytes bytes).data == #[42, 128, 255] && bytes.data == #[0, 128, 255] do throw (IO.userError "ByteArray")
  unless (← box.echo_nat (2^160)) == 2^160+7 do throw (IO.userError "Nat")
  unless (← box.echo_int (-(2^160))) == -(2^160)-7 do throw (IO.userError "Int")
  pure box
