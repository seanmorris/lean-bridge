/**
 * Prepared Ruby sources for resource-bearing values and synchronous callbacks.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { copiedRubyRuntime } from "./copied-assets.mjs";
import { verifiedRubyAssets } from "./verified-assets.mjs";
import { generateOwnedRubyConversions } from "./owned-conversions.mjs";
import { ownedRubyRuntime } from "./owned-runtime.mjs";
import { ownedRubyAbiHeader } from "./owned-abi.mjs";

/**
 * Bind the public Ruby API to authenticated automatic native loading.
 * Gem admission still requires compiled artifacts and installed execution.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param evidence - Verified native library identities, or null for inspection.
 */
export const generateOwnedRubyPackage = (ir, evidence = null) => {
	const generated = generateOwnedRubyConversions(ir), prefix = generated.c.prefix;
	const { requirePath, componentName, namespace } = generated;
	const entry = `lib/${requirePath}.rb`, runtime = ownedRubyRuntime(prefix);
	const native = `${generated.source}
require "digest"
require "digest/sha2"
module LeanBridge
  module ${componentName}
    module Native
${verifiedRubyAssets(evidence)}
      bind(Owned::Runtime.new(LIBRARY, -> {
        reason = NativeCopiedRuntimeV1.context_error
        raise Owned::Error.new(6, reason) if reason
      }))
    end
  end
end
`;
	const abiHeader = ownedRubyAbiHeader(generated);
	const contract = { schemaVersion: 1, language: "ruby-3.3"
		, ownership: "checked-result-leases", callbackLifetime: "call"
		, explicitRetention: "retain", callbackFailure: "raise-after-native-return"
		, exactIntegers: "ruby-integer", loader: "authenticated-bundled-native"
		, loadingPolicy: "linux-x64-deepbind-v1"
		, gmp: "libgmp-lean-bridge.so.10"
		, publicSha256: sha256(generated.valuesSource)
		, conversionsSha256: sha256(generated.source)
		, boundarySha256: sha256(generated.cSource)
		, runtimeSha256: sha256(runtime), abiHeaderSha256: sha256(abiHeader)
		, limits: generated.c.native.model.limits };
	const files = {
		[entry]: `require_relative "${prefix}/owned"\n${generated.valuesSource}\nrequire_relative "${prefix}/native"\n`
		, [`lib/${requirePath}/owned.rb`]: `module LeanBridge\n  module ${componentName}\n${runtime}\n  end\nend\n`
		, [`lib/${requirePath}/native.rb`]: native
		, "lib/lean_bridge/native_copied_runtime_v1.rb": copiedRubyRuntime
		, "README.md": `# ${namespace}

Install the prepared gem and require "${requirePath}". Native Lean libraries,
the shared runtime and the package's private GMP load automatically. Consumers
need no Lean compiler, C declarations, extension build or library paths.
This native profile requires MRI Ruby 3.3 on little-endian Linux x86-64 with
1:1 native threads. Ractors and post-fork calls reject. Start a fresh interpreter
after fork.

Records and variant constructors use frozen classes with required keyword
fields. Arrays and Lists use ordinary Ruby Arrays and return independent
storage. Options use nil or Some.new(value), preserving Some.new(nil). Results
use Ok.new(value) or Err.new(value); products remain nested two-element Arrays.
Unit is UNIT. Nat and Int remain exact Ruby Integers; fixed-width ranges check
before native entry. String preserves valid UTF-8 and embedded NUL; ByteArray
uses binary String. Char contains one Unicode scalar. Float32 rounds to binary32.

Resource wrappers share checked result leases. dup and clone create independent
close guards; retain creates an independent native owner. Use with { |value| }
or close for deterministic release. Finalization queues fallback cleanup on the
creating thread. Resource calls reject after that thread exits, after fork or
from another thread. Serialization of resource identities is rejected.

Pass synchronous Ruby callables to callback parameters. Resource leaves in
callback arguments borrow the callback frame and expire on return, including
duplicates. Call retain inside the callback to keep a resource. Replies are
snapshotted before borrowed storage expires. Returned Lean closures are callable
and support retain and close, but cannot extend a borrowed host callback's
lifetime. Signatures without an argument-derived recovery require
with_recovery(function, typed_value). Failures never publish recovery as success.

Original callback exceptions return after native cleanup. Nonlocal return,
break and throw become LocalJumpError. Fiber switching during native callbacks
raises FiberError before the switch. Asynchronous thread raise and kill wait
until the native call and cleanup finish. Callbacks must return synchronously.

Inputs, callbacks and results share depth 128, 262144 visits, 16 MiB native
conversion data and a separate 16 MiB accounted conversion-storage budget.
These limits do not bound Lean algorithm memory or every Ruby allocator cost.
Malformed native values retire the runtime. Ordinary input and allocation
failures leave it usable. Partial output wrappers are revoked on failure.
` };
	files["binding-manifest.json"] = canonicalJson({ schemaVersion: 1
		, backend: "owned-ruby-v1", target: "ruby", component: ir.component.id
		, bindingIrSha256: generated.c.native.model.bindingIrSha256
		, namespace, requirePath, publicFiles: [entry]
		, exports: generated.exports, aliases: generated.aliases, contract, evidence
		, files: [...Object.keys(files), "binding-manifest.json"].sort()
		, capabilityGaps: [{ feature: "additional-platforms"
			, reason: "MRI Ruby 3.3 on Linux x86-64 with 1:1 threads; no Ractor or post-fork use." }] });
	return { ...generated, files, contract, abiHeader };
};
