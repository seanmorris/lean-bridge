/**
 * Source-free installed C and C++ acceptance for host callback replies with Fin bounds (VO #1453).
 * The packages are built twice from unrelated author roots, installed from archives only and
 * exercised through their public APIs without sanitizers; the generated-wrapper sanitizer check
 * is separate evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { finCallbackEnvironment } from "./fin-callback-install.mjs";
import { finReplyConsumerNames, finReplyExports, finReplyTargets, installFinReplyConsumer, parseFinReplyResult } from "./fin-reply-install.mjs";
import { retainFailure } from "./fin-reply-compiled-tests.mjs";

const profiles = process.env.LEAN_BRIDGE_FIN_REPLY_PROFILES?.split(",").sort() ?? [];
assert.equal(new Set(profiles).size, profiles.length, "Duplicate Fin reply profile");
assert.ok(profiles.every(profile => Object.hasOwn(finReplyTargets, profile)), "Fin in host replies is checked by C and C++ packages only");

test("the installed result parser accepts only the fixed check count and a forked child that never reached the host", () => {
	assert.deepEqual(parseFinReplyResult("c", "fork-status 5 0\nfin-reply-ok c 81\n"), { checks: 81, forkStatus: 5, forkHostCalls: 0 });
	assert.deepEqual(parseFinReplyResult("cpp", "fork-status 5 0\nfin-reply-ok cpp 74\n"), { checks: 74, forkStatus: 5, forkHostCalls: 0 });
	const rejected = [
		["c", "fork-status 5 0\nfin-reply-ok c 80\n"]
		, ["cpp", "fork-status 5 0\nfin-reply-ok cpp 81\n"]
		, ["c", "fork-status 5 1\nfin-reply-ok c 81\n"]
		, ["c", "fork-status 0 0\nfin-reply-ok c 81\n"]
		, ["c", "fin-reply-ok c 81\n"]
		, ["c", "fork-status 5 0\nextra\nfin-reply-ok c 81\n"]
		, ["undefined", "fork-status 5 0\nfin-reply-ok undefined undefined\n"]
		, ["perl", "fork-status 5 0\nfin-reply-ok perl 1\n"]
	];
	for(const [profile, stdout] of rejected) assert.throws(() => parseFinReplyResult(profile, stdout), assert.AssertionError, stdout);
});

test("relocated source-free C and C++ packages check every host reply bound and recover", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const reports = [], archives = [];
	const targets = Object.fromEntries(profiles.map(profile => finReplyTargets[profile]));
	const environment = finCallbackEnvironment(profiles);
	const reportPath = resolve(process.env.LEAN_BRIDGE_FIN_REPLY_REPORT ?? `build/native-fin-replies/installed-${profiles.join("-")}.json`);
	await mkdir(dirname(reportPath), { recursive: true });
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-replies-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-fin-replies-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin-replies", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["FinReplies"], exports: finReplyExports, targets }));
		t.diagnostic(`build ${attempt}: ${profiles.join(", ")}`);
		const built = await retainFailure(`${reportPath}.build${attempt}.failure.json`, () => buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		}));
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		// Every export but plain takes host callbacks, and each one's reply carries its bounds.
		for(const item of model.exports.filter(entry => entry.name !== "FinReplies.plain"))
			assert.ok(item.parameters[0].type.reply, item.name);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		// Install from prepared archives only; no author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		const names = finReplyConsumerNames(model.bindingIr);
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === finReplyTargets[profile][0]);
			const observation = await retainFailure(`${reportPath}.${profile}.failure.json`, () => installFinReplyConsumer({ profile, consumer, handoff, packages, environment }, names));
			delete observation.command;
			const identities = { bindingIrSha256: built.bindingIrSha256, modelSha256: sha256(canonicalJson(model)), receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json"))) };
			reports.push({ profile, path: "ordinary-source", ...observation, packages, ...identities, sourceRemovedBeforeInstallation: true, instrumentation: "none: installed packages and consumers as built" });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	// Two unrelated author roots produce byte-identical archives.
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, scope: "source-free installed C/C++ acceptance", reports, archives: archives[0], reproducible: true }));
});
