/**
 * Independently typed Java and Kotlin structured callable consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Combine the public caller and value factory without generating expectations.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmStructuredCallableConsumer = profile => {
	assert.ok(["java", "kotlin"].includes(profile));
	const extension = profile === "java" ? "java" : "kt";
	const read = name => readFileSync(new URL(`../fixtures/structured-callable-consumers/${name}.${extension}`, import.meta.url), "utf8");
	const sources = [read(profile), read(`${profile}-values`)];
	const imports = [...new Set(sources.flatMap(source => source.match(/^import .+$/gm) ?? []))];
	return imports.join("\n") + "\n\n" + sources.map(source => source.replace(/^import .+\n/gm, "")).join("\n");
};

/**
 * Compile and execute the guide's complete example without rewriting its source.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmStructuredCallableExamples = profile => {
	assert.ok(["java", "kotlin"].includes(profile));
	const guide = readFileSync(new URL(`../../docs/consume/${profile}.md`, import.meta.url), "utf8");
	const source = guide.match(new RegExp("### Structured callback values\\n[\\s\\S]*?```" + profile + "\\n([\\s\\S]*?)\\n```", "u"))?.[1];
	assert.ok(source, `${profile} structured example`);
	return [{ id: "structured-callback-example"
		, file: `StructuredExample.${profile === "java" ? "java" : "kt"}`
		, main: "StructuredExample", source: source + "\n"
		, stdout: "copied\nfalse\n2\n" }];
};

/**
 * Source-located compile errors must reject wrong payloads and callback types.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmStructuredCallableRejections = profile => {
	assert.ok(["java", "kotlin"].includes(profile));
	const java = profile === "java";
	const cases = java ? {
		"array-element": 'Api.callArray(new String[] { "wrong" }, value -> value);'
		, "callback-result": 'Api.callArray(null, value -> new String[0]);'
		, "list-container": 'Api.callList(java.util.List.of(), value -> value);'
		, "nested-option": 'Api.callOption(Option.some(Unit.INSTANCE), value -> value);'
		, "result-order": 'Api.callResult(Result.<String[], Option<Long>>ok(new String[0]), value -> value);'
		, "product-nesting": 'Api.callTuple(new Pair<>("text", new byte[0]), value -> value);'
		, "record-identity": 'Api.callRecord(new PacketEmpty(), value -> value);'
		, "variant-payload": 'new PacketPayload(1L, null);'
		, "alias-wrapper": 'new Alias();'
		, "async-result": 'Api.callRecord(null, value -> java.util.concurrent.CompletableFuture.completedFuture(value));'
		, "closure-input": 'Api.makeRecord(null).invoke(true, "wrong");'
		, "closure-result": 'String value = Api.makeRecord(null).invoke(true, null);'
		, "kotlin-record": 'Api.callRecord(org.leanbridge.structured.kotlin.Api.makeRecord(null).invoke(true, null), value -> value);'
	} : {
		"array-element": 'Api.callArray(arrayOf("wrong")) { it }'
		, "callback-result": 'Api.callArray(emptyArray<Option<String>>()) { arrayOf("wrong") }'
		, "list-container": 'Api.callList(listOf<Result<Pair<Long, String>, String>>()) { it }'
		, "nested-option": 'Api.callOption(Option.some(LeanUnit.INSTANCE)) { it }'
		, "result-order": 'Api.callResult(Result.ok<Array<String>, Option<Long>>(emptyArray())) { it }'
		, "product-nesting": 'Api.callTuple(Pair("text", byteArrayOf())) { it }'
		, "record-identity": 'Api.callRecord(PacketEmpty()) { it }'
		, "variant-payload": 'PacketPayload(1L, emptyArray())'
		, "alias-wrapper": 'Alias()'
		, "null-record": 'Api.callRecord(null) { it }'
		, "null-callback": 'Api.callRecord(Payload("", emptyArray(), java.math.BigInteger.ZERO, Option.none()), null)'
		, "closure-input": 'Api.makeRecord(Payload("", emptyArray(), java.math.BigInteger.ZERO, Option.none())).invoke(true, "wrong")'
		, "closure-result": 'val value: String = Api.makeRecord(Payload("", emptyArray(), java.math.BigInteger.ZERO, Option.none())).invoke(true, null); println(value)'
		, "java-record": 'Api.callRecord(org.leanbridge.structured.Payload("", emptyArray(), java.math.BigInteger.ZERO, org.leanbridge.structured.Option.none())) { it }'
		, "async-result": 'Api.callRecord(Payload("", emptyArray(), java.math.BigInteger.ZERO, Option.none())) { java.util.concurrent.CompletableFuture.completedFuture(it) }'
	};
	const diagnostics = java ? {
		"alias-wrapper": "compiler.err.cant.resolve.location"
		, "closure-result": "compiler.err.prob.found.req"
	} : {
		"alias-wrapper": "UNRESOLVED_REFERENCE"
		, "callback-result": ["RETURN_TYPE_MISMATCH", "TYPE_MISMATCH"]
		, "async-result": ["RETURN_TYPE_MISMATCH", "TYPE_MISMATCH"]
		, "null-record": "NULL_FOR_NONNULL_TYPE"
		, "null-callback": "NULL_FOR_NONNULL_TYPE"
		, "closure-result": ["INITIALIZER_TYPE_MISMATCH", "TYPE_MISMATCH"]
	};
	const imports = java ? "import org.leanbridge.structured.*;\nimport org.leanbridge.structured.Unit;\n"
		: "import org.leanbridge.structured.kotlin.*\nimport org.leanbridge.structured.kotlin.Pair\nimport org.leanbridge.structured.Unit as LeanUnit\n";
	return Object.entries(cases).map(([name, expression]) => ({
		id: `structured/${name}`
		, expectation: { kind: "compile-rejection", diagnostic: diagnostics[name] ?? (java ? "compiler.err.cant.apply.symbol" : "ARGUMENT_TYPE_MISMATCH") }
		, source: `${imports}${java ? "class Invalid { static void rejected() {" : "fun rejected() {"}\n${expression}\n}${java ? " }" : ""}\n`
	}));
};

/**
 * Normalize independently authored signatures without backend type lowering.
 *
 * @param ir - Compiler-owned or independently reviewed binding IR.
 */
export const jvmStructuredCallableSignatures = ir => {
	const type = ref => {
		if(ref.kind === "primitive") return ref;
		if(ref.kind === "apply") return { constructor: ref.constructor, arguments: ref.arguments.map(type) };
		const definition = ir.types.find(item => item.id === ref.id); assert.ok(definition, ref.id);
		if(definition.kind === "alias") return type(definition.target);
		if(definition.kind === "record") return { record: definition.fields.map(field => ({ name: field.name, type: type(field.type) })) };
		if(definition.kind === "variant") return { variant: definition.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(field => ({ name: field.name, type: type(field.type) })) })) };
		assert.equal(definition.kind, "callback");
		return { callback: { parameters: definition.callable.parameters.map(site), result: site(definition.callable.result) } };
	};
	const site = value => ({ type: type(value.type), ownership: value.ownership, lifetime: value.lifetime });
	return ir.declarations.map(declaration => ({ id: declaration.id, parameters: declaration.parameters.map(site), result: site(declaration.result) })).sort((a, b) => a.id.localeCompare(b.id));
};
