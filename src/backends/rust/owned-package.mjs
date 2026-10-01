/**
 * Prepared Rust sources with authenticated automatic native loading.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { cargoPackageMetadata, validatePackageMetadata } from "../../analyze/package-metadata.mjs";
import { validateOrdinaryCargoSettings } from "./copied-model.mjs";
import { copiedRustAssets } from "./copied-assets.mjs";
import { generateOwnedRustCallables } from "./owned-callables.mjs";

const nativeSource = generated => {
	const runtime = ["session_open", "session_close", "result_release"].map(field => ({ field
		, symbol: `${generated.c.prefix}_${field}`
		, type: 'unsafe extern "C" fn(*mut *mut c_void) -> u32' }));
	if(generated.c.anchoredResults) runtime.push({ field: "result_validate"
		, symbol: `${generated.c.prefix}_result_validate`
		, type: 'unsafe extern "C" fn(*mut c_void, *mut c_void) -> u32' });
	const entries = [...runtime, ...generated.nativeEntries];
	return `${generated.source}
#[path = "assets.rs"] mod assets;
unsafe extern "C" { #[link_name = "dlsym"] fn owned_symbol(library: *mut c_void, name: *const std::ffi::c_char) -> *mut c_void; }
pub(crate) struct OwnedNative {
${entries.map(entry => `    ${runtime.includes(entry) ? "pub(crate) " : ""}${entry.field}: ${entry.type},`).join("\n")}
}
static OWNED_NATIVE: std::sync::OnceLock<Result<OwnedNative, Error>> = std::sync::OnceLock::new();
static OWNED_NATIVE_PID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
pub(crate) fn owned_native_api() -> Result<&'static OwnedNative, Error> {
    let pid = std::process::id();
    let previous = OWNED_NATIVE_PID.compare_exchange(0, pid, std::sync::atomic::Ordering::Relaxed, std::sync::atomic::Ordering::Relaxed).unwrap_or_else(|previous| previous);
    if previous != 0 && previous != pid { return Err(Error::WrongProcess); }
    OWNED_NATIVE.get_or_init(|| {
        let library = assets::load()? as *mut c_void;
        macro_rules! symbol { ($name:literal, $type:ty) => {{
            let name = concat!($name, "\\0");
            let pointer = unsafe { owned_symbol(library, name.as_ptr().cast()) };
            if pointer.is_null() { return Err(Error::Load(format!("Missing native symbol {}", $name))); }
            unsafe { std::mem::transmute::<*mut c_void, $type>(pointer) }
        }}; }
        Ok(OwnedNative {
${entries.map(entry => `            ${entry.field}: symbol!("${entry.symbol}", ${entry.type}),`).join("\n")}
        })
    }).as_ref().map_err(Clone::clone)
}
`;
};

/**
 * Bind generated types, callbacks and loader inputs into a deterministic crate.
 * The builder must authenticate evidence and supply the named native libraries.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param evidence - Verified native library identities, or null for inspection.
 * @param settings - Cargo coordinates and package metadata.
 * @param options - Compiler-authenticated ownership capabilities.
 * @param options.transferredInputs - Enable explicit mutable input consumption.
 * @param options.anchoredResults - Keep whole original owners for borrowed results.
 * @param options.receiverExports - Expose checked nominal receiver members.
 * @param options.hostCallbacks - The compiled adapter provides callbacks and copies.
 */
export const generateOwnedRustPackage = (ir, evidence = null, settings = {}, { transferredInputs = false, anchoredResults = false, receiverExports = false, hostCallbacks = true } = {}) => {
	const generated = generateOwnedRustCallables(ir, { dynamic: true, transferredInputs, anchoredResults, receiverExports, hostCallbacks });
	const transfers = generated.c.functions.some(item => item.transfers?.length);
	const anchors = Boolean(generated.c.anchoredResults);
	const receivers = generated.c.functions.filter(item => item.receiver === 0), wholeOwners = anchors || receivers.length > 0;
	const name = settings.name ?? `lean_bridge_${generated.c.prefix}`, version = settings.version ?? ir.component.version;
	validateOrdinaryCargoSettings({ name, version });
	const source = nativeSource(generated);
	const files = {
		"src/lib.rs": `//! Typed ownership-aware Lean API from ${ir.component.id}.
#[cfg(not(all(target_os = "linux", target_arch = "x86_64", target_env = "gnu")))]
compile_error!("This Lean crate requires Linux x86-64 with glibc");
mod owned_values;
${generated.apiSource}`
		, "src/owned_values.rs": source
		, "src/assets.rs": copiedRustAssets(evidence)
		, "Cargo.toml": `[package]\nname = "${name}"\nversion = "${version}"\nedition = "2021"\nrust-version = "1.90"\n${cargoPackageMetadata({ description: "Compiled Lean API with explicitly owned structured values", ...validatePackageMetadata(settings.metadata ?? {}) })}\nreadme = "README.md"\ninclude = ["src/**", "native/**", "lean-bridge/**", "README.md", "Cargo.lock", "binding-manifest.json"]\n\n[dependencies]\nnum-bigint = "=0.4.6"\nsha2 = "=0.10.9"\n`
		, "README.md": `# ${name}

Prepared ownership-aware Rust API from ${ir.component.id}. Rust 1.90 or newer,
Linux x86-64 with glibc. Add this crate as a Cargo dependency and import its API.
The crate verifies and loads its bundled native libraries automatically. Consumers
do not install Lean or GMP, pass linker flags, or configure shared-library paths.

Records and enums preserve source fields and constructors. Arrays and lists use
Vec, options use Option, Except uses Result<Success, ErrorPayload>, and products
use tuples. Recursive inline fields use Box. Aliases stay transparent. Nat and
Int use exact BigUint and BigInt. Strings preserve UTF-8 and embedded NUL; byte
arrays use Vec<u8>. Scalar arguments pass by value; larger inputs borrow.

Resource fields retain checked ownership leases. Cloning a value independently
copies its container storage and shares resource leases. close() releases that
wrapper; other owning clones remain usable. retain() creates independent native
ownership. Resources and returned Lean closures are neither Send nor Sync.
Calls reject closed and inherited post-fork resources. Drop releases their owners
on the creating thread; a fresh process is required after fork.
${anchors ? `
This package has input-anchored borrowed results. Resource-containing results use
Value<T>, including empty containers and constructors. get() checks the whole
owner and returns Result<&T, Error>. Clones share immutable storage and ownership;
close() releases this clone. Borrowed results do not keep their anchor alive.
Their descendants expire when the original owner is released or transferred.
retain() on Value and copy_value(&host_value) create independent owners.
Previously extracted references do not revalidate ordinary copied field reads;
resource operations still validate their own lifetime. try_equal() and resource
same_identity() return errors for expired values. PartialEq returns false on an
invalid lifetime and compares canonical resource identity for valid values.
` : ""}${receivers.length ? `
Declared methods and properties are snake_case methods on Value<NominalType>.
Properties are zero-argument accessors such as owner.serial(). Copied fields remain
fields of the value returned by get(). Non-consuming receivers take &self;
consuming receivers take &mut self. The free functions remain available.
Resource-containing results retain their whole original owner, including empty
containers. Value<T> clones share immutable storage and ownership; close()
releases this clone, and get() checks the owner before returning its value.
Raw resource wrappers expose only members that do not require that
whole receiver owner. A borrowed result anchored to another argument expires with
that argument, not with the receiver.
` : ""}${transfers && wholeOwners ? `
Transferred inputs take &mut Value<T> and consume the original owner, including
empty values. Validation and preparation failures preserve the owner. Handoff
closes aliases and borrowed descendants before callbacks can reenter. Subsequent
errors and panics leave the input consumed. Borrowed roots cannot transfer; retain
them first. A call cannot consume its result anchor or that anchor's ancestor.
` : transfers ? `
Transferred inputs take explicit &mut references. Validation and preparation
finish before any input is consumed. At the Lean call boundary, every resource
lease represented in a transferred input becomes closed, including cloned
aliases and sibling resources sharing its original result owner. Copied fields
remain ordinary Rust values. Independently retained resources stay usable.
Callback-frame borrows cannot be transferred; retain them first. Two transferred
arguments cannot consume the same lease. After handoff, errors and panics leave
the inputs consumed; validation or preparation failures leave them usable.
` : ""}${!receivers.length || hostCallbacks ? `
Callbacks accept synchronous FnMut functions returning Result. Callback arguments
own their copied storage, while resource leaves borrow the callback frame. Those
borrows expire on return, including cloned wrappers. Call retain() inside the
callback to keep a resource. Returned values are snapshotted before callback
locals disappear. Returned Lean closures expose call() and retain(), and can be
passed as callback arguments. A captured host callback cannot outlive its borrow.

Host errors return to the original Rust caller. Original panic payloads resume
only after C has returned; no Rust panic crosses a C trampoline. Signatures that
cannot derive failure recovery from their arguments require
with_recovery(callback, typed_value). Recovery is never a successful result.
` : ""}
Conversions enforce depth 128, 262,144 visits and 16 MiB native/storage budgets. Invalid
inputs, malformed outputs and partial conversions release their temporary owners.
These budgets do not bound Lean algorithm memory or every allocator overhead.
Rust and GMP retain their normal fatal allocator-exhaustion policies.
`
	};
	const contract = { schemaVersion: receivers.length ? 4 : anchors ? 3 : transfers ? 2 : 1
		, language: "rust-1.90"
		, ownership: "checked-result-leases", callbackLifetime: "call"
		, explicitRetention: "retain", callbackFailure: "resume-after-native-return"
		, ...transfers ? { inputTransfers: { schemaVersion: 1
			, arguments: "mutable-references", consumption: "before-lean-call"
			, validation: "before-consumption", failure: "consumed-after-handoff"
			, aliases: "shared-lease", borrowedInputs: "reject"
			, independentRetains: "preserved" } } : {}
		, ...anchors ? { resultAnchors: { schemaVersion: 1
			, values: "checked-whole-result", anchor: "original-result-owner"
			, expiration: "owner-release-or-transfer", descendants: "transitive"
			, emptyValues: "owner-preserved", aliases: "shared-owner"
			, independentOwnership: "retain-or-copy_value"
			, resourceEquality: "canonical-identity", invalidEquality: "false"
			, fallibleEquality: "try_equal-or-same_identity"
			, transfers: "original-owner" } } : {}
		, ...receivers.length ? { receiverExports: { schemaVersion: 1
			, values: "checked-whole-result", members: "snake-case"
			, properties: "zero-argument-methods"
			, consumingReceivers: "mutable-references"
			, exports: receivers.map(item => {
				const declaration = ir.declarations.find(declaration => declaration.id === item.id);
				return { bindingId: item.id, owner: declaration.owner
					, kind: declaration.kind
					, member: item.cName.slice(generated.c.prefix.length + 1) };
			})
		} } : {}
		, exactIntegers: "num-bigint-0.4.6", loader: "authenticated-embedded-native"
		, apiSha256: sha256(generated.apiSource), conversionsSha256: sha256(source)
		, limits: generated.c.native.model.limits };
	files["binding-manifest.json"] = canonicalJson({ schemaVersion: receivers.length ? 4 : anchors ? 3 : transfers ? 2 : 1
		, backend: receivers.length ? "owned-rust-v4" : anchors ? "owned-rust-v3" : transfers ? "owned-rust-v2" : "owned-rust-v1"
		, bindingIrSha256: generated.c.native.model.bindingIrSha256
		, component: ir.component, contract, evidence
		, publicModule: "src/lib.rs", files: Object.keys(files).sort()
		, capabilityGaps: [] });
	const abiHeader = `#pragma once
#include "${generated.c.prefix}.h"
_Static_assert(sizeof(void*) == 8 && sizeof(size_t) == 8 && sizeof(bool) == 1, "Owned Rust requires the Linux x86-64 C ABI");
_Static_assert(GMP_NUMB_BITS == 64 && sizeof(mp_limb_t) == 8 && sizeof(int) == 4, "Owned Rust requires nail-free 64-bit GMP limbs");
_Static_assert(sizeof(__mpz_struct) == 16 && _Alignof(__mpz_struct) == 8 && offsetof(__mpz_struct, _mp_alloc) == 0 && offsetof(__mpz_struct, _mp_size) == 4 && offsetof(__mpz_struct, _mp_d) == 8, "Owned Rust GMP layout");
_Static_assert(sizeof(${generated.c.prefix}_status) == 4, "Owned Rust status layout");
${generated.types.filter(node => node.kind === "variant").map(node => `_Static_assert(sizeof(${node.cName}_kind) == 4, "Owned Rust variant layout");`).join("\n")}
`;
	contract.abiHeaderSha256 = sha256(abiHeader);
	// Include the finalized ABI contract in the manifest as well as the adapter.
	const manifest = JSON.parse(files["binding-manifest.json"]); manifest.contract = contract;
	files["binding-manifest.json"] = canonicalJson(manifest);
	return { ...generated, files, contract, name, version, abiHeader };
};
