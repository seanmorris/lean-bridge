/**
 * Install callback-only alias types from ordinary Lean and an independent review.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFixtureEnvironment, installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { witStructuredSignatures } from "./helpers/wit-structured-callable-fixture.mjs";
import { witNestedAliasConsumer, witNestedAliasExports, witNestedAliasReviewedIr } from "./helpers/wit-structured-alias-fixture.mjs";

test("installed WIT callback-only nested aliases retain types and independently owned values", { skip: process.env.LEAN_BRIDGE_WIT_STRUCTURED_CALLABLE_TEST !== "1", timeout: 600_000 }, async t => {
	const reports = [], expected = witStructuredSignatures(witNestedAliasReviewedIr());
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-wit-alias-callback-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-wit-alias-callback-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		const lean = await readFile(join(projectRoot, "Structured.lean"), "utf8");
		const addition = await readFile("tests/fixtures/structured-callable-consumers/wit-aliases.lean", "utf8");
		assert.equal(lean.split("end Structured").length, 2);
		await saveLakeFile(projectRoot, "Structured.lean", lean.replace("end Structured", addition + "\nend Structured"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { "wit-wasi": { name: "structured", version: "1.0.0" } }
			, ...path === "ordinary-source" ? { exports: witNestedAliasExports, arities: { "Structured.makeNestedAlias": 1, "Structured.makeNestedPlain": 1 } } : {} }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(witNestedAliasReviewedIr()));
		const environment = nativeFixtureEnvironment(["wit-wasi"]);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(witStructuredSignatures(model.bindingIr), expected);
		const projection = compileCopiedWitModel(model.bindingIr, {}, { callables: true });
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await rm(author, { recursive: true, force: true }); await rename(incoming, handoff);
		const { command, ...observed } = await installCopiedConsumer({ profile: "wit-wasi"
			, consumer, handoff
			, packages: receipt.packages, environment
			, fixture: { source: () => witNestedAliasConsumer(projection)
				, parseResult: JSON.parse
				, wit: [/call-nested-alias: func/u, /make-nested-alias: func/u] } });
		assert.ok(observed.checks > 1000); assert.equal(observed.result.callbacks, 576);
		assert.equal(observed.result.finalized, 192); assert.equal(observed.result.rejected, 192);
		await rm(handoff, { recursive: true, force: true });
		assert.deepEqual(JSON.parse((await runCopied(command, [], dirname(command))).stdout), observed.result);
		reports.push({ path, ...observed, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeRepeatedExecution: true });
		t.diagnostic(JSON.stringify(observed.result));
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/structured-callables", "wit-aliases.json", canonicalJson({ schemaVersion: 1, reports }));
});
