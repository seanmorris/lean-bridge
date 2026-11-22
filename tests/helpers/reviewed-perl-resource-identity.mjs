/**
 * Standalone (v3) identity resources: independently authored contracts, two
 * separately compiled CPAN components, one runtime and no consumer compiler.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reconcileReviewedSource, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { buildNativeProject } from "../../src/build/native-project.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const counter = { record: "Workshop.Counter", fields: {} }, badge = { record: "Workshop.Badge", fields: {} };
const contract = module => {
	const signatures = module === "Other" ? [["same", [counter], counter], ["value", [counter], "uint32"]]
		: [["newCounter", ["uint32"], counter], ["sameCounter", [counter], counter], ["newBadge", ["uint32"], badge]];
	const ir = corpusReviewedIr({ id: module.toLowerCase() }, signatures.map(([name, parameters, result]) =>
		({ name: `${module}.${name}`, parameters, result })));
	ir.component.version = "0.1.0";
	ir.component.id = `${ir.component.name}@${ir.component.version}`;
	for(const type of ir.types) Object.assign(type, {
		kind: "resource", representation: "identity", mutability: "read"
		, resource: { kindId: `resource:${type.source.declaration}`, disposal: "required", fallback: "queued-finalizer", cycles: "explicit-cut" }
	});
	for(const declaration of ir.declarations)
	{
		for(const parameter of declaration.parameters) if(parameter.type.kind === "named")
			Object.assign(parameter, { ownership: "borrow", lifetime: { scope: "call", anchor: null } });
		if(declaration.result.type.kind === "named") Object.assign(declaration.result, {
			ownership: "lease", lifetime: { scope: "explicit", anchor: null }
		});
	}
	return ir;
};
const capture = ir => {
	const source = canonicalJson(ir);
	return { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) };
};
const native = { nativeResources: true };

test("reviewed standalone resources bind the exact native selection and cannot be copied", () => {
	const ir = contract("Workshop"), review = capture(ir);
	const selection = reviewedSourceSelection(review, native);
	assert.deepEqual(selection.resources, ["Workshop.Badge", "Workshop.Counter"]);
	assert.throws(() => reviewedSourceSelection(review), { code: "reviewed-ir-build-unsupported" });
	const configuration = canonicalJson({ schemaVersion: 1, modules: ["Workshop"] });
	const identity = { exportConfigurationSource: configuration
		, exportConfigurationSha256: sha256(configuration)
		, request: { ...selection, exportModules: ["Workshop"], profile: "native-library-v1" } };
	for(const resources of [[], ["Workshop.Counter"], [...selection.resources, "Other.Counter"]])
		assert.throws(() => reconcileReviewedSource(review, ir, { ...identity, request: { ...identity.request, resources } })
			, { code: "reviewed-ir-source-mismatch" });
	const wrapResource = value => {
		const result = value.declarations[0].result;
		Object.assign(result, { type: { kind: "apply", constructor: "array", arguments: [result.type] }, ownership: "copy", lifetime: null });
	};
	for(const [code, mutate] of [
		["reviewed-ir-build-unsupported", value => { value.types[0].resource.kindId = "resource:Foreign.Counter"; }]
		, ["identity-ownership", value => { Object.assign(value.declarations[1].parameters[0], { ownership: "copy", lifetime: null }); }]
		, ["identity-ownership", value => { Object.assign(value.declarations[0].result, { ownership: "copy", lifetime: null }); }]
		, ["identity-ownership", wrapResource]
	]){
		const changed = structuredClone(ir); mutate(changed);
		assert.throws(() => reviewedSourceSelection(capture(changed), native), { code });
	}
});

test("installed reviewed CPAN packages share standalone resource identity across independent components", {
	skip: process.env.LEAN_BRIDGE_PERL_NATIVE_TEST !== "1", timeout: 600_000
}, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-resources-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const perl = process.env.LEAN_BRIDGE_TEST_PERL ?? "/usr/bin/perl";
	const environment = { ...nativeFixtureEnvironment(["perl"]), LEAN_BRIDGE_PERLS: JSON.stringify([perl]) };
	const fixture = resolve("tests/fixtures/perl");
	const source = await readFile(join(fixture, "ordinary/Workshop.lean"), "utf8") + `
namespace Workshop
structure Badge where
  value : UInt32
  label : String
def newBadge (value : UInt32) : Badge := ⟨value, "badge"⟩
end Workshop
`;
	const components = [], prefix = join(working, "prefix"), consumer = join(working, "consumer");
	await mkdir(consumer);
	for(const module of ["Workshop", "Other"])
	{
		const producer = join(working, "producer"), project = join(producer, "project"), output = join(producer, "release");
		const handoff = join(working, `handoff-${module}`), ir = contract(module);
		await cp(join(fixture, module === "Other" ? "other" : "ordinary"), project, { recursive: true });
		await saveLakeFile(project, "Workshop.lean", source);
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1
			, modules: [module]
			, targets: { cpan: { module: `LeanBridge::${module}`, version: "0.001" } }
		}));
		await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ir));
		const built = await buildNativeProject({ projectRoot: project, outputRoot: output, targets: ["cpan"], environment });
		assert.equal(built.reviewedBindingIrSha256, hashBindingIr(ir));
		await copyPackageSetHandoff(output, handoff);
		await rm(producer, { recursive: true });
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		components.push({ handoff, built });
	}
	const [first, second] = components.map(component => component.built);
	assert.equal(first.packages[0].sha256, second.packages[0].sha256, "independently prepared packages use the identical runtime archive");
	assert.notEqual(first.packages[1].sha256, second.packages[1].sha256);
	for(const [index, { handoff, built }] of components.entries())
	{
		for(const pkg of built.packages.slice(index === 0 ? 0 : 1))
			await installCpanArchive({ archive: join(handoff, "archives", pkg.archive), workingRoot: consumer, prefix, perl, mode: "prebuilt-only" });
		await rm(handoff, { recursive: true });
	}
	const installed = join(consumer, "relocated");
	await rename(prefix, installed);
	await copyFile(join(fixture, "reviewed-resources.t"), join(consumer, "consumer.t"));
	const probe = await runCopied(perl, ["consumer.t"], consumer, { ...copiedCleanEnvironment, PERL5LIB: join(installed, "lib/perl5") });
	assert.doesNotMatch(probe.stdout, /^not ok/mu);
	assert.match(probe.stdout, /1\.\.12\s*$/u);
	t.diagnostic(`12 installed checks; ${first.packages[0].sha256} runtime; ${first.packages[1].sha256} and ${second.packages[1].sha256} components`);
});
