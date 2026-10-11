/**
 * Public checked-record calls shared by real Node, page, React and worker consumers.
 * This caller contains expected values, not Lean constructors or transport code.
 *
 * @file
 */

/**
 * Snapshot all own data without getters, lossy JSON coercion or omitted array holes.
 *
 * @param value - Caller-owned copied data.
 */
export const checkedRecordSnapshot = value => {
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
 * Exercise the installed payload-only API with complete input preservation.
 *
 * @param api - The installed generated public exports.
 * @param resultOnly - The package exposes only a Lean-produced checked result.
 */
export const checkCheckedRecords = (api, resultOnly = false) => {
	if(typeof resultOnly !== "boolean") throw new TypeError("Expected an explicit result-only boolean");
	let checks = 0, rejections = 0, calls = 0, snapshots = 0, recoveries = 0;
	const check = (condition, label) => { if(!condition) throw new Error("failed: " + label); checks++; };
	const equal = (actual, expected, label) => check(checkedRecordSnapshot(actual) === checkedRecordSnapshot(expected), label);
	const invoke = (name, args, expected, label = name) => {
		const before = checkedRecordSnapshot(args); calls++;
		const result = api[name](...args);
		equal(result, expected, label);
		check(checkedRecordSnapshot(args) === before, label + " preserved every input"); snapshots++;
		return result;
	};
	const refused = (name, args, shape = false) => {
		const before = checkedRecordSnapshot(args); let failure; calls++;
		try
		{ api[name](...args); }
		catch(error)
		{ failure = error; }
		if(!failure) throw new Error("accepted: " + name);
		check(shape ? failure instanceof TypeError && /does not match the declared copied fields/u.test(failure.message)
			: failure instanceof Error && !(failure instanceof TypeError) && /failed \(5\)/u.test(failure.message), name + " wrong refusal");
		check(checkedRecordSnapshot(args) === before, name + " rejection preserved every input"); snapshots++; rejections++;
	};
	const recovery = () => {
		invoke("width", [{ lo: 3n, hi: 10n }], 7n, "recovery after refusal"); recoveries++;
	};
	const invalid = (name, args, shape = false) => { refused(name, args, shape); recovery(); };
	const triple = value => ({ data: [value, value, value] });
	const huge = 1n << 100n;
	if(resultOnly)
	{
		for(const name of ["width", "span", "total", "firstOf", "smallest", "scale", "complement"])
			check(!Object.hasOwn(api, name), "result-only package omitted " + name);
		for(let i = 0n; i < 1000n; i++) invoke("repeated", [i], triple(i));
		invoke("repeated", [1n << 80n], triple(1n << 80n), "result-only Nat precision");
		invoke("repeated", [(1n << 80n) + 1n], triple((1n << 80n) + 1n), "result-only Nat low bits");
		return { checks, rejections, calls, snapshots, recoveries };
	}
	invoke("width", [{ lo: 3n, hi: 10n }], 7n);
	invoke("width", [{ lo: huge, hi: huge }], 0n, "equal endpoints");
	invoke("width", [{ lo: huge, hi: huge + 9n }], 9n, "wide endpoints");
	invalid("width", [{ lo: 10n, hi: 3n }]);
	invoke("span", [{ lo: 1n, hi: 5n }, { lo: 2n, hi: 9n }], 8n);
	invalid("span", [{ lo: 1n, hi: 5n }, { lo: 9n, hi: 2n }]);
	invalid("span", [{ lo: 5n, hi: 1n }, { lo: 2n, hi: 9n }]);
	const three = { data: [3n, 1n, 2n] };
	invoke("total", [three], 6n);
	invalid("total", [{ data: [1n, 2n] }]);
	invoke("firstOf", [three], 3n, "mkTriple retains caller order");
	invoke("smallest", [three], 1n, "sortedTriple normalizes only inside Lean");
	invalid("smallest", [{ data: [1n, 2n] }]);
	const scaled = invoke("scale", [2n, three], { data: [6n, 2n, 4n] });
	invalid("scale", [2n, { data: [1n] }]);
	invoke("smallest", [scaled], 2n, "Lean result re-enters its checked constructor");
	invoke("repeated", [4n], triple(4n));
	invoke("total", [{ data: [1n << 70n, 1n, 2n] }], (1n << 70n) + 3n);
	invoke("complement", [{ value: 40n }], 60n);
	invalid("complement", [{ value: 101n }]);
	invalid("width", [{ lo: 3n, hi: 10n, ordered: true }], true);
	invalid("width", [{ lo: 3n }], true);
	for(const n of [0, 1, 2, 4])
	{
		for(const name of ["total", "firstOf", "smallest"]) invalid(name, [{ data: Array(n).fill(huge) }]);
		invalid("scale", [huge, { data: Array(n).fill(huge) }]);
	}
	for(const data of [[0n, 0n, 0n], [huge, 1n, huge + 2n], [7n, 7n, 7n]])
	{
		invoke("total", [{ data }], data.reduce((sum, value) => sum + value, 0n));
		invoke("firstOf", [{ data }], data[0]);
		invoke("smallest", [{ data }], data.reduce((a, b) => a < b ? a : b));
		invoke("scale", [0n, { data }], { data: [0n, 0n, 0n] });
	}
	invoke("complement", [{ value: 0n }], 100n);
	invoke("complement", [{ value: 100n }], 0n);
	invalid("complement", [{ value: huge }]);
	for(const [name, args] of [
		["total", [{ data: [3n, 1n, 2n], sized: true }]]
		, ["total", [{}]]
		, ["complement", [{ value: 40n, above: true, below: true }]]
		, ["complement", [{}]]
		, ["span", [{ lo: 1n, hi: 5n }, { lo: 2n, hi: 9n, ordered: true }]]
	]) invalid(name, args, true);
	for(let i = 0n; i < 1000n; i++)
	{
		invoke("width", [{ lo: i, hi: i + 1n }], 1n, "rejection/recovery round");
		invalid("width", [{ lo: i + 1n, hi: i }]);
		invalid("span", [{ lo: i, hi: i + 1n }, { lo: i + 2n, hi: i }]);
		invalid("smallest", [{ data: [i + 2n, i] }]);
		invoke("smallest", [{ data: [i + 2n, i, i + 1n] }], i, "sorted recovery");
	}
	return { checks, rejections, calls, snapshots, recoveries };
};
