/**
 * Independent public JavaScript checks shared by installed Node and later browser callers.
 * No compiler-generated model supplies expected values.
 *
 * @file
 */
/**
 * Preserve host types, absent properties, array holes and every string code unit.
 * Never invoke a caller's getters or toJSON method while constructing the oracle.
 *
 * @param value - A copied structural public value.
 */
export const structuralValueSnapshot = value => {
	const visiting = new Set();
	const encode = item => {
		if(item === null) return ["null"];
		const type = typeof item;
		if(type === "undefined") return [type];
		if(type === "bigint") return [type, item.toString()];
		if(type === "number") return [type, Object.is(item, -0) ? "-0" : String(item)];
		if(type === "string" || type === "boolean") return [type, item];
		if(type !== "object") throw new TypeError(`Unsupported snapshot type: ${type}`);
		if(visiting.has(item)) throw new TypeError("Cyclic snapshot input");
		const prototype = Object.getPrototypeOf(item), array = Array.isArray(item);
		if(array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
			throw new TypeError("Unsupported snapshot prototype");
		const keys = Reflect.ownKeys(item);
		if(keys.some(key => typeof key !== "string")) throw new TypeError("Unsupported snapshot symbol key");
		visiting.add(item);
		try
		{
			const entries = keys.sort().map(key => {
				const descriptor = Object.getOwnPropertyDescriptor(item, key);
				if(!Object.hasOwn(descriptor, "value")) throw new TypeError("Unsupported snapshot accessor");
				return [key, encode(descriptor.value)];
			});
			return [array ? "array" : prototype === null ? "null-prototype-object" : "object", entries];
		}
		finally
		{ visiting.delete(item); }
	};
	return JSON.stringify(encode(value));
};

/**
 * Check public values, constructor refusals and caller-input preservation.
 *
 * @param api - Installed generated public API, or a deliberate unit-test double.
 */
export const checkStructuralSubtypes = api => {
	let checks = 0, rejections = 0;
	const check = (ok, label) => { if(!ok) throw new Error(`failed: ${label}`); checks++; };
	const snapshot = structuralValueSnapshot;
	const equal = (actual, expected, label) => check(snapshot(actual) === snapshot(expected), label);
	const refused = (call, label, pattern = /failed \(5\)/u) => {
		try
		{ call(); }
		catch(error)
		{
			if(!pattern.test(String(error?.message))) throw new Error(`wrong rejection: ${label}: ${error?.message}`, { cause: error });
			rejections++; return;
		}
		throw new Error(`accepted: ${label}`);
	};
	const some = value => ({ tag: "some", value }), none = { tag: "none" };
	const huge = 1n << 100n, wide = (10n << 64n) + 10n;
	check(api.scalar(huge) === huge, "scalar");
	refused(() => api.scalar(0n), "scalar zero");
	for(const name of ["arrays", "lists", "specialized"])
	{
		equal(api[name]([]), [], `${name} empty`);
		const values = [1n, huge, 3n];
		equal(api[name](values), values, name);
		for(let index = 0; index < values.length; index++)
		{
			const bad = values.slice(); bad[index] = 0n; const before = snapshot(bad);
			refused(() => api[name](bad), `${name} position ${index}`);
			check(snapshot(bad) === before, `${name} input unchanged`);
		}
	}
	equal(api.options(none), none, "absent option");
	equal(api.options(some(huge)), some(huge), "present option");
	refused(() => api.options(some(0n)), "option zero");
	const text = "a\0tail";
	equal(api.product([huge, text]), [huge, text], "product and embedded NUL");
	refused(() => api.product([0n, text]), "product positive");
	refused(() => api.product([huge, ""]), "product word");
	equal(api.branch({ ok: huge }), { ok: huge }, "success branch");
	equal(api.branch({ error: text }), { error: text }, "error branch");
	refused(() => api.branch({ ok: 0n }), "branch positive");
	refused(() => api.branch({ error: "" }), "branch word");
	const bytes = [none, some([255, huge])];
	equal(api.byteBranches(bytes), bytes, "unboxed byte and boxed Nat");
	refused(() => api.byteBranches([some([0, 1n])]), "byte zero");
	refused(() => api.byteBranches([some([1, 0n])]), "byte-pair Nat zero");
	const nested = [[none, some([huge, wide - 1n])], [], [some([2n, 3n])]];
	check(api.nested(nested) === 3n, "nested valid");
	nested[2][0] = some([0n, wide]); const before = snapshot(nested);
	refused(() => api.nested(nested), "mixed Fin before constructor", /^nested\.(?:arg0|value0)\[2\]\[0\]\.value\[1\] must be bigint below 184467440737095516170$/u);
	check(snapshot(nested) === before, "mixed input unchanged");
	nested[2][0] = some([0n, wide - 1n]);
	refused(() => api.nested(nested), "nested positive");
	nested[2][0] = some([1n, wide - 1n]); check(api.nested(nested) === 3n, "nested recovery");
	const first = [some(1n), none, some(huge)], second = [some(huge), some(3n), none];
	const normalized = [some(huge + 1n), some(4n), none];
	equal(api.aliasPair([first, second]), [first, normalized], "per-site alias choices");
	equal(api.aliasArguments(first, second), [...first, ...normalized], "two alias parameters");
	check(api.plainFin([none, some(0n), some(9n)]) === 3n, "Fin-only tree");
	refused(() => api.plainFin([some(10n)]), "Fin-only rejection", /^plainFin\.(?:arg0|value0)\[0\]\.value must be bigint below 10$/u);
	for(let round = 0; round < 1000; round++)
	{
		const late = [some(huge), some(3n), some(4n)]; late[round % 3] = some(0n);
		const snapshotBefore = snapshot([first, late]);
		refused(() => api.aliasArguments(first, late), `late rejection ${round}`);
		check(snapshot([first, late]) === snapshotBefore, "both rejected inputs unchanged");
		equal(api.aliasArguments(first, second), [...first, ...normalized], "recovery");
		equal(second, [some(huge), some(3n), none], "normalization does not mutate caller");
	}
	return { checks, rejections };
};
