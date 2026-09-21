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
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const component = { id: "shapes@1.0.0", name: "shapes", version: "1.0.0" };
const enabled = process.env.LEAN_BRIDGE_ELABORATED_METADATA_TEST === "1";
const lower = (metadata, request) => createElaboratedSemanticModel({
	metadata, request
	, component, elaborationSha256: sha256(canonicalJson(metadata)) }).document;
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
	const admitted = ["echo", "mode", "nested", "signals", "scalars", "anonymous"];
	const all = [...admitted, "tree", "generic", "indexed", "proof", "callback", "reserved", "dependent", "empty"];
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
