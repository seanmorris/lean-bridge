/**
 * Typed Rust callbacks and returned Lean closures over owned value conversions.
 * Host panics resume only after the enclosing native call has returned.
 *
 * @file
 */
import { generateOwnedRustConversions } from "./owned-conversions.mjs";
import { ownedCallbackRecovery } from "../../build/owned-callback-carriers.mjs";

const support = `
enum OwnedFailure { Error(Error), Panic(Box<dyn std::any::Any + Send>) }
struct OwnedCall {
    state: Rc<State>, budget: std::cell::RefCell<OwnedBudget>,
    failures: std::cell::RefCell<Vec<OwnedFailure>>,
}
impl OwnedCall {
    fn new(state: Rc<State>, budget: OwnedBudget) -> Self {
        Self { state, budget: std::cell::RefCell::new(budget), failures: std::cell::RefCell::new(Vec::new()) }
    }
    fn finish(&self, status: u32) -> Result<(), Error> {
        // Both native results and every host callback context are still guarded
        // while errors return or a captured panic resumes in Rust.
        let failures = std::mem::take(&mut *self.failures.borrow_mut());
        match failures.into_iter().next() {
            Some(OwnedFailure::Error(error)) => Err(error),
            Some(OwnedFailure::Panic(payload)) => std::panic::resume_unwind(payload),
            None => checked(status),
        }
    }
}
`;

/**
 * Project all exports, returned callable identities and host callback arguments.
 * Prepared Cargo admission must additionally bind the authenticated asset loader
 * and verify installed consumers on both source paths.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param options - Prepared-package runtime policy.
 * @param options.dynamic - Resolve the authenticated embedded library table.
 */
export const generateOwnedRustCallables = (ir, { dynamic = false } = {}) => {
	const conversions = generateOwnedRustConversions(ir, { dynamic }), { c } = conversions;
	const nodes = new Map(conversions.types.map(node => [node.id, node]));
	const all = [...c.functions, ...c.callbacks, ...c.retains, ...c.copies];
	const raw = [], helpers = [], traits = [], publicCalls = [], nativeEntries = [];
	const signature = (item, offset = 0) => {
		const params = item.parameters.map(id => nodes.get(id));
		const host = params.map((_, index) => c.hostArgument(item, index));
		const slots = params.map((node, index) => ({ node, index })).slice(offset);
		const generic = slots.filter(({ index }) => host[index]);
		return { params, host
			, generic: generic.length ? `<${generic.map(({ node, index }) => `F${index}: OwnedCallback${node.index}`).join(", ")}>` : ""
			, publicParams: slots.map(({ node, index }) => `a${index}: ${host[index] ? `F${index}` : `${node.scalar ? "" : "&"}${node.input}`}`).join(", ")
			, privateParams: slots.map(({ node, index }) => `${host[index] ? "mut " : ""}a${index}: ${host[index] ? `F${index}` : `&${node.input}`}`).join(", ")
			, arguments: slots.map(({ node, index }) => `${!host[index] && node.scalar ? "&" : ""}a${index}`).join(", ") };
	};
	all.forEach((item, index) => {
		const { params, host } = signature(item), result = nodes.get(item.result);
		const types = ["*mut c_void", ...params.map((node, i) => host[i] ? `*const OwnedHost${node.index}` : `${node.leaf ? "" : "*const "}${node.raw}`), `*mut ${result.raw}`, "*mut *mut c_void"];
		const names = ["session", ...params.map((_, i) => `a${i}`), "out", "owner"];
		const arguments_ = names.join(", "), parameters = names.map((name, i) => `${name}: ${types[i]}`).join(", ");
		nativeEntries.push({ field: `call${index}`, symbol: item.cName, type: `unsafe extern "C" fn(${types.join(", ")}) -> u32` });
		if(dynamic) raw.push(`unsafe fn owned_native${index}(${parameters}) -> u32 {`
			, `    match owned_native_api() { Ok(api) => unsafe { (api.call${index})(${arguments_}) }, Err(_) => 7 }`, "}");
		else raw.push("unsafe extern \"C\" {", `    #[link_name = "${item.cName}"]`
			, `    fn owned_native${index}(${parameters}) -> u32;`, "}");
	});
	for(const callback of c.callbacks)
	{
		const node = nodes.get(callback.id), result = nodes.get(callback.result), i = node.index;
		const params = callback.parameters.slice(1).map(id => nodes.get(id));
		const automatic = ownedCallbackRecovery(c.native.model, node, id => id) !== null;
		const copyIndex = all.findIndex(item => (item.retain || item.copy) && item.id === result.id);
		const arguments_ = params.map((_, index) => `a${index}`).join(", ");
		const parameters = params.map((param, index) => `a${index}: ${param.hostName}`).join(", ");
		const bound = `FnMut(${params.map(param => param.hostName).join(", ")}) -> Result<${result.hostName}, Error>`;
		traits.push("#[doc(hidden)]", `pub trait OwnedCallback${i} {`
			, `    fn invoke(&mut self${parameters ? `, ${parameters}` : ""}) -> Result<${result.hostName}, Error>;`
			, `    fn closure(&self) -> Option<&${node.hostName}> { None }`
			, `    fn recovery(&self) -> Option<&${result.hostName}> { None }`, "}");
		if(automatic) traits.push(`impl<F: ${bound}> OwnedCallback${i} for F {`
			, `    fn invoke(&mut self${parameters ? `, ${parameters}` : ""}) -> Result<${result.hostName}, Error> { self(${arguments_}) }`, "}");
		traits.push(`impl<F: ${bound}> OwnedCallback${i} for WithRecovery<F, ${result.hostName}> {`
			, `    fn invoke(&mut self${parameters ? `, ${parameters}` : ""}) -> Result<${result.hostName}, Error> { (self.function)(${arguments_}) }`
			, `    fn recovery(&self) -> Option<&${result.hostName}> { Some(&self.recovery) }`, "}");
		for(const receiver of [node.hostName, `&${node.hostName}`]) traits.push(`impl OwnedCallback${i} for ${receiver} {`
			, `    fn invoke(&mut self${parameters ? `, ${parameters}` : ""}) -> Result<${result.hostName}, Error> { self.call(${params.map((param, index) => `${param.scalar ? "" : "&"}a${index}`).join(", ")}) }`
			, `    fn closure(&self) -> Option<&${node.hostName}> { Some(self) }`, "}");
		raw.push("#[repr(C)]", `struct OwnedHost${i} {`
			, `    call: Option<unsafe extern "C" fn(${["*mut c_void", "*mut c_void", ...params.map(param => `${param.leaf ? "" : "*const "}${param.raw}`), `*mut ${result.raw}`, "*mut *mut c_void"].join(", ")}) -> u32>,`
			, `    context: *mut c_void, closure: *mut c_void, recovery: *const ${result.raw},`, "}");
		helpers.push(`struct OwnedContext${i}<'a, F> { function: std::cell::RefCell<&'a mut F>, call: &'a OwnedCall }`
			, `unsafe extern "C" fn owned_callback${i}<F: OwnedCallback${i}>(context: *mut c_void, session: *mut c_void${params.map((param, index) => `, a${index}: ${param.leaf ? "" : "*const "}${param.raw}`).join("")}, out: *mut ${result.raw}, owner: *mut *mut c_void) -> u32 {`
			, "    if context.is_null() { return 1; }"
			, `    let context = unsafe { &*(context as *const OwnedContext${i}<'_, F>) };`
			, "    if !context.call.failures.borrow().is_empty() { return 10; }"
			, "    let caught = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| -> Result<(), Error> {"
			, "        if context.call.state.require()? != session || out.is_null() || owner.is_null() || !unsafe { *owner }.is_null() { return Err(Error::InvalidArgument); }"
			, "        let frame = owned_runtime::BorrowFrame::new(&context.call.state)?;"
			, "        let mut borrowed = OwnedOutput::borrowed(Rc::clone(&context.call.state), Rc::clone(&frame.lease));"
			, "        let mut input_scope = OwnedScope::new(context.call.budget.borrow().clone());"
			, ...params.map((param, index) => `        let argument${index} = unsafe { owned_from${param.index}(${param.leaf ? `&a${index}` : `owned_read(a${index})?`}, 0, &mut input_scope, &mut borrowed)? };`)
			, "        context.call.budget.replace(input_scope.budget.clone());"
			, `        let reply = context.function.try_borrow_mut().map_err(|_| Error::CallOrder)?.invoke(${params.map((_, index) => `argument${index}`).join(", ")})?;`
			, "        let mut reply_scope = OwnedScope::new(context.call.budget.borrow().clone());"
			, `        owned_check${result.index}(&reply, 0, &mut reply_scope.budget, &context.call.state)?;`
			, `        let view = owned_to${result.index}(&reply, &mut reply_scope, &context.call.state)?;`
			, `        let mut converted: ${result.raw} = Default::default(); let mut retained = NativeOwner::new();`
			, `        checked(unsafe { owned_native${copyIndex}(context.call.state.require()?, ${result.leaf ? "" : "&"}view, &mut converted, &mut retained.value) })?;`
			, "        context.call.budget.replace(reply_scope.budget.clone());"
			, "        unsafe { *out = converted; *owner = std::mem::replace(&mut retained.value, std::ptr::null_mut()); }"
			, "        Ok(())", "    }));", "    match caught {", "        Ok(Ok(())) => 0,"
			, "        Ok(Err(error)) => { context.call.failures.borrow_mut().push(OwnedFailure::Error(error)); 10 },"
			, "        Err(payload) => { context.call.failures.borrow_mut().push(OwnedFailure::Panic(payload)); 10 },", "    }", "}"
			, `fn owned_check_callback${i}<F: OwnedCallback${i}>(function: &F, budget: &mut OwnedBudget, state: &Rc<State>) -> Result<(), Error> {`
			, `    if let Some(closure) = function.closure() { return owned_check${i}(closure, 0, budget, state); }`
			, `    budget.enter(0)?; budget.native(1, std::mem::size_of::<OwnedHost${i}>())?;`
			, ...automatic ? [] : ["    if function.recovery().is_none() { return Err(Error::InvalidArgument); }"]
			, `    if let Some(recovery) = function.recovery() { owned_check${result.index}(recovery, 0, budget, state)?; }`, "    Ok(())", "}");
	}
	all.forEach((item, index) => {
		const sig = signature(item), result = nodes.get(item.result);
		helpers.push(`pub(crate) fn owned_invoke${index}${sig.generic}(${sig.privateParams}) -> Result<${result.hostName}, Error> {`
			, "    let state = current_state()?;", `    let ${sig.params.length ? "mut " : ""}budget = OwnedBudget::new();`
			, ...sig.params.map((param, i) => `    ${sig.host[i] ? `owned_check_callback${param.index}(&a${i}, &mut budget, &state)?;` : `owned_check${param.index}(a${i}, 0, &mut budget, &state)?;`}`)
			, "    let call = OwnedCall::new(Rc::clone(&state), budget.clone());"
			, "    let mut scope = OwnedScope::new(budget);");
		sig.params.forEach((param, i) => {
			if(!sig.host[i]) helpers.push(`    let view${i} = owned_to${param.index}(a${i}, &mut scope, &state)?;`);
			else
			{
				const callback = c.callbacks.find(item => item.id === param.id), result = nodes.get(callback.result);
				helpers.push(`    let closure${i} = a${i}.closure().map(|value| value.raw(&state)).transpose()?;`
					, `    let recovery${i} = if closure${i}.is_none() { a${i}.recovery().cloned() } else { None };`
					, `    let recovery_view${i} = recovery${i}.as_ref().map(|value| owned_to${result.index}(value, &mut scope, &state)).transpose()?;`
					, `    let mut context${i} = OwnedContext${param.index} { function: std::cell::RefCell::new(&mut a${i}), call: &call };`
					, `    let view${i} = OwnedHost${param.index} {`
					, `        call: if closure${i}.is_none() { Some(owned_callback${param.index}::<F${i}>) } else { None },`
					, `        context: if closure${i}.is_none() { (&mut context${i} as *mut OwnedContext${param.index}<'_, F${i}>).cast() } else { std::ptr::null_mut() },`
					, `        closure: closure${i}.unwrap_or(std::ptr::null_mut()), recovery: recovery_view${i}.as_ref().map_or(std::ptr::null(), |value| value),`, "    };");
			}
		});
		helpers.push("    call.budget.replace(scope.budget.clone());"
			, `    let mut raw: ${result.raw} = Default::default(); let mut output = OwnedOutput::new(Rc::clone(&state));`
			, `    let status = unsafe { owned_native${index}(state.require()?${sig.params.map((param, i) => `, ${sig.host[i] || !param.leaf ? "&" : ""}view${i}`).join("")}, &mut raw, &mut output.owner.value) };`
			, "    call.finish(status)?;", "    let mut result_scope = OwnedScope::new(call.budget.into_inner());"
			, `    unsafe { owned_from${result.index}(&raw, 0, &mut result_scope, &mut output) }`, "}");
		if(c.functions.includes(item)) publicCalls.push(`pub fn ${item.cName.slice(c.prefix.length + 1)}${sig.generic}(${sig.publicParams}) -> Result<${result.hostName}, Error> {`
			, `    owned_values::owned_invoke${index}(${sig.arguments})`, "}");
	});
	for(const node of nodes.values()) if(node.identity)
	{
		const retained = all.findIndex(item => item.retain && item.id === node.id);
		publicCalls.push(`impl Resource<${node.identityTag}> {`
			, `    pub fn retain(&self) -> Result<${node.hostName}, Error> { owned_values::owned_invoke${retained}(self) }`);
		const index = all.findIndex(item => c.callbacks.includes(item) && item.id === node.id);
		if(index !== -1)
		{
			const sig = signature(all[index], 1), result = nodes.get(all[index].result);
			publicCalls.push(`    pub fn call${sig.generic}(&self${sig.publicParams ? `, ${sig.publicParams}` : ""}) -> Result<${result.hostName}, Error> {`
				, `        owned_values::owned_invoke${index}(self${sig.arguments ? `, ${sig.arguments}` : ""})`, "    }");
		}
		publicCalls.push("}");
	}
	const apiSource = [conversions.valuesSource
		, "/// A typed failure-path value for Lean cleanup, never a successful callback reply."
		, "pub struct WithRecovery<F, R> { function: F, recovery: R }"
		, "pub fn with_recovery<F, R>(function: F, recovery: R) -> WithRecovery<F, R> { WithRecovery { function, recovery } }"
		, ...traits, ...publicCalls, ""].join("\n");
	return { ...conversions, apiSource, nativeEntries
		, source: [conversions.source, support, ...raw, ...helpers, ""].join("\n") };
};
