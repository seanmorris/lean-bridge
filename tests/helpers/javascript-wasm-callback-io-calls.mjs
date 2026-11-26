/** @file Identical public API calls in independent Node and Chromium realms. */

// Count calls from the compiled callback adapter to its imported finish hook.
// Forward the original function and arguments; do not replace Wasm bytes,
// change results, or access the heap after retirement.
const observeNativeFinish = () => {
	let count = 0;
	const observe = imports => !imports?.env ? imports : new Proxy(imports, {get: (target, field) => {
		const group = Reflect.get(target, field);
		if(field !== "env") return group;
		return new Proxy(group, {get: (table, key) => {
			const fn = Reflect.get(table, key);
			if(typeof key !== "string" || !/^lbjs_[a-f0-9]+_finish_js$/u.test(key)) return fn;
			return (...args) => { count++; return fn(...args); };
		}});
	}});
	const instantiate = WebAssembly.instantiate, Instance = WebAssembly.Instance;
	WebAssembly.instantiate = (source, imports) => instantiate(source, observe(imports));
	WebAssembly.Instance = new Proxy(Instance, {construct: (target, [module, imports], receiver) => {
		return Reflect.construct(target, [module, observe(imports)], receiver);
	}});
	return {count: () => count, restore: () => { WebAssembly.Instance = Instance; WebAssembly.instantiate = instantiate; }};
};

/**
 * Distinguish exceptions crossing a borrowed callback from retirement of its shared heap.
 *
 * @param options - Installed names, import order and digest of the test-only fault component.
 * @param load - Optional bundler-resolved lazy imports for a dedicated browser worker.
 * @param invokeFault - Caller that enters the trapping callback through the installed API.
 */
export const exercise = async (options, load = name => import(name), invokeFault = (api, callback) => api.viaNat(callback, 7n)) => {
	const {ioName, ownedName, order, integrity, propagate} = options;
	const modules = new Map();
	const finishes = observeNativeFinish();
	try
	{
		for(const name of (order === "io-first" ? [ioName, ownedName] : [ownedName, ioName])) modules.set(name, await load(name));
	} finally
	{ finishes.restore(); }
	const io = modules.get(ioName), owned = modules.get(ownedName);
	const {loadComponent} = await load("@lean-bridge/runtime");
	const unit = {kind: "primitive", name: "unit"}, id = "test:trap";
	const scalar = {parameters: [], resultMode: "value"};
	const descriptor = {id: "test-only-trap", buildHash: integrity, integrity
		, sideModule: new URL("./fault.wasm", import.meta.url)
		, initializer: "initialize_BridgeTestFault"
		, bindingIr: {declarations: [{...scalar, id, kind: "function", result: {type: unit}}]}
		, privateAbi: {version: 2, dispatch: "scalar-frame-v2", exports: [{...scalar, bindingId: id, symbol: "lean_bridge_9a08ea85b538463aadcffcde", result: unit}]}};
	const fault = await loadComponent(descriptor);
	let checks = 0;
	const check = (ok, reason) => { if(!ok) throw new Error(reason); checks++; };
	const caught = call => {
		try
		{ call(); } catch(error)
		{ return error; }
		throw new Error("Expected an exception");
	};
	const via = callback => owned.viaNat(callback, 7n);
	const ticket = owned.newTicket(99n, "borrowed");
	const bundle = {primary: ticket, spare: {tag: "none"}, peers: [ticket], history: [], payload: {count: -17n, bytes: new Uint8Array([17])}};
	const closure = owned.dispatch(bundle);
	let borrowed;
	check(io.read_total() === 0, "IO already initialized with unexpected state");
	check(closure(value => {
		borrowed = value.primary; check(owned.serial(borrowed) === 99n && io.add(1) === 1, "closure re-entry");
		return value;
	}).primary === ticket && borrowed.disposed, "closure result identity / borrow scope");
	check(via(n => via(m => n + m + BigInt(io.add(1)))) === 16n, "nested callback re-entry");
	for(const error of [new Error("host exception"), new WebAssembly.RuntimeError("host-supplied error, not a guest trap")])
	{
		check(caught(() => via(() => { io.add(1); throw error; })) === error, "lost original host exception");
		check(owned.serial(ticket) === 99n, "host exception retired sibling");
	}
	const declared = caught(() => via(() => io.choose(true, false, "re-entry")));
	check(declared instanceof io.EIO_Ledger_choose && declared.payload.error === 4000000000, "lost typed EIO through callback");
	const readFailure = caught(() => via(() => io.io_failure()));
	check(readFailure instanceof io.IOError && /ledger offline/u.test(readFailure.message), "lost IO.Error through callback");
	check(io.read_total() === 4 && via(n => n) === 7n, "declared failure retired the shared heap");
	const before = finishes.count(); check(before > 0, "native finish observer did not see healthy calls");
	let guest;
	// Catch the trap inside the callback and even return a valid value: the
	// outer call must still fail, and no sibling may resume the damaged heap.
	const outer = caught(() => invokeFault(owned, n => { guest = caught(() => fault.call(id, [])); if(propagate) throw guest; return n; }));
	check(guest instanceof WebAssembly.RuntimeError && /unreachable/iu.test(guest.message), "not a real guest unreachable: " + guest);
	check(finishes.count() === before, "compiled callback resumed its native finish hook after the trap");
	const retired = e => e instanceof Error && /retired|poisoned/iu.test(e.message);
	check(propagate ? outer === guest : retired(outer), "unexpected outer exception: " + outer);
	for(const call of [() => io.add(1), () => via(n => n), () => owned.serial(ticket), () => closure(x => x), () => fault.call(id, [])])
		check(retired(caught(call)), "retired heap accepted a public call");
	check(ticket.disposed && closure.disposed, "outstanding leases stayed live");
	check(ticket.dispose() && !ticket.dispose() && closure.dispose() && !closure.dispose(), "lease disposal after retirement");
	check(owned.close() && !owned.close(), "component close after retirement");
	return {order, propagate, checks, counterBeforeTrap: 4, healthyFinishes: before, finishesAfterTrap: finishes.count() - before};
};
