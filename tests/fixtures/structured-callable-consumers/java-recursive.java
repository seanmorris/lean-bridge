import java.math.BigInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.leanbridge.structured.*;

public final class RecursiveChecks {
    private static int checks;
    private static void check(boolean condition) { ++checks; if (!condition) throw new AssertionError("recursive Java " + checks); }
    private static void reject(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); } catch (Throwable error) { check(type.isInstance(error)); return; }
        throw new AssertionError("Expected " + type.getName());
    }
    private static Tree tree(int seed) {
        return new TreeBranch(new Tree[] { new TreeLeaf(BigInteger.ONE.shiftLeft(128 + seed)),
            new TreeBranch(new Tree[] {new TreeLeaf(BigInteger.valueOf(seed)), new TreeBranch(new Tree[0])}) });
    }
    @SuppressWarnings("unchecked")
    public static void main(String[] arguments) throws Exception {
        for (int seed = 0; seed < 24; ++seed) {
            final int current = seed;
            Tree input = tree(seed), replacement = tree(seed + 1);
            int[] called = {0}; var retained = new AtomicReference<Tree>();
            Tree actual = Api.callRecursive(input, value -> {
                ++called[0]; check(value != input); check(value.equals(input)); retained.set(value); System.gc(); return replacement;
            });
            check(called[0] == 1); check(actual != replacement); check(actual.equals(replacement));
            ((TreeBranch)input).children()[0] = new TreeLeaf(BigInteger.ZERO);
            ((TreeBranch)replacement).children()[0] = new TreeLeaf(BigInteger.ONE);
            check(retained.get().equals(tree(seed))); check(actual.equals(tree(seed + 1)));
            called[0] = 0;
            actual = Api.twiceRecursive(tree(seed), value -> {
                check(value.equals(tree(current + called[0]))); return tree(current + ++called[0]);
            });
            check(called[0] == 2); check(actual.equals(tree(seed + 2)));
            try (var closure = Api.makeRecursive(tree(seed))) {
                check(!closure.isClosed());
                check(closure.invoke(true, tree(seed + 1)).equals(tree(seed)));
                check(closure.invoke(false, tree(seed + 1)).equals(tree(seed + 1)));
                var failure = new AtomicReference<Throwable>();
                Thread.ofPlatform().start(() -> { try { closure.invoke(true, tree(current)); } catch (Throwable error) { failure.set(error); } }).join();
                check(failure.get() instanceof IllegalStateException);
                Thread.ofPlatform().start(closure::close).join(); check(closure.isClosed());
                reject(IllegalStateException.class, () -> closure.invoke(true, tree(current)));
            }
            for (Throwable marker : new Throwable[] {new IllegalStateException("marker"), new OutOfMemoryError("marker"), new AssertionError("marker")}) {
                called[0] = 0;
                try { Api.twiceRecursive(tree(seed), value -> { ++called[0]; if (marker instanceof RuntimeException error) throw error; throw (Error)marker; }); check(false); }
                catch (Throwable error) { check(error == marker); }
                check(called[0] == 1); check(Api.callRecursive(tree(seed), value -> value).equals(tree(seed)));
            }
            check(Api.callRecursive(tree(seed), outer -> Api.callRecursive(outer, value -> value)).equals(tree(seed)));
        }
        Tree[] children = new Tree[1]; Tree cyclic = new TreeBranch(children); children[0] = cyclic;
        reject(IllegalArgumentException.class, () -> Api.callRecursive(cyclic, value -> { throw new AssertionError("invalid input reached callback"); }));
        reject(IllegalArgumentException.class, () -> Api.callRecursive(tree(0), value -> cyclic));
        Tree deep = new TreeLeaf(BigInteger.ZERO);
        for (int i = 0; i < 70; ++i) deep = new TreeBranch(new Tree[] {deep});
        final Tree tooDeep = deep;
        reject(IllegalArgumentException.class, () -> Api.makeRecursive(tooDeep));
        reject(NullPointerException.class, () -> Api.callRecursive(null, value -> value));
        reject(NullPointerException.class, () -> Api.callRecursive(tree(0), null));
        reject(NullPointerException.class, () -> Api.callRecursive(tree(0), value -> null));
        reject(IllegalArgumentException.class, () -> Api.callRecursive(new TreeLeaf(BigInteger.valueOf(-1)), value -> value));
        var virtualFailure = new AtomicReference<Throwable>();
        Thread.ofVirtual().start(() -> { try { Api.makeRecursive(tree(0)); } catch (Throwable error) { virtualFailure.set(error); } }).join();
        check(virtualFailure.get() instanceof IllegalStateException);
        var payload = new Payload("nested\0λ", (Option<String>[])new Option<?>[]{Option.some("a"),Option.none()}, BigInteger.TEN, Option.none());
        check(Api.callNestedAlias(payload, value -> value).equals("nested\0λ<none>nested\0λ"));
        check(Api.callNestedPlain(payload, value -> value).equals("nested\0λ<none>nested\0λ"));
        try (var alias = Api.makeNestedAlias(payload); var plain = Api.makeNestedPlain(payload)) {
            var empty = (Option<Payload>[])new Option<?>[0];
            check(alias.invoke(empty).length == 3); check(plain.invoke(empty).length == 3);
            check(alias.invoke(empty)[0].value().equals(payload));
        }
        System.out.println("{\"profile\":\"java\",\"recursiveChecks\":" + checks + "}");
    }
}
