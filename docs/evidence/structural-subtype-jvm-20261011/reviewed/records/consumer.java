import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigInteger;
import java.util.Arrays;
import java.util.function.Function;
import org.leanbridge.structuralsubtypes.Api;
import org.leanbridge.structuralsubtypes.Option;
import org.leanbridge.structuralsubtypes.Pair;
import org.leanbridge.structuralsubtypes.Result;

final class Consumer {
    private static int checks, rejections, snapshotControls;
    private Consumer() { }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    static Option<BigInteger> s(BigInteger value) { return Option.some(value); }
    static Option<Pair<BigInteger, BigInteger>> p(BigInteger a, BigInteger b) { return Option.some(new Pair<>(a, b)); }
    static Option<Pair<Integer, BigInteger>> b(int a, BigInteger value) { return Option.some(new Pair<>(a, value)); }
    @SafeVarargs static <T> T[] values(T... items) { return items; }
    static void check(boolean condition, String label) {
        if (!condition) throw new AssertionError("failed: " + label);
        checks++;
    }
    // Independent full snapshots. Never use generated wrapper equality or hashCode.
    static void writeSnapshot(DataOutputStream out, Object value) throws IOException {
        if (value == null) { out.writeUTF("null"); return; }
        out.writeUTF(value.getClass().getName());
        if (value instanceof BigInteger integer) {
            byte[] bytes = integer.toByteArray(); out.writeInt(bytes.length); out.write(bytes);
        } else if (value instanceof Integer integer) out.writeInt(integer);
        else if (value instanceof String text) {
            out.writeInt(text.length());
            for (int i = 0; i < text.length(); i++) out.writeChar(text.charAt(i));
        } else if (value instanceof Object[] array) {
            out.writeInt(array.length);
            for (Object item : array) writeSnapshot(out, item);
        } else if (value instanceof Option<?> option) {
            out.writeBoolean(option.isSome());
            if (option.isSome()) writeSnapshot(out, option.value());
        } else if (value instanceof Result<?, ?> result) {
            out.writeBoolean(result.isOk());
            writeSnapshot(out, result.isOk() ? result.value() : result.error());
        } else if (value instanceof Pair<?, ?> pair) {
            writeSnapshot(out, pair.first()); writeSnapshot(out, pair.second());
        } else throw new AssertionError("unsupported snapshot: " + value.getClass());
    }
    static byte[] snapshot(Object value) {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (DataOutputStream out = new DataOutputStream(bytes)) { writeSnapshot(out, value); }
            return bytes.toByteArray();
        } catch (IOException error) { throw new UncheckedIOException(error); }
    }
    static boolean same(Object left, Object right) { return Arrays.equals(snapshot(left), snapshot(right)); }
    static String subtype(String path, String constructor) { return path + " was rejected by StructuralSubtypes." + constructor; }
    static String fin(String path, BigInteger bound) { return path + " is not below its Fin " + bound + " bound"; }
    static void refused(Object input, Runnable call, String expected) {
        byte[] before = snapshot(input); boolean accepted = true;
        try { call.run(); }
        catch (IllegalArgumentException error) {
            check(error.getClass() == IllegalArgumentException.class && expected.equals(error.getMessage()), "exact refusal: " + expected + "; got " + error);
            accepted = false;
        }
        if (accepted) throw new AssertionError("accepted: " + expected);
        check(Arrays.equals(before, snapshot(input)), "complete rejected inputs unchanged"); rejections++;
    }
    public static void main(String[] args) {
        BigInteger huge = BigInteger.ONE.shiftLeft(100), wide = n(10).shiftLeft(64).add(n(10));
        Option<BigInteger>[] originalFirst = values(s(huge), Option.none());
        Option<Pair<Integer, String>>[] originalSecond = values(Option.some(new Pair<>(255, "a\0tail")));
        Object original = new Pair<>(originalFirst, originalSecond);
        Object[] changed = {
            new Pair<>(values(s(huge.add(n(1))), Option.none()), originalSecond),
            new Pair<>(Consumer.<Option<BigInteger>>values(Option.none(), Option.none()), originalSecond),
            new Pair<>(values(s(huge), Option.none(), Option.none()), originalSecond),
            new Pair<>(originalFirst, values(Option.some(new Pair<>(254, "a\0tail")))),
            new Pair<>(originalFirst, values(Option.some(new Pair<>(255, "a\0changed")))),
            new Pair<>(originalFirst, Consumer.<Option<Pair<Integer, String>>>values(Option.none()))
        };
        for (Object mutation : changed) { check(!same(mutation, original), "snapshot mutation control"); snapshotControls++; }
        check(Api.scalar(huge).equals(huge), "wide scalar");
        refused(n(0), () -> Api.scalar(n(0)), subtype("value0", "checkedPositive"));
        for (String name : new String[] {"arrays", "lists", "specialized"}) {
            Function<BigInteger[], BigInteger[]> call = switch (name) {
                case "arrays" -> Api::arrays; case "lists" -> Api::lists; default -> Api::specialized;
            };
            check(call.apply(values()).length == 0, name + " empty");
            BigInteger[] input = values(n(1), huge, n(3));
            check(same(call.apply(input), input), name + " wide values");
            for (int position = 0; position < 3; position++) {
                BigInteger[] bad = input.clone(); bad[position] = n(0);
                refused(bad, () -> call.apply(bad), subtype("value0[" + position + "]", "checkedPositive"));
            }
            check(same(call.apply(input), input), name + " recovery");
        }
        check(!Api.options(Option.none()).isSome(), "absent option");
        check(same(Api.options(s(huge)), s(huge)), "present option");
        refused(s(n(0)), () -> Api.options(s(n(0))), subtype("value0?", "checkedPositive"));
        String text = "héllo\0tail🙂";
        check(same(Api.product(new Pair<>(huge, text)), new Pair<>(huge, text)), "Unicode and complete NUL suffix");
        refused(new Pair<>(n(0), text), () -> Api.product(new Pair<>(n(0), text)), subtype("value0.0", "checkedPositive"));
        refused(new Pair<>(huge, ""), () -> Api.product(new Pair<>(huge, "")), subtype("value0.1", "checkedWord"));
        Result<BigInteger, String> ok = Result.ok(huge), error = Result.err(text);
        check(same(Api.branch(ok), ok), "active ok"); check(same(Api.branch(error), error), "active error");
        Result<BigInteger, String> badOk = Result.ok(n(0)), badError = Result.err("");
        refused(badOk, () -> Api.branch(badOk), subtype("value0.ok", "checkedPositive"));
        refused(badError, () -> Api.branch(badError), subtype("value0.error", "checkedWord"));
        Option<Pair<Integer, BigInteger>>[] bytes = values(Option.none(), b(255, huge));
        check(same(Api.byteBranches(bytes), bytes), "UInt8 and Nat");
        Option<Pair<Integer, BigInteger>>[] badByte = values(Option.none(), b(0, huge)), badNat = values(Option.none(), b(1, n(0)));
        refused(badByte, () -> Api.byteBranches(badByte), subtype("value0[1]?.0", "checkedByte"));
        refused(badNat, () -> Api.byteBranches(badNat), subtype("value0[1]?.1", "checkedPositive"));
        Option<Pair<BigInteger, BigInteger>>[][] nested = values(values(Option.none(), p(huge, wide.subtract(n(1)))), values(), values(p(n(2), n(3))));
        check(Api.nested(nested).equals(n(3)), "nested valid");
        for (int row = 0; row < 3; row++) for (int column = 0; column < 3; column++) {
            var valid = p(huge, wide.subtract(n(1)));
            Option<Pair<BigInteger, BigInteger>>[][] rows = values(values(valid, valid, valid), values(valid, valid, valid), values(valid, valid, valid));
            rows[row][column] = p(n(0), wide);
            refused(rows, () -> Api.nested(rows), fin("value0[" + row + "][" + column + "]?.1", wide));
            rows[row][column] = p(n(0), wide.subtract(n(1)));
            refused(rows, () -> Api.nested(rows), subtype("value0[" + row + "][" + column + "]?.0", "checkedPositive"));
            rows[row][column] = p(n(1), wide.subtract(n(1)));
            check(Api.nested(rows).equals(n(3)), "nested recovery");
        }
        Option<BigInteger>[] first = values(s(n(1)), Option.none(), s(huge)), second = values(s(huge), s(n(3)), Option.none());
        Option<BigInteger>[] normalized = values(s(huge.add(n(1))), s(n(4)), Option.none());
        Option<BigInteger>[] joined = Arrays.copyOf(first, first.length + normalized.length);
        System.arraycopy(normalized, 0, joined, first.length, normalized.length);
        check(same(Api.aliasPair(new Pair<>(first, second)), new Pair<>(first, normalized)), "per-site alias constructors");
        check(same(Api.aliasArguments(first, second), joined), "per-parameter constructors");
        check(Api.plainFin(values(Option.none(), s(n(0)), s(n(9)))).equals(n(3)), "Fin endpoints");
        Option<BigInteger>[] badFin = values(s(n(10)));
        refused(badFin, () -> Api.plainFin(badFin), fin("value0[0]?", n(10)));
        for (int position = 0; position < 3; position++) {
            Option<BigInteger>[] left = values(s(n(1)), s(huge), s(n(3))), right = values(s(huge), s(n(3)), s(n(4)));
            left[position] = s(n(0));
            refused(new Pair<>(left, second), () -> Api.aliasPair(new Pair<>(left, second)), subtype("value0.0[" + position + "]?", "checkedPositive"));
            right[position] = s(n(0));
            refused(new Pair<>(first, right), () -> Api.aliasPair(new Pair<>(first, right)), subtype("value0.1[" + position + "]?", "normalizePositive"));
        }
        for (int round = 0; round < 1000; round++) {
            Option<BigInteger>[] late = values(s(huge), s(n(3)), s(n(4))); int position = round % 3; late[position] = s(n(0));
            refused(new Pair<>(first, late), () -> Api.aliasArguments(first, late), subtype("value1[" + position + "]?", "normalizePositive"));
            byte[] before = snapshot(new Pair<>(first, second));
            check(same(Api.aliasArguments(first, second), joined), "late recovery");
            check(Arrays.equals(snapshot(new Pair<>(first, second)), before), "normalization does not mutate either input");
        }
        System.out.println("{\"checks\":" + checks + ",\"rejections\":" + rejections + ",\"snapshotControls\":" + snapshotControls + "}");
    }
}
