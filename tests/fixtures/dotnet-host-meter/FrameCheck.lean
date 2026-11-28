import LeanBridge.Host.Dotnet
open LeanBridge.Host.Dotnet

@[export lb_dn_test_through] def through (n : UInt32) : IO UInt32 := do
  return (← Box.observe n) + 1

@[export lb_dn_test_first] def firstError (n : UInt32) : IO UInt32 := do
  try Box.observe n catch first =>
    try let _ ← Box.observe (n + 1) catch _ => pure ()
    throw first

@[export lb_dn_test_mapped] def mapped (n : UInt32) : IO (Except String UInt32) :=
  EIO.toIO' ((Box.observe n).toEIO (fun _ => "mapped in Lean"))

@[export lb_dn_test_replace] def replaced (n : UInt32) : IO UInt32 := do
  try Box.observe n catch _ => throw (IO.userError "CLR host member failed")

@[export lb_dn_test_swallow] def swallowed (n : UInt32) : IO UInt32 := do
  try Box.observe n catch _ => return 999

@[export lb_dn_test_corpus] def corpus (_ : UInt32) : IO UInt32 := do
  Box.echo_unit ()
  unless !(← Box.echo_bool true) && (← Box.echo_char '🐝') == '🦋' do throw (IO.userError "Bool/Char")
  unless (← Box.echo_uint8 255) == 254 && (← Box.echo_int8 (-128)) == -127 do throw (IO.userError "8")
  unless (← Box.echo_uint16 65535) == 65534 && (← Box.echo_int16 (-32768)) == -32767 do throw (IO.userError "16")
  unless (← Box.echo_uint32 4294967295) == 4294967294 && (← Box.echo_int32 (-2147483648)) == -2147483647 do throw (IO.userError "32")
  unless (← Box.echo_uint64 18446744073709551615) == 18446744073709551614 do throw (IO.userError "UInt64")
  unless (← Box.echo_int64 (-9223372036854775808)) == -9223372036854775807 do throw (IO.userError "Int64")
  unless (← Box.echo_usize 18446744073709551615) == 18446744073709551614 do throw (IO.userError "USize")
  unless (← Box.echo_isize (-9223372036854775808)) == -9223372036854775807 do throw (IO.userError "ISize")
  unless (← Box.echo_float32 (Float32.ofBits 0x80000000)).toBits == (Float32.ofBits 0x7fc00042).toBits do throw (IO.userError "Float32 NaN")
  unless (← Box.echo_float64 (Float.ofBits 0x8000000000000000)).toBits == (Float.ofBits 0x7ff8000000000042).toBits do throw (IO.userError "Float NaN")
  unless (← Box.echo_float32 (Float32.ofBits 1)).toBits == 0x80000001 do throw (IO.userError "Float32 subnormal")
  unless (← Box.echo_float64 (Float.ofBits 1)).toBits == 0x8000000000000001 do throw (IO.userError "Float subnormal")
  let text := String.ofList ['🐝', Char.ofNat 0, 'a']
  unless (← Box.echo_string text) == text ++ "!" do throw (IO.userError "String")
  let bytes := ByteArray.mk #[0, 128, 255]
  unless (← Box.echo_bytes bytes).data == #[42, 128, 255] && bytes.data == #[0, 128, 255] do throw (IO.userError "ByteArray")
  unless (← Box.echo_nat 0) == 7 && (← Box.echo_nat (2^160)) == 2^160+7 do throw (IO.userError "Nat")
  unless (← Box.echo_int (-(2^160))) == -(2^160)-7 do throw (IO.userError "Int")
  return 41
