// Independent Java caller for proof-free nested checked records.
import java.math.BigInteger;
import java.util.Arrays;
import java.util.function.Function;
import java.util.function.Predicate;
import org.leanbridge.nestedcheckedrecords.*;

final class Consumer {
    private static int checks;
    private static int rejections;
    private static int hostRejections;
    private static int recoveries;
    private static int snapshots;
    private static final int ROUNDS = 256;
    private static final String PREFIX = "value";

    private static BigInteger n(long value) { return BigInteger.valueOf(value); }
    private static BigInteger huge() { return BigInteger.ONE.shiftLeft(100); }
    private static Packet packet(long digit, long word) { return new Packet(n(digit), n(word)); }
    private static String snap(Packet value) { return value == null ? "null" : value.digit() + ":" + value.word(); }
    private static String snap(Packet[] values) {
        if (values == null) return "null";
        return String.join("|", Arrays.stream(values).map(Consumer::snap).toList());
    }
    private static String snap(Option<Packet> value) {
        return value.isSome() ? "some:" + snap(value.value()) : "none";
    }
    private static String snap(Result<Packet, Packet> value) {
        return value.isOk() ? "ok:" + snap(value.value()) : "error:" + snap(value.error());
    }
    private static String snap(Pair<Packet, Packet> value) {
        return "(" + snap(value.first()) + "," + snap(value.second()) + ")";
    }

    private static void check(boolean condition, String label) {
        if (!condition) throw new IllegalStateException("failed: " + label);
        checks++;
    }

    private static void same(String before, String after, String label) {
        check(before.equals(after), label);
        snapshots++;
    }

    private static <I, O> O accepted(I input, Function<I, O> invoke,
        Function<I, String> snapshot, Predicate<O> expected, String label) {
        String before = snapshot.apply(input);
        O output = invoke.apply(input);
        check(expected.test(output), label);
        same(before, snapshot.apply(input), label + " input snapshot");
        return output;
    }

    private static void refusedHost(Runnable invoke, Class<? extends Throwable> expected,
        java.util.function.Supplier<String> snapshot) {
        String before = snapshot.get();
        try {
            invoke.run();
            throw new IllegalStateException("accepted invalid managed value");
        } catch (Throwable error) {
            check(error.getClass() == expected, "managed rejection type: " + error);
        }
        same(before, snapshot.get(), "managed-refused input snapshot");
        hostRejections++;
    }

    private static void inactive(Runnable read, String expected) {
        try {
            read.run();
            throw new IllegalStateException("read inactive union payload");
        } catch (IllegalStateException error) {
            check(error.getMessage().equals(expected), "exact inactive payload diagnostic");
        }
        hostRejections++;
    }

    public static void main(String[] arguments) {
        if (arguments.length != 0) throw new IllegalStateException("Unexpected caller arguments");
        run();
        System.out.println("{\"checks\":" + checks + ",\"rejections\":" + rejections
            + ",\"hostRejections\":" + hostRejections + ",\"recoveries\":" + recoveries
            + ",\"snapshots\":" + snapshots + ",\"rounds\":" + ROUNDS
            + ",\"wordBits\":64}");
    }

    private static void run() {
        check(Long.SIZE == 64, "native machine-word width");
        BigInteger huge = huge();
        for (int round = 0; round < ROUNDS; round++) {
            BigInteger input = huge.add(n(round));
            Option<Packet> option = Api.produceOption(input);
            check(option.isSome() && option.value().equals(new Packet(BigInteger.ZERO, input.add(BigInteger.ONE))),
                "projected optional packet");
            Packet[] values = Api.produceArray(input);
            check(values.length == 2, "projected packet array length");
            check(values[0].equals(new Packet(BigInteger.ZERO, input.add(BigInteger.ONE))), "first projected packet");
            check(values[1].equals(new Packet(BigInteger.ZERO, input.add(n(2)))), "second projected packet");
            check(values[0] != values[1], "independent projected records");
        }

        Option<Packet> none = Option.none();
        check(!none.isSome(), "absent option branch");
        inactive(none::value, "None has no value");
        Result<Packet, Packet> ok = Result.ok(packet(1, 2));
        Result<Packet, Packet> error = Result.err(packet(2, 3));
        check(ok.isOk(), "success result branch");
        check(!error.isOk(), "error result branch");
        inactive(ok::error, "Ok has no error");
        inactive(error::value, "Err has no success value");
        BigInteger negative = BigInteger.ONE.negate();
        refusedHost(() -> Api.produceOption(negative), IllegalArgumentException.class, negative::toString);
        check(Api.produceOption(BigInteger.ZERO).value().equals(packet(0, 1)),
            "result projection recovers after host rejection");
        recoveries++;

    }
}
