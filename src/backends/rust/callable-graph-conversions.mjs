/**
 * Panic-contained Rust callbacks and generation-checked native closure leases.
 *
 * @file
 */
const support = String.raw`
enum CallbackFailure { Error(Error), Panic(Box<dyn std::any::Any + Send>) }
struct CallbackState {
    scope: std::cell::RefCell<GraphScope>,
    failure: std::cell::RefCell<Option<CallbackFailure>>,
    runtime: &'static GraphNative,
}
impl CallbackState {
    fn finish(&self) -> Result<(), Error> {
        let failure = self.failure.borrow_mut().take();
        match failure {
            None => Ok(()),
            Some(CallbackFailure::Error(error)) => Err(error),
            Some(CallbackFailure::Panic(payload)) => std::panic::resume_unwind(payload),
        }
    }
}
pub(super) struct Lease {
    token: std::cell::Cell<u64>,
    invoke: *const (),
    dispose: unsafe extern "C" fn(u64),
    process: u32,
    thread: std::thread::ThreadId,
    active: std::cell::Cell<usize>,
    closed: std::cell::Cell<bool>,
    marker: std::marker::PhantomData<std::rc::Rc<()>>,
}
impl Lease {
    fn new(invoke: *const (), dispose: unsafe extern "C" fn(u64)) -> Self {
        Self { token: std::cell::Cell::new(0), invoke, dispose,
            process: std::process::id(), thread: std::thread::current().id(),
            active: std::cell::Cell::new(0), closed: std::cell::Cell::new(false),
            marker: std::marker::PhantomData }
    }
    fn check_thread(&self) -> Result<(), Error> {
        if self.process != std::process::id() { return Err(Error::Load("Start a fresh process after fork to use Lean".into())); }
        if self.thread != std::thread::current().id() { return Err(Error::WrongThread); }
        Ok(())
    }
    fn release(&self) {
        let token = self.token.replace(0);
        if token != 0 { unsafe { (self.dispose)(token) }; }
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
        if self.token.get() == 0 { return Err(Error::InvalidNative); }
        self.active.set(self.active.get().checked_add(1).ok_or(Error::Limit)?);
        Ok(CallGuard(self))
    }
}
impl Drop for Lease {
    fn drop(&mut self) {
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
fn copied<T>(result: Result<T, GraphError>, runtime: &GraphNative) -> Result<T, Error> {
    graph_finish(result, Some(&runtime.lifecycle)).map_err(graph_error)
}
fn callable_status(status: u32, runtime: &GraphNative) -> Result<(), Error> {
    if status == 6 { return Err(Error::Native { code: 6, message: "Host callback failed or its borrow expired".into() }); }
    copied(graph_status(status), runtime)
}
`;

const trampoline = callback => {
	const { index, parameters, result } = callback;
	const signature = `unsafe extern "C" fn(*mut std::ffi::c_void, ${[...parameters.map(node => `*const ${node.raw}`), `*mut ${result.raw}`].join(", ")}) -> u32`;
	return `#[repr(C)]
struct Callback${index} { call: ${signature}, context: *mut std::ffi::c_void }
struct Context${index}<'a> {
    function: std::cell::RefCell<&'a mut (dyn FnMut(${parameters.map(node=>node.publicType).join(', ')}) -> Result<${result.publicType}, Error> + 'a)>,
    state: &'a CallbackState,
}
unsafe extern "C" fn callback${index}(${['context: *mut std::ffi::c_void',...parameters.map((node,i)=>`arg${i}: *const ${node.raw}`),`output: *mut ${result.raw}`].join(', ')}) -> u32 {
    let context = unsafe { &*context.cast::<Context${index}<'_>>() };
    if context.state.failure.borrow().is_some() { return 6; }
    let caught = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| -> Result<(), Error> {
${parameters.map((node,i)=>`        let value${i} = copied((|| unsafe { graph_from${node.index}(graph_read(arg${i})?, 0, true, true, &mut context.state.scope.borrow_mut()) })(), context.state.runtime)?;`).join('\n')}
        let value = (context.function.try_borrow_mut().map_err(|_| Error::CallbackReentry)?)(${parameters.map((_,i)=>`value${i}`).join(', ')})?;
        let mut scope = context.state.scope.borrow_mut();
        graph_check${result.index}(&value, 0, true, &mut scope.budget).map_err(graph_error)?;
        let converted = graph_to${result.index}(&value, &mut scope).map_err(graph_error)?;
        // All owned callback results remain alive until C finishes its copy.
        scope.one(value).map_err(graph_error)?;
        if output.is_null() { return copied(Err(GraphError::InvalidNative), context.state.runtime); }
        unsafe { output.write(converted) };
        Ok(())
    }));
    // Move the first failure into Rust-owned state, without inspecting or dropping
    // arbitrary panic payloads while a C frame is on the stack.
    match caught {
        Ok(Ok(())) => 0,
        Ok(Err(error)) => { *context.state.failure.borrow_mut() = Some(CallbackFailure::Error(error)); 6 },
        Err(payload) => { *context.state.failure.borrow_mut() = Some(CallbackFailure::Panic(payload)); 6 },
    }
}
`;
};

const call = (name, parameters, result, symbol, { lease = false } = {}) => {
	const callable = value => Boolean(value.signature), callbacks = parameters.some(callable);
	const scope = callbacks ? "&mut state.scope.borrow_mut()" : "&mut scope";
	const argument = (node, i) => node.aggregate ? `arg${i}` : `&arg${i}`;
	return `pub(super) fn ${name}(${[...lease ? ["lease: &Lease"] : [], ...parameters.map((node, i) => `${callable(node) ? "mut " : ""}arg${i}: ${node.inputType}`)].join(", ")}) -> Result<${result.publicType}, Error> {
    ${lease?'let _guard = lease.enter()?;':''}
    let ${parameters.some(node=>!callable(node))?'mut ':''}budget = GraphBudget::new();
${parameters.map((node,i)=>callable(node)?'':`    graph_check${node.index}(${argument(node,i)}, 0, true, &mut budget).map_err(graph_error)?;`).join('\n')}
    let runtime = graph_runtime()?;
    callable_status(unsafe { (runtime.lifecycle.initialize)() }, runtime)?;
    ${callbacks?'let state = CallbackState { scope: std::cell::RefCell::new(GraphScope::new(budget)), failure: std::cell::RefCell::new(None), runtime };':'let mut scope = GraphScope::new(budget);'}
${parameters.map((node,i)=>callable(node)?`    let context${i} = Context${node.index} { function: std::cell::RefCell::new(&mut arg${i}), state: &state };
    let input${i} = Callback${node.index} { call: callback${node.index}, context: (&context${i} as *const Context${node.index}<'_>).cast_mut().cast() };`:`    let input${i} = graph_to${node.index}(${argument(node,i)}, ${scope}).map_err(graph_error)?;`).join('\n')}
    ${callable(result)?`let mut output = Lease::new(runtime.owned${result.index} as *const (), runtime.dispose${result.index});`:`let mut output = GraphOutput { value: ${result.raw}::default(), clear: graph_clear${result.index} };`}
    ${lease?`let invoke: ${symbol} = unsafe { std::mem::transmute(lease.invoke) };`:''}
    let status = unsafe { ${lease?'invoke':`(runtime.${symbol})`}(${[...lease?['lease.token.get()']:[],...parameters.map((_,i)=>`&input${i}`),callable(result)?'output.token.get_mut()':'&mut output.value'].join(', ')}) };
    ${callbacks?'state.finish()?;':''}
    callable_status(status, runtime)?;
    ${callable(result)?`if output.token.get() == 0 { return copied(Err(GraphError::InvalidNative), runtime); }
    graph_checkpoint().map_err(graph_error)?;
    Ok(LeanClosure { inner: output, marker: std::marker::PhantomData })`:`let result = copied(unsafe { graph_from${result.index}(&output.value, 0, true, true, ${scope}) }, runtime);
    result`}
}
`;
};

/**
 * Render private typed callbacks, public export calls and owned invocations.
 *
 * @param model - Checked Rust graph and callable signatures.
 */
export const rustCallableGraphNative = model => support
	+ [...model.callbacks.values()].map(trampoline).join("\n")
	+ model.functions.map(fn => call(`call${fn.index}`, fn.parameters.map(site => site.value), fn.result, `call${fn.index}`)).join("\n")
	+ model.closureSignatures.map(callback => call(`invoke${callback.index}`, callback.parameters, callback.result, callback.native, { lease: true })).join("\n");
