/**
 * Shared capability and wire contract for ordinary pure component calls.
 *
 * @file
 */
export const componentScalarAbi = 2;
export const componentScalarTypes = Object.freeze([
	"unit", "bool", "uint8", "uint16", "uint32", "uint64"
	, "int8", "int16", "int32", "int64", "nat", "int"
	, "float32", "float64", "string", "bytes"
]);
export const scalarFrameHeaderBytes = 32;
export const scalarSlotBytes = 16;
export const scalarCopyLimit = 16 * 1024 * 1024;

/**
 * Returns the unsupported part of a signature, or null for a pure primitive call.
 *
 * @param declaration - Public Binding IR declaration or private scalar signature.
 */
export const componentSignatureProblem = declaration => {
	if(declaration.kind !== undefined && declaration.kind !== "function") return "declaration kind";
	if(declaration.resultMode !== "value") return "asynchronous result";
	const parameters = declaration.parameters.map(item => item.type ?? item);
	const result = declaration.result?.type ?? declaration.result;
	for(const [index, type] of [...parameters, result].entries())
	{
		if(type?.kind !== "primitive" || !componentScalarTypes.includes(type.name))
			return index === parameters.length ? "result type" : `parameter ${index + 1}`;
	}
	return null;
};

/**
 * Rejects signatures before a compiled component or runtime can accept them.
 *
 * @param declaration - Public Binding IR declaration or private scalar signature.
 */
export const assertComponentSignature = declaration => {
	const problem = componentSignatureProblem(declaration);
	if(problem === null) return;
	const error = new TypeError(`${declaration.id ?? declaration.bindingId}: unsupported component ${problem}; ordinary components require pure primitive signatures`);
	error.code = "unsupported-component-signature";
	throw error;
};

/**
 * Validates host values without narrowing them.
 *
 * @param type - Primitive type name from the shared scalar capability contract.
 * @param value - Host value checked before crossing the component boundary.
 */
export const validateComponentScalar = (type, value) => {
	const invalid = () => { throw new TypeError(`Expected ${type}`); };
	if(type === "unit")
	{ if(value !== undefined) invalid(); }
	else if(type === "bool")
	{ if(typeof value !== "boolean") invalid(); }
	else if(type === "nat" || type === "int")
	{
		if(typeof value !== "bigint" || (type === "nat" && value < 0n)) invalid();
	}
	else if(/^(?:u?int)(?:8|16|32|64)$/.test(type))
	{
		const bits = Number(type.match(/\d+$/)[0]);
		const signed = type.startsWith("int");
		if(bits === 64 ? typeof value !== "bigint" : !Number.isInteger(value)) invalid();
		const integer = BigInt(value);
		const minimum = signed ? -(1n << BigInt(bits - 1)) : 0n;
		const maximum = (1n << BigInt(bits - (signed ? 1 : 0))) - 1n;
		if(integer < minimum || integer > maximum) throw new RangeError(`${type} is out of range`);
	}
	else if(type === "float32" || type === "float64")
	{ if(typeof value !== "number") invalid(); }
	else if(type === "string")
	{
		if(typeof value !== "string") invalid();
		for(const character of value)
		{
			const point = character.codePointAt(0);
			if(point >= 0xd800 && point <= 0xdfff) throw new TypeError("String contains an unpaired UTF-16 surrogate");
		}
	}
	else if(type === "bytes")
	{ if(!(value instanceof Uint8Array)) invalid(); }
	else invalid();
	return value;
};
