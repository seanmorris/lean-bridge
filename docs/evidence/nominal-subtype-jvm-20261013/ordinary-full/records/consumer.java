// Independent public caller. Generated equality and serialization are not oracles.
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigInteger;
import java.util.Arrays;
import java.util.function.Function;
import org.leanbridge.nominalsubtypes.*;

final class Consumer {
    private static int checks, rejections, hostRejections, snapshotControls;
    private Consumer() { }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    static Envelope wrap(long value) { return new Envelope(n(value), n(2)); }
    @SafeVarargs static <T> T[] values(T... items) { return items; }
    static Option<Envelope>[] items(BigInteger value) {
        return values(Option.none(), Option.some(new Envelope(value.add(n(1)), n(2))));
    }
    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError("failed: " + message);
        checks++;
    }
    static void writeSnapshot(DataOutputStream out, Object value) throws IOException {
        if (value == null) { out.writeUTF("null"); return; }
        out.writeUTF(value.getClass().getName());
        if (value instanceof BigInteger number) {
            byte[] bytes = number.toByteArray(); out.writeInt(bytes.length); out.write(bytes);
        } else if (value instanceof Envelope item) {
            writeSnapshot(out, item.payload()); writeSnapshot(out, item.digit());
        } else if (value instanceof AliasPair pair) {
            writeSnapshot(out, pair.left()); writeSnapshot(out, pair.right());
        } else if (value instanceof EnvelopePair pair) {
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
    static <I, O> O call(I input, Function<I, O> action, O expected) {
        byte[] before = snapshot(input);
        O result = action.apply(input);
        check(Arrays.equals(snapshot(result), snapshot(expected)), "exact copied result");
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
    public static void main(String[] arguments) {
        if (arguments.length != 0) throw new AssertionError("Unexpected caller arguments");
        BigInteger huge = BigInteger.ONE.shiftLeft(100);
        var original = new EventChoices(values(Option.none(), Option.some(Result.ok(huge))));
        Event[] mutations = {
            new EventChoices(values(Option.none(), Option.some(Result.ok(huge.add(n(1)))))),
            new EventChoices(values(Option.none(), Option.some(Result.err(huge)))),
            new EventChoices(values(Option.some(Result.ok(huge)), Option.none())),
            new EventChoices(values(Option.none(), Option.none())),
            new EventChoices(values(Option.none(), Option.some(Result.ok(huge)), Option.none())),
            new EventBox(new Envelope(huge, n(2))),
            new EventEmpty(),
            new EventChoices(values(Option.none(), Option.some(Result.ok(BigInteger.ONE.shiftLeft(99)))))
        };
        for (Event changed : mutations) {
            check(!Arrays.equals(snapshot(changed), snapshot(original)), "independent snapshot mutation control");
            snapshotControls++;
        }
        refusedHost(n(-1), Api::scalar, IllegalArgumentException.class);
        for (BigInteger value : new BigInteger[] { n(0), n(40), huge }) {
            BigInteger one = value.add(n(1)), two = value.add(n(2));
            call(value, Api::scalar, one);
            call(value, Api::produceEnvelope, new Envelope(one, n(2)));
            call(value, Api::arrayValues, values(one, two));
            call(value, Api::listValues, values(one, two));
            call(value, Api::optional, value.signum() == 0 ? Option.none() : Option.some(one));
            call(value, Api::product, new Pair<>(one, two));
            call(value, Api::branch, value.signum() == 0 ? Result.err(one) : Result.ok(one));
            call(value, Api::groupValues, items(value));
            call(value, Api::pairValues, new AliasPair(items(value), items(one)));
            Consumer.<BigInteger, Event>call(value, Api::eventValue, new EventBox(new Envelope(one, n(2))));
            Consumer.<BigInteger, Event>call(value, Api::eventEmpty, new EventEmpty());
            Consumer.<BigInteger, Event>call(value, Api::eventChoices,
                new EventChoices(values(Option.none(), Option.some(Result.ok(one)), Option.some(Result.err(two)))));
            call(value, Api::noItems, new BigInteger[0]);
        }
        full();
        System.out.println("{\"checks\":" + checks + ",\"rejections\":" + rejections
            + ",\"hostRejections\":" + hostRejections + ",\"snapshotControls\":" + snapshotControls + "}");
    }
    static String subtype(String path, int amount) {
        return path + " was rejected by NominalSubtypes." + (amount == 1 ? "plusOne" : "plusTwo");
    }
    static String fin(String path) { return path + " is not below its Fin 3 bound"; }
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
    static void full() {
        Consumer.<Envelope, BigInteger>refusedHost(null, Api::first, NullPointerException.class);
        Consumer.<Option<Envelope>[], Option<Envelope>[]>refusedHost(null, Api::echoGroups, NullPointerException.class);
        Consumer.<Event, BigInteger>refusedHost(null, Api::eventFirst, NullPointerException.class);
        refusedHost(new Envelope(n(-1), n(2)), Api::first, IllegalArgumentException.class);
        refusedHost(new Envelope(n(40), n(-1)), Api::first, IllegalArgumentException.class);
        Consumer.<Event, Event>refusedHost(new EventChoices(values((Option<Result<BigInteger, BigInteger>>)null)),
            Api::echoEvent, NullPointerException.class);
        Envelope item = wrap(40);
        call(item, Api::first, n(41));
        call(item, Api::second, n(42));
        call(new Pair<>(item, item), v -> Api.combine(v.first(), v.second()), n(4142));
        call(new EnvelopePair(wrap(40), wrap(40)), Api::nested, n(4142));
        call(wrap(99), Api::first, n(100));
        call(wrap(89), Api::second, n(91));
        call(wrap(90), Api::first, n(91));
        refused(wrap(100), Api::first, subtype("arg0.payload", 1));
        refused(wrap(90), Api::second, subtype("arg0.payload", 2));
        refused(new Pair<>(wrap(100), wrap(40)), v -> Api.combine(v.first(), v.second()), subtype("arg0.payload", 1));
        refused(new Pair<>(wrap(40), wrap(90)), v -> Api.combine(v.first(), v.second()), subtype("arg1.payload", 2));
        refused(new EnvelopePair(wrap(100), wrap(40)), Api::nested, subtype("arg0.left.payload", 1));
        refused(new EnvelopePair(wrap(40), wrap(90)), Api::nested, subtype("arg0.right.payload", 2));
        call(item, Api::echo, wrap(41));
        for (int selected = 0; selected < 2; selected++) {
            Function<Event, BigInteger> action = selected == 0 ? Api::eventFirst : Api::eventSecond;
            int one = selected == 0 ? 1 : 2, two = selected == 0 ? 2 : 1;
            Consumer.<Event, BigInteger>call(new EventEmpty(), action, n(0));
            Consumer.<Event, BigInteger>call(new EventBox(wrap(40)), action, n(40 + one));
            Consumer.<Event, BigInteger>call(new EventChoices(values()), action, n(0));
            Consumer.<Event, BigInteger>call(new EventChoices(values(Option.none())), action, n(0));
            Consumer.<Event, BigInteger>call(new EventChoices(values(Option.none(), Option.some(Result.ok(n(40))))), action, n(40 + one));
            Consumer.<Event, BigInteger>call(new EventChoices(values(Option.some(Result.err(n(40))), Option.none())), action, n(40 + two));
            for (boolean good : new boolean[] { true, false }) for (int position = 0; position < 3; position++) {
                Option<Result<BigInteger, BigInteger>>[] branches = values(Option.some(Result.ok(n(40))), Option.none(), Option.some(Result.err(n(40))));
                branches[position] = Option.some(good ? Result.ok(n(100)) : Result.err(n(100)));
                Consumer.<Event, BigInteger>refused(new EventChoices(branches), action,
                    subtype("arg0.choices.values[" + position + "]?." + (good ? "ok" : "error"), good ? one : two));
            }
        }
        Option<Envelope>[] left = values(Option.none(), Option.some(wrap(40)), Option.some(new Envelope(n(1), n(0))));
        Option<Envelope>[] right = values(Option.some(new Envelope(n(2), n(1))), Option.none());
        Option<Envelope>[] normalizedLeft = values(Option.none(), Option.some(wrap(41)), Option.some(new Envelope(n(2), n(0))));
        Option<Envelope>[] normalizedRight = values(Option.some(new Envelope(n(4), n(1))), Option.none());
        call(new Pair<>(left, right), v -> Api.aliases(v.first(), v.second()), n(47));
        call(new AliasPair(left, right), Api::inspectAliasPair, n(47));
        call(left, Api::echoGroups, normalizedLeft);
        AliasPair projected = call(new AliasPair(left, right), Api::echoPair, new AliasPair(normalizedLeft, normalizedRight));
        call(projected, Api::echoPair, new AliasPair(
            values(Option.none(), Option.some(wrap(42)), Option.some(new Envelope(n(3), n(0)))),
            values(Option.some(new Envelope(n(6), n(1))), Option.none())));
        Consumer.<Event, Event>call(new EventChoices(values(Option.none(), Option.some(Result.ok(n(40))), Option.some(Result.err(n(40))))),
            Api::echoEvent, new EventChoices(values(Option.none(), Option.some(Result.ok(n(41))), Option.some(Result.err(n(42))))));
        Consumer.<Event, Event>call(new EventEmpty(), Api::echoEvent, new EventEmpty());
        Consumer.<Event, Event>call(new EventBox(wrap(40)), Api::echoEvent, new EventBox(wrap(41)));
        call(Consumer.<Option<Envelope>>values(), Api::echoGroups, Consumer.<Option<Envelope>>values());
        call(new AliasPair(values(), values(Option.none())), Api::echoPair, new AliasPair(values(), values(Option.none())));
        for (int position = 0; position < 3; position++) {
            Option<Envelope>[] bad = values(Option.some(wrap(40)), Option.none(), Option.some(wrap(40)));
            bad[position] = Option.some(wrap(100));
            refused(bad, Api::echoGroups, subtype("arg0[" + position + "]?.payload", 1));
            refused(new AliasPair(bad, right), Api::inspectAliasPair, subtype("arg0.left[" + position + "]?.payload", 1));
            refused(new AliasPair(left, bad), Api::inspectAliasPair, subtype("arg0.right[" + position + "]?.payload", 2));
        }
        // All Fin bounds precede even an earlier rejected Subtype constructor.
        refused(new Pair<>(wrap(100), new Envelope(n(40), n(3))), v -> Api.combine(v.first(), v.second()), fin("arg1.digit"));
        refused(new EnvelopePair(wrap(100), new Envelope(n(40), n(3))), Api::nested, fin("arg0.right.digit"));
        Pair<Option<Envelope>[], Option<Envelope>[]> bad = new Pair<>(values(Option.some(wrap(100))), values(Option.none(), Option.some(new Envelope(n(40), n(3)))));
        refused(bad, v -> Api.aliases(v.first(), v.second()), fin("arg1[1]?.digit"));
        Consumer.<Event, Event>refused(new EventBox(new Envelope(n(100), n(3))), Api::echoEvent, fin("arg0.box.value.digit"));
        call(n(2), Api::plainFin, n(2));
        refused(n(3), Api::plainFin, fin("arg0"));
        for (int round = 0; round < 1000; round++) {
            int position = round % 3;
            Option<Envelope>[] late = values(Option.none(), Option.some(wrap(1)), Option.none());
            late[position] = Option.some(wrap(90));
            refused(new AliasPair(left, late), Api::echoPair, subtype("arg0.right[" + position + "]?.payload", 2));
            call(new AliasPair(left, right), Api::echoPair, new AliasPair(normalizedLeft, normalizedRight));
        }
    }
}
