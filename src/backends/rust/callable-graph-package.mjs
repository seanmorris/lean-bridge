/**
 * Prepared Cargo APIs for recursive copied callbacks and owned Lean closures.
 *
 * @file
 */
import { compileCallableRustGraphPackageModel } from "./callable-graph-model.mjs";
import { rustCallableGraphNative } from "./callable-graph-conversions.mjs";
import { rustCallablePublic } from "./callables.mjs";
import { copiedRustAssets } from "./copied-assets.mjs";
import { validateOrdinaryCargoSettings } from "./copied-model.mjs";
import { cargoPackageMetadata, validatePackageMetadata } from "../../analyze/package-metadata.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";

const errors = `#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    Limit,
    Allocation,
    InvalidNative,
    Load(String),
    Native {code: i32, message: String},
    Closed,
    WrongThread,
    CallbackReentry,
}
impl std::fmt::Display for Error {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Limit => formatter.write_str("Copied value depth (128), node (262144), storage (16 MiB) or call nesting (64) limit exceeded"),
            Self::Allocation => formatter.write_str("Conversion allocation failed or the native identity pool is full"),
            Self::InvalidNative => formatter.write_str("Native result violates its copied-value contract"),
            Self::Load(message) => formatter.write_str(message),
            Self::Native {code,message} => write!(formatter,"Lean native error {code}: {message}"),
            Self::Closed => formatter.write_str("Lean closure is closed"),
            Self::WrongThread => formatter.write_str("Lean closure belongs to another thread"),
            Self::CallbackReentry => formatter.write_str("Host callback is already active"),
        }
    }
}
impl std::error::Error for Error {}
`;

const entries = model => [
	...model.functions.map(fn => [`call${fn.index}`, fn.symbol, fn.native])
	, ...[...model.callbacks.values()].flatMap(cb => [
		[`owned${cb.index}`, `${model.prefix}_callback_${cb.key}_lease_call`, cb.native]
		, [`dispose${cb.index}`, `${model.prefix}_callback_${cb.key}_lease_dispose`, 'unsafe extern "C" fn(u64)']
	])
];

const nativeSource = model => `${model.generated.source}
#[path = "assets.rs"] mod assets;
unsafe extern "C" { #[link_name = "dlsym"] fn graph_symbol(library: *mut std::ffi::c_void, name: *const std::ffi::c_char) -> *mut std::ffi::c_void; }
struct GraphNative {
    lifecycle: GraphLifecycle,
${entries(model).map(([field,,type])=>`    ${field}: ${type},`).join('\n')}
}
static GRAPH_NATIVE: std::sync::OnceLock<Result<GraphNative, Error>> = std::sync::OnceLock::new();
static GRAPH_PID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
fn graph_runtime() -> Result<&'static GraphNative, Error> {
    let pid = std::process::id();
    let owner = GRAPH_PID.compare_exchange(0, pid, std::sync::atomic::Ordering::Relaxed, std::sync::atomic::Ordering::Relaxed).unwrap_or_else(|owner| owner);
    if owner != 0 && owner != pid { return Err(Error::Load("Start a fresh process after fork to use Lean".into())); }
    GRAPH_NATIVE.get_or_init(|| {
        let library = assets::load()? as *mut std::ffi::c_void;
        macro_rules! symbol { ($name:literal, $type:ty) => {{
            let name = concat!($name, "\\0");
            let value = unsafe { graph_symbol(library, name.as_ptr().cast()) };
            if value.is_null() { return Err(Error::Load(format!("Missing native symbol {}", $name))); }
            unsafe { std::mem::transmute::<*mut std::ffi::c_void, $type>(value) }
        }}; }
        Ok(GraphNative {
            lifecycle: GraphLifecycle {
                initialize: symbol!("${model.prefix}_graph_initialize", unsafe extern "C" fn() -> u32),
                ready: symbol!("${model.prefix}_graph_ready", unsafe extern "C" fn() -> i32),
                retire: symbol!("${model.prefix}_graph_retire", unsafe extern "C" fn()),
            },
${entries(model).map(([field,symbol,type])=>`            ${field}: symbol!("${symbol}", ${type}),`).join('\n')}
        })
    }).as_ref().map_err(Clone::clone)
}
fn graph_error(error: GraphError) -> Error {
    match error {
        GraphError::Limit => Error::Limit,
        GraphError::Allocation => Error::Allocation,
        GraphError::InvalidNative => Error::InvalidNative,
        GraphError::InvalidInput => Error::Native { code: 1, message: "Invalid copied value".into() },
        GraphError::Unavailable => Error::Native { code: 5, message: "Lean runtime initialization failed or runtime retired".into() },
    }
}
${rustCallableGraphNative(model)}`;

/**
 * Generate a safe public crate with private conversions and verified assets.
 *
 * @param ir - Checked copied and synchronous callable Binding IR.
 * @param evidence - Authenticated native libraries, or null for inspection.
 * @param settings - Cargo coordinates and package metadata.
 */
export const generateCallableRustGraphPackage = (ir, evidence = null, settings = {}) => {
	const model = compileCallableRustGraphPackageModel(ir);
	const name = settings.name ?? `lean_bridge_${model.prefix}`, version = settings.version ?? ir.component.version;
	validateOrdinaryCargoSettings({ name, version });
	const files = {};
	const lib = `//! Typed copied values and synchronous Lean callbacks from ${ir.component.id}.
#[cfg(not(all(target_os = "linux", target_arch = "x86_64", target_env = "gnu")))]
compile_error!("This Lean crate requires Linux x86-64 with glibc");
mod __runtime;
${errors}
${model.generated.valuesSource}
`;
	files["src/lib.rs"] = lib + rustCallablePublic(model) + model.functions.map(fn => `/// Lean export: ${fn.declaration.id}.
pub fn ${fn.name}(${fn.parameters.map(({value},i)=>`arg${i}: ${value.inputType}`).join(', ')}) -> Result<${fn.result.publicType}, Error> {
    __runtime::call${fn.index}(${fn.parameters.map((_,i)=>`arg${i}`).join(', ')})
}
`).join('\n');
	files["src/__runtime.rs"] = nativeSource(model);
	files["src/assets.rs"] = copiedRustAssets(evidence);
	files["Cargo.toml"] = `[package]\nname = "${name}"\nversion = "${version}"\nedition = "2021"\nrust-version = "1.90"\n${cargoPackageMetadata({ description: "Compiled Lean API with recursive copied values and owned closures", ...validatePackageMetadata(settings.metadata ?? {}) })}\nreadme = "README.md"\ninclude = ["src/**", "native/**", "lean-bridge/**", "README.md", "Cargo.lock", "binding-manifest.json"]\n\n[dependencies]\nnum-bigint = "=0.4.6"\nsha2 = "=0.10.9"\n`;
	files["README.md"] = `# ${name}

Use the prepared crate through Cargo. Functions accept typed Rust values and return Result<T, Error>. The crate loads its embedded native libraries automatically. Consumers need no Lean compiler or C build tools. Compatible crates share one Lean runtime. Executables continue working after the Cargo source tree is removed.

Records and enum cases preserve named fields. Arrays and Lists use Vec, Option uses Option, and Except E T uses Result<T, E>. Binary products keep tuple nesting. None, Some(()) and Some(None) remain distinct. An exported Except has an outer Result for bridge failures and an inner Result for the Lean domain value. Concrete aliases keep their names. Recursive or oversized fields use Box; Vec supplies its own indirection. Fixed-width inputs pass by value. Strings, slices, records, variants, options, results, products and big integers are borrowed. Outputs own independent copied values. Nat and Int use num-bigint BigUint and BigInt. Native words are 64-bit.

Callback parameters accept synchronous FnMut closures returning Result. Each invocation receives independently owned copies. Returned callback values stay alive until Lean has copied them. The bridge returns host errors to the original Rust caller and resumes panics after leaving C. Borrowed callbacks expire when the exporting call returns; captured Lean closures cannot extend a host borrow. Async callbacks and identity-bearing copied fields are not accepted.

Returned LeanClosure values own their captured Lean values. Call close for explicit disposal or rely on Drop. Closing is idempotent. A close during an active invocation defers disposal until that invocation returns. Closures belong to their creating thread's lifetime, are neither Send nor Sync, and cannot be cloned. Calls after close and post-fork reuse are rejected.

Values may be at most 128 levels deep and visit 262,144 nodes. A native call shares 16 MiB of copy storage across its inputs, callbacks and output. Rust conversion storage has its own 16 MiB accounted budget. Same-thread reentry is bounded to 64 active native invocations. Owned closures share the runtime's 4,096-identity capacity. These limits do not bound Lean working memory or every Rust allocator overhead. Input validation, host errors and recoverable allocation failures leave the runtime usable. Malformed native results retire it permanently. RAII cleans up on errors and unwinding; process abort and allocator abort cannot run destructors.

Requires Rust 1.90+, Linux x86-64, glibc matching the packaged platform record and writable /tmp. Native extraction uses private directories removed after loading. Small process registry files are removed at normal exit. Native libraries remain loaded until process exit. Runtime loading beside an unverified external Lean runtime is rejected.

${model.functions.map(fn=>`- ${fn.name}: ${fn.declaration.id}`).join('\n')}
`;
	files["binding-manifest.json"] = JSON.stringify({ schemaVersion: 1
		, generator: { id: "lean-wasm/rust-callable-graph", version: 1 }
		, component: ir.component.id, bindingIrSha256: hashBindingIr(ir)
		, publicModule: "src/lib.rs", internalModule: "src/__runtime.rs"
		, exports: model.exports
		, files: [...Object.keys(files), "binding-manifest.json"]
		, copiedGraph: { schemaVersion: 1, layoutSha256: model.layoutSha256 }
		, capabilityGaps: [{ feature: "identity-and-effects", reason: "Recursive copied fields cannot contain resource or callable identities; asynchronous operations remain outside this profile." }
			, { feature: "additional-platforms", reason: "The accepted native profile is Rust 1.90+ on Linux x86-64." }] }, null, 2) + "\n";
	return Object.freeze(files);
};
