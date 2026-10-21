// Independent Java caller for proof-erased zero-payload checked records.
import java.math.BigInteger;
import org.leanbridge.zeropayloadcheckedrecords.*;

final class Consumer {
    private static int checks = 0;
    private static int calls = 0;
    private static int rejections = 0;
    private static int recoveries = 0;
    private static final String PREFIX = "ROUTE_PREFIX";

    private static BigInteger n(long value) { return BigInteger.valueOf(value); }

    private static void check(boolean condition, String label) {
        if (!condition) throw new IllegalStateException("failed: " + label);
        checks++;
    }

    // BEGIN FULL_ONLY
    private static boolean refused(Runnable call, String expected) {
        calls++;
        try { call.run(); }
        catch (IllegalArgumentException error) {
            return error.getClass() == IllegalArgumentException.class
                && expected.equals(error.getMessage());
        }
        return false;
    }

    private static boolean nullRefused(Runnable call) {
        calls++;
        try { call.run(); }
        catch (NullPointerException error) {
            return error.getClass() == NullPointerException.class;
        }
        return false;
    }

    private static boolean recover() {
        var value = new Witness();
        calls++;
        if (!Api.witnessCount(value).equals(n(1))
            || !value.equals(new Witness())) return false;
        recoveries++;
        return true;
    }
    // END FULL_ONLY

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

        // BEGIN FULL_ONLY
        calls++;
        check(Api.witnessCount(witness).equals(n(1))
            && witness.equals(new Witness()), "accepted nullary checked record");
        check(refused(() -> Api.absentCount(witness), PREFIX
            + " was rejected by ZeroPayloadCheckedRecords.mkAbsent")
            && witness.equals(new Witness()), "refusal preserves Witness");
        rejections++; check(recover(), "recover after constructor refusal");
        calls++; Api.tokenTag(token);
        check(token.equals(new Token(Unit.INSTANCE)), "Unit Token is preserved");
        calls++;
        check(Api.markerCount(marker).equals(n(0)) && marker.equals(new Marker())
            , "plain empty Marker input");
        calls++;
        check(Api.markCount(blank).equals(n(0)) && blank.equals(new MarkBlank())
            , "inactive variant input");
        calls++;
        check(Api.markCount(marked).equals(n(1))
            && marked.equals(new MarkMarked(new Witness()))
            , "active variant checks its nested Witness");
        check(nullRefused(() -> Api.witnessCount(null))
            , "null Witness is not an empty carrier");
        rejections++; check(recover(), "recover after null Witness refusal");
        check(nullRefused(() -> Api.markerCount(null))
            , "null Marker is not a plain empty record");
        rejections++; check(recover(), "recover after null Marker refusal");
        check(nullRefused(() -> new MarkMarked(null))
            , "null nested Witness is refused by the public carrier");
        rejections++; check(recover(), "recover after null nested refusal");
        // END FULL_ONLY

        check(calls == (rejections == 0 ? 8 : 21)
            && recoveries == rejections
            && (rejections == 0 || rejections == 4), "exact totals");
    }
}
