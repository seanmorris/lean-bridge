/**
 * Public zero-payload calls shared by Node, page, React and worker consumers.
 *
 * @file
 */
/**
 * Snapshot one public copied value exactly.
 *
 * @param value - Public copied value.
 */
const snapshot = value => {
	const visiting = new Set();
	const encode = item => {
		if(item === null) return ["null"];
		const type = typeof item;
		if(type === "undefined") return [type];
		if(type === "bigint") return [type, item.toString()];
		if(type === "string" || type === "boolean" || type === "number") return [type, item];
		if(type !== "object" || visiting.has(item)) throw new TypeError("Unsupported snapshot value");
		const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
		if(array ? prototype !== Array.prototype
			: prototype !== Object.prototype && prototype !== null)
			throw new TypeError("Unsupported snapshot prototype");
		visiting.add(item);
		try
		{
			return [
				array ? "array" : "object"
				, Reflect.ownKeys(item).sort().map(key => {
				const field = Object.getOwnPropertyDescriptor(item, key);
				if(typeof key !== "string" || !Object.hasOwn(field, "value"))
					throw new TypeError("Unsupported snapshot field");
				return [key, encode(field.value)];
				})
			];
		}
		finally
		{
			visiting.delete(item);
		}
	};
	return JSON.stringify(encode(value));
};

/**
 * Execute the installed API without Lean constructors or transport knowledge.
 *
 * @param api - Installed generated public API.
 * @param resultOnly - Whether checked inputs were omitted from the package.
 */
export const checkZeroPayloadRecords = (api, resultOnly = false) => {
	if(typeof resultOnly !== "boolean") throw new TypeError("Expected result-only boolean");
	let checks = 0, rejections = 0, calls = 0, snapshots = 0, recoveries = 0;
	const check = (condition, label) => {
		if(!condition) throw new Error(`failed: ${label}`);
		checks++;
	};
	const equal = (actual, expected, label) => check(
		snapshot(actual) === snapshot(expected), label
	);
	const invoke = (name, args, expected, label = name) => {
		const before = snapshot(args); calls++;
		const value = api[name](...args);
		equal(value, expected, label);
		check(snapshot(args) === before, `${label} preserved every input`);
		snapshots++; return value;
	};
	const refused = (name, args, shape) => {
		const before = snapshot(args); let failure; calls++;
		try
		{
			api[name](...args);
		}
		catch(error)
		{
			failure = error;
		}
		const expected = shape
			? failure instanceof TypeError && /declared copied fields|plain record|variant/u.test(failure.message)
			: failure instanceof Error && !(failure instanceof TypeError)
				&& failure.message === "absentCount.arg0 was rejected by ZeroPayloadCheckedRecords.mkAbsent";
		check(expected, `${name} refusal`);
		check(snapshot(args) === before, `${name} rejection preserved every input`);
		rejections++; snapshots++;
	};
	const recover = () => {
		invoke("witnessCount", [{}], 1n, "recovery after refusal"); recoveries++;
	};
	const invalid = (name, args, shape = true) => {
		refused(name, args, shape); recover();
	};
	const witness = invoke("produceWitness", [], {});
	const token = invoke("produceToken", [], { tag: undefined });
	const values = invoke("witnesses", [3n], [{}, {}, {}]);
	const none = invoke("maybeWitness", [false], { tag: "none" });
	const some = invoke("maybeWitness", [true], { tag: "some", value: {} });
	const marker = invoke("produceMarker", [], {});
	const blank = invoke("produceMark", [false], { kind: "blank" });
	const marked = invoke("produceMark", [true], { kind: "marked", witness: {} });
	check(Reflect.ownKeys(witness).length === 0, "Witness has an explicit empty carrier");
	check(Reflect.ownKeys(token).join() === "tag", "Token preserves its Unit field");
	check(values.length === 3, "Witness array preserves length");
	check(new Set(values).size === 3, "Witness array contains independent values");
	check(none.tag === "none" && some.tag === "some", "Option presence remains explicit");
	check(Reflect.ownKeys(marker).length === 0, "plain Marker remains an empty carrier");
	check(blank.kind === "blank" && marked.kind === "marked"
		&& Reflect.ownKeys(marked.witness).length === 0
	, "inactive and active variant branches remain distinct");
	if(resultOnly)
	{
		for(const name of ["witnessCount", "absentCount", "tokenTag", "markerCount", "markCount"])
			check(!Object.hasOwn(api, name), `result-only package omitted ${name}`);
		return { checks, rejections, calls, snapshots, recoveries };
	}
	invoke("witnessCount", [{}], 1n);
	invoke("tokenTag", [{ tag: undefined }], undefined);
	invoke("markerCount", [{}], 0n);
	invoke("markCount", [{ kind: "blank" }], 0n);
	invoke("markCount", [{ kind: "marked", witness: {} }], 1n);
	refused("absentCount", [{}], false); recover();
	invalid("witnessCount", [{ positive: true }]);
	invalid("witnessCount", [null]);
	invalid("witnessCount", [undefined]);
	invalid("tokenTag", [{}]);
	invalid("tokenTag", [{ tag: undefined, fresh: true }]);
	invalid("markerCount", [{ marker: true }]);
	invalid("markerCount", [[]]);
	invalid("markCount", [{ kind: "marked", witness: { positive: true } }]);
	invalid("markCount", [{ kind: "blank", witness: {} }]);
	return { checks, rejections, calls, snapshots, recoveries };
};
