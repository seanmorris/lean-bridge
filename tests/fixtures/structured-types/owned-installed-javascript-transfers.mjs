/**
 * Installed Node, browser, React and worker checks for consuming Lean APIs.
 *
 * @file
 */

/**
 * Exercise the installed public exports without exposing native transport state.
 *
 * @param api - Generated consuming package API.
 */
export function runTransfers(api)
{
	let checks = 0;
	const names = new Set();
	const check = condition => { checks++; if(!condition) throw new Error("Installed ownership transfer check " + checks); };
	const call = (name, ...args) => { names.add(name); return api[name](...args); };
	const rejects = (operation, expected) => {
		let failed = false;
		try
		{ operation(); }
		catch(error)
		{ failed = true; check(expected instanceof RegExp ? expected.test(String(error)) : error === expected); }
		check(failed);
	};
	const resource = value => value && typeof value.dispose === "function";
	const release = value => {
		if(resource(value)) value.dispose();
		else if(value && typeof value === "object") for(const item of Object.values(value)) release(item);
	};
	const payload = { count: -(1n << 140n), bytes: new Uint8Array([0, 128, 255]) };
	const bundle = ticket => ({ primary: ticket, spare: { tag: "some", value: ticket }, peers: [ticket, ticket], history: [ticket], payload });
	const serial = 1n << 90n;
	const fresh = () => call("newTicket", serial, "installed\0🙂");
	const shape = value => {
		if(resource(value)) return typeof value === "function" ? ["closure"] : ["resource", call("serial", value).toString(), call("label", value)];
		if(value instanceof Uint8Array) return ["bytes", ...value];
		if(Array.isArray(value)) return ["array", ...value.map(shape)];
		if(value && typeof value === "object") return ["object", ...Object.entries(value).map(([key, child]) => [key, shape(child)])];
		return [typeof value, Object.is(value, -0) ? "-0" : String(value)];
	};
	const exercise = (name, create) => {
		const ticket = fresh(), retained = ticket.retain(), input = create(ticket);
		const before = JSON.stringify(shape(input)), output = call(name, input);
		check(ticket.disposed); check(!retained.disposed);
		check(call("serial", retained) === serial);
		check(JSON.stringify(shape(output)) === before);
		rejects(() => call("serial", ticket), /disposed/);
		release(output); retained.dispose();
	};
	for(const [name, create] of [
		["retainTicket", ticket => ticket]
		, ["echoArray", ticket => [ticket, ticket]]
		, ["echoList", ticket => [ticket]]
		, ["echoOption", value => ({ tag: "some", value })]
		, ["echoResult", ticket => ({ ok: bundle(ticket) })]
		, ["echoResult", error => ({ error })]
		, ["echoTuple", ticket => [ticket, [{ tag: "some", value: ticket }, payload]]]
		, ["echoRecord", bundle], ["echoAlias", bundle]
		, ["echoVariant", ticket => ({ kind: "one", ticket })]
		, ["echoRow", value => [{ tag: "none" }, { tag: "some", value }]]
		, ["echoRecursive", ticket => ({ kind: "branch", children: [{ kind: "leaf", ticket }] })]
		, ["echoNested", ticket => [[{ tag: "some", value: { ok: bundle(ticket) } }], []]]
		, ["echoChain", ticket => ({ kind: "link", ticket, next: { tag: "some", value: { kind: "stop" } } })]
		, ["echoMixed", ticket => ({ ticket
			, markers: [{ tag: "none" }, { tag: "some", value: { tag: "some", value: false } }]
			, unit: { tag: "some", value: undefined }, result: { error: ticket }
			, signed: -(1n << 200n), unsigned: 1n << 201n, scalar: "💠"
			, precise: -0, approximate: Math.fround(1 / 3)
			, bytes: new Uint8Array([0, 255])
			, words: [0n, 18446744073709551615n]
			, product: [ticket, [{ tag: "some", value: ticket }, payload]]
			, chain: { kind: "link", ticket, next: { tag: "none" } } })]
	]) exercise(name, create);
	for(const [name, input] of [
		["echoArray", []], ["echoList", []], ["echoOption", { tag: "none" }]
		, ["echoVariant", { kind: "empty" }]
		, ["echoRecursive", { kind: "branch", children: [] }]
		, ["echoChain", { kind: "stop" }]
	]) check(JSON.stringify(shape(call(name, input))) === JSON.stringify(shape(input)));
	{
		const first = fresh(), second = fresh();
		const pair = call("echoVariant", { kind: "pair", first, second });
		check(first.disposed && second.disposed);
		const kept = pair.second.retain(), output = call("retainTicket", pair.first);
		check(pair.first.disposed && pair.second.disposed); check(call("serial", kept) === serial);
		release(output); kept.dispose();
	}
	{
		const first = fresh(), second = fresh();
		rejects(() => call("bundle", first, { tag: "none" }, [first], [], payload), /multiple consuming/);
		check(!first.disposed);
		const output = call("bundle", first, { tag: "some", value: second }, [second], [first], payload);
		check(first.disposed && second.disposed);
		check(call("primary", output) === output.primary);
		check(call("payload", output).count === payload.count); release(output);
	}
	let borrowed, kept;
	{
		const ticket = fresh();
		const output = call("callbackRecord", bundle(ticket), argument => {
			check(ticket.disposed); borrowed = argument.primary;
			rejects(() => call("echoRecord", argument), /borrowed callback/);
			kept = borrowed.retain(); return argument;
		});
		check(borrowed.disposed); check(call("serial", kept) === serial);
		kept.dispose(); release(output);
		const failed = fresh(), error = { reason: "callback failed after handoff" };
		rejects(() => call("callbackRecord", bundle(failed), () => { throw error; }), error);
		check(failed.disposed);
	}
	{
		const ticket = fresh(), output = call("callbackRecursive", { kind: "leaf", ticket }, tree => tree);
		check(ticket.disposed); release(output);
		const invalid = fresh(), input = bundle(invalid);
		rejects(() => call("echoRecord", { ...input, extra: 1 }), /fields|record/);
		check(!invalid.disposed); check(call("serial", invalid) === serial); invalid.dispose();
	}
	const closure = call("newRecordCallback"), moved = call("transferCallback", closure);
	check(closure.disposed); check(!moved.disposed);
	rejects(() => call("transferCallback", value => value), /foreign or wrong-type/);
	{
		const input = fresh(), output = moved(bundle(input));
		check(output.primary === input); release(output); input.dispose(); moved.dispose();
	}
	for(const [name, create] of [["makeRecord", bundle], ["makeRecursive", ticket => ({ kind: "leaf", ticket })]])
	{
		const ticket = fresh(), fn = call(name, create(ticket)); check(ticket.disposed);
		const argument = fresh(), answer = fn(true, create(argument));
		check(call("serial", name === "makeRecord" ? answer.primary : answer.ticket) === serial);
		release(answer); argument.dispose(); fn.dispose(); check(fn.disposed);
	}
	check(names.size === 26);
	return { checks, exports: names.size, serial: serial.toString()
		, borrowExpired: borrowed.disposed, closureDisposed: closure.disposed
		, transferredInputs: true };
}
