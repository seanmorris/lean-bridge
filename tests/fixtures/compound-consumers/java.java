// Independent public-API checks against an installed prepared Maven JAR.
import org.leanbridge.compounds.*;
import org.leanbridge.compounds.Unit;
import java.math.BigInteger;
import java.lang.reflect.Array;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

public final class Consumer {
    private Consumer() { }
    private static final AtomicInteger checks = new AtomicInteger();
    static void check(boolean value) { int n = checks.incrementAndGet(); if (!value) throw new AssertionError("check " + n); }
    static void reject(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); } catch (Throwable error) { check(type.isInstance(error)); return; }
        throw new AssertionError("Expected " + type.getName());
    }
    static void equal(Object a, Object b) {
        check(a.getClass() == b.getClass());
        if (a instanceof Float f && b instanceof Float g) check(Float.isNaN(f) && Float.isNaN(g) || Float.floatToRawIntBits(f) == Float.floatToRawIntBits(g));
        else if (a instanceof Double f && b instanceof Double g) check(Double.isNaN(f) && Double.isNaN(g) || Double.doubleToRawLongBits(f) == Double.doubleToRawLongBits(g));
        else if (a.getClass().isArray()) { check(Array.getLength(a) == Array.getLength(b)); for (int i = 0; i < Array.getLength(a); ++i) equal(Array.get(a, i), Array.get(b, i)); }
        else if (a.getClass().isRecord()) {
            try { for (var field : a.getClass().getRecordComponents()) equal(field.getAccessor().invoke(a), field.getAccessor().invoke(b)); }
            catch (ReflectiveOperationException error) { throw new AssertionError(error); }
        } else check(Objects.equals(a, b));
    }
    static byte[] allBytes() { byte[] result = new byte[256]; for (int i = 0; i < result.length; ++i) result[i] = (byte)i; return result; }
    static <T> void exercise(Function<Option<T>, Option<T>> option, Function<Result<T, T>, Result<T, T>> result, Function<Pair<T, T>, Pair<T, T>> tuple, List<T> values) {
        equal(option.apply(Option.none()), Option.none());
        for (int i = 0; i < 32; ++i) {
            T a = values.get(i % values.size()), b = values.get((i + 1) % values.size());
            equal(option.apply(Option.some(a)), Option.some(a));
            equal(result.apply(Result.ok(a)), Result.err(a));
            equal(result.apply(Result.err(a)), Result.ok(a));
            equal(tuple.apply(new Pair<>(a, b)), new Pair<>(b, a));
        }
    }
    static void deep() throws Exception {
        String type = "org.leanbridge.compounds.Result<org.leanbridge.compounds.Pair<java.lang.Long, org.leanbridge.compounds.Unit>, java.lang.String>";
        for (int level = 0; level < 24; ++level) type = "org.leanbridge.compounds.Option<" + type + ">";
        var method = Api.class.getMethod("deep", Option.class);
        check(method.getGenericReturnType().getTypeName().equals(type)); check(method.getGenericParameterTypes()[0].getTypeName().equals(type));
        for (int depth = 0; depth <= 24; ++depth) {
            Object value = depth == 24 ? Result.<Pair<Long, Unit>, String>ok(new Pair<>(42L, Unit.INSTANCE)) : Option.none();
            for (int level = 0; level < depth; ++level) value = Option.some(value);
            equal(method.invoke(null, value), value);
        }
        Object error = Result.<Pair<Long, Unit>, String>err("deep\0λ");
        for (int level = 0; level < 24; ++level) error = Option.some(error);
        equal(method.invoke(null, error), error);
    }
    public static void main(String[] args) throws Exception {
        var huge = BigInteger.ONE.shiftLeft(5120).add(BigInteger.ONE.shiftLeft(255)).add(BigInteger.valueOf(17));
/* PRIMITIVE_CASES */
        List<Option<Option<Unit>>> states = List.of(Option.none(), Option.some(Option.none()), Option.some(Option.some(Unit.INSTANCE)));
        var state = states.getFirst();
        for (int i = 0; i < 30; ++i) { equal(state, states.get(i % 3)); check(Api.classify(state) == i % 3); state = Api.next(state); }
        equal(Api.make(), Option.some(Result.ok(new Pair<>(BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), Unit.INSTANCE))));
        equal(Api.flip(Result.ok(new Pair<>(42L, Option.some(Unit.INSTANCE)))), Result.err(new Pair<>(42L, Option.some(Unit.INSTANCE))));
        equal(Api.flip(Result.err(Option.some("error\0λ"))), Result.ok(Option.some("error\0λ")));
        equal(Api.flip(Result.err(Option.none())), Result.ok(Option.none()));
        List<Option<Result<Pair<BigInteger, Unit>, String>>> choices = List.of(Option.none(), Option.some(Result.ok(new Pair<>(huge, Unit.INSTANCE))), Option.some(Result.err("oops\0")));
        List<Result<Option<Result<Pair<Long, Unit>, String>>, Option<BigInteger>>> nestedCases = List.of(Result.ok(Option.none()), Result.ok(Option.some(Result.ok(new Pair<>(42L, Unit.INSTANCE)))), Result.ok(Option.some(Result.err("bad"))), Result.err(Option.none()), Result.err(Option.some(huge)));
        for (var choice : choices) for (var nested : nestedCases) {
            @SuppressWarnings("unchecked")
            var rows = (Option<Result<Pair<String, BigInteger>, Pair<byte[], BigInteger>>>[])new Option<?>[] {
                Option.none(), Option.some(Result.ok(new Pair<>("row\0🌿", BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)))), Option.some(Result.err(new Pair<>(new byte[] {0, -1}, huge.negate())))
            };
            var packet = new Packet(choice, new Pair<>(new Pair<>(4L, "a\0"), new Pair<>(true, 0x1f331)), rows, nested);
            var copied = Api.transform(packet);
            Option<Result<Pair<BigInteger, Unit>, String>> expected = !choice.isSome() ? Option.none() : choice.value().isOk() ? Option.some(Result.ok(new Pair<>(huge.add(BigInteger.ONE), Unit.INSTANCE))) : Option.some(Result.err("oops\0!"));
            equal(copied.choice(), expected); equal(copied.products(), new Pair<>(new Pair<>(5L, "a\0!"), new Pair<>(false, 0x1f331)));
            equal(copied.rows()[0], rows[2]); equal(copied.rows()[1], rows[1]); equal(copied.rows()[2], rows[0]); equal(copied.nested(), nested);
            copied.rows()[0].value().error().first()[0] = 7; check(rows[2].value().error().first()[0] == 0);
        }
        deep();
        equal(Api.duplicate(Option.none()), Result.err("empty"));
        byte[] input = {0, -1}; var copies = Api.duplicate(Option.some(input)).value().value();
        equal(copies, new byte[][] {{0, -1}, {0, -1}}); copies[0][0] = 7; check(copies[1][0] == 0 && input[0] == 0);
        check(Option.none().equals(new Option.None<>())); check(!Option.none().equals(Option.some(Unit.INSTANCE)));
        check(!Result.ok(Unit.INSTANCE).equals(Result.err(Unit.INSTANCE)));
        check(Option.none().toString().startsWith("None")); check(Option.some(Unit.INSTANCE).toString().startsWith("Some"));
        check(Result.ok(Unit.INSTANCE).toString().startsWith("Ok")); check(Result.err(Unit.INSTANCE).toString().startsWith("Err"));
        // Exhaustive sealed switches are ordinary Java consumer code.
        check(switch (Option.some(Unit.INSTANCE)) { case Option.None<Unit> n -> false; case Option.Some<Unit> s -> s.value() == Unit.INSTANCE; });
        check(switch (Result.<Unit, String>err("error")) { case Result.Ok<Unit, String> ok -> false; case Result.Err<Unit, String> err -> err.error().equals("error"); });
        reject(IllegalStateException.class, () -> Option.none().value());
        reject(IllegalStateException.class, () -> Result.ok(Unit.INSTANCE).error());
        reject(IllegalStateException.class, () -> Result.err(Unit.INSTANCE).value());
        reject(NullPointerException.class, () -> Option.some(null));
        reject(NullPointerException.class, () -> Result.ok(null)); reject(NullPointerException.class, () -> Result.err(null));
        reject(NullPointerException.class, () -> new Pair<>("allocated", null));
        reject(NullPointerException.class, () -> Api.optionString(null)); reject(NullPointerException.class, () -> Api.resultString(null));
        reject(NullPointerException.class, () -> Api.tupleString(null)); reject(NullPointerException.class, () -> Api.transform(null));
        reject(IllegalArgumentException.class, () -> Api.optionNat(Option.some(BigInteger.valueOf(-1))));
        reject(IllegalArgumentException.class, () -> Api.resultNat(Result.err(BigInteger.valueOf(-1))));
        reject(IllegalArgumentException.class, () -> Api.optionUint8(Option.some(256)));
        reject(IllegalArgumentException.class, () -> Api.optionUint16(Option.some(-1)));
        reject(IllegalArgumentException.class, () -> Api.optionUint32(Option.some(4294967296L)));
        reject(IllegalArgumentException.class, () -> Api.optionUint64(Option.some(BigInteger.ONE.shiftLeft(64))));
        reject(IllegalArgumentException.class, () -> Api.optionChar(Option.some(0xd800)));
        reject(IllegalArgumentException.class, () -> Api.optionString(Option.some("\ud800")));
        reject(IllegalArgumentException.class, () -> Api.optionBytes(Option.some(new byte[16 * 1024 * 1024])));
        reject(IllegalArgumentException.class, () -> Api.duplicate(Option.some(new byte[6 * 1024 * 1024])));
        equal(Api.duplicate(Option.some(input)), Result.ok(Option.some(new byte[][] {{0, -1}, {0, -1}})));
        try (var workers = java.util.concurrent.Executors.newFixedThreadPool(4)) {
            var tasks = new java.util.ArrayList<java.util.concurrent.Future<?>>();
            for (int lane = 0; lane < 4; ++lane) tasks.add(workers.submit(() -> { for (int i = 0; i < 64; ++i) equal(Api.optionNat(Option.some(huge.add(BigInteger.valueOf(i)))), Option.some(huge.add(BigInteger.valueOf(i)))); }));
            for (var task : tasks) task.get();
        }
        Wire.result("compounds/assertions", Wire.integer(checks.get()), true);
        Wire.finish("java", "Compounds", System.getProperty("java.version"), Api.class);
    }
}
