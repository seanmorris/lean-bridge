/**
 * Independent public consumers of installed callback-result ownership packages.
 *
 * @file
 */
import assert from "node:assert/strict";

const nativeCallback = "ApplyTwiceArgument1Closure";
const hostCallback = nativeCallback + "Callback";
const signatureCatalog = combined => {
	const owner = type => combined && ["Ticket", "Bundle", "Choice", "Tree"].includes(type) ? type + "Value" : `Value<${type}>`;
	const rows = [
		["newTicket", owner("Ticket"), "BigInteger", "String"]
		, ["serial", "BigInteger", "Ticket"], ["label", "String", "Ticket"]
		, ["retainTicket", owner("Ticket"), "Ticket"]
		, ["bundle", owner("Bundle"), "Ticket", "Option<Ticket>", "Ticket[]", "Ticket[]", "Payload"]
		, ["primary", owner("Ticket"), "Bundle"], ["payload", "Payload", "Bundle"]
		, ...[
			["echoArray", "Ticket[]"]
			, ["echoList", "Ticket[]"]
			, ["echoOption", "Option<Ticket>"]
			, ["echoResult", "Result<Bundle, Ticket>"]
			, ["echoTuple", "Pair<Ticket, Pair<Option<Ticket>, Payload>>"]
			, ["echoRecord", "Bundle"]
			, ["echoVariant", "Choice"]
			, ["echoAlias", "Bundle"]
			, ["echoRow", "Option<Ticket>[]"], ["echoRecursive", "Tree"]
			, ["echoNested", "Option<Result<Bundle, Ticket>>[][]"]
		].map(([name, type]) => [name, owner(type), type])
		, ["callbackRecord", owner("Bundle"), "Bundle", nativeCallback]
		, ["callbackRecursive", owner("Tree"), "Tree", "CallbackRecursiveArgument1Closure"]
		, ["makeRecord", owner("MakeRecordResultClosure"), "Bundle"]
		, ["makeRecursive", owner("MakeRecursiveResultClosure"), "Tree"]
		, ["makeLeasedRecord", owner("MakeLeasedRecordResultClosure"), "Bundle"]
		, ["makeRecordCallback", owner(nativeCallback), "Bundle"]
		, ["makeTreeCallback", owner("CallbackRecursiveArgument1Closure"), "Tree"]
		, ["applyTwice", owner("Bundle"), "Bundle", nativeCallback, nativeCallback]
		, ["dispatch", owner("DispatchResultClosure"), "Bundle"]
	];
	if(combined) rows.push(
		["callbackRecord", owner("Bundle"), "Bundle", hostCallback]
		, ["callbackRecursive", owner("Tree"), "Tree", "CallbackRecursiveArgument1ClosureCallback"]
		, ["borrowRecord", owner("Bundle"), "Value<Bundle>"]
		, ...[nativeCallback, hostCallback].map(callback => ["moveRecord", owner("Bundle"), "Value<Bundle>", callback])
		, ...[[nativeCallback, hostCallback], [hostCallback, nativeCallback], [hostCallback, hostCallback]]
			.map(callbacks => ["applyTwice", owner("Bundle"), "Bundle", ...callbacks])
		, ...[nativeCallback, hostCallback].flatMap(left => [nativeCallback, hostCallback]
			.map(right => ["moveTwice", owner("Bundle"), "Value<Bundle>", left, right]))
	);
	return rows;
};

const erase = type => {
	let depth = 0, result = "";
	for(const char of type)
	{
		if(char === "<") depth++;
		else if(char === ">") depth--;
		else if(!depth) result += char;
	}
	assert.equal(depth, 0); return result;
};
const kotlinType = type => {
	// All array element types in this authored catalog are reference types.
	return type.replace(/(Option<Result<Bundle, Ticket>>|Option<Ticket>|Ticket)\[\](\[\])?/gu
		, (_, element, nested) => nested ? `Array<Array<${element}>>` : `Array<${element}>`);
};
const signaturesFor = (namespace, combined, profile) => {
	const java = profile === "java", catalog = signatureCatalog(combined);
	const literal = type => java ? erase(type) + ".class" : kotlinType(erase(type)) + "::class.java";
	const qualify = type => type.replace(/\b[A-Z][A-Za-z0-9]*/gu, name =>
		(name === "BigInteger" ? "java.math." : name === "String" ? "java.lang." : namespace + ".") + name);
	const lines = [java
		? `Wire.check(java.util.Arrays.stream(Api.class.getDeclaredMethods()).filter(method -> !method.getName().startsWith("copy")).count() == ${catalog.length});`
		: `Wire.check(Api::class.java.declaredMethods.count { !it.name.startsWith("copy") } == ${catalog.length})`];
	for(const [index, [name, result, ...parameters]] of catalog.entries())
	{
		if(java) lines.push(
			`Wire.method(Api.class, "${name}", ${[result, ...parameters].map(literal).join(", ")});`
			, `var method${index} = Api.class.getDeclaredMethod("${name}"${parameters.map(type => ", " + literal(type)).join("")});`
			, `Wire.check(method${index}.getGenericReturnType().getTypeName().equals("${qualify(result)}"));`
			, `Wire.check(java.util.Arrays.equals(java.util.Arrays.stream(method${index}.getGenericParameterTypes()).map(java.lang.reflect.Type::getTypeName).toArray(String[]::new), new String[] {${parameters.map(type => JSON.stringify(qualify(type))).join(", ")}}));`
		);
		else lines.push(`val signature${index}: (${parameters.map(kotlinType).join(", ")}) -> ${kotlinType(result)} = Api::${name}`
			, `Wire.consume(signature${index})`);
	}
	lines.push(java
		? `Wire.check(ApplyTwiceArgument1Closure.class.getDeclaredMethod("invoke", Value.class).getReturnType() == ${combined ? "BundleValue" : "Value"}.class);`
		: `val invokeSignature: (ApplyTwiceArgument1Closure, Value<Bundle>) -> ${combined ? "BundleValue" : "Value<Bundle>"} = ApplyTwiceArgument1Closure::invoke\nWire.consume(invokeSignature)`);
	lines.push(`Wire.result("owned/callback-result-signatures", Wire.integer(${catalog.length + 1}), false)${java ? ";" : ""}`);
	return lines.join("\n");
};

const javaNative = `    private static Bundle bundle(Ticket ticket) {
        return new Bundle(ticket, Option.some(ticket), new Ticket[] { ticket }, new Ticket[0],
            new Payload(BigInteger.valueOf(-17), new byte[] { 0, -1, 3 }));
    }
    private static void nativeCalls(Bundle input) {
        try (var closureOwner = makeRecordCallback(input); var original = echoRecord(input)) {
            var callback = closureOwner.get();
            try (var direct = callbackRecord(input, callback);
                 var twice = applyTwice(input, callback, callback);
                 var dispatchOwner = dispatch(input);
                 var higher = dispatchOwner.get().invoke(callback)) {
                check(serial(direct.get().primary()).intValueExact() == 63, "native callback export");
                check(serial(twice.get().primary()).intValueExact() == 63, "two native callbacks");
                check(serial(higher.get().primary()).intValueExact() == 63, "higher-order native callback");
            }
            try (var borrowed = callback.invoke(original); var alias = borrowed.share();
                 var independent = borrowed.retain(); var copied = copyValue(borrowed.get())) {
                var primary = borrowed.get().primary(); var peer = borrowed.get().peers()[0];
                var spare = borrowed.get().spare().value();
                check(!primary.isClosed() && !peer.isClosed() && !spare.isClosed(), "live nested borrowed tickets");
                original.close();
                check(borrowed.isClosed() && alias.isClosed(), "original argument expires reply and share");
                check(primary.isClosed() && peer.isClosed() && spare.isClosed(), "transitive descendant expiry");
                closed(borrowed::get); closed(alias::get); closed(() -> serial(primary));
                check(serial(independent.get().primary()).intValueExact() == 63, "retained whole reply is independent");
                check(serial(copied.get().primary()).intValueExact() == 63, "copied raw reply is independent");
            }
            check(!callback.isClosed(), "argument expiry does not close callback owner");
        }
        try (var closureOwner = makeRecord(input); var argument = echoRecord(input);
             var borrowed = closureOwner.get().invoke(false, argument); var independent = borrowed.retain()) {
            argument.close();
            check(borrowed.isClosed(), "second callback parameter anchors bool-plus-record reply");
            check(serial(independent.get().primary()).intValueExact() == 63, "second-parameter retain independence");
        }
        Tree tree = new TreeBranch(new Tree[] { new TreeLeaf(input.primary()), new TreeBranch(new Tree[0]) });
        try (var closureOwner = makeTreeCallback(tree); var original = echoRecursive(tree);
             var direct = callbackRecursive(tree, closureOwner.get());
             var borrowed = closureOwner.get().invoke(original); var retained = borrowed.retain()) {
            var ticket = ((TreeLeaf)((TreeBranch)borrowed.get()).children()[0]).ticket();
            check(direct.get() instanceof TreeBranch, "recursive native export");
            original.close();
            check(borrowed.isClosed() && ticket.isClosed(), "recursive descendant expires with original argument");
            closed(borrowed::get);
            check(retained.get() instanceof TreeBranch, "recursive retain survives");
        }
        Tree empty = new TreeBranch(new Tree[0]);
        try (var closureOwner = makeTreeCallback(empty); var original = echoRecursive(empty);
             var borrowed = closureOwner.get().invoke(original); var retained = borrowed.retain()) {
            check(((TreeBranch)borrowed.get()).children().length == 0, "empty callback reply before expiry");
            original.close();
            check(borrowed.isClosed(), "empty callback reply preserves original owner");
            closed(borrowed::get);
            check(((TreeBranch)retained.get()).children().length == 0, "retained empty reply is independent");
        }
    }
`;

const javaHost = `    private static void hostCalls(Bundle input) {
        var escaped = new Ticket[1];
        ApplyTwiceArgument1ClosureCallback raw = value -> { escaped[0] = value.primary(); return CallbackResult.value(value); };
        try (var result = callbackRecord(input, raw)) {
            check(escaped[0].isClosed(), "host callback argument expires");
            check(serial(result.get().primary()).intValueExact() == 63, "raw host reply copied before frame expiry");
        }
        try (var replyOwner = echoRecord(input);
             var result = callbackRecord(input, (ApplyTwiceArgument1ClosureCallback)ignored -> CallbackResult.owner(replyOwner))) {
            replyOwner.close();
            check(serial(result.get().primary()).intValueExact() == 63, "whole host reply survives reply owner");
        }
        try (var nativeOwner = makeRecordCallback(input); var dispatcher = dispatch(input)) {
            var nativeClosure = nativeOwner.get();
            try (var left = applyTwice(input, nativeClosure, raw); var right = applyTwice(input, raw, nativeClosure);
                 var both = applyTwice(input, raw, raw); var higher = dispatcher.get().invoke(raw)) {
                for (var result : java.util.List.of(left, right, both, higher))
                    check(serial(result.get().primary()).intValueExact() == 63, "mixed and higher-order host replies");
            }
            for (int mode = 0; mode < 4; ++mode) {
                try (var receiver = echoRecord(input); var alias = receiver.share(); var borrowed = receiver.borrowRecord();
                     var retained = receiver.retain(); var result = switch (mode) {
                         case 0 -> receiver.moveTwice(raw, raw);
                         case 1 -> receiver.moveTwice(nativeClosure, raw);
                         case 2 -> receiver.moveTwice(raw, nativeClosure);
                         default -> receiver.moveTwice(nativeClosure, nativeClosure);
                     }) {
                    check(receiver.isClosed() && alias.isClosed() && borrowed.isClosed(), "mixed receiver transfer closes aliases and views");
                    check(serial(result.get().primary()).intValueExact() == 63, "consuming mixed result");
                    check(serial(retained.get().primary()).intValueExact() == 63, "receiver retain survives transfer");
                }
            }
            try (var replyOwner = echoRecord(input); var receiver = echoRecord(input);
                 var result = receiver.moveRecord((ApplyTwiceArgument1ClosureCallback)ignored -> CallbackResult.owner(replyOwner))) {
                replyOwner.close();
                check(receiver.isClosed() && serial(result.get().primary()).intValueExact() == 63, "consuming whole host reply");
            }
            try (var receiver = echoRecord(input); var result = receiver.moveRecord(nativeClosure)) {
                check(receiver.isClosed() && serial(result.get().primary()).intValueExact() == 63, "consuming native callback reply");
            }
            var expected = new IllegalStateException("same installed callback exception");
            check(Wire.reject(IllegalStateException.class, () -> callbackRecord(input,
                (ApplyTwiceArgument1ClosureCallback)ignored -> { throw expected; })) == expected, "host exception identity");
            try (var receiver = echoRecord(input); var alias = receiver.share(); var retained = receiver.retain()) {
                check(Wire.reject(IllegalStateException.class, () -> receiver.moveTwice(raw,
                    (ApplyTwiceArgument1ClosureCallback)ignored -> { throw expected; })) == expected, "post-handoff exception identity");
                check(receiver.isClosed() && alias.isClosed(), "post-handoff failure consumes receiver");
                check(serial(retained.get().primary()).intValueExact() == 63, "post-handoff retain survives");
            }
        }
    }
`;

const kotlinNative = `private fun bundle(ticket: Ticket) = Bundle(ticket, Option.some(ticket), arrayOf(ticket), emptyArray(),
    Payload(BigInteger.valueOf(-17), byteArrayOf(0, -1, 3)))

private fun nativeCalls(input: Bundle) {
    Api.makeRecordCallback(input).use { closureOwner ->
        Api.echoRecord(input).use { original ->
            val callback = closureOwner.get()
            Api.callbackRecord(input, callback).use { check(Api.serial(it.get().primary).intValueExact() == 63, "native export") }
            Api.applyTwice(input, callback, callback).use { check(Api.serial(it.get().primary).intValueExact() == 63, "two native callbacks") }
            Api.dispatch(input).use { dispatcher ->
                dispatcher.get().invoke(callback).use { check(Api.serial(it.get().primary).intValueExact() == 63, "higher-order native callback") }
            }
            callback.invoke(original).use { borrowed ->
                borrowed.share().use { alias ->
                    borrowed.retain().use { independent ->
                        Api.copyValue(borrowed.get()).use { copied ->
                            val primary = borrowed.get().primary
                            val peer = borrowed.get().peers[0]
                            val spare = borrowed.get().spare.value()
                            check(!primary.isClosed && !peer.isClosed && !spare.isClosed, "live nested borrowed tickets")
                            original.close()
                            check(borrowed.isClosed && alias.isClosed, "original argument expires reply and share")
                            check(primary.isClosed && peer.isClosed && spare.isClosed, "transitive descendant expiry")
                            closed { borrowed.get() }; closed { alias.get() }; closed { Api.serial(primary) }
                            check(Api.serial(independent.get().primary).intValueExact() == 63, "retained whole reply is independent")
                            check(Api.serial(copied.get().primary).intValueExact() == 63, "copied raw reply is independent")
                        }
                    }
                }
            }
            check(!callback.isClosed, "argument expiry does not close callback owner")
        }
    }
    Api.makeRecord(input).use { closureOwner ->
        Api.echoRecord(input).use { argument ->
            closureOwner.get().invoke(false, argument).use { borrowed ->
                borrowed.retain().use { independent ->
                    argument.close()
                    check(borrowed.isClosed, "second callback parameter anchors bool-plus-record reply")
                    check(Api.serial(independent.get().primary).intValueExact() == 63, "second-parameter retain independence")
                }
            }
        }
    }
    val tree: Tree = TreeBranch(arrayOf(TreeLeaf(input.primary), TreeBranch(emptyArray())))
    Api.makeTreeCallback(tree).use { closureOwner ->
        Api.echoRecursive(tree).use { original ->
            Api.callbackRecursive(tree, closureOwner.get()).use { check(it.get() is TreeBranch, "recursive native export") }
            closureOwner.get().invoke(original).use { borrowed ->
                borrowed.retain().use { retained ->
                    val ticket = ((borrowed.get() as TreeBranch).children[0] as TreeLeaf).ticket
                    original.close()
                    check(borrowed.isClosed && ticket.isClosed, "recursive descendant expires with original argument")
                    closed { borrowed.get() }
                    check(retained.get() is TreeBranch, "recursive retain survives")
                }
            }
        }
    }
    val empty: Tree = TreeBranch(emptyArray())
    Api.makeTreeCallback(empty).use { closureOwner ->
        Api.echoRecursive(empty).use { original ->
            closureOwner.get().invoke(original).use { borrowed ->
                borrowed.retain().use { retained ->
                    check((borrowed.get() as TreeBranch).children.isEmpty(), "empty callback reply before expiry")
                    original.close()
                    check(borrowed.isClosed, "empty callback reply preserves original owner")
                    closed { borrowed.get() }
                    check((retained.get() as TreeBranch).children.isEmpty(), "retained empty reply is independent")
                }
            }
        }
    }
}
`;

const kotlinHost = `private fun hostCalls(input: Bundle) {
    var escaped: Ticket? = null
    val raw = ApplyTwiceArgument1ClosureCallback { escaped = it.primary; CallbackResult.value(it) }
    Api.callbackRecord(input, raw).use {
        check(escaped!!.isClosed, "host callback argument expires")
        check(Api.serial(it.get().primary).intValueExact() == 63, "raw host reply copied before frame expiry")
    }
    Api.echoRecord(input).use { replyOwner ->
        Api.callbackRecord(input, ApplyTwiceArgument1ClosureCallback { CallbackResult.owner(replyOwner) }).use {
            replyOwner.close()
            check(Api.serial(it.get().primary).intValueExact() == 63, "whole host reply survives reply owner")
        }
    }
    Api.makeRecordCallback(input).use { nativeOwner ->
        val nativeClosure = nativeOwner.get()
        Api.applyTwice(input, nativeClosure, raw).use { check(Api.serial(it.get().primary).intValueExact() == 63, "native/host result") }
        Api.applyTwice(input, raw, nativeClosure).use { check(Api.serial(it.get().primary).intValueExact() == 63, "host/native result") }
        Api.applyTwice(input, raw, raw).use { check(Api.serial(it.get().primary).intValueExact() == 63, "host/host result") }
        Api.dispatch(input).use { dispatcher ->
            dispatcher.get().invoke(raw).use { check(Api.serial(it.get().primary).intValueExact() == 63, "higher-order host result") }
        }
        for (mode in 0 until 4) {
            Api.echoRecord(input).use { receiver ->
                receiver.share().use { alias ->
                    receiver.borrowRecord().use { borrowed ->
                        receiver.retain().use { retained ->
                            val result = when (mode) {
                                0 -> receiver.moveTwice(raw, raw)
                                1 -> receiver.moveTwice(nativeClosure, raw)
                                2 -> receiver.moveTwice(raw, nativeClosure)
                                else -> receiver.moveTwice(nativeClosure, nativeClosure)
                            }
                            result.use {
                                check(receiver.isClosed && alias.isClosed && borrowed.isClosed, "mixed receiver transfer closes aliases and views")
                                check(Api.serial(it.get().primary).intValueExact() == 63, "consuming mixed result")
                                check(Api.serial(retained.get().primary).intValueExact() == 63, "receiver retain survives transfer")
                            }
                        }
                    }
                }
            }
        }
        Api.echoRecord(input).use { replyOwner ->
            Api.echoRecord(input).use { receiver ->
                receiver.moveRecord(ApplyTwiceArgument1ClosureCallback { CallbackResult.owner(replyOwner) }).use {
                    replyOwner.close()
                    check(receiver.isClosed && Api.serial(it.get().primary).intValueExact() == 63, "consuming whole host reply")
                }
            }
        }
        Api.echoRecord(input).use { receiver ->
            receiver.moveRecord(nativeClosure).use {
                check(receiver.isClosed && Api.serial(it.get().primary).intValueExact() == 63, "consuming native callback reply")
            }
        }
        val expected = IllegalStateException("same installed callback exception")
        check(Wire.reject(IllegalStateException::class.java) {
            Api.callbackRecord(input, ApplyTwiceArgument1ClosureCallback { throw expected })
        } === expected, "host exception identity")
        Api.echoRecord(input).use { receiver ->
            receiver.share().use { alias ->
                receiver.retain().use { retained ->
                    check(Wire.reject(IllegalStateException::class.java) {
                        receiver.moveTwice(raw, ApplyTwiceArgument1ClosureCallback { throw expected })
                    } === expected, "post-handoff exception identity")
                    check(receiver.isClosed && alias.isClosed, "post-handoff failure consumes receiver")
                    check(Api.serial(retained.get().primary).intValueExact() == 63, "post-handoff retain survives")
                }
            }
        }
    }
}
`;

/**
 * Prepare callers that require only the public classes in the installed JAR.
 *
 * @param namespace - Compiled package namespace.
 * @param combined - Include host replies, result anchors and consuming receivers.
 */
export const ownedJvmCallbackResultInstalledFixture = (namespace, combined = false) => {
	assert.match(namespace, /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/u);
	assert.equal(typeof combined, "boolean");
	const signatures = profile => signaturesFor(namespace, combined, profile);
	const java = `import ${namespace}.*;
import static ${namespace}.Api.*;
import java.math.BigInteger;

@SuppressWarnings("try")
public final class Consumer {
    private static int checks;
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message); checks++;
    }
    private static void closed(Runnable action) {
        var error = (LeanBridgeException)Wire.reject(LeanBridgeException.class, action);
        check(error.status() == 4, "expired owner status");
    }
${javaNative}
${combined ? javaHost : ""}
    public static void main(String[] args) throws Exception {
        ${signatures("java")}
        if (args.length == 1 && args[0].equals("--signatures")) return;
        try (var seed = newTicket(BigInteger.valueOf(63), "installed-callback-owner")) {
            var input = bundle(seed.get()); nativeCalls(input); ${combined ? "hostCalls(input);" : ""}
        }
        Wire.result("owned/callback-result-checks", Wire.integer(checks), true);
        Wire.finish("java", "${namespace}", System.getProperty("java.version"), Api.class);
    }
}
`;
	const kotlin = `import ${namespace}.kotlin.*
import ${namespace}.kotlin.Pair
import java.math.BigInteger

private var checks = 0
private fun check(value: Boolean, message: String) { if (!value) throw AssertionError(message); checks++ }
private fun closed(action: () -> kotlin.Unit) {
    val error = Wire.reject(LeanBridgeException::class.java, action) as LeanBridgeException
    check(error.status() == 4, "expired owner status")
}
${kotlinNative}
${combined ? kotlinHost : ""}
fun main(args: Array<String>) {
    ${signatures("kotlin")}
    if (args.contentEquals(arrayOf("--signatures"))) return
    Api.newTicket(BigInteger.valueOf(63), "installed-callback-owner").use { seed ->
        val input = bundle(seed.get()); nativeCalls(input); ${combined ? "hostCalls(input)" : ""}
    }
    Wire.result("owned/callback-result-checks", Wire.integer(checks), true)
    Wire.finish("kotlin", "${namespace}", KotlinVersion.CURRENT.toString(), Api::class.java)
}
`;
	const rejections = profile => profile === "java" ? [
		{ id: "owned/raw-callback-anchor"
			, expectation: { diagnostic: "compiler.err.cant.apply.symbol" }
			, source: `import ${namespace}.*; class Invalid { void invalid(ApplyTwiceArgument1Closure callback, Bundle raw) { callback.invoke(raw); } }\n` }
		, { id: "owned/wrong-callback-owner"
			, expectation: { diagnostic: "compiler.err.cant.apply.symbol" }
			, source: `import ${namespace}.*; class Invalid { void invalid(ApplyTwiceArgument1Closure callback, Value<Tree> wrong) { callback.invoke(wrong); } }\n` }
		, ...combined ? [{ id: "owned/raw-host-reply"
			, expectation: { diagnostic: "compiler.err.prob.found.req" }
			, source: `import ${namespace}.*; class Invalid { ApplyTwiceArgument1ClosureCallback invalid = value -> value; }\n` }] : []
	] : [
		{ id: "owned/raw-callback-anchor"
			, expectation: { diagnostic: "ARGUMENT_TYPE_MISMATCH" }
			, source: `import ${namespace}.kotlin.*\nfun invalid(callback: ApplyTwiceArgument1Closure, raw: Bundle) { callback.invoke(raw) }\n` }
		, { id: "owned/wrong-callback-owner"
			, expectation: { diagnostic: "ARGUMENT_TYPE_MISMATCH" }
			, source: `import ${namespace}.kotlin.*\nfun invalid(callback: ApplyTwiceArgument1Closure, wrong: Value<Tree>) { callback.invoke(wrong) }\n` }
		, ...combined ? [{ id: "owned/raw-host-reply"
			, expectation: { diagnostic: "RETURN_TYPE_MISMATCH" }
			, source: `import ${namespace}.kotlin.*\nval invalid = ApplyTwiceArgument1ClosureCallback { it }\n` }] : []
	];
	for(const source of [java, kotlin]) assert.doesNotMatch(source, /_Owned|\.foreign\b|SymbolLookup|\.bindings\b/u);
	return { packageKind: "lean-bridge-owned-maven-package"
		, removeHandoffBeforeExecution: true
		, source: profile => profile === "java" ? java : kotlin
		, signatures, rejections, examples: () => [], javaSupport: {} };
};
