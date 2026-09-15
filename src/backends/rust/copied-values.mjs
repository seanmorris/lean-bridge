/**
 * Render typed ordinary Rust APIs with private C calls and RAII cleanup.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { readFile } from "node:fs/promises";
import { compileCopiedRustModel, validateOrdinaryCargoSettings } from "./copied-model.mjs";
import { copiedRustAssets } from "./copied-assets.mjs";
import { copiedRustConversions, copiedRustHelpers, copiedRustTypes } from "./copied-conversions.mjs";

const exported = model => ["Error", "BigInt", "BigUint", ...model.surface.copies.filter(copy => copy.record).map(copy => copy.publicName), ...model.surface.functions.map(fn => fn.field)];
const publicSource = model => `//! Typed copied-value functions from ${model.ir.component.id}.
#[cfg(not(all(target_os = "linux", target_arch = "x86_64", target_env = "gnu")))]
compile_error!("This Lean crate requires Linux x86-64 with glibc");
pub use num_bigint::{BigInt, BigUint};
mod __runtime;

#[derive(Clone, Debug, PartialEq, Eq)]
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
            Self::Limit => formatter.write_str("16 MiB conversion limit exceeded"),
            Self::Allocation => formatter.write_str("Conversion allocation failed"),
            Self::InvalidNative => formatter.write_str("Native result violates its copied-value contract"),
            Self::Load(message) => formatter.write_str(message),
            Self::Native { code, message } => write!(formatter, "Lean native error {code}: {message}"),
        }
    }
}
impl std::error::Error for Error {}

${model.surface.copies.filter(copy => copy.record).map(copy => `#[derive(Clone, Debug, PartialEq)]
pub struct ${copy.publicName} {
${copy.fields.map(field => `    pub ${field.name}: ${field.type.publicType},`).join("\n")}
}
`).join("\n")}
${model.surface.functions.map((fn, index) => `/// Lean export: ${fn.declaration.id}.
pub fn ${fn.field}(${fn.parameters.map((parameter, i) => `${parameter.name}: ${model.surface.copy(fn.declaration.parameters[i].type).inputType}`).join(", ")}) -> Result<${model.surface.copy(fn.declaration.result.type).publicType}, Error> {
    __runtime::call${index}(${fn.parameters.map(parameter => parameter.name).join(", ")})
}
`).join("\n")}`;

const signature = (model, fn) => `unsafe extern "C" fn(${fn.declaration.parameters.map(site => { const copy = model.surface.copy(site.type); return copy.aggregate ? `*const ${copy.ctype}` : copy.ctype; }).concat(fn.resultType === "void" ? [] : [`*mut ${model.surface.copy(fn.declaration.result.type).ctype}`]).concat("*mut NativeError").join(", ")}) -> i32`;

const nativeSource = model => `#![allow(dead_code, unused_imports, unused_variables)]
use crate::{${exported(model).filter(name => !model.surface.functions.some(fn => fn.field === name)).join(", ")}};
use std::sync::{OnceLock, atomic::{AtomicU32, Ordering}};
#[path = "assets.rs"] mod assets;
unsafe extern "C" { fn dlsym(library: *mut std::ffi::c_void, name: *const std::ffi::c_char) -> *mut std::ffi::c_void; }
${copiedRustTypes(model)}
${copiedRustHelpers}
struct Native {
${model.surface.copies.filter(copy => copy.aggregate).map(copy => `    clear${copy.index}: unsafe extern "C" fn(*mut ${copy.ctype}),`).join("\n")}
${model.surface.functions.map((fn, i) => `    call${i}: ${signature(model, fn)},`).join("\n")}
}
static NATIVE: OnceLock<Result<Native, Error>> = OnceLock::new();
static PID: AtomicU32 = AtomicU32::new(0);
fn runtime() -> Result<&'static Native, Error> {
    let pid = std::process::id();
    let owner = PID.compare_exchange(0, pid, Ordering::Relaxed, Ordering::Relaxed).unwrap_or_else(|owner| owner);
    if owner != 0 && owner != pid { return Err(Error::Load("Start a fresh process after fork to use Lean".into())); }
    NATIVE.get_or_init(|| {
        let library = assets::load()? as *mut std::ffi::c_void;
        macro_rules! symbol { ($name:literal, $type:ty) => {{
            let name = concat!($name, "\\0");
            let value = unsafe { dlsym(library, name.as_ptr().cast()) };
            if value.is_null() { return Err(Error::Load(format!("Missing native symbol {}", $name))); }
            unsafe { std::mem::transmute::<*mut std::ffi::c_void, $type>(value) }
        }}; }
        Ok(Native {
${model.surface.copies.filter(copy => copy.aggregate).map(copy => `            clear${copy.index}: symbol!("${copy.name}_clear", unsafe extern "C" fn(*mut ${copy.ctype})),`).join("\n")}
${model.surface.functions.map((fn, i) => `            call${i}: symbol!("${fn.name}", ${signature(model, fn)}),`).join("\n")}
        })
    }).as_ref().map_err(Clone::clone)
}
${copiedRustConversions(model)}
${model.surface.functions.map((fn, index) => {
	const result = model.surface.copy(fn.declaration.result.type), unit = fn.resultType === "void";
	const args = fn.declaration.parameters.map((site, i) => model.surface.copy(site.type).aggregate ? `&input${i}` : `input${i}`).concat(unit ? [] : [result.aggregate ? "&mut output.value" : "&mut output"]).concat("&mut error").join(", ");
	return `pub(super) fn call${index}(${fn.declaration.parameters.map((site, i) => `arg${i}: ${model.surface.copy(site.type).inputType}`).join(", ")}) -> Result<${result.publicType}, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    ${unit ? "" : result.aggregate ? `let mut output = Output { value: ${result.ctype}::default(), clear: native.clear${result.index} };` : `let mut output: ${result.ctype} = Default::default();`}
    let mut error = NativeError::default();
${fn.declaration.parameters.map((site, i) => `    let input${i} = to${model.surface.copy(site.type).index}(&arg${i}, &mut scope)?;`).join("\n")}
    check(unsafe { (native.call${index})(${args}) }, &error)?;
    ${unit ? "Ok(())" : `from${result.index}(&output${result.aggregate ? ".value" : ""}, &mut scope)`}
}
`;
}).join("\n")}`;

/**
 * Render a closed source crate with verified native assets when supplied.
 *
 * @param model - Admitted Rust projection.
 * @param evidence - Native artifact identities or null.
 * @param settings - Cargo coordinates.
 */
export const renderCopiedRustPackage = (model, evidence = null, settings = {}) => {
	const name = settings.name ?? `lean_bridge_${model.surface.prefix}`, version = settings.version ?? model.ir.component.version;
	validateOrdinaryCargoSettings({ name, version });
	const files = {
		"src/lib.rs": publicSource(model)
		, "src/__runtime.rs": nativeSource(model)
		, "src/assets.rs": copiedRustAssets(evidence)
		, "Cargo.toml": `[package]\nname = "${name}"\nversion = "${version}"\nedition = "2021"\nrust-version = "1.90"\ndescription = "Compiled Lean API with typed Rust copied values"\nreadme = "README.md"\ninclude = ["src/**", "native/**", "lean-bridge/**", "README.md", "Cargo.lock", "binding-manifest.json"]\n\n[dependencies]\nnum-bigint = "=0.4.6"\nsha2 = "=0.10.9"\n`
		, "README.md": `# ${name}\n\nUse the prepared crate through Cargo. Public functions borrow strings, slices, records and big integers and return owned Result values. Rust widths enforce fixed-width integer ranges. Nat and Int use re-exported num-bigint BigUint and BigInt; Unit is (). Arrays use Vec, text uses String, bytes use Vec<u8>, and records are generated structs.\n\nThe crate embeds its compiled native libraries. Runtime loading is automatic and compatible crates share one Lean runtime. Executables work after the Cargo source tree is removed. Native extraction uses private directories removed after loading; small process registry files are removed at normal exit. Native libraries remain loaded until process exit. Requires Rust 1.90+, Linux x86-64, glibc matching the packaged platform record and writable /tmp. Forked reuse is rejected; embedding beside a runtime loaded outside this Rust loader is not accepted.\n\nPure acyclic copied types, at most 32 levels deep. Rust and native conversions each use a 16 MiB accounting budget; Rust array bookkeeping counts at least eight bytes per element. These limits do not bound Lean working memory or every Rust allocation. Native outputs use RAII even on errors or unwinding. Process abort and allocation failure that aborts Rust cannot run destructors.\n\n${model.surface.functions.map(fn => `- ${fn.field}: ${fn.declaration.id}`).join("\n")}\n`
	};
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1, generator: { id: "lean-wasm/rust-copied", version: 1 }, component: model.ir.component.id, bindingIrSha256: hashBindingIr(model.ir), publicModule: "src/lib.rs", internalModule: "src/__runtime.rs", exports: exported(model), files: [...Object.keys(files), "binding-manifest.json"], capabilityGaps: [{ feature: "identity-and-effects", reason: "Ordinary Cargo packages admit pure copied values only." }, { feature: "additional-platforms", reason: "The native profile requires Rust 1.90+ on Linux x86-64 with glibc." }] }, null, 2)}\n`;
	return Object.freeze(files);
};

/**
 * Generate a crate from the shared semantic model.
 *
 * @param ir - Binding IR.
 * @param evidence - Verified native identities.
 * @param settings - Cargo coordinates.
 */
export const generateCopiedRustPackage = (ir, evidence = null, settings = {}) => renderCopiedRustPackage(compileCopiedRustModel(ir), evidence, settings);

/**
 * Pin the dependency closure while substituting only the root package identity.
 *
 * @param name - Crate name.
 * @param version - Exact version.
 */
export const copiedRustLock = async (name, version) => (await readFile(new URL("./dependencies.lock", import.meta.url), "utf8"))
	.replace('name = "lean_bridge_generated"\nversion = "0.0.0"', `name = "${name}"\nversion = "${version}"`);
