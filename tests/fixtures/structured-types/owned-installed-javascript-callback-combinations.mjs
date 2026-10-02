/**
 * Public receiver methods, callback-local borrows and consuming handoffs.
 *
 * @file
 */

/**
 * Exercise the combined capabilities through an installed component.
 *
 * @param api - Public component API, without runtime test hooks.
 */
export const runCallbackCombinations = api => {
	let checks = 0;
	const roots = [];
	const own = value => { roots.push(value); return value; };
	const check = (condition, label) => { checks++; if(!condition) throw new Error(label); };
	const rejects = (operation, predicate) => {
		let error;
		try
		{ operation(); }
		catch(caught)
		{ error = caught; }
		check(error instanceof Error && predicate(error), "Expected operation to reject");
	};
	const expired = value => {
		check(value.disposed, "Consumed argument must expire borrowed descendants");
		rejects(() => value.get(), error => /expired|disposed/u.test(error.message));
	};
	const ticket = own(api.newTicket(42n, "receiver"));
	const root = own(api.echoRecord({ primary: ticket.get()
		, spare: { tag: "none" }, peers: [], history: []
		, payload: { count: 7n, bytes: new Uint8Array([42]) } }));
	const alias = own(root.share()), closure = own(root.makeRecord());
	const view = own(closure.get()(false, root)), nested = own(view.borrowRecord());
	const retained = own(nested.retain());
	root.dispose(); check(root.disposed, "Disposed alias closes");
	check(api.serial(nested.get().primary) === 42n, "Remaining share keeps descendants alive");
	let rejectedCalls = 0;
	rejects(() => view.moveRecord(value => { rejectedCalls++; return value; }), error => /borrowed|transfer/u.test(error.message));
	check(rejectedCalls === 0, "Invalid transfer must not invoke the callback");
	check(api.serial(alias.get().primary) === 42n, "Invalid transfer preserves its owner");
	let escaped, callbacks = 0;
	const moved = own(alias.moveRecord(value => {
		callbacks++; expired(root); expired(alias); expired(view); expired(nested);
		escaped = value.primary;
		check(api.serial(escaped) === 42n, "Callback has a valid temporary argument");
		return value;
	}));
	check(callbacks === 1, "Consuming receiver invokes exactly once");
	check(escaped.disposed, "Host arguments expire after reply conversion");
	rejects(() => api.serial(escaped), error => /expired|disposed/u.test(error.message));
	check(api.serial(moved.get().primary) === 42n, "Reply survives the host frame");
	check(api.serial(retained.get().primary) === 42n, "Retained copy survives transfer");
	const captured = own(closure.get()(true, moved));
	check(api.serial(captured.get().primary) === 42n, "Closure capture survives the original transfer");
	moved.dispose(); expired(captured);
	const second = own(retained.retain()), secondClosure = own(second.makeRecord());
	const secondView = own(secondClosure.get()(false, second));
	const failure = new Error("consuming callback failed");
	rejects(() => second.moveRecord(() => { throw failure; }), error => error === failure);
	expired(second); expired(secondView);
	check(api.serial(retained.get().primary) === 42n, "Failed handoff preserves independent copies");
	for(const value of roots.reverse())
	{ value.dispose(); check(value.disposed, "Every public owner closes"); }
	return { checks, receiverMethods: true, transitiveExpiration: true
		, consumingHandoff: true, borrowedTransferRejected: true };
};
