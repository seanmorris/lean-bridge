/**
 * Installed public alias values in Node, browsers, React and workers.
 *
 * @file
 */

/**
 * Assert transparent values, exact leaves, copied ownership and failure recovery.
 *
 * @param api - Installed generated exports.
 */
export const checkAliases = api => {
	let checks = 0, rejections = 0;
	const equal = (actual, expected) => {
		checks++;
		if(expected instanceof Uint8Array)
		{
			if(!(actual instanceof Uint8Array) || actual.length !== expected.length) throw new Error("Alias byte mismatch");
			for(let i = 0; i < expected.length; i++) equal(actual[i], expected[i]);
		}
		else if(expected && typeof expected === "object")
		{
			if(!actual || Array.isArray(actual) !== Array.isArray(expected) || Object.keys(actual).sort().join("|") !== Object.keys(expected).sort().join("|")) throw new Error("Alias shape mismatch");
			for(const key of Object.keys(expected)) equal(actual[key], expected[key]);
		}
		else if(!Object.is(actual, expected)) throw new Error(`Alias mismatch: ${String(actual)} / ${String(expected)}`);
	};
	const rejects = call => {
		rejections++;
		try
		{ call(); } catch
		{ equal(api.increment(41), 42); return; }
		throw new Error("Expected alias rejection");
	};
	const huge = (1n << 5120n) + 17n;
	const samples = {
		unit: [undefined], bool: [false, true], uint8: [0, 1, 255]
		, uint16: [0, 1, 65535], uint32: [0, 1, 0xffffffff]
		, uint64: [0n, (1n << 53n) + 1n, 0xffffffffffffffffn]
		, int8: [-128, -1, 0, 127], int16: [-32768, -1, 0, 32767]
		, int32: [-0x80000000, -1, 0, 0x7fffffff]
		, int64: [-0x8000000000000000n, -1n, 0n, 0x7fffffffffffffffn]
		, nat: [0n, huge], int: [-huge, 0n, huge]
		, float32: [-0, 0, Math.fround(1 / 3), 2 ** -149, 3.4028234663852886e38, NaN, Infinity, -Infinity]
		, float64: [-0, 0, 1 / 3, Number.MIN_VALUE, Number.MAX_VALUE, NaN, Infinity, -Infinity]
		, string: ["", "🌱\0λ", "\uFEFFe\u0301", "\u{10ffff}"]
		, bytes: [new Uint8Array(), Uint8Array.from({ length: 256 }, (_, i) => i)]
		, char: ["\0", "\uD7FF", "\uE000", "🌱", "\u{10ffff}"]
		, usize: [0, 0xffffffff], isize: [-0x80000000, 0x7fffffff]
	};
	for(const [primitive, values] of Object.entries(samples))
		for(const value of values) equal(api[`echo_${primitive}`](value), value);
	const scalarFields = Object.fromEntries(Object.entries(samples).map(([name, values]) => [`v_${name}`, values[0]]));
	for(const [name, values] of Object.entries(samples))
		for(const value of values)
		{
			const input = { ...scalarFields, [`v_${name}`]: value };
			equal(api.scalars(input), input);
		}
	const inspected = {
		v_unit: undefined, v_bool: true, v_uint8: 255, v_uint16: 65535
		, v_uint32: 0xffffffff, v_uint64: 0xffffffffffffffffn
		, v_int8: -128, v_int16: -32768, v_int32: -0x80000000
		, v_int64: -0x8000000000000000n, v_nat: (1n << 5120n) + 19n
		, v_int: -((1n << 5120n) + 31n), v_float32: 1.5, v_float64: -2.25
		, v_string: "A\0🌱", v_bytes: new Uint8Array([0, 255, 1])
		, v_char: "🌱", v_usize: 0xffffffff, v_isize: -0x80000000
	};
	equal(api.inspect(inspected), true);
	for(const [name, values] of Object.entries(samples))
		if(name !== "unit") equal(api.inspect({ ...inspected, [`v_${name}`]: values.find(value => !Object.is(value, inspected[`v_${name}`])) }), false);
	const scalarCopy = api.scalars(inspected); scalarCopy.v_bytes[0] = 8;
	equal(inspected.v_bytes[0], 0);
	equal(api.make(), 41); equal(api.label(), "alias🌱"); equal(api.increment(0xffffffff), 0);
	const none = { tag: "none" }, some = value => ({ tag: "some", value });
	const packet = { count: 41, text: "key\0🌱", rows: [[1, 2, 3], [], [0xffffffff]], maybe: some(some(undefined)), outcome: { ok: [7, new Uint8Array([0, 255])] } };
	for(const maybe of [none, some(none), some(some(undefined))])
	{
		equal(api.maybe(maybe), maybe);
		for(const outcome of [{ error: "bad\0" }, { ok: [0xffffffff, new Uint8Array([7, 255])] }])
		{
			const input = { ...packet, maybe, outcome };
			equal(api.packet(input), { ...input, count: 42 }); equal(api.outcome(outcome), outcome);
		}
	}
	equal(api.packets([]), []); equal(api.packets([packet, { ...packet, count: 0 }]), [{ ...packet, count: 0 }, packet]);
	equal(api.rows(packet.rows), [[3, 2, 1], [], [0xffffffff]]);
	equal(api.mode({ kind: "first" }), { kind: "second", count: 42 }); equal(api.mode({ kind: "second", count: 41 }), { kind: "second", count: 42 });
	const output = api.packet(packet); output.rows[0][0] = 9; output.outcome.ok[1][0] = 8;
	equal(packet.rows[0][0], 1); equal(packet.outcome.ok[1][0], 0);
	const bytes = new Uint8Array([1, 2]), copy = api.echo_bytes(bytes); copy[0] = 9; equal(bytes[0], 1);
	equal(api.duplicate(bytes), { ok: [7, new Uint8Array([1, 2, 1, 2])] });
	for(let i = 0; i < 64; i++) equal(api.packet(packet), { ...packet, count: 42 });
	for(const value of [null, 0, "", false]) rejects(() => api.echo_unit(value));
	for(const [name, value] of Object.entries({ v_unit: null, v_bool: 1, v_uint64: 1, v_nat: -1n, v_char: "\uD800", v_bytes: [] }))
		rejects(() => api.scalars({ ...inspected, [name]: value }));
	for(const value of [-1, 2 ** 32, 1.5, 1n, "1", NaN]) rejects(() => api.increment(value));
	for(const value of [-1n, 1, "1"]) rejects(() => api.echo_nat(value));
	for(const value of ["", "ab", "\uD800", 0]) rejects(() => api.echo_char(value));
	for(const value of [null, [], {}, { tag: "some" }, some({ tag: "some" }), some(null)]) rejects(() => api.maybe(value));
	let reads = 0;
	for(const input of [{ ...packet, extra: 0 }, Object.create(packet)
		, { ...packet, [Symbol("extra")]: 0 }
		, Object.defineProperty({ ...packet }, "count", { get: () => { reads++; return 41; } })]) rejects(() => api.packet(input));
	equal(reads, 0);
	for(const value of [{ kind: "unknown" }, { kind: "second" }, { kind: "first", count: 0 }, { kind: "second", count: -1 }]) rejects(() => api.mode(value));
	const sparse = [1, 2, 3]; delete sparse[1]; rejects(() => api.rows([sparse]));
	const large = new Uint8Array(6 * 1024 * 1024);
	for(let i = 0; i < 3; i++)
	{ rejects(() => api.duplicate(large)); rejects(() => api.produce(16n * 1024n * 1024n)); }
	return { checks, rejections, primitives: Object.keys(samples).length };
};
