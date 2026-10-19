/**
 * Public value-indexed checked-record calls shared by Node, pages, React and workers.
 * The caller knows only payload fields and generated functions; no proof or Lean source crosses in.
 *
 * @file
 */

const inputFunctions = Object.freeze([
	"trueBoolIndex", "falseBoolIndex", "abStringIndex", "emptyStringIndex"
	, "unicodeStringIndex", "emptySizedIndex", "zeroNatIndex", "wideNatIndex"
]);
const resultFunctions = Object.freeze([
	"produceTrueBool", "produceFalseBool", "produceAb", "produceEmptyString"
	, "produceUnicodeString", "produceEmptySized", "produceZeroNat"
	, "produceWideNat"
]);

/**
 * Snapshot caller-owned copied data without JSON bigint loss or getter side effects.
 *
 * @param value - Caller-owned copied value.
 */
export const checkedRecordValueIndexSnapshot = value => {
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
		if(array ? prototype !== Array.prototype
			: prototype !== Object.prototype && prototype !== null)
			throw new TypeError("Unsupported snapshot prototype");
		const keys = Reflect.ownKeys(item);
		if(keys.some(key => typeof key !== "string"))
			throw new TypeError("Unsupported snapshot symbol key");
		visiting.add(item);
		try
		{
			const entries = keys.sort().map(key => {
				const descriptor = Object.getOwnPropertyDescriptor(item, key);
				if(!Object.hasOwn(descriptor, "value"))
					throw new TypeError("Unsupported snapshot accessor");
				return [key, encode(descriptor.value)];
			});
			const kind = array ? "array"
				: prototype === null ? "null-prototype-object" : "object";
			return [kind, entries];
		}
		finally
		{ visiting.delete(item); }
	};
	return JSON.stringify(encode(value));
};

/**
 * Exercise every admitted value-index kind through an installed public package.
 *
 * @param api - Installed generated public API.
 * @param resultOnly - Whether checked-input exports must be absent.
 */
export const checkCheckedRecordValueIndices = (api, resultOnly = false) => {
	if(typeof resultOnly !== "boolean") throw new TypeError("Expected result-only boolean");
	let checks = 0, rejections = 0, calls = 0, snapshots = 0, recoveries = 0;
	const check = (condition, label) => {
		if(!condition) throw new Error(`failed: ${label}`);
		checks++;
	};
	const equal = (actual, expected, label) => check(
		checkedRecordValueIndexSnapshot(actual) === checkedRecordValueIndexSnapshot(expected)
		, label
	);
	for(const name of inputFunctions)
		check(resultOnly ? !Object.hasOwn(api, name) : typeof api[name] === "function"
			, `${resultOnly ? "omitted" : "exposed"} ${name}`);
	for(const name of resultFunctions)
		check(typeof api[name] === "function", `exposed ${name}`);
	const invoke = (name, args, expected, label = name) => {
		const before = checkedRecordValueIndexSnapshot(args); calls++;
		const result = api[name](...args);
		equal(result, expected, label);
		check(checkedRecordValueIndexSnapshot(args) === before
			, `${label} preserved every input`);
		snapshots++;
		return result;
	};
	const refused = (name, args, kind) => {
		const before = checkedRecordValueIndexSnapshot(args); let failure; calls++;
		try
		{ api[name](...args); }
		catch(error)
		{ failure = error; }
		const expectedFailure = kind === "checked"
			? failure instanceof Error && !(failure instanceof TypeError)
				&& /failed \(5\)/u.test(failure.message)
			: failure instanceof TypeError
				&& /declared copied fields|must be bigint/u.test(failure.message);
		check(expectedFailure, `${name} ${kind} refusal`);
		check(checkedRecordValueIndexSnapshot(args) === before
			, `${name} rejection preserved every input`);
		snapshots++; rejections++;
	};
	const recover = () => {
		invoke("zeroNatIndex", [{ count: 99n }], 99n, "recovery after refusal");
		recoveries++;
	};
	const invalid = (name, args, kind) => { refused(name, args, kind); recover(); };
	const huge = (1n << 100n) + 17n;
	const observed = {};
	if(!resultOnly)
	{
		observed.trueBool = invoke("trueBoolIndex", [{ count: 0n }], 0n).toString();
		observed.falseBool = invoke("falseBoolIndex", [{ count: 1n }], 1n).toString();
		observed.ab = invoke("abStringIndex", [{ size: 2n }], 2n).toString();
		observed.emptyString = invoke("emptyStringIndex", [{ count: 9n }], 9n).toString();
		observed.unicodeString = invoke(
			"unicodeStringIndex", [{ count: 10n }], 10n).toString();
		observed.emptySized = invoke("emptySizedIndex", [{ data: [] }], 0n).toString();
		observed.zeroNat = invoke("zeroNatIndex", [{ count: 11n }], 11n).toString();
		observed.wideNat = invoke("wideNatIndex", [{ count: huge }], huge).toString();
		invalid("abStringIndex", [{ size: 1n }], "checked");
		invalid("emptySizedIndex", [{ data: [1n] }], "checked");
		invalid("trueBoolIndex", [{ count: 1n }], "checked");
		invalid("falseBoolIndex", [{ count: 0n }], "checked");
		invalid("trueBoolIndex", [{ count: 0n, set: true }], "shape");
		invalid("zeroNatIndex", [{ count: 1 }], "shape");
	}
	const produced = {
		trueBool: invoke("produceTrueBool", [], { count: 0n })
		, falseBool: invoke("produceFalseBool", [], { count: 1n })
		, ab: invoke("produceAb", [], { size: 2n })
		, emptyString: invoke("produceEmptyString", [23n], { count: 23n })
		, unicodeString: invoke("produceUnicodeString", [24n], { count: 24n })
		, emptySized: invoke("produceEmptySized", [], { data: [] })
		, zeroNat: invoke("produceZeroNat", [25n], { count: 25n })
		, wideNat: invoke("produceWideNat", [huge], { count: huge })
	};
	return {
		checks, rejections, calls, snapshots, recoveries, observed
		, produced: Object.fromEntries(Object.entries(produced).map(([name, value]) => [
			name, JSON.parse(checkedRecordValueIndexSnapshot(value))
		]))
	};
};
