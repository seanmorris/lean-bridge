/** @file Own synchronous cursor identities without keeping their JavaScript iterators alive. */
const heaps = new WeakMap(), live = new Set();
const keyOf = ([id, domain]) => domain + ":" + id;
const processHost = globalThis.process?.release?.name === "node" ? globalThis.process : null;
const pageHost = globalThis.window;
const drain = () => {
	for(const state of live)
	{
		try
		{ state.close(); }
		catch
		{ state.forget(); } // A failed or retired heap must not block other owners.
	}
};
const leaving = event => { if(!event.persisted) drain(); };
const listen = attach => {
	if(attach)
	{
		processHost?.on("exit", drain);
		pageHost?.addEventListener("pagehide", leaving);
	} else
	{
		processHost?.off("exit", drain);
		pageHost?.removeEventListener("pagehide", leaving);
	}
};
const registry = new FinalizationRegistry(state => {
	try
	{ state.close(); } catch
	{ state.forget(); }
});

/**
 * Forget every cursor on a retired heap without calling a native finalizer.
 *
 * @param module - The retired shared Emscripten instance.
 */
export const abandonImmediateCursors = module => {
	for(const state of heaps.get(module)?.values() ?? []) state.forget();
};

/**
 * Bind direct iterators to one shared Wasm heap. Native identities must be
 * unique across all its components. Keep cleanup state but never the facade
 * in the registry; an explicit return, exhaustion, and finalization can race
 * only to release the same state once.
 *
 * @param module - Heap that allocated the two-word private identities.
 * @param methods - Public declaration keys and their checked cursor shapes.
 * @param request - Checked synchronous transport for open, next and close.
 * @param lifecycle - Heap validity and permanent retirement hooks.
 * @param end - Sentinel distinct from every possible yielded value.
 */
export const bindImmediateCursors = (module, methods, request, lifecycle, end) => {
	const owners = heaps.get(module) ?? new Map();
	heaps.set(module, owners);
	const iterate = (id, args, translate = e => e) => {
		const method = methods.get(id);
		if(!method?.cursor || typeof translate !== "function") throw new TypeError("Unknown immediate Lean iterator");
		const handle = request(method, args, "open"), key = keyOf(handle);
		if(owners.has(key))
		{
			lifecycle.poison();
			// Never close an alias or free anything else on the retired heap.
			abandonImmediateCursors(module);
			throw new Error("Duplicate live Lean cursor identity");
		}
		const state = makeState(owners, key, method, handle, request);
		const it = facade(state, lifecycle, translate, end);
		try
		{
			registry.register(it, state, state);
			if(!live.size) listen(true);
			live.add(state);
			owners.set(key, state);
		} catch(error)
		{
			state.close();
			throw error;
		}
		return it;
	};
	return iterate;
};

// Keep the registered state outside the facade's lexical scope.
const makeState = (owners, key, method, handle, request) => {
	const state = {
		handle, method, request
		, forget: () => {
			state.handle = null;
			registry.unregister(state);
			owners.delete(key);
			if(live.delete(state) && !live.size) listen(false);
		}
		, close: (afterFailure = false) => {
			if(!state.handle) return;
			request(method, state.handle, "close", afterFailure);
			state.forget();
		}
	};
	return state;
};
const facade = (state, lifecycle, translate, end) => {
	const done = () => ({done: true, value: undefined});
	let busy = false;
	const guard = receiver => {
		if(receiver !== it || busy) throw new TypeError("Invalid or active Lean iterator");
		lifecycle.assertOpen();
	};
	const it = Object.freeze({
		/** This is a single-pass iterator, not a factory for new cursors. */
		[Symbol.iterator]() { guard(this); return this; }
		, /** Pull one value and close the owner on exhaustion or failure. */
		next() {
			guard(this); if(!state.handle) return done(); busy = true;
			try
			{
				const value = state.request(state.method, state.handle, "next");
				if(value === end)
				{ state.forget(); return done(); }
				return {done: false, value};
			} catch(error)
			{
				try
				{ state.close(true); } catch { /* Preserve the first failure. */ }
				throw translate(error);
			} finally
			{ busy = false; }
		}
		, /** Close without pulling, including on early loop exit. */
		return() { guard(this); state.close(); return done(); },
		...Symbol.dispose ? {
			/** Release on scope exit when the host supports explicit resource management. */
			[Symbol.dispose]() { guard(this); state.close(); }
		} : {}
	});
	return it;
};
