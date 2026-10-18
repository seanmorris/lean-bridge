/**
 * Caller-oracle tests for the supplemental strict-constructor and variant-refusal cases.
 * No installed runtime or generated adapter executes here.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import {
	checkNominalPrimitiveSupplement
	, nominalPrimitiveSupplementStrictValues
} from "../fixtures/nominal-primitive-subtype-consumers/javascript-supplement.mjs";

const some = value => ({ tag: "some", value }), none = { tag: "none" };
const numbers = [
	"uint8Value", "uint16Value", "uint32Value", "uint64Value"
	, "int8Value", "int16Value", "int32Value", "int64Value"
	, "natValue", "intValue", "usizeValue", "isizeValue"
];
const even = value => value % (typeof value === "bigint" ? 2n : 2) === (typeof value === "bigint" ? 0n : 0);
// Mirrors the Subtype predicates in NominalPrimitiveSubtypes.lean.
const outputValid = value => value.boolValue === true && numbers.every(name => even(value[name]))
	&& Number.isFinite(value.float32Value) && Number.isFinite(value.float64Value)
	&& [...value.textValue].length > 0 && value.bytesValue.length > 0 && value.charValue !== "\0";
const failure = () => { throw new Error("Lean call failed (5)"); };
// Mirrors the stricter A input policy and the normalizing B constructors.
const convert = (value, choice) => {
	const result = structuredClone(value);
	if(choice === "A")
	{
		if(!numbers.every(name => value[name] < (typeof value[name] === "bigint" ? 100n : 100))
			|| value.float32Value >= 10 || value.float64Value >= 10 || [...value.textValue].length >= 8
			|| value.bytesValue.length >= 8 || value.charValue.codePointAt(0) >= 128) failure();
	}
	else
	{
		result.boolValue = !value.boolValue;
		for(const name of numbers) result[name] = value[name] + (typeof value[name] === "bigint" ? 2n : 2);
		result.float32Value = -value.float32Value; result.float64Value = -value.float64Value;
		result.textValue += "!"; result.bytesValue = Uint8Array.from([...value.bytesValue, 255]);
		result.charValue = value.charValue === "a" ? "b" : value.charValue;
	}
	if(!outputValid(result)) failure();
	return result;
};
const branch = (item, first, second) => item.tag === "none" ? none
	: some(Object.hasOwn(item.value, "ok")
		? { ok: convert(item.value.ok, first) }
		: { error: convert(item.value.error, second) });
const event = (value, first, second) => value.kind === "box"
	? { kind: "box", value: convert(value.value, first) }
	: { kind: "choices", values: value.values.map(item => branch(item, first, second)) };
const oracle = () => ({
	produce: value => outputValid(value) ? some(structuredClone(value)) : none
	, echoA: value => convert(value, "A")
	, echoEventA: value => event(value, "A", "B")
	, echoEventB: value => event(value, "B", "A")
});

test("supplemental primitive caller covers seventeen strict values and six variant refusals", () => {
	assert.equal(nominalPrimitiveSupplementStrictValues.length, 17);
	assert.deepEqual(checkNominalPrimitiveSupplement(oracle())
		, { checks: 17 * 6 + 2 * 3 * 4, rejections: 17 + 6, strictValues: 17, variantRefusals: 6 });
});

const relaxedInput = api => ({ ...api, echoA: value => structuredClone(value) });
const strictResult = api => ({
	...api
	, produce: value => {
		try
		{ return some(convert(value, "A")); }
		catch
		{ return none; }
	}
});
const uncheckedBox = api => ({
	...api
	, echoEventA: value => value.kind === "box" ? structuredClone(value) : api.echoEventA(value)
});
const swappedError = api => ({ ...api, echoEventB: value => event(value, "B", "B") });
const skippedOk = api => ({
	...api
	, echoEventA: value => value.kind !== "choices" ? api.echoEventA(value) : {
		kind: "choices"
		, values: value.values.map(item => item.tag === "some" && Object.hasOwn(item.value, "ok")
			? structuredClone(item) : branch(item, "A", "B"))
	}
});
const mutatingRefusal = api => ({
	...api
	, echoA: value => {
		if(value.natValue >= 100n)
		{ value.natValue = 0n; failure(); }
		return api.echoA(value);
	}
});

test("supplemental primitive caller detects relaxed constructors, strict outputs and branch swaps", () => {
	const original = oracle();
	for(const [mutate, pattern] of [
		[relaxedInput, /echoA strict uint8Value refusal/u]
		, [strictResult, /failed: produce/u]
		, [uncheckedBox, /echoEventA box refusal/u]
		, [swappedError, /failed/u]
		, [skippedOk, /echoEventA choices ok refusal/u]
		, [mutatingRefusal, /refused caller unchanged/u]
	]) assert.throws(() => checkNominalPrimitiveSupplement(mutate(original)), pattern, mutate.name);
});

test("supplemental Python caller agrees with the shared caller oracle on both routes", () => {
	// The oracle double is the existing standalone model; no Lean or installed package runs.
	const python = process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3";
	const model = resolve("tests/helpers/nominal-primitive-subtype-python-supplement-model.py");
	const caller = resolve("tests/fixtures/nominal-primitive-subtype-consumers/python-supplement.py");
	const output = execFileSync(python, ["-I", "-B", model, caller], { encoding: "utf8", env: {} });
	const result = JSON.parse(output);
	assert.equal(result.installedAcceptance, false);
	const counts = { checks: 126, rejections: 23, strictValues: 17, variantRefusals: 6 };
	assert.deepEqual(result.results, ["arg", "value"]
		.map(parameterPrefix => ({ ...counts, parameterPrefix })));
	const mutations = ["relaxed-input", "strict-result", "unchecked-box", "wrong-constructor"];
	assert.deepEqual(result.rejectedMutations, mutations);
});
