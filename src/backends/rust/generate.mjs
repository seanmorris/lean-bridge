/**
 * Implements the generate module in the Rust backend.
 *
 * @file
 */

import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import {
	GenericSpecializationError,
	compileFiniteGenericSpecializations,
} from "../../abi/generic-specialization.mjs";
import { auditRustPackage } from "./package-audit.mjs";

/**
 * Reports Rust binding generation failures with stable machine-readable codes and structured diagnostic context.
 */
export class RustBindingGenerationError extends Error
{
	/**
   * Initializes the error used to report Rust binding generation failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "RustBindingGenerationError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new RustBindingGenerationError(code, message, details);
};

const snake = value => value
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toLowerCase();

const pascal = value => snake(value)
  .split("_")
  .filter(Boolean)
  .map(part => part[0].toUpperCase() + part.slice(1))
  .join("");

const crateName = ir => snake(ir.component.id.slice(0, ir.component.id.lastIndexOf("@")).split("/").at(-1));
const namedType = (ir, id) => ir.types.find(type => type.id === id);

const resolveAlias = (ir, ref, seen = new Set()) => {
	if(ref.kind !== "named") return ref;
	const type = namedType(ir, ref.id);
	if(type?.kind !== "alias") return ref;
	if(seen.has(type.id)) fail("alias-cycle", `Rust projection found an alias cycle at ${type.id}`);
	seen.add(type.id);
	return resolveAlias(ir, type.target, seen);
};

const rustType = (ir, ref) => {
	const resolved = resolveAlias(ir, ref);
	if(resolved.kind === "primitive")
	{
		const types = {
			unit: "()"
			, bool: "bool"
			, uint8: "u8"
			, uint16: "u16"
			, uint32: "u32"
			, uint64: "u64"
			, int8: "i8"
			, int16: "i16"
			, int32: "i32"
			, int64: "i64"
			, float32: "f32"
			, float64: "f64"
			, string: "String"
			, bytes: "Vec<u8>"
		};
		const type = types[resolved.name];
		if(!type)
		{
			fail("unsupported-arbitrary-integer", `Rust POC has no dependency-free mapping for ${resolved.name}`, {
				type: resolved.name
			});
		}
		return type;
	}
	if(resolved.kind === "named") return namedType(ir, resolved.id).name;
	if(resolved.kind === "parameter") return resolved.id;
	const typeArguments = resolved.arguments.map(argument => rustType(ir, argument));
	if(resolved.constructor === "array") return `Vec<${typeArguments[0]}>`;
	if(resolved.constructor === "option") return `Option<${typeArguments[0]}>`;
	if(resolved.constructor === "result") return `Result<${typeArguments[0]}, ${typeArguments[1]}>`;
	return `(${typeArguments.join(", ")}${typeArguments.length === 1 ? "," : ""})`;
};

const runtimeRustType = (ir, ref) => {
	const resolved = resolveAlias(ir, ref);
	if(resolved.kind === "named") return `crate::${namedType(ir, resolved.id).name}`;
	if(resolved.kind !== "apply") return rustType(ir, resolved);
	const typeArguments = resolved.arguments.map(argument => runtimeRustType(ir, argument));
	if(resolved.constructor === "array") return `Vec<${typeArguments[0]}>`;
	if(resolved.constructor === "option") return `Option<${typeArguments[0]}>`;
	if(resolved.constructor === "result") return `Result<${typeArguments[0]}, ${typeArguments[1]}>`;
	return `(${typeArguments.join(", ")}${typeArguments.length === 1 ? "," : ""})`;
};

const substitute = (ref, parameter, replacement) => {
	if(ref.kind === "parameter" && ref.id === parameter) return replacement;
	if(ref.kind !== "apply") return ref;
	return { ...ref, arguments: ref.arguments.map(item => substitute(item, parameter, replacement)) };
};

const specializations = declaration => {
	if(declaration.typeParameters.length === 0) return null;
	try
	{
		return compileFiniteGenericSpecializations(declaration);
	} catch(error)
	{
		if(error instanceof GenericSpecializationError)
		{
			fail(error.code, error.message, error.details);
		}
		throw error;
	}
};

const variants = declaration => {
	const branches = specializations(declaration);
	if(branches === null) return [{ declaration, suffix: "", specialization: null }];
	const parameter = declaration.typeParameters[0].id;
	return branches.map(branch => ({
		declaration: {
			...declaration,
			typeParameters: []
			, parameters: declaration.parameters.map(site => ({
				...site,
				type: substitute(site.type, parameter, branch.type)
			}))
			, result: { ...declaration.result, type: substitute(declaration.result.type, parameter, branch.type) }
		}
		, suffix: `_${snake(branch.id)}`
		, specialization: branch
	}));
};

const resourceFor = (ir, declaration) => {
	const ref = declaration.receiver?.type ?? declaration.result.type;
	if(ref.kind !== "named") return null;
	const type = namedType(ir, ref.id);
	return type?.kind === "resource" ? type : null;
};

const functionName = (ir, variant) => {
	const declaration = variant.declaration;
	if(declaration.kind === "constructor") return "new";
	if(declaration.kind === "property")
	{
		return `${declaration.parameters.length === 0 ? "get" : "set"}_${snake(declaration.name)}${variant.suffix}`;
	}
	return `${snake(declaration.name)}${variant.suffix}`;
};

const runtimeMethodName = (ir, variant) => {
	const declaration = variant.declaration;
	const resource = resourceFor(ir, declaration);
	return `${resource ? `${snake(resource.name)}_` : ""}${functionName(ir, variant)}`;
};

const isIdentity = (ir, ref) => {
	const resolved = resolveAlias(ir, ref);
	return resolved.kind === "named" && namedType(ir, resolved.id).representation === "identity";
};

const validateCoverage = ir => {
	for(const error of ir.errors)
	{
		if(error.payload !== null)
		{
			fail("unsupported-error-payload", `${error.id} has a payload that the Rust POC cannot preserve`, {
				error: error.id
			});
		}
	}
	for(const type of ir.types)
	{
		if(type.typeParameters.length > 0)
		{
			fail("unsupported-generic-type", `${type.id} requires a generic Rust type declaration`, {
				type: type.id
			});
		}
		if(type.kind === "callback")
		{
			if(type.callable.resultMode !== "value")
			{
				fail("unsupported-async-callback", `${type.id} is asynchronous`, { type: type.id });
			}
			if(
				type.callable.parameters.some(site => isIdentity(ir, site.type))
        || isIdentity(ir, type.callable.result.type)
			) {
				fail("unsupported-callback-identity", `${type.id} carries an identity-bearing value`, {
					type: type.id
				});
			}
		}
		if(type.kind === "resource" && type.resource.disposal !== "required")
		{
			fail("unsupported-disposal-policy", `${type.id} does not use required disposal`, {
				type: type.id
			});
		}
		if(type.kind === "record")
		{
			type.fields.forEach(field => rustType(ir, field.type));
		}
		if(type.kind === "alias") rustType(ir, type.target);
	}
	const projected = new Map();
	for(const declaration of ir.declarations)
	{
		if(declaration.resultMode !== "value")
		{
			fail("unsupported-result-mode", `${declaration.id} uses ${declaration.resultMode}`, {
				declaration: declaration.id
			});
		}
		if(declaration.parameters.some(parameter => parameter.optional))
		{
			fail("unsupported-optional-parameter", `${declaration.id} has an optional parameter`, {
				declaration: declaration.id
			});
		}
		if(declaration.kind === "static-method")
		{
			fail("unsupported-static-method", `${declaration.id} is not implemented by the Rust backend`, {
				declaration: declaration.id
			});
		}
		if(declaration.receiver && (
			declaration.receiver.ownership !== "borrow"
      || declaration.receiver.lifetime?.scope !== "call"
		)) {
			fail("unsupported-receiver-lifetime", `${declaration.id} does not borrow its receiver for one call`, {
				declaration: declaration.id
			});
		}
		for(const parameter of declaration.parameters)
		{
			rustType(ir, parameter.type);
			if(
				isIdentity(ir, parameter.type)
        && (parameter.ownership !== "borrow" || parameter.lifetime?.scope !== "call")
			) {
				fail("unsupported-identity-parameter", `${declaration.id}.${parameter.name} is not a call-scoped borrow`);
			}
		}
		rustType(ir, declaration.result.type);
		const resultRef = resolveAlias(ir, declaration.result.type);
		const resultType = resultRef.kind === "named" ? namedType(ir, resultRef.id) : null;
		if(resultType?.kind === "resource")
		{
			const borrowed
        = declaration.result.ownership === "borrow"
        && declaration.result.lifetime?.scope === "receiver";
			const owned
        = declaration.kind === "constructor"
        && declaration.result.ownership === "lease"
        && declaration.result.lifetime?.scope === "explicit";
			if(!borrowed && !owned)
			{
				fail("unsupported-resource-result", `${declaration.id} has an unsupported resource result`);
			}
		}
		if(resultType?.kind === "callback" && (
			declaration.result.ownership !== "lease"
      || declaration.result.lifetime?.scope !== "explicit"
		)) {
			fail("unsupported-callback-result", `${declaration.id} does not return an explicit callable lease`);
		}
		for(const variant of variants(declaration))
		{
			const scope = resourceFor(ir, declaration)?.id ?? "module";
			const key = `${scope}:${functionName(ir, variant)}`;
			if(projected.has(key))
			{
				fail("overload-requires-renaming", `${declaration.id} collides with ${projected.get(key)} in Rust`, {
					declaration: declaration.id
				});
			}
			projected.set(key, declaration.id);
		}
	}
};

const doc = documentation => {
	const lines = [documentation.summary, documentation.details].filter(Boolean);
	return lines.map(line => `/// ${line}`).join("\n");
};

const errorVariant = error => pascal(error.name);

const publicParameters = (ir, declaration, { callbackGeneric = true } = {}) => declaration.parameters.map(parameter => {
  const resolved = resolveAlias(ir, parameter.type);
  const type = resolved.kind === "named" ? namedType(ir, resolved.id) : null;
  if(callbackGeneric && type?.kind === "callback") return `mut ${snake(parameter.name)}: F`;
  if(type?.kind === "resource") return `${snake(parameter.name)}: &${type.name}`;
  return `${snake(parameter.name)}: ${rustType(ir, parameter.type)}`;
});

const resultType = (ir, declaration, { runtime = false } = {}) => {
	const resolved = resolveAlias(ir, declaration.result.type);
	if(resolved.kind === "named")
	{
		const type = namedType(ir, resolved.id);
		if(type.kind === "resource" || type.kind === "callback")
		{
			if(runtime) return "u64";
			if(type.kind === "resource" && declaration.result.ownership === "borrow") return `&${type.name}`;
			return type.name;
		}
	}
	return runtime ? runtimeRustType(ir, resolved) : rustType(ir, resolved);
};

const runtimeParameters = (ir, declaration) => declaration.parameters.map(parameter => {
  const resolved = resolveAlias(ir, parameter.type);
  const type = resolved.kind === "named" ? namedType(ir, resolved.id) : null;
  if(type?.kind === "callback")
{
    const callable = type.callable;
    const args = callable.parameters.map(site => rustType(ir, site.type)).join(", ");
    return `${snake(parameter.name)}: &mut dyn FnMut(${args}) -> Result<${runtimeRustType(ir, callable.result.type)}, Error>`;
}
  if(type?.kind === "resource") return `${snake(parameter.name)}: u64`;
  return `${snake(parameter.name)}: ${runtimeRustType(ir, parameter.type)}`;
});

const nativeRustRuntime = String.raw`
use std::ffi::{c_void, CStr, CString};
use std::os::raw::{c_char, c_int};
use std::path::PathBuf;
use std::ptr;

#[repr(C)]
struct NativeError { code: c_int, message: *const c_char, message_length: usize }
#[repr(C)]
struct NativeSpan { data: *const c_void, length: usize, owner: *mut c_void, release: Option<unsafe extern "C" fn(*mut c_void)> }
#[repr(C)]
struct NativePayload { enabled: bool, count: u32, label: NativeSpan, bytes: NativeSpan, values: NativeSpan }
type CallbackFn = unsafe extern "C" fn(*mut c_void, u32, *mut u32, *mut NativeError) -> c_int;
#[repr(C)]
struct NativeTransform { call: Option<CallbackFn>, context: *mut c_void }

extern "C" {
    fn dlopen(filename: *const c_char, flags: c_int) -> *mut c_void;
    fn dlsym(handle: *mut c_void, symbol: *const c_char) -> *mut c_void;
    fn dlerror() -> *const c_char;
}

type BoxCreate = unsafe extern "C" fn(u32, *mut *mut c_void, *mut NativeError) -> c_int;
type BoxRead = unsafe extern "C" fn(*mut c_void, *mut u32, *mut NativeError) -> c_int;
type BoxIdentity = unsafe extern "C" fn(*mut c_void, *mut *mut c_void, *mut NativeError) -> c_int;
type BoxDispose = unsafe extern "C" fn(*mut *mut c_void);
type RoundTrip = unsafe extern "C" fn(*const NativePayload, *mut NativePayload, *mut NativeError) -> c_int;
type PayloadClear = unsafe extern "C" fn(*mut NativePayload);
type WithCallback = unsafe extern "C" fn(u32, *const NativeTransform, *mut u32, *mut NativeError) -> c_int;
type MakeAdder = unsafe extern "C" fn(u32, *mut *mut c_void, *mut NativeError) -> c_int;
type TransformCall = unsafe extern "C" fn(*mut c_void, u32, *mut u32, *mut NativeError) -> c_int;
type TransformDispose = unsafe extern "C" fn(*mut *mut c_void);

struct NativeRuntime {
    _handle: *mut c_void,
    box_create: BoxCreate,
    box_read: BoxRead,
    box_identity: BoxIdentity,
    box_dispose: BoxDispose,
    round_trip: RoundTrip,
    payload_clear: PayloadClear,
    with_callback: WithCallback,
    make_adder: MakeAdder,
    transform_call: TransformCall,
    transform_dispose: TransformDispose,
}

unsafe impl Send for NativeRuntime {}
unsafe impl Sync for NativeRuntime {}

impl NativeRuntime {
    fn load() -> Result<Self, Error> {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("lean-bridge/artifacts/artifacts/native/lib/liblean_alpha_component.so");
        let path = CString::new(path.to_string_lossy().as_bytes()).map_err(|_| Error::Unexpected("native component path contains NUL".into()))?;
        unsafe {
            let handle = dlopen(path.as_ptr(), 2);
            if handle.is_null() { return Err(Error::Unexpected(Self::loader_error())); }
            macro_rules! load {
                ($name:literal, $type:ty) => {{
                    let name = concat!($name, "\0");
                    let value = dlsym(handle, name.as_ptr().cast());
                    if value.is_null() { return Err(Error::Unexpected(format!("native component omits {}", $name))); }
                    std::mem::transmute::<*mut c_void, $type>(value)
                }};
            }
            Ok(Self {
                _handle: handle,
                box_create: load!("lean_alpha_box_create", BoxCreate),
                box_read: load!("lean_alpha_box_read", BoxRead),
                box_identity: load!("lean_alpha_box_identity", BoxIdentity),
                box_dispose: load!("lean_alpha_box_dispose", BoxDispose),
                round_trip: load!("lean_alpha_round_trip", RoundTrip),
                payload_clear: load!("lean_alpha_payload_clear", PayloadClear),
                with_callback: load!("lean_alpha_with_callback", WithCallback),
                make_adder: load!("lean_alpha_make_adder", MakeAdder),
                transform_call: load!("lean_alpha_owned_transform_call", TransformCall),
                transform_dispose: load!("lean_alpha_owned_transform_dispose", TransformDispose),
            })
        }
    }

    unsafe fn loader_error() -> String {
        let value = dlerror();
        if value.is_null() { "cannot load native Lean component".into() } else { CStr::from_ptr(value).to_string_lossy().into_owned() }
    }

    fn check(status: c_int, error: &NativeError) -> Result<(), Error> {
        if status == 0 { return Ok(()); }
        let message = if error.message.is_null() {
            "Lean call failed".into()
        } else {
            unsafe { String::from_utf8_lossy(std::slice::from_raw_parts(error.message.cast(), error.message_length)).into_owned() }
        };
        match error.code {
            100 => Err(Error::DisposedResource),
            101 => Err(Error::CallbackThrew),
            _ => Err(Error::Unexpected(message)),
        }
    }

    fn error() -> NativeError { NativeError { code: 0, message: ptr::null(), message_length: 0 } }
}

struct CallbackFrame<'a> { callback: &'a mut dyn FnMut(u32) -> Result<u32, Error>, error: Option<Error> }

unsafe extern "C" fn invoke_callback(context: *mut c_void, value: u32, output: *mut u32, _error: *mut NativeError) -> c_int {
    let frame = &mut *context.cast::<CallbackFrame<'_>>();
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| (frame.callback)(value))) {
        Ok(Ok(result)) => { *output = result; 0 }
        Ok(Err(error)) => { frame.error = Some(error); 4 }
        Err(_) => { frame.error = Some(Error::CallbackThrew); 4 }
    }
}

impl Runtime for NativeRuntime {
    fn initialize(&self) -> Result<(), Error> { Ok(()) }
    fn box_new(&self, value: u32) -> Result<u64, Error> {
        let mut output = ptr::null_mut(); let mut error = Self::error();
        Self::check(unsafe { (self.box_create)(value, &mut output, &mut error) }, &error)?;
        Ok(output as u64)
    }
    fn box_read(&self, identity: u64) -> Result<u32, Error> {
        let mut output = 0; let mut error = Self::error();
        Self::check(unsafe { (self.box_read)(identity as *mut c_void, &mut output, &mut error) }, &error)?; Ok(output)
    }
    fn box_identity(&self, identity: u64) -> Result<u64, Error> {
        let mut output = ptr::null_mut(); let mut error = Self::error();
        Self::check(unsafe { (self.box_identity)(identity as *mut c_void, &mut output, &mut error) }, &error)?; Ok(output as u64)
    }
    fn round_trip(&self, payload: crate::Payload) -> Result<crate::Payload, Error> {
        let input = NativePayload {
            enabled: payload.enabled, count: payload.count,
            label: NativeSpan { data: payload.label.as_ptr().cast(), length: payload.label.len(), owner: ptr::null_mut(), release: None },
            bytes: NativeSpan { data: payload.bytes.as_ptr().cast(), length: payload.bytes.len(), owner: ptr::null_mut(), release: None },
            values: NativeSpan { data: payload.values.as_ptr().cast(), length: payload.values.len(), owner: ptr::null_mut(), release: None },
        };
        let mut output = NativePayload { enabled: false, count: 0, label: NativeSpan { data: ptr::null(), length: 0, owner: ptr::null_mut(), release: None }, bytes: NativeSpan { data: ptr::null(), length: 0, owner: ptr::null_mut(), release: None }, values: NativeSpan { data: ptr::null(), length: 0, owner: ptr::null_mut(), release: None } };
        let mut error = Self::error();
        Self::check(unsafe { (self.round_trip)(&input, &mut output, &mut error) }, &error)?;
        let result = unsafe { crate::Payload {
            enabled: output.enabled, count: output.count,
            label: String::from_utf8_lossy(std::slice::from_raw_parts(output.label.data.cast(), output.label.length)).into_owned(),
            bytes: std::slice::from_raw_parts(output.bytes.data.cast(), output.bytes.length).to_vec(),
            values: std::slice::from_raw_parts(output.values.data.cast(), output.values.length).to_vec(),
        }};
        unsafe { (self.payload_clear)(&mut output) }; Ok(result)
    }
    fn with_callback(&self, value: u32, transform: &mut dyn FnMut(u32) -> Result<u32, Error>) -> Result<u32, Error> {
        let mut frame = CallbackFrame { callback: transform, error: None };
        let callback = NativeTransform { call: Some(invoke_callback), context: (&mut frame as *mut CallbackFrame<'_>).cast() };
        let mut output = 0; let mut error = Self::error();
        let status = unsafe { (self.with_callback)(value, &callback, &mut output, &mut error) };
        if let Some(error) = frame.error { return Err(error); }
        Self::check(status, &error)?; Ok(output)
    }
    fn make_adder(&self, base: u32) -> Result<u64, Error> {
        let mut output = ptr::null_mut(); let mut error = Self::error();
        Self::check(unsafe { (self.make_adder)(base, &mut output, &mut error) }, &error)?; Ok(output as u64)
    }
    fn dispose_box(&self, identity: u64) { let mut value = identity as *mut c_void; unsafe { (self.box_dispose)(&mut value) } }
    fn call_transform(&self, identity: u64, value: u32) -> Result<u32, Error> {
        let mut output = 0; let mut error = Self::error();
        Self::check(unsafe { (self.transform_call)(identity as *mut c_void, value, &mut output, &mut error) }, &error)?; Ok(output)
    }
    fn dispose_transform(&self, identity: u64) { let mut value = identity as *mut c_void; unsafe { (self.transform_dispose)(&mut value) } }
}
`;

const emitRuntime = ir => {
	const lines = [
		"use std::sync::{Arc, Mutex};"
		, ""
		, "use crate::Error;"
		, ""
		, "#[doc(hidden)]"
		, "pub trait Runtime: Send + Sync + 'static {"
		, "    fn initialize(&self) -> Result<(), Error>;"
	];
	for(const declaration of ir.declarations)
	{
		for(const variant of variants(declaration))
		{
			const current = variant.declaration;
			const parameters = runtimeParameters(ir, current);
			if(current.receiver) parameters.unshift("identity: u64");
			lines.push(
				`    fn ${runtimeMethodName(ir, variant)}(&self${parameters.length ? ", " : ""}${parameters.join(", ")}) -> Result<${resultType(ir, current, { runtime: true })}, Error>;`,
			);
		}
	}
	for(const type of ir.types.filter(type => type.kind === "resource"))
	{
		lines.push(`    fn dispose_${snake(type.name)}(&self, identity: u64);`);
	}
	for(const type of ir.types.filter(type => type.kind === "callback"))
	{
		const callable = type.callable;
		const parameters = callable.parameters.map(site => `${snake(site.name)}: ${runtimeRustType(ir, site.type)}`);
		lines.push(
			`    fn call_${snake(type.name)}(&self, identity: u64${parameters.length ? ", " : ""}${parameters.join(", ")}) -> Result<${runtimeRustType(ir, callable.result.type)}, Error>;`,
			`    fn dispose_${snake(type.name)}(&self, identity: u64);`,
		);
	}
	lines.push(
		"}",
		"",
		"enum State {",
		"    Empty,",
		"    Ready(Arc<dyn Runtime>),",
		"    Failed(Error),",
		"}",
		"",
		"static RUNTIME: Mutex<State> = Mutex::new(State::Empty);",
		"",
		"#[doc(hidden)]",
		"pub fn install_runtime(runtime: Arc<dyn Runtime>) -> Result<(), Error> {",
		"    let mut state = RUNTIME.lock().map_err(|_| Error::Unexpected(\"runtime lock is poisoned\".into()))?;",
		"    match &*state {",
		"        State::Ready(existing) if Arc::ptr_eq(existing, &runtime) => return Ok(()),",
		"        State::Ready(_) => return Err(Error::InvalidArgument(\"a different runtime is already installed\")),",
		"        State::Failed(error) => return Err(error.clone()),",
		"        State::Empty => {}",
		"    }",
		"    match runtime.initialize() {",
		"        Ok(()) => { *state = State::Ready(runtime); Ok(()) }",
		"        Err(error) => { *state = State::Failed(error.clone()); Err(error) }",
		"    }",
		"}",
		"",
		"pub(crate) fn runtime() -> Result<Arc<dyn Runtime>, Error> {",
		"    {",
		"        let state = RUNTIME.lock().map_err(|_| Error::Unexpected(\"runtime lock is poisoned\".into()))?;",
		"        match &*state {",
		"            State::Ready(runtime) => return Ok(Arc::clone(runtime)),",
		"            State::Failed(error) => return Err(error.clone()),",
		"            State::Empty => {}",
		"        }",
		"    }",
		"    let native: Arc<dyn Runtime> = Arc::new(NativeRuntime::load()?);",
		"    install_runtime(Arc::clone(&native))?;",
		"    Ok(native)",
		"}",
		"",
		nativeRustRuntime,
	);
	return lines.join("\n");
};

const emitRecord = (ir, type) => {
	const lines = [doc(type.documentation), "#[derive(Clone, Debug, PartialEq)]", `pub struct ${type.name} {`];
	for(const field of type.fields)
	{
		lines.push(`    pub ${snake(field.name)}: ${rustType(ir, field.type)},`);
	}
	lines.push("}", "");
	return lines;
};

const emitResource = (ir, type) => {
	const declarations = ir.declarations.filter(item => {
    const resource = resourceFor(ir, item);
    return resource?.id === type.id;
	});
	const lines = [
		doc(type.documentation)
		, `pub struct ${type.name} {`
		, "    runtime: Arc<dyn __runtime::Runtime>,"
		, "    identity: u64,"
		, "}"
		, ""
		, `impl ${type.name} {`
	];
	for(const declaration of declarations)
	{
		for(const variant of variants(declaration))
		{
			const current = variant.declaration;
			const name = functionName(ir, variant);
			const params = publicParameters(ir, current);
			const returnType = resultType(ir, current);
			lines.push(`    ${doc(current.documentation).replaceAll("\n", "\n    ")}`);
			if(current.kind === "constructor")
			{
				lines.push(
					`    pub fn ${name}(${params.join(", ")}) -> Result<Self, Error> {`,
					"        let runtime = __runtime::runtime()?;",
					`        let identity = runtime.${runtimeMethodName(ir, variant)}(${current.parameters.map(item => snake(item.name)).join(", ")})?;`,
					"        Ok(Self { runtime, identity })",
					"    }",
					"",
				);
			} else
			{
				const parameterArgs = current.parameters.map(item => {
            const ref = resolveAlias(ir, item.type);
            const itemType = ref.kind === "named" ? namedType(ir, ref.id) : null;
            return itemType?.kind === "resource" ? `${snake(item.name)}.identity` : snake(item.name);
				});
				const callArgs = ["self.identity", ...parameterArgs];
				lines.push(`    pub fn ${name}(&self${params.length ? ", " : ""}${params.join(", ")}) -> Result<${returnType}, Error> {`);
				const resultRef = resolveAlias(ir, current.result.type);
				const outputType = resultRef.kind === "named" ? namedType(ir, resultRef.id) : null;
				if(outputType?.kind === "resource" && current.result.ownership === "borrow")
				{
					lines.push(
						`        let identity = self.runtime.${runtimeMethodName(ir, variant)}(${callArgs.join(", ")})?;`,
						"        if identity != self.identity {",
						"            return Err(Error::Unexpected(\"the runtime broke receiver identity\".into()));",
						"        }",
						"        Ok(self)",
					);
				} else
				{
					lines.push(`        self.runtime.${runtimeMethodName(ir, variant)}(${callArgs.join(", ")})`);
				}
				lines.push("    }", "");
			}
		}
	}
	lines.push(
		"}",
		"",
		`impl Drop for ${type.name} {`,
		"    fn drop(&mut self) {",
		`        self.runtime.dispose_${snake(type.name)}(self.identity);`,
		"    }",
		"}",
		"",
	);
	return lines;
};

const emitCallbackResource = (ir, type) => {
	const callable = type.callable;
	const parameters = callable.parameters.map(site => `${snake(site.name)}: ${rustType(ir, site.type)}`);
	const args = callable.parameters.map(site => snake(site.name));
	return [
		doc(type.documentation)
		, `pub struct ${type.name} {`
		, "    runtime: Arc<dyn __runtime::Runtime>,"
		, "    identity: u64,"
		, "}"
		, ""
		, `impl ${type.name} {`
		, `    pub fn call(&self${parameters.length ? ", " : ""}${parameters.join(", ")}) -> Result<${rustType(ir, callable.result.type)}, Error> {`
		, `        self.runtime.call_${snake(type.name)}(self.identity${args.length ? ", " : ""}${args.join(", ")})`
		, "    }"
		, "}"
		, ""
		, `impl Drop for ${type.name} {`
		, "    fn drop(&mut self) {"
		, `        self.runtime.dispose_${snake(type.name)}(self.identity);`
		, "    }"
		, "}"
		, ""
	];
};

const emitFunction = (ir, variant) => {
	const declaration = variant.declaration;
	const callbackParameter = declaration.parameters.find(parameter => {
    const ref = resolveAlias(ir, parameter.type);
    return ref.kind === "named" && namedType(ir, ref.id).kind === "callback";
	});
	const generic = callbackParameter ? "<F>" : "";
	const lines = [doc(declaration.documentation)];
	lines.push(`pub fn ${functionName(ir, variant)}${generic}(${publicParameters(ir, declaration).join(", ")}) -> Result<${resultType(ir, declaration)}, Error>`);
	if(callbackParameter)
	{
		const callbackType = namedType(ir, callbackParameter.type.id);
		const callable = callbackType.callable;
		lines.push(`where F: FnMut(${callable.parameters.map(site => rustType(ir, site.type)).join(", ")}) -> Result<${rustType(ir, callable.result.type)}, Error>`);
	}
	lines.push("{", "    let runtime = __runtime::runtime()?;");
	const args = declaration.parameters.map(parameter => {
    if(parameter === callbackParameter) return `&mut ${snake(parameter.name)}`;
    const ref = resolveAlias(ir, parameter.type);
    const type = ref.kind === "named" ? namedType(ir, ref.id) : null;
    return type?.kind === "resource" ? `${snake(parameter.name)}.identity` : snake(parameter.name);
	});
	const outputRef = resolveAlias(ir, declaration.result.type);
	const outputType = outputRef.kind === "named" ? namedType(ir, outputRef.id) : null;
	if(outputType?.kind === "callback")
	{
		lines.push(
			`    let identity = runtime.${runtimeMethodName(ir, variant)}(${args.join(", ")})?;`,
			`    Ok(${outputType.name} { runtime, identity })`,
		);
	} else
	{
		lines.push(`    runtime.${runtimeMethodName(ir, variant)}(${args.join(", ")})`);
	}
	lines.push("}", "");
	return lines;
};

const emitLibrary = ir => {
	const lines = [
		"use std::fmt;"
		, "use std::sync::Arc;"
		, ""
		, "#[doc(hidden)]"
		, "pub mod __runtime;"
		, ""
		, `pub const BINDING_IR_SHA256: &str = \"${hashBindingIr(ir)}\";`
		, ""
		, "#[derive(Clone, Debug, PartialEq, Eq)]"
		, "pub enum Error {"
		, "    InvalidArgument(&'static str),"
		, "    RuntimeUnavailable,"
		, ...ir.errors.map(error => `    ${errorVariant(error)},`)
		, "    Unexpected(String),"
		, "}"
		, ""
		, "impl fmt::Display for Error {"
		, "    fn fmt(&self, output: &mut fmt::Formatter<'_>) -> fmt::Result {"
		, "        match self {"
		, "            Self::InvalidArgument(message) => output.write_str(message),"
		, "            Self::RuntimeUnavailable => output.write_str(\"the shared runtime is not installed\"),"
		, ...ir.errors.map(error => `            Self::${errorVariant(error)} => output.write_str(${JSON.stringify(error.documentation.summary)}),`)
		, "            Self::Unexpected(message) => output.write_str(message),"
		, "        }"
		, "    }"
		, "}"
		, ""
		, "impl std::error::Error for Error {}"
		, ""
	];
	for(const type of ir.types.filter(type => type.kind === "record")) lines.push(...emitRecord(ir, type));
	for(const type of ir.types.filter(type => type.kind === "alias"))
	{
		lines.push(doc(type.documentation), `pub type ${type.name} = ${rustType(ir, type.target)};`, "");
	}
	for(const type of ir.types.filter(type => type.kind === "resource")) lines.push(...emitResource(ir, type));
	for(const type of ir.types.filter(type => type.kind === "callback")) lines.push(...emitCallbackResource(ir, type));
	for(const declaration of ir.declarations.filter(item => item.kind === "function"))
	{
		for(const variant of variants(declaration)) lines.push(...emitFunction(ir, variant));
	}
	return lines.join("\n");
};

const emitReadme = ir => `# ${ir.component.name} Rust binding

${ir.documentation.summary}

The generated crate projects copied records as owned Rust values, identity-bearing values as owned types with \`Drop\`, receiver-anchored borrows as Rust references, callbacks as closures, and failures as \`Result\`.

\`Transform\` uses an ordinary \`.call(...)\` method. Stable Rust does not allow generated crates to implement the \`Fn\` call operator for a resource type. The package manifest records that target capability gap.

The package runtime installs the typed component adapter before application code starts.

Binding IR SHA-256: \`${hashBindingIr(ir)}\`
`;

/**
 * Compiles Binding IR into the validated Rust package projection model.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 */
export const compileRustPackageModel = ir => {
	validateBindingIr(ir);
	validateCoverage(ir);
	return Object.freeze({ ir });
};

/**
 * Renders and lays out deterministic Rust package files from one model.
 *
 * @param model - Validated Rust package projection model.
 */
export const renderRustPackageLayout = model => {
	const { ir } = model;
	const lib = emitLibrary(ir);
	const runtime = emitRuntime(ir);
	const exports = [
		...ir.types.filter(type => new Set(["record", "resource", "callback", "alias"]).has(type.kind)).map(type => type.name)
		, ...ir.declarations.filter(item => item.kind === "function").flatMap(declaration => variants(declaration).map(variant => functionName(ir, variant)))
	];
	const files = {
		"Cargo.toml": `[package]\nname = \"${crateName(ir).replaceAll("_", "-")}\"\nversion = \"${ir.component.version}\"\nedition = \"2021\"\n\n[lib]\npath = \"src/lib.rs\"\n`
		, "src/lib.rs": lib
		, "src/__runtime.rs": runtime
		, "README.md": emitReadme(ir)
	};
	const manifest = {
		schemaVersion: 1
		, component: ir.component.id
		, bindingIrSha256: hashBindingIr(ir)
		, generator: { id: "lean-wasm/rust", version: 1 }
		, publicModule: "src/lib.rs"
		, internalModule: "src/__runtime.rs"
		, exports
		, capabilityGaps: [{
			feature: "owned-callable-operator"
			, projection: "call-method"
			, reason: "Stable Rust does not allow generated resource types to implement Fn traits."
		}]
		, files: ["Cargo.toml", "src/lib.rs", "src/__runtime.rs", "README.md", "binding-manifest.json"]
	};
	files["binding-manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
	return Object.freeze(files);
};

/**
 * Generates and audits a Rust package through explicit model and rendering stages.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 */
export const generateRustBindingPackage = ir => {
	const model = compileRustPackageModel(ir);
	const files = renderRustPackageLayout(model);
	auditRustPackage(ir, files);
	return files;
};
