    private static void exercise() {
        try (var ticket = newTicket(BigInteger.valueOf(42), "A\0🌱")) {
            var huge = BigInteger.ONE.shiftLeft(128).add(BigInteger.ONE);
            var maximum = BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE);
            var scalars = new Scalars(Unit.INSTANCE, true, 0x1f331, huge, huge.negate(),
                255, 65535, 0xffff_ffffL, maximum, Byte.MIN_VALUE, Short.MIN_VALUE, Integer.MIN_VALUE, Long.MIN_VALUE,
                maximum, Long.MIN_VALUE, 1.5f, -2.25, "A\0🌱", new byte[] { 0, -1, 1 });
            var packet = new Packet(ticket, scalars, Option.some(Option.some(Unit.INSTANCE)), new Empty());
            check(inspect(packet), "Lean observes all nineteen JVM scalars");
            var copied = echo(packet);
            check(copied.scalars().equals(scalars) && inspect(copied), "all scalars round trip");
            check(copied.scalars().bytes() != scalars.bytes(), "independent bytes");
            check(copied.optional().equals(packet.optional()) && copied.empty().equals(packet.empty()), "nested Unit and empty record"); drop(copied);
            var made = makePacket(ticket); check(made.scalars().equals(scalars), "Lean constructs all scalars"); drop(made);
            for (int choice = 0; choice < 3; choice++) {
                Option<Option<Unit>> option = choice == 0 ? Option.none() : Option.some(choice == 1 ? Option.none() : Option.some(Unit.INSTANCE));
                var branch = with(packet, "optional", option);
                check(optionCase(branch) == choice, "nested option discriminant");
                var echoed = echo(branch); check(echoed.optional().equals(option), "nested option return"); drop(echoed);
            }
            for (int bits : new int[] { 0, 0x80000000, 1, 0x7f800000, 0xff800000, 0x7fc12345, 0x3f800001 }) {
                var source = with(packet, "scalars", with(scalars, "f32", Float.intBitsToFloat(bits)));
                long expected = Integer.toUnsignedLong(Float.isNaN(source.scalars().f32()) ? 0x7fc00000 : bits);
                check(bits32(source) == expected, "Lean Float32 toBits");
                var echoed = echo(source); check(Float.floatToRawIntBits(echoed.scalars().f32()) == bits, "Float32 payload preserved"); drop(echoed);
            }
            for (long bits : new long[] { 0, 0x8000000000000000L, 1, 0x7ff0000000000000L, 0xfff0000000000000L, 0x7ff8123456789abcL, 0x3ff0000000000001L }) {
                var source = with(packet, "scalars", with(scalars, "f64", Double.longBitsToDouble(bits)));
                long canonical = Double.isNaN(source.scalars().f64()) ? 0x7ff8000000000000L : bits;
                check(bits64(source).equals(new BigInteger(Long.toUnsignedString(canonical))), "Lean Float64 toBits");
                var echoed = echo(source); check(Double.doubleToRawLongBits(echoed.scalars().f64()) == bits, "Float64 payload preserved"); drop(echoed);
            }
            for (int length : new int[] { 0, 1, 31, 32, 33, 63, 64, 65, 127, 128, 129, 511, 4096 }) {
                var number = BigInteger.ONE.shiftLeft(length).subtract(BigInteger.ONE);
                for (int sign : new int[] { -1, 0, 1 }) {
                    var data = with(with(scalars, "natural", number), "integer", number.multiply(BigInteger.valueOf(sign)));
                    var echoed = echo(with(packet, "scalars", data));
                    check(echoed.scalars().equals(data), "GMP sign and limb boundaries"); drop(echoed);
                }
            }
            Unit[] values = new Unit[127]; Arrays.fill(values, Unit.INSTANCE);
            check(units(values).length == 127 && units(new Unit[0]).length == 0, "lists of Unit");
            reject(_OwnedConvert.Limit.class, () -> units(new Unit[262145]));
            reject(_OwnedConvert.Limit.class, () -> echo(with(packet, "scalars", with(scalars, "bytes", new byte[16 * 1024 * 1024]))));
            for (String text : new String[] { "", "\0", "e\u0301", "\udbff\udfff" }) {
                var echoed = echo(with(packet, "scalars", with(scalars, "text", text)));
                check(echoed.scalars().text().equals(text), "Unicode and empty string boundaries"); drop(echoed);
            }
            for (int character : new int[] { 0, 0xd7ff, 0xe000, 0x10ffff }) {
                var echoed = echo(with(packet, "scalars", with(scalars, "char_", character)));
                check(echoed.scalars().char_() == character, "Unicode scalar boundaries"); drop(echoed);
            }
            var emptyBytes = echo(with(packet, "scalars", with(scalars, "bytes", new byte[0])));
            check(emptyBytes.scalars().bytes().length == 0, "empty byte array"); drop(emptyBytes);
            for (var item : new Object[][] {
                { "natural", BigInteger.valueOf(-1) }, { "text", "\ud800" }, { "char_", 0xd800 },
                { "u8", -1 }, { "u8", 256 }, { "u16", 65536 }, { "u32", 0x1_0000_0000L },
                { "u64", maximum.add(BigInteger.ONE) }, { "word", BigInteger.valueOf(-1) }
            }) reject(IllegalArgumentException.class, () -> echo(with(packet, "scalars", with(scalars, (String)item[0], item[1]))));
            failures(() -> echo(packet));
            var kept = ticket.retain(); ticket.close();
            check(!kept.isClosed(), "explicit retain survives source closure");
            reject(LeanBridgeException.class, () -> inspect(packet)); kept.close();
        }
    }
