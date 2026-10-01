/**
 * Resource-only Java and Kotlin member callers, independent of callback support.
 *
 * @file
 */
import { ownedReceiverConfiguration, ownedReceiverSource } from "./owned-receiver-fixture.mjs";
import { ownedRustPlainReceiverReviewedIr } from "./owned-rust-receiver-fixture.mjs";

export const ownedJvmPlainReceiverSource = ownedReceiverSource + `
namespace Owned
def pingTicket (_value : Ticket) : Unit := ()
end Owned
`;

/**
 * Reviewed packages keep export decisions in IR, not the author configuration.
 *
 * @param consuming - Include an original-owner consuming method.
 * @param reviewed - Select source roots only for an independent review.
 */
export const ownedJvmPlainReceiverConfiguration = async (consuming, reviewed) => {
	if(reviewed) return { schemaVersion: 1, modules: ["Owned"] };
	const config = await ownedReceiverConfiguration();
	config.exports = ["newTicket", "serial", "retainTicket", "pingTicket", ...consuming ? ["transferTicket"] : []].map(name => "Owned." + name);
	config.arities = {};
	const transfer = config.contracts["Owned.transferTicket"];
	config.contracts = { "Owned.serial": { receiver: "property" }
		, "Owned.pingTicket": { receiver: "property" }
		, "Owned.retainTicket": { receiver: "method" }
		, ...consuming ? { "Owned.transferTicket": transfer } : {} };
	return config;
};

/**
 * Include Unit properties without enabling result anchors or host callbacks.
 *
 * @param consuming - Include an original-owner consuming method.
 */
export const ownedJvmPlainReceiverReviewedIr = consuming => {
	const ir = ownedRustPlainReceiverReviewedIr(consuming);
	const property = structuredClone(ir.declarations.find(fn => fn.name === "serial"));
	property.id = "lean:Owned.pingTicket"; property.name = "pingTicket";
	property.overloadKey = "Owned.pingTicket"; property.source.declaration = "Owned.pingTicket";
	property.result.type = { kind: "primitive", name: "unit" };
	ir.declarations.push(property); return ir;
};

/**
 * Use generated public static functions and instance members in Java.
 *
 * @param consuming - Include the optional consuming member assertions.
 */
export const ownedJvmPlainReceiverProbe = consuming => `package org.leanbridge.owned_aggregates;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import static java.lang.foreign.ValueLayout.JAVA_LONG;

@SuppressWarnings("try")
public final class PlainReceiverProbe {
    static int checks;
    static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message); checks++;
    }
    static void expired(Runnable call) {
        try { call.run(); }
        catch (LeanBridgeException error) { check(error.status() == 4, "expired member status"); return; }
        throw new AssertionError("Expected expired receiver");
    }
    private static long count(MethodHandle fn) {
        try { return (long)fn.invokeExact(); } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    private static void javaCalls() {
        try (TicketValue root = Api.newTicket(BigInteger.valueOf(42), "plain");
             TicketValue alias = root.share();
             TicketValue independent = root.retainTicket();
             TicketValue rawIndependent = root.get().retainTicket()) {
            var raw = root.get(); var copied = root.getSerial();
            check(copied.equals(BigInteger.valueOf(42)) && raw.getSerial().equals(copied), "raw and whole getters");
            check(alias.getSerial().equals(copied), "shared receiver property");
            check(root.getPingTicket() == Unit.INSTANCE && raw.getPingTicket() == Unit.INSTANCE, "Unit property");
            root.close(); check(root.isClosed() && !alias.isClosed(), "share owns original result");
            expired(root::getSerial);
            alias.close(); check(raw.isClosed() && independent.getSerial().equals(copied), "raw view expires");
            expired(raw::getSerial);
            check(rawIndependent.getSerial().equals(copied), "raw retaining member is independent");
            Value<Ticket> erased = independent;
            try (var share = erased.share(); var retained = erased.retain()) {
                check(share instanceof TicketValue && retained instanceof TicketValue, "covariant owners through base");
                ${consuming ? `try (TicketValue moved = independent.transferTicket()) {
                    check(independent.isClosed() && share.isClosed(), "consume original owner");
                    check(moved.getSerial().equals(copied), "typed consuming result");
                    check(((TicketValue)retained).getSerial().equals(copied), "retained owner survives consume");
                }` : `independent.close();
                check(!share.isClosed() && ((TicketValue)share).getSerial().equals(copied), "shared nominal owner survives close");`}
            }
            check(copied.equals(BigInteger.valueOf(42)), "copied result survives close");
        }
    }
    public static void main(String[] args) {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library);
            var linker = Linker.nativeLinker();
            var live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            var identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            _OwnedLoader.loaded = new _OwnedBindings(symbols, () -> { });
            check(count(live) == 0 && count(identities) == 0, "native baseline");
            var state = _OwnedLoader.loaded.runtime.current(); state.require();
            long baseline = count(live);
            int start = checks; javaCalls(); int javaChecks = checks - start;
            check(count(live) == baseline && count(identities) == 1, "Java owners released: " + count(live) + "/" + baseline + ", identities=" + count(identities));
            start = checks; KotlinPlainReceiverProbe.INSTANCE.run(); int kotlinChecks = checks - start;
            check(count(live) == baseline && count(identities) == 1, "Kotlin owners released: " + count(live) + "/" + baseline + ", identities=" + count(identities));
            state.close(); check(count(live) == 0 && count(identities) == 0, "runtime closed");
            System.out.println("{\\"javaChecks\\":" + javaChecks + ",\\"kotlinChecks\\":" + kotlinChecks
                + ",\\"live\\":" + count(live) + ",\\"identities\\":" + count(identities) + "}");
        }
    }
}
`;

/**
 * Compile real Kotlin property syntax and separate Kotlin resource classes.
 *
 * @param consuming - Include the optional consuming member assertions.
 */
export const ownedKotlinPlainReceiverProbe = consuming => `package org.leanbridge.owned_aggregates

import org.leanbridge.owned_aggregates.kotlin.Api as KotlinApi
import org.leanbridge.owned_aggregates.kotlin.Ticket as KotlinTicket
import org.leanbridge.owned_aggregates.kotlin.TicketValue as KotlinTicketValue

internal object KotlinPlainReceiverProbe {
    private fun verify(value: Boolean, message: String) = PlainReceiverProbe.check(value, message)
    fun run() {
        KotlinApi.newTicket(java.math.BigInteger.valueOf(42), "plain").use { root ->
            root.share().use { alias ->
                root.retainTicket().use { independent ->
                    root.get().retainTicket().use { rawIndependent ->
                        val raw = root.get(); val copied = root.serial
                        verify(copied == java.math.BigInteger.valueOf(42) && raw.serial == copied, "Kotlin raw and whole properties")
                        verify(alias.serial == copied, "Kotlin shared property")
                        verify(root.pingTicket == Unit.INSTANCE && raw.pingTicket == Unit.INSTANCE, "Kotlin Unit property")
                        root.close(); verify(root.isClosed && !alias.isClosed, "Kotlin shared owner")
                        PlainReceiverProbe.expired { root.serial }
                        alias.close(); verify(raw.isClosed && independent.serial == copied, "Kotlin raw expiration")
                        PlainReceiverProbe.expired { raw.serial }
                        verify(rawIndependent.serial == copied, "Kotlin raw retaining member")
                        val erased: Value<KotlinTicket> = independent
                        erased.share().use { share ->
                            erased.retain().use { retained ->
                                verify(share is KotlinTicketValue && retained is KotlinTicketValue, "Kotlin covariant owners")
                                ${consuming ? `independent.transferTicket().use { moved ->
                                    verify(independent.isClosed && share.isClosed, "Kotlin original-owner transfer")
                                    verify(moved.serial == copied, "Kotlin typed consuming result")
                                    verify((retained as KotlinTicketValue).serial == copied, "Kotlin retain survives consumption")
                                }` : `independent.close()
                                verify(!share.isClosed && (share as KotlinTicketValue).serial == copied, "Kotlin share survives close")`}
                            }
                        }
                        verify(copied == java.math.BigInteger.valueOf(42), "Kotlin copied result survives close")
                    }
                }
            }
        }
    }
}
`;
