/** @file Match C and C++ async consumer executions to their own original releases. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {readFile} from "node:fs/promises";
import {basename, dirname, join} from "node:path";
import test from "node:test";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {sha256} from "../../src/capsule/node.mjs";

const json = async path => JSON.parse(await readFile(path));
const digest = async path => {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	return hash.digest("hex");
};
const routes = ["ordinary", "reviewed"];
const installers = ["pkg-config", "CMake"];
const records = async target => Promise.all(["task-streams","retained-tasks"].map(kind =>
	json("docs/evidence/" + target + "-" + kind + "-20261122.json")));

for (const target of ["c","cpp"]) {
	const cpp = target === "cpp";
	const first = "LEAN_BRIDGE_" + target.toUpperCase() + "_TASK_REPLAY_DIR";
	const second = "LEAN_BRIDGE_" + target.toUpperCase() + "_CALLBACK_RELEASES";
	test(target + ": distinct task/stream and retained-callback clients match their installed records", async () => {
		const [plain, retained] = await records(target);
		for (const record of [plain,retained]) {
			assert.deepEqual(record.releases.map(row => row.route), routes);
			assert.equal(record.profile, "native-" + target + "-task-v1");
			assert.notEqual(record.releases[0].componentIdentity, record.releases[1].componentIdentity);
			assert.notEqual(record.releases[0].sourceTreeSha256, record.releases[1].sourceTreeSha256);
		}
		assert.equal(await digest(plain.consumer), plain.consumerSha256);
		for (const run of plain.releases) {
			assert.equal(run.result, "passed");
			assert.deepEqual(run.consumerInstallations, installers);
		}
		for (const [name,expected] of Object.entries(retained.clientSources)) {
			if (name.startsWith("example.")) {
				const guide = await readFile("docs/consume/" + target + ".md", "utf8");
				const code = guide.split("### Pass a callback to a Lean task\n")[1]
					.split("`".repeat(3) + target + "\n")[1].split("`".repeat(3))[0];
				assert.equal(sha256(Buffer.from(code)), expected);
			} else assert.equal(await digest(join(dirname(retained.consumer),name)),expected);
		}
		assert.deepEqual(retained.installers, installers);
		assert.deepEqual(cpp ? retained.isolatedProcesses : retained.isolated,
			["trap","peer-trap","cancel-trap","retire", ...(cpp ? ["shutdown"] : [])]);
		const coexist = cpp ? retained.abiCoexistence.checked : retained.runtimeCoexistence;
		assert.deepEqual(cpp ? coexist.receipts : [coexist.oldReceiptSha256,coexist.newReceiptSha256],
			[plain.releases[0].packageSetReceiptSha256,retained.releases[0].receiptSha256]);
		assert.deepEqual(cpp ? coexist.includeOrders : coexist.runtimeOrders, ["old-first","new-first"]);
		assert.equal(await digest(cpp ? join(dirname(retained.consumer),"abi-skew.cpp") : coexist.consumer), coexist.sourceSha256);
	});

	test(target + ": original install results, interfaces and all four package archives match", {
		skip: !process.env[first] && !process.env[second] && "set " + first + " and " + second
	}, async () => {
		const [plain, retained] = await records(target);
		const base = process.env[first], peer = process.env[second];
		assert.ok(base && peer, "need both release directories");
		const aggregate = await json(join(peer,"acceptance.json"));
		assert.deepEqual(aggregate.routes,retained.releases);
		assert.deepEqual(aggregate.clientSources,retained.clientSources);
		assert.deepEqual(aggregate.installers,installers);
		assert.deepEqual(aggregate.isolated, cpp ? retained.isolatedProcesses : retained.isolated);
		assert.equal(aggregate.runtimeIdentity,retained.runtimeIdentity);
		for (const [name,hash] of Object.entries(aggregate.clientSources)) {
			assert.equal(await digest(join(peer,"client",name)),hash);
		}
		for (const record of [plain,retained]) for (const row of record.releases) {
			const primary = record === plain;
			const dir = primary ? join(base,row.route) : join(peer,row.route,"handoff");
			const path = join(dir,"package-set-receipt.json");
			const receipt = await json(path), ir = hashBindingIr(await json(join(dir,"binding-ir.json")));
			assert.equal(await digest(path), primary ? row.packageSetReceiptSha256 : row.receiptSha256);
			assert.equal(ir, primary ? record.bindingIrSha256 : row.bindingIrSha256);
			assert.equal(receipt.source.treeSha256,row.sourceTreeSha256);
			assert.deepEqual(receipt.profiles,[{id:record.profile,bindingIrSha256:ir,runtimeIdentity:record.runtimeIdentity}]);
			assert.equal(receipt.packages.length,1);
			assert.deepEqual(receipt.packages[0].artifacts,[row.archive]);
			assert.equal(await digest(join(dir,row.archive.path)),row.archive.sha256);
			if (primary) {
				const run = await json(join(dir,"acceptance.json"));
				assert.equal(run.route,row.route); assert.equal(run.result,"passed");
				assert.deepEqual(run.installedUsing,installers);
				assert.deepEqual(run.archive,row.archive);
				assert.equal(run.componentIdentity,row.componentIdentity);
				assert.equal(run.runtimeIdentity,record.runtimeIdentity);
				assert.equal(run.bindingIrSha256,ir);
				assert.equal(run.consumerSha256,record.consumerSha256);
				assert.equal(await digest(join(dir,basename(record.consumer))),run.consumerSha256);
			}
		}
	});
}
