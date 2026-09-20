/**
 * Compiler-free checks of installed copied records and their independent values.
 *
 * @file
 */
/**
 * Exercise generated public functions only, without reaching into the runtime.
 *
 * @param api - Installed Records package namespace.
 */
export const checkRecords = api => {
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
				|| Object.keys(actual).sort().join("|") !== Object.keys(expected).sort().join("|")) throw new Error("Record shape mismatch");
			for(const key of Object.keys(expected)) equal(actual[key], expected[key]);
		}
		else if(!Object.is(actual, expected)) throw new Error(`Record mismatch: ${String(actual)} / ${String(expected)}`);
	};
	const rejects = call => { checks++; try
	{ call(); } catch
	{ return; } throw new Error("Expected record rejection"); };
	const p = {
		unit: undefined, flag: true, u8: 255, u16: 65535, u32: 0xffffffff
		, u64: 0xffffffffffffffffn
		, i8: -128, i16: -32768, i32: -0x80000000, i64: -0x8000000000000000n
		, natural: 1n << 200n, integer: -(1n << 200n), f32: -0, f64: 3.25
		, text: "🌱\0", bytes: new Uint8Array([255, 0, 7]), char: "🌱"
		, usize: 0xffffffff, isize: -0x80000000
	};
	const input = {
		label: "packet", values: [[p], []], empty: {}
		, single: { value: 0xffffffffffffffffn }, count: { value: 1n << 200n }
		, pair: { first: 4, second: "left" }
		, reversed: { second: "right", first: 9 }
	};
	const expected = {
		...input, label: "packet!", values: [[], [p]], single: { value: 0n }
		, count: { value: (1n << 200n) + 7n }
		, pair: { first: 5, second: "leftp" }
		, reversed: { second: "rightr", first: 11 }
	};
	equal(api.inspect(p), true); equal(api.inspect({ ...p, flag: false }), false);
	equal(api.shuffle(input), expected);
	equal(api.empty({}), {}); equal(api.single({ value: 0n }), { value: 1n }); equal(api.count({ value: 0n }), { value: 1n });
	equal(api.make(), { first: 42, second: "\uFEFF🌱\0" });
	const variants = [
		p
		, { ...p, f32: NaN, f64: -0, char: "\0", text: "\uFEFF", bytes: new Uint8Array() }
		, { ...p, f32: Infinity, f64: -Infinity, char: "\u{10ffff}", natural: 0n, integer: 0n }
		, { ...p, f32: Math.fround(1 / 3), f64: 1 / 3, u8: 0, u16: 0, u32: 0, u64: 0n, usize: 0, isize: 0 }];
	equal(api.reverse(variants), variants.toReversed()); equal(api.reverse([]), []);
	const copies = api.duplicate(input);
	if(copies[0] === copies[1] || copies[0].values === copies[1].values || copies[0].values[0][0] === p) throw new Error("Records must be independent copies");
	copies[0].values[0][0].bytes[0] = 1;
	equal(copies[1], input); equal(p.bytes[0], 255);
	for(const bad of [null, [], 1, {}, { ...p, extra: true }, { ...p, natural: -1n }, { ...p, char: "ab" }, { ...p, u64: 0 }, { ...p, unit: null }]) rejects(() => api.inspect(bad));
	rejects(() => api.empty({ ignored: 1 })); rejects(() => api.inspect(Object.create(p)));
	let reads = 0;
	const getter = { ...p }; Object.defineProperty(getter, "u8", { get: () => { reads++; return 255; } });
	rejects(() => api.inspect(getter)); equal(reads, 0);
	const symbol = { ...p, [Symbol("hidden")]: 0 }; rejects(() => api.inspect(symbol));
	const hidden = Object.defineProperty({ ...p }, "hidden", { value: 0 }); rejects(() => api.inspect(hidden));
	const cycle = { ...input }; cycle.values = [[cycle]]; rejects(() => api.shuffle(cycle));
	equal(api.inspect(Object.assign(Object.create(null), p)), true);
	const large = { ...input, values: [[{ ...p, bytes: new Uint8Array(6 * 1024 * 1024) }]] };
	for(let i = 0; i < 4; i++)
	{ rejects(() => api.duplicate(large)); equal(api.shuffle(input), expected); }
	for(let i = 0; i < 100; i++) equal(api.shuffle(input), expected);
	return { records: 7, primitives: 19, checks };
};
