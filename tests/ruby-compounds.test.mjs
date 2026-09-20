/**
 * Installed Ruby compounds on independently specified ordinary and reviewed paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-fixture.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installRubyCompounds } from "./helpers/ruby-compound-install.mjs";

const enabled = process.env.LEAN_BRIDGE_RUBY_COMPOUND_TEST === "1";
const type = value => value.kind === "primitive" ? value.name : ["array", "option"].includes(value.kind)
	? { [value.kind]: type(value.element) } : ["result", "tuple"].includes(value.kind)
		? { [value.kind]: value.arguments.map(type) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("installed Ruby compounds preserve copied values on both source paths", { skip: !enabled, timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["ruby"]);
	environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
	environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-compound-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-compound-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/npm-compounds", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Compounds"]
			, targets: { rubygems: { name: "compounds-api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: compoundSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(compoundReviewedIr()));
		t.diagnostic(`${path}: compiling Ruby compounds`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["rubygems"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(compoundSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: installing offline, relocating the gem and checking cleanup`);
		const observation = await installRubyCompounds({ consumer, handoff, packages: receipt.packages, environment, projection: compileCopiedRubyModel(model.bindingIr) });
		t.diagnostic(`${path}: ${observation.checks} public assertions and ${observation.faults.checks} injected failures passed`);
		reports.push({ profile: "ruby"
			, path
			, signatures
			, ...observation
			, packages: receipt.packages
			, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/compounds", "ruby.json", canonicalJson({ schemaVersion: 1, reports }));
});
