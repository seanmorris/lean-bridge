// Independent installed Java caller for mutually recursive checked records.
import java.lang.reflect.Modifier;
import java.math.BigInteger;
import java.util.Arrays;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.leanbridge.mutualcheckedrecords.*;

final class Consumer {
    private static int checks, rejections, hostRejections, calls, snapshots, recoveries;
    private static final int ROUNDS = 64;
    private record Failure(String name, String message) { }
    private static final Map<String, Failure> failures = new LinkedHashMap<>();

    private static BigInteger n(long value) { return BigInteger.valueOf(value); }
    private static Option<Step> none() { return Option.none(); }
    private static Option<Step> some(Step value) { return Option.some(value); }
    private static Envelope envelope(long value, long mode) {
        return new Envelope(n(value), n(mode), none());
    }
    private static Envelope envelope(long value, long mode, Option<Step> next) {
        return new Envelope(n(value), n(mode), next);
    }
    private static Envelope nested(long outer, long mode, long inner, long innerMode) {
        return envelope(outer, mode, some(new StepMore(envelope(inner, innerMode))));
    }
    @SuppressWarnings("unchecked")
    private static Option<Envelope>[] groups(Option<Envelope>... values) { return values; }

    private static void check(boolean condition, String label) {
        if (!condition) throw new IllegalStateException("failed: " + label);
        checks++;
    }

    private static void record(Envelope value, StringBuilder text,
        IdentityHashMap<Object, Boolean> active) {
        if (value == null) { text.append("null"); return; }
        if (active.put(value, Boolean.TRUE) != null) { text.append("#cycle"); return; }
        text.append("E(").append(value.value()).append(',').append(value.mode()).append(',');
        if (!value.next().isSome()) text.append("none");
        else step(value.next().value(), text, active);
        text.append(')'); active.remove(value);
    }
    private static void step(Step value, StringBuilder text,
        IdentityHashMap<Object, Boolean> active) {
        if (value == null) { text.append("null-step"); return; }
        if (active.put(value, Boolean.TRUE) != null) { text.append("#cycle-step"); return; }
        if (value instanceof StepStop) text.append("stop");
        else if (value instanceof StepMore more) {
            text.append("more("); record(more.packet(), text, active); text.append(')');
        } else text.append("unknown-step");
        active.remove(value);
    }
    private static String snap(Envelope value) {
        var text = new StringBuilder();
        record(value, text, new IdentityHashMap<>()); return text.toString();
    }
    private static String snap(Option<Envelope>[] values) {
        if (values == null) return "null-array";
        return "[" + String.join(";", Arrays.stream(values).map(value ->
            value == null ? "null-option" : value.isSome()
                ? "some(" + snap(value.value()) + ")" : "none").toList()) + "]";
    }

    private static <I, O> O accepted(I input, Function<I, O> invoke,
        Function<I, String> snapshot, Predicate<O> expected, String label) {
        String before = snapshot.apply(input); calls++;
        O output = invoke.apply(input);
        check(expected.test(output), label);
        check(snapshot.apply(input).equals(before), label + " preserved every input");
        snapshots++; return output;
    }

    private static Throwable refused(Runnable invoke, Supplier<String> snapshot,
        Predicate<Throwable> expected, String label, boolean host) {
        String before = snapshot.get(); Throwable failure = null; calls++;
        try { invoke.run(); } catch (Throwable error) { failure = error; }
        check(failure != null && expected.test(failure), label + ": " + failure);
        check(snapshot.get().equals(before), label + " preserved every input");
        snapshots++;
        if (host) hostRejections++; else rejections++;
        failures.putIfAbsent(label, new Failure(
            failure.getClass().getSimpleName(), failure.getMessage()));
        return failure;
    }

    private static boolean exact(Throwable error, String message) {
        return error.getClass() == IllegalArgumentException.class
            && message.equals(error.getMessage());
    }

    private static void recover() {
        Envelope valid = nested(40, 2, 80, 1);
        accepted(valid, Api::first, Consumer::snap, result -> result.equals(n(41)),
            "recovery after refusal");
        recoveries++;
    }

    private static void rejectAndRecover(Runnable invoke, Supplier<String> snapshot,
        Predicate<Throwable> expected, String label, boolean host) {
        refused(invoke, snapshot, expected, label, host); recover();
    }

    private static Envelope deep(int levels) {
        Envelope value = envelope(40, 2);
        while (levels-- > 0) value = envelope(40, 2, some(new StepMore(value)));
        return value;
    }

    private static final class CarrierMutation extends RuntimeException {
        private static final long serialVersionUID = 1L;
        CarrierMutation(Throwable cause) {
            super("Java record fields refuse cycle construction", cause);
        }
    }

    private static void run() throws Exception {
        check(Long.SIZE == 64 && java.nio.ByteOrder.nativeOrder()
            == java.nio.ByteOrder.LITTLE_ENDIAN, "native platform");
        check(Envelope.class.isRecord(), "Java recursive carrier is a record");
        check(Arrays.equals(Arrays.stream(Envelope.class.getRecordComponents())
            .map(java.lang.reflect.RecordComponent::getName).toArray(String[]::new),
            new String[] { "value", "mode", "next" }),
            "proof field is absent from the public record");
        check(Envelope.class.getDeclaredConstructors()[0].getParameterCount() == 3,
            "proof-free public constructor");
        check(Step.class.isSealed() && StepStop.class.isRecord() && StepMore.class.isRecord(),
            "closed typed recursive variant");
        check(Arrays.stream(StepMore.class.getDeclaredFields()).allMatch(field ->
            Modifier.isPrivate(field.getModifiers()) && Modifier.isFinal(field.getModifiers())),
            "Java record cycle fields are immutable");

        Envelope original = nested(40, 2, 80, 1);
        String originalSnapshot = snap(original);
        accepted(original, Api::first, Consumer::snap, result -> result.equals(n(41)), "first");
        accepted(original, Api::second, Consumer::snap, result -> result.equals(n(42)), "second");
        Envelope echoed = accepted(original, Api::echo, Consumer::snap,
            result -> snap(result).equals(snap(nested(41, 2, 81, 1))), "echo");
        check(echoed != original && ((StepMore)echoed.next().value()).packet()
            != ((StepMore)original.next().value()).packet(), "recursive result owns storage");
        Envelope absent = envelope(40, 2);
        accepted(absent, Api::first, Consumer::snap, result -> result.equals(n(41)),
            "inactive option branch");
        Envelope stopped = envelope(40, 2, some(new StepStop()));
        accepted(stopped, Api::first, Consumer::snap, result -> result.equals(n(41)),
            "active empty variant branch");
        Option<Envelope>[] aliases = groups(Option.some(original), Option.none());
        accepted(aliases, Api::groups, Consumer::snap, result -> result.equals(n(2)),
            "transparent recursive alias carrier");
        Option<Envelope>[] echoedGroups = accepted(aliases, Api::echoGroups, Consumer::snap,
            result -> snap(result).equals(snap(groups(
                Option.some(nested(42, 2, 82, 1)), Option.none()))),
            "recursive alias result");
        check(echoedGroups != aliases && echoedGroups[0] != aliases[0],
            "recursive array result owns storage");
        Envelope produced = accepted(n(5), Api::produce, BigInteger::toString,
            result -> snap(result).equals(snap(nested(6, 1, 7, 2))),
            "constructor-free result");
        check(Arrays.stream(Envelope.class.getRecordComponents())
            .noneMatch(component -> component.getName().equals("linked"))
            && snap(produced).equals(snap(nested(6, 1, 7, 2))),
            "erased proof absent from produced result");

        Envelope invalid = nested(100, 2, 80, 1);
        Envelope current = invalid;
        Envelope outerSubtype = current;
        rejectAndRecover(() -> Api.first(outerSubtype), () -> snap(outerSubtype), error -> exact(error,
            "arg0.value was rejected by MutualCheckedRecords.plusOne"), "outer-subtype", false);
        invalid = nested(40, 2, 100, 1); current = invalid;
        Envelope late = current;
        rejectAndRecover(() -> Api.first(late), () -> snap(late), error -> exact(error,
            "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne"),
            "late-subtype", false);
        invalid = nested(0, 2, 80, 1); current = invalid;
        Envelope outerRecord = current;
        rejectAndRecover(() -> Api.first(outerRecord), () -> snap(outerRecord), error -> exact(error,
            "arg0 was rejected by MutualCheckedRecords.mkEnvelope"), "outer-record", false);
        invalid = nested(40, 3, 80, 1); current = invalid;
        Envelope outerFin = current;
        rejectAndRecover(() -> Api.first(outerFin), () -> snap(outerFin), error -> exact(error,
            "arg0.mode is not below its Fin 3 bound"), "outer-fin", false);
        invalid = nested(40, 2, 80, 3); current = invalid;
        Envelope nestedFin = current;
        rejectAndRecover(() -> Api.first(nestedFin), () -> snap(nestedFin), error -> exact(error,
            "arg0.next?.more.packet.mode is not below its Fin 3 bound"), "nested-fin", false);
        Option<Envelope>[] invalidGroups = groups(Option.some(nested(40, 2, 100, 1)));
        Option<Envelope>[] groupLate = invalidGroups;
        rejectAndRecover(() -> Api.groups(groupLate), () -> snap(groupLate), error -> exact(error,
            "arg0[0]?.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne"),
            "group-late-subtype", false);
        invalidGroups = groups(Option.some(nested(40, 2, 95, 1)));
        Option<Envelope>[] echoGroupLate = invalidGroups;
        rejectAndRecover(() -> Api.echoGroups(echoGroupLate), () -> snap(echoGroupLate), error -> exact(error,
            "arg0[0]?.next?.more.packet.value was rejected by MutualCheckedRecords.plusTwo"),
            "echo-group-late-subtype", false);
        invalid = nested(90, 2, 80, 1); current = invalid;
        Envelope alternate = current;
        rejectAndRecover(() -> Api.second(alternate), () -> snap(alternate), error -> exact(error,
            "arg0.value was rejected by MutualCheckedRecords.plusTwo"), "alternate-subtype", false);

        rejectAndRecover(() -> Api.first(null), () -> "null", error -> exact(error,
            "Expected copied value of type org.leanbridge.mutualcheckedrecords.Envelope"),
            "null-record", true);
        Option<Envelope>[] missingGroups = null;
        rejectAndRecover(() -> Api.groups(missingGroups), () -> snap(missingGroups), error -> exact(error,
            "Expected copied value of type org.leanbridge.mutualcheckedrecords.Option[]"),
            "null-alias-carrier", true);
        StepMore immutable = new StepMore(envelope(40, 2));
        var packetField = StepMore.class.getDeclaredField("packet"); packetField.setAccessible(true);
        refused(() -> {
            try { packetField.set(immutable, envelope(40, 2, some(immutable))); }
            catch (ReflectiveOperationException error) { throw new CarrierMutation(error); }
        }, () -> snap(immutable.packet()), error -> error instanceof CarrierMutation
            && error.getCause() instanceof IllegalAccessException,
            "cycle-construction", true);
        recover();
        Envelope tooDeep = deep(48);
        rejectAndRecover(() -> Api.first(tooDeep), () -> snap(tooDeep), error ->
            error.getClass().getSimpleName().equals("Limit")
                && "Copied graph depth or node limit exceeded".equals(error.getMessage()),
            "depth", true);
        BigInteger negative = BigInteger.ONE.negate();
        rejectAndRecover(() -> Api.produce(negative), negative::toString, error -> exact(error,
            "Nat cannot be negative"), "negative-nat", true);

        for (int round = 0; round < ROUNDS; round++) {
            long outer = 2 + round % 80, inner = 3 + round % 70;
            Envelope valid = nested(outer, round % 3, inner, round % 3);
            accepted(valid, Api::first, Consumer::snap, result -> result.equals(n(outer + 1)),
                "round first");
            Envelope roundLate = nested(40, 2, 100, 1);
            refused(() -> Api.first(roundLate), () -> snap(roundLate), error -> exact(error,
                "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne"),
                "round late subtype", false);
            accepted(valid, Api::second, Consumer::snap, result -> result.equals(n(outer + 2)),
                "round alternate constructor");
            Option<Envelope>[] roundAliases = groups(Option.none(), Option.some(valid));
            accepted(roundAliases, Api::groups, Consumer::snap, result -> result.equals(n(2)),
                "round alias carrier");
            recoveries++;
        }
        check(snap(original).equals(originalSnapshot), "all calls preserved reused input");
    }

    private static String quote(String value) {
        if (value == null) return "null";
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"")
            .replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }
    private static String failureJson() {
        return "{" + String.join(",", failures.entrySet().stream().map(entry ->
            quote(entry.getKey()) + ":{\"name\":" + quote(entry.getValue().name())
                + ",\"message\":" + quote(entry.getValue().message()) + "}").toList()) + "}";
    }

    public static void main(String[] arguments) throws Exception {
        if (arguments.length != 0) throw new IllegalStateException("Unexpected caller arguments");
        run();
        System.out.println("{\"checks\":" + checks + ",\"rejections\":" + rejections
            + ",\"hostRejections\":" + hostRejections + ",\"calls\":" + calls
            + ",\"snapshots\":" + snapshots + ",\"recoveries\":" + recoveries
            + ",\"rounds\":" + ROUNDS + ",\"wordBits\":64,\"failures\":"
            + failureJson() + "}");
    }
}
