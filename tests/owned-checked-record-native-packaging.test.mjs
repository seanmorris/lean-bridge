/**
 * Source-free C and C++ acceptance for owned proof-erased checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateOwnedCppPackage } from "../src/backends/cpp/owned-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import {
	readVerifiedNativeComponent, readVerifiedNativeRuntime
} from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { packageOwnedNativeC } from "../src/release/owned-c-package.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment
	, runCopied
} from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedCheckedRecordFixture } from "./helpers/owned-checked-record-fixture.mjs";
import {
	ownedCheckedRecordNativeRoutes, ownedCheckedRecordNativeSelection
} from "./helpers/owned-checked-record-native-fixture.mjs";
import {
	copyPackageSetHandoff, retainPackageSetEvidence
} from "./helpers/package-set.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_CHECKED_RECORD_NATIVE_TEST === "1";
const routeVariable = "LEAN_BRIDGE_OWNED_CHECKED_RECORD_NATIVE_ROUTES";
const routes = process.env[routeVariable]?.split(",")
	?? [...ownedCheckedRecordNativeRoutes];
assert.ok(routes.length && routes.every(route =>
	ownedCheckedRecordNativeRoutes.includes(route)
));
const reports = [];
const json = async path => JSON.parse(await readFile(path, "utf8"));

test("owned checked-record C and C++ generators retain exact callback directions", () => {
	const selected = ownedCheckedRecordNativeSelection("reviewed-full", ["c", "cpp"]);
	const generated = generateOwnedCppPackage(selected.reviewedIr, {
		transferredInputs: true, anchoredResults: true, hostCallbacks: true
	});
	assert.equal(generated.c.callbacks.length, 2);
	assert.ok(generated.c.copies?.some(copy => copy.id
		=== "lean:OwnedCheckedRecords.Window"));
	assert.match(generated.c.header
		, /owned_checked_records_with_claim_callback\(/u);
	assert.match(generated.c.header
		, /owned_checked_records_claim_closure\(/u);
	assert.match(generated.files["include/owned_checked_records.hpp"]
		, /inline Claim with_claim_callback/u);
});

test("owned checked-record native acceptance is a required recurring job", async () => {
	const source = await readFile(
		".github/workflows/owned-checked-record-native-perl.yml", "utf8"
	);
	for(const required of [
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
		, "cancel-in-progress: true"
		, "npm run test:owned-checked-record-native"
		, "rg '^# fail 0$'"
		, "rg '^# skipped 0$'"
		, "test -s build/owned-checked-record-native-packaging/report.json"
		, "for route in ordinary-full ordinary-result-only reviewed-full reviewed-result-only; do"
		, "test -s \"build/owned-checked-record-native-packaging/evidence/$route/package-set-receipt.json\""
		, "build/owned-checked-record-native-packaging/"
		, "name: owned-checked-record-native-${{ github.sha }}"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error:\s*true/u);
});

test.after(async () => {
	if(!enabled || reports.length !== routes.length) return;
	const complete = routes.length === ownedCheckedRecordNativeRoutes.length
		&& ownedCheckedRecordNativeRoutes.every(route => routes.includes(route));
	const name = complete ? "report.json"
		: `partial-${sha256(canonicalJson(routes.toSorted())).slice(0, 12)}.json`;
	await saveLakeFile("build/owned-checked-record-native-packaging", name
		, canonicalJson({ schemaVersion: 1
			, profile: "installed-owned-checked-record-native"
			, reports: reports.toSorted((left, right) =>
				left.route.localeCompare(right.route)) }));
});

const consumerSource = async (profile, resultOnly) => readFile(
	`tests/fixtures/structured-types/owned-checked-record-${resultOnly
		? "result-only" : "installed"}.${profile === "cpp" ? "cpp" : "c"}`
	, "utf8"
);
const successName = (profile, resultOnly) => `owned-checked-record-${resultOnly
	? "result-only-" : ""}${profile}`;

const relocate = async ({ root, profile, pkg, source, success, sanitize }) => {
	const installed = join(root, `${pkg.name}-${pkg.version}-${profile}`);
	const relocated = join(root, "relocated-package");
	await rename(installed, relocated);
	const manifest = await json(join(relocated, "lean-bridge-package.json"));
	const tools = join(root, "tools");
	const environment = { ...copiedCleanEnvironment, PATH: tools
		, PKG_CONFIG_LIBDIR: join(relocated, "lib/pkgconfig")
		, PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config"
		, ["--cflags", "--libs", manifest.pkgConfig], root, environment))
		.stdout.trim().split(/\s+/u);
	const compiler = profile === "cpp" ? "/usr/bin/c++" : "/usr/bin/cc";
	const standard = profile === "cpp" ? "c++20" : "c11";
	const extension = profile === "cpp" ? "cpp" : "c";
	const executable = join(root, "relocated-consumer");
	await runCopied(compiler, [`-std=${standard}`, "-Wall", "-Wextra", "-Werror"
		, "-UNDEBUG", `consumer.${extension}`, ...flags, "-o", executable]
	, root, environment);
	const run = await runCopied(executable, [], root);
	assert.equal(run.stderr, "");
	assert.match(run.stdout, new RegExp(`^${success}:[0-9]+\\n$`, "u"));
	let sanitizer = null;
	if(sanitize)
	{
		const command = join(root, "sanitized-consumer");
		await runCopied(compiler, [`-std=${standard}`, "-O1", "-g", "-Wall"
			, "-Wextra", "-Werror", "-UNDEBUG", "-fsanitize=address,undefined"
			, "-fno-omit-frame-pointer", "-no-pie", `consumer.${extension}`
			, ...flags, "-o", command], root, environment);
		const runtime = { ...copiedCleanEnvironment
			, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
			, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1"
			, LSAN_OPTIONS: "exitcode=0" };
		const cold = await runCopied(command, [], root
			, { ...runtime, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
		const exercised = await runCopied(command, [], root, runtime);
		assert.equal(cold.stdout, "cold\n");
		assert.match(exercised.stdout
			, new RegExp(`^${success}:[0-9]+\\n$`, "u"));
		assert.doesNotMatch(exercised.stderr
			, /ERROR: AddressSanitizer|runtime error:/u);
		const normalize = value => value.replace(/==\d+==/gu, "==PID==")
			.replace(/0x[0-9a-f]+/gu, "ADDRESS")
			.replaceAll(root, "<consumer>");
		assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
		sanitizer = { coldStdout: cold.stdout, stdout: exercised.stdout
			, startupStderr: normalize(cold.stderr) };
	}
	return { manifest, stdout: run.stdout, sanitizer
		, sourceSha256: sha256(source) };
};

for(const route of routes)
	test(`installed ${route} owned checked records execute through C and C++ archives`, {
		skip: !enabled, timeout: 1_200_000
	}, async t => {
		const selected = ownedCheckedRecordNativeSelection(route, ["c", "cpp"]);
		const { authorRoute, resultOnly } = selected;
		const scratch = await mkdtemp(join(
			tmpdir(), "lean-owned-checked-record-native-"
		));
		t.after(() => rm(scratch, { recursive: true, force: true }));
		const project = join(scratch, "author");
		const output = join(scratch, "producer");
		const handoff = join(scratch, "handoff");
		const consumer = join(scratch, "consumer");
		await cp(resolve(ownedCheckedRecordFixture), project, { recursive: true });
		await saveLakeFile(project, "lean-bridge.exports.json"
			, canonicalJson(selected.configuration));
		if(authorRoute === "reviewed") await saveLakeFile(project
			, "reviewed.binding-ir.json", canonicalJson(selected.reviewedIr));
		const before = await lakeInputState(project);
		const environment = nativeFixtureEnvironment(["c", "cpp"]);
		const built = await buildCanonicalProject({ projectRoot: project
			, outputRoot: output, targets: ["c", "cpp"], environment
			, onProgress: event => t.diagnostic(`${route}: ${event.message}`) })
			.catch(error => { throw new Error(
				`${error.message}: ${JSON.stringify(error.details)}`
				, { cause: error }); });
		assert.deepEqual(await lakeInputState(project), before);
		const runtimeRoot = join(output, "native/runtime");
		const nativeRoot = join(output, "native/component");
		const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
		const verified = await readVerifiedNativeComponent(nativeRoot, identity, {
			ownedGraphs: true, ownedHostCallbacks: true
			, ownedInputTransfers: true, ownedAnchoredResults: true
			, nativeRefinements: true, nativeCheckedRecords: true
		});
		assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr)
			, authorRoute === "reviewed");
		assert.equal(verified.model.bindingIr.types.filter(type =>
			type.kind === "callback").length, resultOnly ? 0 : 2);
		assert.equal(verified.model.bindingIr.declarations.some(item =>
			item.parameters.some(parameter => parameter.ownership === "transfer"))
			, !resultOnly);
		for(const target of ["c", "cpp"])
		{
			const projection = built.projections.find(item =>
				item.ecosystem === target);
			const reassembled = join(scratch, `reassembled-${target}`);
			const rebuilt = await packageOwnedNativeC({ working: reassembled
				, adapterRoot: join(output, "native/owned-c-binding")
				, nativeRoot, runtimeRoot
				, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX, target
				, settings: selected.configuration.targets[target]
				, glibcMinimumVersion: projection.glibcMinimumVersion });
			assert.deepEqual(rebuilt.packages, projection.packages);
			assert.deepEqual(await readFile(join(reassembled, "archives"
				, rebuilt.packages[0].archive)), await readFile(join(output
				, "archives", projection.packages[0].archive)));
			await rm(reassembled, { recursive: true, force: true });
		}
		const evidenceRoot = join("build/owned-checked-record-native-packaging"
			, "evidence", route);
		const retained = await retainPackageSetEvidence(output, evidenceRoot);
		const receipt = await copyPackageSetHandoff(evidenceRoot, handoff);
		assert.deepEqual(receipt, retained.receipt);
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		await rm(project, { recursive: true });
		await rm(output, { recursive: true });
		await assert.rejects(access(project), { code: "ENOENT" });
		await assert.rejects(access(output), { code: "ENOENT" });
		const sources = {
			c: await consumerSource("c", resultOnly)
			, cpp: await consumerSource("cpp", resultOnly)
		};
		const observed = {};
		for(const profile of ["c", "cpp"])
			observed[profile] = await installCopiedConsumer({ profile, consumer
				, handoff, environment
				, packages: receipt.packages.filter(item => item.target === profile)
				, fixture: { source: () => sources[profile], wit: []
					, success: successName(profile, resultOnly)
					, ...resultOnly ? {
						expectedChecks: profile === "c" ? 14 : 3
					} : {} } });
		await rm(handoff, { recursive: true, force: true });
		await assert.rejects(access(handoff), { code: "ENOENT" });
		const relocated = {};
		for(const profile of ["c", "cpp"])
		{
			const pkg = receipt.packages.find(item =>
				item.target === profile && item.role === "component");
			relocated[profile] = await relocate({ root: join(consumer, profile)
				, profile, pkg, source: sources[profile]
				, success: successName(profile, resultOnly)
				, sanitize: profile === "cpp" && !resultOnly });
		}
		reports.push({ route, authorRoute, mode: selected.mode
			, sourceUnchanged: true, sourceFreeInstallation: true
			, relocatedInstallation: true, deterministicReassembly: true
			, earlyAndLateRejection: !resultOnly
			, unchangedRejectedInputs: !resultOnly
			, outputAtomicity: !resultOnly, callbackRecovery: !resultOnly
			, lifecycle: { c: "manual-owner-release"
				, cpp: resultOnly ? "raii" : "raii-plus-sanitizers" }
			, bindingIrSha256: built.bindingIrSha256
			, componentReceipt: verified.receipt
			, retainedPackageSet: { path: `evidence/${route}`
				, receiptSha256: retained.receiptSha256
				, archives: retained.archives, files: retained.files }
			, packageSetReceipt: receipt, observed, relocated });
		t.diagnostic(JSON.stringify({ route
			, c: observed.c.checks, cpp: observed.cpp.checks
			, sanitizer: Boolean(relocated.cpp.sanitizer) }));
	});
