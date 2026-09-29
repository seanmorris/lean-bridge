/**
 * Prepared Java/Kotlin ownership APIs and authenticated native loading.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateOwnedJvmCalls } from "./owned-calls.mjs";
import { ownedJvmThreadExit } from "./owned-thread-exit.mjs";
import { verifiedJvmAssets } from "./verified-assets.mjs";

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
 */
export const generateOwnedJvmPackage = (ir, evidence = null, { transferredInputs = false } = {}) => {
	const model = generateOwnedJvmCalls(ir, { transferredInputs }), prefix = model.c.prefix;
	const transfers = model.c.functions.some(fn => fn.transfers?.length);
	if(["gmp", "lean_bridge_native", "leanshared"].includes(prefix) || ir.component.id.length >= 160)
		throw new TypeError("Owned JVM component name collides with a dependency or exceeds its name limit");
	if(evidence !== null && (evidence.componentId !== ir.component.id || evidence.library !== `lib${prefix}_jvm.so`
		|| !Object.hasOwn(evidence.libraries ?? {}, "libgmp-lean-bridge.so.10")))
		throw new TypeError("Owned JVM loading evidence differs from the component or private GMP dependency");
	const declarations = new Map(ir.declarations.map(fn => [fn.id, fn]));
	const functions = model.functions.map(fn => {
		const names = declarations.get(fn.id).parameters.map(site => keywords.has(site.name) ? site.name + "_" : site.name);
		if(names.some(name => !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) || new Set(names).size !== names.length)
			throw new TypeError("Owned JVM parameter names must be distinct ASCII identifiers after escaping");
		return { ...fn, parameterNames: names };
	});
	const cleanup = ownedJvmThreadExit(prefix);
	const contract = { schemaVersion: transfers ? 2 : 1
		, backend: transfers ? "owned-jvm-v2" : "owned-jvm-v1"
		, ...transfers ? { inputTransfers: { schemaVersion: 1
			, arguments: "ordinary-values", consumption: "before-lean-call"
			, validation: "before-consumption", failure: "consumed-after-handoff"
			, aliases: "shared-lease", borrowedInputs: "reject"
			, independentRetains: "preserved" } } : {}
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
	const javaType = (fn, id, i) => model.c.hostArgument(fn, i)
		? nodes.get(id).delegateType : model.type(id, false);
	const kotlinType = (fn, id, i) => model.c.hostArgument(fn, i)
		? quoted(model.kotlin.namespace + "." + nodes.get(id).delegateType) : model.kotlin.publicTypes[id];
	add(`${java}/Api.java`, `package ${model.namespace};

/** The functions selected by the Lean package author. */
public final class Api {
    private Api() { }
${functions.map((fn, index) => `${fn.transfers?.length ? `    /** Consumes resource leases in ${fn.transfers.map(i => fn.parameterNames[i]).join(", ")} at the Lean call boundary. Shared aliases close; independent retains survive. Pre-handoff errors preserve ownership. */\n` : ""}    public static ${unit(fn.result) ? "void" : model.type(fn.result, false)} ${fn.publicName}(${fn.parameters.map((id, i) => `${javaType(fn, id, i)} ${fn.parameterNames[i]}`).join(", ")}) {
        ${unit(fn.result) ? "" : "return "}_OwnedLoader.bindings().callJava${index}(${fn.parameterNames.join(", ")});
    }`).join("\n")}
}
`, true);
	add(`${kotlin}/_KotlinOwnedApiCalls.kt`, `package ${quoted(model.namespace)}

internal object _KotlinOwnedApiCalls {
${functions.map((fn, index) => `    @kotlin.jvm.JvmSynthetic fun call${index}(${fn.parameters.map((id, i) => `arg${i}: ${kotlinType(fn, id, i)}`).join(", ")}): ${unit(fn.result) ? "kotlin.Unit" : model.kotlin.publicTypes[fn.result]} {
        ${unit(fn.result) ? "" : "return "}_OwnedLoader.bindings().callKotlin${index}(${fn.parameterNames.map((_, i) => `arg${i}`).join(", ")})
    }`).join("\n")}
}
`);
	add(`${kotlin}/kotlin/Api.kt`, `package ${quoted(model.kotlin.namespace)}

class Api private constructor() {
    companion object {
${functions.map((fn, index) => `${fn.transfers?.length ? `        /** Consumes resource leases in ${fn.transfers.map(i => fn.parameterNames[i]).join(", ")} at the Lean call boundary. Shared aliases close; independent retains survive. Pre-handoff errors preserve ownership. */\n` : ""}        @kotlin.jvm.JvmStatic fun ${quoted(fn.publicName)}(${fn.parameters.map((id, i) => `${quoted(fn.parameterNames[i])}: ${kotlinType(fn, id, i)}`).join(", ")}): ${unit(fn.result) ? "kotlin.Unit" : model.kotlin.publicTypes[fn.result]} =
            ${quoted(model.namespace)}._KotlinOwnedApiCalls.call${index}(${fn.parameterNames.map(quoted).join(", ")})`).join("\n")}
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

Resources and returned closures implement AutoCloseable. Use try-with-resources
in Java or use in Kotlin. Retain creates an independent owner. Copying a record
or array shares its existing wrappers and does not retain them. Resource leaves
compare wrapper identity. Calls, closure invocation and retain require their
creating platform thread. Cross-thread close and Cleaner cleanup queue releases;
native cleanup runs on the creating thread or at its exit, even when Thread
objects and wrappers remain reachable. Virtual threads cannot own Lean sessions.

${transfers ? `Transferred inputs use ordinary Java or Kotlin values. Generated Javadoc and
KDoc name consuming arguments. Validation and snapshot preparation precede the
Lean call boundary. At handoff, shared aliases and sibling resources using the
same result owner close together. Copied fields remain values; independent
retains survive. Retain callback borrows before transferring them. Two consuming
arguments cannot share a resource lease. Pre-handoff errors preserve ownership;
callback and conversion failures after handoff leave inputs consumed.

` : ""}Callbacks use synchronous typed interfaces. Their borrowed resources and closures
expire when the callback returns; retain them inside the callback when needed.
asCallback passes a returned Lean closure back to Lean with its native identity.
If a callback has no automatic recovery value, use
OwnedCallbacks.withRecovery(callback, recoveryValue). Java lambdas that match
several recovery overloads need an explicit callback type. Host exceptions keep
their identity after native cleanup. Recovery values allow cleanup, not successful
results. Host callbacks do not remain usable after their originating call ends.

Inputs, callbacks and results share depth 128, 262,144 visits, a 16 MiB native-copy
budget and a separate 16 MiB accounted Java-storage budget within each call.
These limits do not bound Lean working memory or every JVM allocation. Nested
calls own separate budgets. Malformed native output retires the runtime.

The loader authenticates every packaged native file and rejects conflicting
runtime identities, conflicting library builds and unverified preloads.
Compatible packages share loaded dependencies. Native libraries stay loaded
until process exit so native thread destructors remain valid. Extracted files
are removed at normal JVM shutdown. Start a fresh process after fork.
${transfers ? "Anchored results" : "Transferred inputs, anchored results"} and asynchronous delivery require separate
lifetime support.
`;
	files["binding-manifest.json"] = canonicalJson({ schemaVersion: transfers ? 2 : 1
		, generator: transfers ? "jvm-owned-values-v2" : "jvm-owned-values-v1"
		, backend: transfers ? "owned-jvm-v2" : "owned-jvm-v1", target: "jvm"
		, component: ir.component.id
		, bindingIrSha256: model.c.native.model.bindingIrSha256
		, namespace: model.namespace, files: Object.keys(files)
		, publicFiles, internalFiles, packageFiles: [], aliases: model.aliases
		, ownedValues: contract
		, kotlin: { namespace: model.kotlin.namespace, metadataVersion: "2.2.0" }
		, supportedFeatures: ["direct-functions", "copied-values", "recursive-values", "resources", "callbacks", "closures", "deterministic-close", ...transfers ? ["transferred-inputs"] : []]
		, capabilityGaps: [transfers
			? { feature: "anchored-ownership", reason: "Anchored results require their own lifetime projection." }
			: { feature: "transferred-and-anchored-ownership", reason: "Transferred inputs and anchored results require their own lifetime projection." }
		, { feature: "additional-platforms", reason: "Compiled releases target Java 22 on Linux x86-64 with glibc." }] });
	if(Object.values(files).reduce((size, source) => size + Buffer.byteLength(source), 0) > 16 * 1024 * 1024)
		throw new TypeError("Owned JVM package sources exceed 16 MiB");
	return { ...model, functions, prefix, contract, cleanup, files: Object.freeze(files), publicFiles, internalFiles };
};
