/**
 * Whole-value roots, non-owning views and call pins for anchored Wasm results.
 * Public roots alone extend a value's lifetime, including values with no leaves.
 *
 * @file
 */

const identityHandles = new WeakSet();
const invalid = message => { throw new TypeError(`Owned wasm32 registry: ${message}`); };
const cleanupAll = operations => {
	let failed = false, failure;
	for(const operation of operations) try
	{ operation(); }
	catch(error)
	{ if(!failed)
	{ failed = true; failure = error; } }
	if(failed) throw failure;
};

/**
 * The native ledger enforces original batch generations. Host roots invalidate
 * immediately; active calls defer freeing storage but cannot revive a root.
 * Finalizer holdings contain no payloads or wrappers, including indirect cycles.
 *
 * @param layout - Authenticated wasm32 layout with parameter-anchored results.
 * @param native - Checked native lifecycle, copy and identity operations.
 * @param options - Deterministic allocation and garbage-collection test hooks.
 */
export const createOwnedWasmBorrowRegistry = (layout, native, options = {}) => {
	const types = new Map(layout.types.map(type => [type.id, type]));
	for(const alias of layout.native.aliases) types.set(alias.id, types.get(alias.target));
	const views = new WeakMap(), roots = new WeakMap(), owners = new Set(), groups = new Set();
	const checkpoint = options.checkpoint ?? (() => {}), enqueue = options.enqueue ?? queueMicrotask;
	let closed = false, poisoned = false, nativeClosed = false, active = 0, live = 0;
	const assertOpen = () => {
		if(closed || poisoned) throw new Error("Owned wasm32 registry is closed or poisoned");
		native.assertOpen();
	};
	const poison = () => {
		if(!poisoned)
		{ poisoned = true; native.poison(); }
	};
	const cleanup = operation => {
		if(poisoned) return;
		try
		{ operation(); }
		catch(error)
		{ poison(); throw error; }
	};
	const finishClose = () => {
		if(closed && !active && !nativeClosed)
		{ nativeClosed = true; cleanup(() => native.close()); }
	};
	const expired = group => {
		for(let current = group, depth = 0; current; current = current.anchor)
		{
			if(depth++ > 128 || current.cancelled || current.released || current.invalid || current.consumed || current.move?.consumed()) return true;
		}
		return false;
	};
	const requireGroup = group => {
		assertOpen();
		if(!group || expired(group)) throw new Error("Lean value is disposed or its borrow expired");
		if(!group.published) invalid("result has not been published");
		return group;
	};
	const releaseGroup = group => {
		if(group.borrowed && !group.cancelled) return;
		if(group.released || group.pins || (!group.cancelled && !group.invalid && (!group.published || group.roots.size))) return;
		group.released = true; groups.delete(group);
		if(!group.borrowed)
		{ owners.delete(group.owner); cleanup(() => native.releaseOwner(group.owner)); }
	};
	const invalidate = group => {
		if(group.invalid) return;
		group.invalid = true;
		if(!group.borrowed && !group.released) cleanup(() => native.revokeOwner(group.owner));
		cleanupAll([...group.views].map(state => () => dispose(state)));
	};
	const dispose = state => {
		if(state.disposed) return false;
		state.disposed = true; finalizer.unregister(state); live--;
		const group = state.group;
		(state.root ? group.roots : group.views).delete(state);
		if(state.root && !group.roots.size && group.published) invalidate(group);
		releaseGroup(group); return true;
	};
	const finalizer = (options.createFinalizationRegistry ?? (operation => new FinalizationRegistry(operation)))(state => {
		enqueue(() => {
			try
			{ dispose(state); }
			catch { /* Cleanup already retired the heap. */ }
		});
	});
	const typeOf = type => {
		const resolved = types.get(typeof type === "string" ? type : type?.id);
		if(!resolved) invalid("unknown value type");
		return resolved;
	};
	const requireState = (state, type = state?.type) => {
		assertOpen();
		if(!state || state.type.id !== type?.id) invalid("foreign or wrong-type value");
		if(state.disposed) throw new Error("Lean value is disposed or its borrow expired");
		requireGroup(state.group); return state;
	};
	const checkRoot = (type, value) => {
		const root = roots.get(value);
		requireState(root?.state, typeOf(type)); return root;
	};
	const pin = (counted = true) => {
		assertOpen();
		if(counted && active === 64) throw new RangeError("Owned wasm32 reentry limit (64) exceeded");
		if(!counted && !active) invalid("callback pins require an enclosing call");
		checkpoint();
		const pinned = new Set(); let finished = false, transfers = null;
		if(counted) active++;
		const pinGroup = group => {
			if(finished) invalid("call scope has expired");
			requireGroup(group);
			if(!pinned.has(group))
			{ pinned.add(group); group.pins++; }
		};
		return Object.freeze({
			toToken: (type, value) => {
				const state = requireState(views.get(value), typeOf(type)); pinGroup(state.group); return state.token;
			}
			, whole: (type, value) => {
				const { state, payload } = checkRoot(type, value); pinGroup(state.group);
				return { payload, owner: state.group.owner, group: state.group };
			}
			, unwrap: (type, value) => {
				if(!roots.has(value)) return value;
				const { state, payload } = checkRoot(type, value); pinGroup(state.group); return payload;
			}
			, transfers: (count, isConsumed) => {
				if(finished || transfers || !Number.isInteger(count) || count < 1 || count > 4096 || typeof isConsumed !== "function") invalid("invalid input-transfer scope");
				const rows = new Array(count).fill(null); let ended = false;
				transfers = Object.freeze({
					whole: (index, type, value) => {
						if(ended || finished || index < 0 || index >= count || rows[index]) invalid("invalid consuming argument");
						const { state, payload } = checkRoot(type, value), group = state.group;
						if(group.borrowed || group.anchor) invalid("borrowed values cannot transfer ownership; retain an independent copy first");
						if(group.move) invalid("one result owner cannot supply multiple consuming arguments or calls");
						checkpoint(); pinGroup(group); rows[index] = group;
						group.move = { scope: transfers, consumed: isConsumed };
						return payload;
					}
					, toToken: (index, type, value) => {
						if(ended || finished || !rows[index]) invalid("input-transfer scope has expired");
						const state = requireState(views.get(value), typeOf(type));
						if(state.group !== rows[index]) invalid("consuming argument contains a foreign owner");
						pinGroup(state.group); return state.token;
					}
					, owners: () => {
						if(ended || finished || rows.some(group => !group)) invalid("incomplete input-transfer scope");
						return rows.map(group => { requireGroup(group); return [group.owner]; });
					}
					, finish: () => {
						if(ended) return; ended = true;
						const moved = isConsumed();
						for(const group of rows) if(group)
						{ group.consumed = moved; group.move = null; }
						if(moved) cleanupAll(rows.filter(Boolean).flatMap(group => [...group.roots].map(state => () => dispose(state))));
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
		requireState(state); const scope = pin(); state.group.pins++;
		let failed = false, failure, result;
		try
		{ result = operation(scope); }
		catch(error)
		{ failed = true; failure = error; }
		finally
		{ state.group.pins--; }
		try
		{ cleanupAll([() => releaseGroup(state.group), scope.close]); }
		catch(error)
		{ if(!failed) throw error; }
		if(failed) throw failure;
		return result;
	};
	const isDisposed = state => {
		if(state.disposed || closed || poisoned || expired(state.group)) return true;
		try
		{ native.assertOpen(); return false; }
		catch
		{ poison(); return true; }
	};
	const createState = (group, type, root, token = null) => {
		if(live === 4096) throw new RangeError("Owned wasm32 resource registry is full");
		checkpoint();
		const state = { group, type, root, token, disposed: false };
		(root ? group.roots : group.views).add(state); live++; return state;
	};
	const wrapRoot = (group, type, payload) => {
		const state = createState(group, type, true);
		try
		{
			checkpoint(); const value = Object.create(null);
			Object.defineProperties(value, {
				disposed: { get: () => isDisposed(state) }
				, dispose: { value: () => dispose(state) }
				, get: { value: () => { requireState(state); return payload; } }
				, share: { value: () => { requireState(state); return wrapRoot(group, type, payload); } }
				, retain: { value: () => use(state, scope => native.copy(type, payload, scope)) }
				, ...Symbol.dispose ? { [Symbol.dispose]: { value: () => { dispose(state); } } } : {}
			});
			checkpoint(); roots.set(value, { state, payload }); finalizer.register(value, state, state);
			return Object.freeze(value);
		}
		catch(error)
		{ try
		{ dispose(state); } catch { /* Preserve construction failure. */ } throw error; }
	};
	const wrapView = (group, type, token) => {
		const state = createState(group, type, false);
		state.token = token;
		try
		{
			checkpoint();
			const value = type.kind === "callback"
				? (...args) => use(state, scope => native.invoke(type, token, args, scope)) : Object.create(null);
			Object.defineProperties(value, {
				disposed: { get: () => isDisposed(state) }
				, dispose: { value: () => dispose(state) }
				, retain: { value: () => use(state, scope => native.copy(type, value, scope)) }
				, equals: { value: other => {
					requireState(state); const candidate = views.get(other);
					if(!candidate || candidate.type.id !== type.id) return false;
					requireState(candidate); return candidate.token === token;
				} }
				, ...Symbol.dispose ? { [Symbol.dispose]: { value: () => { dispose(state); } } } : {}
			});
			checkpoint(); views.set(value, state); identityHandles.add(value); finalizer.register(value, state, state);
			return Object.freeze(value);
		}
		catch(error)
		{ try
		{ dispose(state); } catch { /* Preserve construction failure. */ } throw error; }
	};
	const transaction = (owner, borrowed, { type = null, anchor = null } = {}) => {
		assertOpen(); native.assertOwner(owner);
		if(!borrowed && owners.has(owner)) invalid("result owner already adopted");
		let group;
		try
		{
			checkpoint();
			group = { owner, borrowed, anchor, published: borrowed, pins: 0
				, roots: new Set()
				, views: new Set()
				, cancelled: false
				, released: false
				, invalid: false };
			groups.add(group); if(!borrowed) owners.add(owner); checkpoint();
		}
		catch(error)
		{
			if(group)
			{ groups.delete(group); owners.delete(owner); }
			if(!borrowed) try
			{ cleanup(() => native.releaseOwner(owner)); } catch { /* Preserve construction failure. */ }
			throw error;
		}
		let finished = false; const values = new Map();
		const requireTransaction = () => {
			assertOpen();
			if(finished || expired(group)) invalid("result transaction has finished or its borrow expired");
		};
		const rollback = () => {
			if(finished) return false;
			finished = true; group.cancelled = true; values.clear();
			try
			{ cleanupAll([...group.roots, ...group.views].map(state => () => dispose(state))); }
			finally
			{ releaseGroup(group); }
			return true;
		};
		return Object.freeze({
			project: (type, token) => {
				requireTransaction(); type = typeOf(type);
				if(!["resource", "callback"].includes(type.kind) || typeof token !== "bigint" || token <= 0n || token > 0xffffffffffffffffn) invalid("invalid private identity");
				native.claimIdentity(owner, type, token); const key = `${type.id}:${token}`;
				if(!values.has(key)) values.set(key, wrapView(group, type, token));
				return values.get(key);
			}
			, commit: payload => {
				requireTransaction();
				if(borrowed) invalid("borrowed callback arguments cannot be published");
				const result = typeOf(type), value = result.representation === "copied" ? payload : wrapRoot(group, result, payload);
				checkpoint(); requireTransaction();
				group.published = true; finished = true; values.clear(); releaseGroup(group); return value;
			}
			, rollback
		});
	};
	return Object.freeze({
		assertOpen, pin: () => pin(), borrowPin: () => pin(false), poison
		, isHandle: value => identityHandles.has(value)
		, output: (owner, options) => transaction(owner, false, options)
		, borrow: owner => transaction(owner, true)
		, close: () => {
			if(closed) return false; closed = true;
			try
			{
				cleanupAll([...groups].map(group => () => {
					group.cancelled = true; invalidate(group);
					cleanupAll([...group.roots, ...group.views].map(state => () => dispose(state))); releaseGroup(group);
				}));
			}
			finally
			{ finishClose(); }
			return true;
		}
	});
};
