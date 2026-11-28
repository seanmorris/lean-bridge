import Workshop

open LeanBridge.Host.Javascript

@[export lb_js_generated_probe] def generatedProbe (mode : UInt32) : IO UInt32 := do
  let box ← Workshop.make 9
  let alias ← Workshop.identity box
  if mode == 1 then return ← Workshop.read alias
  if mode == 3 then
    try return ← Workshop.read alias
    catch _ => throw (IO.userError "application throw")
  if mode == 4 then
    try return ← Workshop.read alias
    catch first =>
      try let _ ← Workshop.read alias
          pure ()
      catch _ => pure ()
      throw first
  if mode == 2 then
    match ← (Workshop.mapped alias).toBaseIO with
    | .error "host read failed" => return 73
    | _ => throw (IO.userError "expected mapped host error")
  alias.echo_unit ()
  unless !(← alias.echo_bool true) do throw (IO.userError "Bool")
  unless (← alias.echo_char '🐝') == '🦋' do throw (IO.userError "Char")
  unless (← alias.echo_uint8 255) == 254 do throw (IO.userError "UInt8")
  unless (← alias.echo_uint16 65535) == 65534 do throw (IO.userError "UInt16")
  unless (← alias.echo_uint32 4294967295) == 4294967294 do throw (IO.userError "UInt32")
  unless (← alias.echo_uint64 18446744073709551615) == 18446744073709551614 do throw (IO.userError "UInt64")
  unless (← alias.echo_usize 4294967295) == 4294967294 do throw (IO.userError "USize")
  unless (← alias.echo_int8 (-128)) == -127 do throw (IO.userError "Int8")
  unless (← alias.echo_int16 (-32768)) == -32767 do throw (IO.userError "Int16")
  unless (← alias.echo_int32 (-2147483648)) == -2147483647 do throw (IO.userError "Int32")
  unless (← alias.echo_int64 (-9223372036854775808)) == -9223372036854775807 do throw (IO.userError "Int64")
  unless (← alias.echo_isize (-2147483648)) == -2147483647 do throw (IO.userError "ISize")
  unless (← alias.echo_float32 (Float32.ofBits 1)).toBits == 0x80000001 do throw (IO.userError "Float32")
  unless (← alias.echo_float64 (Float.ofBits 1)).toBits == 0x8000000000000001 do throw (IO.userError "Float")
  let text := String.ofList [Char.ofNat 0xfeff, '🐝', Char.ofNat 0]
  unless (← alias.echo_string text) == text ++ "!" do throw (IO.userError "String")
  let bytes := ByteArray.mk #[0,128,255]
  unless (← alias.echo_bytes bytes).data == #[42,128,255] && bytes.data == #[0,128,255] do throw (IO.userError "ByteArray")
  unless (← alias.echo_nat (2^160)) == 2^160+7 do throw (IO.userError "Nat")
  unless (← alias.echo_int (-(2^160))) == -(2^160)-7 do throw (IO.userError "Int")
  let _ ← Workshop.update alias 42
  let other ← Workshop.make 17
  let child ← box.child
  let sibling ← box.childOf other
  unless (← child.consume) == 43 && (← sibling.consume) == 18 do throw (IO.userError "borrow or transfer")
  Workshop.read box
