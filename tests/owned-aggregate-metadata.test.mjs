/**
 * Explicit author ownership, fresh compiler graphs and independent v4 semantics.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedAggregateModel } from "../src/abi/owned-aggregate-model.mjs";
import { validateOwnedAggregatePolicy } from "../src/analyze/owned-aggregate-policy.mjs";
import { validateNativeType, validateOwnedNativeType } from "../src/analyze/native-types.mjs";
import { validateExportConfiguration, compilerExportSelection, assertExportConfigurationCapabilities } from "../src/analyze/export-configuration.mjs";
import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel, createOwnedElaboratedSemanticModel } from "../src/analyze/semantic-model.mjs";
import { projectNativeMetadata } from "../src/analyze/native-metadata.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";

const policy = { ownership: "lease", disposal: "required", fallback: "queued-finalizer", cycles: "reject" };
const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const ticket = { kind: "resource", name: "Owned.Ticket", lean: "Owned.Ticket", module: "Owned", abi: heap };
const reference = name => ({ kind: "reference", name, lean: name, abi: heap });
const array = element => ({ kind: "array", element, abi: heap });
const graph = () => structuredClone({ kind: "owned-graph", root: array(ticket), types: [], policy, abi: heap });
const record = () => structuredClone({ kind: "record", name: "Owned.Box"
	, lean: "Owned.Box", constructor: "Owned.Box.mk", abi: heap
	, fields: [{ name: "ticket", projection: "Owned.Box.ticket", type: ticket }
		, { name: "children", projection: "Owned.Box.children", type: array(reference("Owned.Box")) }] });
const nominalGraph = () => ({ ...graph(), root: reference("Owned.Box"), types: [record()] });
const fixture = resolve("tests/fixtures/onboarding/owned-aggregates");

test("aggregate author policy is explicit, closed, source-bound and unavailable to unowned adapters", async () => {
	for(const fallback of ["none", "queued-finalizer"])
	{
		const config = { schemaVersion: 1, ownedAggregates: { ...policy, fallback } };
		assert.equal(validateExportConfiguration(config), config);
		await assertJsonSchema("lean-export-configuration", config);
		const selection = compilerExportSelection(config);
		assert.deepEqual(selection, { ownedAggregates: config.ownedAggregates });
		assert.notEqual(selection.ownedAggregates, config.ownedAggregates);
		assert.throws(() => assertExportConfigurationCapabilities(config, { target: "unowned" }), /does not yet implement ownedAggregates/);
	}
	for(const value of [
		null, {}, { ...policy, ownership: "copy" }
		, { ...policy, disposal: "optional" }, { ...policy, fallback: "gc" }
		, { ...policy, cycles: "allow" }, { ...policy, callbacks: "retain" }
	]) {
		const config = { schemaVersion: 1, ownedAggregates: value };
		assert.throws(() => validateExportConfiguration(config), { code: "invalid-export-configuration" });
		await assert.rejects(() => assertJsonSchema("lean-export-configuration", config));
	}
	assert.throws(() => validateOwnedAggregatePolicy(Object.create(policy)), /explicit/);
	assert.throws(() => validateOwnedAggregatePolicy(Object.defineProperty({ ...policy }, "fallback", { get: () => { throw Error("getter ran"); } })), /explicit/);
	await assert.rejects(() => analyzeLeanProject(fixture), { code: "ownership-requires-elaboration" });
	const selection = { ownedAggregates: policy }, context = { toolchain: "leanprover/lean4:v4.32.2", modules: [] };
	assert.notEqual(createMetadataRequest(selection, context).metadata.invocationIdentitySha256
		, createMetadataRequest({ ownedAggregates: { ...policy, fallback: "none" } }, context).metadata.invocationIdentitySha256);
});

test("owned graphs retain resources and recursive references without copied admission", async () => {
	for(const type of [graph(), nominalGraph()])
	{
		const before = structuredClone(type);
		assert.equal(validateOwnedNativeType(type, policy), type);
		assert.deepEqual(type, before);
		await assertJsonSchema("native-metadata-type", type);
		assert.throws(() => validateNativeType(type), /separately authorized/);
		assert.throws(() => validateOwnedNativeType(type, { ...policy, fallback: "none" }), /differs from the authorized/);
	}
	assert.throws(() => validateOwnedNativeType(array(ticket), policy), /inside copied values/);
	const copied = { ...nominalGraph(), kind: "graph" }; delete copied.policy;
	assert.throws(() => validateOwnedNativeType(copied, policy), /copied references/);
});

test("owned graph validation rejects malformed topology, hidden callbacks and policy drift", () => {
	for(const mutate of [
		value => { value.policy.ownership = "copy"; }
		, value => { value.extra = true; }
		, value => { value.types.push(structuredClone(value.types[0])); }
		, value => { value.root.name = "Owned.Missing"; value.root.lean = "Owned.Missing"; }
		, value => { value.types[0].fields[1].type.element.name = "Owned.Missing"; }
		, value => { value.types[0].fields[0].type.module = "Owned\n"; }
		, value => { value.types[0].fields[0].type = { kind: "callback", parameters: [ticket], result: ticket, abi: heap }; }
		, value => { value.types[0].fields[0].type = graph(); }
		, value => { value.types[0].fields[0].type = record(); }
		, value => { value.types[0].fields = []; }
		, value => { value.types[0].fields[0].type.abi.heap = false; }
		, value => { value.abi.heap = false; }
		, value => { delete value.types[0].fields[0]; }
		, value => { value.types[0].fields[0].name = value.types[0].fields[1].name; }
		, value => { value.types.push({ kind: "alias", name: "Owned.Unused", lean: "Owned.Unused", target: array(ticket), abi: heap }); }
		, value => { value.root = array(value.root); value.root.element = value.root; }
		, value => { Object.defineProperty(value.types[0].fields[0], "type", { get: () => { throw Error("getter ran"); }, enumerable: true }); }
	]) {
		const value = nominalGraph(); mutate(value);
		assert.throws(() => validateOwnedNativeType(value, policy), error => error instanceof TypeError && !/getter ran/.test(error.message));
	}
	const cycle = nominalGraph();
	cycle.types[0].fields[1].type.element = reference("Owned.Loop");
	cycle.types.push({ kind: "alias", name: "Owned.Loop", lean: "Owned.Loop", target: array(reference("Owned.Loop")), abi: heap });
	assert.throws(() => validateOwnedNativeType(cycle, policy), /cyclic alias/);
	const noResources = graph(); noResources.root.element = { kind: "primitive", name: "string", lean: "String", abi: heap };
	assert.throws(() => validateOwnedNativeType(noResources, policy), /must contain a resource/);
	const accessor = graph();
	Object.defineProperty(accessor, "kind", { get: () => { throw Error("getter ran"); } });
	assert.throws(() => validateOwnedNativeType(accessor, policy), /must be a data field/);
});

test("owned compiler graphs enforce finite schema budgets without expanding recursive aliases", () => {
	const deep = graph();
	for(let index = 0; index < 33; ++index) deep.root = array(deep.root);
	assert.throws(() => validateOwnedNativeType(deep, policy), /nesting or node limit/);
	const wide = nominalGraph(), fields = wide.types[0].fields;
	fields.push(...Array.from({ length: 1023 }, (_, i) => ({ name: `more${i}`, projection: `Owned.Box.more${i}`, type: ticket })));
	assert.throws(() => validateOwnedNativeType(wide, policy), /bounded dense table/);
	const aliases = nominalGraph();
	aliases.types[0].fields[1].type.element = reference("Owned.A0");
	for(let index = 0; index < 1023; ++index)
		aliases.types.push({ kind: "alias", name: `Owned.A${index}`
			, lean: `Owned.A${index}`
			, target: reference(index === 1022 ? "Owned.Box" : `Owned.A${index + 1}`)
			, abi: heap });
	assert.equal(validateOwnedNativeType(aliases, policy), aliases);
	aliases.types.push({ kind: "alias", name: "Owned.TooMany", lean: "Owned.TooMany", target: reference("Owned.Box"), abi: heap });
	assert.throws(() => validateOwnedNativeType(aliases, policy), /bounded dense table/);
	const nodes = nominalGraph();
	nodes.types[0].fields = Array.from({ length: 1024 }, (_, i) => ({ name: `part${i}`
		, projection: `Owned.Box.part${i}`
		, type: array(array(array(array(ticket)))) }));
	assert.throws(() => validateOwnedNativeType(nodes, policy), /nesting or node limit/);
});

test("anonymous resource containers preserve the authored disposal fallback in their IR identity", () => {
	const ir = ownedAggregateReviewedIr(), original = compileOwnedAggregateModel(ir);
	ir.aggregatePolicy.fallback = "none";
	const model = compileOwnedAggregateModel(ir);
	assert.notEqual(model.bindingIrSha256, original.bindingIrSha256);
	const containers = model.types.filter(type => ["array", "list", "option", "tuple", "result"].includes(type.kind) && type.representation === "owned");
	assert.ok(containers.length >= 5);
	assert.ok(containers.every(type => type.aggregate.fallback === "none"));
	assert.equal(model.types.find(type => type.id === "lean:Owned.Bundle").aggregate.fallback, "queued-finalizer");
	delete ir.aggregatePolicy;
	assert.throws(() => compileOwnedAggregateModel(ir), { code: "missing-property" });
});

test("fresh Lean owned graphs match the independent resource contract, including callbacks and captures", {
	skip: process.env.LEAN_BRIDGE_ELABORATED_METADATA_TEST !== "1", timeout: 300000
}, async t => {
	const root = process.cwd(), directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-metadata-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const prefix = (await processBuildRunner.capture({ command: join(root, ".toolchains/elan/bin/lean"), args: ["--print-prefix"], cwd: root })).stdout.trim();
	const lean = join(prefix, "bin/lean"), extractor = join(root, "src/analyze/NativeExports.lean");
	const capture = args => processBuildRunner.capture({ command: lean, args
		, cwd: directory
		, env: { ...process.env, LEAN_PATH: directory, PATH: `${join(prefix, "bin")}:${process.env.PATH}` } });
	const source = await readFile(join(fixture, "Owned.lean"), "utf8");
	const config = JSON.parse(await readFile(join(fixture, "lean-bridge.exports.json"), "utf8"));
	validateExportConfiguration(config);
	await saveLakeFile(directory, "Owned.lean", source);
	await capture(["-o", "Owned.olean", "Owned.lean"]);
	const interfaceIdentity = await identifyLeanInterface(join(directory, "Owned.olean"));
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, extractorSha256: sha256(await readFile(extractor))
		, leanCompilerSha256: sha256(await readFile(lean))
		, modules: [{ name: "Owned", sourcePath: "Owned.lean", sourceSha256: sha256(source), interfaceSha256: interfaceIdentity.interfaceSha256 }] };
	const selection = { profile: "native-library-v1", modules: ["Owned"]
		, exportModules: ["Owned"], exports: config.exports
		, resources: config.resources, arities: Object.entries(config.arities)
		, ...compilerExportSelection(config) };
	const run = async selected => {
		const request = createMetadataRequest(selected, context);
		await saveLakeFile(directory, "request.json", canonicalJson(request));
		const metadata = JSON.parse((await capture(["--run", extractor, "--metadata", "request.json"])).stdout);
		validateElaboratedMetadata(metadata, request);
		await assertJsonSchema("elaborated-export-metadata", metadata);
		return { request, metadata };
	};
	const { metadata, request } = await run(selection);
	assert.deepEqual(metadata.diagnostics, []);
	const selected = metadata.modules[0].declarations.filter(item => item.selected);
	assert.equal(selected.length, 22);
	assert.ok(selected.every(item => item.projection.status === "supported"));
	const options = { metadata, request, component: ownedAggregateReviewedIr().component, elaborationSha256: sha256(canonicalJson(metadata)) };
	assert.throws(() => createElaboratedSemanticModel(options), /ownership-aware semantic model/);
	const semantic = createOwnedElaboratedSemanticModel(options);
	await assertJsonSchema("binding-ir-owned", semantic.document);
	const actual = compileOwnedAggregateModel(semantic.document), expected = compileOwnedAggregateModel(ownedAggregateReviewedIr());
	const comparable = model => ({ types: model.types
		, declarations: model.declarations.map(item => ({ ...item, effects: item.effects.toSorted() })).sort((a, b) => a.id.localeCompare(b.id)) });
	assert.deepEqual(comparable(actual), comparable(expected));
	assert.equal(actual.bindingIrSha256, semantic.semanticSha256);
	assert.ok(semantic.document.declarations.find(item => item.name === "bundle").source.extensions["lean-lang.org/theorem-references"].includes("Owned.primary_bundle"));
	const sourceIdentity = { request, leanVersion: "4.32.2"
		, leanCommit: (await capture(["--githash"])).stdout.trim()
		, leanCompilerSha256: context.leanCompilerSha256
		, extractorSha256: context.extractorSha256
		, sourceTreeSha256: sha256(source)
		, modules: [{ module: "Owned"
			, source: { path: "Owned.lean", sha256: sha256(source) }
			, interface: { sha256: interfaceIdentity.oleanSha256, interfaceSha256: interfaceIdentity.interfaceSha256 } }] };
	assert.throws(() => projectNativeMetadata(metadata, sourceIdentity, { copiedGraphs: true }), /ownership-aware transport/);
	assert.equal(projectNativeMetadata(metadata, sourceIdentity, { copiedGraphs: true, ownedGraphs: true }).declarations.length, 22);
	const changedRequest = structuredClone(request); changedRequest.resources = [];
	assert.throws(() => validateElaboratedMetadata(metadata, changedRequest), /configured source identity/);
	const changedPolicy = structuredClone(request); changedPolicy.ownedAggregates.fallback = "none";
	assert.throws(() => validateElaboratedMetadata(metadata, changedPolicy), /differs from the authorized/);
	assert.throws(() => projectNativeMetadata(metadata, { ...sourceIdentity, request: changedPolicy }, { ownedGraphs: true }), /differs from retained compiler/);
	const explicitDisposal = await run({ ...selection, ownedAggregates: { ...policy, fallback: "none" } });
	const explicitModel = createOwnedElaboratedSemanticModel({ ...options
		, ...explicitDisposal
		, elaborationSha256: sha256(canonicalJson(explicitDisposal.metadata)) });
	assert.equal(explicitModel.document.aggregatePolicy.fallback, "none");
	assert.ok(explicitModel.document.types.filter(type => type.aggregate).every(type => type.aggregate.fallback === "none"));
	assert.notEqual(explicitModel.semanticSha256, semantic.semanticSha256);
	const unowned = { ...selection }; delete unowned.ownedAggregates;
	const rejected = await run(unowned);
	assert.throws(() => createOwnedElaboratedSemanticModel({ ...options, ...rejected }), /ownership-aware semantic model/);
	assert.ok(rejected.metadata.modules[0].declarations.filter(item => item.selected)
		.every(item => item.projection.status === (["Owned.newTicket", "Owned.serial", "Owned.label", "Owned.retainTicket"].includes(item.identity) ? "supported" : "unsupported")));
	const hidden = await run({ ...selection, exports: ["Owned.hiddenCallback"], arities: [] });
	assert.match(hidden.metadata.modules[0].declarations.find(item => item.selected).projection.expression, /retention policy/);
	const borrowed = { ownership: "borrow", lifetime: { scope: "call", anchor: null } };
	const leased = { ownership: "lease", lifetime: { scope: "explicit", anchor: null } };
	const contract = { parameters: [borrowed], result: leased, effects: ["reads-resource", "allocates"] };
	const constrained = await run({ ...selection, exports: ["Owned.echoRecord"], arities: [], contracts: { "Owned.echoRecord": contract } });
	assert.equal(constrained.metadata.modules[0].declarations.find(item => item.selected).projection.status, "supported");
	contract.result = { ownership: "copy", lifetime: null };
	const wrong = await run({ ...selection, exports: ["Owned.echoRecord"], arities: [], contracts: { "Owned.echoRecord": contract } });
	assert.equal(wrong.metadata.modules[0].declarations.find(item => item.selected).projection.reason, "export-contract-mismatch");
});
