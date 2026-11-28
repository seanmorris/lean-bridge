/**
 * Install native packages containing a task beside direct pure, BaseIO and IO calls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { buildEffectHandoffs } from "./native-effect-packages.mjs";
import { runEffectConsumers } from "./native-effect-consumers.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const produce = env.LEAN_BRIDGE_TASK_COMPANION_EVIDENCE, replay = env.LEAN_BRIDGE_TASK_COMPANION_REPLAY;
const targets = ["pypi", "c", "cpp", "cargo"], read = async file => JSON.parse(await readFile(file, "utf8"));
const fixture = resolve("tests/fixtures/native-task-companions");
const sample = { fixture, module: "Companions.lean", routes: ["ordinary"]
	// A debug Rust binary verifies the embedded runtime before invoking Lean.
	// At an externally imposed quarter-core duty cycle, preserve the normal CPU allowance.
	, rustClientTimeoutMs: env.LEAN_BRIDGE_TASK_COMPANION_QUARTER_CPU === "1" ? 4 * 45_000 : 45_000
	, check: async handoff => {
		const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const api = await read(join(handoff, "binding-ir.json")), proof = await read(join(handoff, "host-export-evidence.json"));
		assert.equal(receipt.profiles[0].bindingIrSha256, hashBindingIr(api)); assert.equal(proof.sourceTreeSha256, receipt.source.treeSha256);
		assert.equal(proof.reviewedSourceSha256, null);
		assert.deepEqual(Object.fromEntries(api.declarations.map(d => [d.name, [d.resultMode, d.effects.includes("async")]])), {
			plain: ["value", false], bump: ["value", false]
			, finish: ["value", false], doubled: ["promise", true]
		});
		assert.deepEqual(api.declarations.find(d => d.name === "finish").capabilities, ["capability:native.filesystem"]);
		const report = { profile: receipt.profiles[0].id
			, receiptSha256: result.receiptSha256
			, bindingIrSha256: hashBindingIr(api)
			, sourceTreeSha256: receipt.source.treeSha256
			, runtimeIdentity: receipt.profiles[0].runtimeIdentity
			, archives: receipt.packages.flatMap(p => p.artifacts) };
		return { api, receipt, report };
	}
};

test("builds native task packages with ordinary pure and BaseIO companions", { skip: !produce, timeout: 3_600_000 }, async t => {
	const root = resolve(produce), clients = join(root, "clients"); await mkdir(clients, { recursive: true });
	for(const name of ["consumer.c", "consumer.cpp", "consumer.rs", "consumer.py"])
		await copyFile(join(fixture, name), join(clients, name), constants.COPYFILE_EXCL);
	for(const target of targets) await t.test(target, async () => { await buildEffectHandoffs(root, target, env, sample); });
});

test("installed task consumers keep adjacent pure, BaseIO and IO calls synchronous", { skip: !produce && !replay, timeout: 3_600_000 }, async t => {
	const root = resolve(replay || produce), work = await mkdtemp(join(tmpdir(), "task-companion-consumers-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const reports = [];
	const fixtureWithClients = { ...sample, clients: join(root, "clients") };
	for(const target of targets) await t.test(target, async () => { reports.push(...await runEffectConsumers(work, root, target, env, fixtureWithClients)); });
	assert.equal(reports.length, targets.length);
	for(const key of ["bindingIrSha256", "sourceTreeSha256", "runtimeIdentity"])
	{
		assert.match(reports[0][key], /^[0-9a-f]{64}$/u);
		assert.ok(reports.every(r => r[key] === reports[0][key]), "All four targets must agree on " + key);
	}
	const report = { schemaVersion: 1, routes: reports }, path = join(root, "acceptance.json");
	if(!replay) await writeFile(path, canonicalJson(report), { flag: "wx" });
	else
	{
		const b = await readFile(path); assert.deepEqual(report, JSON.parse(b));
		if(env.LEAN_BRIDGE_TASK_COMPANION_EXPECTED)
		{
			const expected = await read(resolve(env.LEAN_BRIDGE_TASK_COMPANION_EXPECTED));
			assert.deepEqual(reports, expected.routes); assert.equal(sha256(b), expected.acceptanceSha256);
		}
	}
});
