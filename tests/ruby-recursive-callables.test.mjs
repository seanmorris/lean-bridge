/**
 * Original recursive RubyGems archives installed without their producer.
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
import { compileCallableRubyGraphPackageModel } from "../src/backends/ruby/callable-graph-model.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installRubyRecursiveCallables } from "./helpers/ruby-recursive-callable-install.mjs";
import { nativeRecursiveCallableArities, nativeRecursiveCallableExports, nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { rubyRecursiveCallableDocumentation } from "./helpers/ruby-recursive-callable-docs.mjs";

test("original recursive Ruby gems preserve callbacks and closures after producer removal", {
	skip: process.env.LEAN_BRIDGE_RUBY_RECURSIVE_CALLABLE_TEST !== "1"
	, timeout: 1_800_000
}, async t => {
	const reports = [], reviewed = nativeRecursiveCallableReviewedIr();
	const expected = createNativeCallableGraphDescriptor(reviewed);
	const environment = nativeFixtureEnvironment(["ruby"]);
	environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
	const documentation = await rubyRecursiveCallableDocumentation();
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-ruby-recursive-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-ruby-recursive-callable-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Structured.lean", documentation.source);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { rubygems: { name: "structured-api", version: "1.0.0" } }
			, ...path === "ordinary-source" ? { exports: nativeRecursiveCallableExports, arities: nativeRecursiveCallableArities } : {} }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(reviewed));
		t.diagnostic(`${path}: compiling 33 recursive Ruby exports with 18 callback signatures`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["rubygems"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.equal(model.schemaVersion, path === "ordinary-source" ? 4 : 5);
		assert.equal(model.exports.length, 33); assert.deepEqual(model.copiedGraph.types, expected.types);
		const projection = compileCallableRubyGraphPackageModel(model.bindingIr);
		assert.equal(projection.callbacks.size, 18); assert.equal(projection.functions.length, 33);
		const ordered = rows => [...rows].sort((a, b) => (a.id ?? a.bindingId).localeCompare(b.id ?? b.bindingId));
		assert.deepEqual(ordered(projection.descriptor.callbacks), ordered(expected.callbacks));
		assert.deepEqual(ordered(projection.descriptor.exports), ordered(expected.exports));
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await verifyPackageSetReceipt({ receiptPath: join(incoming, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["rubygems"]);
		await rm(author, { recursive: true, force: true }); await rename(incoming, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		t.diagnostic(`${path}: installing the original gem offline without the author or Lean compiler`);
		const installation = await installRubyRecursiveCallables({ consumer, handoff, packages: receipt.packages, environment, projection, documented: documentation.consumer });
		t.diagnostic(`${path}: ${installation.public.checks} recursive checks, ${installation.acyclic.checks} acyclic checks, ${installation.faults.faults} injected failures`);
		reports.push({ profile: "ruby", path, installation
			, publisher: { sourceSha256: sha256(documentation.author), compiled: true }
			, exports: 33, signatures: 18, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model)), receiptSha256
			, sourceRemovedBeforeInstallation: true
			, relocatedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_RUBY_RECURSIVE_CALLABLE_REPORT ?? "build/recursive-callables/ruby.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
