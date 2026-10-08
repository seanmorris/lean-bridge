/**
 * Fin callback checks shared by the browser page, React effect and dedicated worker. The cases
 * are the installed Node acceptance's (tests/helpers/callback-fin-packages.mjs), counted instead
 * of asserted so every context reports the same totals.
 *
 * @file
 */

const text = value => JSON.stringify(value, (_, item) => typeof item === "bigint" ? `${item}n` : item);

/**
 * Exercise host callbacks, host replies and returned closures through the public API and the
 * package-internal runtime, which skips the generated JavaScript validation. Every rejection must
 * come from the package, and the next valid call must still succeed.
 *
 * @param request - Installed package request (module name and profile).
 * @param api - Loaded public API with `raw(name, args)` for direct runtime calls.
 */
export const executeCorpus = (request, api) => {
	let checks = 0, rejections = 0;
	const check = (ok, label) => { if(!ok) throw new Error(`failed: ${label}`); checks++; };
	const same = (actual, expected, label) => check(text(actual) === text(expected), `${label}: ${text(actual)}`);
	// A pattern names the layer that must reject: /below/ for JavaScript, /failed \(5\)/ for the compiled adapter.
	const rejected = (call, label, expected) => {
		try
		{ call(); }
		catch(error)
		{
			const matches = expected === undefined || (typeof expected === "function" ? expected(error) : expected.test(String(error?.message)));
			if(!matches) throw new Error(`wrong rejection: ${label}: ${String(error?.message)}`, { cause: error });
			rejections++;
			return;
		}
		throw new Error(`accepted: ${label}`);
	};
	const { raw } = api, below = /below/, adapter = /failed \(5\)/, gone = /disposed|released|below 0/;
	// Host callbacks and their replies, top-level and through a returned closure.
	same([api.three(value => value, 2n), api.five(value => value, 4n)], [2n, 4n], "identity callbacks");
	const closure = api.closure(2n), rawClosure = raw("closure", [2n]);
	for(let round = 0; round < 32; round++)
	{
		for(const bad of [3n, 999999999999999999999n])
		{
			rejected(() => api.three(() => bad, 1n), "public host reply", below);
			rejected(() => raw("three", [() => bad, 1n]), "raw host reply", adapter);
			rejected(() => closure(bad), "public closure argument", below);
			rejected(() => rawClosure(bad), "raw closure argument", adapter);
		}
		same([closure(2n), rawClosure(2n), raw("three", [value => value, 2n])], [1n, 1n, 2n], "recovers");
		let called = 0;
		rejected(() => raw("twice", [() => { called++; return 3n; }, 1n]), "raw twice", adapter);
		check(called === 1, "a failed callback suppresses later host calls");
	}
	for(const bad of [-1n, 1, null])
	{
		rejected(() => api.three(() => bad, 1n), `public malformed reply ${text(bad)}`);
		rejected(() => raw("three", [() => bad, 1n]), `raw malformed reply ${text(bad)}`);
		same(api.three(value => value, 2n), 2n, "recovers after a malformed reply");
	}
	const original = new Error("host callback failed");
	for(const call of [api.three, (f, value) => raw("three", [f, value])])
		rejected(() => call(() => { throw original; }, 1n), "host error identity", error => error === original);
	same(api.three(value => api.five(() => 4n, value) % 3n, 2n), 1n, "reentrant call");
	// Containers that can only be empty, and nested containers with every branch checked.
	same([api.emptyArray(value => value), api.emptyOption(value => value)], [[], { tag: "none" }], "empty containers");
	for(const [name, bad] of [["emptyArray", [0n]], ["emptyOption", { tag: "some", value: 0n }]])
	{
		rejected(() => api[name](() => bad), `public ${name}`, below);
		rejected(() => raw(name, [() => bad]), `raw ${name}`, adapter);
		same(api[name](value => value), name === "emptyArray" ? [] : { tag: "none" }, `${name} recovers`);
	}
	const nested = [{ tag: "some", value: [2n, { ok: 4n }] }, { tag: "some", value: [0n, { error: 1n }] }];
	same(api.nested(value => value, nested), nested, "nested");
	for(const bad of [[3n, { ok: 4n }], [2n, { ok: 5n }], [0n, { error: 2n }]])
	{
		const reply = [{ tag: "some", value: bad }];
		rejected(() => api.nested(() => reply, nested), "public nested reply", below);
		rejected(() => raw("nested", [() => reply, nested]), "raw nested reply", adapter);
	}
	same(api.nested(value => value, nested), nested, "nested recovers");
	// Fin 0 has no value, and every disposed closure stays disposed.
	const empty = api.emptyInput(0n), rawEmpty = raw("emptyInput", [0n]);
	rejected(() => empty(0n), "public Fin 0", below);
	rejected(() => rawEmpty(0n), "raw Fin 0", adapter);
	for(const value of [closure, rawClosure, empty, rawEmpty])
	{
		check(value.disposed === false, "live closure");
		value.dispose(); value.dispose();
		check(value.disposed === true, "disposed closure");
		rejected(() => value(0n), "disposed closure call", gone);
	}
	// Nominal fields: a record, an alias of an alias, a recursive variant and an uninhabited case.
	const packet = { digit: 9n, digits: [0n, 6n] };
	const cases = [
		["packet", packet, [{ ...packet, digit: 10n }, { ...packet, digits: [7n] }]]
		, ["digits", [0n, 6n], [[7n]]]
		, ["tree", { kind: "branch", value: [{ kind: "leaf", value: 4n }] }, [{ kind: "leaf", value: 5n }]]
		, ["choice", { kind: "digit", value: 2n }, [{ kind: "impossible", value: 0n }, { kind: "digit", value: 3n }]]];
	for(const [name, good, invalid] of cases) for(let round = 0; round < 32; round++)
	{
		for(const bad of invalid)
		{
			rejected(() => api[name](() => bad, good), `public ${name} reply`, below);
			rejected(() => raw(name, [() => bad, good]), `raw ${name} reply`, adapter);
			let calls = 0;
			rejected(() => raw(name, [value => { calls++; return value; }, bad]), `raw ${name} argument`, adapter);
			check(calls === 0, `${name} argument is rejected before the host runs`);
		}
		same([api[name](value => value, good), raw(name, [value => value, good])], [good, good], `${name} recovers`);
	}
	const packetClosure = api.packetClosure(2n), rawPacketClosure = raw("packetClosure", [2n]);
	for(const value of [packetClosure, rawPacketClosure])
	{
		rejected(() => value({ ...packet, digit: 10n }), "packet closure argument");
		same(value(packet), { ...packet, digit: 1n }, "packet closure");
		value.dispose();
		check(value.disposed === true, "packet closure disposed");
		rejected(() => value(packet), "disposed packet closure", /disposed|released/);
	}
	let reads = 0;
	const accessor = Object.defineProperty({ digits: packet.digits }, "digit", { enumerable: true, get: () => { reads++; return 1n; } });
	rejected(() => api.packet(() => accessor, packet), "accessor reply", /own data fields/);
	check(reads === 0, "an accessor reply is never read");
	same(api.scalar(2n), 2n, "scalar");
	rejected(() => raw("scalar", [3n]), "raw scalar", adapter);
	same(api.scalar(2n), 2n, "scalar recovers");
	return { module: request.module, checks, rejections };
};
