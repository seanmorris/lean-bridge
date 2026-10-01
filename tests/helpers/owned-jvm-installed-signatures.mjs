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
	const start = type.indexOf("<");
	if(start >= 0)
	{
		const children = []; let depth = 0, beginning = start + 1;
		for(let index = beginning; index < type.length - 1; index++)
		{
			if(type[index] === "<") depth++;
			else if(type[index] === ">") depth--;
			else if(type[index] === "," && depth === 0)
			{ children.push(type.slice(beginning, index).trim()); beginning = index + 1; }
		}
		children.push(type.slice(beginning, -1).trim());
		return `${type.slice(0, start)}<${children.map(kotlin).join(", ")}>`;
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
 * @param options.anchoredResults - Check whole owners and mixed original-owner transfers.
 * @param options.receiverExports - Check nominal whole results and argument-anchored members.
 */
export const ownedJvmInstalledSignatures = (scalar, namespace, profile, functions, { transferredInputs = false, anchoredResults = false, receiverExports = false } = {}) => {
	let signatures = anchoredResults ? [
		...callbackFunctions.slice(0, 22).map(([name, result, ...parameters]) => [
			name
			, ["serial", "label", "payload"].includes(name) ? result : `Value<${result}>`
			, ...parameters.map((type, index) => !["newTicket", "serial", "label", "payload"].includes(name) && index === (name === "bundle" ? 2 : 0) ? `Value<${type}>` : type)
		])
		, ["transferTicket", "Value<Ticket>", "Value<Ticket>"]
		, ["mixedTicket", "Value<Ticket>", "Value<Ticket>", "Value<Ticket>"]
		, ["moveRecord", "Value<Bundle>", "Value<Bundle>", "CallbackRecordArgument1ClosureCallback"]
		, ["moveArray", "Value<Ticket[]>", "Value<Ticket[]>"]
	] : transferredInputs ? [
		...callbackFunctions.slice(0, 22)
		, ["newRecordCallback", "CallbackRecordArgument1Closure"]
		, ["transferCallback", "CallbackRecordArgument1Closure", "CallbackRecordArgument1Closure"]
		, ["echoChain", "Chain", "Chain"], ["echoMixed", "Mixed", "Mixed"]
	] : scalar ? scalarFunctions : callbackFunctions;
	const java = profile === "java";
	if(receiverExports)
	{
		assert.ok(anchoredResults);
		const owners = { "Value<Ticket>": "TicketValue", "Value<Bundle>": "BundleValue", "Value<Choice>": "ChoiceValue", "Value<Tree>": "TreeValue" };
		signatures = signatures.map(([name, result, ...parameters]) => [name, owners[result] ?? result, ...parameters]);
		signatures.push(["chooseTicket", "TicketValue", "Ticket", "Value<Ticket>"]);
	}
	assert.deepEqual([...functions].sort(), signatures.map(([name]) => name).sort());
	const literal = type => {
		if(java) return erase(type) + ".class";
		if(type.endsWith("[]")) return literal(type.slice(0, -2)) + ".arrayType()";
		return type === "void" ? "java.lang.Void.TYPE" : kotlin(erase(type)) + "::class.java";
	};
	const qualify = type => type.replace(/\b[A-Z][A-Za-z0-9]*/gu, name =>
		(name === "BigInteger" ? "java.math." : name === "String" ? "java.lang." : namespace + ".") + name);
	const lines = [anchoredResults
		? `Wire.check(${java ? 'java.util.Arrays.stream(Api.class.getDeclaredMethods()).filter(method -> !method.getName().startsWith("copy")).count()' : 'Api::class.java.declaredMethods.count { !it.name.startsWith("copy") }'} == ${signatures.length});`
		: `Wire.check(Api${java ? ".class.getDeclaredMethods().length" : "::class.java.declaredMethods.size"} == ${signatures.length});`];
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
