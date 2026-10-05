/**
 * Installed Rust callbacks and returned Lean closures, on both source paths.
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
import { rustCallableArities, rustCallableSignatures } from "./helpers/rust-callable-fixture.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { checkRustCallableInstallation } from "./helpers/rust-callable-install.mjs";
import { nativeFixtureEnvironment, installCopiedConsumer } from "./helpers/copied-fixture-install.mjs";

const enabled = process.env.LEAN_BRIDGE_RUST_CALLABLE_TEST === "1";
const type = value => value.kind === "primitive" ? value.name
	: { callback: { parameters: value.parameters.map(type), result: type(value.result) } };

test("installed Rust callbacks and returned closures preserve all nineteen primitives on both source paths", { skip: !enabled, timeout: 900_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-rust-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-rust-callable-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/callables", projectRoot, { recursive: true });
		for(const name of ["Lifetimes", "Rust"]) await saveLakeFile(projectRoot, `Callables/${name}.lean`, await readFile(`tests/fixtures/callable-consumers/${name}.lean`, "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Callables", "Callables.Lifetimes", "Callables.Rust"]
			, targets: { cargo: { name: "callables-api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: rustCallableSignatures.map(entry => entry.name), arities: rustCallableArities } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "callables.binding-ir.json", canonicalJson(callableReviewedIr(rustCallableSignatures)));
		const environment = nativeFixtureEnvironment(["rust"]);
		t.diagnostic(`${path}: compiling the 60-export Rust callable library`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cargo"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(rustCallableSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const dependencies = await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory, handoff: join(consumer, "dependencies"), environment });
		await rm(directory, { recursive: true, force: true });
		t.diagnostic(`${path}: installing the relocated crate offline without author inputs or Lean/C compilation`);
		const observation = await installCopiedConsumer({ profile: "rust"
			, consumer, handoff, dependencies
			, packages: receipt.packages, environment
			, fixture: {
				source: () => readFile("tests/fixtures/callable-consumers/rust.rs", "utf8")
				, success: "callable-rust-ok" } });
		const safety = await checkRustCallableInstallation({ consumer, environment, packages: receipt.packages, command: observation.command });
		const { command, ...observed } = observation; void command;
		reports.push({ profile: "rust", path, signatures
			, ...observed, safety
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_RUST_CALLABLE_REPORT ?? "build/callables/rust.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
