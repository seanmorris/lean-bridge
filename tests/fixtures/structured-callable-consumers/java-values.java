// Independent structured values for the public Java API, not generated layouts.
import java.math.BigInteger;
import org.leanbridge.structured.*;
import org.leanbridge.structured.Unit;

final class StructuredValues {
    private StructuredValues() { }
    static final String[] SHAPES = { "array", "list", "option", "result", "tuple", "record", "variant", "alias" };
    static String text(int seed) {
        return new String[] { "", "a\0λ🌿", "\udbff\udfff", "e\u0301" }[seed % 4] + seed;
    }
    static BigInteger huge(int seed) {
        return BigInteger.ONE.shiftLeft(256 + seed).add(BigInteger.ONE.shiftLeft(64)).add(BigInteger.valueOf(seed));
    }
    @SuppressWarnings("unchecked")
    static Option<String>[] array(int seed) {
        return (Option<String>[]) (seed % 5 == 0 ? new Option<?>[0] : new Option<?>[] {
            Option.none(), Option.some(text(seed)), Option.some(""), Option.some("\0")
        });
    }
    @SuppressWarnings("unchecked")
    static Result<Pair<Long, String>, String>[] list(int seed) {
        return (Result<Pair<Long, String>, String>[]) (seed % 5 == 0 ? new Result<?, ?>[0] : new Result<?, ?>[] {
            Result.ok(new Pair<>(4294967295L, text(seed))), Result.err(text(seed)),
            Result.ok(new Pair<>((long) seed, "")), Result.err("")
        });
    }
    static Option<Option<Unit>> option(int seed) {
        return switch (seed % 3) {
            case 0 -> Option.none();
            case 1 -> Option.some(Option.none());
            default -> Option.some(Option.some(Unit.INSTANCE));
        };
    }
    static Result<Option<Long>, String[]> result(int seed) {
        return switch (seed % 4) {
            case 0 -> Result.ok(Option.none());
            case 1 -> Result.ok(Option.some((long) seed));
            case 2 -> Result.err(new String[] { text(seed), "", "\0" });
            default -> Result.err(new String[0]);
        };
    }
    static Pair<String, Pair<byte[], BigInteger>> tuple(int seed) {
        byte[] bytes = new byte[seed % 2 == 0 ? 0 : 259];
        if (bytes.length != 0) {
            bytes[0] = 0; bytes[1] = -1; bytes[2] = -128;
            for (int value = 0; value < 256; ++value) bytes[value + 3] = (byte) value;
        }
        return new Pair<>(text(seed), new Pair<>(bytes, huge(seed)));
    }
    static Payload record(int seed) {
        Option<Result<Pair<BigInteger, Unit>, String>> nested = switch (seed % 3) {
            case 0 -> Option.none();
            case 1 -> Option.some(Result.ok(new Pair<>(BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), Unit.INSTANCE)));
            default -> Option.some(Result.err(text(seed)));
        };
        return new Payload(text(seed), array(seed), huge(seed), nested);
    }
    static Packet variant(int seed) {
        return switch (seed % 3) {
            case 0 -> new PacketEmpty();
            case 1 -> new PacketPayload(text(seed), array(seed));
            default -> new PacketCounts(huge(seed), huge(seed).negate());
        };
    }
}
