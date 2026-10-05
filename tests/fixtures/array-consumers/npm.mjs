/**
 * Checks imported functions without compiler, runtime internals or source files.
 *
 * @file
 */
/**
 * Execute installed copies and assert independent host results.
 *
 * @param api - Generated public package exports.
 */
export const checkArrays = api => {
	let checks = 0;
	const equal = (actual, expected) => {
		checks++;
		if(Array.isArray(expected) || expected instanceof Uint8Array)
		{
			if(actual.length !== expected.length || (expected instanceof Uint8Array && !(actual instanceof Uint8Array))) throw new Error("Array representation or length mismatch");
			for(let i = 0; i < expected.length; i++) equal(actual[i], expected[i]);
		}
		else if(!Object.is(actual, expected)) throw new Error(`Array element mismatch: ${String(actual)} / ${String(expected)}`);
	};
	const rejects = call => { checks++; try
	{ call(); } catch
	{ return; } throw new Error("Expected array rejection"); };
	const values = {
		Unit: [undefined, undefined], Bool: [true, false]
		, UInt8: [0, 255]
		, UInt16: [0, 65535]
		, UInt32: [0, 0xffffffff]
		, UInt64: [0n, 0xffffffffffffffffn]
		, Int8: [-128, -1, 127]
		, Int16: [-32768, -1, 32767]
		, Int32: [-0x80000000, -1, 0x7fffffff]
		, Int64: [-0x8000000000000000n, -1n, 0x7fffffffffffffffn]
		, Nat: [0n, 1n, 1n << 200n], Int: [-(1n << 255n), -1n, 0n, 1n << 200n]
		, Float32: [-0, 0, NaN, Infinity, -Infinity, Math.fround(1 / 3)]
		, Float64: [-0, 0, NaN, Infinity, -Infinity, 1 / 3]
		, String: ["", "\0", "\uFEFF🌱", "a\0z", "é"]
		, Bytes: [new Uint8Array(), new Uint8Array([0, 255, 42])]
		, Char: ["\0", "\uFEFF", "🌱", "\u{10ffff}"]
		, USize: [0, 0xffffffff], ISize: [-0x80000000, -1, 0x7fffffff]
	};
	for(const [name, row] of Object.entries(values))
	{
		const input = [[], row, row.slice(0, 1)], expected = input.toReversed().map(row => row.toReversed());
		const result = api[`reverse${name}`](input);
		equal(result, expected);
		if(result === input || result[1] === row) throw new Error("Copied arrays must be independent");
		equal(api[`reverse${name}`]([]), []);
		equal(api[`reverse${name}`]([[]]), [[]]);
	}
	equal(api.add(-(1n << 130n), [[1n, -2n], []]), [[-(1n << 130n) + 1n, -(1n << 130n) - 2n], []]);
	equal(api.total([[1n << 200n], [], [3n, 5n]]), (1n << 200n) + 8n);
	equal(api.words(), [["\uFEFFLean", "🌱\0"], []]);
	equal(api.size([undefined, undefined, undefined]), 3);
	const interpreted = [
		[undefined], [true], [255], [65535], [0xffffffff]
		, [0xffffffffffffffffn]
		, [-128], [-32768], [-0x80000000], [-0x8000000000000000n]
		, [1n << 200n], [-(1n << 200n)], [-0], [3.25], ["🌱\0"]
		, [new Uint8Array([255, 0, 7])], ["🌱"], [0xffffffff], [-0x80000000]
	];
	equal(api.checkElements(...interpreted), true);
	interpreted[1] = [false];
	equal(api.checkElements(...interpreted), false);
	const bytes = new Uint8Array([1, 2]), duplicated = api.duplicate([bytes]);
	bytes[0] = 8; duplicated[0][1] = 9;
	equal(duplicated[1], new Uint8Array([1, 2]));
	for(const bad of [null, {}, new Uint32Array([1]), [1], [[-1]], [[0x100000000]], [[1n]], [["1"]], [new Array(1)]]) rejects(() => api.reverseUInt32(bad));
	rejects(() => api.reverseString([["\ud800"]]));
	rejects(() => api.reverseChar([["ab"]]));
	rejects(() => api.reverseISize([[0x80000000]]));
	const cycle = []; cycle.push(cycle); rejects(() => api.reverseUInt32(cycle));
	const extra = [[1]]; extra.other = true; rejects(() => api.reverseUInt32(extra));
	const accessor = []; Object.defineProperty(accessor, 0, { get: () => 1, enumerable: true });
	rejects(() => api.reverseUInt32([accessor]));
	// Input fits, but the duplicated result exceeds the cumulative 16 MiB call
	// allowance after allocating its first child. The next call must still work.
	const large = new Uint8Array(6 * 1024 * 1024);
	for(let i = 0; i < 4; i++)
	{ rejects(() => api.duplicate([large])); equal(api.duplicate([bytes]), [bytes, bytes]); }
	for(let i = 0; i < 200; i++) equal(api.reverseNat([[BigInt(i), 1n << 130n], []]), [[], [1n << 130n, BigInt(i)]]);
	return { primitives: 19, checks };
};
