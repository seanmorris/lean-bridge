/**
 * Independent Java/Kotlin public signatures, constructor names and rejections.
 *
 * @file
 */
import { readFileSync } from "node:fs";

const methods = [
	["echo", "Signal", "Signal"], ["echoMode", "Mode", "Mode"]
	, ["echoNested", "Nested", "Nested"], ["echoScalars", "Scalars", "Scalars"]
	, ["echoAnonymous", "Anonymous", "Anonymous"], ["echoOne", "One", "One"]
	, ["echoBuffers", "Buffers", "Buffers"]
	, ["signals", "Signal[][]", "Signal[][]"]
	, ["next", "Signal", "Signal"], ["code", "long", "Signal"]
	, ["make", "Signal", "long"], ["inspect", "boolean", "Scalars"]
	, ["duplicate", "Buffers", "byte[]"], ["produce", "Buffers", "BigInteger"]
];
const families = {
	Signal: ["Idle", "Stopped", "Data", "Marker"]
	, Mode: ["First", "Second", "Third"]
	, Nested: ["Empty", "Packet", "Outcome"], Scalars: ["Absent", "All"]
	, Anonymous: ["Number", "Pair", "Collision"], One: ["Only"]
	, Buffers: ["Empty", "Pair"]
};
const fields = {
	SignalData: ["count:long", "label:String"], SignalMarker: ["value:Unit"]
	, NestedPacket: ["value:Packet"], NestedOutcome: ["value:Result"]
	, ScalarsAll: ["unit:Unit", "bool:boolean", "u8:int", "u16:int", "u32:long", "u64:BigInteger", "i8:byte", "i16:short", "i32:int", "i64:long", "natural:BigInteger", "integer:BigInteger", "f32:float", "f64:double", "text:String", "bytes:byte[]", "char_:int", "word:BigInteger", "signedWord:long"]
	, AnonymousNumber: ["arg0:long"], AnonymousPair: ["arg0:long", "arg1:String"]
	, AnonymousCollision: ["arg1:long", "arg1_:String"], OneOnly: ["value:long"]
	, BuffersPair: ["first:byte[]", "second:byte[]"]
};
const typeClass = (name, java) => java ? `${name}.class` : name === "Signal[][]" ? "arrayOf(emptyArray<Signal>()).javaClass"
	: `${({ long: "Long", boolean: "Boolean", int: "Int", byte: "Byte", short: "Short", float: "Float", double: "Double", "byte[]": "ByteArray" })[name] ?? name}::class.java`;

/**
 * Source-local typed public methods and permitted constructor records.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmVariantPublicChecks = profile => {
	const java = profile === "java", cls = name => typeClass(name, java), lines = [];
	for(const [name, result, parameter] of methods)
		lines.push(`    Wire.method(${cls("Api")}, "${name}", ${cls(result)}, ${cls(parameter)})${java ? ";" : ""}`);
	for(const [family, cases] of Object.entries(families))
	{
		lines.push(java
			? `    check(${family}.class.isSealed() && ${family}.class.isInterface());\n    check(Arrays.equals(${family}.class.getPermittedSubclasses(), new Class<?>[] {${cases.map(name => cls(family + name)).join(", ")}}));`
			: `    verify(${cls(family)}.isSealed && ${cls(family)}.isInterface)\n    verify(${cls(family)}.permittedSubclasses.contentEquals(arrayOf(${cases.map(name => cls(family + name)).join(", ")})))`);
		for(const branch of cases)
		{
			const name = family + branch, components = (fields[name] ?? []).map(field => field.split(":"));
			lines.push(`    Wire.record(${cls(name)}, ${java ? "new String[] {" : "arrayOf<String>("}${components.map(([field]) => JSON.stringify(field)).join(", ")}${java ? "}" : ")"}, ${java ? "new Class<?>[] {" : "arrayOf<Class<*>>("}${components.map(([, type]) => cls(type)).join(", ")}${java ? "});" : "))"}`);
		}
	}
	return lines.join("\n");
};

/**
 * Return the independently written Java or Kotlin consumer.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmVariantConsumer = profile => readFileSync(new URL(`../fixtures/variant-consumers/${profile === "java" ? "java.java" : "kotlin.kt"}`, import.meta.url), "utf8")
	.replace("/* SIGNATURES */", jvmVariantPublicChecks(profile));

/**
 * Invalid consumers must fail at their own source with the intended diagnostic.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmVariantRejections = profile => {
	const java = profile === "java";
	const cases = JSON.parse(readFileSync(new URL("../fixtures/variant-consumers/jvm-invalid.json", import.meta.url)));
	return cases.map(entry => ({ id: `variants/${entry.name}`
		, expectation: { kind: "compile-rejection", diagnostic: entry[profile].diagnostic }
		, source: `import org.leanbridge.variants.*;\n${entry[profile].declaration ?? `${java ? "class Invalid { static void rejected() {" : "fun rejected() {"}\n${entry[profile].statement}\n}${java ? " }" : ""}`}\n` }));
};
