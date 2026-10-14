/**
 * Independent primitive-base caller model. This is not generated or installed Lean.
 *
 * @file
 */
const numbers = ["uint8Value", "uint16Value", "uint32Value", "uint64Value", "int8Value", "int16Value", "int32Value", "int64Value", "natValue", "intValue", "usizeValue", "isizeValue"];
const some = value => ({ tag: "some", value }), none = { tag: "none" };
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
/**
 * Independent hand-written normalization and carrier model for caller controls.
 *
 * @param resultOnly - Omit every input constructor and checked input export.
 */
export const nominalPrimitiveSubtypeCallerModel = (resultOnly = false) => {
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
