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
    private static final String PREFIX = "arg";

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

    private static <I> void refuse(I input, Function<I, ?> invoke,
        Function<I, String> snapshot, String expected) {
        String before = snapshot.apply(input);
        try {
            invoke.apply(input);
            throw new IllegalStateException("accepted invalid checked record: " + expected);
        } catch (IllegalArgumentException error) {
            check(error.getClass() == IllegalArgumentException.class
                && error.getMessage().equals(expected),
                "exact checked-record rejection: " + error);
        }
        unchanged(before, snapshot.apply(input));
        rejections++;
    }

    private static String rejected(String path, String constructor) {
        return PREFIX + path + " was rejected by InheritedCheckedRecords." + constructor;
    }
    private static String fin(String path) {
        return PREFIX + path + ".mark is not below its Fin 8 bound";
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
        distinct(snapTicket(ticket(1, 2, 3)), snapTicket(ticket(2, 2, 3)));
        distinct(snapStamped(stamped(1, 2, 3, 0)), snapStamped(stamped(1, 2, 3, 7)));

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
        full();
    }

    private static void full() {
        call(ticket(2, 3, 4), Api::first, Consumer::snapTicket, Consumer::snapNat,
            snapNat(n(9)));
        call(ticket(4, 1, 0), Api::normalized, Consumer::snapTicket, Consumer::snapNat,
            snapNat(n(11)));
        TicketPair pair = new TicketPair(ticket(2, 3, 4), ticket(4, 1, 999));
        call(pair, value -> Api.pair(value.first(), value.second()), Consumer::snapPair,
            Consumer::snapNat, snapNat(n(10)));
        call(ticket(4, 1, 4), Api::aliased, Consumer::snapTicket, Consumer::snapNat,
            snapNat(n(5)));
        call(stamped(1, 2, 4, 3), Api::nested, Consumer::snapStamped, Consumer::snapNat,
            snapNat(n(7)));
        call(ticket(1, 2, 0), Api::echo, Consumer::snapTicket, Consumer::snapTicket,
            snapTicket(ticket(1, 2, 3)));

        Ticket invalidTicket = ticket(4, 1, 5);
        refuse(invalidTicket, Api::first, Consumer::snapTicket,
            rejected("0.toSpan", "mkSpan"));
        invalidTicket = ticket(1, 2, 0);
        refuse(invalidTicket, Api::first, Consumer::snapTicket,
            rejected("0.word", "mkWord"));
        invalidTicket = ticket(1, 5, 3);
        refuse(invalidTicket, Api::first, Consumer::snapTicket,
            rejected("0", "mkTicket"));
        Stamped invalidStamped = stamped(1, 2, 9, 8);
        refuse(invalidStamped, Api::nested, Consumer::snapStamped,
            fin("0"));
        invalidStamped = stamped(1, 2, 4, 5);
        refuse(invalidStamped, Api::nested, Consumer::snapStamped,
            rejected("0", "mkStamped"));
        invalidTicket = ticket(1, 5, 3);
        refuse(invalidTicket, Api::aliased, Consumer::snapTicket,
            rejected("0", "mkTicket"));

        for (int round = 0; round < ROUNDS; round++) {
            BigInteger value = n(round + 10L);
            Ticket valid = ticket(round + 10L, round + 11L, round + 12L);
            call(valid, Api::first, Consumer::snapTicket, Consumer::snapNat,
                snapNat(value.multiply(n(3)).add(n(3))));
            call(ticket(round + 12L, round + 10L, 0), Api::normalized,
                Consumer::snapTicket, Consumer::snapNat,
                snapNat(value.multiply(n(4)).add(n(5))));
            pair = new TicketPair(valid, ticket(round + 12L, round + 10L, 0));
            call(pair, item -> Api.pair(item.first(), item.second()), Consumer::snapPair,
                Consumer::snapNat, snapNat(value.multiply(n(3)).add(n(5))));
            call(ticket(round + 12L, round + 10L, 2L * round + 21L), Api::aliased,
                Consumer::snapTicket, Consumer::snapNat,
                snapNat(value.multiply(n(2)).add(n(2))));
            int mark = round % 8;
            call(stamped(mark, mark, mark + 1L, mark), Api::nested,
                Consumer::snapStamped, Consumer::snapNat, snapNat(n(2L * mark + 1L)));

            invalidTicket = ticket(round + 11L, round + 10L, round + 12L);
            refuse(invalidTicket, Api::first, Consumer::snapTicket,
                rejected("0.toSpan", "mkSpan"));
            invalidTicket = ticket(0, 1, 0);
            refuse(invalidTicket, Api::first, Consumer::snapTicket,
                rejected("0.word", "mkWord"));
            invalidTicket = ticket(0, round + 12L, round + 11L);
            refuse(invalidTicket, Api::first, Consumer::snapTicket,
                rejected("0", "mkTicket"));
            invalidStamped = stamped(0, 9, 9, 8);
            refuse(invalidStamped, Api::nested, Consumer::snapStamped,
                fin("0"));
            invalidStamped = stamped(0, 6, 6, 7);
            refuse(invalidStamped, Api::nested, Consumer::snapStamped,
                rejected("0", "mkStamped"));
            call(valid, Api::first, Consumer::snapTicket, Consumer::snapNat,
                snapNat(value.multiply(n(3)).add(n(3))));
            recoveries++;
        }
    }
}
