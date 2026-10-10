/**
 * Prepared Rust APIs over bounded copied graphs and verified native assets.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { cargoPackageMetadata, validatePackageMetadata } from "../../analyze/package-metadata.mjs";
import { generateCopiedRustGraphValues } from "./copied-graph-values.mjs";
import { generateCopiedRustGraphConversions } from "./copied-graph-conversions.mjs";
import { copiedRustAssets } from "./copied-assets.mjs";
import { validateOrdinaryCargoSettings } from "./copied-model.mjs";

const reserved = new Set("dispatch invoke handle token sha2 assets GraphNative graph_runtime graph_error graph_symbol GRAPH_NATIVE GRAPH_PID".split(" "));
const errorSource = `#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    Limit,
    Allocation,
    InvalidNative,
    Load(String),
    Native { code: i32, message: String },
}
impl std::fmt::Display for Error {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Limit => formatter.write_str("Copied value depth, node or storage limit exceeded"),
            Self::Allocation => formatter.write_str("Conversion allocation failed"),
            Self::InvalidNative => formatter.write_str("Native result violates its copied-value contract"),
            Self::Load(message) => formatter.write_str(message),
            Self::Native { code, message } => write!(formatter, "Lean native error {code}: {message}"),
        }
    }
}
impl std::error::Error for Error {}
`;

/**
 * Check public Rust names and native loader symbols before compiling Lean.
 *
 * @param ir - Compiler-checked finite copied graph Binding IR.
 */
export const compileCopiedRustGraphPackageModel = ir => {
	const values = generateCopiedRustGraphValues(ir), { layout } = values, prefix = layout.prefix;
	if(["gmp", "lean_bridge_native", "leanshared"].includes(prefix) || ir.component.id.length >= 160)
		throw new TypeError("Rust graph component name collides with a dependency or exceeds its name limit");
	for(const name of [...ir.types.map(type => type.name), ...layout.roots.map(root => root.name.slice(prefix.length + 1))])
		if(reserved.has(name) || /^graph_(?:ready|retire|initialize|finish|call_|check\d|to\d|from\d|clear\d)/.test(name) || /^call\d+$/.test(name))
			throw new TypeError(`Rust graph package name is reserved: ${name}`);
	return { ...values, ir, prefix, layoutSha256: sha256(canonicalJson(layout)) };
};

const functions = (model, generated) => {
	const nodes = new Map(model.layout.nodes.map(node => [node.id, node]));
	const values = new Map(generated.types.map(node => [node.id, node]));
	const inputs = new Map(generated.inputTypes.map(node => [node.id, node.name]));
	const raw = new Map(generated.rawTypes.map(node => [node.id, node]));
	const definitions = new Map(model.ir.types.map(type => [type.id, type]));
	const output = (id, ref) => ref.kind === "named" ? definitions.get(ref.id).name : values.get(id).name;
	return model.layout.roots.map((root, index) => {
		const declaration = model.ir.declarations.find(item => item.id === root.bindingId);
		const parameters = root.parameters.map((id, i) => {
			const node = nodes.get(id), borrowed = node.aggregate;
			const name = node.element || ["string", "bytes"].includes(node.ref.name) ? inputs.get(id) : output(id, declaration.parameters[i].type);
			return { id, borrowed, type: `${borrowed ? "&" : ""}${name}`, raw: raw.get(id), argument: `${borrowed ? "" : "&"}arg${i}` };
		});
		return { ...root, index, parameters
			, field: root.name.slice(model.prefix.length + 1)
			, output: output(root.result, declaration.result.type)
			, signature: `unsafe extern "C" fn(${[...parameters.map(param => `*const ${param.raw.name}`), `*mut ${raw.get(root.result).name}`].join(", ")}) -> u32` };
	});
};

const nativeSource = (model, generated, exports) => `${generated.source}
#[path = "assets.rs"] mod assets;
unsafe extern "C" { #[link_name = "dlsym"] fn graph_symbol(library: *mut std::ffi::c_void, name: *const std::ffi::c_char) -> *mut std::ffi::c_void; }
struct GraphNative {
    lifecycle: GraphLifecycle,
${exports.map(fn => `    call${fn.index}: ${fn.signature},`).join("\n")}
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
${exports.map(fn => `            call${fn.index}: symbol!("${fn.name}_graph", ${fn.signature}),`).join("\n")}
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
${exports.map(fn => `pub(super) fn call${fn.index}(${fn.parameters.map((param, i) => `arg${i}: ${param.type}`).join(", ")}) -> Result<${fn.output}, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let ${fn.parameters.length ? "mut " : ""}budget = GraphBudget::new();
${fn.parameters.map(param => `    graph_check${param.raw.index}(${param.argument}, 0, true, &mut budget).map_err(graph_error)?;`).join("\n")}
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_${fn.field}_guarded(Some(&runtime.lifecycle), runtime.call${fn.index}${fn.parameters.map(param => `, ${param.argument}`).join("")}) }.map_err(graph_error)
}
`).join("\n")}`;

/**
 * Generate a safe public crate with private checked conversions and lazy loading.
 *
 * @param ir - Compiler-checked finite copied graph Binding IR.
 * @param evidence - Authenticated native library identities, or null for inspection.
 * @param settings - Cargo coordinates and package metadata.
 */
export const generateCopiedRustGraphPackage = (ir, evidence = null, settings = {}) => {
	const model = compileCopiedRustGraphPackageModel(ir), generated = generateCopiedRustGraphConversions(ir);
	const exports = functions(model, generated);
	const name = settings.name ?? `lean_bridge_${model.prefix}`, version = settings.version ?? ir.component.version;
	validateOrdinaryCargoSettings({ name, version });
	const files = {
		"src/lib.rs": `//! Typed copied-value functions from ${ir.component.id}.
#[cfg(not(all(target_os = "linux", target_arch = "x86_64", target_env = "gnu")))]
compile_error!("This Lean crate requires Linux x86-64 with glibc");
mod __runtime;
${errorSource}
${generated.valuesSource}
${exports.map(fn => `/// Lean export: ${fn.bindingId}.
pub fn ${fn.field}(${fn.parameters.map((param, i) => `arg${i}: ${param.type}`).join(", ")}) -> Result<${fn.output}, Error> {
    __runtime::call${fn.index}(${fn.parameters.map((_, i) => `arg${i}`).join(", ")})
}
`).join("\n")}`
		, "src/__runtime.rs": nativeSource(model, generated, exports)
		, "src/assets.rs": copiedRustAssets(evidence)
		, "Cargo.toml": `[package]\nname = "${name}"\nversion = "${version}"\nedition = "2021"\nrust-version = "1.90"\n${cargoPackageMetadata({ description: "Compiled Lean API with owned recursive Rust values", ...validatePackageMetadata(settings.metadata ?? {}) })}\nreadme = "README.md"\ninclude = ["src/**", "native/**", "lean-bridge/**", "README.md", "Cargo.lock", "binding-manifest.json"]\n\n[dependencies]\nnum-bigint = "=0.4.6"\nsha2 = "=0.10.9"\n`
		, "README.md": `# ${name}

Use the prepared crate through Cargo. Public functions accept typed Rust values and return Result<T, Error>. Fixed-width scalars pass by value. Strings, slices, records, variants, options, results, products and big integers are borrowed. Outputs own independent copied values. Construct records and match enum cases by name, without unsafe code or constructor numbers.

Arrays and Lists use Vec, Lean Option uses Option, and Except E T uses Result<T, E>. Binary products retain tuple nesting. None, Some(()) and Some(None) stay distinct. An exported Except has an outer Result for bridge failures and an inner Result for the Lean domain value. Concrete aliases keep their names. Recursive or oversized fields use Box; Vec supplies its own indirection. Nat and Int use num-bigint BigUint and BigInt. Lean native words use u64 and i64 on this 64-bit profile.

The crate embeds its compiled native libraries. Runtime loading is automatic and compatible crates share one Lean runtime. Executables work after the Cargo source tree is removed. Native extraction uses private directories removed after loading; small process registry files are removed at normal exit. Native libraries remain loaded until process exit. Requires Rust 1.90+, Linux x86-64, glibc matching the packaged platform record and writable /tmp. Forked reuse is rejected; embedding beside a runtime loaded outside this Rust loader is not accepted.

Finite copied values may be at most 128 levels deep and visit 262,144 nodes. Arguments and the result share a 16 MiB native-copy budget and a separate 16 MiB accounted Rust conversion-storage budget. These limits do not bound Lean working memory or every allocator overhead. Invalid inputs fail before loading or initializing the runtime. Malformed native output retires it permanently. Limit and recoverable allocation failures preserve runtime usability. RAII releases temporary storage and native outputs on errors or unwinding; process abort and Rust allocations that abort cannot run destructors. Callback, closure, resource and asynchronous payloads remain unsupported in this recursive profile.

${exports.map(fn => `- ${fn.field}: ${fn.bindingId}`).join("\n")}
`
	};
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1
		, generator: { id: "lean-wasm/rust-copied-graph", version: 1 }
		, component: ir.component.id, bindingIrSha256: hashBindingIr(ir)
		, publicModule: "src/lib.rs", internalModule: "src/__runtime.rs"
		, exports: ["Error", ...model.bigint ? ["BigInt", "BigUint"] : [], ...ir.types.map(type => type.name), ...exports.map(fn => fn.field)]
		, files: [...Object.keys(files), "binding-manifest.json"]
		, copiedGraph: { schemaVersion: 1, layoutSha256: model.layoutSha256 }
		, capabilityGaps: [{ feature: "identity-and-effects", reason: "Recursive Cargo packages support finite copied values; callables, resources and asynchronous operations remain outside this profile." }
			, { feature: "additional-platforms", reason: "The native profile requires Rust 1.90+ on Linux x86-64 with glibc." }] }, null, 2)}\n`;
	return Object.freeze(files);
};
