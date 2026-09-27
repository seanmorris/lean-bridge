    private static int called;
    private static <T> T seen(T value) { called++; return value; }
    private static void exercise() {
        viaUnit(value -> { called++; }, Unit.INSTANCE); check(called == 1, "Unit callback executes");
        check(viaBool(value -> seen(!value), false), "Bool callback");
        check(viaChar(OwnedCallProbe::seen, 0x1f331) == 0x1f331, "Char callback");
        var huge = BigInteger.ONE.shiftLeft(257).add(BigInteger.ONE);
        check(viaNat(value -> seen(value.add(BigInteger.ONE)), huge).equals(huge.add(BigInteger.ONE)), "Nat callback");
        check(viaInt(value -> seen(value.subtract(BigInteger.ONE)), huge.negate()).equals(huge.negate().subtract(BigInteger.ONE)), "Int callback");
        check(viaU8(OwnedCallProbe::seen, 255) == 255, "UInt8 callback");
        check(viaU16(OwnedCallProbe::seen, 65535) == 65535, "UInt16 callback");
        check(viaU32(OwnedCallProbe::seen, 0xffff_ffffL) == 0xffff_ffffL, "UInt32 callback");
        var word = BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE);
        check(viaU64(OwnedCallProbe::seen, word).equals(word), "UInt64 callback");
        check(viaI8(OwnedCallProbe::seen, Byte.MIN_VALUE) == Byte.MIN_VALUE, "Int8 callback");
        check(viaI16(OwnedCallProbe::seen, Short.MIN_VALUE) == Short.MIN_VALUE, "Int16 callback");
        check(viaI32(OwnedCallProbe::seen, Integer.MIN_VALUE) == Integer.MIN_VALUE, "Int32 callback");
        check(viaI64(OwnedCallProbe::seen, Long.MIN_VALUE) == Long.MIN_VALUE, "Int64 callback");
        check(viaUsize(OwnedCallProbe::seen, word).equals(word), "USize callback");
        check(viaIsize(OwnedCallProbe::seen, Long.MIN_VALUE) == Long.MIN_VALUE, "ISize callback");
        check(Float.floatToRawIntBits(viaF32(OwnedCallProbe::seen, Float.intBitsToFloat(0x7fc12345))) == 0x7fc12345, "Float32 NaN payload callback");
        check(Double.doubleToRawLongBits(viaF64(OwnedCallProbe::seen, Double.longBitsToDouble(0x7ff8123456789abcL))) == 0x7ff8123456789abcL, "Float64 NaN payload callback");
        check(viaString(OwnedCallProbe::seen, "A\0🌱").equals("A\0🌱"), "String passed by value");
        byte[] bytes = { 0, -1, 3 }; var copied = viaBytes(OwnedCallProbe::seen, bytes);
        check(Arrays.equals(copied, bytes) && copied != bytes, "ByteArray passed by value");
        check(called == 19, "all nineteen scalar callbacks executed");
        reject(IllegalArgumentException.class, () -> viaNat(ignored -> BigInteger.valueOf(-1), BigInteger.ZERO));
        reject(IllegalArgumentException.class, () -> viaString(ignored -> "\ud800", ""));
        reject(IllegalArgumentException.class, () -> viaBytes(ignored -> null, new byte[0]));
        failures(() -> viaNat(value -> value.add(BigInteger.ONE), huge));
        failures(() -> viaString(value -> value, "A\0🌱"));
        failures(() -> viaBytes(value -> value, bytes));
        try (var ticket = newTicket(BigInteger.valueOf(17), "higher")) {
            var input = new Bundle(ticket, Option.none(), new Ticket[0], new Ticket[0], new Payload(BigInteger.ZERO, new byte[0]));
            var escaped = new CallbackRecordArgument1Closure[1]; var kept = new CallbackRecordArgument1Closure[1];
            var result = withFunction(input, (closure, value) -> {
                escaped[0] = closure; kept[0] = closure.retain();
                var nested = closure.invoke(value);
                check(serial(nested.primary()).intValueExact() == 17, "borrowed native closure invocation");
                drop(nested); return value;
            });
            check(escaped[0].isClosed() && !kept[0].isClosed(), "higher-order borrow expires");
            reject(LeanBridgeException.class, () -> escaped[0].invoke(input));
            drop(result); result = kept[0].invoke(input);
            check(serial(result.primary()).intValueExact() == 17, "retained incoming closure"); drop(result);
            var failures = new Throwable[1];
            var thread = new Thread(() -> { try { kept[0].invoke(input); } catch (Throwable error) { failures[0] = error; } });
            thread.start(); try { thread.join(); } catch (InterruptedException error) { throw new AssertionError(error); }
            check(failures[0] instanceof LeanBridgeException error && error.status() == 5, "closure creator-thread affinity");
            kept[0].close();
            failures(() -> withFunction(input, (closure, value) -> {
                var nested = closure.invoke(value); drop(nested); return value;
            }));
        }
    }
