/**
 * Typed Rust callbacks, panic containment and thread-confined Lean closure leases.
 *
 * @file
 */

/**
 * Resolve a copied value or a callable site.
 *
 * @param model - Admitted Rust projection.
 * @param ref - Canonical type reference.
 */
export const rustSite = (model, ref) => model.surface.callbacks.get(ref.id) ?? model.surface.copy(ref);
const callable = value => Boolean(value.type?.callable);
const input = value => callable(value) ? `*const B${value.index}` : value.aggregate ? `*const ${value.ctype}` : value.ctype;
const output = value => callable(value) ? "*mut *mut std::ffi::c_void" : `*mut ${value.ctype}`;
const unit = value => value.scalarName === "unit";
const parameters = callback => callback.parameters.map((copy, i) => `arg${i}: ${copy.inputType}`).join(", ");
const args = callback => callback.parameters.map((_, i) => `arg${i}`).join(", ");

/**
 * Private native function pointer signature, including callback borrows.
 *
 * @param model - Admitted Rust projection.
 * @param fn - Selected export.
 */
export const rustSignature = (model, fn) => `unsafe extern "C" fn(${fn.declaration.parameters.map(site => input(rustSite(model, site.type)))
	.concat(unit(rustSite(model, fn.declaration.result.type)) ? [] : [output(rustSite(model, fn.declaration.result.type))])
	.concat("*mut NativeError").join(", ")}) -> i32`;

const invokeSignature = callback => `unsafe extern "C" fn(${["*mut std::ffi::c_void", ...callback.parameters.map(input), ...unit(callback.result) ? [] : [output(callback.result)], "*mut NativeError"].join(", ")}) -> i32`;
const disposeSignature = 'unsafe extern "C" fn(*mut *mut std::ffi::c_void)';

/**
 * Public signature marker and owned callable methods, with no raw ABI exposure.
 *
 * @param model - Admitted Rust projection.
 */
export const rustCallablePublic = model => model.surface.callbacks.size ? `/// An owned Lean closure. Calls and cleanup stay on its creating thread.
/// Drop releases it automatically; close is idempotent and prevents further calls.
pub struct LeanClosure<F> {
    inner: __runtime::Lease,
    marker: std::marker::PhantomData<F>,
}
impl<F> LeanClosure<F> {
    pub fn close(&self) -> Result<(), Error> { self.inner.close() }
    pub fn is_closed(&self) -> bool { self.inner.is_closed() }
}
${model.closureSignatures.map(callback => `impl LeanClosure<${callback.signature}> {
    pub fn call(&self, ${parameters(callback)}) -> Result<${callback.result.publicType}, Error> {
        __runtime::invoke${callback.index}(&self.inner, ${args(callback)})
    }
}`).join("\n")}
` : "";

/**
 * Symbol fields or initializers for owned closure invocation and disposal.
 *
 * @param model - Admitted Rust projection.
 * @param initialize - Render symbol lookup expressions instead of fields.
 */
export const rustCallableSymbols = (model, initialize = false) => [...model.surface.callbacks.values()].map(callback => {
	const entries = [[`owned${callback.index}`, `${model.surface.prefix}_owned_${callback.field}_call`, invokeSignature(callback)]
		, [`dispose${callback.index}`, `${model.surface.prefix}_owned_${callback.field}_dispose`, disposeSignature]];
	return entries.map(([field, symbol, type]) => initialize ? `            ${field}: symbol!("${symbol}", ${type}),` : `    ${field}: ${type},`).join("\n");
}).join("\n");

const helpers = String.raw`
enum CallbackFailure { Error(Error), Panic(Box<dyn std::any::Any + Send>) }
struct CallbackState {
    scope: std::cell::RefCell<Scope>,
    failures: std::cell::RefCell<Vec<CallbackFailure>>,
}
impl CallbackState {
    fn new() -> Self {
        Self { scope: std::cell::RefCell::new(Scope::new()), failures: std::cell::RefCell::new(Vec::new()) }
    }
    fn finish(&self) -> Result<(), Error> {
        // Move all payloads back into Rust before any user-defined destructor runs.
        // A panic payload's Drop implementation may itself panic.
        let failures = std::mem::take(&mut *self.failures.borrow_mut());
        let mut failures = failures.into_iter();
        match failures.next() {
            None => Ok(()),
            Some(CallbackFailure::Error(error)) => Err(error),
            Some(CallbackFailure::Panic(payload)) => std::panic::resume_unwind(payload),
        }
    }
}

pub(super) struct Lease {
    pointer: std::cell::Cell<*mut std::ffi::c_void>,
    invoke: *const (),
    dispose: unsafe extern "C" fn(*mut *mut std::ffi::c_void),
    process: u32,
    thread: std::thread::ThreadId,
    active: std::cell::Cell<usize>,
    closed: std::cell::Cell<bool>,
    // Rc is neither Send nor Sync. The public wrapper inherits both restrictions.
    marker: std::marker::PhantomData<std::rc::Rc<()>>,
}
impl Lease {
    fn new(invoke: *const (), dispose: unsafe extern "C" fn(*mut *mut std::ffi::c_void)) -> Self {
        Self { pointer: std::cell::Cell::new(std::ptr::null_mut()), invoke, dispose,
            process: std::process::id(), thread: std::thread::current().id(),
            active: std::cell::Cell::new(0), closed: std::cell::Cell::new(false), marker: std::marker::PhantomData }
    }
    fn check_thread(&self) -> Result<(), Error> {
        if self.process != std::process::id() { return Err(Error::Load("Start a fresh process after fork to use Lean".into())); }
        if self.thread != std::thread::current().id() { return Err(Error::WrongThread); }
        Ok(())
    }
    fn release(&self) {
        let mut pointer = self.pointer.replace(std::ptr::null_mut());
        if !pointer.is_null() { unsafe { (self.dispose)(&mut pointer) }; }
    }
    pub(super) fn close(&self) -> Result<(), Error> {
        self.check_thread()?;
        self.closed.set(true);
        if self.active.get() == 0 { self.release(); }
        Ok(())
    }
    pub(super) fn is_closed(&self) -> bool { self.closed.get() }
    fn enter(&self) -> Result<CallGuard<'_>, Error> {
        self.check_thread()?;
        if self.closed.get() { return Err(Error::Closed); }
        if self.pointer.get().is_null() { return Err(Error::InvalidNative); }
        self.active.set(self.active.get().checked_add(1).ok_or(Error::Limit)?);
        Ok(CallGuard(self))
    }
}
impl Drop for Lease {
    fn drop(&mut self) {
        // Never touch inherited native locks when dropping an object after fork.
        if self.process == std::process::id() { self.release(); }
    }
}
struct CallGuard<'a>(&'a Lease);
impl Drop for CallGuard<'_> {
    fn drop(&mut self) {
        self.0.active.set(self.0.active.get() - 1);
        if self.0.closed.get() && self.0.active.get() == 0 { self.0.release(); }
    }
}
`;

const borrowsOwner = copy => ["string", "bytes"].includes(copy.scalarName)
	|| Boolean(copy.element && borrowsOwner(copy.element))
	|| Boolean(copy.fields?.some(field => borrowsOwner(field.type)))
	|| Boolean(copy.cases?.some(branch => branch.fields.some(field => borrowsOwner(field.type))));

const trampoline = callback => {
	const result = callback.result, callbackType = `dyn FnMut(${callback.parameters.map(copy => copy.publicType).join(", ")}) -> Result<${result.publicType}, Error>`;
	return `#[repr(C)]
struct B${callback.index} { call: ${invokeSignature(callback)}, context: *mut std::ffi::c_void }
struct Context${callback.index}<'a> {
    function: std::cell::RefCell<&'a mut (${callbackType} + 'a)>,
    state: &'a CallbackState,
}
unsafe extern "C" fn callback${callback.index}(context: *mut std::ffi::c_void, ${callback.parameters.map((copy, i) => `arg${i}: ${input(copy)}`).join(", ")}${unit(result) ? "" : `, out: ${output(result)}`}, error: *mut NativeError) -> i32 {
    // The C broker validates the call-borrow token, creator thread and lifetime
    // before entering this function. Context stays on the caller's stack.
    let context = unsafe { &*context.cast::<Context${callback.index}<'_>>() };
    let caught = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| -> Result<(), Error> {
        if !context.state.failures.borrow().is_empty() { return Ok(()); }
${callback.parameters.map((copy, i) => `        let value${i} = from${copy.index}(${copy.aggregate ? `unsafe { arg${i}.as_ref() }.ok_or(Error::InvalidNative)?` : `&arg${i}`}, &mut context.state.scope.borrow_mut())?;`).join("\n")}
        let result = (context.function.try_borrow_mut().map_err(|_| Error::CallbackReentry)?)(${callback.parameters.map((_, i) => `value${i}`).join(", ")})?;
        let mut scope = context.state.scope.borrow_mut();
        let converted = to${result.index}(&result, &mut scope)?;
${borrowsOwner(result) ? `        // The C caller copies after this trampoline returns. Retain the Rust owner.
        let mut retained = scope.vector(1)?;
        retained.push(result);
        scope.keep(retained)?;` : ""}
${unit(result) ? "" : "        if out.is_null() { return Err(Error::InvalidNative); }\n        unsafe { out.write(converted) };"}
        Ok(())
    }));
    // Do not format, inspect or drop user panic payloads while C is on the stack.
    match caught {
        Ok(Ok(())) => {},
        Ok(Err(failure)) => context.state.failures.borrow_mut().push(CallbackFailure::Error(failure)),
        Err(payload) => context.state.failures.borrow_mut().push(CallbackFailure::Panic(payload)),
    }
    if context.state.failures.borrow().is_empty() { 0 } else {
        if !error.is_null() { unsafe { error.write(NativeError { code: 4, message: b"Rust callback failed".as_ptr(), message_length: 20 }) }; }
        4
    }
}
`;
};

const resultStorage = (result, owner = "native") => unit(result) ? ""
	: callable(result) ? `let mut output = Lease::new(${owner}.owned${result.index} as *const (), ${owner}.dispose${result.index});`
		: result.aggregate ? `let mut output = Output { value: ${result.ctype}::default(), clear: ${owner}.clear${result.index} };`
			: `let mut output: ${result.ctype} = Default::default();`;
const resultPointer = result => unit(result) ? [] : [callable(result) ? "output.pointer.get_mut()" : result.aggregate ? "&mut output.value" : "&mut output"];
const resultValue = (result, scope) => unit(result) ? "Ok(())"
	: callable(result) ? `if output.pointer.get().is_null() { return Err(Error::InvalidNative); }
    checkpoint()?;
    Ok(LeanClosure { inner: output, marker: std::marker::PhantomData })`
		: `from${result.index}(&output${result.aggregate ? ".value" : ""}, ${scope})`;

/**
 * Render one typed export and keep callback contexts alive across its native call.
 *
 * @param model - Admitted Rust projection.
 * @param fn - Selected export.
 * @param index - Stable private function index.
 */
export const rustNativeFunction = (model, fn, index) => {
	const inputs = fn.declaration.parameters.map(site => rustSite(model, site.type)), result = rustSite(model, fn.declaration.result.type);
	const callbacks = inputs.some(callable), scope = callbacks ? "&mut state.scope.borrow_mut()" : "&mut scope";
	const arguments_ = inputs.map((value, i) => value.aggregate || callable(value) ? `&input${i}` : `input${i}`).concat(resultPointer(result), "&mut error");
	return `pub(super) fn call${index}(${inputs.map((value, i) => `${callable(value) ? "mut " : ""}arg${i}: ${value.inputType}`).join(", ")}) -> Result<${result.publicType}, Error> {
    let native = runtime()?;
    ${callbacks ? "let state = CallbackState::new();" : "let mut scope = Scope::new();"}
    ${resultStorage(result)}
    let mut error = NativeError::default();
${inputs.map((value, i) => callable(value) ? `    let context${i} = Context${value.index} { function: std::cell::RefCell::new(&mut arg${i}), state: &state };
    let input${i} = B${value.index} { call: callback${value.index}, context: (&context${i} as *const Context${value.index}<'_>).cast_mut().cast() };` : `    let input${i} = to${value.index}(&arg${i}, ${scope})?;`).join("\n")}
    let status = unsafe { (native.call${index})(${arguments_.join(", ")}) };
    ${callbacks ? "state.finish()?;" : ""}
    check(status, &error)?;
    let result = { ${resultValue(result, scope)} };
    result
}
`;
};

/**
 * Private callable machinery. Pure copied packages retain their existing API.
 *
 * @param model - Admitted Rust projection.
 */
export const rustCallableNative = model => !model.surface.callbacks.size ? "" : helpers
	+ [...model.surface.callbacks.values()].map(trampoline).join("\n")
	+ model.closureSignatures.map(callback => {
		const result = callback.result;
		return `pub(super) fn invoke${callback.index}(lease: &Lease, ${parameters(callback)}) -> Result<${result.publicType}, Error> {
    let _guard = lease.enter()?;
    let native = runtime()?;
    let mut scope = Scope::new();
    ${resultStorage(result)}
    let mut error = NativeError::default();
${callback.parameters.map((copy, i) => `    let input${i} = to${copy.index}(&arg${i}, &mut scope)?;`).join("\n")}
    let invoke: ${invokeSignature(callback)} = unsafe { std::mem::transmute(lease.invoke) };
    check(unsafe { invoke(${["lease.pointer.get()", ...callback.parameters.map((copy, i) => copy.aggregate ? `&input${i}` : `input${i}`), ...resultPointer(result), "&mut error"].join(", ")}) }, &error)?;
    ${resultValue(result, "&mut scope")}
}
`;
	}).join("\n");
