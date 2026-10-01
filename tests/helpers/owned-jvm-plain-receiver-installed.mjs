/**
 * Public resource-only receiver clients, with no callback or result-anchor API.
 *
 * @file
 */
import assert from "node:assert/strict";
import { ownedJvmPlainReceiverProbe, ownedKotlinPlainReceiverProbe } from "./owned-jvm-receiver-fixture.mjs";

/**
 * Strip private native counters while preserving all public member assertions.
 *
 * @param namespace - Generated package namespace.
 * @param consuming - Include a consuming receiver method.
 */
export const ownedJvmPlainReceiverInstalledFixture = (namespace, consuming) => {
	const original = ownedJvmPlainReceiverProbe(consuming);
	const first = "    private static void javaCalls()", last = "    public static void main(String[] args)";
	assert.equal(original.split(first).length, 2); assert.equal(original.split(last).length, 2);
	const body = original.slice(original.indexOf(first), original.indexOf(last));
	const signatures = profile => profile === "java" ? `
        Wire.method(Api.class, "newTicket", TicketValue.class, BigInteger.class, String.class);
        Wire.method(Api.class, "serial", BigInteger.class, Ticket.class);
        Wire.method(Api.class, "retainTicket", TicketValue.class, Ticket.class);
        Wire.method(Api.class, "pingTicket", void.class, Ticket.class);
        PlainReceiverSupport.member(TicketValue.class, "getSerial", BigInteger.class);
        PlainReceiverSupport.member(Ticket.class, "getSerial", BigInteger.class);
        PlainReceiverSupport.member(TicketValue.class, "getPingTicket", Unit.class);
        PlainReceiverSupport.member(Ticket.class, "getPingTicket", Unit.class);
        PlainReceiverSupport.member(TicketValue.class, "retainTicket", TicketValue.class);
        PlainReceiverSupport.member(Ticket.class, "retainTicket", TicketValue.class);
        ${consuming ? `Wire.method(Api.class, "transferTicket", TicketValue.class, Value.class);
        PlainReceiverSupport.member(TicketValue.class, "transferTicket", TicketValue.class);` : ""}
` : `
    Wire.method(KotlinApi::class.java, "newTicket", KotlinTicketValue::class.java, java.math.BigInteger::class.java, String::class.java)
    Wire.method(KotlinApi::class.java, "serial", java.math.BigInteger::class.java, KotlinTicket::class.java)
    Wire.method(KotlinApi::class.java, "retainTicket", KotlinTicketValue::class.java, KotlinTicket::class.java)
    Wire.method(KotlinApi::class.java, "pingTicket", java.lang.Void.TYPE, KotlinTicket::class.java)
    PlainReceiverSupport.member(KotlinTicketValue::class.java, "getSerial", java.math.BigInteger::class.java)
    PlainReceiverSupport.member(KotlinTicket::class.java, "getSerial", java.math.BigInteger::class.java)
    PlainReceiverSupport.member(KotlinTicketValue::class.java, "getPingTicket", Unit::class.java)
    PlainReceiverSupport.member(KotlinTicket::class.java, "getPingTicket", Unit::class.java)
    PlainReceiverSupport.member(KotlinTicketValue::class.java, "retainTicket", KotlinTicketValue::class.java)
    PlainReceiverSupport.member(KotlinTicket::class.java, "retainTicket", KotlinTicketValue::class.java)
    ${consuming ? `Wire.method(KotlinApi::class.java, "transferTicket", KotlinTicketValue::class.java, Value::class.java)
    PlainReceiverSupport.member(KotlinTicketValue::class.java, "transferTicket", KotlinTicketValue::class.java)` : ""}
`;
	const support = `import ${namespace}.LeanBridgeException;
public final class PlainReceiverSupport {
    private PlainReceiverSupport() { }
    private static int checks;
    public static void member(Class<?> owner, String name, Class<?> result, Class<?>... parameters) throws Exception {
        var method = owner.getDeclaredMethod(name, parameters);
        if (!java.lang.reflect.Modifier.isPublic(method.getModifiers())
                || java.lang.reflect.Modifier.isStatic(method.getModifiers())
                || method.getReturnType() != result || method.getTypeParameters().length != 0)
            throw new AssertionError("Invalid public instance signature: " + method);
    }
    public static int checks() { return checks; }
    public static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message); checks++;
    }
    public static void expired(Runnable call) {
        try { call.run(); }
        catch (LeanBridgeException error) { check(error.status() == 4, "expired member status"); return; }
        throw new AssertionError("Expected expired receiver");
    }
}
`;
	const java = `import ${namespace}.*;
import java.math.BigInteger;
@SuppressWarnings("try")
public final class Consumer {
    private static void check(boolean value, String message) { PlainReceiverSupport.check(value, message); }
    private static void expired(Runnable call) { PlainReceiverSupport.expired(call); }
${body}
    public static void main(String[] args) throws Exception {
${signatures("java")}
        if (args.length == 1 && args[0].equals("--signatures")) return;
        javaCalls();
        Wire.result("owned/checks", Wire.integer(PlainReceiverSupport.checks()), true);
        Wire.finish("java", "${namespace}", System.getProperty("java.version"), Api.class);
    }
}
`;
	const kotlin = ownedKotlinPlainReceiverProbe(consuming)
		.replace(`package ${namespace}`, `import ${namespace}.Value\nimport ${namespace}.Unit`)
		.replaceAll("PlainReceiverProbe.", "PlainReceiverSupport.") + `
fun main(args: Array<String>) {
${signatures("kotlin")}
    if (args.size == 1 && args[0] == "--signatures") return
    KotlinPlainReceiverProbe.run()
    Wire.result("owned/checks", Wire.integer(PlainReceiverSupport.checks()), true)
    Wire.finish("kotlin", "${namespace}", KotlinVersion.CURRENT.toString(), KotlinApi::class.java)
}
`;
	for(const source of [java, kotlin]) assert.doesNotMatch(source, /_Owned|\.foreign\b|SymbolLookup/u);
	return { packageKind: "lean-bridge-owned-maven-package"
		, removeHandoffBeforeExecution: true
		, source: profile => profile === "java" ? java : kotlin
		, signatures, rejections: () => []
		, javaSupport: { "PlainReceiverSupport.java": support } };
};
