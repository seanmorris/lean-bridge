// Independent Java caller for proof-free inherited checked records.
// Generated record equality is deliberately not used as an oracle.
import java.math.BigInteger;
import java.util.function.Function;
import org.leanbridge.inheritedcheckedrecords.*;

final class Consumer {
    private static int checks;
    private static int rejections;
    private static int recoveries;
    private static int snapshots;
    private static int snapshotControls;
    private static final int ROUNDS = 256;
    private static final String PREFIX = "value";

    private record TicketPair(Ticket first, Ticket second) { }

    private static BigInteger n(long value) { return BigInteger.valueOf(value); }
    private static BigInteger huge() { return BigInteger.ONE.shiftLeft(100); }
    private static Span span(long lo, long hi) { return new Span(n(lo), n(hi)); }
    private static Ticket ticket(long lo, long hi, long word) {
        return new Ticket(span(lo, hi), n(word));
    }
    private static Ticket bigTicket(BigInteger value, long offset) {
        return new Ticket(new Span(value, value), value.add(n(offset)));
    }
    private static Stamped stamped(long lo, long hi, long word, long mark) {
        return new Stamped(ticket(lo, hi, word), n(mark));
    }
    private static Stamped bigStamped(BigInteger value) {
        return new Stamped(bigTicket(value, 1), BigInteger.ZERO);
    }

    private static String snapNat(BigInteger value) { return "Nat(" + value + ")"; }
    private static String snapSpan(Span value) {
        return "Span(" + snapNat(value.lo()) + "," + snapNat(value.hi()) + ")";
    }
    private static String snapTicket(Ticket value) {
        return "Ticket(" + snapSpan(value.toSpan()) + "," + snapNat(value.word()) + ")";
    }
    private static String snapStamped(Stamped value) {
        return "Stamped(" + snapTicket(value.toTicket()) + "," + snapNat(value.mark()) + ")";
    }
    private static String snapPair(TicketPair value) {
        return "Tuple(" + snapTicket(value.first()) + "," + snapTicket(value.second()) + ")";
    }

    private static void check(boolean condition, String label) {
        if (!condition) throw new IllegalStateException("failed: " + label);
        checks++;
    }

    private static void unchanged(String before, String after) {
        snapshots++;
        check(before.equals(after), "complete caller inputs unchanged");
    }

    private static <I, O> O call(I input, Function<I, O> invoke,
        Function<I, String> inputSnapshot, Function<O, String> outputSnapshot,
        String expected) {
        String before = inputSnapshot.apply(input);
        O output = invoke.apply(input);
        check(outputSnapshot.apply(output).equals(expected), "exact independent result");
        unchanged(before, inputSnapshot.apply(input));
        return output;
    }


    private static void distinct(String left, String right) {
        check(!left.equals(right), "independent snapshot mutation control");
        snapshotControls++;
    }

    public static void main(String[] arguments) {
        if (arguments.length != 0) throw new IllegalStateException("Unexpected caller arguments");
        run();
        System.out.println("{\"checks\":" + checks + ",\"rejections\":" + rejections
            + ",\"recoveries\":" + recoveries + ",\"snapshots\":" + snapshots
            + ",\"snapshotControls\":" + snapshotControls + ",\"rounds\":" + ROUNDS + "}");
    }

    private static void run() {
        distinct(snapTicket(ticket(0, 0, 1)), snapTicket(ticket(0, 0, 2)));
        distinct(snapTicket(ticket(0, 0, 1)), snapTicket(ticket(0, 1, 1)));
        distinct(snapStamped(stamped(0, 0, 1, 0)), snapStamped(stamped(0, 0, 1, 1)));
        distinct(snapNat(BigInteger.ZERO), snapNat(huge()));
        distinct(snapSpan(span(0, 1)), snapTicket(ticket(0, 1, 1)));
        distinct(snapTicket(ticket(0, 1, 1)), snapStamped(stamped(0, 1, 1, 0)));

        BigInteger zero = BigInteger.ZERO;
        call(zero, Api::produce, Consumer::snapNat, Consumer::snapTicket,
            snapTicket(ticket(0, 0, 1)));
        call(zero, Api::produceStamped, Consumer::snapNat, Consumer::snapStamped,
            snapStamped(stamped(0, 0, 1, 0)));
        for (int round = 0; round < ROUNDS; round++) {
            BigInteger value = huge().add(n(round));
            Ticket produced = call(value, Api::produce, Consumer::snapNat,
                Consumer::snapTicket, snapTicket(bigTicket(value, 1)));
            Stamped marked = call(value, Api::produceStamped, Consumer::snapNat,
                Consumer::snapStamped, snapStamped(bigStamped(value)));
            check(produced != marked.toTicket(), "returned tickets own independent managed storage");
            check(produced.toSpan() != marked.toTicket().toSpan(),
                "returned inherited fields own independent managed storage");
        }
    }

}
