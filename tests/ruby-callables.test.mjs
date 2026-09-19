/**
 * Installed Ruby callbacks and returned Lean closures, on both source paths.
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
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { rubyCallableArities, rubyCallableSignatures } from "./helpers/ruby-callable-fixture.mjs";
import { nativeFixtureEnvironment, installCopiedConsumer } from "./helpers/copied-fixture-install.mjs";

const enabled = process.env.LEAN_BRIDGE_RUBY_CALLABLE_TEST === "1";
const type = value => value.kind === "primitive" ? value.name
	: { callback: { parameters: value.parameters.map(type), result: type(value.result) } };

test("installed Ruby callbacks and returned closures preserve all nineteen primitives on both source paths", { skip: !enabled, timeout: 900_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-callable-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/callables", projectRoot, { recursive: true });
		for(const name of ["Lifetimes", "Ruby"]) await saveLakeFile(projectRoot, `Callables/${name}.lean`, await readFile(`tests/fixtures/callable-consumers/${name}.lean`, "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Callables", "Callables.Lifetimes", "Callables.Ruby"]
			, targets: { rubygems: { name: "callables-api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: rubyCallableSignatures.map(entry => entry.name), arities: rubyCallableArities } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "callables.binding-ir.json", canonicalJson(callableReviewedIr(rubyCallableSignatures)));
		const environment = nativeFixtureEnvironment(["ruby"]);
		t.diagnostic(`${path}: compiling the 60-export Ruby callable library`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["rubygems"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(rubyCallableSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(directory, { recursive: true, force: true });
		t.diagnostic(`${path}: installing the relocated gem offline without author inputs or compilers`);
		const observation = await installCopiedConsumer({ profile: "ruby"
			, consumer, handoff
			, packages: receipt.packages, environment
			, fixture: {
				source: () => readFile("tests/fixtures/callable-consumers/ruby.rb", "utf8")
				, success: "callable-ruby-ok" } });
		const { command, ...observed } = observation; void command;
		reports.push({ profile: "ruby", path, signatures
			, ...observed
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_RUBY_CALLABLE_REPORT ?? "build/callables/ruby.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
