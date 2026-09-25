// Typed public calls against the original installed Maven JAR.
import java.math.BigInteger;
import java.lang.reflect.Array;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BiFunction;
import java.util.function.BooleanSupplier;
import java.util.function.Function;
import java.util.function.IntFunction;
import java.util.function.UnaryOperator;
import org.leanbridge.structured.*;
import org.leanbridge.structured.Unit;

public final class Consumer {
    private Consumer() { }
    private static int checks, calls, rejected;
    private static final class Marker extends RuntimeException {
        private static final long serialVersionUID = 1L;
    }
    @FunctionalInterface private interface Call<T> { T invoke(T value, UnaryOperator<T> callback); }
    private record Held<T>(BiFunction<Boolean, T, T> invoke, BooleanSupplier isClosed, Runnable dispose) implements AutoCloseable {
        @Override public void close() { dispose.run(); }
    }
    private static void check(boolean condition) {
        ++checks;
        if (!condition) throw new AssertionError("structured Java check " + checks);
    }
    private static void reject(Class<? extends Throwable> type, Runnable action) {
        ++rejected;
        try { action.run(); }
        catch (Throwable failure) { check(type.isInstance(failure)); return; }
        throw new AssertionError("Expected " + type.getName());
    }
    private static void same(Object expected, Object actual, boolean detached) {
        check(expected != null && actual != null); check(expected.getClass() == actual.getClass());
        var type = expected.getClass();
        if (type.isArray()) {
            int length = Array.getLength(expected); check(length == Array.getLength(actual));
            if (detached && length != 0) check(expected != actual);
            for (int index = 0; index < length; ++index) same(Array.get(expected, index), Array.get(actual, index), detached);
        } else if (type.isRecord()) {
            if (detached) check(expected != actual);
            try {
                for (var field : type.getRecordComponents())
                    same(field.getAccessor().invoke(expected), field.getAccessor().invoke(actual), detached);
            } catch (ReflectiveOperationException failure) { throw new AssertionError(failure); }
            check(expected.equals(actual)); check(expected.hashCode() == actual.hashCode());
        } else check(Objects.equals(expected, actual));
    }
    private static void same(Object expected, Object actual) { same(expected, actual, false); }
    private static void mutate(Object value) {
        if (value instanceof byte[] bytes) { if (bytes.length != 0) bytes[0] ^= (byte) 0xff; }
        else if (value instanceof String[] strings) { if (strings.length != 0) strings[0] = "changed"; }
        else if (value instanceof Option<?>[] options) { if (options.length != 0) options[0] = Option.some("changed"); }
        else if (value instanceof Result<?, ?>[] results) { if (results.length != 0) results[0] = Result.err("changed"); }
        else if (value.getClass().isRecord()) {
            try { for (var field : value.getClass().getRecordComponents()) mutate(field.getAccessor().invoke(value)); }
            catch (ReflectiveOperationException failure) { throw new AssertionError(failure); }
        }
    }
    @SuppressWarnings("try") // Explicit repeated close is part of the public ownership contract.
    private static <T> void cases(IntFunction<T> value, Call<T> call, Call<T> twice, Function<T, Held<T>> make) throws InterruptedException {
        for (int seed = 0; seed < 24; ++seed) {
            final int current = seed;
            T input = value.apply(seed), replacement = value.apply(seed + 1);
            var retained = new AtomicReference<T>(); int[] invoked = { 0 };
            T output = call.invoke(input, argument -> {
                ++invoked[0]; same(input, argument, true); retained.set(argument);
                System.gc(); return replacement;
            });
            ++calls; check(invoked[0] == 1); same(replacement, output, true);
            mutate(input); mutate(replacement);
            same(value.apply(seed), retained.get()); same(value.apply(seed + 1), output);
            invoked[0] = 0;
            output = twice.invoke(value.apply(seed), argument -> {
                same(value.apply(current + invoked[0]), argument);
                return value.apply(current + ++invoked[0]);
            });
            ++calls; check(invoked[0] == 2); same(value.apply(seed + 2), output);
            T copiedInput = value.apply(seed);
            same(value.apply(seed + 1), call.invoke(copiedInput, argument -> { mutate(argument); return value.apply(current + 1); }));
            ++calls; same(value.apply(seed), copiedInput);
            try (var owned = make.apply(copiedInput)) {
                ++calls; check(!owned.isClosed.getAsBoolean()); mutate(copiedInput);
                var alias = owned.invoke;
                same(value.apply(seed), alias.apply(true, value.apply(seed + 1)));
                same(value.apply(seed + 1), alias.apply(false, value.apply(seed + 1)));
                T first = alias.apply(true, value.apply(seed + 1)); mutate(first);
                same(value.apply(seed), alias.apply(true, value.apply(seed + 2))); calls += 4;
                System.gc(); same(value.apply(seed), alias.apply(true, value.apply(seed + 3))); ++calls;
                var error = new AtomicReference<Throwable>();
                var thread = Thread.ofPlatform().start(() -> {
                    try { alias.apply(true, value.apply(current)); } catch (Throwable failure) { error.set(failure); }
                });
                thread.join(); check(error.get() instanceof IllegalStateException);
                owned.close(); owned.close(); check(owned.isClosed.getAsBoolean());
                reject(IllegalStateException.class, () -> alias.apply(false, value.apply(current)));
            }
            for (Throwable failure : new Throwable[] { new Marker(), new OutOfMemoryError("callback"), new AssertionError("callback") }) {
                invoked[0] = 0;
                try {
                    twice.invoke(value.apply(seed), argument -> {
                        ++invoked[0];
                        if (failure instanceof RuntimeException runtime) throw runtime;
                        throw (Error) failure;
                    });
                    check(false);
                } catch (Throwable caught) { check(caught == failure); }
                check(invoked[0] == 1); ++rejected;
                same(value.apply(seed), call.invoke(value.apply(seed), UnaryOperator.identity())); ++calls;
            }
            same(value.apply(seed), call.invoke(value.apply(seed), outer -> call.invoke(outer, UnaryOperator.identity()))); calls += 2;
            var marker = new Marker();
            same(value.apply(seed), call.invoke(value.apply(seed), outer -> {
                try { call.invoke(outer, ignored -> { throw marker; }); check(false); }
                catch (Marker caught) { check(caught == marker); }
                return outer;
            })); calls += 2;
        }
        try (var owned = make.apply(value.apply(1))) {
            var thread = Thread.ofPlatform().start(owned::close); thread.join(); check(owned.isClosed.getAsBoolean());
            reject(IllegalStateException.class, () -> owned.invoke.apply(true, value.apply(1)));
        }
        var virtualFailure = new AtomicReference<Throwable>();
        var virtual = Thread.ofVirtual().start(() -> {
            try { call.invoke(value.apply(1), UnaryOperator.identity()); }
            catch (Throwable failure) { virtualFailure.set(failure); }
        });
        virtual.join(); check(virtualFailure.get() instanceof IllegalStateException);
    }
    private static <T> void invalid(T input, T valid, Class<? extends Throwable> error,
        Call<T> call, Call<T> twice, Function<T, Held<T>> make) {
        int[] invoked = { 0 };
        reject(error, () -> call.invoke(input, argument -> { ++invoked[0]; return argument; })); check(invoked[0] == 0);
        reject(error, () -> make.apply(input));
        reject(error, () -> call.invoke(valid, ignored -> input));
        reject(error, () -> twice.invoke(valid, ignored -> { ++invoked[0]; return input; })); check(invoked[0] == 1);
        try (var owned = make.apply(valid)) {
            reject(error, () -> owned.invoke.apply(false, input));
            same(valid, owned.invoke.apply(true, valid));
        }
        same(valid, call.invoke(valid, UnaryOperator.identity()));
    }
    public static void main(String[] args) throws Exception {
        Call<Option<String>[]> array = (value, callback) -> Api.callArray(value, callback::apply);
        Call<Option<String>[]> twiceArray = (value, callback) -> Api.twiceArray(value, callback::apply);
        Function<Option<String>[], Held<Option<String>[]>> makeArray = value -> {
            var owned = Api.makeArray(value); return new Held<>(owned::invoke, owned::isClosed, owned::close);
        };
        cases(StructuredValues::array, array, twiceArray, makeArray);
        cases(StructuredValues::list, (value, callback) -> Api.callList(value, callback::apply),
            (value, callback) -> Api.twiceList(value, callback::apply), value -> {
                var owned = Api.makeList(value); return new Held<>(owned::invoke, owned::isClosed, owned::close);
            });
        cases(StructuredValues::option, (value, callback) -> Api.callOption(value, callback::apply),
            (value, callback) -> Api.twiceOption(value, callback::apply), value -> {
                var owned = Api.makeOption(value); return new Held<>(owned::invoke, owned::isClosed, owned::close);
            });
        cases(StructuredValues::result, (value, callback) -> Api.callResult(value, callback::apply),
            (value, callback) -> Api.twiceResult(value, callback::apply), value -> {
                var owned = Api.makeResult(value); return new Held<>(owned::invoke, owned::isClosed, owned::close);
            });
        cases(StructuredValues::tuple, (value, callback) -> Api.callTuple(value, callback::apply),
            (value, callback) -> Api.twiceTuple(value, callback::apply), value -> {
                var owned = Api.makeTuple(value); return new Held<>(owned::invoke, owned::isClosed, owned::close);
            });
        Call<Payload> record = (value, callback) -> Api.callRecord(value, callback::apply);
        Call<Payload> twiceRecord = (value, callback) -> Api.twiceRecord(value, callback::apply);
        Function<Payload, Held<Payload>> makeRecord = value -> {
            var owned = Api.makeRecord(value); return new Held<>(owned::invoke, owned::isClosed, owned::close);
        };
        cases(StructuredValues::record, record, twiceRecord, makeRecord);
        cases(StructuredValues::variant, (value, callback) -> Api.callVariant(value, callback::apply),
            (value, callback) -> Api.twiceVariant(value, callback::apply), value -> {
                var owned = Api.makeVariant(value); return new Held<>(owned::invoke, owned::isClosed, owned::close);
            });
        cases(StructuredValues::record, (value, callback) -> Api.callAlias(value, callback::apply),
            (value, callback) -> Api.twiceAlias(value, callback::apply), value -> {
                var owned = Api.makeAlias(value); return new Held<>(owned::invoke, owned::isClosed, owned::close);
            });
        // Pass null to the installed API itself, not to a method-reference adapter.
        reject(NullPointerException.class, () -> Api.callArray(StructuredValues.array(1), null));
        reject(NullPointerException.class, () -> Api.callList(StructuredValues.list(1), null));
        reject(NullPointerException.class, () -> Api.callOption(StructuredValues.option(1), null));
        reject(NullPointerException.class, () -> Api.callResult(StructuredValues.result(1), null));
        reject(NullPointerException.class, () -> Api.callTuple(StructuredValues.tuple(1), null));
        reject(NullPointerException.class, () -> Api.callRecord(StructuredValues.record(1), null));
        reject(NullPointerException.class, () -> Api.callVariant(StructuredValues.variant(1), null));
        reject(NullPointerException.class, () -> Api.callAlias(StructuredValues.record(1), null));
        invalid(null, StructuredValues.array(1), NullPointerException.class, array, twiceArray, makeArray);
        var missing = StructuredValues.array(1); missing[1] = null;
        invalid(missing, StructuredValues.array(1), NullPointerException.class, array, twiceArray, makeArray);
        var malformed = StructuredValues.array(1); malformed[1] = Option.some("\ud800");
        invalid(malformed, StructuredValues.array(1), IllegalArgumentException.class, array, twiceArray, makeArray);
        var original = StructuredValues.record(1);
        invalid(new Payload(original.text(), original.rows(), BigInteger.valueOf(-1), original.nested()),
            original, IllegalArgumentException.class, record, twiceRecord, makeRecord);
        int[] invoked = { 0 };
        try (var expired = Api.retainRecord(value -> { ++invoked[0]; return value; })) {
            reject(IllegalArgumentException.class, () -> expired.invoke(original)); check(invoked[0] == 0);
        }
        var marker = new Marker();
        try { Api.afterFailure(original, ignored -> { throw marker; }); check(false); }
        catch (Marker caught) { check(caught == marker); }
        check(Api.afterFailure(original, value -> value).equals(original.text()));
        @SuppressWarnings("unchecked") var huge = (Option<String>[]) new Option<?>[600_000];
        reject(IllegalArgumentException.class, () -> Api.callArray(huge, value -> value));
        reject(IllegalArgumentException.class, () -> Api.callArray(StructuredValues.array(1), ignored -> huge));
        same(original, Api.callRecord(original, value -> value));
        Wire.result("structured/assertions", Wire.integer(checks), true);
        Wire.result("structured/calls", Wire.integer(calls), true);
        Wire.result("structured/rejections", Wire.integer(rejected), true);
        Wire.finish("java", "Structured", System.getProperty("java.version"), Api.class);
    }
}
