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
        for (int round = 0; round < 1000; round++) {
            BigInteger value = huge.add(n(round));
            call(value, Api::pairValues, new AliasPair(items(value), items(value.add(n(1)))));
        }
        System.out.println("{\"checks\":" + checks + ",\"rejections\":" + rejections
            + ",\"hostRejections\":" + hostRejections + ",\"snapshotControls\":" + snapshotControls + "}");
    }
}
