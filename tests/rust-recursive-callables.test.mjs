/**
 * Original recursive Cargo archives installed offline without their producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { createNativeCallableGraphDescriptor } from "../src/build/native-callable-graph.mjs";
import { compileCallableRustGraphPackageModel } from "../src/backends/rust/callable-graph-model.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { checkRustRecursiveInstallation, installRustRecursiveConsumer } from "./helpers/rust-recursive-callable-install.mjs";
import { nativeRecursiveCallableArities, nativeRecursiveCallableExports, nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { rustRecursiveCallableDocumentation } from "./helpers/rust-recursive-callable-docs.mjs";

test("original recursive Cargo crates preserve callbacks and closures after producer removal", {
	skip: process.env.LEAN_BRIDGE_RUST_RECURSIVE_CALLABLE_TEST !== "1"
	, timeout: 1_800_000
}, async t => {
	const reports = [], reviewed = nativeRecursiveCallableReviewedIr();
	const expected = createNativeCallableGraphDescriptor(reviewed);
	const environment = nativeFixtureEnvironment(["rust"]);
	const documentation = await rustRecursiveCallableDocumentation();
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-rust-recursive-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-rust-recursive-callable-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Structured.lean", documentation.source);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { cargo: { name: "structured-api", version: "1.0.0" } }
			, ...path === "ordinary-source" ? { exports: nativeRecursiveCallableExports, arities: nativeRecursiveCallableArities } : {} }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(reviewed));
		t.diagnostic(`${path}: compiling 33 recursive Rust exports with 18 callback signatures`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cargo"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.equal(model.schemaVersion, path === "ordinary-source" ? 4 : 5);
		assert.equal(model.exports.length, 33); assert.deepEqual(model.copiedGraph.types, expected.types);
		const projection = compileCallableRustGraphPackageModel(model.bindingIr);
		assert.equal(projection.callbacks.size, 18); assert.equal(projection.functions.length, 33);
		const ordered = rows => [...rows].sort((a, b) => (a.id ?? a.bindingId).localeCompare(b.id ?? b.bindingId));
		assert.deepEqual(ordered(projection.descriptor.callbacks), ordered(expected.callbacks));
		assert.deepEqual(ordered(projection.descriptor.exports), ordered(expected.exports));
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await verifyPackageSetReceipt({ receiptPath: join(incoming, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["cargo"]);
		const dependencies = await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory: author, handoff: join(consumer, "dependencies"), environment });
		await rm(author, { recursive: true, force: true }); await rename(incoming, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		t.diagnostic(`${path}: installing the original crate offline without the author or Lean compiler`);
		const { command, ...installation } = await installRustRecursiveConsumer({ consumer, handoff, dependencies, packages: receipt.packages, environment });
		const safety = await checkRustRecursiveInstallation({ consumer, packages: receipt.packages, environment, model: projection });
		const executable = join(consumer, "relocated-consumer"); await cp(command, executable);
		for(const root of [join(consumer, "rust"), handoff, join(consumer, "dependencies")]) await rm(root, { recursive: true, force: true });
		const executed = await runCopied(executable, [], consumer);
		assert.equal(executed.stderr, ""); assert.equal(executed.stdout, `recursive-rust-ok:${installation.checks}\n`);
		t.diagnostic(`${path}: ${installation.checks} public checks passed again after all sources and archives were removed`);
		reports.push({ profile: "rust", path, installation, safety
			, publisher: { sourceSha256: sha256(documentation.author), compiled: true }
			, exports: 33, signatures: 18, dependencies
			, packages: receipt.packages, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model)), receiptSha256
			, sourceRemovedBeforeInstallation: true, relocatedBeforeInstallation: true
			, sourcesAndArchivesRemovedBeforeExecution: true
			, executableSha256: sha256(await readFile(executable)) });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_RUST_RECURSIVE_CALLABLE_REPORT ?? "build/recursive-callables/rust.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
