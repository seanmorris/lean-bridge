/**
 * Compiler-free List checks shared by Node, browsers, React and browser workers.
 *
 * @file
 */

/**
 * Exercise the installed public API with independent expected sequences.
 *
 * @param api - Installed public package exports.
 */
export const checkLists = api => {
	let checks = 0, rejections = 0;
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
				|| Object.keys(actual).sort().join("|") !== Object.keys(expected).sort().join("|")) throw new Error("List shape mismatch");
			for(const key of Object.keys(expected)) equal(actual[key], expected[key]);
		}
		else if(!Object.is(actual, expected)) throw new Error(`List mismatch: ${String(actual)} / ${String(expected)}`);
	};
	const rejects = call => {
		rejections++;
		try
		{ call(); } catch
		{ return; }
		throw new Error("Expected List rejection");
	};
	const samples = {
		unit: [undefined], bool: [false, true], uint8: [0, 255]
		, uint16: [0, 65535], uint32: [0, 0xffffffff]
		, uint64: [0n, 0xffffffffffffffffn], int8: [-128, 127]
		, int16: [-32768, 32767], int32: [-0x80000000, 0x7fffffff]
		, int64: [-0x8000000000000000n, 0x7fffffffffffffffn]
		, nat: [0n, (1n << 4128n) + 7n], int: [-(1n << 4128n), 1n << 4128n]
		, float32: [-0, NaN, Infinity, -Infinity, Math.fround(1 / 3)]
		, float64: [-0, NaN, Infinity, -Infinity, 1 / 3]
		, string: ["", "\uFEFF🌱\0"]
		, bytes: [new Uint8Array(), new Uint8Array([255, 0, 7])]
		, char: ["\0", "🌱", "\u{10ffff}"], usize: [0, 0xffffffff]
		, isize: [-0x80000000, 0x7fffffff]
	};
	for(const [primitive, values] of Object.entries(samples))
	{
		const call = api[`reverse_${primitive}`];
		equal(call([]), []);
		for(const value of values) equal(call([value]), [value]);
		for(let round = 0; round < 32; round++)
		{
			const input = Array.from({ length: round }, (_, i) => values[i % values.length]);
			equal(call(input), input.toReversed());
		}
	}
	equal(api.join(["", "\0", "abc", "🌱"]), "🌱\0🌱abc🌱🌱");
	equal(api.mix([[1, 2, 3], [], [7, 8]]), [[8, 7], [], [3, 2, 1]]);
	const some = value => ({ tag: "some", value }), none = { tag: "none" };
	equal(api.nest(none), none); equal(api.nest(some([])), some([]));
	equal(api.nest(some([{ ok: [] }, { error: "x" }, { ok: [undefined, undefined] }])), some([{ ok: [undefined, undefined] }, { error: "x!" }, { ok: [] }]));
	equal(api.swap({ ok: [[1n, 2n], [3, 4, 5]] }), { error: [[2n, 1n], [5, 4, 3]] });
	equal(api.swap({ error: ["a", "b"] }), { ok: ["b", "a"] });
	const input = {
		sequences: [[1, 2], [], [3, 4, 5]]
		, branches: [none, some({ ok: [1n << 200n, undefined] }), some({ error: "bad" })]
		, buffers: [new Uint8Array([0, 255]), new Uint8Array([7])]
		, arrays: [[[true, "🌱"], [false, "a"]], []]
	};
	const expected = {
		sequences: [[5, 4, 3], [], [2, 1]]
		, branches: [some({ error: "bad!" }), some({ ok: [(1n << 200n) + 1n, undefined] }), none]
		, buffers: input.buffers.toReversed()
		, arrays: [[], [[false, "a"], [true, "🌱"]]]
	};
	for(let i = 0; i < 64; i++) equal(api.transform(input), expected);
	const copy = api.transform(input); copy.sequences[0][0] = 99; copy.buffers[1][0] = 99;
	equal(input.sequences[2][2], 5); equal(input.buffers[0][0], 0); equal(api.transform(input), expected);
	const bytes = new Uint8Array([0, 255]), duplicate = api.duplicate(bytes);
	equal(duplicate, [bytes, bytes]); duplicate[0][0] = 9; equal(duplicate[1][0], 0); equal(bytes[0], 0);
	let deep = [42];
	for(let level = 1; level < 24; level++) deep = [deep];
	equal(api.deep(deep), deep);
	let empty = [];
	for(let level = 0; level < 24; level++)
	{ equal(api.deep(empty), empty); empty = [empty]; }
	for(const value of [null, undefined, {}, new Uint32Array([1]), { 0: 1, length: 1 }, [null], [-1], [1n], [NaN], [0x100000000], new Array(3)])
		rejects(() => api.reverse_uint32(value));
	let reads = 0;
	const accessor = Object.defineProperty([1], 0, { get: () => { reads++; return 1; } });
	for(const value of [accessor, Object.assign([1], { extra: 1 }), Object.assign([1], { [Symbol("extra")]: 1 })]) rejects(() => api.reverse_uint32(value));
	equal(reads, 0);
	const cyclic = []; cyclic.push(cyclic); rejects(() => api.deep(cyclic));
	rejects(() => api.transform({ ...input, branches: [some({ ok: [1n, undefined], error: "bad" })] }));
	rejects(() => api.reverse_char(["ab"])); rejects(() => api.reverse_string(["\ud800"]));
	// Reject before allocating a huge wire buffer, then prove the session remains usable.
	rejects(() => api.reverse_unit(new Array(1048577)));
	equal(api.generate(0n), []); equal(api.generate(5n), [7, 7, 7, 7, 7]);
	const long = Array.from({ length: 16384 }, (_, i) => i);
	equal(api.reverse_uint32(long), long.toReversed());
	for(let i = 0; i < 3; i++)
	{
		rejects(() => api.generate(1048577n));
		rejects(() => api.duplicate(new Uint8Array(6 * 1024 * 1024)));
		equal(api.reverse_uint32([1, 2, 3]), [3, 2, 1]); equal(api.transform(input), expected);
	}
	return { checks, rejections, primitives: 19 };
};
