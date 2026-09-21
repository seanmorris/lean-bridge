/**
 * Compiler-free variant checks for Node, browsers, React and workers.
 *
 * @file
 */

/**
 * Call the installed public package and compare against independent values.
 *
 * @param api - Installed exports.
 */
export const checkVariants = api => {
	let checks = 0, rejections = 0;
	const equal = (actual, expected) => {
		checks++;
		if(expected instanceof Uint8Array)
		{
			if(!(actual instanceof Uint8Array) || actual.length !== expected.length) throw new Error("Variant byte copy mismatch");
			for(let i = 0; i < expected.length; i++) equal(actual[i], expected[i]);
		}
		else if(expected && typeof expected === "object")
		{
			if(!actual || Array.isArray(actual) !== Array.isArray(expected)
				|| Object.keys(actual).sort().join("|") !== Object.keys(expected).sort().join("|")) throw new Error("Variant shape mismatch");
			for(const key of Object.keys(expected)) equal(actual[key], expected[key]);
		}
		else if(!Object.is(actual, expected)) throw new Error(`Variant mismatch: ${String(actual)} / ${String(expected)}`);
	};
	const rejects = call => {
		rejections++;
		try
		{ call(); } catch
		{ equal(api.code({ kind: "idle" }), 7); return; }
		throw new Error("Expected variant rejection");
	};
	const values = [{ kind: "idle" }, { kind: "stopped" }, { kind: "data", count: 42, label: "🌱\0" }, { kind: "marker", value: undefined }];
	for(const [index, value] of values.entries())
	{
		equal(api.echo(value), value); equal(api.code(value), [7, 13, 47, 29][index]);
	}
	equal(api.next(values[0]), values[1]); equal(api.next(values[1]), values[3]);
	equal(api.next(values[3]), { kind: "data", count: 42, label: "ready" });
	equal(api.next(values[2]), { kind: "data", count: 43, label: "🌱\0!" });
	equal(api.make(0), values[0]); equal(api.make(17), { kind: "data", count: 17, label: "made" });
	for(const kind of ["first", "second", "third"]) equal(api.mode({ kind }), { kind });
	for(const value of [{ kind: "number", arg0: 7 }, { kind: "pair", arg0: 9, arg1: "🌱" }, { kind: "collision", arg1: 11, arg1_: "text" }]) equal(api.anonymous(value), value);
	equal(api.one({ kind: "only", value: 41 }), { kind: "only", value: 42 });
	const packet = { current: values[2], events: values, fallback: { tag: "some", value: values[3] }, modes: [{ kind: "second" }] };
	for(const current of values)
	{
		const input = { kind: "packet", value: { ...packet, current } };
		equal(api.nested(input), input);
	}
	for(const value of [{ kind: "empty" }, { kind: "packet", value: packet }
		, { kind: "outcome", value: { ok: [values[2], { kind: "third" }] } }
		, { kind: "outcome", value: { error: "bad\0🌱" } }])
		for(let i = 0; i < 32; i++) equal(api.nested(value), value);
	equal(api.signals([values, [], [values[3]]]), [values.toReversed(), [], [values[3]]]);
	const big = 1n << 5120n;
	const all = {
		kind: "all", unit: undefined, bool: true, u8: 255, u16: 65535
		, u32: 0xffffffff, u64: 0xffffffffffffffffn, i8: -128, i16: -32768
		, i32: -0x80000000, i64: -0x8000000000000000n
		, natural: big + 19n, integer: -(big + 31n)
		, f32: 1.5, f64: -2.25, text: "A\0🌱", bytes: new Uint8Array([0, 255, 1])
		, char: "🌱", word: 0xffffffff, signedWord: -0x80000000
	};
	equal(api.inspect(all), true); equal(api.inspect({ ...all, char: "x" }), false); equal(api.inspect({ kind: "absent" }), false);
	equal(api.scalars({ kind: "absent" }), { kind: "absent" }); equal(api.scalars(all), all);
	for(const [field, samples] of Object.entries({
		unit: [undefined], bool: [false], u8: [0], u16: [0], u32: [0], u64: [0n]
		, i8: [127], i16: [32767], i32: [0x7fffffff], i64: [0x7fffffffffffffffn]
		, natural: [0n], integer: [0n, big]
		, f32: [-0, NaN, Infinity, -Infinity, Math.fround(1 / 3)]
		, f64: [-0, NaN, Infinity, -Infinity, 1 / 3]
		, text: ["", "\uFEFF🌱\0"], bytes: [new Uint8Array()]
		, char: ["\0", "\u{10ffff}"], word: [0], signedWord: [0x7fffffff]
	}))
		for(const value of samples)
		{ const input = { ...all, [field]: value }; equal(api.scalars(input), input); }
	const result = api.duplicate(all.bytes); equal(result, { kind: "pair", first: all.bytes, second: all.bytes });
	result.first[0] = 77; equal(result.second[0], 0); equal(all.bytes[0], 0);
	const copy = api.nested({ kind: "packet", value: packet }); copy.value.events[2].count = 99;
	equal(packet.events[2].count, 42); equal(api.echo(values[2]).count, 42);
	for(const value of [null, undefined, [], "idle", {}, { kind: "unknown" }
		, { kind: "idle", value: undefined }, { kind: "marker" }
		, { kind: "data", count: -1, label: "x" }
		, { kind: "data", count: 1n, label: "x" }
		, { kind: "data", count: 1, label: "\ud800" }, Object.create({ kind: "idle" })
		, Object.assign({ kind: "idle" }, { [Symbol("extra")]: 1 })]) rejects(() => api.echo(value));
	let reads = 0;
	for(const value of [Object.defineProperty({}, "kind", { get: () => { reads++; return "idle"; } })
		, Object.defineProperty({ kind: "marker" }, "value", { get: () => { reads++; return undefined; } })]) rejects(() => api.echo(value));
	equal(reads, 0);
	for(const [field, value] of Object.entries({
		unit: null, bool: 1, u8: 256, u16: 65536, u32: 0x100000000
		, u64: 1, i8: -129, i16: -32769, i32: -0x80000001, i64: 1
		, natural: -1n, integer: 1, f32: "1", f64: "1", text: "\ud800"
		, bytes: [1], char: "ab", word: 0x100000000, signedWord: 0x80000000
	})) rejects(() => api.scalars({ ...all, [field]: value }));
	const nullPrototype = Object.assign(Object.create(null), values[0]); equal(api.echo(nullPrototype), values[0]);
	equal(api.produce(3n), { kind: "pair", first: new Uint8Array([17, 17, 17]), second: new Uint8Array([1]) });
	// Repeated failure after a copied output field has already been allocated.
	for(let i = 0; i < 3; i++) rejects(() => api.duplicate(new Uint8Array(6 * 1024 * 1024)));
	rejects(() => api.produce(16n * 1024n * 1024n));
	equal(api.echo(values[3]), values[3]);
	return { checks, rejections, primitives: 19 };
};
