/**
 * Source-free public API checks shared by Node, browser, React and workers.
 *
 * @file
 */

/**
 * Run lifetime checks against the installed component.
 *
 * @param api - Public API.
 */
export const runCallbackResults = api => {
	let checks = 0;
	const check = (condition, label) => { checks++; if(!condition) throw new Error(label); };
	const rejects = (operation, pattern) => {
		let error;
		try
		{ operation(); }
		catch(caught)
		{ error = caught; }
		check(error instanceof Error && pattern.test(error.message), "Expected rejection: " + pattern);
	};
	const expired = owner => {
		check(owner.disposed, "Selected argument must expire its descendants");
		rejects(() => owner.get(), /expired|disposed/u);
	};
	const release = owner => { owner.dispose(); check(owner.disposed, "Owner must be disposed"); };
	const payload = { count: -(1n << 140n), bytes: new Uint8Array([0, 255, 42]) };
	const record = primary => ({ primary, spare: { tag: "none" }, peers: [], history: [], payload });
	const first = api.newTicket(42n, "callback\0💠"), second = api.newTicket(99n, "other");
	check(api.label(first) === "callback\0💠", "Unicode and embedded NUL");
	const captured = api.echoRecord(record(first.get())), supplied = api.echoRecord(record(second.get()));
	const closure = api.makeRecord(captured), leased = api.makeLeasedRecord(captured);
	rejects(() => closure.get()(false, supplied.get()), /foreign or wrong-type value/u);
	rejects(() => closure.get()(false, first), /type/u);
	const view = closure.get()(true, supplied), nested = closure.get()(false, view);
	check(api.serial(nested.get().primary) === 42n, "Captured result data");
	check(nested.get().payload.count === payload.count, "Exact integer payload");
	check(nested.get().payload.bytes.join() === "0,255,42", "Byte payload");
	const saved = nested.retain(), independent = leased.get()(false, supplied);
	release(captured); release(closure); release(leased);
	check(api.serial(nested.get().primary) === 42n, "Capture owner is not the result anchor");
	release(supplied); expired(view); expired(nested);
	check(api.serial(saved.get().primary) === 42n, "Retained result survives original owner");
	check(api.serial(independent.get().primary) === 99n, "Leased callback signature remains independent");
	for(const owner of [view, nested, saved, independent]) release(owner);
	const empty = api.echoRecursive({ kind: "branch", children: [] }), recursive = api.makeRecursive(empty);
	const emptyView = recursive.get()(false, empty), descendant = recursive.get()(false, emptyView);
	const retainedEmpty = descendant.retain();
	release(emptyView); expired(descendant);
	check(retainedEmpty.get().kind === "branch" && retainedEmpty.get().children.length === 0, "Empty values still have independent retained owners");
	for(const owner of [empty, recursive, descendant, retainedEmpty]) release(owner);
	const owner = api.echoRecord(record(first.get()));
	let escaped, returned;
	let output = api.callbackRecord(owner, value => { escaped = value.primary; return value; });
	check(escaped.disposed, "Host callback arguments expire on return");
	rejects(() => api.serial(escaped), /expired|disposed/u);
	check(api.serial(output.get().primary) === 42n, "Borrowed host reply crosses before frame expiration");
	release(output);
	output = api.callbackRecord(owner, value => { returned = api.echoRecord(value); return returned; });
	check(api.serial(output.get().primary) === 42n, "Reentrant whole-owner host reply");
	release(output); release(returned);
	const failure = new Error("host callback failed"); let thrown;
	try
	{ api.callbackRecord(owner, () => { throw failure; }); }
	catch(error)
	{ thrown = error; }
	check(thrown === failure, "Host exception identity");
	rejects(() => api.callbackRecord(owner, value => ({ ...value, primary: escaped })), /expired|disposed/u);
	output = api.callbackRecursive({ kind: "branch", children: [{ kind: "leaf", ticket: first.get() }] }, value => value);
	check(api.serial(output.get().children[0].ticket) === 42n, "Recursive callback reply recovers after error");
	release(output); release(owner); release(first); release(second);
	return { checks, borrowedResults: true, transitiveExpiration: true, hostReplyHandoff: true };
};
