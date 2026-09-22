/**
 * Constructor facts come from Lean; these tests do not establish installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel, sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { reconcileReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { componentScalarTypes } from "../src/abi/component-scalars.mjs";
import { validateCopiedMetadataGraph } from "../src/analyze/copied-metadata-graph.mjs";
import { componentRecursiveTypeGraph } from "../src/build/component-recursive-types.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { checkRecursiveCarriers, recursiveCarrierAbi } from "./helpers/recursive-carriers.mjs";
import { assertComponentRecursiveAbi, assertComponentRecursiveBindings } from "../src/abi/component-recursive-abi.mjs";
import { componentRecursiveTypes } from "../src/build/component-recursive-lean.mjs";
import { generateComponentRecursiveAdapters } from "../src/build/component-recursive-adapters.mjs";

const component = { id: "shapes@1.0.0", name: "shapes", version: "1.0.0" };
const enabled = process.env.LEAN_BRIDGE_ELABORATED_METADATA_TEST === "1";
const lower = (metadata, request, include) => createElaboratedSemanticModel({
	metadata, request
	, component, include
	, elaborationSha256: sha256(canonicalJson(metadata)) }).document;
const expected = [
	["idle", []], ["stopped", []]
	, ["data", [["count", "uint32"], ["label", "string"]]]
	, ["marker", [["value", "unit"]]]
];
const constructors = type => type.cases.map(item => [item.name, item.fields.map(field => [field.name, field.type.name])]);
const review = () => {
	const ir = corpusReviewedIr({ id: "shapes" }, [{ name: "Shapes.echo", parameters: ["unit"], result: "unit" }]);
	const documentation = { summary: "Independent constructor contract.", details: "" };
	ir.types = [{ id: "lean:Shapes.Signal", name: "Signal", kind: "variant"
		, representation: "copied", mutability: "immutable", typeParameters: []
		, fields: [], target: null, resource: null, callable: null, host: null
		, cases: expected.map(([name, fields]) => ({ name, documentation
			, fields: fields.map(([name, primitive]) => ({ name
				, type: { kind: "primitive", name: primitive }
				, mutability: "immutable", documentation })) }))
		, documentation
		, source: { producer: "corpusReview"
			, declaration: "Shapes.Signal", extensions: {} }
		, assurance: [] }];
	ir.declarations[0].parameters[0].type = { kind: "named", id: ir.types[0].id };
	ir.declarations[0].result.type = { kind: "named", id: ir.types[0].id };
	const source = canonicalJson(ir);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) };
};
const synthetic = () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const type = { kind: "variant", name: "Sample.Choice", lean: "Sample.Choice"
		, cases: [{ name: "empty", constructor: "Sample.Choice.empty", fields: [] }
			, { name: "some", constructor: "Sample.Choice.some"
				, fields: [{ name: "value", type: projection.result }] }]
		, abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } };
	projection.parameters[0].type = type; projection.result = type;
	return { ...input, type };
};

const syntheticGraph = (native = true) => {
	const input = synthetic(), type = input.type;
	const ref = { kind: "reference", name: type.name, lean: type.lean, abi: type.abi };
	type.cases[1].fields.push({ name: "children", type: { kind: "list", element: ref, abi: type.abi } });
	const graph = { kind: "graph", root: ref, types: [type], abi: type.abi };
	const projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = graph; projection.result = graph;
	if(!native)
	{
		const strip = value => Array.isArray(value) ? value.map(strip) : value && typeof value === "object"
			? Object.fromEntries(Object.entries(value).filter(([key]) => !["abi", "lean", "constructor", "projection"].includes(key)).map(([key, child]) => [key, strip(child)])) : value;
		const { metadata, ...request } = input.sourceIdentity.request;
		input.sourceIdentity.request = createMetadataRequest({ ...request, profile: "component-scalars-v1" }, metadata);
		input.metadata.profile = "component-scalars-v1";
		input.metadata.producer.invocationIdentitySha256 = input.sourceIdentity.request.metadata.invocationIdentitySha256;
		projection.bindingShape = "pure-function";
		projection.parameters[0].type = strip(graph); projection.result = strip(graph);
	}
	return { ...input, graph: projection.result };
};

const recursiveReview = () => {
	const ir = corpusReviewedIr({ id: "shapes" }, [{ name: "Recursive.left", parameters: ["unit"], result: "unit" }]);
	const base = review(), template = JSON.parse(base.source).types[0];
	const ref = name => ({ kind: "named", id: `lean:Recursive.${name}` });
	const declarations = [
		["LeftTree", [["next", [["right", ref("RightTree")]]], ["leaf", [["value", { kind: "primitive", name: "uint32" }]]]]]
		, ["RightTree", [["many", [["lefts", { kind: "apply", constructor: "array", arguments: [ref("LeftTree")] }]]]]]
	];
	ir.types = declarations.map(([name, cases]) => ({
		...template, id: `lean:Recursive.${name}`, name
		, source: { producer: "corpusReview", declaration: `Recursive.${name}`, extensions: {} }
		, cases: cases.map(([name, fields]) => ({
			name, documentation: template.documentation
			, fields: fields.map(([name, type]) => ({ name, type, mutability: "immutable", documentation: template.documentation })) }))
	}));
	ir.declarations[0].parameters[0].type = ref("LeftTree"); ir.declarations[0].result.type = ref("LeftTree");
	const source = canonicalJson(ir);
	return { schemaVersion: 1, path: "recursive.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) };
};

test("recursive compiler tables lower to npm graph ABI while native graph paths stay closed", async () => {
	const identities = [];
	for(const native of [true, false])
	{
		const input = syntheticGraph(native), request = input.sourceIdentity.request;
		validateElaboratedMetadata(input.metadata, request);
		await assertJsonSchema("elaborated-export-metadata", input.metadata);
		const ir = lower(input.metadata, request), type = ir.types[0];
		assert.equal(type.id, "lean:Sample.Choice");
		assert.deepEqual(type.cases[1].fields[1].type, { kind: "apply", constructor: "list", arguments: [{ kind: "named", id: type.id }] });
		const graph = validateCopiedMetadataGraph(input.graph, () => {}, native);
		assert.deepEqual(graph, componentRecursiveTypeGraph(ir, ir.declarations[0].result.type));
		identities.push(sourceApiIdentity(ir).sha256);
		const abi = recursiveCarrierAbi(ir);
		assertComponentRecursiveBindings(abi, ir);
		assert.equal(createComponentPrivateAbi(ir).version, 8);
		if(native) assert.throws(() => createNativeModel({ ...input, component }), /bounded graph transport/u);
	}
	assert.equal(identities[0], identities[1]);
});

test("recursive private ABI binds finite graphs and rejects changed call or copy semantics", () => {
	const input = syntheticGraph(), ir = lower(input.metadata, input.sourceIdentity.request);
	const abi = recursiveCarrierAbi(ir);
	assertComponentRecursiveBindings(abi, ir);
	for(const change of [
		value => { value.version = 7; }
		, value => { value.dispatch = "copied-nominal-frame-v1"; }
		, value => { value.exports = []; }
		, value => { value.exports.push(value.exports[0]); }
		, value => { value.exports[0].extra = true; }
		, value => { value.exports[0].parameters = new Array(1); }
		, value => { value.exports[0].resultMode = "promise"; }
		, value => { value.exports[0].symbol = "unchecked"; }
		, value => { value.exports[0].parameters.push({ kind: "named", id: "lean:Unknown" }); }
		, value => { value.types[0].cases[1].fields[1].type.arguments[0].id = "lean:Unknown"; }
	]) {
		const value = structuredClone(abi); change(value);
		assert.throws(() => assertComponentRecursiveAbi(value));
	}
	for(const change of [
		value => { value.types[0].cases.reverse(); }
		, value => { value.types[0].cases[1].fields.reverse(); }
		, value => { value.types[0].cases[1].fields[1].type.constructor = "array"; }
		, value => { value.exports[0].result = { kind: "primitive", name: "unit" }; }
	]) {
		const value = structuredClone(abi); change(value);
		assertComponentRecursiveAbi(value);
		assert.throws(() => assertComponentRecursiveBindings(value, ir));
	}
	for(const change of [
		value => { value.declarations[0].parameters[0].ownership = "borrow"; }
		, value => { value.declarations[0].effects = ["io"]; }
		, value => { value.types[0].representation = "identity"; }
	]) {
		const value = structuredClone(ir); change(value);
		assert.throws(() => assertComponentRecursiveBindings(abi, value));
	}
	let reads = 0;
	for(const target of ["root", "export", "array"])
	{
		const value = structuredClone(abi);
		const [object, name] = target === "root" ? [value, "types"] : target === "export" ? [value.exports[0], "parameters"] : [value.exports, 0];
		Object.defineProperty(object, name, { get: () => { reads++; return []; } });
		assert.throws(() => assertComponentRecursiveAbi(value));
	}
	assert.equal(reads, 0);
});

test("recursive C walkers erase alias traversal without erasing descriptor identities", () => {
	const input = syntheticGraph(), ir = lower(input.metadata, input.sourceIdentity.request);
	const abi = recursiveCarrierAbi(ir), root = abi.exports[0].result;
	for(let index = 0; index < 1000; index++) abi.types.push({
		kind: "alias", id: `lean:A${index}`
		, target: index ? { kind: "named", id: `lean:A${index - 1}` } : root });
	abi.exports[0].parameters[0] = { kind: "named", id: "lean:A999" };
	assert.equal(componentRecursiveTypes(abi).length, 1003);
	const c = generateComponentRecursiveAdapters(abi);
	assert.equal([...c.matchAll(/static uint32_t recursive_[a-f0-9]+_validate\(bridge_scalar_slot const \*slot/g)].length, 3);
	assert.ok(c.length < 14000, "aliases must not add recursive C call frames");
	assert.match(c, /depth > 128/u); assert.match(c, /nodes = 262144/u);
	assert.match(c, /path\[129\]/u); assert.match(c, /lean_array_size\(value\) != 1/u);
	assert.doesNotMatch(c, /lean_ctor_get|lean_ctor_set|lean_alloc_ctor/u);
	assert.ok(c.lastIndexOf("_validate(&frame->args") < c.lastIndexOf("_decode(&frame->args"));
});

test("copied compiler graphs reject unbound references, identities, alias cycles and malformed tables", () => {
	for(const native of [true, false]) for(const change of [
		value => { value.root.name = "Unknown.Type"; }
		, value => { value.types.push(structuredClone(value.types[0])); }
		, value => { value.types = []; }
		, value => { value.types = new Array(1); }
		, value => { value.root = value.types[0]; }
		, value => { value.types[0].cases[1].fields[1].type.element = value; }
		, value => { value.types[0].cases[1].fields[0].type = { kind: "resource", name: "Secret" }; }
		, value => { value.types[0].cases[1].fields[1].type = { kind: "callback", parameters: [], result: value.root }; }
		, value => { value.types[0].cases[1].fields[1].type.extra = true; }
		, value => { value.types[0].cases[1].fields[1].name = "kind"; }
		, value => { value.types[0].cases[1].fields[0].name = "__proto__"; }
		, value => {
			const { name, lean, abi } = value.types[0];
			value.types[0] = {
				kind: "alias", name
				, ...(native ? { lean, abi } : {})
				, target: { kind: "list", element: value.root, ...(native ? { abi } : {}) } };
		}
	]) {
		const input = syntheticGraph(native); change(input.graph);
		assert.throws(() => validateElaboratedMetadata(input.metadata, input.sourceIdentity.request));
	}
	for(const change of [
		value => { value.root.lean = "Other.Type"; }
		, value => { value.root.abi = { ...value.root.abi, heap: false }; }
		, value => { value.abi = { ...value.abi, heap: false }; }
		, value => { value.types[0].cases[1].constructor = "Other.some"; }
	]) {
		const input = syntheticGraph(); change(input.graph);
		assert.throws(() => validateNativeType(input.graph));
	}
	const input = syntheticGraph();
	assert.throws(() => validateNativeType(input.graph.root), /requires a matching nominal/u);
	const componentInput = syntheticGraph(false);
	componentInput.metadata.modules[0].declarations[0].projection.result = componentInput.graph.root;
	assert.throws(() => validateElaboratedMetadata(componentInput.metadata, componentInput.sourceIdentity.request), /requires a matching nominal/u);
});

test("compiler graphs enforce finite schema limits without unfolding recursive edges", () => {
	const input = syntheticGraph();
	const { abi } = input.graph;
	const ref = name => ({ kind: "reference", name, lean: name, abi });
	const aliases = Array.from({ length: 1000 }, (_, index) => ({
		kind: "alias", name: `Sample.A${index}`, lean: `Sample.A${index}`, abi
		, target: ref(index === 999 ? "Sample.Choice" : `Sample.A${index + 1}`) }));
	input.graph.types.push(...aliases); input.graph.root = ref("Sample.A0");
	validateNativeType(input.graph);
	const ir = lower(input.metadata, input.sourceIdentity.request);
	assert.equal(ir.types.length, 1001);
	const oversized = structuredClone(input.graph); oversized.types.push(...aliases.slice(0, 24));
	assert.throws(() => validateNativeType(oversized), /bounded dense table/u);
	const deep = syntheticGraph().graph;
	for(let index = 0; index < 32; index++) deep.root = { kind: "array", element: deep.root, abi };
	validateNativeType(deep);
	deep.root = { kind: "array", element: deep.root, abi };
	assert.throws(() => validateNativeType(deep), /nesting/u);
	const cyclic = syntheticGraph().graph;
	cyclic.root = { kind: "array", abi }; cyclic.root.element = cyclic.root;
	assert.throws(() => validateNativeType(cyclic), /nesting/u);
});

test("inline and graph definitions share identity without hiding nested compiler conflicts", () => {
	const input = syntheticGraph(), projection = input.metadata.modules[0].declarations[0].projection;
	const scalar = projection.result.types[0].cases[1].fields[0].type;
	const record = {
		kind: "record", name: "Sample.Payload", lean: "Sample.Payload"
		, constructor: "Sample.Payload.mk"
		, fields: [{ name: "value", projection: "Sample.Payload.value", type: scalar }]
		, abi: input.graph.abi };
	const ref = { kind: "reference", name: record.name, lean: record.lean, abi: record.abi };
	input.graph.types[0].cases[1].fields[0].type = ref;
	input.graph.types.push(record);
	projection.parameters[0].type = record;
	const ir = lower(input.metadata, input.sourceIdentity.request);
	assert.equal(ir.types.length, 2);
	assert.deepEqual(ir.declarations[0].parameters[0].type, { kind: "named", id: "lean:Sample.Payload" });
	const conflicting = structuredClone(record);
	conflicting.fields[0].name = "renamed";
	projection.parameters[0].type = conflicting;
	assert.throws(() => lower(input.metadata, input.sourceIdentity.request), /Conflicting compiler type definitions/u);
	const wrap = type => ({
		kind: "record", name: "Sample.Wrapper", lean: "Sample.Wrapper"
		, constructor: "Sample.Wrapper.mk"
		, fields: [{ name: "payload", projection: "Sample.Wrapper.payload", type }]
		, abi: record.abi });
	projection.parameters[0].type = wrap(record); projection.result = wrap(conflicting);
	assert.throws(() => lower(input.metadata, input.sourceIdentity.request), /Conflicting compiler type definitions: lean:Sample.Payload/u);
});

test("compiler graph limits count fields and cases and do not execute descriptor accessors", () => {
	const input = syntheticGraph(), graph = input.graph;
	const scalar = graph.types[0].cases[1].fields[0].type;
	graph.types[0].cases = Array.from({ length: 1023 }, (_, index) => ({
		name: `case${index}`, constructor: `Sample.Choice.case${index}`
		, fields: ["a", "b", "c"].map(name => ({ name, type: scalar })) }));
	graph.types[0].cases[0].fields.push({ name: "d", type: scalar }, { name: "e", type: scalar });
	validateNativeType(graph); // 4,096 nominal, constructor and reference nodes.
	graph.types[0].cases[0].fields.push({ name: "f", type: scalar });
	assert.throws(() => validateNativeType(graph), /node limit/u);
	for(const install of [
		(value, get) => Object.defineProperty(value, "root", { get })
		, (value, get) => Object.defineProperty(value.types[0], "name", { get })
		, (value, get) => Object.defineProperty(value.types, 0, { get })
	]) {
		const type = syntheticGraph().graph; let calls = 0;
		install(type, () => { calls++; throw new Error("accessor executed"); });
		assert.throws(() => validateCopiedMetadataGraph(type, () => {}, true), /accessors/u);
		assert.equal(calls, 0);
	}
});

test("variant interfaces retain stable source references across relocated C and metadata builds", { skip: !enabled, timeout: 120000 }, async t => {
	const root = process.cwd(), directory = await mkdtemp(join(tmpdir(), "lean-bridge-variant-relocation-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const prefix = (await processBuildRunner.capture({ command: join(root, ".toolchains/elan/bin/lean"), args: ["--print-prefix"], cwd: root })).stdout.trim();
	const identities = [];
	for(const [index, c] of [false, true, false, true].entries())
	{
		const working = await mkdtemp(join(directory, `build-${index}-`));
		await cp(join(root, "tests/fixtures/onboarding/npm-variants/Variants.lean"), join(working, "Variants.lean"));
		await processBuildRunner.capture({ command: join(prefix, "bin/lean")
			, args: ["-R", working, "-o", join(working, "Variants.olean"), ...(c ? ["-c", join(working, "Variants.c")] : []), "Variants.lean"]
			, cwd: working
			, env: { ...process.env, LEAN_PATH: working, PATH: `${join(prefix, "bin")}:${process.env.PATH}` }
			, timeoutMs: 60000 });
		identities.push(await identifyLeanInterface(join(working, "Variants.olean")));
		assert.equal((await readFile(join(working, "Variants.olean"))).includes(Buffer.from(directory)), false);
	}
	for(const identity of identities) assert.deepEqual(identity, identities[0]);
});

test("native constructor metadata validates exact identities and copied payloads", async () => {
	const input = synthetic();
	assert.equal(validateNativeType(input.type), input.type);
	assert.equal(validateElaboratedMetadata(input.metadata, input.sourceIdentity.request), true);
	await assertJsonSchema("elaborated-export-metadata", input.metadata);
	const ir = lower(input.metadata, input.sourceIdentity.request);
	assert.deepEqual(constructors(ir.types[0]), [["empty", []], ["some", [["value", "uint32"]]]]);
	assert.equal(createComponentPrivateAbi(ir).version, 7);
	assert.equal(createNativeModel({ ...input, component }).types.at(-1).kind, "variant");
	const drift = synthetic();
	drift.metadata.modules[0].declarations[0].projection.result = structuredClone(drift.type);
	drift.metadata.modules[0].declarations[0].projection.result.cases[0].name = "different";
	drift.metadata.modules[0].declarations[0].projection.result.cases[0].constructor = "Sample.Choice.different";
	assert.throws(() => lower(drift.metadata, drift.sourceIdentity.request), /Conflicting compiler type definitions/);
	for(const change of [
		value => { value.cases = []; }, value => { value.lean = "Other.Choice"; }
		, value => { value.cases[1].constructor = "Other.some"; }
		, value => { value.cases[1].name = "empty"; }
		, value => { value.cases[1].fields[0].name = "kind"; }
		, value => { value.cases[1].fields.push(value.cases[1].fields[0]); }
		, value => { value.cases[1].fields[0].type = value; }
		, value => { value.cases[1].fields[0].type = { kind: "callback"
			, parameters: [], result: synthetic().type, abi: value.abi }; }
	]) { const candidate = structuredClone(input.type); change(candidate); assert.throws(() => validateNativeType(candidate)); }
});

test("component variant metadata rejects malformed constructors before semantic lowering", async () => {
	const input = synthetic(), request = input.sourceIdentity.request;
	const strip = value => Array.isArray(value) ? value.map(strip) : value && typeof value === "object"
		? Object.fromEntries(Object.entries(value).filter(([key]) => !["abi", "lean", "constructor"].includes(key)).map(([key, child]) => [key, strip(child)])) : value;
	const { metadata: context, ...selection } = request;
	const componentRequest = createMetadataRequest({ ...selection, profile: "component-scalars-v1" }, context);
	input.metadata.profile = "component-scalars-v1";
	input.metadata.producer.invocationIdentitySha256 = componentRequest.metadata.invocationIdentitySha256;
	const projection = input.metadata.modules[0].declarations[0].projection;
	projection.bindingShape = "pure-function";
	projection.parameters[0].type = strip(input.type); projection.result = strip(input.type);
	assert.equal(validateElaboratedMetadata(input.metadata, componentRequest), true);
	await assertJsonSchema("elaborated-export-metadata", input.metadata);
	assert.deepEqual(constructors(lower(input.metadata, componentRequest).types[0]), [["empty", []], ["some", [["value", "uint32"]]]]);
	for(const change of [
		value => { value.cases = []; }
		, value => { value.cases.push(value.cases[0]); }
		, value => { value.name = null; }
		, value => { value.cases[0].name = undefined; }
		, value => { value.cases[1].fields[0].name = "kind"; }
		, value => { value.cases[1].fields[0].name = undefined; }
		, value => { value.cases[1].fields[0].type.name = "unknown"; }
		, value => { value.cases[1].fields.push(value.cases[1].fields[0]); }
		, value => { value.cases[0].constructor = "unchecked"; }
		, value => { value.cases = new Array(1); }
	]) {
		const candidate = structuredClone(input.metadata); change(candidate.modules[0].declarations[0].projection.result);
		assert.throws(() => validateElaboratedMetadata(candidate, componentRequest));
	}
});

test("fresh Lean constructor facts agree across profiles and with independent reviewed IR", { skip: !enabled, timeout: 600000 }, async t => {
	const root = process.cwd(), directory = await mkdtemp(join(tmpdir(), "lean-bridge-variant-metadata-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const prefix = (await processBuildRunner.capture({ command: join(root, ".toolchains/elan/bin/lean"), args: ["--print-prefix"], cwd: root })).stdout.trim();
	const lean = join(prefix, "bin/lean"), extractor = join(root, "src/analyze/NativeExports.lean");
	const capture = args => processBuildRunner.capture({
		command: lean, args, cwd: directory
		, env: { ...process.env, LEAN_PATH: directory
			, PATH: `${join(prefix, "bin")}:${process.env.PATH}` }
		, timeoutMs: 120000
	}).catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	await cp(join(root, "tests/fixtures/structured-types/Shapes.lean"), join(directory, "Shapes.lean"));
	await capture(["-o", "Shapes.olean", "Shapes.lean"]);
	const source = await readFile(join(directory, "Shapes.lean"));
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, modules: [{ name: "Shapes", sourcePath: "Shapes.lean"
			, sourceSha256: sha256(source)
			, interfaceSha256: (await identifyLeanInterface(join(directory, "Shapes.olean"))).interfaceSha256 }]
		, extractorSha256: sha256(await readFile(extractor))
		, leanCompilerSha256: sha256(await readFile(lean)) };
	const config = canonicalJson({ schemaVersion: 1, modules: ["Shapes"] });
	const admitted = ["echo", "mode", "nested", "signals", "scalars", "anonymous", "tree"];
	const all = [...admitted, "generic", "indexed", "proof", "callback", "reserved", "dependent", "empty"];
	const results = [];
	for(const profile of ["native-library-v1", "component-scalars-v1"])
	{
		const run = async names => {
			const request = createMetadataRequest({
				profile, modules: ["Shapes"], exportModules: ["Shapes"]
				, exports: names.map(name => `Shapes.${name}`)
				, resources: [], arities: [] }, context);
			await writeFile(join(directory, "request.json"), canonicalJson(request));
			const result = await capture(["--run", extractor, "--metadata", "request.json"]);
			const metadata = JSON.parse(result.stdout);
			validateElaboratedMetadata(metadata, request);
			await assertJsonSchema("elaborated-export-metadata", metadata);
			return { metadata, request };
		};
		const { metadata, request } = await run(all);
		const declarations = new Map(metadata.modules[0].declarations.map(item => [item.identity, item]));
		for(const name of all) assert.equal(declarations.get(`Shapes.${name}`).projection.status, admitted.includes(name) ? "supported" : "unsupported", `${profile}/${name}: ${JSON.stringify(declarations.get(`Shapes.${name}`).projection)}`);
		const signal = declarations.get("Shapes.echo").projection.result;
		assert.deepEqual(constructors(signal), expected);
		assert.deepEqual(declarations.get("Shapes.mode").projection.result.cases.map(item => item.name), ["first", "second", "third"]);
		assert.deepEqual(declarations.get("Shapes.scalars").projection.result.cases[1].fields.map(field => field.type.name), componentScalarTypes);
		assert.deepEqual(constructors(declarations.get("Shapes.anonymous").projection.result), [
			["number", [["arg0", "uint32"]]]
			, ["pair", [["arg0", "uint32"], ["arg1", "string"]]]
			, ["collision", [["arg1", "uint32"], ["arg1_", "string"]]]
		]);
		if(profile === "native-library-v1")
		{
			assert.equal(signal.abi.cType, "lean_object*");
			assert.equal(declarations.get("Shapes.mode").projection.result.abi.cType, "uint8_t");
			assert.deepEqual(signal.cases.map(item => item.constructor), expected.map(([name]) => `Shapes.Signal.${name}`));
		}
		results.push(sourceApiIdentity(lower(metadata, request)).sha256);
		const selected = await run(["echo"]), ir = lower(selected.metadata, selected.request);
		const sourceIdentity = { request: selected.request, exportConfigurationSource: config, exportConfigurationSha256: sha256(config) };
		assert.deepEqual(constructors(reconcileReviewedSource(review(), ir, sourceIdentity).types[0]), expected);
		for(const mutate of [
			value => { value.types[0].cases.reverse(); }
			, value => { value.types[0].cases[0].name = "different"; }
			, value => { value.types[0].cases[2].fields.reverse(); }
			, value => { value.types[0].cases[2].fields[0].type.name = "uint64"; }
		]) {
			const changed = review(), document = JSON.parse(changed.source); mutate(document);
			changed.source = canonicalJson(document); changed.sourceSha256 = sha256(changed.source); changed.semanticSha256 = hashBindingIr(document);
			assert.throws(() => reconcileReviewedSource(changed, ir, sourceIdentity), { code: "reviewed-ir-source-mismatch" });
		}
	}
	assert.equal(results[0], results[1]);
	assert.deepEqual(await readFile(join(directory, "Shapes.lean")), source);
});

test("fresh Lean recursive graphs preserve mutual recursion, aliases and reviewed contracts", { skip: !enabled, timeout: 600000 }, async t => {
	const root = process.cwd(), directory = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-metadata-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const prefix = (await processBuildRunner.capture({ command: join(root, ".toolchains/elan/bin/lean"), args: ["--print-prefix"], cwd: root })).stdout.trim();
	const lean = join(prefix, "bin/lean"), extractor = join(root, "src/analyze/NativeExports.lean");
	const capture = args => processBuildRunner.capture({
		command: lean, args, cwd: directory
		, env: { ...process.env, LEAN_PATH: directory, PATH: `${join(prefix, "bin")}:${process.env.PATH}` }
		, timeoutMs: 120000
	}).catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	const fixture = await readFile(join(root, "tests/fixtures/structured-types/Recursive.lean"), "utf8");
	const stress = "\nnamespace Recursive\n"
		+ Array.from({ length: 48 }, (_, index) => `abbrev Alias${index} := ${index ? `Alias${index - 1}` : "Tree"}\n`).join("")
		+ "def deepAliases (value : Alias47) : Alias47 := value\n"
		+ "structure Shared0 where\n  value : UInt32\n"
		+ Array.from({ length: 16 }, (_, index) => `structure Shared${index + 1} where\n  left : Shared${index}\n  right : Shared${index}\n`).join("")
		+ "def shared (value : Shared16) : Shared16 := value\nend Recursive\n";
	await writeFile(join(directory, "Recursive.lean"), fixture + stress);
	await capture(["-o", "Recursive.olean", "Recursive.lean"]);
	const source = await readFile(join(directory, "Recursive.lean"));
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, modules: [{ name: "Recursive", sourcePath: "Recursive.lean"
			, sourceSha256: sha256(source)
			, interfaceSha256: (await identifyLeanInterface(join(directory, "Recursive.olean"))).interfaceSha256 }]
		, extractorSha256: sha256(await readFile(extractor))
		, leanCompilerSha256: sha256(await readFile(lean)) };
	const names = ["tree", "forest", "envelope", "scalars", "left", "right", "never", "spine", "grow", "empty", "joinTrees", "deepAliases", "shared"];
	const identities = [];
	for(const profile of ["native-library-v1", "component-scalars-v1"])
	{
		const run = async selected => {
			const request = createMetadataRequest({
				profile, modules: ["Recursive"], exportModules: ["Recursive"]
				, exports: selected.map(name => `Recursive.${name}`)
				, resources: [], arities: [] }, context);
			await writeFile(join(directory, "request.json"), canonicalJson(request));
			const metadata = JSON.parse((await capture(["--run", extractor, "--metadata", "request.json"])).stdout);
			validateElaboratedMetadata(metadata, request); await assertJsonSchema("elaborated-export-metadata", metadata);
			return { metadata, request };
		};
		const { metadata, request } = await run(names);
		assert.deepEqual(metadata.diagnostics, []);
		const declarations = new Map(metadata.modules[0].declarations.map(item => [item.identity, item]));
		for(const name of names) assert.equal(declarations.get(`Recursive.${name}`).projection.status, "supported", `${profile}/${name}`);
		const ir = lower(metadata, request);
		if(profile === "native-library-v1") await checkRecursiveCarriers({ ir, directory, prefix, capture });
		identities.push(sourceApiIdentity(ir).sha256);
		const scalar = declarations.get("Recursive.scalars").projection.result;
		assert.equal(scalar.kind, "record"); assert.deepEqual(scalar.fields.map(field => field.type.name), componentScalarTypes);
		assert.equal(declarations.get("Recursive.deepAliases").projection.result.types.length, 50);
		assert.equal(declarations.get("Recursive.shared").projection.result.types.length, 17);
		for(const name of names.filter(name => name !== "scalars"))
		{
			const graph = declarations.get(`Recursive.${name}`).projection.result;
			assert.equal(graph.kind, "graph");
			assert.deepEqual(graph.types.map(type => type.name), graph.types.map(type => type.name).sort());
			const one = lower(metadata, request, [`Recursive.${name}`]);
			assert.deepEqual(validateCopiedMetadataGraph(graph, () => {}, profile === "native-library-v1")
				, componentRecursiveTypeGraph(one, one.declarations[0].result.type));
		}
		const tree = ir.types.find(type => type.id === "lean:Recursive.Tree");
		assert.deepEqual(tree.cases.map(branch => branch.name), ["branch", "leaf"]);
		assert.deepEqual(tree.cases[0].fields[0].type, { kind: "apply", constructor: "list", arguments: [{ kind: "named", id: tree.id }] });
		assert.deepEqual(ir.types.find(type => type.id === "lean:Recursive.Forest").target, { kind: "apply", constructor: "list", arguments: [{ kind: "named", id: tree.id }] });
		assert.equal(ir.types.find(type => type.id === "lean:Recursive.Never").cases[0].fields[0].type.id, "lean:Recursive.Never");
		const selected = await run(["left"]), checked = lower(selected.metadata, selected.request);
		const config = canonicalJson({ schemaVersion: 1, modules: ["Recursive"] });
		const sourceIdentity = { request: selected.request, exportConfigurationSource: config, exportConfigurationSha256: sha256(config) };
		assert.equal(reconcileReviewedSource(recursiveReview(), checked, sourceIdentity).types.length, 2);
		for(const change of [
			document => { document.types[0].cases.reverse(); }
			, document => { document.types[0].cases[0].fields[0].name = "different"; }
			, document => { document.types[0].cases[0].fields[0].type.id = "lean:Recursive.LeftTree"; }
			, document => { document.types[1].cases[0].fields[0].type.constructor = "list"; }
		]) {
			const original = recursiveReview(), document = JSON.parse(original.source); change(document);
			const source = canonicalJson(document);
			const changed = { ...original, source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
			assert.throws(() => reconcileReviewedSource(changed, checked, sourceIdentity), { code: "reviewed-ir-source-mismatch" });
		}
	}
	assert.equal(identities[0], identities[1]);
	assert.deepEqual(await readFile(join(directory, "Recursive.lean")), source);
});
