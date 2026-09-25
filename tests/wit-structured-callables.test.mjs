/**
 * Installed structured Component Model callbacks from both source paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { structuredCallableArities, structuredCallableExports, structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { witStructuredConsumer, witStructuredSignatures } from "./helpers/wit-structured-callable-fixture.mjs";
import { nativeFixtureEnvironment, installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";

const inventory = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => {
	const bytes = await readFile(join(root, path)); return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
})));

test("installed WIT structured callbacks preserve eight shapes and source-free closure ownership", { skip: process.env.LEAN_BRIDGE_WIT_STRUCTURED_CALLABLE_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], expected = witStructuredSignatures(structuredCallableReviewedIr());
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-wit-structured-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-wit-structured-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { "wit-wasi": { name: "structured", version: "1.0.0" } }
			, ...path === "ordinary-source" ? { exports: structuredCallableExports()
				, arities: Object.fromEntries(Object.entries(structuredCallableArities).filter(([name]) => structuredCallableExports().includes(name))) } : {} }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(structuredCallableReviewedIr()));
		const environment = nativeFixtureEnvironment(["wit-wasi"]);
		t.diagnostic(`${path}: compiling structured callbacks and the native WIT host`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(witStructuredSignatures(model.bindingIr), expected);
		const projection = compileCopiedWitModel(model.bindingIr, {}, { callables: true });
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await verifyPackageSetReceipt({ receiptPath: join(incoming, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true }); await rename(incoming, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		t.diagnostic(`${path}: installing relocated archives and executing without author sources or compilers`);
		const { command, ...observed } = await installCopiedConsumer({ profile: "wit-wasi"
			, consumer, handoff
			, packages: receipt.packages, environment
			, fixture: { source: () => witStructuredConsumer(projection)
				, parseResult: JSON.parse
				, wit: [/resource function-payload-to-payload;/u, /call-record: func\(/u, /make-variant: func\(/u] } });
		assert.ok(command); assert.ok(observed.checks > 10000); assert.equal(observed.result.shapes, 8);
		assert.ok(observed.result.rejected > 30); assert.ok(observed.result.callbacks > 2000);
		const pkg = receipt.packages.find(item => item.role === "component");
		const installed = join(consumer, "wit-wasi", `${pkg.name}-${pkg.version}-wit-wasi`);
		const packageReceipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json"), "utf8"));
		const before = await inventory(installed);
		const readme = await readFile(join(installed, "README.md"), "utf8");
		assert.match(readme, /Callback arguments, replies and captured values also accept arrays/u);
		assert.doesNotMatch(readme, /outside callable signatures|Callbacks with arrays.*unsupported/u);
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(handoff, { recursive: true, force: true });
		const repeated = await runCopied(command, [], dirname(command));
		assert.equal(repeated.stderr, "");
		assert.deepEqual(JSON.parse(repeated.stdout), observed.result);
		await verifyNativeFiles(installed, packageReceipt.files);
		assert.deepEqual(await inventory(installed), before);
		const libraries = {};
		for(const name of observed.result.libraries)
		{
			const file = resolve(name);
			if(!file.startsWith(installed + "/")) continue;
			const relative = file.slice(installed.length + 1);
			libraries[basename(file)] = { path: relative, sha256: sha256(await readFile(file)) };
			assert.equal(libraries[basename(file)].sha256, packageReceipt.files[relative].sha256);
		}
		assert.equal(Object.keys(libraries).length, 6);
		for(const library of ["libstructured_wasmtime.so", "libstructured.so", "libwasmtime.so", "liblean_bridge_native.so", "libleanshared.so"])
			assert.ok(libraries[library], library);
		reports.push({ profile: "wit-wasi", path, signatures: expected
			, ...observed, packages: receipt.packages
			, bindingIr: model.bindingIr
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256, libraries, installedFiles: before
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeRepeatedExecution: true
			, installedFilesUnchanged: true
			, repeatedExecution: JSON.parse(repeated.stdout) });
		t.diagnostic(JSON.stringify(observed.result)); await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve("build/structured-callables/wit.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
