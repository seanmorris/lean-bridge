/* global checkCallables */
/**
 * Installed public checks, appended to the shared primitive callback consumer.
 * The same module executes in Node, browsers, React and workers.
 *
 * @file
 */

/**
 * Exercise copied callback payloads and closures without private runtime access.
 *
 * @param api - Original installed npm package.
 */
export const checkStructuredCallables = api => {
	const primitive = checkCallables(api);
	let checks = 0, rejections = 0;
	const check = (condition, message) => { checks++; if(!condition) throw new Error(message); };
	const equal = (actual, expected) => {
		const stack = [[actual, expected]];
		while(stack.length)
		{
			const [a, b] = stack.pop();
			if(b instanceof Uint8Array)
			{
				check(a instanceof Uint8Array && a.length === b.length, "Copied bytes shape");
				for(let index = 0; index < b.length; index++) stack.push([a[index], b[index]]);
			}
			else if(b && typeof b === "object")
			{
				check(a && typeof a === "object" && Array.isArray(a) === Array.isArray(b)
					&& Object.keys(a).sort().join("|") === Object.keys(b).sort().join("|"), "Copied value shape");
				for(const key of Object.keys(b)) stack.push([a[key], b[key]]);
			}
			else check(Object.is(a, b), "Copied scalar value");
		}
	};
	const rejects = (operation, expected) => {
		let caught = false;
		try
		{ operation(); }
		catch(error)
		{ caught = true; if(expected) check(expected(error), `Unexpected failure: ${String(error)}`); }
		check(caught, "Expected a rejected structured call"); rejections++;
	};
	const rows = [{ tag: "some", value: "\uFEFF🌱\0" }, { tag: "none" }, { tag: "some", value: "" }];
	const payload = { text: "copied\0🌱", rows, count: (1n << 129n) + 7n, nested: { tag: "some", value: { ok: [(1n << 64n) - 1n, undefined] } } };
	const leaf = { kind: "leaf", value: (1n << 200n) + 9n }, empty = { kind: "branch", children: [] };
	const tree = { kind: "branch", children: [leaf, { kind: "branch", children: [leaf, empty] }] };
	const cases = {
		Array: [rows, []]
		, List: [[{ ok: [42, "\uFEFF🌱"] }, { error: "failure\0" }], []]
		, Option: [{ tag: "none" }, { tag: "some", value: { tag: "none" } }, { tag: "some", value: { tag: "some", value: undefined } }]
		, Result: [{ error: ["one", "", "🌱"] }, { error: [] }, { ok: { tag: "none" } }, { ok: { tag: "some", value: 0xffffffff } }]
		, Tuple: [["tuple", [Uint8Array.of(0, 128, 255), 1n << 128n]], ["", [new Uint8Array(), 0n]]]
		, Record: [payload, { ...payload, nested: { tag: "none" } }, { ...payload, nested: { tag: "some", value: { error: "error🌱" } } }]
		, Alias: [payload]
		, Variant: [{ kind: "counts", positive: 1n << 128n, negative: -(1n << 129n) }, { kind: "empty" }, { kind: "payload", label: "packet", rows }]
		, Recursive: [tree, leaf, empty]
	};
	for(const [shape, values] of Object.entries(cases)) for(const value of values)
	{
		globalThis.callableProgress?.(`structured ${shape}`);
		for(const action of ["call", "twice"])
		{
			let count = 0;
			const result = api[`${action}${shape}`](value, copied => { count++; equal(copied, value); check(copied !== value, "Aliased callback input"); return copied; });
			equal(result, value); check(result !== value, "Aliased return value"); equal(count, action === "twice" ? 2 : 1);
		}
		const closure = api[`make${shape}`](value);
		equal(closure(false, values[0]), values[0]); equal(closure(true, values[0]), value);
		check(closure.dispose(), "Initial closure disposal"); check(!closure.dispose(), "Duplicate closure disposal");
		rejects(() => closure(false, value), error => /disposed/.test(String(error)));
	}
	const captured = structuredClone(payload), retained = api.makeRecord(captured);
	captured.text = "mutated source"; captured.rows[0].value = "mutated source";
	const returned = retained(true, payload); equal(returned, payload);
	returned.rows[0].value = "mutated result"; equal(retained(true, payload), payload); retained.dispose();
	const copiedTree = api.callRecursive(tree, input => input);
	copiedTree.children[0].value = 0n;
	equal(copiedTree.children[1].children[0].value, leaf.value); equal(tree.children[0].value, leaf.value);
	for(const original of [new Error("original"), undefined, null, 0, { original: true }])
		for(const name of ["twiceRecord", "afterFailure"])
		{
			let calls = 0;
			rejects(() => api[name](payload, () => { calls++; throw original; }), error => error === original);
			equal(calls, 1); equal(api.callRecord(payload, value => value), payload);
		}
	const expired = api.retainRecord(value => value);
	rejects(() => expired(payload), error => /Expired/.test(String(error))); expired.dispose();
	const closure = api.makeRecord(payload);
	let disposed = false;
	const proxy = new Proxy(payload, { getOwnPropertyDescriptor: (target, key) => {
		if(!disposed)
		{ disposed = true; check(closure.dispose(), "Disposal during conversion"); }
		return Reflect.getOwnPropertyDescriptor(target, key);
	} });
	equal(closure(false, proxy), payload); check(disposed && closure.disposed, "Conversion pin did not defer disposal");
	for(const invalid of [null, Promise.resolve(payload), { ...payload, count: -1n }, { ...payload, nested: undefined }, { ...payload, extra: true }])
	{
		rejects(() => api.callRecord(payload, () => invalid));
		let calls = 0;
		rejects(() => api.callRecord(invalid, value => { calls++; return value; })); equal(calls, 0);
		equal(api.callRecord(payload, value => value), payload);
	}
	let reads = 0;
	const getter = Object.defineProperty({ ...payload }, "text", { get: () => { reads++; return "wrong"; } });
	rejects(() => api.callRecord(getter, value => value)); equal(reads, 0);
	rejects(() => api.callRecord(payload, () => getter)); equal(reads, 0);
	const cycle = { kind: "branch", children: [] }; cycle.children.push(cycle);
	rejects(() => api.callRecursive(cycle, value => value)); rejects(() => api.callRecursive(leaf, () => cycle));
	const spine = depth => {
		let value = leaf;
		for(let index = 0; index < depth; index++) value = { kind: "branch", children: [value] };
		return value;
	};
	equal(api.callRecursive(spine(63), value => value), spine(63));
	for(const depth of [64, 20000]) rejects(() => api.callRecursive(spine(depth), value => value), error => /depth/.test(String(error)));
	rejects(() => api.callRecursive(leaf, () => spine(64)), error => /depth/.test(String(error)));
	equal(api.callRecursive(tree, value => value), tree);
	const nearNodes = Array(65534).fill({ tag: "none" });
	equal(api.callArray(nearNodes, value => value), nearNodes);
	rejects(() => api.callArray([...nearNodes, { tag: "none" }], value => value), error => /budget/.test(String(error)));
	equal(api.callArray(rows, value => value), rows);
	const nearBytes = [{ tag: "some", value: "a".repeat(3 * 1024 * 1024) }];
	equal(api.callArray(nearBytes, value => value), nearBytes);
	rejects(() => api.callArray([{ tag: "some", value: "a".repeat(4 * 1024 * 1024) }], value => value), error => /budget/.test(String(error)));
	equal(api.callRecord(payload, value => value), payload);
	return { checks, rejections, shapes: Object.keys(cases).length, primitive };
};
