import java.math.BigInteger;
import org.leanbridge.defaults.Api;
import org.leanbridge.defaults.Option;
import org.leanbridge.defaults.Unit;

final class Consumer {
    private static int checks = 0;
    private Consumer() { }

    private static void check(boolean condition) {
        if (!condition) throw new AssertionError("Optional-parameter mismatch");
        ++checks;
    }

    public static void main(String[] arguments) {
        if (arguments.length != 0) throw new AssertionError("unexpected arguments");
        check(Api.word() == 7L);
        check(Api.word(7L) == 7L);
        check(Api.word(11L) == 11L);

        var large = new BigInteger("184467440737095516160");
        check(Api.natural().equals(large));
        check(Api.natural(large).equals(large));
        check(Api.natural(BigInteger.valueOf(11L)).equals(BigInteger.valueOf(11L)));

        check(Api.text().equals("Lean\nBridge"));
        check(Api.text("Lean\nBridge").equals("Lean\nBridge"));
        check(Api.text("other").equals("other"));

        check(Api.character() == 0x3bb);
        check(Api.character(0x3bb) == 0x3bb);
        check(Api.character(0x732b) == 0x732b);

        check(Api.maybe().equals(Option.none()));
        check(Api.maybe(Option.none()).equals(Option.none()));
        check(Api.maybe(Option.some(11L)).equals(Option.some(11L)));

        check(Api.present().equals(Option.some(9L)));
        check(Api.present(Option.some(9L)).equals(Option.some(9L)));
        check(Api.present(Option.none()).equals(Option.none()));
        check(Api.present(Option.some(11L)).equals(Option.some(11L)));

        Api.unitValue();
        check(true);
        Api.unitValue(Unit.INSTANCE);
        check(true);

        System.out.println("optional-parameter-java:" + checks);
    }
}
