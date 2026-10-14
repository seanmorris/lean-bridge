/**
 * Independent public caller for installed primitive-base nominal Subtype packages.
 * Expected values do not read generated metadata, adapter code or runtime output.
 *
 * @file
 */
const typedLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "length").get;

/**
 * Preserve bytes, property presence, bigint values, IEEE signed zero and Unicode.
 *
 * @param value - Public copied value without accessors or custom prototypes.
 */
export const primitiveValueSnapshot = value => {
	const visiting = new Set();
	const encode = item => {
		if(item === null) return ["null"];
		const kind = typeof item;
		if(kind === "undefined") return [kind];
		if(kind === "bigint") return [kind, item.toString()];
		if(kind === "number") return [kind, Object.is(item, -0) ? "-0" : String(item)];
		if(kind === "boolean" || kind === "string") return [kind, item];
		if(kind !== "object") throw new TypeError(`Unsupported primitive snapshot type: ${kind}`);
		if(visiting.has(item)) throw new TypeError("Cyclic primitive snapshot input");
		const prototype = Object.getPrototypeOf(item), keys = Reflect.ownKeys(item);
		if(keys.some(key => typeof key !== "string")) throw new TypeError("Unexpected symbol key");
		if(prototype === Uint8Array.prototype)
		{
			const length = typedLength.call(item), entries = [];
			if(keys.length !== length) throw new TypeError("Unexpected byte-array property");
			for(let index = 0; index < length; index++)
			{
				const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
				if(!descriptor || !Object.hasOwn(descriptor, "value")) throw new TypeError("Invalid byte-array property");
				entries.push(descriptor.value);
			}
			return ["Uint8Array", entries];
		}
		const array = Array.isArray(item);
		if(array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
			throw new TypeError("Unsupported primitive snapshot prototype");
		visiting.add(item);
		try
		{
			return [array ? "array" : prototype === null ? "null-prototype-object" : "object"
				, keys.sort().map(key => {
					const descriptor = Object.getOwnPropertyDescriptor(item, key);
					if(!Object.hasOwn(descriptor, "value")) throw new TypeError("Unsupported primitive snapshot accessor");
					return [key, encode(descriptor.value)];
				})
			];
		}
		finally
		{ visiting.delete(item); }
	};
	return JSON.stringify(encode(value));
};

const packet = changes => ({
	unitValue: undefined, boolValue: true
	, uint8Value: 42, uint16Value: 42, uint32Value: 42, uint64Value: 42n
	, int8Value: -42, int16Value: -42, int32Value: -42, int64Value: -42n
	, natValue: 42n, intValue: -42n, float32Value: 1.5, float64Value: 1.5
	, textValue: "a", bytesValue: new Uint8Array([0, 128, 255]), charValue: "a"
	, usizeValue: 42, isizeValue: -42, digit: 2n, ...changes
});
const normalized = changes => packet({
	uint8Value: 44, uint16Value: 44, uint32Value: 44, uint64Value: 44n
	, int8Value: -40, int16Value: -40, int32Value: -40, int64Value: -40n
	, natValue: 44n, intValue: -40n, float32Value: -1.5, float64Value: -1.5
	, textValue: "a!", charValue: "b"
	, bytesValue: new Uint8Array([0, 128, 255, 255])
	, usizeValue: 44, isizeValue: -40, ...changes
});
const produced = changes => packet({
	uint8Value: 200, uint16Value: 200, uint32Value: 200, uint64Value: 200n
	, int8Value: 120, int16Value: 120, int32Value: 120, int64Value: 120n
	, natValue: 1n << 100n, intValue: -(1n << 100n)
	, float32Value: 12.5, float64Value: 12.5, textValue: "long λ text"
	, bytesValue: new Uint8Array([0, 1, 2, 3, 4, 5, 128, 254, 255])
	, charValue: "λ", usizeValue: 200, isizeValue: 200, ...changes
});

/**
 * Exercise a public wasm32 package without reading generated layouts or expected values.
 *
 * @param api - Installed API, or an explicitly identified caller-oracle test double.
 * @param options - Full/result-only selection and repeated recovery rounds.
 * @param options.resultOnly - Use the constructor-free result-only exports.
 * @param options.rounds - Bound repeated refusal and recovery checks.
 */
export const checkNominalPrimitiveSubtypes = (api, { resultOnly = false, rounds = 256 } = {}) => {
	if(typeof resultOnly !== "boolean" || !Number.isInteger(rounds) || rounds < 1 || rounds > 1000)
		throw new TypeError("Invalid primitive caller options");
	let checks = 0, rejections = 0;
	const check = (condition, label) => { if(!condition) throw new Error(`failed: ${label}`); checks++; };
	const equal = (actual, expected, label) => check(primitiveValueSnapshot(actual) === primitiveValueSnapshot(expected), label);
	const call = (name, args, expected) => {
		const before = primitiveValueSnapshot(args), result = api[name](...args);
		equal(result, expected, name);
		check(primitiveValueSnapshot(args) === before, `${name} caller unchanged`);
		return result;
	};
	const refuse = (name, args, pattern = /failed \(5\)/u) => {
		const before = primitiveValueSnapshot(args);
		let exception;
		try
		{ api[name](...args); }
		catch(error)
		{ exception = error; }
		check(exception instanceof Error && pattern.test(exception.message), `${name} refusal`);
		check(primitiveValueSnapshot(args) === before, `${name} refused caller unchanged`);
		rejections++;
	};
	const some = value => ({ tag: "some", value }), none = { tag: "none" };
	const a = packet(), b = packet({ boolValue: false }), n = normalized(), out = produced();
	const group = [none, some(out)];
	call("wordBits", [], 32);
	call("produce", [out], some(out));
	call("produceGroup", [out], group);
	call("producePair", [out], { left: group, right: group });
	call("produceEvent", [out], { kind: "box", value: out });
	call("produceChoices", [out], { kind: "choices", values: [none, some({ ok: out }), some({ error: out })] });
	const invalid = {
		boolValue: false
		, uint8Value: 43, uint16Value: 43, uint32Value: 43, uint64Value: 43n
		, int8Value: -43, int16Value: -43, int32Value: -43, int64Value: -43n
		, natValue: 43n, intValue: -43n
		, float32Value: Infinity, float64Value: Infinity
		, textValue: "", bytesValue: new Uint8Array(), charValue: "\0"
		, usizeValue: 43, isizeValue: -43
		, digit: 3n
	};
	for(const [name, value] of Object.entries(invalid))
	{
		call("produce", [packet({ [name]: value })], none);
		if(!resultOnly) refuse("echoA", [packet({ [name]: value })], name === "digit" ? /digit must be bigint below 3$/u : /failed \(5\)/u);
	}
	const absent = packet({ natValue: 43n });
	call("produceGroup", [absent], [none]);
	call("producePair", [absent], { left: [none], right: [none] });
	call("produceEvent", [absent], { kind: "empty" });
	call("produceChoices", [absent], { kind: "choices", values: [none] });
	if(resultOnly)
	{
		for(const name of ["echoA", "echoB", "refuseUnit", "combine", "echoPair", "echoEventA", "echoEventB", "aliases"])
			check(!Object.hasOwn(api, name), `result-only omits ${name}`);
		for(let round = 0; round < rounds; round++)
		{
			const value = produced({ natValue: (1n << 100n) + BigInt(round) * 2n });
			call("produce", [value], some(value));
		}
		return { checks, rejections, rounds, wordBits: 32 };
	}
	call("echoA", [a], a); call("echoB", [b], n);
	refuse("refuseUnit", [a]);
	call("combine", [a, b], [a, n]);
	call("echoPair", [{ left: [none, some(a)], right: [some(b)] }], { left: [none, some(a)], right: [some(n)] });
	call("aliases", [[none, some(a)], [some(b), none]], [none, some(a), some(n), none]);
	for(const name of ["echoEventA", "echoEventB"]) call(name, [{ kind: "empty" }], { kind: "empty" });
	call("echoEventA", [{ kind: "box", value: a }], { kind: "box", value: a });
	call("echoEventB", [{ kind: "box", value: b }], { kind: "box", value: n });
	call("echoEventA", [{ kind: "choices", values: [none, some({ ok: a }), some({ error: b })] }], { kind: "choices", values: [none, some({ ok: a }), some({ error: n })] });
	call("echoEventB", [{ kind: "choices", values: [none, some({ ok: b }), some({ error: a })] }], { kind: "choices", values: [none, some({ ok: n }), some({ error: a })] });
	for(const [name, value, expected] of [
		["uint8Value", 254, 0]
		, ["uint16Value", 65534, 0]
		, ["uint32Value", 4294967294, 0]
		, ["uint64Value", 18446744073709551614n, 0n]
		, ["int8Value", 126, -128]
		, ["int16Value", 32766, -32768]
		, ["int32Value", 2147483646, -2147483648]
		, ["int64Value", 9223372036854775806n, -9223372036854775808n]
		, ["usizeValue", 4294967294, 0]
		, ["isizeValue", 2147483646, -2147483648]
		, ["natValue", 1n << 100n, (1n << 100n) + 2n]
		, ["intValue", -(1n << 100n), -(1n << 100n) + 2n]
		, ["float32Value", 0, -0]
		, ["float64Value", 0, -0]
		, ["float32Value", -0, 0]
		, ["float64Value", -0, 0]
		, ["textValue", "a\0λ😀", "a\0λ😀!"]
		, ["bytesValue", new Uint8Array(), new Uint8Array([255])]
		, ["charValue", "😀", "😀"]
	]) call("echoB", [packet({ boolValue: false, [name]: value })], normalized({ [name]: expected }));
	for(const name of ["float32Value", "float64Value"]) for(const value of [NaN, Infinity, -Infinity])
	{
		refuse("echoB", [packet({ boolValue: false, [name]: value })]);
		call("produce", [packet({ [name]: value })], none);
	}
	const copy = call("echoA", [a], a); copy.bytesValue[0] = 17;
	check(a.bytesValue[0] === 0, "output bytes do not alias caller bytes");
	call("echoA", [a], a);
	refuse("combine", [packet({ natValue: 43n }), packet({ boolValue: false, digit: 3n })], /digit must be bigint below 3$/u);
	for(let round = 0; round < rounds; round++)
	{
		const choices = [some(b), none, some(b)]; choices[round % 3] = some(packet({ boolValue: false, natValue: 43n }));
		refuse("echoPair", [{ left: [some(a)], right: choices }]);
		call("echoB", [b], n);
	}
	return { checks, rejections, rounds, wordBits: 32 };
};
