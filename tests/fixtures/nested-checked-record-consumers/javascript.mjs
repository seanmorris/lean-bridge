/**
 * Public caller for installed nested checked-record packages.
 * Expected values and failure classes are independent of generated bridge metadata.
 *
 * @file
 */

const snapshot = value => {
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
			return [
				array ? "array" : prototype === null ? "null-prototype-object" : "object"
				, keys.sort().map(key => {
				const descriptor = Object.getOwnPropertyDescriptor(item, key);
				if(!Object.hasOwn(descriptor, "value")) throw new TypeError("Unsupported snapshot accessor");
				return [key, encode(descriptor.value)];
				})
			];
		}
		finally
		{ visiting.delete(item); }
	};
	return JSON.stringify(encode(value));
};

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Build one exact ordinary/reviewed checked-record constructor diagnostic.
 *
 * @param name - Public callable name.
 * @param suffix - Literal path below the parameter root.
 * @param constructor - Unqualified Lean constructor name.
 * @param parameter - Zero-based parameter position.
 */
export const nestedCheckedRecordConstructorRefusal = (
	name, suffix, constructor, parameter = 0
) => {
	if(typeof name !== "string" || typeof suffix !== "string"
		|| typeof constructor !== "string" || !Number.isSafeInteger(parameter)
		|| parameter < 0)
		throw new TypeError("Expected a checked-record diagnostic site");
	return new RegExp(
		`^${escapeRegExp(name)}\\.(?:arg${parameter}|value${parameter})${escapeRegExp(suffix)}`
		+ ` was rejected by NestedCheckedRecords\\.${escapeRegExp(constructor)}$`, "u"
	);
};

/**
 * Exercise complete full or result-only nested checked-record APIs.
 *
 * @param api - Installed package exports.
 * @param root0 - Explicit package-selection options.
 * @param root0.resultOnly - Whether only Lean-produced results are exported.
 */
export const checkNestedCheckedRecords = (api, { resultOnly = false } = {}) => {
	if(typeof resultOnly !== "boolean") throw new TypeError("Expected an explicit result-only boolean");
	let checks = 0, rejections = 0, calls = 0, snapshots = 0, recoveries = 0;
	const check = (condition, label) => { if(!condition) throw new Error(`failed: ${label}`); checks++; };
	const equal = (actual, expected, label) => check(snapshot(actual) === snapshot(expected), label);
	const invoke = (name, arguments_, expected, label = name) => {
		const before = snapshot(arguments_); calls++;
		const result = api[name](...arguments_);
		equal(result, expected, label);
		check(snapshot(arguments_) === before, `${label} preserved every input`); snapshots++;
		return result;
	};
	const refused = (name, arguments_, pattern) => {
		if(!(pattern instanceof RegExp)) throw new TypeError("Expected an exact refusal pattern");
		const before = snapshot(arguments_); let failure; calls++;
		try
		{ api[name](...arguments_); }
		catch(error)
		{ failure = error; }
		if(!failure) throw new Error(`accepted: ${name}`);
		check(pattern.test(String(failure.message)), `${name} wrong refusal: ${failure.message}`);
		check(snapshot(arguments_) === before, `${name} rejection preserved every input`); snapshots++; rejections++;
	};
	const packet = (digit, word) => ({ digit, word });
	const some = value => ({ tag: "some", value }), none = { tag: "none" };
	const produced = value => packet(0n, value + 1n);
	const rejected = {
		firstWord: nestedCheckedRecordConstructorRefusal("first", ".word", "mkWord")
		, firstPacket: nestedCheckedRecordConstructorRefusal("first", "", "mkPacket")
		, pairPacket: nestedCheckedRecordConstructorRefusal("pair", "", "mkPacket")
		, arrayWord: nestedCheckedRecordConstructorRefusal("inArray", "[1].word", "mkWord")
		, arrayPacket: nestedCheckedRecordConstructorRefusal("inArray", "[1]", "mkPacket")
		, optionPacket: nestedCheckedRecordConstructorRefusal("inOption", ".value", "mkPacket")
		, exceptPacket: nestedCheckedRecordConstructorRefusal("inExcept", ".error", "mkPacket")
		, choicePacket: nestedCheckedRecordConstructorRefusal("inChoice", ".value", "mkPacket")
	};
	const huge = 1n << 100n;
	for(const value of [0n, 4n, huge])
	{
		invoke("produceOption", [value], some(produced(value)));
		invoke("produceArray", [value], [produced(value), produced(value + 1n)]);
	}
	if(resultOnly)
	{
		for(const name of [
			"first", "second", "pair", "inArray", "inList", "inOption", "inProduct"
			, "inExcept", "inHolder", "inChoice", "echoArray"
		])
			check(!Object.hasOwn(api, name), `result-only package omitted ${name}`);
		for(let round = 0n; round < 1000n; round++)
		{
			invoke("produceOption", [huge + round], some(produced(huge + round)));
			invoke("produceArray", [huge + round], [produced(huge + round), produced(huge + round + 1n)]);
		}
		return { checks, rejections, calls, snapshots, recoveries };
	}
	const first = packet(2n, 3n), second = packet(7n, 0n), normalizedSecond = packet(7n, 8n);
	invoke("first", [first], 3n);
	invoke("second", [second], 8n);
	invoke("pair", [first, second], 11n);
	invoke("inArray", [[packet(1n, 2n), packet(3n, 5n)]], 7n);
	invoke("inList", [[packet(1n, 0n), packet(3n, 100n)]], 6n);
	invoke("inOption", [none], 0n);
	invoke("inOption", [some(packet(1n, 2n))], 3n);
	invoke("inProduct", [[packet(1n, 2n), packet(3n, 0n)]], 6n);
	invoke("inExcept", [{ ok: packet(2n, 9n) }], 3n);
	invoke("inExcept", [{ error: packet(1n, 2n) }], 3n);
	invoke("inHolder", [{ packet: packet(3n, 1n), tag: 9n }], 13n);
	invoke("inChoice", [{ kind: "empty" }], 0n);
	invoke("inChoice", [{ kind: "packet", value: packet(2n, 4n) }], 5n);
	invoke("echoArray", [[first, packet(1n, huge)]], [first, packet(1n, huge)]);
	refused("first", [packet(0n, 0n)], rejected.firstWord);
	refused("first", [packet(4n, 2n)], rejected.firstPacket);
	refused("first", [packet(10n, 12n)], /^first\.(?:arg0|value0)\.digit must be bigint below 10$/u);
	refused("pair", [packet(4n, 2n), second], rejected.pairPacket);
	refused("pair", [first, packet(10n, 0n)], /^pair\.(?:arg1|value1)\.digit must be bigint below 10$/u);
	refused("inArray", [[first, packet(1n, 0n)]], rejected.arrayWord);
	refused("inArray", [[first, packet(5n, 2n)]], rejected.arrayPacket);
	refused("inArray", [[first, packet(10n, 12n)]], /^inArray\.(?:arg0|value0)\.1\.digit must be bigint below 10$/u);
	refused("inOption", [some(packet(5n, 2n))], rejected.optionPacket);
	refused("inProduct", [[first, packet(10n, 0n)]], /^inProduct\.(?:arg0|value0)\.1\.digit must be bigint below 10$/u);
	refused("inExcept", [{ ok: packet(10n, 0n) }], /^inExcept\.(?:arg0|value0)\.ok\.digit must be bigint below 10$/u);
	refused("inExcept", [{ error: packet(3n, 1n) }], rejected.exceptPacket);
	refused("inHolder", [{ packet: packet(10n, 0n), tag: 9n }], /^inHolder\.(?:arg0|value0)\.packet\.digit must be bigint below 10$/u);
	refused("inChoice", [{ kind: "packet", value: packet(3n, 1n) }], rejected.choicePacket);
	const shape = /does not match the declared copied fields/u;
	refused("first", [{ digit: 2n, word: 3n, linked: true }], shape);
	refused("first", [{ digit: 2n }], shape);
	refused("inHolder", [{ packet: first, tag: 1n, proof: true }], shape);
	equal(second, packet(7n, 0n), "normalization did not mutate caller data");
	for(let round = 0n; round < 1000n; round++)
	{
		const valid = packet(round % 10n, round + 10n);
		invoke("first", [valid], round + 10n, "round accepted");
		refused("first", [packet(2n, 1n)], rejected.firstPacket);
		invoke("second", [packet(round % 10n, 0n)], round % 10n + 1n, "round normalized");
		refused("inArray", [[valid, packet(1n, 0n)]], rejected.arrayWord);
		invoke("inArray", [[valid, first]], round + 13n, "recovery after late rejection"); recoveries++;
	}
	equal(second, packet(7n, 0n), "all rounds preserved the reused caller value");
	equal(normalizedSecond, packet(7n, 8n), "independent expected normalization remains stable");
	return { checks, rejections, calls, snapshots, recoveries };
};
