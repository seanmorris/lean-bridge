/**
 * Prepared Java/Kotlin ownership APIs and authenticated native loading.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateOwnedJvmCalls } from "./owned-calls.mjs";
import { ownedJvmThreadExit } from "./owned-thread-exit.mjs";
import { verifiedJvmAssets } from "./verified-assets.mjs";
import { ownedJvmKotlinParameterType, ownedJvmKotlinReturnType } from "./owned-receivers.mjs";

const quoted = name => name.split(".").map(part => `\`${part}\``).join(".");
const keywords = new Set("_ abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record sealed permits var yield _OwnedLoader org".split(" "));

/**
 * Generate package sources. Compiled artifact verification supplies identities;
 * consumers never supply native paths or a second runtime package.
 *
 * @param ir - Compiler-authenticated ownership contract.
 * @param evidence - Exact native library identities, or null for inspection.
 * @param options - Compiler-authenticated ownership capabilities.
 * @param options.transferredInputs - Enable consuming input leases.
 * @param options.anchoredResults - Preserve original whole-result owners.
 * @param options.receiverExports - Generate nominal methods and properties.
 * @param options.callbackResultAnchors - Preserve callback-local result owners.
 * @param options.hostCallbacks - Enable synchronous callback transport independently.
 */
export const generateOwnedJvmPackage = (ir, evidence = null, { transferredInputs = false, anchoredResults = false, receiverExports = false, callbackResultAnchors = false, hostCallbacks = true } = {}) => {
	const model = generateOwnedJvmCalls(ir, { transferredInputs, anchoredResults, receiverExports, callbackResultAnchors, hostCallbacks }), prefix = model.c.prefix;
	const transfers = model.c.functions.some(fn => fn.transfers?.length);
	const anchors = model.c.functions.some(fn => fn.anchor !== undefined);
	const callbackAnchors = model.c.callbacks.filter(fn => fn.anchor !== undefined);
	const receivers = model.functions.filter(fn => fn.receiver === 0), wholeOwners = model.wholeOwners;
	if(["gmp", "lean_bridge_native", "leanshared"].includes(prefix) || ir.component.id.length >= 160)
		throw new TypeError("Owned JVM component name collides with a dependency or exceeds its name limit");
	if(evidence !== null && (evidence.componentId !== ir.component.id || evidence.library !== `lib${prefix}_jvm.so`
		|| !Object.hasOwn(evidence.libraries ?? {}, "libgmp-lean-bridge.so.10")))
		throw new TypeError("Owned JVM loading evidence differs from the component or private GMP dependency");
	const declarations = new Map(ir.declarations.map(fn => [fn.id, fn]));
	const functions = model.exportCalls.map(fn => {
		const names = declarations.get(fn.id).parameters.map(site => keywords.has(site.name) ? site.name + "_" : site.name);
		if(fn.receiver === 0)
		{
			let receiver = "receiver";
			while(names.includes(receiver)) receiver += "_";
			names.unshift(receiver);
		}
		if(names.some(name => !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) || new Set(names).size !== names.length)
			throw new TypeError("Owned JVM parameter names must be distinct ASCII identifiers after escaping");
		return { ...fn, parameterNames: names };
	});
	const cleanup = ownedJvmThreadExit(prefix);
	const schemaVersion = callbackAnchors.length ? 5 : receivers.length ? 4 : anchors ? 3 : transfers ? 2 : 1;
	const contract = { schemaVersion
		, backend: callbackAnchors.length ? "owned-jvm-v5" : receivers.length ? "owned-jvm-v4" : anchors ? "owned-jvm-v3" : transfers ? "owned-jvm-v2" : "owned-jvm-v1"
		, ...callbackAnchors.length ? { callbackResultAnchors: { schemaVersion: 1
			, values: "checked-whole-result", anchor: "original-argument-owner"
			, parameterNumbering: "callback-local"
			, expiration: "owner-release-or-transfer", descendants: "transitive"
			, emptyValues: "owner-preserved"
			, independentOwnership: "retain-or-copyValue"
			, hostArguments: "borrowed-raw-values", hostReply: "value-or-whole-owner"
			, hostResultHandoff: "before-callback-frame-expires"
			, nativeInputs: "typed-overloads", nativeClosures: "identity-preserved"
			, signatures: callbackAnchors.map(item => ({ id: item.id, parameter: item.anchor - 1, result: item.result }))
		} } : {}
		, ...transfers ? { inputTransfers: { schemaVersion: 1
			, arguments: wholeOwners ? "whole-values" : "ordinary-values"
			, consumption: "before-lean-call"
			, validation: "before-consumption", failure: "consumed-after-handoff"
			, aliases: "shared-lease", borrowedInputs: "reject"
			, independentRetains: "preserved" } } : {}
		, ...anchors ? { resultAnchors: {
			schemaVersion: 1
			, values: "checked-whole-result", anchor: "original-result-owner"
			, expiration: "owner-release-or-transfer", descendants: "transitive"
			, emptyValues: "owner-preserved", aliases: "shared-owner"
			, independentOwnership: "retain-or-copyValue"
			, copyType: "unique-erased-type-or-declaration-selected"
			, rawViews: "borrowed-from-whole-owner"
			, resourceEquality: "canonical-identity", invalidEquality: "throw"
			, transfers: "original-owner" } } : {}
		, ...receivers.length ? { receiverExports: { schemaVersion: 1
			, values: "checked-whole-result", members: "camel-case"
			, properties: "java-bean-getters-and-kotlin-read-only-properties"
			, owners: "nominal-Value-subclasses"
			, consumingReceivers: "original-owner-handoff"
			, exports: receivers.map(fn => ({ bindingId: fn.id
				, owner: declarations.get(fn.id).owner
				, kind: fn.receiverKind, member: fn.publicName }))
		} } : {}
		, bindingIrSha256: model.c.native.model.bindingIrSha256
		, namespace: model.namespace, kotlinNamespace: model.kotlin.namespace
		, loadingPolicy: "linux-x64-deepbind-v1", gmp: "libgmp-lean-bridge.so.10"
		, headerSha256: sha256(model.c.header), cleanupSha256: sha256(cleanup.source)
		, guardSha256: sha256(cleanup.guardSource)
		, bindingsSha256: sha256(canonicalJson(model.files)) };
	const files = { ...model.files }, publicFiles = [...model.publicFiles], internalFiles = [...model.internalFiles];
	const java = `src/main/java/${model.namespace.replaceAll(".", "/")}`, kotlin = `src/main/kotlin/${model.namespace.replaceAll(".", "/")}`;
	const add = (path, source, public_ = false) => {
		if(Object.hasOwn(files, path)) throw new TypeError("Duplicate owned JVM package source " + path);
		files[path] = source; (public_ ? publicFiles : internalFiles).push(path);
	};
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const unit = id => nodes.get(id).name === "unit";
	const javaType = (fn, id, i) => wholeOwners ? model.parameterType(fn, i, false) : model.c.hostArgument?.(fn, i)
		? nodes.get(id).delegateType : model.type(id, false);
	const kotlinType = (fn, id, i) => ownedJvmKotlinParameterType(model, fn, i);
	const kotlinResult = fn => ownedJvmKotlinReturnType(model, fn);
	add(`${java}/Api.java`, `package ${model.namespace};

/** The functions selected by the Lean package author. */
public final class Api {
    private Api() { }
${functions.map(fn => `${fn.transfers?.length ? `    /** Consumes resource leases in ${fn.transfers.map(i => fn.parameterNames[i]).join(", ")} at the Lean call boundary. Shared aliases close; independent retains survive. Pre-handoff errors preserve ownership. */\n` : ""}    public static ${unit(fn.result) ? "void" : wholeOwners ? model.returnType(fn, false) : model.type(fn.result, false)} ${fn.publicName}(${fn.parameters.map((id, i) => `${javaType(fn, id, i)} ${fn.parameterNames[i]}`).join(", ")}) {
        ${unit(fn.result) ? "" : "return "}_OwnedLoader.bindings().${model.methodName(fn, "Java")}(${fn.parameterNames.join(", ")});
    }`).join("\n")}${wholeOwners ? "\n" + model.wholeCopies.map(copy => `    public static ${receivers.length ? model.returnType(copy.call, false) : `Value<${model.type(copy.id, false)}>`} ${copy.publicName}(${model.type(copy.id, false)} value) {
        return _OwnedLoader.bindings().${model.methodName(copy.call, "Java")}(value);
    }`).join("\n") : ""}
}
`, true);
	add(`${kotlin}/_KotlinOwnedApiCalls.kt`, `package ${quoted(model.namespace)}

internal object _KotlinOwnedApiCalls {
${functions.map((fn, index) => `    @kotlin.jvm.JvmSynthetic fun call${index}(${fn.parameters.map((id, i) => `arg${i}: ${kotlinType(fn, id, i)}`).join(", ")}): ${kotlinResult(fn)} {
        ${unit(fn.result) ? "" : "return "}_OwnedLoader.bindings().${model.methodName(fn, "Kotlin")}(${fn.parameterNames.map((_, i) => `arg${i}`).join(", ")})
    }`).join("\n")}${wholeOwners ? "\n" + model.wholeCopies.map((copy, index) => `    @kotlin.jvm.JvmSynthetic fun copy${index}(value: ${model.kotlin.publicTypes[copy.id]}): ${kotlinResult(copy.call)} =
        _OwnedLoader.bindings().${model.methodName(copy.call, "Kotlin")}(value)`).join("\n") : ""}
}
`);
	add(`${kotlin}/kotlin/Api.kt`, `package ${quoted(model.kotlin.namespace)}

class Api private constructor() {
    companion object {
${functions.map((fn, index) => `${fn.transfers?.length ? `        /** Consumes resource leases in ${fn.transfers.map(i => fn.parameterNames[i]).join(", ")} at the Lean call boundary. Shared aliases close; independent retains survive. Pre-handoff errors preserve ownership. */\n` : ""}        @kotlin.jvm.JvmStatic fun ${quoted(fn.publicName)}(${fn.parameters.map((id, i) => `${quoted(fn.parameterNames[i])}: ${kotlinType(fn, id, i)}`).join(", ")}): ${kotlinResult(fn)} =
            ${quoted(model.namespace)}._KotlinOwnedApiCalls.call${index}(${fn.parameterNames.map(quoted).join(", ")})`).join("\n")}${wholeOwners ? "\n" + model.wholeCopies.map((copy, index) => `        @kotlin.jvm.JvmStatic fun ${quoted(copy.publicName)}(value: ${model.kotlin.publicTypes[copy.id]}): ${kotlinResult(copy.call)} =
            ${quoted(model.namespace)}._KotlinOwnedApiCalls.copy${index}(value)`).join("\n") : ""}
    }
}
`, true);
	add(`${java}/_OwnedNative.java`, `package ${model.namespace};

final class _OwnedNative {
${verifiedJvmAssets(evidence, "_OwnedNative")}
}
`);
	add(`${java}/_OwnedLoader.java`, `package ${model.namespace};

final class _OwnedLoader {
    private _OwnedLoader() { }
    private static volatile _OwnedBindings bindings;
    static _OwnedBindings bindings() {
        _OwnedNative.ensureProcess();
        var ready = bindings; if (ready != null) return ready;
        // Resolve process-wide libraries before entering a package-local lock.
        var symbols = _OwnedNative.lookup();
        synchronized (_OwnedLoader.class) {
            _OwnedNative.ensureProcess(); ready = bindings;
            if (ready == null) {
                ready = new _OwnedBindings(symbols, _OwnedNative::ensureProcess);
                bindings = ready;
            }
            return ready;
        }
    }
}
`);
	files["README.md"] = `# ${model.namespace}

Install the prepared Maven release and call ${model.namespace}.Api from Java or
${model.kotlin.namespace}.Api from Kotlin. The JAR includes the compiled Lean
component, shared runtime and private GMP dependency. It verifies and loads them
automatically. Consumers need Java 22 or newer on Linux x86-64 with the declared
glibc floor and --enable-native-access=ALL-UNNAMED. Maven resolves Kotlin's
standard library. Lean, Node and native compilers are producer tools.

Java records and sealed constructors have separate Kotlin classes with genuine
metadata and non-null val fields. Array and List use typed arrays. Nat and Int
use BigInteger. UInt8/UInt16 use checked int/Int, UInt32 uses long/Long, and
UInt64/USize use BigInteger. Char is an integer Unicode scalar, not a UTF-16
character. String preserves Unicode and NUL. ByteArray uses byte[]/ByteArray.
Unit arguments use Unit.INSTANCE; Unit results use Java void or Kotlin Unit.
Option distinguishes None, Some(Unit.INSTANCE) and Some(None). Result preserves
its success or error branch. Pair retains binary nesting. Aliases retain their
metadata without adding JVM wrappers. Null payloads, negative Nat, malformed
Unicode, cycles and invalid branches reject.

${callbackAnchors.length ? "\t" : ""}${anchors || callbackAnchors.length ? `Resource-bearing results use Value<T>, including empty arrays, absent options and
payload-free constructors. Use get() to inspect a value, share() for another
guard on the same owner, and retain() for an independent copy. The last shared
guard's close expires borrowed descendants. Raw resource views from get() do
not keep the whole owner alive. Resource retain() creates an independent owner.
Resource equality compares canonical native identity; expired comparisons throw.
Whole values and resources cannot be hash keys. Api.copyValue(raw) constructs an
owner where the erased JVM type is unique. For ambiguous types, use the generated
copy<Function>Result or copy<Function>ArgN method to select the Lean declaration.

Whole values, resources and returned closures implement AutoCloseable. Use
try-with-resources in Java or use in Kotlin. Calls, closure invocation and retain
require their creating platform thread. Cross-thread close and Cleaner cleanup
queue releases; native cleanup runs on the creating thread or at its exit, even
when Thread objects and wrappers remain reachable. Virtual threads cannot own
Lean sessions.` : receivers.length ? `Resource-bearing results use checked Value<T> owners. Use get() for borrowed raw
views, share() for another guard on the same owner, and retain() for independent
ownership. Keep the whole owner alive while using its raw views. Raw resource
leaves compare wrapper identity; whole owners reject hashing. Whole values and
resources implement AutoCloseable. Use try-with-resources in Java or use in
Kotlin. Calls and retention require the creating platform thread. Cross-thread
close and Cleaner cleanup queue releases for that thread or its exit. Virtual
threads cannot own Lean sessions.` : `Resources and returned closures implement AutoCloseable. Use try-with-resources
in Java or use in Kotlin. Retain creates an independent owner. Copying a record
or array shares its existing wrappers and does not retain them. Resource leaves
compare wrapper identity. Calls, closure invocation and retain require their
creating platform thread. Cross-thread close and Cleaner cleanup queue releases;
native cleanup runs on the creating thread or at its exit, even when Thread
objects and wrappers remain reachable. Virtual threads cannot own Lean sessions.`}

${receivers.length ? `Exported methods and read-only properties appear on nominal owner classes such
as TicketValue extends Value<Ticket>. Java uses getSerial(); Kotlin uses .serial.
Share and retain preserve the nominal owner type through generic base references.
Each member validates its original owner. Raw resources expose only members that
do not consume or anchor their receiver. A result anchored to another argument
follows that argument's lifetime. Aggregate fields remain on the value returned
by get(), separate from exported owner properties. Static Api calls remain available.

` : ""}${transfers ? wholeOwners ? `Transferred inputs accept Value<T>. Generated Javadoc and KDoc name consuming
arguments. Validation precedes the Lean call boundary. At handoff, the original
owner is consumed, including empty values. Shared guards and borrowed descendants
expire together; independent retains survive. Borrowed results cannot be consumed.
Duplicate consuming owners and ancestor/anchor conflicts reject before handoff.
Callback and conversion failures after handoff leave the original input consumed.

` : `Transferred inputs use ordinary Java or Kotlin values. Generated Javadoc and
KDoc name consuming arguments. Validation and snapshot preparation precede the
Lean call boundary. At handoff, shared aliases and sibling resources using the
same result owner close together. Copied fields remain values; independent
retains survive. Retain callback borrows before transferring them. Two consuming
arguments cannot share a resource lease. Pre-handoff errors preserve ownership;
callback and conversion failures after handoff leave inputs consumed.

` : ""}${hostCallbacks ? `Callbacks use synchronous typed interfaces. Their borrowed resources and closures
expire when the callback returns; retain them inside the callback when needed.
asCallback passes a returned Lean closure back to Lean with its native identity.
If a callback has no automatic recovery value, use
OwnedCallbacks.withRecovery(callback, recoveryValue). Java lambdas that match
several recovery overloads need an explicit callback type. Host exceptions keep
their identity after native cleanup. Recovery values allow cleanup, not successful
${callbackAnchors.length ? "\t" : ""}results. Host callbacks do not remain usable after their originating call ends.

${callbackAnchors.length ? "\t" : ""}` : ""}${callbackAnchors.length ? `Callbacks whose results borrow an argument return CallbackResult<T>. Use
CallbackResult.value(value) for an ordinary reply or CallbackResult.owner(value)
to return a checked Value<T> with its original owner. The binding copies the reply
before callback arguments expire. Generated overloads accept returned Lean closures
directly without converting them to raw-input host callbacks.

` : ""}Inputs, ${hostCallbacks ? "callbacks and " : ""}results share depth 128, 262,144 visits, a 16 MiB native-copy
budget and a separate 16 MiB accounted Java-storage budget within each call.
These limits do not bound Lean working memory or every JVM allocation. Nested
calls own separate budgets. Malformed native output retires the runtime.

The loader authenticates every packaged native file and rejects conflicting
runtime identities, conflicting library builds and unverified preloads.
Compatible packages share loaded dependencies. Native libraries stay loaded
until process exit so native thread destructors remain valid. Extracted files
are removed at normal JVM shutdown. Start a fresh process after fork.
${callbackAnchors.length ? "Retained host callbacks and callback input transfers" : receivers.length ? "Callback-result anchors" : anchors ? "Receiver anchors, callback-result anchors" : transfers ? "Anchored results" : "Transferred inputs, anchored results"} and asynchronous delivery require separate
lifetime support.
`;
	files["binding-manifest.json"] = canonicalJson({ schemaVersion: contract.schemaVersion
		, generator: callbackAnchors.length ? "jvm-owned-values-v5" : receivers.length ? "jvm-owned-values-v4" : anchors ? "jvm-owned-values-v3" : transfers ? "jvm-owned-values-v2" : "jvm-owned-values-v1"
		, backend: contract.backend
		, target: "jvm"
		, component: ir.component.id
		, bindingIrSha256: model.c.native.model.bindingIrSha256
		, namespace: model.namespace, files: Object.keys(files)
		, publicFiles, internalFiles, packageFiles: [], aliases: model.aliases
		, ownedValues: contract
		, kotlin: { namespace: model.kotlin.namespace, metadataVersion: "2.2.0" }
		, supportedFeatures: ["direct-functions", "copied-values", "recursive-values", "resources", ...hostCallbacks ? ["callbacks"] : [], "closures", "deterministic-close", ...transfers ? ["transferred-inputs"] : [], ...anchors ? ["parameter-anchored-results", "whole-value-owners", "canonical-resource-equality"] : [], ...receivers.length ? ["receiver-methods", "receiver-properties", ...anchors ? [] : ["whole-value-owners"]] : [], ...callbackAnchors.length ? ["callback-result-anchors", ...anchors || receivers.length ? [] : ["whole-value-owners", "canonical-resource-equality"]] : []]
		, capabilityGaps: [callbackAnchors.length ? { feature: "retained-host-callbacks-and-callback-input-transfers", reason: "This projection admits call-scoped host callbacks and callback-result anchors." } : receivers.length ? { feature: "callback-result-anchors", reason: "Callback results require separate lifetime contracts." } : anchors ? { feature: "receiver-and-callback-result-anchors", reason: "These anchors require separate lifetime contracts." } : transfers
			? { feature: "anchored-ownership", reason: "Anchored results require their own lifetime projection." }
			: { feature: "transferred-and-anchored-ownership", reason: "Transferred inputs and anchored results require their own lifetime projection." }
		, { feature: "additional-platforms", reason: "Compiled releases target Java 22 on Linux x86-64 with glibc." }] });
	if(Object.values(files).reduce((size, source) => size + Buffer.byteLength(source), 0) > 16 * 1024 * 1024)
		throw new TypeError("Owned JVM package sources exceed 16 MiB");
	return { ...model, functions, prefix, contract, cleanup, files: Object.freeze(files), publicFiles, internalFiles };
};
