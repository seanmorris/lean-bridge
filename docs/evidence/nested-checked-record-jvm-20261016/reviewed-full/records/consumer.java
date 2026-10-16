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
    private static String snap(Holder value) { return snap(value.packet()) + ":" + value.tag(); }
    private static String snap(Choice value) {
        return switch (value) {
            case ChoiceEmpty ignored -> "empty";
            case ChoicePacket branch -> "packet:" + snap(branch.value());
        };
    }

    private static void refused(Runnable invoke, String expected, java.util.function.Supplier<String> snapshot) {
        String before = snapshot.get();
        try {
            invoke.run();
            throw new IllegalStateException("accepted invalid checked record");
        } catch (IllegalArgumentException error) {
            check(error.getClass() == IllegalArgumentException.class && error.getMessage().equals(expected),
                "exact checked-record rejection: " + error);
        }
        same(before, snapshot.get(), "refused input snapshot");
        rejections++;
    }

    private static void recover(boolean condition) {
        check(condition, "valid call recovers after rejection");
        recoveries++;
    }

    private static String constructor(String path, String name) {
        return path + " was rejected by NestedCheckedRecords." + name;
    }
    private static String fin(String path) { return path + " is not below its Fin 10 bound"; }

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

        Packet first = packet(2, 3), second = packet(7, 0);
        accepted(first, Api::first, Consumer::snap, value -> value.equals(n(3)), "direct packet");
        accepted(second, Api::second, Consumer::snap, value -> value.equals(n(8)), "normalized direct packet");
        accepted(new Pair<>(first, second), value -> Api.pair(value.first(), value.second()), Consumer::snap,
            value -> value.equals(n(11)), "repeated packet parameters");
        Packet[] rows = { packet(1, 2), packet(3, 5) };
        accepted(rows, Api::inArray, Consumer::snap, value -> value.equals(n(7)), "array packets");
        rows = new Packet[] { packet(1, 0), packet(3, 100) };
        accepted(rows, Api::inList, Consumer::snap, value -> value.equals(n(6)), "List packets");
        accepted(Option.<Packet>none(), Api::inOption, Consumer::snap,
            BigInteger.ZERO::equals, "absent packet option");
        accepted(Option.some(packet(1, 2)), Api::inOption, Consumer::snap,
            value -> value.equals(n(3)), "present packet option");
        accepted(new Pair<>(packet(1, 2), packet(3, 0)), Api::inProduct, Consumer::snap,
            value -> value.equals(n(6)), "packet product");
        accepted(Result.<Packet, Packet>ok(packet(2, 9)), Api::inExcept, Consumer::snap,
            value -> value.equals(n(3)), "success packet branch");
        accepted(Result.<Packet, Packet>err(packet(1, 2)), Api::inExcept, Consumer::snap,
            value -> value.equals(n(3)), "error packet branch");
        accepted(new Holder(packet(3, 1), n(9)), Api::inHolder, Consumer::snap,
            value -> value.equals(n(13)), "enclosing record field");
        accepted((Choice)new ChoiceEmpty(), Api::inChoice, Consumer::snap,
            BigInteger.ZERO::equals, "empty variant case");
        accepted((Choice)new ChoicePacket(packet(2, 4)), Api::inChoice, Consumer::snap,
            value -> value.equals(n(5)), "active variant field");
        rows = new Packet[] { packet(2, 3), new Packet(BigInteger.ONE, huge) };
        Packet[] capturedRows = rows;
        Packet[] echoed = accepted(rows, Api::echoArray, Consumer::snap,
            value -> value.length == 2 && value[0].equals(capturedRows[0]) && value[1].equals(capturedRows[1]),
            "proof-free packet result");
        check(echoed != rows && echoed[0] != rows[0], "result owns independent managed storage");

        Packet invalid = packet(0, 0);
        Packet rejectWord = invalid;
        refused(() -> Api.first(rejectWord), constructor(PREFIX + "0.word", "mkWord"), () -> snap(rejectWord));
        recover(Api.first(first).equals(n(3)));
        invalid = packet(4, 2);
        Packet rejectRecord = invalid;
        refused(() -> Api.first(rejectRecord), constructor(PREFIX + "0", "mkPacket"), () -> snap(rejectRecord));
        recover(Api.first(first).equals(n(3)));
        invalid = packet(10, 12);
        Packet rejectFin = invalid;
        refused(() -> Api.first(rejectFin), fin(PREFIX + "0.digit"), () -> snap(rejectFin));
        recover(Api.first(first).equals(n(3)));

        rows = new Packet[] { packet(2, 3), packet(1, 0) };
        Packet[] rejectWordRows = rows;
        refused(() -> Api.inArray(rejectWordRows), constructor(PREFIX + "0[1].word", "mkWord"), () -> snap(rejectWordRows));
        rows[1] = packet(2, 3); recover(Api.inArray(rows).equals(n(6)));
        rows[1] = packet(5, 2); Packet[] rejectPacketRows = rows;
        refused(() -> Api.inArray(rejectPacketRows), constructor(PREFIX + "0[1]", "mkPacket"), () -> snap(rejectPacketRows));
        rows[1] = packet(2, 3); recover(Api.inArray(rows).equals(n(6)));
        rows[1] = packet(10, 12); Packet[] rejectFinRows = rows;
        refused(() -> Api.inArray(rejectFinRows), fin(PREFIX + "0[1].digit"), () -> snap(rejectFinRows));
        rows[1] = packet(2, 3); recover(Api.inArray(rows).equals(n(6)));

        Option<Packet> maybe = Option.some(packet(5, 2));
        refused(() -> Api.inOption(maybe), constructor(PREFIX + "0?", "mkPacket"), () -> snap(maybe));
        recover(Api.inOption(Option.some(packet(1, 2))).equals(n(3)));
        Pair<Packet, Packet> product = new Pair<>(packet(1, 2), packet(10, 0));
        refused(() -> Api.inProduct(product), fin(PREFIX + "0.1.digit"), () -> snap(product));
        recover(Api.inProduct(new Pair<>(packet(1, 2), packet(3, 0))).equals(n(6)));
        Result<Packet, Packet> successBranch = Result.ok(packet(10, 0));
        refused(() -> Api.inExcept(successBranch), fin(PREFIX + "0.ok.digit"), () -> snap(successBranch));
        recover(Api.inExcept(Result.ok(packet(2, 9))).equals(n(3)));
        Result<Packet, Packet> errorBranch = Result.err(packet(3, 1));
        refused(() -> Api.inExcept(errorBranch), constructor(PREFIX + "0.error", "mkPacket"), () -> snap(errorBranch));
        recover(Api.inExcept(Result.err(packet(1, 2))).equals(n(3)));
        Holder holder = new Holder(packet(10, 0), n(9));
        refused(() -> Api.inHolder(holder), fin(PREFIX + "0.packet.digit"), () -> snap(holder));
        recover(Api.inHolder(new Holder(packet(3, 1), n(9))).equals(n(13)));
        Choice choice = new ChoicePacket(packet(3, 1));
        refused(() -> Api.inChoice(choice), constructor(PREFIX + "0.packet.value", "mkPacket"), () -> snap(choice));
        recover(Api.inChoice(new ChoicePacket(packet(2, 4))).equals(n(5)));

        refusedHost(() -> Api.first(null), NullPointerException.class, () -> "null");
        recover(Api.first(first).equals(n(3)));
        Packet[] nullRows = { null };
        refusedHost(() -> Api.inArray(nullRows), NullPointerException.class, () -> snap(nullRows));
        recover(Api.inArray(new Packet[] { first }).equals(n(3)));
        Packet negativePacket = new Packet(BigInteger.ONE.negate(), BigInteger.ONE);
        refusedHost(() -> Api.first(negativePacket), IllegalArgumentException.class, () -> snap(negativePacket));
        recover(Api.first(first).equals(n(3)));

        for (int round = 0; round < ROUNDS; round++) {
            BigInteger input = n(round + 10L);
            Packet valid = new Packet(n(round % 10), input);
            accepted(valid, Api::first, Consumer::snap, input::equals, "round direct packet");
            Packet roundInvalid = packet(2, 1);
            refused(() -> Api.first(roundInvalid), constructor(PREFIX + "0", "mkPacket"), () -> snap(roundInvalid));
            recover(Api.first(valid).equals(input));
            Packet normalized = packet(round % 10, 0);
            long normalizedExpected = round % 10 + 1L;
            accepted(normalized, Api::second, Consumer::snap,
                value -> value.equals(n(normalizedExpected)), "round normalized packet");
            Packet[] roundRows = { valid, packet(1, 0) };
            refused(() -> Api.inArray(roundRows), constructor(PREFIX + "0[1].word", "mkWord"), () -> snap(roundRows));
            roundRows[1] = packet(2, 3);
            recover(Api.inArray(roundRows).equals(n(round + 13L)));
        }
    }
}
