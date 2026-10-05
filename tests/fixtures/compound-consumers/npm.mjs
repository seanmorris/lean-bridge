/**
 * Independent compiler-free values for installed Option, Except and products.
 *
 * @file
 */
/**
 * Check a release selecting no nominal records.
 *
 * @param api - Installed public exports.
 */
export const checkRecordless = api => {
	const some = value => ({ tag: "some", value }), none = { tag: "none" };
	for(const [i, value] of [none, some(none), some(some(undefined))].entries())
		if(api.classify(api.next(value)) !== (i + 1) % 3) throw new Error("Recordless Option mismatch");
	return { checks: 3 };
};

/**
 * Exercise only the installed public API, never private pointers or layouts.
 *
 * @param api - Installed public exports.
 */
export const checkCompounds = api => {
	let checks = 0;
	const equal = (actual, expected) => {
		checks++;
		if(expected instanceof Uint8Array)
		{
			if(!(actual instanceof Uint8Array) || actual.length !== expected.length) throw new Error("Byte copy mismatch");
			for(let i = 0; i < expected.length; i++) equal(actual[i], expected[i]);
		}
		else if(expected && typeof expected === "object")
		{
			if(!actual || Array.isArray(actual) !== Array.isArray(expected)
				|| Object.keys(actual).sort().join("|") !== Object.keys(expected).sort().join("|")) throw new Error("Compound shape mismatch");
			for(const key of Object.keys(expected)) equal(actual[key], expected[key]);
		}
		else if(!Object.is(actual, expected)) throw new Error(`Compound mismatch: ${String(actual)} / ${String(expected)}`);
	};
	const rejects = call => { checks++; try
	{ call(); } catch
	{ return; } throw new Error("Expected compound rejection"); };
	const some = value => ({ tag: "some", value }), none = { tag: "none" };
	const samples = {
		unit: [undefined], bool: [false, true], uint8: [0, 255]
		, uint16: [0, 65535], uint32: [0, 0xffffffff]
		, uint64: [0n, 0xffffffffffffffffn], int8: [-128, 127]
		, int16: [-32768, 32767], int32: [-0x80000000, 0x7fffffff]
		, int64: [-0x8000000000000000n, 0x7fffffffffffffffn]
		, nat: [0n, 1n << 200n], int: [-(1n << 200n), 1n << 200n]
		, float32: [-0, NaN, Infinity, -Infinity, Math.fround(1 / 3)]
		, float64: [-0, NaN, Infinity, -Infinity, 1 / 3]
		, string: ["", "\uFEFF🌱\0"]
		, bytes: [new Uint8Array(), new Uint8Array([255, 0, 7])]
		, char: ["\0", "🌱", "\u{10ffff}"], usize: [0, 0xffffffff]
		, isize: [-0x80000000, 0x7fffffff]
	};
	for(const [primitive, values] of Object.entries(samples))
	{
		equal(api[`option_${primitive}`](none), none);
		for(const [i, value] of values.entries())
		{
			equal(api[`option_${primitive}`](some(value)), some(value));
			equal(api[`result_${primitive}`]({ ok: value }), { error: value });
			equal(api[`result_${primitive}`]({ error: value }), { ok: value });
			const other = values[(i + 1) % values.length];
			equal(api[`tuple_${primitive}`]([value, other]), [other, value]);
		}
	}
	for(const [i, value] of [none, some(none), some(some(undefined))].entries())
	{
		equal(api.classify(value), i);
		equal(api.next(value), [some(none), some(some(undefined)), none][i]);
	}
	equal(api.flip({ ok: [42, some(undefined)] }), { error: [42, some(undefined)] });
	equal(api.flip({ error: some("bad") }), { ok: some("bad") });
	equal(api.flip({ error: none }), { ok: none });
	equal(api.make(), some({ ok: [0xffffffffffffffffn, undefined] }));
	const input = {
		choice: some({ ok: [1n << 200n, undefined] })
		, products: [[0xffffffff, "🌱\0"], [true, "🌱"]]
		, rows: [none, some({ ok: ["ok", 0xffffffffffffffffn] }), some({ error: [new Uint8Array([0, 255]), -(1n << 200n)] })]
		, nested: { ok: some({ error: "inside" }) }
	};
	const expected = { ...input, choice: some({ ok: [(1n << 200n) + 1n, undefined] }), products: [[0, "🌱\0!"], [false, "🌱"]], rows: input.rows.toReversed() };
	equal(api.transform(input), expected);
	for(const choice of [none, some({ error: "e" })])
		for(const nested of [{ error: none }, { error: some(42n) }, { ok: none }, { ok: some({ ok: [7, undefined] }) }])
			equal(api.transform({ ...input, choice, rows: [], nested }), { ...expected, choice: choice.tag === "none" ? none : some({ error: "e!" }), rows: [], nested });
	const copy = api.transform(input);
	copy.rows[0].value.error[0][0] = 99; equal(input.rows[2].value.error[0][0], 0);
	for(const value of [{ ok: [0xffffffff, undefined] }, { error: "deep" }])
	{
		let nested = value;
		for(let level = 0; level < 24; level++) nested = some(nested);
		equal(api.deep(nested), nested);
	}
	let stopped = none;
	for(let level = 0; level < 24; level++)
	{ equal(api.deep(stopped), stopped); stopped = some(stopped); }
	for(const value of [null, undefined, {}, { tag: "unknown" }, { tag: "none", value: undefined }, { tag: "some" }, some(null), Object.create(some(undefined))]) rejects(() => api.option_unit(value));
	for(const value of [null, {}, { ok: undefined, error: undefined }, { ok: null }, { error: null }, Object.create({ ok: undefined })]) rejects(() => api.result_unit(value));
	for(const value of [[], [undefined], [undefined, undefined, undefined], new Array(2), { 0: undefined, 1: undefined, length: 2 }]) rejects(() => api.tuple_unit(value));
	let reads = 0;
	const getter = () => { reads++; return undefined; };
	for(const value of [Object.defineProperty({}, "tag", { get: getter }), Object.defineProperty({ tag: "some" }, "value", { get: getter })]) rejects(() => api.option_unit(value));
	rejects(() => api.result_unit(Object.defineProperty({}, "ok", { get: getter })));
	rejects(() => api.tuple_unit(Object.defineProperty([undefined, undefined], 0, { get: getter }))); equal(reads, 0);
	for(const value of [some(undefined), { ok: undefined }])
	{
		const call = value.tag ? api.option_unit : api.result_unit;
		rejects(() => call({ ...value, [Symbol("extra")]: 1 }));
		rejects(() => call(Object.defineProperty({ ...value }, "extra", { value: 1 })));
		equal(call(Object.assign(Object.create(null), value)), value.tag ? value : { error: undefined });
	}
	const cycle = some(null); cycle.value = cycle; rejects(() => api.deep(cycle));
	const bytes = new Uint8Array([0, 255]), duplicated = api.duplicate(some(bytes));
	equal(duplicated, { ok: some([bytes, bytes]) }); duplicated.ok.value[0][0] = 9; equal(duplicated.ok.value[1][0], 0); equal(bytes[0], 0);
	const large = some(new Uint8Array(6 * 1024 * 1024));
	for(let i = 0; i < 4; i++)
	{ rejects(() => api.duplicate(large)); equal(api.duplicate(none), { error: "empty" }); equal(api.transform(input), expected); }
	for(let i = 0; i < 100; i++) equal(api.transform(input), expected);
	return { checks, primitives: 19, constructors: 3 };
};
