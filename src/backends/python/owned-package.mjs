/**
 * Prepared Python sources for checked resource-bearing values and callbacks.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { ownedPythonAssets } from "./owned-assets.mjs";
import { generateOwnedPythonConversions } from "./owned-conversions.mjs";
import { ownedPythonRuntime } from "./owned-runtime.mjs";

/**
 * Bind the typed public API to authenticated automatic native loading.
 * The wheel builder must verify evidence and include its native libraries.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param evidence - Verified native library identities, or null for inspection.
 * @param options - Compiler-authenticated ownership capabilities.
 * @param options.transferredInputs - Enable explicitly consuming input leases.
 * @param options.anchoredResults - Preserve whole original owners for borrowed results.
 */
export const generateOwnedPythonPackage = (ir, evidence = null, { transferredInputs = false, anchoredResults = false } = {}) => {
	const generated = generateOwnedPythonConversions(ir, { transferredInputs, anchoredResults }), prefix = generated.c.prefix;
	const transfers = generated.c.functions.some(item => item.transfers?.length);
	const anchors = Boolean(generated.c.anchoredResults);
	const { packageDir } = generated;
	const publicModule = `${packageDir}/__init__.py`, typeStub = `${packageDir}/__init__.pyi`;
	const runtime = ownedPythonRuntime(prefix, { transferredInputs: transfers, anchoredResults: anchors });
	const source = `${generated.source}\nfrom . import _assets as _Assets\n_bind(_R._OwnedRuntime(_Assets._LIBRARY, _Assets._ensure_process))\n`;
	const abiHeader = `#pragma once
#include "${prefix}.h"
_Static_assert(sizeof(void*) == 8 && sizeof(size_t) == 8 && sizeof(bool) == 1, "Owned Python requires the Linux x86-64 C ABI");
_Static_assert(GMP_NUMB_BITS == 64 && sizeof(mp_limb_t) == 8 && sizeof(int) == 4, "Owned Python requires nail-free 64-bit GMP limbs");
_Static_assert(sizeof(__mpz_struct) == 16 && _Alignof(__mpz_struct) == 8 && offsetof(__mpz_struct, _mp_alloc) == 0 && offsetof(__mpz_struct, _mp_size) == 4 && offsetof(__mpz_struct, _mp_d) == 8, "Owned Python GMP layout");
_Static_assert(sizeof(${prefix}_status) == 4, "Owned Python status layout");
${generated.types.filter(node => node.kind === "variant").map(node => `_Static_assert(sizeof(${node.cName}_kind) == 4, "Owned Python variant layout");`).join("\n")}
`;
	const contract = { schemaVersion: anchors ? 3 : transfers ? 2 : 1
		, language: "python-3.11"
		, ownership: "checked-result-leases", callbackLifetime: "call"
		, explicitRetention: "retain", callbackFailure: "raise-after-native-return"
		, ...transfers ? { inputTransfers: { schemaVersion: 1
			, arguments: anchors ? "whole-values" : "ordinary-values"
			, consumption: "before-lean-call"
			, validation: "before-consumption", failure: "consumed-after-handoff"
			, aliases: "shared-lease", borrowedInputs: "reject"
			, independentRetains: "preserved" } } : {}
		, ...anchors ? { resultAnchors: { schemaVersion: 1
			, values: "checked-whole-result", anchor: "original-result-owner"
			, expiration: "owner-release-or-transfer", descendants: "transitive"
			, emptyValues: "owner-preserved", aliases: "shared-owner"
			, independentOwnership: "retain-or-copy_value"
			, copyType: "nominal-or-result_of-or-parameter_of"
			, resourceEquality: "canonical-identity", invalidEquality: "raise"
			, transfers: "original-owner" } } : {}
		, exactIntegers: "python-int", loader: "authenticated-bundled-native"
		, publicSha256: sha256(generated.valuesSource)
		, stubSha256: sha256(generated.stub)
		, conversionsSha256: sha256(source), runtimeSha256: sha256(runtime)
		, loaderSha256: sha256(ownedPythonAssets(null))
		, abiHeaderSha256: sha256(abiHeader)
		, limits: generated.c.native.model.limits };
	const files = {
		[publicModule]: `${generated.valuesSource}\nfrom . import _native as _OwnedNative\n`
		, [typeStub]: generated.stub
		, [`${packageDir}/_owned.py`]: runtime
		, [`${packageDir}/_native.py`]: source
		, [`${packageDir}/_assets.py`]: ownedPythonAssets(evidence)
		, [`${packageDir}/py.typed`]: ""
		, "README.md": `# ${packageDir}

Install the prepared platform wheel with pip and import ${packageDir}.
The wheel verifies and loads its bundled Lean runtime and GMP automatically.
Consumers do not need Lean, a C compiler, ctypes setup or shared-library paths.
This native profile requires GIL-enabled Python 3.11+ on Linux x86-64, with
glibc at least as new as the wheel's manylinux tag.

Records and variant constructors are frozen dataclasses. Arrays and Lists
accept lists or tuples and return independent tuples. Option is None or
Some(value), so Some(None) stays distinct. Except uses Ok(value) and Err(value).
Products keep their nested two-element tuples. Concrete aliases retain their
names. Nat and Int use exact Python integers; fixed-width integers check their
ranges and reject Boolean coercion. Strings preserve Unicode scalar text and
embedded NUL; ByteArray is bytes. Float32 rounds to binary32. Unit is None.

Resource fields carry checked ownership leases. Shallow copies share a lease;
closing one wrapper does not invalidate another owning copy. retain() creates
independent native ownership. Use with blocks or close() for explicit release.
Finalization supplies fallback cleanup on the creating thread. Resources reject
use from other threads, after their creating thread exits, or after fork.
Start a fresh interpreter after fork. Deep copying and serialization of resource
identities are rejected.
${anchors ? `
Resource-containing results use Value[T], including empty containers and
constructors. get() validates the whole result owner. Shallow Value copies share
immutable storage and the original lease; close() releases this wrapper. Borrowed
results do not keep their anchor alive. They and their descendants expire when
the original owner is released or transferred. Resource wrappers extracted by
get() can also share an owning lease; releasing the last owning alias releases
that owner. Copied field reads do not revalidate, but resource operations do.
Equality checks lifetime and canonical resource identity; expired values raise.

Value.retain() and copy_value(host_value) create independent owners. Nominal
records, variants and resources identify their own type. For containers and empty
values, select the public result type with result_of=api.function, or an argument
type with parameter_of=(api.function, "arg0"). These selectors do not call the
function. Returned Lean closures use callable Value wrappers.
` : ""}${transfers && anchors ? `
Transferred inputs take Value roots and consume the original owner, including
empty values. Validation and preparation failures preserve inputs. Handoff
closes aliases and borrowed descendants before callbacks can reenter. Errors
after handoff leave inputs consumed. Borrowed roots cannot transfer; retain them
first. A call cannot consume its result anchor or that anchor's ancestor.
` : transfers ? `
Functions with transferred inputs accept ordinary Python values. Validation and
preparation finish before any input is consumed. At the Lean call boundary,
resource leases in transferred inputs become closed, including shallow aliases
and sibling resources sharing their result owner. Copied fields remain usable.
Independently retained resources stay open. Callback-frame borrows cannot be
transferred; call retain() first. Two transferred arguments cannot share a lease.
Validation and preparation failures leave inputs usable; errors after handoff
leave them consumed, including callback exceptions and result-conversion errors.
` : ""}
Pass synchronous Python functions to callback parameters. Callback containers
are independent values, but resource leaves borrow the callback frame and expire
on return. Call retain() inside the callback to keep a resource. Callback-local
replies are snapshotted before their storage disappears. Returned Lean closures
are callable and support retain() and close(); they can also serve as callback
arguments. A Lean closure cannot extend the lifetime of a borrowed host callback.
Signatures that cannot derive a failure-path value from their arguments require
with_recovery(function, typed_value). Recovery never becomes a successful result.

Callback exceptions return to the original Python caller after C has unwound.
Async functions and awaitable replies are rejected. Failed output conversions
revoke partial wrappers even when the caller retains the exception traceback.
Malformed native values retire the runtime; ordinary validation and recoverable
allocation failures leave it usable.

Conversions limit depth to 128, visits to 262,144, native conversion data to
16 MiB and accounted Python conversion storage to another 16 MiB. A call shares
these budgets across its inputs, callbacks and result. These limits do not bound
Lean's algorithm memory or every Python allocator overhead. Recursive type
aliases use typing_extensions >=4.6,<5 on Python 3.11 and the standard library
on Python 3.12+; pip installs the backport when needed.
`
	};
	files["binding-manifest.json"] = canonicalJson({ schemaVersion: anchors ? 3 : transfers ? 2 : 1
		, backend: anchors ? "owned-python-v3" : transfers ? "owned-python-v2" : "owned-python-v1"
		, component: ir.component.id
		, bindingIrSha256: generated.c.native.model.bindingIrSha256
		, publicModule, typeStub, internalModule: `${packageDir}/_native.py`
		, exports: generated.exports, contract, evidence
		, files: [...Object.keys(files), "binding-manifest.json"].sort()
		, capabilityGaps: [{ feature: "additional-platforms"
			, reason: "GIL-enabled Python 3.11+ on Linux x86-64; no subinterpreter or post-fork use." }] });
	return { ...generated, files, contract, abiHeader
		, requiresTypeAliases: generated.valuesSource.includes("_TypeAliasType") };
};
