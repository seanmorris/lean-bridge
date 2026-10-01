package org.leanbridge.owned_aggregates;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import static java.lang.foreign.ValueLayout.JAVA_LONG;

@SuppressWarnings("try")
public final class UnanchoredReceiverProbe {
    static _OwnedBindings bindings;
    static int checks;
    static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message); checks++;
    }
    static void expired(Runnable call) {
        try { call.run(); }
        catch (LeanBridgeException error) { check(error.status() == 4, "expired callback member"); return; }
        throw new AssertionError("Expected expired callback member");
    }
    private static long count(MethodHandle fn) {
        try { return (long)fn.invokeExact(); } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    private static Bundle bundle(Ticket ticket) {
        return new Bundle(ticket, Option.none(), new Ticket[0], new Ticket[0], new Payload(BigInteger.ONE, new byte[0]));
    }
    private static void closeRaw(Bundle value) {
        value.primary().close();
        if (value.spare().isSome()) value.spare().value().close();
        for (var ticket : value.peers()) ticket.close();
        for (var ticket : value.history()) ticket.close();
    }
    private static void javaCalls() {
        Ticket[] escaped = new Ticket[1];
        try (TicketValue seed = Api.newTicket(BigInteger.valueOf(42), "unanchored");
             BundleValue record = Api.copyEchoRecordResult(bundle(seed.get()));
             BundleValue response = record.callbackRecord(incoming -> {
                 escaped[0] = incoming.primary();
                 check(escaped[0].getSerial().intValueExact() == 42, "raw callback member"); return incoming;
             });
             var closure = record.makeRecord();
             BundleValue reply = closure.get().invoke(false, bundle(seed.get()));
             TicketValue primary = reply.getPrimary()) {
            check(escaped[0].isClosed(), "callback argument expires"); expired(escaped[0]::getSerial);
            check(primary.getSerial().intValueExact() == 42, "closure invokes with nominal result");
            var rawReply = closure.get().asCallback().invoke(false, bundle(seed.get()));
            check(rawReply.primary().getSerial().intValueExact() == 42, "native callback preserves raw reply signature");
            closeRaw(rawReply);
            seed.close(); record.close();
            check(!response.isClosed() && response.get().primary().getSerial().intValueExact() == 42, "callback result is independently owned");
            check(!closure.isClosed() && !reply.isClosed() && primary.getSerial().intValueExact() == 42, "unanchored closure and reply survive");
            try (BundleValue repeated = closure.get().invoke(false, response.get())) {
                check(repeated.get().primary().getSerial().intValueExact() == 42, "retained closure environment");
            }
        }
        escaped[0].close();
    }
    public static void main(String[] args) {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library); var linker = Linker.nativeLinker();
            var live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            var identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            bindings = new _OwnedBindings(symbols, () -> { });
            var state = bindings.runtime.current(); state.require(); long baseline = count(live);
            javaCalls(); int javaChecks = checks;
            check(count(live) == baseline && count(identities) == 1, "Java cleanup");
            int before = checks; KotlinUnanchoredReceiverProbe.INSTANCE.run(); int kotlinChecks = checks - before;
            check(count(live) == baseline && count(identities) == 1, "Kotlin cleanup");
            state.close(); check(count(live) == 0 && count(identities) == 0, "zero owners after shutdown");
            System.out.println("{\"javaChecks\":" + javaChecks + ",\"kotlinChecks\":" + kotlinChecks + ",\"live\":" + count(live) + ",\"identities\":" + count(identities) + "}");
        }
    }
}
