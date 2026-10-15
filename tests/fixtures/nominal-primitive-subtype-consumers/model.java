// Synthetic nineteen-base caller controls, not Lean compilation or installed acceptance.
package FIXTURE_NAMESPACE;

import java.math.BigInteger;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import org.leanbridge.nominalprimitivesubtypes.Unit;

public final class Api {
    private Api() { }
    static final BigInteger TWO = BigInteger.TWO, WORD = BigInteger.ONE.shiftLeft(64);
    static boolean mutant(String name) { return name.equals(System.getenv("NOMINAL_JVM_MUTANT")); }
    @SafeVarargs static <T> T[] values(T... items) { return items; }
    static IllegalArgumentException host(String message) { return new IllegalArgumentException(message); }
    // The generated host conversions refuse what the JVM types can express but Lean cannot receive.
    static void hostChecks(Unit unitValue, int uint8Value, int uint16Value, long uint32Value, BigInteger uint64Value, BigInteger natValue, BigInteger intValue,
        String textValue, byte[] bytesValue, int charValue, BigInteger usizeValue, BigInteger digit) {
        Objects.requireNonNull(unitValue); Objects.requireNonNull(textValue); Objects.requireNonNull(bytesValue); Objects.requireNonNull(intValue);
        if ((uint8Value < 0 || uint8Value > 255) && !mutant("uint8-range")) throw host("uint8 is out of range");
        if (uint16Value < 0 || uint16Value > 65535) throw host("uint16 is out of range");
        if (uint32Value < 0 || uint32Value > 0xffff_ffffL) throw host("uint32 is out of range");
        if (Objects.requireNonNull(uint64Value).signum() < 0 || uint64Value.bitLength() > 64) throw host("uint64 is out of range");
        if (Objects.requireNonNull(natValue).signum() < 0 && !mutant("negative-nat")) throw host("Nat cannot be negative");
        if ((charValue < 0 || charValue > 0x10ffff || (charValue >= 0xd800 && charValue <= 0xdfff)) && !mutant("surrogate-char")) throw host("Char requires a Unicode scalar code point");
        try { StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT).encode(java.nio.CharBuffer.wrap(textValue)); }
        catch (CharacterCodingException error) { if (!mutant("lone-surrogate")) throw host("Invalid UTF-16"); }
        if ((Objects.requireNonNull(usizeValue).signum() < 0 || usizeValue.bitLength() > 64) && !mutant("usize-range")) throw host("uint64 is out of range");
        if (Objects.requireNonNull(digit).signum() < 0) throw host("Nat cannot be negative");
    }
    static void hostChecks(RawPacket value) {
        Objects.requireNonNull(value);
        hostChecks(value.unitValue(), value.uint8Value(), value.uint16Value(), value.uint32Value(), value.uint64Value(), value.natValue(), value.intValue(),
            value.textValue(), value.bytesValue(), value.charValue(), value.usizeValue(), value.digit());
    }
    static boolean even(long value) { return value % 2 == 0; }
    static boolean even(BigInteger value) { return value.mod(TWO).signum() == 0; }
    static boolean finite(double value) { return !Double.isNaN(value) && !Double.isInfinite(value); }
    // The weaker producer predicates: parity, finiteness, presence, the nonzero character and the Fin digit.
    static boolean valid(RawPacket value) {
        return value.boolValue() && even(value.uint8Value()) && even(value.uint16Value()) && even(value.uint32Value()) && even(value.uint64Value())
            && even(value.int8Value()) && even(value.int16Value()) && even(value.int32Value()) && even(value.int64Value())
            && (even(value.natValue()) || mutant("produce-lenient")) && even(value.intValue())
            && finite(value.float32Value()) && finite(value.float64Value()) && !value.textValue().isEmpty() && value.bytesValue().length > 0
            && value.charValue() != 0 && even(value.usizeValue()) && even(value.isizeValue())
            && (value.digit().compareTo(BigInteger.valueOf(3)) < 0 || mutant("produce-digit"));
    }
    static Packet packet(RawPacket value) {
        return new Packet(value.unitValue(), value.boolValue(), value.uint8Value(), value.uint16Value(), value.uint32Value(), value.uint64Value(), value.int8Value(),
            value.int16Value(), value.int32Value(), value.int64Value(), value.natValue(), value.intValue(), value.float32Value(), value.float64Value(),
            value.textValue(), value.bytesValue().clone(), value.charValue(), value.usizeValue(), value.isizeValue(), value.digit());
    }
    public static Option<Packet> produce(RawPacket value) {
        hostChecks(value);
        return valid(value) ? Option.some(packet(value)) : Option.none();
    }
    public static Option<Packet>[] produceGroup(RawPacket value) {
        Option<Packet> produced = produce(value);
        if (!produced.isSome()) return values(Option.none());
        return mutant("missing-group") ? values(produced) : values(Option.none(), produced);
    }
    public static PacketPair producePair(RawPacket value) {
        return new PacketPair(mutant("pair-left-empty") ? values() : produceGroup(value), produceGroup(value));
    }
    public static Event produceEvent(RawPacket value) {
        Option<Packet> produced = produce(value);
        return produced.isSome() && !mutant("missing-event-value") ? new EventBox(produced.value()) : new EventEmpty();
    }
    public static Event produceChoices(RawPacket value) {
        Option<Packet> produced = produce(value);
        if (!produced.isSome()) return new EventChoices(values(Option.none()));
        Result<Packet, Packet> second = mutant("wrong-choice-tag") ? Result.ok(produced.value()) : Result.err(produced.value());
        return new EventChoices(values(Option.none(), Option.some(Result.ok(produced.value())), Option.some(second)));
    }
    public static long wordBits() { return mutant("word-bits") ? 32 : 64; }
    // BEGIN FULL_ONLY
    static String path(int index) { return ("reviewed".equals(System.getenv("NOMINAL_JVM_ROUTE")) ? "value" : "arg") + index; }
    static IllegalArgumentException error(String message) { return new IllegalArgumentException(mutant("wrong-error-path") ? "wrong path" : message); }
    static IllegalArgumentException rejected(String path, String constructor) { return error(path + " was rejected by NominalPrimitiveSubtypes." + constructor); }
    static void hostChecks(Packet value) {
        Objects.requireNonNull(value);
        hostChecks(value.unitValue(), value.uint8Value(), value.uint16Value(), value.uint32Value(), value.uint64Value(), value.natValue(), value.intValue(),
            value.textValue(), value.bytesValue(), value.charValue(), value.usizeValue(), value.digit());
    }
    // All Fin bounds of every argument precede any constructor, so a late Fin error wins.
    static void fin(Packet value, String path) {
        hostChecks(value);
        if (value.digit().compareTo(BigInteger.valueOf(3)) >= 0 && !mutant("late-fin")) throw error(path + ".digit is not below its Fin 3 bound");
    }
    static void fin(Option<Packet>[] values, String path) {
        Objects.requireNonNull(values);
        for (int index = 0; index < values.length; index++)
            if (Objects.requireNonNull(values[index]).isSome()) fin(values[index].value(), path + "[" + index + "]?");
    }
    static int length(String value) { return value.codePointCount(0, value.length()); }
    // The A selections keep the input policy stricter than each predicate and return the value unchanged.
    static Packet selectA(Packet value, String path) {
        if (!value.boolValue()) throw rejected(path + ".boolValue", "boolA");
        if (value.uint8Value() >= 100 || !even(value.uint8Value())) throw rejected(path + ".uint8Value", "uint8A");
        if (value.uint16Value() >= 100 || !even(value.uint16Value())) throw rejected(path + ".uint16Value", "uint16A");
        if (value.uint32Value() >= 100 || !even(value.uint32Value())) throw rejected(path + ".uint32Value", "uint32A");
        if (value.uint64Value().compareTo(BigInteger.valueOf(100)) >= 0 || !even(value.uint64Value())) throw rejected(path + ".uint64Value", "uint64A");
        if (value.int8Value() >= 100 || !even(value.int8Value())) throw rejected(path + ".int8Value", "int8A");
        if (value.int16Value() >= 100 || !even(value.int16Value())) throw rejected(path + ".int16Value", "int16A");
        if (value.int32Value() >= 100 || !even(value.int32Value())) throw rejected(path + ".int32Value", "int32A");
        if (value.int64Value() >= 100 || !even(value.int64Value())) throw rejected(path + ".int64Value", "int64A");
        if (value.natValue().compareTo(BigInteger.valueOf(100)) >= 0 || !even(value.natValue())) throw rejected(path + ".natValue", "natA");
        if (value.intValue().compareTo(BigInteger.valueOf(100)) >= 0 || !even(value.intValue())) throw rejected(path + ".intValue", "intA");
        if (!(value.float32Value() < 10) || !finite(value.float32Value())) throw rejected(path + ".float32Value", "float32A");
        if (!(value.float64Value() < 10) || !finite(value.float64Value())) throw rejected(path + ".float64Value", "float64A");
        if (length(value.textValue()) >= 8 || value.textValue().isEmpty()) throw rejected(path + ".textValue", "textA");
        if (value.bytesValue().length >= 8 || value.bytesValue().length == 0) throw rejected(path + ".bytesValue", "bytesA");
        if (value.charValue() >= 128 || value.charValue() == 0) throw rejected(path + ".charValue", "charA");
        if (value.usizeValue().compareTo(BigInteger.valueOf(100)) >= 0 || !even(value.usizeValue())) throw rejected(path + ".usizeValue", "usizeA");
        if (value.isizeValue() >= 100 || !even(value.isizeValue())) throw rejected(path + ".isizeValue", "isizeA");
        return mutant("echo-a") ? selectB(withBool(value, false), path) : value;
    }
    static Packet withBool(Packet value, boolean flag) {
        return new Packet(value.unitValue(), flag, value.uint8Value(), value.uint16Value(), value.uint32Value(), value.uint64Value(), value.int8Value(),
            value.int16Value(), value.int32Value(), value.int64Value(), value.natValue(), value.intValue(), value.float32Value(), value.float64Value(),
            value.textValue(), value.bytesValue(), value.charValue(), value.usizeValue(), value.isizeValue(), value.digit());
    }
    // The B selections normalize each base and keep only the predicate; words wrap, big integers grow, floats negate.
    static Packet selectB(Packet value, String path) {
        if (value.boolValue()) throw rejected(path + ".boolValue", "boolB");
        int uint8 = (value.uint8Value() + 2) & 0xff, uint16 = (value.uint16Value() + 2) & 0xffff;
        long uint32 = (value.uint32Value() + 2) & 0xffff_ffffL;
        BigInteger uint64 = value.uint64Value().add(TWO).mod(WORD), usize = value.usizeValue().add(TWO).mod(WORD);
        byte int8 = (byte) (value.int8Value() + 2); short int16 = (short) (value.int16Value() + 2);
        int int32 = value.int32Value() + 2; long int64 = value.int64Value() + 2, isize = value.isizeValue() + 2;
        BigInteger nat = value.natValue().add(TWO), integer = value.intValue().add(TWO);
        float float32 = mutant("float-sign") ? value.float32Value() : -value.float32Value();
        double float64 = mutant("float-sign") ? value.float64Value() : -value.float64Value();
        if (!even(uint8)) throw rejected(path + ".uint8Value", "uint8B");
        if (!even(uint16)) throw rejected(path + ".uint16Value", "uint16B");
        if (!even(uint32)) throw rejected(path + ".uint32Value", "uint32B");
        if (!even(uint64)) throw rejected(path + ".uint64Value", "uint64B");
        if (!even(int8)) throw rejected(path + ".int8Value", "int8B");
        if (!even(int16)) throw rejected(path + ".int16Value", "int16B");
        if (!even(int32)) throw rejected(path + ".int32Value", "int32B");
        if (!even(int64)) throw rejected(path + ".int64Value", "int64B");
        if (!even(nat)) throw rejected(path + ".natValue", "natB");
        if (!even(integer)) throw rejected(path + ".intValue", "intB");
        if (!finite(float32)) throw rejected(path + ".float32Value", "float32B");
        if (!finite(float64)) throw rejected(path + ".float64Value", "float64B");
        byte[] bytes = java.util.Arrays.copyOf(value.bytesValue(), value.bytesValue().length + 1); bytes[bytes.length - 1] = (byte) 255;
        int character = value.charValue() == 'a' ? 'b' : value.charValue();
        if (character == 0) throw rejected(path + ".charValue", "charB");
        if (!even(usize)) throw rejected(path + ".usizeValue", "usizeB");
        if (!even(isize)) throw rejected(path + ".isizeValue", "isizeB");
        if (mutant("echo-b")) return value;
        return new Packet(value.unitValue(), true, uint8, uint16, uint32, uint64, int8, int16, int32, int64, nat, integer, float32, float64,
            value.textValue() + "!", bytes, character, usize, isize, value.digit());
    }
    static Option<Packet>[] select(Option<Packet>[] values, String path, boolean first) {
        Option<Packet>[] result = values.clone();
        for (int index = 0; index < values.length; index++) {
            if (!values[index].isSome()) continue;
            String item = path + "[" + index + "]?";
            result[index] = Option.some(first ? selectA(values[index].value(), item) : selectB(values[index].value(), item));
        }
        return result;
    }
    public static Packet echoA(Packet value) { fin(value, path(0)); return selectA(value, path(0)); }
    public static Packet echoB(Packet value) { fin(value, path(0)); return selectB(value, path(0)); }
    public static Packet refuseUnit(Packet value) {
        fin(value, path(0));
        if (mutant("refuse-unit")) return value;
        throw rejected(path(0) + ".unitValue", "unitReject");
    }
    public static Pair<Packet, Packet> combine(Packet left, Packet right) {
        if (mutant("fin-after-subtype")) { hostChecks(left); selectA(left, path(0)); }
        fin(left, path(0)); fin(right, path(1));
        Packet first = selectA(left, path(0)), second = selectB(right, path(1));
        return new Pair<>(first, mutant("combine") ? right : second);
    }
    public static PacketPair echoPair(PacketPair value) {
        Objects.requireNonNull(value);
        String left = path(0) + ".left", right = path(0) + ".right";
        fin(value.left(), left); fin(value.right(), right);
        try {
            PacketPair result = new PacketPair(select(value.left(), left, true), select(value.right(), right, false));
            if (mutant("mutate-accepted-input") && value.right().length > 0) value.right()[0] = Option.none();
            return result;
        } catch (IllegalArgumentException error) {
            if (mutant("mutate-rejected-input") && value.right().length > 0) value.right()[0] = Option.none();
            throw error;
        }
    }
    static Event event(Event value, boolean firstA) {
        Objects.requireNonNull(value);
        if (value instanceof EventEmpty) return new EventEmpty();
        if (value instanceof EventBox box) {
            String path = path(0) + ".box.value"; fin(box.value(), path);
            return new EventBox(firstA ? selectA(box.value(), path) : selectB(box.value(), path));
        }
        EventChoices choices = (EventChoices) value;
        Option<Result<Packet, Packet>>[] output = choices.values().clone();
        for (int index = 0; index < output.length; index++) {
            Option<Result<Packet, Packet>> item = Objects.requireNonNull(output[index]);
            if (!item.isSome()) continue;
            Result<Packet, Packet> branch = item.value();
            fin(branch.isOk() ? branch.value() : branch.error(), path(0) + ".choices.values[" + index + "]?." + (branch.isOk() ? "ok" : "error"));
        }
        for (int index = 0; index < output.length; index++) {
            Option<Result<Packet, Packet>> item = output[index];
            if (!item.isSome()) { output[index] = Option.none(); continue; }
            Result<Packet, Packet> branch = item.value();
            String path = path(0) + ".choices.values[" + index + "]?." + (branch.isOk() ? "ok" : "error");
            boolean useA = branch.isOk() == firstA;
            Packet selected = useA ? selectA(branch.isOk() ? branch.value() : branch.error(), path) : selectB(branch.isOk() ? branch.value() : branch.error(), path);
            output[index] = Option.some(branch.isOk() ? Result.ok(selected) : Result.err(selected));
        }
        return new EventChoices(output);
    }
    public static Event echoEventA(Event value) { return event(value, true); }
    public static Event echoEventB(Event value) { return event(value, false); }
    public static Option<Packet>[] aliases(Option<Packet>[] left, Option<Packet>[] right) {
        fin(left, path(0)); fin(right, path(1));
        Option<Packet>[] first = select(left, path(0), true), second = select(right, path(1), false);
        Option<Packet>[] result = java.util.Arrays.copyOf(first, first.length + second.length);
        System.arraycopy(second, 0, result, first.length, second.length);
        return result;
    }
    // END FULL_ONLY
}
