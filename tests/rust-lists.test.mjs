/**
 * Installed Rust lists on ordinary-source and independent reviewed paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { listReviewedIr, listSignatures } from "./helpers/list-fixture.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { checkRustListInstallation } from "./helpers/rust-list-install.mjs";

const enabled = process.env.LEAN_BRIDGE_RUST_LIST_TEST === "1";
const type = value => value.kind === "primitive" ? value.name : ["array", "list", "option"].includes(value.kind)
	? { [value.kind]: type(value.element) } : ["result", "tuple"].includes(value.kind)
		? { [value.kind]: value.arguments.map(type) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("installed Rust lists preserve copied values on both source paths", { skip: !enabled, timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["rust"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-rust-list-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-rust-list-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/npm-lists", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Lists"]
			, targets: { cargo: { name: "lists-api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: listSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(listReviewedIr()));
		t.diagnostic(`${path}: compiling Rust lists`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cargo"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(listSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const dependencies = await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory: author, handoff: join(consumer, "dependencies"), environment });
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: installing the relocated crate without producer files or Lean/C compilers`);
		const { command, ...observation } = await installCopiedConsumer({ profile: "rust"
			, consumer, handoff, dependencies, packages: receipt.packages, environment
			, fixture: { source: () => readFile("tests/fixtures/list-consumers/rust.rs", "utf8"), success: "list-rust-ok" } });
		const safety = await checkRustListInstallation({ consumer, environment, packages: receipt.packages, command, projection: compileCopiedRustModel(model.bindingIr) });
		assert.equal(safety.sourceFreeChecks, observation.checks);
		reports.push({ profile: "rust"
			, path
			, signatures
			, ...observation
			, safety
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/lists", "rust.json", canonicalJson({ schemaVersion: 1, reports }));
});
