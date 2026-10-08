/**
 * Source-free installed C and C++ acceptance for host callback replies with Fin bounds (VO #1453).
 * The packages are built twice from unrelated author roots, installed from archives only and
 * exercised through their public APIs without sanitizers; the generated-wrapper sanitizer check
 * is separate evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { finCallbackEnvironment } from "./fin-callback-install.mjs";
import { finReplyConsumerNames, finReplyExports, finReplyFixture, finReplyTargets, installFinReplyConsumer, parseFinReplyResult } from "./fin-reply-install.mjs";
import { retainFailure } from "./fin-reply-compiled-tests.mjs";
import { finReplyCompilerModel, finReplyHostShape, finReplyOptionDigit } from "./fin-reply-model.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateGmpProjection } from "../../src/backends/c/gmp-projection.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";

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

test("each installed fixture demands its exact check count and keeps the consumer's output", () => {
	for(const [profile, count] of [["c", 81], ["cpp", 74]])
	{
		const seen = {}, fixture = finReplyFixture(profile, {}, seen);
		assert.equal(fixture.expectedChecks, count);
		const stdout = `fork-status 5 0\nfin-reply-ok ${profile} ${count}\n`;
		assert.deepEqual(fixture.parseResult(stdout), { checks: count, forkStatus: 5, forkHostCalls: 0 });
		assert.equal(seen.stdout, stdout);
	}
	assert.throws(() => finReplyFixture("cpp", {}).parseResult("fork-status 5 0\nfin-reply-ok cpp 81\n"), assert.AssertionError);
});

test("a failure after a successful consumer process keeps its exact output; a process failure keeps the runner's", async () => {
	const stdout = "fork-status 5 0\nfin-reply-ok c 81\n", options = { profile: "c" };
	// Success: the fixture's exact count reaches the helper and the parsed observation returns.
	const ok = await installFinReplyConsumer(options, {}, async ({ fixture }) => ({ checks: fixture.expectedChecks, result: fixture.parseResult(stdout) }));
	assert.deepEqual(ok, { checks: 81, result: { checks: 81, forkStatus: 5, forkHostCalls: 0 } });
	// A later assertion after parsing carries the parsed stdout; its own message is unchanged.
	const later = await installFinReplyConsumer(options, {}, async ({ fixture }) => { fixture.parseResult(stdout); assert.equal(80, fixture.expectedChecks); }).catch(error => error);
	assert.ok(later instanceof assert.AssertionError);
	assert.equal(later.details.stdout, stdout);
	assert.match(later.message, /80 !== 81/u);
	// The helper's empty-stderr assertion yields the exact stderr, before any parsing.
	const noisy = await installFinReplyConsumer(options, {}, async () => { assert.equal("warning: x\n", ""); }).catch(error => error);
	assert.deepEqual(noisy.details, { stderr: "warning: x\n" });
	// A process failure keeps the runner's details untouched.
	const runner = Object.assign(new Error("/usr/bin/cc exited with status 1"), { code: "build-command-failed", details: { command: "/usr/bin/cc", args: [], stdout: "", stderr: "boom" } });
	const failed = await installFinReplyConsumer(options, {}, async () => { throw runner; }).catch(error => error);
	assert.equal(failed, runner);
	assert.deepEqual(failed.details, { command: "/usr/bin/cc", args: [], stdout: "", stderr: "boom" });
});

test("the C consumer spells no module-qualified type name, so the installed module path cannot break it", async () => {
	const source = await readFile("tests/fixtures/fin-reply-consumers/c.c", "utf8");
	// Option-of-record names embed the Lean module path; the harness passes that one as TILE_REPLY.
	assert.deepEqual(source.match(/\bfinreplies_[a-z0-9_]*lean_[a-z0-9_]*/gu) ?? [], []);
	assert.match(source, /\bTILE_REPLY \*reply\b/u);
});

test("the compiler-shaped aliased reply is the bare Option (Fin 5) extraction leaves, with no nominal alias", () => {
	const ir = finReplyCompilerModel("FinReplies").bindingIr;
	assert.deepEqual(finReplyHostShape(ir, "aliased"), finReplyOptionDigit);
	assert.deepEqual(finReplyHostShape(ir, "maybe"), finReplyOptionDigit);
	assert.ok(!ir.types.some(type => type.kind === "alias"));
});

test("both consumers compile against generated public headers for the fixture module and a renamed one", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-reply-headers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const write = async (root, files) => {
		for(const [path, text] of Object.entries(files))
		{
			await mkdir(dirname(join(root, path)), { recursive: true });
			await writeFile(join(root, path), text);
		}
	};
	const env = { PATH: "/usr/bin:/bin" }, strict = ["-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-fsyntax-only"];
	const tiles = [];
	const expected = { FinReplies: "finreplies_option_lean_fin_replies_tile_value", "Renamed.Replies": "finreplies_option_lean_renamed_replies_tile_value" };
	for(const [module, expectedTile] of Object.entries(expected))
	{
		const model = finReplyCompilerModel(module), root = join(directory, module);
		const names = finReplyConsumerNames(model.bindingIr);
		// Sixteen host callbacks and one reply type, counted separately; only the type carries the module path.
		const { TILE_REPLY: tile, ...hosts } = names;
		assert.equal(Object.keys(hosts).length, 16, module);
		assert.ok(Object.keys(hosts).every(name => name.startsWith("HOST_")), module);
		assert.equal(tile, expectedTile, module);
		tiles.push(tile);
		await write(join(root, "c"), generateGmpProjection(model.bindingIr).files);
		const cpp = generateCppBindingPackage(model.bindingIr);
		await write(join(root, "cpp"), { ...Object.fromEntries(Object.entries(cpp).filter(([path]) => path.startsWith("include/")))
			, "include/finreplies.h": generateCBindingPackage(model.bindingIr)["include/finreplies.h"]
			, ...Object.fromEntries(Object.entries(boostSources()).filter(([path]) => path.startsWith("include/"))) });
		const defines = Object.entries(names).map(([macro, name]) => `-D${macro}=${name}`);
		await runCopied("/usr/bin/cc", ["-std=c11", ...strict, "-I", join(root, "c/include"), ...defines, resolve("tests/fixtures/fin-reply-consumers/c.c")], root, env);
		await runCopied("/usr/bin/c++", ["-std=c++20", ...strict, "-I", join(root, "cpp/include"), resolve("tests/fixtures/fin-reply-consumers/cpp.cpp")], root, env);
	}
	assert.notEqual(tiles[0], tiles[1]);
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
