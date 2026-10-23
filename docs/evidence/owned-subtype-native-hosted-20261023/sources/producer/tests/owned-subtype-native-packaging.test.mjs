/**
 * Source-free C/C++ acceptance for proof-erased checked owned aggregates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCppPackage } from "../src/backends/cpp/owned-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { readVerifiedNativeComponent, readVerifiedNativeRuntime } from "../src/build/native-artifacts.mjs";
import { packageOwnedNativeC } from "../src/release/owned-c-package.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedSubtypeCallbackPackageReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	clearOwnedSubtypeRetainedPackages, retainOwnedSubtypeRoute
	, verifyOwnedSubtypeRetainedPackages
	, writeOwnedSubtypeRetainedPackages
} from "./helpers/owned-subtype-retained-packages.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_SUBTYPE_NATIVE_TEST === "1";
const json = async path => JSON.parse(await readFile(path, "utf8"));
const reports = [];
const retainedEntries = [];
const reportPath = resolve("build/owned-subtype-native-packaging/report.json");
const expectedChecks = Object.freeze({ c: 149, cpp: 79 });
if(enabled) await clearOwnedSubtypeRetainedPackages(reportPath);

test.after(async () => {
	if(enabled && reports.length === 2)
	{
		const report = {
			schemaVersion: 1, profile: "installed-owned-subtype-native"
			, reports: reports.toSorted((left, right) => Number(left.reviewed) - Number(right.reviewed))
		};
		await saveLakeFile("build/owned-subtype-native-packaging", "report.json"
			, canonicalJson(report));
		await writeOwnedSubtypeRetainedPackages(reportPath, retainedEntries);
		await verifyOwnedSubtypeRetainedPackages(dirname(reportPath), report);
	}
});

test("owned Subtype and callback native consumers match generated headers", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-subtype-native-headers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const generated = generateOwnedCppPackage(ownedSubtypeCallbackPackageReviewedIr(), {
		transferredInputs: true, anchoredResults: true, hostCallbacks: true
	});
	assert.equal(generated.c.callbacks.length, 1);
	assert.ok(generated.c.copies?.some(copy => copy.id === "lean:Owned.Bundle"));
	for(const [path, source] of Object.entries({
		...generated.files, [`include/${generated.c.prefix}.h`]: generated.c.header
	})) await saveLakeFile(directory, path, source);
	for(const [profile, compiler, standard] of [
		["c", "/usr/bin/cc", "c11"], ["cpp", "/usr/bin/c++", "c++20"]
	]) {
		const source = await readFile(`tests/fixtures/structured-types/owned-subtype-installed.${profile}`, "utf8");
		if(profile === "cpp")
		{
			const transferred = source.indexOf("auto moved = api::transfer_record");
			const raiiClose = source.indexOf("raiiSurvivor.close()", transferred);
			const finalClose = source.indexOf("retained.close()", raiiClose);
			assert.ok(transferred >= 0 && raiiClose > transferred && finalClose > raiiClose);
			assert.match(source.slice(transferred, raiiClose), /retained\.is_closed\(\)/u);
			assert.match(source.slice(raiiClose, finalClose), /api::serial\(kept\) == 41/u);
			assert.doesNotMatch(source.slice(raiiClose, finalClose), /api::serial\(retained\)/u);
		}
		await saveLakeFile(directory, `consumer.${profile}`, source);
		await runCopied(compiler, [`-std=${standard}`, "-Wall", "-Wextra", "-Werror"
			, "-I", "include", "-fsyntax-only", `consumer.${profile}`], directory
		, { PATH: "/usr/bin:/bin" });
	}
});

test("owned Subtype native acceptance is a required recurring workflow", async () => {
	const source = await readFile(".github/workflows/owned-subtype-native.yml", "utf8");
	for(const required of [
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
		, "cancel-in-progress: true"
		, "npm run test:owned-subtype-native"
		, "rg '^# fail 0$'"
		, "rg '^# skipped 0$'"
		, "test -s build/owned-subtype-native-packaging/report.json"
		, "test -s build/owned-subtype-native-packaging/retained-packages.json"
		, "if: always()\n        uses: actions/upload-artifact@v7"
		, "if: always() && steps.acceptance.outcome != 'success'"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error:\s*true/u);
});

const relocate = async ({ root, profile, pkg, source, success, sanitize = false }) => {
	const installed = join(root, `${pkg.name}-${pkg.version}-${profile}`);
	const relocated = join(root, "relocated-package"); await rename(installed, relocated);
	const manifest = await json(join(relocated, "lean-bridge-package.json"));
	const tools = join(root, "tools");
	const environment = { ...copiedCleanEnvironment, PATH: tools
		, PKG_CONFIG_LIBDIR: join(relocated, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", manifest.pkgConfig], root, environment))
		.stdout.trim().split(/\s+/u);
	const compiler = profile === "cpp" ? "/usr/bin/c++" : "/usr/bin/cc";
	const standard = profile === "cpp" ? "c++20" : "c11";
	const extension = profile === "cpp" ? "cpp" : "c";
	const executable = join(root, "relocated-consumer");
	await runCopied(compiler, [
		`-std=${standard}`, "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
		, `consumer.${extension}`, ...flags, "-o", executable], root, environment);
	const relocatedRun = await runCopied(executable, [], root);
	assert.equal(relocatedRun.stderr, ""); assert.match(relocatedRun.stdout, new RegExp(`^${success}:[0-9]+\\n$`, "u"));
	let sanitizer = null;
	if(sanitize)
	{
		const command = join(root, "sanitized-consumer");
		await runCopied(compiler, [
			`-std=${standard}`, "-O1", "-g", "-Wall", "-Wextra", "-Werror"
			, "-UNDEBUG"
			, "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-no-pie"
			, `consumer.${extension}`, ...flags, "-o", command], root, environment);
		const runtime = { ...copiedCleanEnvironment
			, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
			, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1"
			, LSAN_OPTIONS: "exitcode=0" };
		const cold = await runCopied(command, [], root, { ...runtime, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
		const exercised = await runCopied(command, [], root, runtime);
		assert.equal(cold.stdout, "cold\n"); assert.match(exercised.stdout, new RegExp(`^${success}:[0-9]+\\n$`, "u"));
		assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
		const normalize = value => value.replace(/==\d+==/gu, "==PID==")
			.replace(/0x[0-9a-f]+/gu, "ADDRESS").replaceAll(root, "<consumer>");
		assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
		sanitizer = { coldStdout: cold.stdout, stdout: exercised.stdout
			, startupStderr: normalize(cold.stderr) };
	}
	return { manifest, relocatedStdout: relocatedRun.stdout, sanitizer
		, sourceSha256: sha256(source) };
};

for(const reviewed of [false, true]) test(`installed ${reviewed ? "reviewed" : "ordinary"} owned Subtypes execute through C and C++ archives`, {
	skip: !enabled, timeout: 1_200_000
}, async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-owned-subtype-native-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const project = join(scratch, "author"), output = join(scratch, "producer");
	const handoff = join(scratch, "handoff"), consumer = join(scratch, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-subtypes"), project, { recursive: true });
	const config = reviewed ? { schemaVersion: 1, modules: ["Owned"] }
		: await json(join(project, "lean-bridge.exports.json"));
	if(!reviewed) config.exports.push("Owned.callbackRecord");
	config.targets = {
		c: { name: "owned-subtypes-c", version: "1.0.0" }
		, cpp: { name: "owned-subtypes-cpp", version: "1.0.0" }
	};
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json"
		, canonicalJson(ownedSubtypeCallbackPackageReviewedIr()));
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["c", "cpp"]);
	const built = await buildCanonicalProject({
		projectRoot: project, outputRoot: output
		, targets: ["c", "cpp"], environment
		, onProgress: event => t.diagnostic(`${reviewed ? "reviewed" : "ordinary"}: ${event.message}`) })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	assert.deepEqual(await lakeInputState(project), before);
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt: componentReceipt } = await readVerifiedNativeComponent(nativeRoot, identity, {
		ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true
		, ownedAnchoredResults: true, nativeRefinements: true
		, nativeCheckedRecords: true
	});
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), reviewed);
	assert.ok(model.ownedGraph.hostCallbacks);
	assert.ok(model.ownedGraph.inputTransfers);
	const echo = model.bindingIr.declarations.find(item => item.name === "echoRecord");
	const transfer = model.bindingIr.declarations.find(item => item.name === "transferRecord");
	assert.equal(echo.source.extensions["lean-lang.org/refinements"].parameters[0]
		.fields[4].refinement.fields[0].refinement.constructor, "Owned.checkedCount");
	assert.equal(transfer.parameters[0].ownership, "transfer");
	const adapterRoot = join(output, "native/owned-c-binding");
	const adapter = await json(join(adapterRoot, "native-c-adapter.json"));
	assert.ok(adapter.cppValues); assert.ok(adapter.ownedValues.hostCallbacks);
	for(const target of ["c", "cpp"])
	{
		const projection = built.projections.find(item => item.ecosystem === target);
		const reassembled = join(scratch, `reassembled-${target}`);
		const rebuilt = await packageOwnedNativeC({ working: reassembled, adapterRoot
			, nativeRoot, runtimeRoot, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, target, settings: config.targets[target]
			, glibcMinimumVersion: projection.glibcMinimumVersion });
		assert.deepEqual(rebuilt.packages, projection.packages);
		assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive))
			, await readFile(join(output, "archives", projection.packages[0].archive)));
		await rm(reassembled, { recursive: true, force: true });
	}
	const route = reviewed ? "reviewed" : "ordinary";
	const { receipt, entry } = await retainOwnedSubtypeRoute({
		output: reportPath, route, source: output, handoff });
	retainedEntries.push(entry);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await rm(project, { recursive: true }); await rm(output, { recursive: true });
	await assert.rejects(access(project), { code: "ENOENT" });
	await assert.rejects(access(output), { code: "ENOENT" });
	const sources = {
		c: await readFile("tests/fixtures/structured-types/owned-subtype-installed.c", "utf8")
		, cpp: await readFile("tests/fixtures/structured-types/owned-subtype-installed.cpp", "utf8")
	};
	const observed = {};
	for(const profile of ["c", "cpp"])
	{
		const packages = receipt.packages.filter(item => item.target === profile);
		observed[profile] = await installCopiedConsumer({ profile, consumer, handoff
			, packages, environment
			, fixture: {
				source: () => sources[profile], success: `owned-subtype-${profile}`
				, expectedChecks: expectedChecks[profile]
			}
		});
	}
	await rm(handoff, { recursive: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = {};
	for(const profile of ["c", "cpp"])
	{
		const pkg = receipt.packages.find(item => item.target === profile && item.role === "component");
		relocated[profile] = await relocate({
			root: join(consumer, profile), profile, pkg, source: sources[profile]
			, success: `owned-subtype-${profile}`, sanitize: profile === "cpp"
		});
	}
	reports.push({
		reviewed, sourceUnchanged: true, sourceFreeInstallation: true
		, relocatedInstallation: true, deterministicReassembly: true
		, transferredInputCheckedBeforeHandoff: true
		, callbackCoexistence: true
		, lifecycle: { c: "manual-owner-release", cpp: "raii-plus-sanitizers" }
		, componentReceipt, adapter, packageSetReceipt: receipt
		, observed, relocated });
	t.diagnostic(JSON.stringify({
		reviewed, c: observed.c.checks, cpp: observed.cpp.checks
		, sanitizer: Boolean(relocated.cpp.sanitizer) }));
});
