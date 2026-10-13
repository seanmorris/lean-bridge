// Synthetic caller controls, not Lean compilation or installed acceptance.
package FIXTURE_NAMESPACE;

import java.math.BigInteger;
import java.util.Objects;

public final class Api {
    private Api() { }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    static boolean mutant(String name) { return name.equals(System.getenv("NOMINAL_JVM_MUTANT")); }
    static BigInteger nat(BigInteger value) {
        Objects.requireNonNull(value);
        if (value.signum() < 0 && !mutant("negative-nat")) throw new IllegalArgumentException("Negative Nat");
        return value;
    }
    @SafeVarargs static <T> T[] values(T... items) { return items; }
    static Envelope wrap(BigInteger value) { return new Envelope(value, n(2)); }
    static Option<Envelope>[] groups(BigInteger value) {
        return values(Option.none(), Option.some(wrap(value.add(n(1)))));
    }
    public static BigInteger scalar(BigInteger value) { return nat(value).add(n(mutant("scalar") ? 0 : 1)); }
    public static Envelope produceEnvelope(BigInteger value) {
        BigInteger result = nat(value).add(n(1));
        return wrap(mutant("truncate-envelope") ? result.and(BigInteger.ONE.shiftLeft(64).subtract(n(1))) : result);
    }
    public static BigInteger[] arrayValues(BigInteger value) {
        return mutant("short-array") ? values(nat(value).add(n(1))) : values(nat(value).add(n(1)), value.add(n(2)));
    }
    public static BigInteger[] listValues(BigInteger value) { return values(nat(value).add(n(1)), value.add(n(2))); }
    public static Option<BigInteger> optional(BigInteger value) {
        return nat(value).signum() == 0 ? Option.none() : Option.some(value.add(n(1)));
    }
    public static Pair<BigInteger, BigInteger> product(BigInteger value) { return new Pair<>(nat(value).add(n(1)), value.add(n(2))); }
    public static Result<BigInteger, BigInteger> branch(BigInteger value) {
        return nat(value).signum() == 0 ? Result.err(value.add(n(1))) : Result.ok(value.add(n(1)));
    }
    public static Option<Envelope>[] groupValues(BigInteger value) { return groups(nat(value)); }
    public static AliasPair pairValues(BigInteger value) {
        Option<Envelope>[] left = groups(nat(value)), right = groups(value.add(n(1)));
        if (mutant("missing-pair-values")) right = values();
        return mutant("swap-pair") ? new AliasPair(right, left) : new AliasPair(left, right);
    }
    public static Event eventValue(BigInteger value) {
        return mutant("missing-event-value") ? new EventEmpty() : new EventBox(wrap(nat(value).add(n(1))));
    }
    public static Event eventEmpty(BigInteger value) { nat(value); return new EventEmpty(); }
    public static Event eventChoices(BigInteger value) {
        nat(value);
        if (mutant("missing-event-choices")) return new EventEmpty();
        Result<BigInteger, BigInteger> right = mutant("wrong-choice-tag") ? Result.ok(value.add(n(2))) : Result.err(value.add(n(2)));
        return new EventChoices(values(Option.none(), Option.some(Result.ok(value.add(n(1)))), Option.some(right)));
    }
    public static BigInteger[] noItems(BigInteger value) { nat(value); return values(); }
    // BEGIN FULL_ONLY
    static String path(int index) { return ("reviewed".equals(System.getenv("NOMINAL_JVM_ROUTE")) ? "value" : "arg") + index; }
    static IllegalArgumentException error(String message) { return new IllegalArgumentException(mutant("wrong-error-path") ? "wrong path" : message); }
    static void fin(BigInteger value, String path) {
        if (nat(value).compareTo(n(3)) >= 0) throw error(path + " is not below its Fin 3 bound");
    }
    static void checkEnvelope(Envelope value, String path) {
        Objects.requireNonNull(value); nat(value.payload()); fin(value.digit(), path + ".digit");
    }
    static void checkGroups(Option<Envelope>[] values, String path) {
        Objects.requireNonNull(values);
        for (int index = 0; index < values.length; index++)
            if (Objects.requireNonNull(values[index]).isSome()) checkEnvelope(values[index].value(), path + "[" + index + "]?");
    }
    static BigInteger normalize(BigInteger value, String path, int amount) {
        if (value.compareTo(n(amount == 1 ? 100 : 90)) >= 0)
            throw error(path + " was rejected by NominalSubtypes." + (amount == 1 ? "plusOne" : "plusTwo"));
        return value.add(n(amount));
    }
    static Envelope transform(Envelope value, String path, int amount) {
        return new Envelope(normalize(value.payload(), path + ".payload", amount), value.digit());
    }
    static Option<Envelope>[] transformGroups(Option<Envelope>[] values, String path, int amount) {
        Option<Envelope>[] result = values.clone();
        for (int index = 0; index < values.length; index++)
            result[index] = values[index].isSome() ? Option.some(transform(values[index].value(), path + "[" + index + "]?", amount)) : Option.none();
        return result;
    }
    static BigInteger sum(Option<Envelope>[] values) {
        BigInteger sum = n(0);
        for (Option<Envelope> item : values) if (item.isSome()) sum = sum.add(item.value().payload());
        return sum;
    }
    public static BigInteger first(Envelope value) {
        checkEnvelope(value, path(0)); return mutant("first") ? value.payload() : transform(value, path(0), 1).payload();
    }
    public static BigInteger second(Envelope value) {
        checkEnvelope(value, path(0)); return transform(value, path(0), mutant("second") ? 1 : 2).payload();
    }
    public static Envelope echo(Envelope value) { checkEnvelope(value, path(0)); return transform(value, path(0), 1); }
    public static BigInteger combine(Envelope left, Envelope right) {
        if (mutant("fin-after-subtype")) transform(left, path(0), 1);
        checkEnvelope(left, path(0)); checkEnvelope(right, path(1));
        return transform(left, path(0), 1).payload().multiply(n(mutant("combine") ? 1 : 100)).add(transform(right, path(1), 2).payload());
    }
    public static BigInteger nested(EnvelopePair value) {
        Objects.requireNonNull(value);
        String left = path(0) + ".left", right = path(0) + ".right";
        checkEnvelope(value.left(), left); checkEnvelope(value.right(), right);
        return transform(value.left(), left, 1).payload().multiply(n(mutant("nested") ? 1 : 100)).add(transform(value.right(), right, 2).payload());
    }
    public static BigInteger aliases(Option<Envelope>[] left, Option<Envelope>[] right) {
        checkGroups(left, path(0)); checkGroups(right, path(1));
        return sum(transformGroups(left, path(0), 1)).add(sum(transformGroups(right, path(1), 2)));
    }
    public static Option<Envelope>[] echoGroups(Option<Envelope>[] value) {
        checkGroups(value, path(0));
        Option<Envelope>[] result = transformGroups(value, path(0), 1);
        if (mutant("mutate-accepted-input") && value.length > 0) value[0] = Option.some(wrap(n(55)));
        return result;
    }
    public static AliasPair echoPair(AliasPair value) {
        Objects.requireNonNull(value);
        String left = path(0) + ".left", right = path(0) + ".right";
        checkGroups(value.left(), left); checkGroups(value.right(), right);
        try { return new AliasPair(transformGroups(value.left(), left, 1), transformGroups(value.right(), right, 2)); }
        catch (IllegalArgumentException error) {
            if (mutant("mutate-rejected-input") && value.left().length > 0) value.left()[0] = Option.some(wrap(n(55)));
            throw error;
        }
    }
    public static BigInteger inspectAliasPair(AliasPair value) { AliasPair result = echoPair(value); return sum(result.left()).add(sum(result.right())); }
    static Event transformEvent(Event value, int one, int two) {
        Objects.requireNonNull(value);
        if (value instanceof EventEmpty) return new EventEmpty();
        if (value instanceof EventBox box) {
            String path = path(0) + ".box.value"; checkEnvelope(box.value(), path);
            return new EventBox(transform(box.value(), path, one));
        }
        if (value instanceof EventChoices choices) {
            Option<Result<BigInteger, BigInteger>>[] output = choices.values().clone();
            for (int index = 0; index < output.length; index++) {
                if (output[index] == null && mutant("null-choice")) { output[index] = Option.none(); continue; }
                Option<Result<BigInteger, BigInteger>> item = Objects.requireNonNull(output[index]);
                if (!item.isSome()) { output[index] = Option.none(); continue; }
                Result<BigInteger, BigInteger> branch = item.value();
                BigInteger normalized = normalize(branch.isOk() ? branch.value() : branch.error(),
                    path(0) + ".choices.values[" + index + "]?." + (branch.isOk() ? "ok" : "error"), branch.isOk() ? one : two);
                output[index] = Option.some(branch.isOk() ? Result.ok(normalized) : Result.err(normalized));
            }
            return new EventChoices(output);
        }
        throw new IllegalArgumentException("Unknown event");
    }
    static BigInteger eventSum(Event value) {
        if (value instanceof EventEmpty) return n(0);
        if (value instanceof EventBox box) return box.value().payload();
        BigInteger sum = n(0);
        for (Option<Result<BigInteger, BigInteger>> item : ((EventChoices) value).values())
            if (item.isSome()) sum = sum.add(item.value().isOk() ? item.value().value() : item.value().error());
        return sum;
    }
    public static BigInteger eventFirst(Event value) { return eventSum(transformEvent(value, 1, 2)); }
    public static BigInteger eventSecond(Event value) { return eventSum(transformEvent(value, 2, 1)); }
    public static Event echoEvent(Event value) { return transformEvent(value, 1, 2); }
    public static BigInteger plainFin(BigInteger value) { if (!mutant("plain-fin")) fin(value, path(0)); return value; }
    // END FULL_ONLY
}
