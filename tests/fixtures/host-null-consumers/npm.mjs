/**
 * Installed HostNull checks shared by Node, browser page, React, and workers.
 *
 * @file
 */

/**
 * Exercise all five value positions without private runtime access.
 *
 * @param api - Installed public HostNull API.
 */
export const checkHostNull = api => {
	let checks = 0, rejections = 0;
	const check = (condition, message) => { checks++; if(!condition) throw new Error(message); };
	const equal = (actual, expected, message) => {
		check(JSON.stringify(actual) === JSON.stringify(expected), message);
	};
	const rejects = operation => {
		let rejected = false;
		try
		{ operation(); }
		catch
		{ rejected = true; }
		check(rejected, "Expected HostNull rejection"); rejections++;
	};

	check(api.echo(null) === null, "Null parameter/result");
	check(api.echo(0xffffffff) === 0xffffffff, "Non-null parameter/result");
	for(const value of [null, { tag: "none" }, { tag: "some", value: 42 }])
		equal(api.nullableOption(value), value, "HostNull Option branch");
	for(const value of [{ tag: "none" }, { tag: "some", value: null }, { tag: "some", value: 42 }])
		equal(api.optionalNullable(value), value, "Option HostNull branch");

	const packets = [
		{ direct: null, nullableOption: null, optionalNullable: { tag: "none" } }
		, { direct: 7, nullableOption: { tag: "none" }, optionalNullable: { tag: "some", value: null } }
		, { direct: 9, nullableOption: { tag: "some", value: 11 }, optionalNullable: { tag: "some", value: 13 } }
	];
	for(const packet of packets)
		equal(api.packet(packet), packet, "HostNull record fields");

	let calls = 0;
	check(api.callHost(null, value => { calls++; check(value === null, "Callback null parameter"); return { tag: "none" }; }).tag === "none", "Callback tagged result");
	check(api.callHost(42, value => { calls++; check(value === 42, "Callback value parameter"); return null; }) === null, "Callback null result");
	check(calls === 2, "Callback count");
	const closure = api.makeClosure({ tag: "some", value: 77 });
	equal(closure(null), { tag: "some", value: 77 }, "Closure null parameter");
	equal(closure(2), { tag: "some", value: 77 }, "Closure value parameter");
	check(closure.dispose(), "Closure disposal");
	check(!closure.dispose(), "Duplicate closure disposal");
	rejects(() => closure(null));

	for(const value of [undefined, { tag: "none" }, { value: 1 }]) rejects(() => api.echo(value));
	for(const value of [undefined, { tag: "some" }, { tag: "some", value: null }]) rejects(() => api.nullableOption(value));
	for(const value of [null, undefined, { tag: "some" }]) rejects(() => api.optionalNullable(value));
	for(const packet of [{ ...packets[0], direct: undefined }, { ...packets[0], nullableOption: undefined }, { ...packets[0], optionalNullable: null }])
		rejects(() => api.packet(packet));
	let invoked = 0;
	rejects(() => api.callHost(undefined, () => { invoked++; return null; }));
	check(invoked === 0, "Invalid callback input reached host");
	rejects(() => api.callHost(null, () => undefined));
	const invalidClosure = api.makeClosure(null);
	rejects(() => invalidClosure(undefined)); invalidClosure.dispose();
	let reads = 0;
	const accessor = Object.defineProperty({ ...packets[0] }, "direct", { get: () => { reads++; return null; } });
	rejects(() => api.packet(accessor)); check(reads === 0, "Accessor executed");

	return { checks, rejections, positions: 5, nestedOptionDistinct: true };
};
