/**
 * Real recursive callable Python wheels from both independently checked sources.
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
import { compileCallablePythonGraphPackageModel } from "../src/backends/python/callable-graph-model.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { nativeRecursiveCallableArities, nativeRecursiveCallableExports, nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { installPythonRecursiveCallables } from "./helpers/python-recursive-callable-install.mjs";
import { pythonRecursiveCallableDocumentation } from "./helpers/python-recursive-callable-docs.mjs";

test("original recursive Python wheels preserve callbacks and closures without the producer", {
	skip: process.env.LEAN_BRIDGE_PYTHON_RECURSIVE_CALLABLE_TEST !== "1"
	, timeout: 1_800_000
}, async t => {
	const reports = [], reviewed = nativeRecursiveCallableReviewedIr();
	const expected = createNativeCallableGraphDescriptor(reviewed);
	const documentation = await pythonRecursiveCallableDocumentation();
	const environment = nativeFixtureEnvironment(["python"]);
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2); environment.LEAN_BRIDGE_PYTHON ??= interpreters[0];
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	const checkerVersion = (await runCopied(checker, ["-I", "-m", "mypy", "--version"], process.cwd())).stdout.trim();
	assert.match(checkerVersion, /^mypy 2\.3\.1\b/u);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-python-recursive-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-python-recursive-callable-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Structured.lean", documentation.source);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { pypi: { name: "structured-api", version: "1.0.0" } }
			, ...path === "ordinary-source" ? { exports: nativeRecursiveCallableExports, arities: nativeRecursiveCallableArities } : {} }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(reviewed));
		t.diagnostic(`${path}: compiling 33 recursive Python exports with 18 callback signatures`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["pypi"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.equal(model.schemaVersion, path === "ordinary-source" ? 4 : 5);
		assert.equal(model.exports.length, 33);
		// Native names come from the source path; public recursive semantics must
		// agree with the independent review, including callback-only aliases.
		assert.deepEqual(model.copiedGraph.types, expected.types);
		const projection = compileCallablePythonGraphPackageModel(model.bindingIr);
		assert.equal(projection.callbacks.size, 18); assert.equal(projection.functions.length, 33);
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await verifyPackageSetReceipt({ receiptPath: join(incoming, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["pypi"]);
		await rm(author, { recursive: true, force: true }); await rename(incoming, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		t.diagnostic(`${path}: installing original wheels offline on Python 3.11/3.12 with minimum/current typing dependencies`);
		const installations = await installPythonRecursiveCallables({ consumer, handoff, packages: receipt.packages, interpreters, checker });
		t.diagnostic(`${path}: ${installations[0].public.checks} recursive checks and ${installations[0].faults.faults} injected failures per installation`);
		reports.push({ profile: "python", path, installations, checkerVersion
			, exports: 33, signatures: 18
			, packages: receipt.packages, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model)), receiptSha256
			, publisher: { sourceSha256: sha256(documentation.author), compiled: true }
			, sourceRemovedBeforeInstallation: true
			, relocatedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PYTHON_RECURSIVE_CALLABLE_REPORT ?? "build/recursive-callables/python.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
