/**
 * Reproduce each nested checked-record wheel twice, then install on both supported Python floors.
 * Consumers have no author tree, compiler PATH, or network package source.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nestedCheckedRecordFixture, nestedCheckedRecordModule } from "./nested-checked-record-fixture.mjs";
import { nestedCheckedRecordPythonCaller, nestedCheckedRecordPythonConfiguration, nestedCheckedRecordPythonReview, nestedCheckedRecordPythonSelection, nestedCheckedRecordPythonExecutables, nestedCheckedRecordPythonMinors } from "./nested-checked-record-python-fixture.mjs";
import { inspectNestedCheckedRecordPythonWheel } from "./nested-checked-record-python-wheel.mjs";
import { installNestedCheckedRecordPython, probeNestedCheckedRecordPython } from "./nested-checked-record-python-install.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { waitNominalSubtypeDotnetResources as waitResources } from "./nominal-subtype-dotnet-resources.mjs";

const { enabled, routes, modes, maxLoad } = nestedCheckedRecordPythonSelection(process.env);
const executables = enabled ? nestedCheckedRecordPythonExecutables(process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHONS) : null;

for(const route of routes) for(const mode of modes) test(`installed nested checked-record Python packages reproduce and relocate ${route} ${mode}`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	// A source-only dry run must never become installed evidence for another revision.
	for(const path of ["fixture.mjs", "resources.mjs", "wheel.mjs", "install.mjs", "installed-tests.mjs"])
		execFileSync("git", ["ls-files", "--error-unmatch", `tests/helpers/nested-checked-record-python-${path}`]);
	execFileSync("git", ["ls-files", "--error-unmatch", "tests/fixtures/nested-checked-record-consumers/python.py"]);
	execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
	const expected = nestedCheckedRecordPythonReview(mode), configuration = nestedCheckedRecordPythonConfiguration(route, mode);
	const output = resolve(process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_OUTPUT ?? "build/nested-checked-record-python", route, mode);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const resourceChecks = [];
	const resources = async () => {
		resourceChecks.push(await waitResources(output, {
			maxLoad
			, notify: message => t.diagnostic(message.replaceAll("C#", "nested Python"))
		}));
		await saveLakeFile(output, "resources.json", canonicalJson(resourceChecks));
	};
	await resources();
	const interpreters = [];
	for(const minor of nestedCheckedRecordPythonMinors)
		interpreters.push(await probeNestedCheckedRecordPython(minor, executables[minor], output));
	const environment = { ...nativeFixtureEnvironment(["python"]), LEAN_BRIDGE_PYTHON: executables["3.11"] };
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
	assert.match(floor ?? "", /^2\.[0-9]+$/u, "Select the native glibc floor explicitly");
	assert.equal(process.platform, "linux"); assert.equal(process.arch, "x64");
	const runtime = { platform: process.platform, arch: process.arch, glibc: await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], output) };
	assert.equal(runtime.glibc.stderr, ""); assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
	assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1]) >= Number(floor.split(".")[1]));
	await saveLakeFile(output, "runtime.json", canonicalJson(runtime));
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	await saveLakeFile(output, "consumer.py", await nestedCheckedRecordPythonCaller(route));
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-checked-record-python-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Retained failed nested checked-record Python inputs: ${root}`);
	});
	const handoff = join(root, "handoff"), builds = []; let model;
	for(const attempt of [0, 1])
	{
		await resources();
		const author = join(root, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release"), record = join(output, `build-${attempt}`);
		await cp(nestedCheckedRecordFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		const sourceBefore = await lakeInputState(projectRoot);
		t.diagnostic(`${route} ${mode} author ${attempt}: one wheel for Python 3.11 and 3.12`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["pypi"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		assert.deepEqual(await lakeInputState(projectRoot), sourceBefore, "Author inputs remain unchanged");
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")); model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role]), [["pypi", "component"]]);
		await saveLakeFile(record, "model.json", modelBytes);
		await saveLakeFile(record, "package-set-receipt.json", receiptBytes);
		await saveLakeFile(record, "author-inputs.json", canonicalJson(sourceBefore));
		for(const name of [`${nestedCheckedRecordModule}.lean`, "lean-bridge.exports.json"])
			await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
		if(route === "reviewed") await saveLakeFile(record, "api.binding-ir.json", canonicalJson(expected));
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		builds.push({ bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) });
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "Both author roots reproduce the complete wheel");
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json"))), pkg = receipt.packages[0];
	const archive = join(handoff, pkg.artifacts[0].path), inspection = join(root, "inspection");
	await resources();
	const wheel = await inspectNestedCheckedRecordPythonWheel({ root: inspection, archive, pkg, model, floor, output });
	await rm(inspection, { recursive: true }); await assert.rejects(access(inspection), { code: "ENOENT" });
	// Retain the original archive outside /tmp as well as its text records and digests.
	await copyPackageSetHandoff(handoff, join(output, "handoff"));
	const reports = [];
	for(const minor of nestedCheckedRecordPythonMinors)
	{
		await resources();
		t.diagnostic(`Installing ${route}/${mode} on Python ${minor}`);
		const consumer = join(root, `python-${minor}`), record = join(output, minor);
		const report = await installNestedCheckedRecordPython({
			minor, command: executables[minor], route, mode
			, root: consumer, archive, artifact: pkg.artifacts[0]
			, receiptBytes: wheel.receiptBytes, output: record });
		assert.deepEqual(report.interpreter, interpreters.find(item => item.minor === minor)); reports.push(report);
		await rm(consumer + "-relocated", { recursive: true });
	}
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, mode, producerCommit
		, minors: nestedCheckedRecordPythonMinors
		, interpreters, builds, reports, runtime
		, declaredGlibcFloor: floor, expectedBindingIrSha256: hashBindingIr(expected)
		, wheelReceiptSha256: wheel.record.receiptSha256
		, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
		, sourceRemovedBeforeInstallation: true
		, resourceChecks, loadCeiling: maxLoad }));
	complete = true;
});
