/**
 * Independent caller-oracle tests only. No installed runtime or generated adapter executes here.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { primitiveValueSnapshot as snapshot, checkNominalPrimitiveSubtypes } from "../fixtures/nominal-primitive-subtype-consumers/javascript.mjs";

const some = value => ({ tag: "some", value }), none = { tag: "none" };
const numbers = ["uint8Value", "uint16Value", "uint32Value", "uint64Value", "int8Value", "int16Value", "int32Value", "int64Value", "natValue", "intValue", "usizeValue", "isizeValue"];
const outputValid = value => value.boolValue === true && numbers.every(name => value[name] % (typeof value[name] === "bigint" ? 2n : 2) === (typeof value[name] === "bigint" ? 0n : 0))
	&& Number.isFinite(value.float32Value) && Number.isFinite(value.float64Value) && [...value.textValue].length > 0
	&& value.bytesValue.length > 0 && value.charValue !== "\0" && value.digit < 3n;
const constructorFailure = () => { throw new Error("Lean call failed (5)"); };
const checkFin = value => {
	if(value && typeof value === "object")
	{
		if(Object.hasOwn(value, "digit") && value.digit >= 3n) throw new TypeError("call.arg0.digit must be bigint below 3");
		if(!(value instanceof Uint8Array)) for(const item of Object.values(value)) checkFin(item);
	}
};
const convert = (value, choice) => {
	checkFin(value);
	const result = structuredClone(value);
	if(choice === "A")
	{
		if(!numbers.every(name => value[name] < (typeof value[name] === "bigint" ? 100n : 100)) || value.float32Value >= 10 || value.float64Value >= 10
			|| [...value.textValue].length >= 8 || value.bytesValue.length >= 8 || value.charValue.codePointAt(0) >= 128) constructorFailure();
	}
	else
	{
		result.boolValue = !value.boolValue;
		for(const name of numbers)
		{
			if(name === "natValue" || name === "intValue") result[name] += 2n;
			else
			{
				const signed = name.startsWith("int") || name === "isizeValue";
				const bits = Number(name.match(/\d+/u)?.[0] ?? 32);
				const adjusted = (signed ? BigInt.asIntN : BigInt.asUintN)(bits, BigInt(value[name]) + 2n);
				result[name] = bits === 64 ? adjusted : Number(adjusted);
			}
		}
		result.float32Value = Math.fround(-value.float32Value); result.float64Value = -value.float64Value;
		result.textValue += "!"; result.bytesValue = Uint8Array.from([...value.bytesValue, 255]);
		result.charValue = value.charValue === "a" ? "b" : value.charValue;
	}
	if(!outputValid(result)) constructorFailure();
	return result;
};
const mapGroup = (values, choice) => values.map(item => item.tag === "none" ? none : some(convert(item.value, choice)));
const event = (value, first, second) => {
	checkFin(value);
	if(value.kind === "empty") return { kind: "empty" };
	if(value.kind === "box") return { kind: "box", value: convert(value.value, first) };
	return { kind: "choices"
		, values: value.values.map(item => item.tag === "none" ? none : some(Object.hasOwn(item.value, "ok")
			? { ok: convert(item.value.ok, first) } : { error: convert(item.value.error, second) })) };
};
const oracle = (resultOnly = false) => {
	const produce = value => outputValid(value) ? some(structuredClone(value)) : none;
	const produceGroup = value => outputValid(value) ? [none, produce(value)] : [none];
	return {
		wordBits: () => 32, produce, produceGroup
		, producePair: value => ({ left: produceGroup(value), right: produceGroup(value) })
		, produceEvent: value => outputValid(value) ? { kind: "box", value: structuredClone(value) } : { kind: "empty" }
		, produceChoices: value => ({ kind: "choices", values: outputValid(value) ? [none, some({ ok: structuredClone(value) }), some({ error: structuredClone(value) })] : [none] })
		, ...resultOnly ? {} : {
			echoA: value => convert(value, "A")
			, echoB: value => convert(value, "B")
			, refuseUnit: constructorFailure
			, combine: (a, b) => { checkFin([a, b]); return [convert(a, "A"), convert(b, "B")]; }
			, echoPair: value => { checkFin(value); return { left: mapGroup(value.left, "A"), right: mapGroup(value.right, "B") }; }
			, aliases: (a, b) => { checkFin([a, b]); return [...mapGroup(a, "A"), ...mapGroup(b, "B")]; }
			, echoEventA: value => event(value, "A", "B")
			, echoEventB: value => event(value, "B", "A")
		}
	};
};

test("primitive snapshots preserve public-value distinctions without invoking accessors", () => {
	for(const [a, b] of [[undefined, null], [{ unitValue: undefined }, {}], [0, -0], [42, 42n], [new Uint8Array([0, 128, 255]), [0, 128, 255]], [new Uint8Array([0]), new Uint8Array([1])], ["a\0λ😀", "aλ😀"], [Array(1), [undefined]]])
		assert.notEqual(snapshot(a), snapshot(b));
	const shared = new Uint8Array([0, 128, 255]); assert.equal(snapshot([shared, shared]), snapshot([shared.slice(), shared.slice()]));
	let reads = 0; const value = {}; Object.defineProperty(value, "data", { get: () => { reads++; return 1; }, enumerable: true });
	assert.throws(() => snapshot(value), /accessor/u); assert.equal(reads, 0);
	for(const value of [Object.create(Uint8Array.prototype), new Uint16Array([1]), new Date(), { [Symbol("x")]: 1 }]) assert.throws(() => snapshot(value));
});

test("primitive caller exercises its independent full and result-only oracle", () => {
	for(const resultOnly of [false, true])
	{
		const report = checkNominalPrimitiveSubtypes(oracle(resultOnly), { resultOnly });
		assert.deepEqual(report, { checks: resultOnly ? 578 : 1213, rejections: resultOnly ? 0 : 283, rounds: 256, wordBits: 32 });
	}
});

test("primitive caller rejects changed fields and wrong result-only exports", () => {
	const original = oracle();
	const fields = ["unitValue", "boolValue", ...numbers, "float32Value", "float64Value", "textValue", "bytesValue", "charValue", "digit"];
	for(const field of fields)
	{
		const mutated = { ...original, echoA: value => {
			const result = original.echoA(value); delete result[field]; return result;
		} };
		assert.throws(() => checkNominalPrimitiveSubtypes(mutated, { rounds: 1 }), /failed: echoA/u, field);
	}
	assert.throws(() => checkNominalPrimitiveSubtypes({ ...oracle(), wordBits: () => 64 }, { rounds: 1 }), /wordBits/u);
	assert.throws(() => checkNominalPrimitiveSubtypes({ ...oracle(true), echoA: value => value }, { resultOnly: true, rounds: 1 }), /result-only omits/u);
	assert.throws(() => checkNominalPrimitiveSubtypes({ ...oracle(), refuseUnit: value => value }, { rounds: 1 }), /refuseUnit refusal/u);
});

test("primitive caller detects normalization, active-branch, caller-mutation and result-policy regressions", () => {
	const cases = [
		["normalization bypass", original => ({ ...original, echoB: value => structuredClone(value) })]
		, ["constructor site swap", original => ({ ...original, echoA: value => original.echoB(value) })]
		, ["result-only policy borrowed from inputs"
			, original => ({ ...original, produce: value => {
				try
				{ return some(convert(value, "A")); }
				catch
				{ return none; }
			} })
		]
		, ["option branch lost", original => ({ ...original, produceGroup: value => original.produceGroup(value).filter(item => item.tag === "some") })]
		, ["error branch lost", original => ({ ...original, produceChoices: value => {
			const result = original.produceChoices(value);
			result.values = result.values.filter(item => item.tag === "none" || Object.hasOwn(item.value, "ok"));
			return result;
		} })]
		, ["input mutation", original => ({ ...original, echoA: value => {
			const result = original.echoA(value); value.bytesValue[0] ^= 1; return result;
		} })]
		, ["output byte alias", original => ({ ...original, echoA: value => {
			const result = original.echoA(value); result.bytesValue = value.bytesValue; return result;
		} })]
		, ["late rejection swallowed"
			, original => ({ ...original, echoPair: value => {
				try
				{ return original.echoPair(value); }
				catch
				{ return structuredClone(value); }
			} })
		]
		, ["wide integer representation lost"
			, original => ({ ...original, echoA: value => {
				const result = original.echoA(value); result.uint64Value = Number(result.uint64Value); return result;
			} })
		]
	];
	for(const [label, mutate] of cases)
		assert.throws(() => checkNominalPrimitiveSubtypes(mutate(oracle()), { rounds: 1 }), undefined, label);
});
