/**
 * Source-free CPAN acceptance for owned proof-erased checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	access, cp, mkdir, mkdtemp, readFile, rename, rm, symlink
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateOwnedPerlXs } from "../src/backends/perl/owned-xs.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	archiveCpanPackage, readVerifiedCpanPackage
} from "../src/release/cpan-package.mjs";
import { installCpanArchive } from "../src/release/cpan-install.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, nativeFixtureEnvironment, runCopied
} from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedCheckedRecordFixture } from "./helpers/owned-checked-record-fixture.mjs";
import {
	ownedCheckedRecordNativeRoutes, ownedCheckedRecordNativeSelection
} from "./helpers/owned-checked-record-native-fixture.mjs";
import { inspectOwnedPerlInstalledAssets } from "./helpers/owned-perl-installed-assets.mjs";
import {
	copyPackageSetHandoff, retainPackageSetEvidence
} from "./helpers/package-set.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_CHECKED_RECORD_PERL_TEST === "1";
const routeVariable = "LEAN_BRIDGE_OWNED_CHECKED_RECORD_PERL_ROUTES";
const routes = process.env[routeVariable]?.split(",")
	?? [...ownedCheckedRecordNativeRoutes];
assert.ok(routes.length && routes.every(route =>
	ownedCheckedRecordNativeRoutes.includes(route)
));
const reports = [];
const packagingRoot = "build/owned-checked-record-perl-packaging";
const evidenceRoot = join(packagingRoot, "evidence");
const explain = error => {
	throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`
		, { cause: error });
};

test.before(async () => {
	if(enabled) await rm(packagingRoot, { recursive: true, force: true });
});

test("owned checked-record CPAN projection retains mixed transport", () => {
	const selected = ownedCheckedRecordNativeSelection("reviewed-full", ["cpan"]);
	const before = structuredClone(selected.reviewedIr);
	const generated = generateOwnedPerlXs(selected.reviewedIr
		, "LeanBridge::OwnedCheckedRecords", {
			transferredInputs: true, anchoredResults: true, hostCallbacks: true
		}
	);
	assert.deepEqual(selected.reviewedIr, before);
	assert.equal(generated.c.callbacks.length, 2);
	assert.ok(generated.c.copies?.some(copy => copy.id
		=== "lean:OwnedCheckedRecords.Window"));
	assert.deepEqual(generated.functions.map(item => item.publicName), [
		"new_ticket", "serial", "echo_booking", "echo_claim"
		, "transfer_claim", "claim_for", "pair_claim"
		, "with_claim_callback", "claim_closure"
	]);
	assert.match(generated.xs, /\nwith_claim_callback\(\.\.\.\)/u);
	assert.match(generated.xs, /\nclaim_closure\(\.\.\.\)/u);
});

test("owned checked-record Perl acceptance is a required recurring job", async () => {
	const source = await readFile(
		".github/workflows/owned-checked-record-native-perl.yml", "utf8"
	);
	for(const required of [
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
		, "cancel-in-progress: true"
		, "npm run test:owned-checked-record-perl"
		, "rg '^# fail 0$'"
		, "rg '^# skipped 0$'"
		, "test -s build/owned-checked-record-perl-packaging/report.json"
		, "for route in ordinary-full ordinary-result-only reviewed-full reviewed-result-only; do"
		, "test -s \"build/owned-checked-record-perl-packaging/evidence/$route/handoff/package-set-receipt.json\""
		, "build/owned-checked-record-perl-packaging/"
		, "name: owned-checked-record-perl-${{ github.sha }}"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error:\s*true/u);
});

test.after(async () => {
	if(!enabled || reports.length !== routes.length) return;
	const complete = routes.length === ownedCheckedRecordNativeRoutes.length
		&& ownedCheckedRecordNativeRoutes.every(route => routes.includes(route));
	const name = complete ? "report.json"
		: `partial-${sha256(canonicalJson(routes.toSorted())).slice(0, 12)}.json`;
	await saveLakeFile(packagingRoot, name
		, canonicalJson({ schemaVersion: 1
			, profile: "installed-owned-checked-record-perl"
			, reports: reports.toSorted((left, right) =>
				left.route.localeCompare(right.route)) }));
});

for(const route of routes)
	test(`installed ${route} owned checked records execute through CPAN archives`, {
		skip: !enabled, timeout: 3_600_000
	}, async t => {
		const selected = ownedCheckedRecordNativeSelection(route, ["cpan"]);
		const { authorRoute, resultOnly } = selected;
		const scratch = await mkdtemp(join(
			tmpdir(), "lean-owned-checked-record-perl-"
		));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(scratch, { recursive: true, force: true });
			else t.diagnostic(`Retained failed owned checked-record Perl inputs: ${scratch}`);
		});
		const author = join(scratch, "author");
		const producer = join(scratch, "producer");
		const handoff = join(scratch, "handoff");
		await cp(resolve(ownedCheckedRecordFixture), author, { recursive: true });
		await saveLakeFile(author, "lean-bridge.exports.json"
			, canonicalJson(selected.configuration));
		if(authorRoute === "reviewed") await saveLakeFile(author
			, "api.binding-ir.json", canonicalJson(selected.reviewedIr));
		const perls = perlGraphCommands();
		const environment = { ...nativeFixtureEnvironment(["perl"])
			, LEAN_BRIDGE_PERLS: JSON.stringify(perls)
			, LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR:
				process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.36" };
		const before = await lakeInputState(author);
		t.diagnostic(`${route}: building for ${perls.length} Perl ABIs`);
		const built = await buildCanonicalProject({ projectRoot: author
			, outputRoot: producer, targets: ["cpan"], environment
			, onProgress: event => t.diagnostic(`${route}: ${event.message}`) })
			.catch(explain);
		assert.deepEqual(await lakeInputState(author), before);
		const prepared = await readVerifiedCpanPackage(join(
			producer, "packages/component"
		));
		const model = JSON.parse(prepared.files.get("model.json"));
		assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr)
			, authorRoute === "reviewed");
		assert.equal(model.bindingIr.types.filter(type =>
			type.kind === "callback").length, resultOnly ? 0 : 2);
		assert.equal(model.bindingIr.declarations.some(item =>
			item.parameters.some(parameter => parameter.ownership === "transfer"))
			, !resultOnly);
		assert.equal(prepared.manifest.prebuilt.length, perls.length);
		for(const name of ["runtime", "component"])
		{
			const again = await archiveCpanPackage({
				packageRoot: join(producer, "packages", name)
				, outputRoot: join(scratch, "reassembled")
			});
			assert.deepEqual(await readFile(again.path), await readFile(join(
				producer, "archives", again.receipt.archive
			)));
		}
		const retainedRoot = join(evidenceRoot, route, "handoff");
		const retained = await retainPackageSetEvidence(producer, retainedRoot);
		const receipt = await copyPackageSetHandoff(retainedRoot, handoff);
		assert.deepEqual(receipt, retained.receipt);
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		const cli = resolve("scripts/lean-bridge.mjs");
		const verification = await processBuildRunner.capture({
			command: process.execPath
			, args: [cli, "verify", "--receipt"
				, join(handoff, "package-set-receipt.json"), "--json"]
			, cwd: scratch, env: copiedCleanEnvironment
		}).catch(explain);
		assert.equal(JSON.parse(verification.stdout).result.verificationType
			, "local-package-set");
		const archives = await Promise.all(built.packages.map(async pkg => ({
			...pkg, bytes: await readFile(join(handoff, "archives", pkg.archive))
		})));
		await rm(handoff, { recursive: true, force: true });
		await rm(author, { recursive: true, force: true });
		await rm(producer, { recursive: true, force: true });
		for(const path of [handoff, author, producer])
			await assert.rejects(access(path), { code: "ENOENT" });
		const consumerSource = await readFile(
			`tests/fixtures/structured-types/owned-checked-record-${resultOnly
				? "result-only" : "installed"}.pl`, "utf8"
		);
		const observations = [];
		for(const [index, perl] of perls.entries())
			for(const mode of ["prebuilt-only", "build-xs"])
			{
				const consumer = join(scratch, `consumer-${index}-${mode}`);
				const staging = join(consumer, "handoff");
				const installed = join(consumer, "installed");
				const tools = join(consumer, "tools");
				await mkdir(tools, { recursive: true });
				for(const command of ["make", "tar", "gzip", "sh", "cp"
					, "mv", "rm", "chmod", "mkdir", "touch", "true"
					, ...mode === "build-xs"
						? ["cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld"] : []])
					await symlink(`/usr/bin/${command}`, join(tools, command));
				const installEnvironment = { ...copiedCleanEnvironment, PATH: tools
					, ...mode === "build-xs"
						? { CC: "/usr/bin/cc", LD: "/usr/bin/cc" } : {} };
				for(const archive of archives)
				{
					assert.equal(sha256(archive.bytes), archive.sha256);
					await saveLakeFile(staging, archive.archive, archive.bytes);
					await installCpanArchive({
						archive: join(staging, archive.archive)
						, workingRoot: consumer, prefix: installed, perl, mode
						, environment: installEnvironment
					}).catch(explain);
				}
				await rm(staging, { recursive: true, force: true });
				await rm(tools, { recursive: true, force: true });
				const relocated = join(consumer, "relocated");
				await rename(installed, relocated);
				await saveLakeFile(consumer, "consumer.pl", consumerSource);
				const runtimeEnvironment = { ...copiedCleanEnvironment
					, PATH: "/unavailable"
					, PERL5LIB: join(relocated, "lib/perl5") };
				let observed;
				for(let repeat = 0; repeat < 2; repeat++)
				{
					const execution = await runCopied(perl, ["consumer.pl"]
						, consumer, runtimeEnvironment).catch(explain);
					assert.equal(execution.stderr, "");
					const actual = JSON.parse(execution.stdout);
					assert.ok(actual.checks >= (resultOnly ? 8 : 35));
					if(observed) assert.deepEqual(actual, observed);
					observed = actual;
				}
				const assets = await inspectOwnedPerlInstalledAssets({
					consumer, prefix: relocated, perl
					, owned: prepared.manifest.ownedValues
					, module: "LeanBridge::OwnedCheckedRecords"
				});
				observations.push({ perl, mode, runtimeOnlyRuns: 2
					, observed, assets });
				t.diagnostic(JSON.stringify({ route, perl, mode
					, checks: observed.checks }));
				await rm(consumer, { recursive: true, force: true });
			}
		reports.push({ route, authorRoute, mode: selected.mode
			, sourceUnchanged: true, sourceFreeInstallation: true
			, relocatedInstallation: true, deterministicReassembly: true
			, independentlyVerified: true, immutableConsumer: true
			, earlyAndLateRejection: !resultOnly
			, unchangedRejectedInputs: !resultOnly
			, callbackRecovery: !resultOnly
			, lifecycle: "perl-destruction-plus-explicit-close"
			, bindingIrSha256: built.bindingIrSha256
			, retainedPackageSet: { path: `evidence/${route}/handoff`
				, receiptSha256: retained.receiptSha256
				, archives: retained.archives
				, archiveBytes: retained.archiveBytes, files: retained.files }
			, packageSetReceipt: receipt
			, consumerSha256: sha256(consumerSource)
			, componentReceipt: JSON.parse(prepared.files.get(
				"native-component.json"))
			, observations });
		complete = true;
	});
