/**
 * Compiler-free checks of installed recursive APIs in each JavaScript context.
 *
 * @file
 */

/**
 * Compare installed public values with independently constructed expectations.
 *
 * @param api - Installed generated exports.
 */
export const checkRecursive = api => {
	let checks = 0, rejections = 0;
	const equal = (actual, expected) => {
		const stack = [[actual, expected]];
		while(stack.length)
		{
			const [a, b] = stack.pop(); checks++;
			if(b instanceof Uint8Array)
			{
				if(!(a instanceof Uint8Array) || a.length !== b.length) throw new Error("Recursive bytes mismatch");
				for(let index = 0; index < b.length; index++) stack.push([a[index], b[index]]);
			}
			else if(b && typeof b === "object")
			{
				if(!a || typeof a !== "object" || Array.isArray(a) !== Array.isArray(b)
					|| Object.keys(a).sort().join("|") !== Object.keys(b).sort().join("|")) throw new Error("Recursive shape mismatch");
				for(const key of Object.keys(b)) stack.push([a[key], b[key]]);
			}
			else if(!Object.is(a, b)) throw new Error(`Recursive value mismatch: ${String(a)} / ${String(b)}`);
		}
	};
	const empty = { kind: "branch", children: [] };
	const rejects = (action, message) => {
		rejections++;
		try
		{ action(); }
		catch(error)
		{
			if(message && !message.test(error.message)) throw error;
			equal(api.empty(), empty); return;
		}
		throw new Error("Expected recursive input/result rejection");
	};
	const scalars = {
		unit: undefined, bool: true, u8: 255, u16: 65535, u32: 0xffffffff
		, u64: (1n << 64n) - 1n, i8: -128, i16: -32768
		, i32: -2147483648, i64: -(1n << 63n)
		, natural: (1n << 128n) + 1n, integer: -((1n << 128n) + 1n)
		, f32: 1.5, f64: -2.25, text: "A\0🌱"
		, bytes: new Uint8Array([0, 255, 1]), char: "🌱"
		, word: 0xffffffff, signedWord: -2147483648
	};
	equal(api.inspect(scalars), true);
	equal(api.inspect({ ...scalars, u64: 0n }), false);
	const leaf = { kind: "leaf", payload: scalars };
	const tree = { kind: "branch", children: [leaf, { kind: "branch", children: [leaf, empty] }] };
	for(const value of [empty, leaf, tree])
	{
		equal(api.tree(value), value); equal(api.forest([value, empty]), [value, empty]);
		equal(api.joinTrees(value, value), { kind: "branch", children: [value, value] });
	}
	const copy = api.tree(tree);
	copy.children[0].payload.bytes[0] = 17;
	equal(scalars.bytes[0], 0); equal(copy.children[1].children[0].payload.bytes[0], 0);
	const left = { kind: "next", right: { kind: "many", lefts: [{ kind: "leaf", value: 42 }] } };
	equal(api.left(left), left); equal(api.right(left.right), left.right);
	equal(api.right({ kind: "many", lefts: [] }), { kind: "many", lefts: [] });
	for(const fallback of [{ tag: "none" }, { tag: "some", value: leaf }])
		for(const marker of [{ tag: "none" }, { tag: "some", value: { tag: "none" } }, { tag: "some", value: { tag: "some", value: undefined } }])
			for(const outcome of [{ ok: [leaf, empty] }, { error: "\uFEFF🌱\0" }])
			{
				const envelope = { tree: leaf, alternatives: [[tree], []], fallback, marker, outcome };
				equal(api.envelope(envelope), envelope);
			}
	for(const [field, values] of Object.entries({
		unit: [undefined], bool: [false], u8: [0], u16: [0], u32: [0], u64: [0n]
		, i8: [127], i16: [32767], i32: [2147483647], i64: [(1n << 63n) - 1n]
		, natural: [0n, (1n << 5120n) + 19n], integer: [0n, (1n << 5120n) + 31n]
		, f32: [-0, NaN, Infinity, -Infinity, Math.fround(1 / 3)]
		, f64: [-0, NaN, Infinity, -Infinity, 1 / 3]
		, text: ["", "\uFEFF🌱\0"], bytes: [new Uint8Array()]
		, char: ["\0", "\u{10ffff}"], word: [0], signedWord: [2147483647]
	}))
		for(const value of values)
		{
			const input = { kind: "leaf", payload: { ...scalars, [field]: value } };
			equal(api.tree(input), input);
		}
	for(const value of [
		null, undefined, [], {}, { kind: "unknown" }, { kind: "branch" }
		, { kind: "branch", children: [], extra: true }
		, { kind: "leaf", payload: {} }
		, Object.create(empty), { ...empty, [Symbol("extra")]: 1 }
	]) rejects(() => api.tree(value));
	for(const [field, value] of Object.entries({
		unit: null, bool: 1, u8: 256, u16: 65536, u32: 0x100000000, u64: 1
		, i8: -129, i16: -32769, i32: -2147483649, i64: 1, natural: -1n
		, integer: 1, f32: "1", f64: "1", text: "\ud800", bytes: [1]
		, char: "ab", word: 0x100000000, signedWord: 2147483648
	})) rejects(() => api.tree({ kind: "leaf", payload: { ...scalars, [field]: value } }));
	let reads = 0;
	const getter = Object.defineProperty({ kind: "branch" }, "children", { get: () => { reads++; return []; } });
	rejects(() => api.tree(getter)); equal(reads, 0);
	const cyclic = { kind: "branch", children: [] }; cyclic.children.push(cyclic);
	rejects(() => api.tree(cyclic), /Cyclic copied value/);
	const impossible = { kind: "again" }; impossible.value = impossible;
	rejects(() => api.never(impossible), /Cyclic copied value/);
	rejects(() => api.never({ kind: "again" }));
	const mutual = { kind: "next", right: { kind: "many", lefts: [] } }; mutual.right.lefts.push(mutual);
	rejects(() => api.left(mutual), /Cyclic copied value/);
	const spine = depth => {
		let value = { kind: "leaf", value: 42 };
		for(let index = 0; index < depth; index++) value = { kind: "next", value };
		return value;
	};
	equal(api.spine(spine(127)), spine(127));
	for(let index = 0; index < 8; index++) rejects(() => api.grow(spine(127)), /budget/);
	equal(api.grow(spine(8)), spine(9));
	for(const depth of [128, 20000]) rejects(() => api.spine(spine(depth)), /value depth exceeded/);
	equal(api.forest(Array(65535).fill(empty)), Array(65535).fill(empty));
	rejects(() => api.forest(Array(65536).fill(empty)), /budget/);
	const near = { ...scalars, text: "a".repeat(8 * 1024 * 1024 - 1024) };
	equal(api.scalars(near), near);
	rejects(() => api.scalars({ ...near, text: "a".repeat(8 * 1024 * 1024) }), /budget/);
	equal(api.inspect(scalars), true);
	return { checks, rejections, primitives: 19 };
};
