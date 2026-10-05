/**
 * Fresh compiler reconciliation for the reviewed multi-profile Telemetry API.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel, sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { reconcileReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { reviewedTelemetry } from "./helpers/reviewed-telemetry.mjs";

const review = ir => {
	const source = canonicalJson(ir);
	return { schemaVersion: 1, path: "reviewed.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) };
};

test("reviewed Telemetry preserves its Word alias through a function alias on both compiler profiles", { skip: process.env.LEAN_BRIDGE_ELABORATED_METADATA_TEST !== "1", timeout: 180_000 }, async t => {
	const root = process.cwd(), directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-telemetry-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const prefix = (await processBuildRunner.capture({ command: join(root, ".toolchains/elan/bin/lean"), args: ["--print-prefix"], cwd: root })).stdout.trim();
	const lean = join(prefix, "bin/lean"), extractor = join(root, "src/analyze/NativeExports.lean");
	const capture = args => processBuildRunner.capture({ command: lean, args
		, cwd: directory
		, env: { ...process.env, LEAN_PATH: directory, PATH: `${join(prefix, "bin")}:${process.env.PATH}` } });
	// Same declared aliases and inferred signature as elaboratedLakeApi's Telemetry fixture.
	const source = "namespace Telemetry\nabbrev Word := UInt32\nabbrev Unary := Word → Word\ndef measure : Unary := fun value => value + 1\nend Telemetry\n";
	await saveLakeFile(directory, "Telemetry.lean", source); await capture(["-o", "Telemetry.olean", "Telemetry.lean"]);
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, extractorSha256: sha256(await readFile(extractor))
		, leanCompilerSha256: sha256(await readFile(lean))
		, modules: [{ name: "Telemetry", sourcePath: "Telemetry.lean"
			, sourceSha256: sha256(source)
			, interfaceSha256: (await identifyLeanInterface(join(directory, "Telemetry.olean"))).interfaceSha256 }] };
	const identities = [], config = canonicalJson({ schemaVersion: 1, modules: ["Telemetry"] });
	for(const profile of ["component-scalars-v1", "native-library-v1"]) await t.test(profile, async () => {
		const request = createMetadataRequest({ profile, modules: ["Telemetry"], exportModules: ["Telemetry"], exports: ["Telemetry.measure"], resources: [], arities: [] }, context);
		await saveLakeFile(directory, "request.json", canonicalJson(request));
		const metadata = JSON.parse((await capture(["--run", extractor, "--metadata", "request.json"])).stdout);
		validateElaboratedMetadata(metadata, request);
		const document = reviewedTelemetry(), ir = createElaboratedSemanticModel({ metadata, request, component: document.component, elaborationSha256: sha256(canonicalJson(metadata)) }).document;
		const identity = { request, exportConfigurationSource: config, exportConfigurationSha256: sha256(config) };
		const reconciled = reconcileReviewedSource(review(document), ir, identity);
		assert.deepEqual(reconciled.declarations[0].parameters[0].type, { kind: "named", id: "lean:Telemetry.Word" });
		assert.deepEqual(reconciled.declarations[0].result.type, { kind: "named", id: "lean:Telemetry.Word" });
		assert.equal(reconciled.types.length, 1); assert.equal(reconciled.types[0].kind, "alias");
		const flattened = structuredClone(document); flattened.types = [];
		flattened.declarations[0].parameters[0].type = { kind: "primitive", name: "uint32" };
		flattened.declarations[0].result.type = { kind: "primitive", name: "uint32" };
		assert.throws(() => reconcileReviewedSource(review(flattened), ir, identity), { code: "reviewed-ir-source-mismatch" });
		identities.push(sourceApiIdentity(reconciled).sha256);
	});
	assert.equal(identities.length, 2); assert.equal(identities[0], identities[1]);
});
