/**
 * Reproduce dependent checked-record checked-record WIT archives and execute their actual Component Model hosts.
 * Installed acceptance of the dependent checked-record checked-record contract (#1477) for Wasmtime C consumers,
 * not a constructor/source entry measurement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { dependentCheckedRecordSelection } from "./dependent-checked-record-browser-fixture.mjs";
import { dependentCheckedRecordWitFixtureRoot, dependentCheckedRecordWitLeanModule } from "./dependent-checked-record-wit-fixture.mjs";
import {
	dependentCheckedRecordWitCaller, dependentCheckedRecordWitConfiguration
	, dependentCheckedRecordWitSelection, parseDependentCheckedRecordWitResult
} from "./dependent-checked-record-wit-fixture.mjs";
import { installDependentCheckedRecordWit, verifyDependentCheckedRecordWitEnvironment } from "./dependent-checked-record-wit-install.mjs";
import { inspectNominalSubtypeWitTools, nominalSubtypeWitToolSelection } from "./nominal-subtype-wit-tools.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

const { enabled, routes, maxLoad } = dependentCheckedRecordWitSelection(process.env);

for(const route of routes) test(`installed dependent checked records reproduce and relocate in WIT for ${route}`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	for(const name of ["fixture", "resources", "package", "install", "installed-tests"])
		execFileSync("git", ["ls-files", "--error-unmatch", `tests/helpers/dependent-checked-record-wit-${name}.mjs`]);
	for(const name of ["wit-wasi.c", "wit-values.h"])
		execFileSync("git", ["ls-files", "--error-unmatch", `tests/fixtures/dependent-checked-record-wit/${name}`]);
	execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
	const selection = dependentCheckedRecordSelection(route);
	const mode = selection.resultOnly ? "result-only" : "full";
	const expected = selection.expected, configuration = dependentCheckedRecordWitConfiguration(route);
	const output = resolve(process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_OUTPUT
		?? "build/dependent-checked-record-wit", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const resourceChecks = [];
	const resourceCheck = async () => {
		resourceChecks.push(await waitNominalSubtypeDotnetResources(output, { maxLoad, notify: message => t.diagnostic(message) }));
		await saveLakeFile(output, "resources.json", canonicalJson(resourceChecks));
	};
	await resourceCheck();
	const environment = { ...nativeFixtureEnvironment(["wit-wasi"]), LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1" };
	const selected = nominalSubtypeWitToolSelection(environment), tools = await inspectNominalSubtypeWitTools(selected, output);
	environment.CC = tools.commands.cc.command; environment.LEAN_BRIDGE_WASM_TOOLS = tools.commands.wasmTools.command;
	environment.LEAN_BRIDGE_WASMTIME_C_API = tools.wasmtime.root;
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
	assert.match(floor ?? "", /^2\.[0-9]+$/u, "Select the native glibc floor explicitly");
	assert.equal(process.platform, "linux"); assert.equal(process.arch, "x64");
	const runtime = { platform: process.platform, arch: process.arch
		, glibc: await runCopied(tools.commands.getconf.command, ["GNU_LIBC_VERSION"], output) };
	assert.equal(runtime.glibc.stderr, ""); assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
	assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1]) >= Number(floor.split(".")[1]));
	for(const [path, value] of Object.entries({ "tools.json": tools, "runtime.json": runtime, "expected.binding-ir.json": expected, "configuration.json": configuration }))
		await saveLakeFile(output, path, canonicalJson(value));
	const source = await readFile(join(dependentCheckedRecordWitFixtureRoot, `${dependentCheckedRecordWitLeanModule}.lean`), "utf8");
	const caller = await dependentCheckedRecordWitCaller(route); await saveLakeFile(output, "consumer.c", caller);
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dependent checked-record-wit-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Retained failed dependent checked-record checked-record WIT inputs: ${root}`);
	});
	// The retained handoff is the installation source; do not duplicate large archives in /tmp.
	const handoff = join(output, "handoff"), builds = []; let model;
	for(const attempt of [0, 1])
	{
		await resourceCheck();
		const author = join(root, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release"), record = join(output, `build-${attempt}`);
		await cp(dependentCheckedRecordWitFixtureRoot, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(selection.reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		const sourceBefore = await lakeInputState(projectRoot);
		t.diagnostic(`${route} ${mode} author ${attempt}: reproducible WIT package`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		assert.deepEqual(await lakeInputState(projectRoot), sourceBefore);
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")); model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.exports.length, selection.resultOnly ? 6 : 11);
		if(selection.reviewed) assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role]), [["wit-wasi", "component"]]);
		for(const [path, bytes] of [["model.json", modelBytes]
			, ["package-set-receipt.json", receiptBytes]
			, ["author-inputs.json", canonicalJson(sourceBefore)]
			, [`${dependentCheckedRecordWitLeanModule}.lean`, source]
			, ["lean-bridge.exports.json", canonicalJson(configuration)]])
			await saveLakeFile(record, path, bytes);
		if(selection.reviewed) await saveLakeFile(record, "api.binding-ir.json", canonicalJson(expected));
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		builds.push({ bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) });
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "Both author roots reproduce the complete WIT handoff");
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json"))), pkg = receipt.packages[0];
	await resourceCheck();
	const consumer = join(root, "consumer"); await mkdir(consumer);
	const { context, packaged } = await installDependentCheckedRecordWit({ root: consumer, archive: join(handoff, pkg.artifacts[0].path), pkg, model, floor, tools, caller, output });
	const observations = [];
	for(const [position, location] of [consumer, consumer + "-relocated"].entries())
	{
		if(position)
		{ await rename(consumer, location); await assert.rejects(access(consumer), { code: "ENOENT" }); }
		await resourceCheck();
		const relocated = { ...context, root: location }, before = await verifyDependentCheckedRecordWitEnvironment(relocated);
		const command = join(location, "consumer"), args = [], run = await runCopied(command, args, location);
		assert.equal(run.stderr, ""); const counts = parseDependentCheckedRecordWitResult(run.stdout, mode);
		assert.deepEqual(await verifyDependentCheckedRecordWitEnvironment(relocated), before);
		const observation = { relocated: Boolean(position), command, args, cwd: location, environment: copiedCleanEnvironment, run, counts, closure: before };
		observations.push(observation);
		await saveLakeFile(output, `${position ? "relocated" : "installed"}.json`, canonicalJson(observation));
	}
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const toolsAfter = await inspectNominalSubtypeWitTools(selected, output);
	await saveLakeFile(output, "tools-after.json", canonicalJson(toolsAfter)); assert.deepEqual(toolsAfter, tools);
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, mode, producerCommit, runtime, tools
		, configuration, builds, receipt, observations, declaredGlibcFloor: floor
		, expectedBindingIrSha256: hashBindingIr(expected)
		, packageReceiptSha256: packaged.receiptSha256
		, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
		, sourceRemovedBeforeInstallation: true, offlineInstall: true
		, callerCompiledOnce: true, callerSourceRemovedBeforeExecution: true
		, compilerFreeReplay: true, relocatedInstallation: true
		, componentModel: { nativeHostRequired: true, standaloneWasi: false }
		, dispatch: { observed: false, reason: "No constructor/source entry counters in this installed acceptance" }
		, resourceChecks, loadCeiling: maxLoad }));
	complete = true;
});
