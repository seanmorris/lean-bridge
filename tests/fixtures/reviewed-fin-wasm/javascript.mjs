/**
 * Fin-only checks shared by installed Node, browser, React and worker consumers.
 *
 * @file
 */

/**
 * Check public and raw runtime boundaries without supplying a host-side validator.
 *
 * @param request - Package name and scalar or structural selection.
 * @param api - Installed exports plus the package-internal raw call entry.
 */
export const executeCorpus = (request, api) => {
	if(!["scalar", "structural"].includes(request.selection)) throw new Error("Unknown Fin selection");
	let checks = 0, rejections = 0;
	const check = (ok, label) => { if(!ok) throw new Error(`failed: ${label}`); checks++; };
	const encode = value => JSON.stringify(value, (_, item) => typeof item === "bigint" ? `${item}n` : item);
	const same = (left, right) => encode(left) === encode(right);
	const rejected = (call, label, expected = undefined) => {
		try
		{ call(); }
		catch(error)
		{
			if(expected && !expected.test(error.message)) throw new Error(`wrong rejection: ${label}: ${error.message}`, { cause: error });
			rejections++; return;
		}
		throw new Error(`accepted: ${label}`);
	};
	const wide = 184467440737095516170n;
	const cases = [
		["mirror", [[0n, 9n], [3n, 6n], [9n, 0n]], [10n, 11n, -1n, 2n ** 128n]]
		, ["never", [], [0n, 1n]]
		, ["only", [[0n, 7n]], [1n, 2n]]
		, ["huge", [[0n, 0n], [wide - 1n, wide - 1n]], [wide, wide + 1n, 2n ** 128n]]];
	for(const [name, valid, invalid] of cases)
	{
		for(const [input, expected] of valid)
			check(api[name](input) === expected && api.raw(name, [input]) === expected, `${name} endpoints`);
		for(const input of invalid)
		{
			rejected(() => api[name](input), `${name} public bound`);
			rejected(() => api.raw(name, [input]), `${name} raw bound`, input >= 0n ? /failed \(5\)/u : undefined);
			check(api.mirror(3n) === 6n && api.raw("mirror", [9n]) === 0n, `${name} recovery`);
		}
		for(const input of [3, "3", null, undefined, true])
		{
			rejected(() => api[name](input), `${name} public type`);
			rejected(() => api.raw(name, [input]), `${name} raw type`);
		}
	}
	check(api.tenth(123n) === 3n && api.raw("tenth", [2n ** 128n]) === 6n, "result-only bound");
	const prefix = "λ🙂".repeat(1024), suffix = "\u0000end";
	for(let round = 0; round < 32; round++)
	{
		rejected(() => api.label(prefix, 10n, suffix), "label public late bound");
		rejected(() => api.raw("label", [prefix, 10n, suffix]), "label raw late bound", /failed \(5\)/u);
		check(api.label(prefix, 9n, suffix) === prefix + "9" + suffix
			&& api.raw("label", [prefix, 0n, suffix]) === prefix + "0" + suffix, "label heap recovery");
	}
	if(request.selection === "structural")
	{
		const none = { tag: "none" }, some = value => ({ tag: "some", value });
		const values = [none, some([2n, { ok: 4n }]), some([0n, { error: 1n }])];
		const inputs = [
			["rows", [[0n, 9n], []], [[], [0n, 9n]], [[[10n]], [[0n, 10n, 9n]], [[0n, 9n, 10n]], [[0n], [10n]]]]
			, ["empty", [], [], [[0n], [1n]]]
			, ["nested", values, [...values].reverse()
				, [[some([3n, { ok: 4n }])], [some([2n, { ok: 5n }])], [some([0n, { error: 2n }])]]]];
		for(const [name, input, expected, invalid] of inputs)
		{
			const before = encode(input);
			check(same(api[name](input), expected) && same(api.raw(name, [input]), expected), `${name} valid`);
			for(let round = 0; round < 8; round++) for(const bad of invalid)
			{
				const badBefore = encode(bad);
				rejected(() => api[name](bad), `${name} public bound`);
				rejected(() => api.raw(name, [bad]), `${name} raw bound`, /failed \(5\)/u);
				check(same(api[name](input), expected) && same(api.raw(name, [input]), expected), `${name} recovery`);
				check(encode(bad) === badBefore, `${name} rejected input unchanged`);
			}
			check(encode(input) === before, `${name} caller input unchanged`);
		}
	}
	return { module: request.module, selection: request.selection, checks, rejections };
};
