/**
 * Render typed ordinary Rust APIs with private C calls and RAII cleanup.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { cargoPackageMetadata, validatePackageMetadata } from "../../analyze/package-metadata.mjs";
import { readFile } from "node:fs/promises";
import { compileCopiedRustModel, validateOrdinaryCargoSettings } from "./copied-model.mjs";
import { copiedRustAssets } from "./copied-assets.mjs";
import { copiedRustConversions, copiedRustHelpers, copiedRustTypes } from "./copied-conversions.mjs";
import { rustSite, rustSignature, rustCallablePublic, rustCallableSymbols, rustNativeFunction, rustCallableNative } from "./callables.mjs";

const exported = model => ["Error", "BigInt", "BigUint", ...model.surface.callbacks.size ? ["LeanClosure"] : [], ...model.surface.copies.filter(copy => copy.record || copy.variant).map(copy => copy.publicName), ...model.surface.aliases.map(alias => alias.definition.name), ...model.surface.functions.map(fn => fn.field)];
const publicType = (model, ref, input = false) => {
	const value = rustSite(model, ref), alias = ref.kind === "named" && model.surface.aliases.find(item => item.definition.id === ref.id);
	if(value.type?.callable) return value[input ? "inputType" : "publicType"];
	if(input)
	{
		if(["string", "bytes"].includes(value.scalarName)) return value.inputType;
		if(value.element)
		{
			let target = ref;
			while(target.kind === "named") target = model.ir.types.find(type => type.id === target.id).target;
			return `&[${publicType(model, target.arguments[0])}]`;
		}
		return `${value.aggregate ? "&" : ""}${publicType(model, ref)}`;
	}
	if(alias) return alias.definition.name;
	if(ref.kind !== "apply") return value.publicType;
	const children = ref.arguments.map(argument => publicType(model, argument)).join(", ");
	return ref.constructor === "tuple" ? `(${children})`
		: `${{ array: "Vec", list: "Vec", option: "Option", result: "Result" }[ref.constructor]}<${children}>`;
};
const publicAliases = model => !model.surface.aliases.length ? "" : `\n${model.surface.aliases.map(alias => `pub type ${alias.definition.name} = ${publicType(model, alias.definition.target)};`).join("\n")}\n`;
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
${model.surface.callbacks.size ? "    Closed,\n    WrongThread,\n    CallbackReentry," : ""}
    Load(String),
    Native { code: i32, message: String },
}
impl std::fmt::Display for Error {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Limit => formatter.write_str("16 MiB conversion limit exceeded"),
            Self::Allocation => formatter.write_str("Conversion allocation failed"),
            Self::InvalidNative => formatter.write_str("Native result violates its copied-value contract"),
${model.surface.callbacks.size ? '            Self::Closed => formatter.write_str("Lean closure is closed"),\n            Self::WrongThread => formatter.write_str("Lean closure belongs to another thread"),\n            Self::CallbackReentry => formatter.write_str("Callback is already mutably borrowed"),' : ""}
            Self::Load(message) => formatter.write_str(message),
            Self::Native { code, message } => write!(formatter, "Lean native error {code}: {message}"),
        }
    }
}
impl std::error::Error for Error {}
${rustCallablePublic(model)}

${model.surface.copies.filter(copy => copy.record || copy.variant).map(copy => copy.variant ? `#[derive(Clone, Debug, PartialEq)]
pub enum ${copy.publicName} {
${copy.cases.map((branch, i) => `    ${branch.publicName}${branch.fields.length ? ` { ${branch.fields.map((field, j) => `${field.publicName}: ${publicType(model, copy.variant.cases[i].fields[j].type)}`).join(", ")} }` : ""},`).join("\n")}
}
` : `#[derive(Clone, Debug, PartialEq)]
pub struct ${copy.publicName} {
${copy.fields.map((field, index) => `    pub ${field.name}: ${publicType(model, copy.record.fields[index].type)},`).join("\n")}
}
`).join("\n")}${publicAliases(model)}
${model.surface.functions.map((fn, index) => `/// Lean export: ${fn.declaration.id}.
pub fn ${fn.field}(${fn.parameters.map((parameter, i) => `${parameter.name}: ${publicType(model, fn.declaration.parameters[i].type, true)}`).join(", ")}) -> Result<${publicType(model, fn.declaration.result.type)}, Error> {
    __runtime::call${index}(${fn.parameters.map(parameter => parameter.name).join(", ")})
}
`).join("\n")}`;

const signature = rustSignature;

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
${rustCallableSymbols(model)}
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
${rustCallableSymbols(model, true)}
        })
    }).as_ref().map_err(Clone::clone)
}
${copiedRustConversions(model)}
${rustCallableNative(model)}
${model.surface.functions.map((fn, index) => rustNativeFunction(model, fn, index)).join("\n")}`;

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
		, "Cargo.toml": `[package]\nname = "${name}"\nversion = "${version}"\nedition = "2021"\nrust-version = "1.90"\n${cargoPackageMetadata({ description: "Compiled Lean API with typed Rust copied values", ...validatePackageMetadata(settings.metadata ?? {}) })}\nreadme = "README.md"\ninclude = ["src/**", "native/**", "lean-bridge/**", "README.md", "Cargo.lock", "binding-manifest.json"]\n\n[dependencies]\nnum-bigint = "=0.4.6"\nsha2 = "=0.10.9"\n`
		, "README.md": `# ${name}\n\nUse the prepared crate through Cargo. Public functions borrow strings, slices, records and big integers and return owned Result values. Rust widths enforce fixed-width integer ranges. Nat and Int use re-exported num-bigint BigUint and BigInt; Unit is (). Arrays use Vec, text uses String, bytes use Vec<u8>, and records are generated structs.\n\nThe crate embeds its compiled native libraries. Runtime loading is automatic and compatible crates share one Lean runtime. Executables work after the Cargo source tree is removed. Native extraction uses private directories removed after loading; small process registry files are removed at normal exit. Native libraries remain loaded until process exit. Requires Rust 1.90+, Linux x86-64, glibc matching the packaged platform record and writable /tmp. Forked reuse is rejected; embedding beside a runtime loaded outside this Rust loader is not accepted.\n\nPure acyclic copied types, at most 32 levels deep. Synchronous primitive callbacks accept FnMut functions returning Result and receive owned values. Returned LeanClosure values provide typed call, close and is_closed methods and automatic Drop cleanup. They are neither Send, Sync nor Clone. Callback errors return unchanged; unwinding panics resume in Rust after the native call returns. Abort cannot be caught. Host callbacks are borrowed only for the call; retained callback invocations fail. Compound callables, resources and async remain unsupported. Rust and native conversions each use a 16 MiB accounting budget; Rust array bookkeeping counts at least eight bytes per element. These limits do not bound Lean working memory or every Rust allocation. Native outputs use RAII even on errors or unwinding. Process abort and allocation failure that aborts Rust cannot run destructors.\n\n${model.surface.functions.map(fn => `- ${fn.field}: ${fn.declaration.id}`).join("\n")}\n`
	};
	files["README.md"] += "\nLean Option uses Rust Option, Except E T uses Result<T, E>, and binary products use (A, B), preserving their nesting. None, Some(()) and Some(None) retain presence. Compound inputs are borrowed; returned contents are owned independent copies. An exported Except result has two Result layers: the outer Result reports bridge failures, while the inner Result preserves the Lean domain success or error. These copied types can nest with arrays and records; they cannot contain callbacks or resources.\n";
	if(model.surface.copies.some(copy => copy.ref.kind === "apply" && copy.ref.constructor === "list"))
		files["README.md"] += "\nLean List inputs borrow Rust slices and return owned Vec values, including nested copied values and record fields. Empty Lists, order and duplicates are preserved. List and Array retain distinct contract identities. List callback payloads remain unsupported.\n";
	if(model.surface.aliases.length)
		files["README.md"] += "\nConcrete copied Lean aliases export named pub type declarations, retaining alias chains and named record fields. They use their targets' Rust values without newtype wrappers. String and byte inputs still borrow str and u8 slices; Array and List inputs borrow slices. Other aggregate inputs borrow their named aliases. Results own their copied contents. Aliases of Nat use BigUint, so negative inputs do not typecheck. Recursive and identity-bearing alias targets, and compound callable payloads remain unsupported.\n";
	if(model.surface.copies.some(copy => copy.variant))
		files["README.md"] += "\nConcrete copied Lean variants export named Rust enums. Empty cases are unit variants; payload cases have named fields. Construct and match these cases without numeric tags or unsafe code. Constructor names use PascalCase and fields use snake_case, with reserved words gaining a trailing underscore. Inputs borrow the enum and outputs own independent copied contents. Only the active payload is converted. Variants can contain supported copied records, containers and other non-recursive variants. Conversion errors and unwinding release temporary storage and native outputs through RAII. Recursive, callable and identity-bearing payloads remain unsupported.\n";
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1, generator: { id: "lean-wasm/rust-copied", version: 1 }, component: model.ir.component.id, bindingIrSha256: hashBindingIr(model.ir), publicModule: "src/lib.rs", internalModule: "src/__runtime.rs", exports: exported(model), files: [...Object.keys(files), "binding-manifest.json"], capabilityGaps: [{ feature: "identity-and-effects", reason: "Cargo supports copied values and synchronous primitive callables; resources, compound callables and asynchronous operations remain outside this profile." }, { feature: "additional-platforms", reason: "The native profile requires Rust 1.90+ on Linux x86-64 with glibc." }] }, null, 2)}\n`;
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
