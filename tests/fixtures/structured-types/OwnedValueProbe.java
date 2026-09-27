package consumer;

import java.math.BigInteger;
import java.lang.reflect.Modifier;
import org.leanbridge.owned_aggregates.*;

public final class OwnedValueProbe {
    private static int checks;
    private static void check(boolean condition) {
        if (!condition) throw new AssertionError("public value check " + checks);
        ++checks;
    }
    private static void rejects(Runnable action, Class<? extends Throwable> expected) {
        try { action.run(); }
        catch (Throwable error) {
            if (!expected.isInstance(error)) throw new AssertionError(error);
            ++checks; return;
        }
        throw new AssertionError("invalid public value accepted");
    }
    public static void main(String[] ignored) {
        var value = new Payload(BigInteger.ONE.shiftLeft(200), new byte[] {0, -1, 1});
        var equal = new Payload(BigInteger.ONE.shiftLeft(200), new byte[] {0, -1, 1});
        check(value.equals(equal));
        check(value.hashCode() == equal.hashCode());
        check(!Option.<Option<Boolean>>none().equals(Option.some(Option.<Boolean>none())));
        check(!Option.some(false).equals(Option.<Boolean>none()));
        check(!Option.some(Unit.INSTANCE).equals(Option.<Unit>none()));
        check(Result.<Payload, String>ok(value).equals(Result.<Payload, String>ok(equal)));
        check(Option.some(Option.some(value)).equals(Option.some(Option.some(equal))));
        check(new Pair<>(value, new Pair<>(Unit.INSTANCE, Option.none()))
            .equals(new Pair<>(equal, new Pair<>(Unit.INSTANCE, Option.none()))));
        check(new ChainStop().equals(new ChainStop()));
        check(new ChoiceEmpty().equals(new ChoiceEmpty()));
        check(Modifier.isFinal(Ticket.class.getModifiers()) && Ticket.class.getConstructors().length == 0);
        check(AutoCloseable.class.isAssignableFrom(Ticket.class));
        check(Modifier.isFinal(MakeRecordResultClosure.class.getModifiers())
            && MakeRecordResultClosure.class.getConstructors().length == 0);
        check(AutoCloseable.class.isAssignableFrom(MakeRecordResultClosure.class));
        CallbackRecordArgument1ClosureCallback identity = item -> item;
        DispatchResultClosureCallback higher = closure -> closure.invoke(null);
        check(identity != null); check(higher != null);
        Tree tree = new TreeBranch(new Tree[0]);
        for (int i = 0; i < 40; ++i) tree = new TreeBranch(new Tree[] {tree, new TreeBranch(new Tree[0])});
        check(tree.equals(tree));
        check(tree.toString().length() <= 4099);
        var cycle = new Tree[1]; cycle[0] = new TreeBranch(cycle);
        rejects(() -> cycle[0].hashCode(), IllegalArgumentException.class);
        rejects(() -> new Payload(null, new byte[0]), NullPointerException.class);
        rejects(() -> Result.<Payload, String>err("error").value(), IllegalStateException.class);
        check(Option.some(Unit.INSTANCE).value() == Unit.INSTANCE);
        Tree deep = new TreeBranch(new Tree[0]);
        for (int i = 0; i < 80; ++i) deep = new TreeBranch(new Tree[] {deep});
        Tree tooDeep = deep;
        rejects(() -> tooDeep.equals(tooDeep), IllegalArgumentException.class);
        rejects(() -> Option.some(null), NullPointerException.class);
        check(!Result.<Payload, Payload>ok(value).equals(Result.<Payload, Payload>err(equal)));
        check(!Option.some(new Tree[0]).equals(Option.<Tree[]>none()));
        System.out.println(checks);
    }
}
