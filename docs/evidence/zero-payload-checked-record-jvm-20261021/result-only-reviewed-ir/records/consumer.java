// Independent Java caller for proof-erased zero-payload checked records.
import java.math.BigInteger;
import org.leanbridge.zeropayloadcheckedrecords.*;

final class Consumer {
    private static int checks = 0;
    private static int calls = 0;
    private static int rejections = 0;
    private static int recoveries = 0;
    private static final String PREFIX = "value0";

    private static BigInteger n(long value) { return BigInteger.valueOf(value); }

    private static void check(boolean condition, String label) {
        if (!condition) throw new IllegalStateException("failed: " + label);
        checks++;
    }


    public static void main(String[] arguments) {
        if (arguments.length != 0)
            throw new IllegalStateException("Unexpected caller arguments");
        run();
        System.out.println("{\"calls\":" + calls + ",\"checks\":" + checks
            + ",\"recoveries\":" + recoveries + ",\"rejections\":"
            + rejections + "}");
    }

    private static void run() {
        calls++;
        var witness = Api.produceWitness();
        check(witness.equals(new Witness())
            && witness.hashCode() == new Witness().hashCode()
            , "proof-only Witness is a real empty value");
        calls++;
        var token = Api.produceToken();
        check(token.equals(new Token(Unit.INSTANCE))
            && token.tag() == Unit.INSTANCE, "Token retains its Unit payload");
        calls++;
        var values = Api.witnesses(n(3));
        check(values.length == 3 && values[0] != values[1]
            && values[0].equals(values[1]) && values[1].equals(values[2])
            , "Witness array retains length and independent values");
        calls++;
        var none = Api.maybeWitness(false);
        check(!none.isSome(), "absent Witness remains Option.None");
        calls++;
        var some = Api.maybeWitness(true);
        check(some.isSome() && some.value().equals(new Witness())
            , "present empty Witness remains Option.Some");
        calls++;
        var marker = Api.produceMarker();
        check(marker.equals(new Marker())
            && !marker.getClass().equals(witness.getClass())
            , "plain Marker stays nominally distinct from checked Witness");
        calls++;
        var blank = Api.produceMark(false);
        check(blank.equals(new MarkBlank()), "inactive branch remains blank");
        calls++;
        var marked = Api.produceMark(true);
        check(marked.equals(new MarkMarked(new Witness()))
            , "active branch retains its empty Witness carrier");


        check(calls == (rejections == 0 ? 8 : 21)
            && recoveries == rejections
            && (rejections == 0 || rejections == 4), "exact totals");
    }
}
