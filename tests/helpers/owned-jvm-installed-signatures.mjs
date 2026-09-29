/**
 * Public signatures authored from the two Lean fixtures, not generated sources.
 *
 * @file
 */
import assert from "node:assert/strict";

const scalarFunctions = [
	["newTicket", "Ticket", "BigInteger", "String"]
	, ["echo", "Packet", "Packet"], ["makePacket", "Packet", "Ticket"]
	, ["inspect", "boolean", "Packet"], ["optionCase", "int", "Packet"]
	, ["bits32", "long", "Packet"], ["bits64", "BigInteger", "Packet"]
	, ["units", "Unit[]", "Unit[]"]
];
const result = "Result<Bundle, Ticket>", pair = "Pair<Ticket, Pair<Option<Ticket>, Payload>>";
const callbackFunctions = [
	["newTicket", "Ticket", "BigInteger", "String"]
	, ["serial", "BigInteger", "Ticket"]
	, ["label", "String", "Ticket"], ["retainTicket", "Ticket", "Ticket"]
	, ["bundle", "Bundle", "Ticket", "Option<Ticket>", "Ticket[]", "Ticket[]", "Payload"]
	, ["primary", "Ticket", "Bundle"], ["payload", "Payload", "Bundle"]
	, ["echoArray", "Ticket[]", "Ticket[]"], ["echoList", "Ticket[]", "Ticket[]"]
	, ["echoOption", "Option<Ticket>", "Option<Ticket>"]
	, ["echoResult", result, result]
	, ["echoTuple", pair, pair], ["echoRecord", "Bundle", "Bundle"]
	, ["echoVariant", "Choice", "Choice"], ["echoAlias", "Bundle", "Bundle"]
	, ["echoRow", "Option<Ticket>[]", "Option<Ticket>[]"]
	, ["echoRecursive", "Tree", "Tree"]
	, ["echoNested", `Option<${result}>[][]`, `Option<${result}>[][]`]
	, ["callbackRecord", "Bundle", "Bundle", "CallbackRecordArgument1ClosureCallback"]
	, ["callbackRecursive", "Tree", "Tree", "CallbackRecursiveArgument1ClosureCallback"]
	, ["makeRecord", "MakeRecordResultClosure", "Bundle"]
	, ["makeRecursive", "MakeRecursiveResultClosure", "Tree"]
	, ["identityClosure", "CallbackRecordArgument1Closure", "Unit"]
	, ["twice", "Bundle", "Bundle", "CallbackRecordArgument1ClosureCallback"]
	, ["repeatedly", "Bundle", "Bundle", "CallbackRecordArgument1ClosureCallback", "BigInteger"]
	, ["retainCallback", "CallbackRecordArgument1Closure", "CallbackRecordArgument1ClosureCallback"]
	, ["factory", "Ticket", "FactoryArgument0ClosureCallback"]
	, ["construct", "Bundle", "Ticket", "ConstructArgument1ClosureCallback"]
	, ["echoChain", "Chain", "Chain"], ["echoMixed", "Mixed", "Mixed"]
	, ["dispatch", "DispatchResultClosure", "Bundle"]
	, ["withFunction", "Bundle", "Bundle", "WithFunctionArgument1ClosureCallback"]
	, ...[
		["Unit", "Unit"], ["Bool", "boolean"], ["Char", "int"]
		, ["Nat", "BigInteger"], ["Int", "BigInteger"]
		, ["U8", "int"], ["U16", "int"], ["U32", "long"], ["U64", "BigInteger"]
		, ["I8", "byte"], ["I16", "short"], ["I32", "int"], ["I64", "long"]
		, ["Usize", "BigInteger"], ["Isize", "long"]
		, ["F32", "float"], ["F64", "double"]
		, ["String", "String"], ["Bytes", "byte[]"]
	].map(([name, type]) => [`via${name}`, name === "Unit" ? "void" : type, `Via${name}Argument0ClosureCallback`, type])
];
const kotlinPrimitives = { boolean: "Boolean", byte: "Byte"
	, short: "Short", int: "Int"
	, long: "Long", float: "Float", double: "Double", void: "kotlin.Unit" };
const erase = type => {
	let depth = 0, result = "";
	for(const char of type)
	{
		if(char === "<") depth++;
		else if(char === ">") depth--;
		else if(!depth) result += char;
	}
	assert.equal(depth, 0);
	return result;
};
const kotlin = type => {
	if(type.endsWith("[]"))
	{
		const item = type.slice(0, -2);
		return Object.hasOwn(kotlinPrimitives, item) ? kotlinPrimitives[item] + "Array" : `Array<${kotlin(item)}>`;
	}
	return type.replace(/\b(?:boolean|byte|short|int|long|float|double|void)\b/gu, name => kotlinPrimitives[name]);
};

/**
 * Assert every public method and Kotlin function reference without loading Lean.
 *
 * @param scalar - Select the scalar-packet fixture.
 * @param namespace - Installed package namespace.
 * @param profile - Java or Kotlin.
 * @param functions - Names selected by the author, checked against this catalog.
 * @param options - Select the consuming-input fixture.
 * @param options.transferredInputs - Include the two closure transfers and mixed values.
 */
export const ownedJvmInstalledSignatures = (scalar, namespace, profile, functions, { transferredInputs = false } = {}) => {
	const signatures = transferredInputs ? [
			...callbackFunctions.slice(0, 22)
			, ["newRecordCallback", "CallbackRecordArgument1Closure"]
			, ["transferCallback", "CallbackRecordArgument1Closure", "CallbackRecordArgument1Closure"]
			, ["echoChain", "Chain", "Chain"], ["echoMixed", "Mixed", "Mixed"]
	] : scalar ? scalarFunctions : callbackFunctions, java = profile === "java";
	assert.deepEqual([...functions].sort(), signatures.map(([name]) => name).sort());
	const literal = type => {
		if(java) return erase(type) + ".class";
		if(type.endsWith("[]")) return literal(type.slice(0, -2)) + ".arrayType()";
		return type === "void" ? "java.lang.Void.TYPE" : kotlin(erase(type)) + "::class.java";
	};
	const qualify = type => type.replace(/\b[A-Z][A-Za-z0-9]*/gu, name =>
		(name === "BigInteger" ? "java.math." : name === "String" ? "java.lang." : namespace + ".") + name);
	const lines = [`Wire.check(Api${java ? ".class.getDeclaredMethods().length" : "::class.java.declaredMethods.size"} == ${signatures.length});`];
	for(const [index, [name, result, ...parameters]] of signatures.entries())
	{
		lines.push(`Wire.method(Api${java ? ".class" : "::class.java"}, "${name}", ${[result, ...parameters].map(literal).join(", ")});`);
		if(java)
		{
			lines.push(`var method${index} = Api.class.getDeclaredMethod("${name}"${parameters.map(type => ", " + literal(type)).join("")});`
				, `Wire.check(method${index}.getGenericReturnType().getTypeName().equals("${qualify(result)}"));`
				, `Wire.check(java.util.Arrays.equals(java.util.Arrays.stream(method${index}.getGenericParameterTypes()).map(java.lang.reflect.Type::getTypeName).toArray(String[]::new), new String[] {${parameters.map(type => JSON.stringify(qualify(type))).join(", ")}}));`);
		}
		else lines.push(`val signature${index}: (${parameters.map(kotlin).join(", ")}) -> ${kotlin(result)} = Api::${name}`
			, `Wire.consume(signature${index})`);
	}
	lines.push(`Wire.result("owned/signatures", Wire.integer(${signatures.length}), false);`);
	return lines.join("\n");
};
