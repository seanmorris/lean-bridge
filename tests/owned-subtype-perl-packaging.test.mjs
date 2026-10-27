/**
 * Source-free CPAN acceptance for proof-erased checked owned aggregates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { generateOwnedPerlXs } from "../src/backends/perl/owned-xs.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { archiveCpanPackage, readVerifiedCpanPackage } from "../src/release/cpan-package.mjs";
import { installCpanArchive } from "../src/release/cpan-install.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedSubtypeCallbackPackageReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { inspectOwnedPerlInstalledAssets } from "./helpers/owned-perl-installed-assets.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	clearOwnedSubtypeRetainedPackages, retainOwnedSubtypeRoute
	, verifyOwnedSubtypeRetainedPackages
	, writeOwnedSubtypeRetainedPackages
} from "./helpers/owned-subtype-retained-packages.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_SUBTYPE_PERL_TEST === "1";
const reports = [];
const retainedEntries = [];
const reportPath = resolve("build/owned-subtype-perl-packaging/report.json");
if(enabled) await clearOwnedSubtypeRetainedPackages(reportPath);
const explain = error => {
	throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`, { cause: error });
};

test.after(async () => {
	if(enabled && reports.length === 2)
	{
		const report = {
			schemaVersion: 1, profile: "installed-owned-subtype-perl"
			, reports: reports.toSorted((left, right) => Number(left.reviewed) - Number(right.reviewed))
		};
		await saveLakeFile("build/owned-subtype-perl-packaging", "report.json"
			, canonicalJson(report));
		await writeOwnedSubtypeRetainedPackages(reportPath, retainedEntries);
		await verifyOwnedSubtypeRetainedPackages(dirname(reportPath), report);
	}
});

test("owned Subtype Perl transfers coexist with host callbacks", () => {
	const ir = ownedSubtypeCallbackPackageReviewedIr(), before = structuredClone(ir);
	const generated = generateOwnedPerlXs(ir, "LeanBridge::OwnedProbe", {
		transferredInputs: true, anchoredResults: true, hostCallbacks: true
	});
	assert.deepEqual(ir, before);
	assert.equal(generated.c.callbacks.length, 1);
	assert.ok(generated.c.copies?.some(copy => copy.id === "lean:Owned.Bundle"));
	assert.deepEqual(generated.functions.map(fn => fn.publicName), [
		"new_ticket", "serial", "echo_record"
		, "echo_record_alternate", "transfer_record", "callback_record"
	]);
	const start = generated.xs.indexOf("\ntransfer_record(...)");
	const end = generated.xs.indexOf("\nMODULE =", start + 1);
	assert.ok(start >= 0 && end > start);
	const transfer = generated.xs.slice(start, end);
	const read = transfer.match(/lpo_read[0-9]+/u)?.[0];
	assert.ok(read);
	const order = [read, "owned_subtypes_bundle_t_copy", "lpo_arm_inputs"
		, "owned_subtypes_transfer_record", "lpo_finish_inputs"];
	let previous = -1;
	for(const marker of order)
	{
		const index = transfer.indexOf(marker);
		assert.ok(index > previous, marker); previous = index;
	}
	assert.doesNotMatch(transfer, /lpo_callback|host_callback/u);
	assert.match(generated.xs, /\ncallback_record\(\.\.\.\)/u);
});

test("owned Subtype Perl acceptance is a required recurring workflow", async () => {
	const source = await readFile(".github/workflows/owned-subtype-perl.yml", "utf8");
	for(const required of [
		"on:\n  workflow_dispatch:\n"
		, "cancel-in-progress: true"
		, "npm run test:owned-subtype-perl"
		, "rg '^# fail 0$'"
		, "rg '^# skipped 0$'"
		, "test -s build/owned-subtype-perl-packaging/report.json"
		, "test -s build/owned-subtype-perl-packaging/retained-packages.json"
		, "if: always()\n        uses: actions/upload-artifact@v7"
		, "if: always() && steps.acceptance.outcome != 'success'"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error:\s*true/u);
});

for(const reviewed of [false, true]) test(`installed ${reviewed ? "reviewed" : "ordinary"} owned Subtypes execute through CPAN archives`, {
	skip: !enabled, timeout: 1_800_000
}, async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-owned-subtype-perl-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const author = join(scratch, "author"), producer = join(scratch, "producer");
	const handoff = join(scratch, "handoff");
	await cp(resolve("tests/fixtures/onboarding/owned-subtypes"), author, { recursive: true });
	const config = reviewed ? { schemaVersion: 1, modules: ["Owned"] }
		: JSON.parse(await readFile(join(author, "lean-bridge.exports.json"), "utf8"));
	if(!reviewed) config.exports.push("Owned.callbackRecord");
	config.targets = { cpan: { module: "LeanBridge::OwnedProbe", version: "0.010" } };
	await saveLakeFile(author, "lean-bridge.exports.json", canonicalJson(config));
	if(reviewed) await saveLakeFile(author, "api.binding-ir.json"
		, canonicalJson(ownedSubtypeCallbackPackageReviewedIr()));
	const perls = perlGraphCommands(), before = await lakeInputState(author);
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX
		?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const environment = { ...process.env, LEAN_BRIDGE_PERLS: JSON.stringify(perls)
		, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix };
	const cli = resolve("scripts/lean-bridge.mjs");
	const invocation = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "build", "--project", author, "--output", producer, "--target", "cpan", "--json"]
		, cwd: scratch, env: environment, timeoutMs: 1_200_000 }).catch(explain);
	const response = JSON.parse(invocation.stdout); assert.equal(response.status, "ok");
	const built = response.result; assert.deepEqual(built.targets, ["cpan"]);
	assert.deepEqual(await lakeInputState(author), before);
	const prepared = await readVerifiedCpanPackage(join(producer, "packages/component"));
	const { ownedValues: owned } = prepared.manifest;
	assert.equal(owned.schemaVersion, 2);
	assert.equal(owned.inputTransfers.validation, "before-consumption");
	assert.equal(prepared.manifest.prebuilt.length, perls.length);
	const model = JSON.parse(prepared.files.get("model.json"));
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), reviewed);
	assert.ok(model.ownedGraph.hostCallbacks);
	assert.ok(model.ownedGraph.inputTransfers);
	const echo = model.bindingIr.declarations.find(item => item.name === "echoRecord");
	assert.equal(echo.source.extensions["lean-lang.org/refinements"].parameters[0]
		.fields[4].refinement.fields[0].refinement.constructor, "Owned.checkedCount");
	const xs = prepared.files.get("Component.xs").toString();
	const cSource = prepared.files.get(`owned/src/${owned.prefix}.c`).toString();
	assert.match(xs, /owned_subtypes_bundle_t_copy/u);
	assert.match(cSource, /owned_subtypes_bundle_t_copy\(/u);
	assert.match(xs, /\ncallback_record\(\.\.\.\)/u);
	for(const name of ["runtime", "component"])
	{
		const again = await archiveCpanPackage({ packageRoot: join(producer, "packages", name)
			, outputRoot: join(scratch, "reassembled") });
		assert.deepEqual(await readFile(again.path)
			, await readFile(join(producer, "archives", again.receipt.archive)));
	}
	const route = reviewed ? "reviewed" : "ordinary";
	const { receipt, entry } = await retainOwnedSubtypeRoute({
		output: reportPath, route, source: producer, handoff });
	retainedEntries.push(entry);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const verification = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"]
		, cwd: scratch, env: copiedCleanEnvironment }).catch(explain);
	assert.equal(JSON.parse(verification.stdout).result.verificationType, "local-package-set");
	const archives = await Promise.all(built.packages.map(async pkg => ({
		...pkg, bytes: await readFile(join(handoff, "archives", pkg.archive))
	})));
	await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	await rm(author, { recursive: true, force: true });
	await rm(producer, { recursive: true, force: true });
	await assert.rejects(access(author), { code: "ENOENT" });
	await assert.rejects(access(producer), { code: "ENOENT" });
	const consumerSource = await readFile("tests/fixtures/structured-types/owned-perl-subtype.pl", "utf8");
	const observations = [];
	for(const [index, perl] of perls.entries()) for(const mode of ["prebuilt-only", "build-xs"])
	{
		const consumer = join(scratch, `consumer-${index}-${mode}`);
		const staging = join(consumer, "handoff");
		const prefix = join(consumer, "installed"), tools = join(consumer, "tools");
		await mkdir(tools, { recursive: true });
		for(const command of ["make", "tar", "gzip", "sh", "cp", "mv", "rm"
			, "chmod", "mkdir", "touch", "true"
			, ...mode === "build-xs" ? ["cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld"] : []])
			await symlink(`/usr/bin/${command}`, join(tools, command));
		const installEnvironment = { ...copiedCleanEnvironment, PATH: tools
			, ...mode === "build-xs" ? { CC: "/usr/bin/cc", LD: "/usr/bin/cc" } : {} };
		for(const archive of archives)
		{
			assert.equal(sha256(archive.bytes), archive.sha256);
			await saveLakeFile(staging, archive.archive, archive.bytes);
			await installCpanArchive({ archive: join(staging, archive.archive)
				, workingRoot: consumer, prefix, perl
				, mode, environment: installEnvironment }).catch(explain);
		}
		await rm(staging, { recursive: true, force: true });
		await assert.rejects(access(staging), { code: "ENOENT" });
		await rm(tools, { recursive: true, force: true });
		const relocated = join(consumer, "relocated"); await rename(prefix, relocated);
		await saveLakeFile(consumer, "consumer.pl", consumerSource);
		const runtimeEnvironment = { ...copiedCleanEnvironment, PATH: "/unavailable"
			, PERL5LIB: join(relocated, "lib/perl5") };
		let observed;
		for(let repeat = 0; repeat < 2; repeat++)
		{
			const execution = await runCopied(perl, ["consumer.pl"], consumer, runtimeEnvironment).catch(explain);
			assert.equal(execution.stderr, "");
			const actual = JSON.parse(execution.stdout);
			assert.ok(actual.checks >= 70);
			assert.equal(actual.borrowed_rejection_preserved, true);
			assert.equal(actual.transfer_rejection_preserved, true);
			assert.equal(actual.successful_transfer_consumed, true);
			assert.equal(actual.implicit_destruction_released, true);
			if(observed) assert.deepEqual(actual, observed); observed = actual;
		}
		const assets = await inspectOwnedPerlInstalledAssets({ consumer, prefix: relocated, perl, owned });
		observations.push({ perl, mode, runtimeOnlyRuns: 2, observed, assets });
		t.diagnostic(JSON.stringify({ reviewed, perl, mode, checks: observed.checks
			, assetChecks: assets.observations.length }));
		await rm(consumer, { recursive: true, force: true });
	}
	reports.push({
		reviewed, sourceUnchanged: true, sourceFreeInstallation: true
		, relocatedInstallation: true, deterministicReassembly: true
		, compilerSelectedConstructors: true
		, transferredInputCheckedBeforeHandoff: true
		, callbackCoexistence: true
		, lifecycle: { fallback: "perl-destruction", observation: "native-identity-baseline-restored" }
		, packageSetReceipt: receipt, observations
		, consumerSha256: sha256(consumerSource), owned
		, componentReceipt: JSON.parse(prepared.files.get("native-component.json"))
	});
});
