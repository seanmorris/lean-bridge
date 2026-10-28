/**
 * Private resource and closure leases for one authenticated Wasm component.
 * Result publication is transactional. Tokens never become public properties.
 *
 * @file
 */

const invalid = message => { throw new TypeError(`Owned wasm32 registry: ${message}`); };
const weakReference = value => new WeakRef(value);
const finalizationRegistry = operation => new FinalizationRegistry(operation);
const identityHandles = new WeakSet();
const cleanupAll = operations => {
	let failed = false, failure;
	for(const operation of operations) try
	{ operation(); }
	catch(error)
	{
		if(!failed)
		{ failed = true; failure = error; }
	}
	if(failed) throw failure;
};

/**
 * Bind host leases to a component in the existing shared heap. Native operations
 * authenticate result owners and identities, and share the heap's poison state.
 * They must not initialize a second runtime. A successful retain operation uses
 * an independent output transaction, so disposing either lease leaves the other.
 *
 * @param layout - Authenticated compiler-checked owned wasm32 layout.
 * @param native - Private owner claims, release, invocation and retirement hooks.
 * @param options - Private allocation checkpoints and deterministic GC test hooks.
 */
export const createOwnedWasmRegistry = (layout, native, options = {}) => {
	if(layout?.kind !== "owned-javascript-wasm32-layout" || layout.native?.wordBits !== 32)
		invalid("expected the compiler-checked wasm32 layout");
	for(const name of ["assertOpen", "assertOwner", "claimIdentity", "releaseOwner", "invoke", "retain", "close", "poison"])
		if(typeof native[name] !== "function") invalid(`missing native ${name} operation`);
	const types = new Map(structuredClone(layout.types).filter(type => ["resource", "callback"].includes(type.kind)).map(type => [type.id, type]));
	const handles = new WeakMap(), canonical = new Map(), groups = new Set(), owners = new Set();
	const checkpoint = options.checkpoint ?? (() => {}), enqueue = options.enqueue ?? queueMicrotask;
	const reference = options.createWeakReference ?? weakReference;
	let closed = false, poisoned = false, nativeClosed = false, active = 0, live = 0;
	const unavailable = () => closed || poisoned;
	const consumed = group => group.consumed || Boolean(group.move?.consumed());
	const requireOpen = () => {
		if(unavailable()) throw new Error("Owned wasm32 registry is closed or poisoned");
		native.assertOpen();
	};
	const poison = () => {
		if(poisoned) return;
		poisoned = true; native.poison();
	};
	const retired = () => {
		if(unavailable()) return true;
		try
		{ native.assertOpen(); return false; }
		catch
		{ poison(); return true; }
	};
	const checkedCleanup = operation => {
		if(poisoned) return;
		try
		{ operation(); }
		catch(error)
		{ poison(); throw error; }
	};
	const finishClose = () => {
		if(closed && !active && !nativeClosed)
		{ nativeClosed = true; checkedCleanup(() => native.close()); }
	};
	const releaseGroup = group => {
		if(group.released || group.pins || (!group.cancelled && (!group.published || group.states.size))) return;
		group.released = true; groups.delete(group);
		if(!group.borrowed)
		{ owners.delete(group.owner); checkedCleanup(() => native.releaseOwner(group.owner)); }
	};
	const dispose = state => {
		if(state.disposed) return false;
		state.disposed = true; finalizer.unregister(state);
		state.group.states.delete(state); live--;
		if(canonical.get(state.key) === state) canonical.delete(state.key);
		releaseGroup(state.group); return true;
	};
	// Never enter Wasm from a finalizer. The queued operation uses the same lease
	// checks as explicit disposal, including close, poison and active-call pins.
	const finalizer = (options.createFinalizationRegistry ?? finalizationRegistry)(state => {
		enqueue(() => {
			try
			{ dispose(state); }
			catch { /* Cleanup already poisoned the shared heap. */ }
		});
	});
	const typeOf = type => {
		const resolved = types.get(typeof type === "string" ? type : type?.id);
		if(!resolved) invalid("unknown nominal identity type");
		return resolved;
	};
	const requireState = (state, type = state?.type) => {
		requireOpen();
		if(!state || state.type.id !== type?.id) invalid("foreign or wrong-type resource");
		if(state.disposed || state.group.cancelled || state.group.released || consumed(state.group))
			throw new Error("Lean resource is disposed or its borrow expired");
		if(!state.group.published) invalid("result has not been published");
		return state;
	};
	const pin = (counted = true) => {
		requireOpen();
		if(counted && active === 64) throw new RangeError("Owned wasm32 reentry limit (64) exceeded");
		if(!counted && !active) invalid("callback pins require an enclosing call");
		checkpoint();
		const pinned = new Set(); let finished = false, transfers = null; if(counted) active++;
		const pinState = state => {
			if(!pinned.has(state.group))
			{ pinned.add(state.group); state.group.pins++; }
			return state.token;
		};
		return Object.freeze({
			toToken: (type, value) => {
				if(finished) invalid("call scope has expired");
				return pinState(requireState(handles.get(value), typeOf(type)));
			}
			, transfers: (count, isConsumed) => {
				if(finished || transfers || !Number.isInteger(count) || count < 1 || count > 4096 || typeof isConsumed !== "function")
					invalid("invalid input-transfer scope");
				const rows = Array.from({ length: count }, () => new Set()), states = new Set();
				let ended = false;
				transfers = Object.freeze({
					toToken: (index, type, value) => {
						if(ended || finished || !rows[index]) invalid("input-transfer scope has expired");
						const state = requireState(handles.get(value), typeOf(type)), group = state.group;
						if(group.borrowed) invalid("borrowed callback arguments cannot transfer ownership");
						if(group.move && (group.move.scope !== transfers || group.move.index !== index))
							invalid("one result owner cannot supply multiple consuming arguments or calls");
						checkpoint();
						pinState(state); rows[index].add(group); states.add(state);
						group.move ??= { scope: transfers, index, consumed: isConsumed };
						return state.token;
					}
					, owners: () => {
						if(ended || finished) invalid("input-transfer scope has expired");
						for(const state of states) requireState(state);
						return rows.map(row => [...row].map(group => group.owner));
					}
					, finish: () => {
						if(ended) return; ended = true;
						const moved = isConsumed();
						// Mark the entire set before disposing any wrapper. The native
						// handoff flag already makes aliases unusable during reentry.
						for(const row of rows) for(const group of row)
						{ group.consumed = moved; group.move = null; }
						if(moved) cleanupAll(rows.flatMap(row => [...row].flatMap(group => [...group.states].map(state => () => dispose(state)))));
					}
				});
				return transfers;
			}
			, close: () => {
				if(finished) return; finished = true;
				try
				{ cleanupAll([() => transfers?.finish(), ...[...pinned].map(group => () => { group.pins--; releaseGroup(group); })]); }
				finally
				{ if(counted) active--; pinned.clear(); finishClose(); }
			}
		});
	};
	const use = (state, operation) => {
		requireState(state); const scope = pin(); let failed = false, failure, result;
		try
		{
			state.group.pins++;
			try
			{ result = operation(state.type, state.token, scope); }
			finally
			{ state.group.pins--; }
		}
		catch(error)
		{ failed = true; failure = error; }
		try
		{ cleanupAll([() => releaseGroup(state.group), scope.close]); }
		catch(error)
		{ if(!failed) throw error; }
		if(failed) throw failure;
		return result;
	};
	const callable = state => (...args) => use(state, (type, token, scope) => native.invoke(type, token, args, scope));
	const wrap = (group, type, token, key) => {
		if(live === 4096) throw new RangeError("Owned wasm32 resource registry is full");
		checkpoint();
		const state = { group, type, token, key, disposed: false, reference: null };
		group.states.add(state); live++;
		try
		{
			checkpoint();
			const value = type.kind === "callback" ? callable(state) : Object.create(null);
			Object.defineProperties(value, {
				disposed: { get: () => state.disposed || state.group.cancelled || retired() || consumed(state.group) }
				, dispose: { value: () => dispose(state) }
				, retain: { value: () => use(state, (type, token, scope) => native.retain(type, token, scope)) }
				, ...Symbol.dispose ? { [Symbol.dispose]: { value: () => { dispose(state); } } } : {}
			});
			checkpoint(); state.reference = reference(value);
			handles.set(value, state); identityHandles.add(value); finalizer.register(value, state, state);
			return Object.freeze(value);
		}
		catch(error)
		{
			try
			{ dispose(state); }
			catch { /* Preserve the construction failure. */ }
			throw error;
		}
	};
	const transaction = (owner, borrowed, independent) => {
		requireOpen(); native.assertOwner(owner);
		if(!borrowed && owners.has(owner)) invalid("result owner already adopted");
		let group;
		try
		{
			checkpoint();
			group = { owner, borrowed, independent, pins: 0
				, states: new Set(), published: borrowed
				, cancelled: false, released: false, values: new Map() };
			groups.add(group); if(!borrowed) owners.add(owner);
			checkpoint();
		}
		catch(error)
		{
			if(group)
			{ groups.delete(group); owners.delete(owner); }
			if(!borrowed) try
			{ checkedCleanup(() => native.releaseOwner(owner)); }
			catch { /* Preserve allocation failure. */ }
			throw error;
		}
		let finished = false;
		const requireTransaction = () => {
			requireOpen();
			if(finished || group.cancelled || group.released) invalid("result transaction has finished");
		};
		const rollback = () => {
			if(finished) return false;
			finished = true; group.cancelled = true; group.values.clear();
			try
			{ cleanupAll([...group.states].map(state => () => dispose(state))); }
			finally
			{ releaseGroup(group); }
			return true;
		};
		return Object.freeze({
			project: (type, token) => {
				requireTransaction(); type = typeOf(type);
				if(typeof token !== "bigint" || token <= 0n || token > 0xffffffffffffffffn) invalid("invalid private token");
				native.claimIdentity(owner, type, token);
				const key = `${type.id}:${token}`;
				if(group.values.has(key)) return group.values.get(key);
				if(!borrowed && !independent)
				{
					const existing = canonical.get(key), value = existing?.reference.deref();
					if(existing && !existing.disposed)
					{
						if(value !== undefined && !consumed(existing.group))
						{ group.values.set(key, value); return value; }
						dispose(existing);
					}
				}
				const value = wrap(group, type, token, key); group.values.set(key, value); return value;
			}
			, commit: () => {
				requireTransaction();
				if(borrowed) invalid("borrowed callback arguments cannot be published");
				checkpoint();
				if(!independent) for(const state of group.states)
					if(!canonical.has(state.key)) canonical.set(state.key, state);
				group.published = true; finished = true; group.values.clear(); releaseGroup(group);
			}
			, rollback
		});
	};
	return Object.freeze({
		assertOpen: requireOpen, pin: () => pin(), borrowPin: () => pin(false), poison
		, isHandle: value => identityHandles.has(value)
		, output: (owner, { independent = false } = {}) => transaction(owner, false, independent)
		, borrow: owner => transaction(owner, true, true)
		, close: () => {
			if(closed) return false; closed = true;
			try
			{
				cleanupAll([...groups].map(group => () => {
					group.cancelled = true; group.values.clear();
					cleanupAll([...group.states].map(state => () => dispose(state)));
					releaseGroup(group);
				}));
			}
			finally
			{ canonical.clear(); finishClose(); }
			return true;
		}
	});
};
