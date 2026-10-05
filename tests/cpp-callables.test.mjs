/**
 * Installed C++ callbacks and returned Lean closures, on both source paths.
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
import { cppCallableArities, cppCallableSignatures } from "./helpers/cpp-callable-fixture.mjs";
import { checkCppCallableInstallation } from "./helpers/cpp-callable-install.mjs";
import { nativeFixtureEnvironment, installCopiedConsumer } from "./helpers/copied-fixture-install.mjs";

const enabled = process.env.LEAN_BRIDGE_CPP_CALLABLE_TEST === "1";
const type = value => value.kind === "primitive" ? value.name
	: { callback: { parameters: value.parameters.map(type), result: type(value.result) } };

test("installed C++ callbacks and returned closures preserve all nineteen primitives on both source paths", { skip: !enabled, timeout: 900_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-callable-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/callables", projectRoot, { recursive: true });
		for(const name of ["Lifetimes", "Cpp"]) await saveLakeFile(projectRoot, `Callables/${name}.lean`, await readFile(`tests/fixtures/callable-consumers/${name}.lean`, "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Callables", "Callables.Lifetimes", "Callables.Cpp"]
			, targets: { cpp: { name: "callables-api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: cppCallableSignatures.map(entry => entry.name), arities: cppCallableArities } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "callables.binding-ir.json", canonicalJson(callableReviewedIr(cppCallableSignatures)));
		const environment = nativeFixtureEnvironment(["cpp"]);
		t.diagnostic(`${path}: compiling the 60-export C++ callable library`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cpp"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		const nativeRelease = JSON.parse(await readFile(join(outputRoot, "native-release.json"), "utf8"));
		assert.equal(nativeRelease.glibcMinimumVersion, environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38");
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(cppCallableSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(directory, { recursive: true, force: true });
		t.diagnostic(`${path}: installing the relocated archive offline without author inputs or Lean/C compilation`);
		const observation = await installCopiedConsumer({ profile: "cpp"
			, consumer, handoff
			, packages: receipt.packages, environment
			, fixture: {
				source: () => readFile("tests/fixtures/callable-consumers/cpp.cpp", "utf8")
				, success: "callable-cpp-ok" } });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const safety = await checkCppCallableInstallation({ consumer, packages: receipt.packages, command: observation.command });
		const { command, ...observed } = observation; void command;
		reports.push({ profile: "cpp", path, signatures
			, ...observed, safety
			, glibcMinimumVersion: nativeRelease.glibcMinimumVersion
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_CPP_CALLABLE_REPORT ?? "build/callables/cpp.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
