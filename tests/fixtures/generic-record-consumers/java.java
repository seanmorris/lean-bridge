import java.math.BigInteger;
import org.leanbridge.genericrecords.*;
class Consumer {
    static int checks;
    static void check(boolean value) { if (!value) throw new AssertionError("Generic record mismatch"); ++checks; }
    static boolean rejected(Runnable call) {
        try { call.run(); } catch (IllegalArgumentException | NullPointerException error) { return true; }
        return false;
    }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    static NatBox natBox(long value, long count) { return new NatBox(n(value), n(count)); }
    public static void main(String[] args) {
        // Each alias is its own record with the structure's fields instantiated; Nat fields are BigInteger.
        NatBox box = natBox(4, 1);
        NatBox bumped = Api.bump(box);
        check(bumped.equals(natBox(5, 2)) && box.value().equals(n(4)) && bumped != box);
        check(Api.again(new NatBoxAgain(n(4), n(1))).equals(new NatBoxAgain(n(8), n(1))));
        // Two aliases of one application are two distinct classes with the same layout.
        check(!NatBox.class.equals(NatBoxAgain.class) && !natBox(1, 2).equals(new NatBoxAgain(n(1), n(2))));
        String greeting = "héllo 🙂";
        check(Api.shout(new TextBox(greeting, n(3))).equals(new TextBox(greeting + "!", n(3))));
        check(Api.swapNamed(new WordPair("a", n(1))).equals(new WordPair("a!", n(2))));
        // A parameter instantiated with Option Nat and a List of a named instantiation.
        check(Api.orZero(new MaybeBox(Option.some(n(5)), n(2))).equals(n(7)));
        check(Api.orZero(new MaybeBox(Option.none(), n(2))).equals(n(2)));
        BigInteger huge = BigInteger.ONE.shiftLeft(70);
        NatBox[] boxes = {natBox(1, 0), natBox(2, 0), new NatBox(huge, n(0))};
        check(Api.total(boxes).equals(huge.add(n(3))) && Api.total(new NatBox[0]).equals(n(0)));
        Option<NatBox[]> first = Api.firstBoxes(n(2));
        check(first.isSome() && first.value().length == 2 && first.value()[1].equals(natBox(1, 2)));
        check(!Api.firstBoxes(n(0)).isSome());
        // A pair of two named instantiations.
        check(Api.unpair(new BoxPair(natBox(3, 0), new TextBox("abcd", n(0)))).equals(n(7)));
        // A universe-polymorphic structure instantiated at Type.
        check(Api.retag(new TaggedNat("t", n(1))).equals(new TaggedNat("t#", n(2))));
        // A phantom argument: the instantiation names Marker, which no field carries.
        check(Api.relabel(new MarkerTag("m")).equals(new MarkerTag("m?")));
        // Null records and negative Nat fields fail before Lean runs.
        check(rejected(() -> Api.bump(null)));
        check(rejected(() -> Api.bump(natBox(-1, 1))));
        check(rejected(() -> Api.unpair(new BoxPair(null, new TextBox("x", n(0))))));
        check(rejected(() -> Api.shout(new TextBox(null, n(0)))));
        check(rejected(() -> Api.total(new NatBox[] {natBox(1, 0), null})));
        for (long i = 0; i < 1000; ++i) {
            NatBox round = Api.bump(natBox(i, i));
            if (!round.equals(natBox(i + 1, i + 1))) throw new AssertionError("round " + i + " failed");
        }
        checks += 1000;
        System.out.println("generic-records-ok:" + checks);
    }
}
