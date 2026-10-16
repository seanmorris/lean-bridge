// Independent nineteen-base Java caller. Generated equality and serialization are not oracles.
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigInteger;
import java.util.Arrays;
import java.util.function.Function;
import org.leanbridge.nominalprimitivesubtypes.*;

final class Consumer {
    private static final int ROUNDS = 256;
    private static int checks, rejections, hostRejections, snapshotControls;
    private Consumer() { }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    static final BigInteger HUGE = BigInteger.ONE.shiftLeft(100);
    @SafeVarargs static <T> T[] values(T... items) { return items; }
    static byte[] bytes(int... items) {
        byte[] result = new byte[items.length];
        for (int index = 0; index < items.length; index++) result[index] = (byte) items[index];
        return result;
    }
    // Every primitive base of one packet, mutable before it becomes an immutable record.
    static final class Fields {
        Unit unitValue = Unit.INSTANCE; boolean boolValue = true;
        int uint8Value = 42, uint16Value = 42; long uint32Value = 42; BigInteger uint64Value = n(42);
        byte int8Value = -42; short int16Value = -42; int int32Value = -42; long int64Value = -42;
        BigInteger natValue = n(42), intValue = n(-42);
        float float32Value = 1.5f; double float64Value = 1.5;
        String textValue = "a"; byte[] bytesValue = Consumer.bytes(0, 128, 255); int charValue = 'a';
        BigInteger usizeValue = n(42); long isizeValue = -42; BigInteger digit = n(2);
        Fields bool(boolean value) { boolValue = value; return this; }
        Fields uint8(int value) { uint8Value = value; return this; }
        Fields uint16(int value) { uint16Value = value; return this; }
        Fields uint32(long value) { uint32Value = value; return this; }
        Fields uint64(BigInteger value) { uint64Value = value; return this; }
        Fields int8(int value) { int8Value = (byte) value; return this; }
        Fields int16(int value) { int16Value = (short) value; return this; }
        Fields int32(int value) { int32Value = value; return this; }
        Fields int64(long value) { int64Value = value; return this; }
        Fields nat(BigInteger value) { natValue = value; return this; }
        Fields integer(BigInteger value) { intValue = value; return this; }
        Fields float32(float value) { float32Value = value; return this; }
        Fields float64(double value) { float64Value = value; return this; }
        Fields text(String value) { textValue = value; return this; }
        Fields bytes(byte[] value) { bytesValue = value; return this; }
        Fields character(int value) { charValue = value; return this; }
        Fields usize(BigInteger value) { usizeValue = value; return this; }
        Fields isize(long value) { isizeValue = value; return this; }
        Fields digit(BigInteger value) { digit = value; return this; }
        Packet packet() {
            return new Packet(unitValue, boolValue, uint8Value, uint16Value, uint32Value, uint64Value, int8Value, int16Value, int32Value, int64Value,
                natValue, intValue, float32Value, float64Value, textValue, bytesValue, charValue, usizeValue, isizeValue, digit);
        }
        RawPacket raw() {
            return new RawPacket(unitValue, boolValue, uint8Value, uint16Value, uint32Value, uint64Value, int8Value, int16Value, int32Value, int64Value,
                natValue, intValue, float32Value, float64Value, textValue, bytesValue, charValue, usizeValue, isizeValue, digit);
        }
    }
    static Fields base() { return new Fields(); }
    // The B constructors normalize every base differently from the A constructors.
    static Fields normalized() {
        return base().uint8(44).uint16(44).uint32(44).uint64(n(44)).int8(-40).int16(-40).int32(-40).int64(-40)
            .nat(n(44)).integer(n(-40)).float32(-1.5f).float64(-1.5).text("a!").bytes(bytes(0, 128, 255, 255))
            .character('b').usize(n(44)).isize(-40);
    }
    // Producers never call the A/B selections; their outputs exceed every input limit.
    static Fields produced() {
        return base().uint8(200).uint16(200).uint32(200).uint64(n(200)).int8(120).int16(120).int32(120).int64(120)
            .nat(HUGE).integer(HUGE.negate()).float32(12.5f).float64(12.5).text("long λ text")
            .bytes(bytes(0, 1, 2, 3, 4, 5, 128, 254, 255)).character(0x3bb).usize(n(200)).isize(200);
    }
    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError("failed: " + message);
        checks++;
    }
    static void writePacket(DataOutputStream out, Unit unitValue, boolean boolValue, int uint8Value, int uint16Value, long uint32Value, BigInteger uint64Value,
        byte int8Value, short int16Value, int int32Value, long int64Value, BigInteger natValue, BigInteger intValue, float float32Value, double float64Value,
        String textValue, byte[] bytesValue, int charValue, BigInteger usizeValue, long isizeValue, BigInteger digit) throws IOException {
        for (Object value : new Object[] { unitValue, boolValue, uint8Value, uint16Value, uint32Value, uint64Value, int8Value, int16Value, int32Value, int64Value,
            natValue, intValue, float32Value, float64Value, textValue, bytesValue, charValue, usizeValue, isizeValue, digit }) writeSnapshot(out, value);
    }
    // Distinguish every host representation one Lean base keeps apart, including float signs and NaN payloads.
    static void writeSnapshot(DataOutputStream out, Object value) throws IOException {
        if (value == null) { out.writeUTF("null"); return; }
        out.writeUTF(value.getClass().getName());
        if (value instanceof BigInteger number) {
            byte[] encoded = number.toByteArray(); out.writeInt(encoded.length); out.write(encoded);
        } else if (value instanceof Boolean flag) {
            out.writeBoolean(flag);
        } else if (value instanceof Byte number) {
            out.writeByte(number);
        } else if (value instanceof Short number) {
            out.writeShort(number);
        } else if (value instanceof Integer number) {
            out.writeInt(number);
        } else if (value instanceof Long number) {
            out.writeLong(number);
        } else if (value instanceof Float number) {
            out.writeInt(Float.floatToRawIntBits(number));
        } else if (value instanceof Double number) {
            out.writeLong(Double.doubleToRawLongBits(number));
        } else if (value instanceof String text) {
            out.writeInt(text.length()); for (int index = 0; index < text.length(); index++) out.writeChar(text.charAt(index));
        } else if (value instanceof byte[] data) {
            out.writeInt(data.length); out.write(data);
        } else if (value instanceof Unit) {
            out.writeUTF("unit");
        } else if (value instanceof Packet item) {
            writePacket(out, item.unitValue(), item.boolValue(), item.uint8Value(), item.uint16Value(), item.uint32Value(), item.uint64Value(), item.int8Value(),
                item.int16Value(), item.int32Value(), item.int64Value(), item.natValue(), item.intValue(), item.float32Value(), item.float64Value(), item.textValue(),
                item.bytesValue(), item.charValue(), item.usizeValue(), item.isizeValue(), item.digit());
        } else if (value instanceof RawPacket item) {
            writePacket(out, item.unitValue(), item.boolValue(), item.uint8Value(), item.uint16Value(), item.uint32Value(), item.uint64Value(), item.int8Value(),
                item.int16Value(), item.int32Value(), item.int64Value(), item.natValue(), item.intValue(), item.float32Value(), item.float64Value(), item.textValue(),
                item.bytesValue(), item.charValue(), item.usizeValue(), item.isizeValue(), item.digit());
        } else if (value instanceof PacketPair pair) {
            writeSnapshot(out, pair.left()); writeSnapshot(out, pair.right());
        } else if (value instanceof EventEmpty) {
            out.writeUTF("empty");
        } else if (value instanceof EventBox item) {
            writeSnapshot(out, item.value());
        } else if (value instanceof EventChoices item) {
            writeSnapshot(out, item.values());
        } else if (value instanceof Option<?> item) {
            out.writeBoolean(item.isSome());
            if (item.isSome()) writeSnapshot(out, item.value());
        } else if (value instanceof Result<?, ?> item) {
            out.writeBoolean(item.isOk());
            writeSnapshot(out, item.isOk() ? item.value() : item.error());
        } else if (value instanceof Pair<?, ?> pair) {
            writeSnapshot(out, pair.first()); writeSnapshot(out, pair.second());
        } else if (value instanceof Object[] array) {
            out.writeInt(array.length);
            for (Object item : array) writeSnapshot(out, item);
        } else throw new AssertionError("Unknown snapshot type: " + value.getClass());
    }
    static byte[] snapshot(Object value) {
        try {
            var bytes = new ByteArrayOutputStream();
            try (var out = new DataOutputStream(bytes)) { writeSnapshot(out, value); }
            return bytes.toByteArray();
        } catch (IOException error) { throw new UncheckedIOException(error); }
    }
    static boolean same(Object left, Object right) { return Arrays.equals(snapshot(left), snapshot(right)); }
    static <I, O> O call(I input, Function<I, O> action, O expected) {
        byte[] before = snapshot(input);
        O result = action.apply(input);
        check(same(result, expected), "exact copied result");
        check(Arrays.equals(snapshot(input), before), "complete accepted input unchanged");
        return result;
    }
    static <I, O> void refusedHost(I input, Function<I, O> action, Class<? extends RuntimeException> expected) {
        byte[] before = snapshot(input);
        try { action.apply(input); throw new AssertionError("accepted: invalid host input"); }
        catch (RuntimeException error) {
            check(error.getClass() == expected, "host rejection class: " + error);
        }
        check(Arrays.equals(snapshot(input), before), "complete host-rejected input unchanged");
        hostRejections++;
    }
    static <I, O> void refused(I input, Function<I, O> action, String expected) {
        byte[] before = snapshot(input);
        try { action.apply(input); throw new AssertionError("accepted: " + expected); }
        catch (IllegalArgumentException error) {
            check(error.getClass() == IllegalArgumentException.class && expected.equals(error.getMessage()),
                "refusal: " + expected + "; got " + error);
        }
        check(Arrays.equals(snapshot(input), before), "complete rejected input unchanged");
        rejections++;
    }
    static String subtype(String path, String constructor) { return path + " was rejected by NominalPrimitiveSubtypes." + constructor; }
    static String fin(String path) { return path + " is not below its Fin 3 bound"; }
    static Option<Packet>[] group(Packet out) { return values(Option.none(), Option.some(out)); }
    // One invalid value per base, the A constructor that refuses it, or the Fin digit.
    record Invalid(Fields packet, String field, String constructor) { }
    static Invalid[] invalid() {
        float infinity = Float.POSITIVE_INFINITY; double infinite = Double.POSITIVE_INFINITY;
        return new Invalid[] {
            new Invalid(base().bool(false), "boolValue", "boolA"), new Invalid(base().uint8(43), "uint8Value", "uint8A"),
            new Invalid(base().uint16(43), "uint16Value", "uint16A"), new Invalid(base().uint32(43), "uint32Value", "uint32A"),
            new Invalid(base().uint64(n(43)), "uint64Value", "uint64A"), new Invalid(base().int8(-43), "int8Value", "int8A"),
            new Invalid(base().int16(-43), "int16Value", "int16A"), new Invalid(base().int32(-43), "int32Value", "int32A"),
            new Invalid(base().int64(-43), "int64Value", "int64A"), new Invalid(base().nat(n(43)), "natValue", "natA"),
            new Invalid(base().integer(n(-43)), "intValue", "intA"), new Invalid(base().float32(infinity), "float32Value", "float32A"),
            new Invalid(base().float64(infinite), "float64Value", "float64A"), new Invalid(base().text(""), "textValue", "textA"),
            new Invalid(base().bytes(bytes()), "bytesValue", "bytesA"), new Invalid(base().character(0), "charValue", "charA"),
            new Invalid(base().usize(n(43)), "usizeValue", "usizeA"), new Invalid(base().isize(-43), "isizeValue", "isizeA"),
            new Invalid(base().digit(n(3)), "digit", null)
        };
    }
    public static void main(String[] arguments) {
        if (arguments.length != 0) throw new AssertionError("Unexpected caller arguments");
        Packet out = produced().packet(); RawPacket rawOut = produced().raw();
        Object[][] controls = {
            { null, Boolean.FALSE }, { Boolean.FALSE, 0 }, { 0, 0.0 }, { 0.0, -0.0 },
            { bytes(0), bytes(1) }, { "a\0λ😀", "aλ😀" },
            { values(Option.none(), Option.some(out)), values(Option.some(out), Option.none()) },
            { new EventBox(out), new EventChoices(values(Option.some(Result.ok(out)))) },
            { base().packet(), base().raw() }
        };
        for (Object[] control : controls) {
            check(!same(control[0], control[1]), "independent snapshot mutation control");
            snapshotControls++;
        }
        // Host conversions refuse what the Java types can express but Lean cannot receive.
        Consumer.<RawPacket, Option<Packet>>refusedHost(null, Api::produce, NullPointerException.class);
        refusedHost(base().uint8(256).raw(), Api::produce, IllegalArgumentException.class);
        refusedHost(base().uint64(n(-1)).raw(), Api::produce, IllegalArgumentException.class);
        refusedHost(base().nat(n(-1)).raw(), Api::produce, IllegalArgumentException.class);
        refusedHost(base().character(0xd800).raw(), Api::produce, IllegalArgumentException.class);
        refusedHost(base().text("\ud83d").raw(), Api::produce, IllegalArgumentException.class);
        refusedHost(base().usize(n(-1)).raw(), Api::produce, IllegalArgumentException.class);
        Consumer.<Unit, Long>call(Unit.INSTANCE, ignored -> Api.wordBits(), 64L);
        call(rawOut, Api::produce, Option.some(out));
        call(rawOut, Api::produceGroup, group(out));
        call(rawOut, Api::producePair, new PacketPair(group(out), group(out)));
        Consumer.<RawPacket, Event>call(rawOut, Api::produceEvent, new EventBox(out));
        Consumer.<RawPacket, Event>call(rawOut, Api::produceChoices, new EventChoices(values(Option.none(), Option.some(Result.ok(out)), Option.some(Result.err(out)))));
        for (Invalid item : invalid()) {
            call(item.packet().raw(), Api::produce, Option.none());
            refused(item.packet().packet(), Api::echoA, item.constructor() == null ? fin("value0." + item.field()) : subtype("value0." + item.field(), item.constructor()));
        }
        RawPacket absent = base().nat(n(43)).raw();
        call(absent, Api::produceGroup, Consumer.<Option<Packet>>values(Option.none()));
        call(absent, Api::producePair, new PacketPair(values(Option.none()), values(Option.none())));
        Consumer.<RawPacket, Event>call(absent, Api::produceEvent, new EventEmpty());
        Consumer.<RawPacket, Event>call(absent, Api::produceChoices, new EventChoices(values(Option.none())));
        full();
        System.out.println("{\"checks\":" + checks + ",\"rejections\":" + rejections + ",\"hostRejections\":" + hostRejections
            + ",\"snapshotControls\":" + snapshotControls + ",\"rounds\":" + ROUNDS + ",\"wordBits\":64}");
    }
    record Extreme(Fields packet, Fields expected) { }
    static void full() {
        Packet a = base().packet(), b = base().bool(false).packet(), n = normalized().packet();
        call(a, Api::echoA, a);
        call(b, Api::echoB, n);
        refused(a, Api::refuseUnit, subtype("value0.unitValue", "unitReject"));
        call(new Pair<>(a, b), v -> Api.combine(v.first(), v.second()), new Pair<>(a, n));
        call(new PacketPair(values(Option.none(), Option.some(a)), values(Option.some(b))), Api::echoPair,
            new PacketPair(values(Option.none(), Option.some(a)), values(Option.some(n))));
        Option<Packet>[] left = values(Option.none(), Option.some(a)), right = values(Option.some(b), Option.none());
        call(new Pair<>(left, right), v -> Api.aliases(v.first(), v.second()), Consumer.<Option<Packet>>values(Option.none(), Option.some(a), Option.some(n), Option.none()));
        Consumer.<Event, Event>call(new EventEmpty(), Api::echoEventA, new EventEmpty());
        Consumer.<Event, Event>call(new EventEmpty(), Api::echoEventB, new EventEmpty());
        Consumer.<Event, Event>call(new EventBox(a), Api::echoEventA, new EventBox(a));
        Consumer.<Event, Event>call(new EventBox(b), Api::echoEventB, new EventBox(n));
        Consumer.<Event, Event>call(new EventChoices(values(Option.none(), Option.some(Result.ok(a)), Option.some(Result.err(b)))), Api::echoEventA,
            new EventChoices(values(Option.none(), Option.some(Result.ok(a)), Option.some(Result.err(n)))));
        Consumer.<Event, Event>call(new EventChoices(values(Option.none(), Option.some(Result.ok(b)), Option.some(Result.err(a)))), Api::echoEventB,
            new EventChoices(values(Option.none(), Option.some(Result.ok(n)), Option.some(Result.err(a)))));
        // Each base's B normalization at its extreme host value: wrapping words, growing big integers, negated floats.
        BigInteger uint64Max = BigInteger.ONE.shiftLeft(64).subtract(n(2));
        Extreme[] extremes = {
            new Extreme(base().bool(false).uint8(254), normalized().uint8(0)), new Extreme(base().bool(false).uint16(65534), normalized().uint16(0)),
            new Extreme(base().bool(false).uint32(4294967294L), normalized().uint32(0)), new Extreme(base().bool(false).uint64(uint64Max), normalized().uint64(n(0))),
            new Extreme(base().bool(false).int8(126), normalized().int8(-128)), new Extreme(base().bool(false).int16(32766), normalized().int16(-32768)),
            new Extreme(base().bool(false).int32(2147483646), normalized().int32(-2147483648)),
            new Extreme(base().bool(false).int64(9223372036854775806L), normalized().int64(Long.MIN_VALUE)),
            new Extreme(base().bool(false).usize(uint64Max), normalized().usize(n(0))),
            new Extreme(base().bool(false).isize(9223372036854775806L), normalized().isize(Long.MIN_VALUE)),
            new Extreme(base().bool(false).nat(HUGE), normalized().nat(HUGE.add(n(2)))), new Extreme(base().bool(false).integer(HUGE.negate()), normalized().integer(HUGE.negate().add(n(2)))),
            new Extreme(base().bool(false).float32(0.0f), normalized().float32(-0.0f)), new Extreme(base().bool(false).float64(0.0), normalized().float64(-0.0)),
            new Extreme(base().bool(false).float32(-0.0f), normalized().float32(0.0f)), new Extreme(base().bool(false).float64(-0.0), normalized().float64(0.0)),
            new Extreme(base().bool(false).text("a\0λ😀"), normalized().text("a\0λ😀!")),
            new Extreme(base().bool(false).bytes(bytes()), normalized().bytes(bytes(255))),
            new Extreme(base().bool(false).character(0x1f600), normalized().character(0x1f600))
        };
        for (Extreme item : extremes) call(item.packet().packet(), Api::echoB, item.expected().packet());
        float[] floats = { Float.NaN, Float.POSITIVE_INFINITY, Float.NEGATIVE_INFINITY };
        double[] doubles = { Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY };
        for (int index = 0; index < 3; index++) {
            refused(base().bool(false).float32(floats[index]).packet(), Api::echoB, subtype("value0.float32Value", "float32B"));
            call(base().float32(floats[index]).raw(), Api::produce, Option.none());
            refused(base().bool(false).float64(doubles[index]).packet(), Api::echoB, subtype("value0.float64Value", "float64B"));
            call(base().float64(doubles[index]).raw(), Api::produce, Option.none());
        }
        // The late Fin error must win over the earlier refusing constructor.
        refused(new Pair<>(base().nat(n(43)).packet(), base().bool(false).digit(n(3)).packet()), v -> Api.combine(v.first(), v.second()), fin("value1.digit"));
        for (int round = 0; round < ROUNDS; round++) {
            int position = round % 3;
            Option<Packet>[] items = values(Option.some(b), Option.none(), Option.some(b));
            items[position] = Option.some(base().bool(false).nat(n(43)).packet());
            refused(new PacketPair(values(Option.some(a)), items), Api::echoPair, subtype("value0.right[" + position + "]?.natValue", "natB"));
            call(b, Api::echoB, n);
        }
    }
}
