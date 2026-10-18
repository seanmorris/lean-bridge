/**
 * Supplemental public caller for installed primitive-base nominal Subtype packages.
 * It adds only the strict-constructor and variant-refusal cases that the original
 * javascript.mjs caller does not exercise, and leaves that caller and its counts unchanged.
 * Expected values do not read generated metadata, adapter code or runtime output.
 *
 * @file
 */
import { primitiveValueSnapshot } from "./javascript.mjs";

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

/**
 * Seventeen values that each Subtype predicate admits but the stricter input constructor A
 * refuses: even integers at 100, a finite 12.5, eight-character text, eight bytes and a
 * non-ASCII Char. Unit and Bool have no stricter A policy.
 */
export const nominalPrimitiveSupplementStrictValues = Object.freeze([
	["uint8Value", 100], ["uint16Value", 100], ["uint32Value", 100]
	, ["uint64Value", 100n], ["int8Value", 100], ["int16Value", 100]
	, ["int32Value", 100], ["int64Value", 100n], ["natValue", 100n]
	, ["intValue", 100n], ["float32Value", 12.5], ["float64Value", 12.5]
	, ["textValue", "long λ text"], ["charValue", "λ"]
	, ["bytesValue", () => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])]
	, ["usizeValue", 100], ["isizeValue", 100]
].map(Object.freeze));

/**
 * Exercise the supplemental full-API cases on one installed package.
 *
 * @param api - Installed full API, or an explicitly identified caller-oracle test double.
 */
export const checkNominalPrimitiveSupplement = api => {
	let checks = 0, rejections = 0;
	const check = (condition, label) => { if(!condition) throw new Error(`failed: ${label}`); checks++; };
	const equal = (actual, expected, label) => check(primitiveValueSnapshot(actual) === primitiveValueSnapshot(expected), label);
	const call = (name, args, expected) => {
		const before = primitiveValueSnapshot(args), result = api[name](...args);
		equal(result, expected, name);
		check(primitiveValueSnapshot(args) === before, `${name} caller unchanged`);
	};
	const refuse = (name, args, label) => {
		const before = primitiveValueSnapshot(args);
		let exception;
		try
		{ api[name](...args); }
		catch(error)
		{ exception = error; }
		check(exception instanceof Error && /failed \(5\)/u.test(exception.message), `${label} refusal`);
		check(primitiveValueSnapshot(args) === before, `${label} refused caller unchanged`);
		rejections++;
	};
	const some = value => ({ tag: "some", value }), none = { tag: "none" };
	const a = packet(), b = packet({ boolValue: false }), n = normalized();
	for(const [field, raw] of nominalPrimitiveSupplementStrictValues)
	{
		const value = () => typeof raw === "function" ? raw() : raw;
		// The weaker output predicate admits the raw value; constructor A refuses the same input.
		call("produce", [packet({ [field]: value() })], some(packet({ [field]: value() })));
		refuse("echoA", [packet({ [field]: value() })], `echoA strict ${field}`);
		call("echoA", [a], a);
	}
	for(const [name, first, last, firstOutput, lastOutput] of [
		["echoEventA", a, b, a, n], ["echoEventB", b, a, n, a]
	]) {
		const invalid = selected => packet({ boolValue: selected.boolValue, natValue: 43n });
		refuse(name, [{ kind: "box", value: invalid(first) }], `${name} box`);
		call(name, [{ kind: "box", value: first }], { kind: "box", value: firstOutput });
		for(const branch of ["ok", "error"])
		{
			const values = [none, some({ ok: first }), some({ error: last })];
			values[branch === "ok" ? 1 : 2] = some({ [branch]: invalid(branch === "ok" ? first : last) });
			refuse(name, [{ kind: "choices", values }], `${name} choices ${branch}`);
			call(name, [{ kind: "choices", values: [none, some({ ok: first }), some({ error: last })] }]
				, { kind: "choices", values: [none, some({ ok: firstOutput }), some({ error: lastOutput })] });
		}
	}
	return { checks, rejections, strictValues: nominalPrimitiveSupplementStrictValues.length, variantRefusals: 6 };
};
