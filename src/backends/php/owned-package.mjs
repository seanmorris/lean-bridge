/**
 * Automatically loaded PHP ownership sources for authenticated Composer builds.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateOwnedPhpCalls } from "./owned-calls.mjs";
import { copiedPhpLoader } from "./copied-assets.mjs";
import { ownedPhpLoader } from "./owned-assets.mjs";

const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);

const checkEvidence = (model, contract, evidence) => {
	if(evidence === null) return;
	const keys = ["componentId", "componentReceiptSha256", "libraries"
		, "library", "ownedValues", "runtimeIdentity"];
	if(!evidence || typeof evidence !== "object" || Array.isArray(evidence)
		|| canonicalJson(Object.keys(evidence).sort()) !== canonicalJson(keys)
		|| evidence.componentId !== model.c.native.model.component.id
		|| evidence.library !== `lib${model.c.prefix}_php.so`
		|| !hash(evidence.runtimeIdentity) || !hash(evidence.componentReceiptSha256)
		|| canonicalJson(evidence.ownedValues ?? null) !== canonicalJson(contract)
		|| !evidence.libraries || typeof evidence.libraries !== "object" || Array.isArray(evidence.libraries))
		throw new TypeError("Owned PHP evidence differs from the component or ownership contract");
	const required = [evidence.library, "libleanshared.so"
		, "liblean_bridge_native.so", "libgmp-lean-bridge.so.10"];
	if(Object.keys(evidence.libraries).length !== 5
		|| required.some(name => !Object.hasOwn(evidence.libraries, name))
		|| Object.entries(evidence.libraries).some(([name, digest]) => !/^lib[A-Za-z0-9_.-]+\.so(?:\.\d+)*$/u.test(name) || !hash(digest)))
		throw new TypeError("Owned PHP requires exact component, adapter, runtime and private GMP identities");
};

/**
 * Bind generated public functions to lazy, receipt-authenticated native loading.
 * The Composer builder must verify compiled artifacts before supplying evidence.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param evidence - Closed native identities, or null for source inspection.
 */
export const generateOwnedPhpPackage = (ir, evidence = null) => {
	const model = generateOwnedPhpCalls(ir), { namespace } = model, prefix = model.c.prefix;
	if(["gmp", "leanshared", "lean_bridge_native"].includes(prefix) || ir.component.id.length >= 160)
		throw new TypeError("Owned PHP component name collides with a dependency or exceeds its name limit");
	const contract = { schemaVersion: 1, language: "php-8.2-nts-cli"
		, ownership: "checked-result-leases", callbackLifetime: "call"
		, explicitRetention: "retain", callbackFailure: "raise-after-native-return"
		, exactIntegers: "brick-math", integerDecimalDigits: 16384
		, loadingPolicy: "linux-x64-deepbind-v1", gmp: "libgmp-lean-bridge.so.10"
		, sourcesSha256: Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)]))
		, nativeSha256: sha256(model.nativeSource)
		, headerSha256: sha256(model.c.header), loaderSha256: sha256(ownedPhpLoader)
		, sharedLoaderSha256: sha256(copiedPhpLoader)
		, limits: model.c.native.model.limits };
	checkEvidence(model, contract, evidence);
	const files = { ...model.files, "src/Internal/Runtime.php": copiedPhpLoader
		, "src/Internal/OwnedAssets.php": ownedPhpLoader };
	const localEvidence = evidence === null ? null : { ...evidence
		, componentLibrary: Object.keys(evidence.libraries).find(name => ![evidence.library, contract.gmp, "libleanshared.so", "liblean_bridge_native.so"].includes(name))
		, identity: sha256(canonicalJson(evidence)) };
	files["src/Api.php"] += "\nrequire_once __DIR__ . '/Internal/OwnedBootstrap.php';\n";
	files["src/Internal/OwnedBootstrap.php"] = `<?php
declare(strict_types=1);
namespace ${namespace}\\Internal;

require_once __DIR__ . '/Runtime.php';
require_once __DIR__ . '/OwnedAssets.php';

final class OwnedAssets
{
    private const DEFINITIONS = OwnedCallTypes::DEFINITIONS;
    public static function load(): \\FFI {
        ${localEvidence === null ? "throw new \\RuntimeException('Build a compiled native PHP release before calling this API');" : `return \\LeanBridge\\OwnedNativeV1\\Runtime::load(__DIR__ . '/../../native/linux-x64', json_decode(<<<'EVIDENCE'\n${canonicalJson(localEvidence).trim()}\nEVIDENCE, true, 512, JSON_THROW_ON_ERROR), self::DEFINITIONS);`}
    }
}

Native::configure(static fn(): OwnedRuntime => new OwnedRuntime(OwnedAssets::load(),
    \\LeanBridge\\CopiedNativeV1\\Runtime::ensureProcess(...)));
`;
	files["README.md"] = `# ${namespace}

Install the prepared Composer release and require vendor/autoload.php. The
generated ${namespace} functions load their bundled native libraries on the
first valid call. The loader checks the recorded library hashes. Compatible
packages share one Lean runtime; private adapters and GMP load with local symbol
binding. Consumers need no Lean compiler, C declarations or library paths.

This profile requires PHP 8.2 or newer, below PHP 9, NTS CLI on little-endian
Linux x86-64 with FFI enabled and the release's declared glibc floor. It does not
target PHP-Wasm, ZTS, FPM or Apache. Start a fresh interpreter after fork.

Records and variant constructors are final readonly classes. Arrays and Lists
use consecutive-key arrays; products retain their nested two-element shape.
Option uses null or Some(value), including Some(null). Except uses Ok(value)
and Err(error). Aliases preserve their target representation. Nat, Int, UInt64
and USize use Brick\\Math\\BigInteger; other fixed-width integers use checked
PHP int. Nat and Int accept at most 16384 decimal digits. Char is one Unicode
scalar, String preserves UTF-8 and NUL, and Bytes preserves arbitrary bytes.
Float32 rounds to binary32. Unit is null. Weak and strict callers receive the
same generated validation without scalar coercion.

Resource and returned Lean closure wrappers support close() and retain(). Close
them in a finally block. Destruction provides fallback cleanup. Calls from
Fibers reject; cleanup deferred by Fiber destruction runs in the main context.
Resource identities cannot be cloned or serialized.

Pass synchronous PHP callables to callback parameters. Borrowed resources in
callback arguments expire on return. Call retain() inside the callback to keep
one. Callback replies are copied before native borrowed storage expires.
Returned Lean closures are invokable but cannot extend a borrowed PHP callback's
lifetime. Use with_recovery(callback, value) when the signature requires a typed
failure-path value. Recovery never becomes a successful result after failure.
PHP receives the original Throwable after native cleanup. Native reply-copy
failures preserve their status. Generator and reference callbacks reject.

Inputs, callbacks and output share bounded conversion budgets: 128 value levels,
262144 visits, 16 MiB accounted PHP storage and 16 MiB native conversion data.
These limits exclude Lean working memory and some PHP allocator overhead.
Malformed native output retires the runtime; validation and recoverable
allocation failures leave it usable. Generated values load with FFI disabled,
and invalid calls reject before loading native code.
`;
	const exports = ["Bytes", "LeanBridgeError", "Some", "Ok", "Err"
		, "WithRecovery", "with_recovery"
		, ...model.types.filter(node => node.identity || node.kind === "variant").map(node => node.publicType)
		, ...model.records.map(record => record.name)
		, ...model.functions.map(fn => fn.publicName)].map(name => `${namespace}\\${name}`);
	files["binding-manifest.json"] = canonicalJson({ schemaVersion: 1
		, generator: { id: "lean-wasm/php-owned", version: 1 }
		, component: ir.component.id
		, bindingIrSha256: model.c.native.model.bindingIrSha256
		, namespace, exports, aliases: model.aliases, publicFiles: model.publicFiles
		, internalFiles: Object.keys(files).filter(path => path.startsWith("src/Internal/"))
		, contract, nativeEvidence: evidence
		, files: [...Object.keys(files), "binding-manifest.json"].sort()
		, filesSha256: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)])) });
	return { ...model, files, contract, exports };
};

/**
 * Reject missing, added or changed package source, even with refreshed hashes.
 * This check does not replace compiled-artifact or installed-consumer evidence.
 *
 * @param ir - Compiler-authenticated contract.
 * @param files - Complete generated package source inventory.
 */
export const auditOwnedPhpPackage = (ir, files) => {
	const manifest = JSON.parse(files["binding-manifest.json"]);
	const expected = generateOwnedPhpPackage(ir, manifest.nativeEvidence).files;
	if(canonicalJson(Object.keys(files).sort()) !== canonicalJson(Object.keys(expected).sort())
		|| Object.entries(expected).some(([path, source]) => files[path] !== source))
		throw new TypeError("Owned PHP package differs from its complete generated sources");
	return true;
};
