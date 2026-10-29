/**
 * Reproduce dependent checked-record wheels twice, then consume every
 * declared CPython floor without source, compiler, package index or relocation
 * assumptions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	readVerifiedPackageSetReceipt, verifyPackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import {
	dependentCheckedRecordPythonExecutables, dependentCheckedRecordPythonMinors
	, dependentCheckedRecordPythonFixtureRoot
	, dependentCheckedRecordPythonLeanModule
	, dependentCheckedRecordPythonRunSelection, dependentCheckedRecordPythonSelection
} from "./dependent-checked-record-python-fixture.mjs";
import {
	installDependentCheckedRecordPython, probeDependentCheckedRecordPython
} from "./dependent-checked-record-python-install.mjs";
import {
	inspectDependentCheckedRecordPythonWheel
} from "./dependent-checked-record-python-wheel.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

const { enabled, routes } = dependentCheckedRecordPythonRunSelection(process.env);
const executables = enabled
	? dependentCheckedRecordPythonExecutables(process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHONS)
	: null;

for(const route of routes) test(
	`installed dependent checked-record Python packages reproduce and relocate for ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
		assert.doesNotThrow(() => execFileSync("git", [
			"diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"
		], { stdio: "ignore" }), "Installed evidence requires clean tracked source");
		const output = resolve(process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_OUTPUT
			?? "build/dependent-checked-record-python", route);
		await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
		const selection = dependentCheckedRecordPythonSelection(route);
		const environment = {
			...nativeFixtureEnvironment(["python"])
			, LEAN_BRIDGE_PYTHON: executables["3.11"]
		};
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
		assert.match(floor ?? "", /^2\.[0-9]+$/u);
		assert.deepEqual([process.platform, process.arch], ["linux", "x64"]);
		const glibc = await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], output);
		assert.equal(glibc.stderr, ""); assert.match(glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
		assert.ok(Number(glibc.stdout.match(/2\.([0-9]+)/u)[1]) >= Number(floor.split(".")[1]));
		const runtime = { platform: process.platform, arch: process.arch, glibc: glibc.stdout.trim().slice(6) };
		await saveLakeFile(output, "runtime.json", canonicalJson(runtime));
		await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(selection.expected));
		await saveLakeFile(output, "configuration.json", canonicalJson(selection.configuration));
		const interpreters = [];
		for(const minor of dependentCheckedRecordPythonMinors)
			interpreters.push(await probeDependentCheckedRecordPython(
				minor, executables[minor], output));
		await saveLakeFile(output, "interpreters.json", canonicalJson(interpreters));
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-dependent-checked-record-python-"
		));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed dependent checked-record Python inputs: ${root}`);
		});
		const handoff = join(root, "handoff"), builds = []; let model;
		for(const attempt of [0, 1])
		{
			const author = join(root, `author-${attempt}`);
			const projectRoot = join(author, "project"), outputRoot = join(author, "release");
			const record = join(output, `build-${attempt}`);
			await cp(dependentCheckedRecordPythonFixtureRoot, projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(selection.configuration));
			if(selection.reviewed)
				await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(selection.expected));
			const sourceBefore = await lakeInputState(projectRoot);
			t.diagnostic(`${route} dependent checked-record Python author ${attempt}: one wheel for both floors`);
			const built = await buildCanonicalProject({
				projectRoot, outputRoot, targets: ["pypi"], environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`; throw error;
			});
			assert.deepEqual(await lakeInputState(projectRoot), sourceBefore);
			const modelBytes = await readFile(join(outputRoot, "native/component/model.json"));
			model = JSON.parse(modelBytes);
			assert.equal(reviewedContractDifference(selection.expected, model.bindingIr), null);
			if(selection.reviewed)
				assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(selection.expected));
			else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
			const receiptPath = join(outputRoot, "package-set-receipt.json");
			const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath });
			assert.deepEqual(receipt.packages.map(item => [item.target, item.role]), [["pypi", "component"]]);
			for(const [name, bytes] of [
				["model.json", modelBytes]
				, ["package-set-receipt.json", await readFile(receiptPath)]
				, ["author-inputs.json", canonicalJson(sourceBefore)]
			]) await saveLakeFile(record, name, bytes);
			for(const name of [`${dependentCheckedRecordPythonLeanModule}.lean`, "lean-bridge.exports.json"])
				await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
			if(selection.reviewed)
				await saveLakeFile(record, "api.binding-ir.json", canonicalJson(selection.expected));
			if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
			builds.push({
				bindingIrSha256: built.bindingIrSha256, modelSha256: sha256(modelBytes)
				, receiptSha256: sha256(canonicalJson(receipt))
				, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
					pkg.artifacts.map(artifact => [artifact.path, artifact.sha256])))
			});
			await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0], "Independent author roots reproduce the complete wheel");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const { receipt } = await readVerifiedPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		const pkg = receipt.packages[0], archive = join(handoff, pkg.artifacts[0].path);
		const inspection = join(root, "inspection");
		const wheel = await inspectDependentCheckedRecordPythonWheel({
			root: inspection, archive, pkg, model, floor, output
		});
		await rm(inspection, { recursive: true }); await assert.rejects(access(inspection), { code: "ENOENT" });
		await copyPackageSetHandoff(handoff, join(output, "handoff"));
		const reports = [];
		for(const minor of dependentCheckedRecordPythonMinors)
		{
			t.diagnostic(`Installing ${route} on Python ${minor}`);
			const consumer = join(root, `python-${minor}`), record = join(output, minor);
			const report = await installDependentCheckedRecordPython({
				minor, command: executables[minor], route, root: consumer, archive
				, artifact: pkg.artifacts[0], receiptBytes: wheel.receiptBytes
				, output: record
			});
			assert.deepEqual(report.interpreter, interpreters.find(item => item.minor === minor));
			reports.push(report); await rm(consumer + "-relocated", { recursive: true });
		}
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await saveLakeFile(output, "report.json", canonicalJson({
			schemaVersion: 1, route, producerCommit, runtime, glibcMinimumVersion: floor
			, minors: dependentCheckedRecordPythonMinors, interpreters, builds, reports
			, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
			, sourceRemovedBeforeInstallation: true
			, expectedBindingIrSha256: hashBindingIr(selection.expected)
			, wheelReceiptSha256: wheel.record.receiptSha256
		}));
		complete = true;
	}
);
