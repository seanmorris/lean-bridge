/**
 * Authenticate the source-free installed C/C++ callback observations without
 * promoting unmeasured hosts, native host replies or reviewed contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { finCallbackCompilerModel } from "./fin-callback-model.mjs";
import { finCallbackConsumerNames } from "./fin-callback-install.mjs";
import { finCallbackDispatchExpected } from "./fin-callback-dispatch.mjs";

const directory = "docs/evidence/native-fin-callbacks-20261008";
const digests = {
	report: "d2baf3ddf5de3d4ea652b4faf28581421fede772a722b1fbe974d08aff466f7c"
	, log: "b64f39a26908236dff69551c9c41516f79535fe90469ce20defaab74bd075ca4"
	, queue: "234f7a9cc83aa4256615a66275e7792feec39332e68eb3fca604d05e2dec12f8"
};
const shared = {
	bindingIrSha256: "f019974280603a0d4d437476d4894b0f86bfe51b9725d9b16330dfedf2007a0c"
	, modelSha256: "0f59d618c08f0b4bfc4ddb0ab7892ec7a2194ede7d350c9ad9bf128fd9273cf0"
	, receiptSha256: "6b89f8c1d61c987fb1d135bc4e0ccbbf1bdec67d0bcf3532eb8e445cb30300be"
};
const artifacts = {
	c: { bytes: 53900655, path: "archives/fincallbacks-1.0.0-c.tar.gz", sha256: "a425a89ddcd004b88db8ad0f30bf6741e69a629e03949fce9ad5ea865d84bc07" }
	, cpp: { bytes: 51822223, path: "archives/fincallbacks-1.0.0-cpp.tar.gz", sha256: "d35b7b8219af8ff4f831e1cfa43e2c1b6fc892e32d7ff7ca378c9c0fc0bfa150" }
};
const dispatch = {
	columns: ["public lease-call entry", "checked closure-call adapter", "source body"]
	, symbols: {
		adapter: "lb_t07ff56848fc3a3cd3550_call"
		, entry: "fincallbacks_gmp_owned_callback1469b3ae2047ff62e64f_call"
		, factory: "lb_54bd66dae599b3b7003902f1"
		, source: "l_FinCallbacks_scaled"
	}
	, observed: finCallbackDispatchExpected
	, interposer: "LD_PRELOAD"
	, positiveControl: "valid public and raw calls increment the adapter and source counts"
};
const scope = {
	profiles: ["c", "cpp"], sourcePath: "ordinary-source", exports: 14
	, directions: ["host arguments to returned Lean closures", "Lean-produced closure results", "Lean-produced host callback arguments"]
	, shapes: ["scalar Fin including zero and wide bounds", "Array, List, Option, pairs and active Except branches", "plain record and variant fields"]
	, hostProducedRefinedReplies: false, reviewedContracts: false
	, otherNativeHosts: false
	, dispatch: { c: "public lease entry, checked adapter and source body measured separately", cpp: "not measured" }
};
const validate = (report, consumers) => {
	const reports = ["c", "cpp"].map(profile => ({
		...shared, profile, path: "ordinary-source", compilerFreePath: true
		, offlineInstall: true, sourceRemovedBeforeInstallation: true
		, checks: profile === "c" ? 297 : 283, consumerSha256: consumers[profile]
		, ...(profile === "c" ? { dispatch } : {})
		, packages: [{ target: profile, ecosystem: profile, name: "fincallbacks"
			, version: "1.0.0", profile: "native-library-v1", role: "component"
			, requires: [], runtimeDelivery: "embedded"
			, runtimeIdentity: "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
			, artifacts: [artifacts[profile]] }]
	}));
	assert.deepEqual(report, { schemaVersion: 1, reports, reproducible: true
		, archives: Object.fromEntries(Object.values(artifacts).map(item => [item.path, item.sha256])) });
};
const consumers = async () => {
	// Only the signature-derived C macro names are reconstructed here, not the compiled
	// model identity. The complete consumer digest must match the installed observation.
	const names = finCallbackConsumerNames(finCallbackCompilerModel().bindingIr);
	const receiptBytes = await readFile(`${directory}/receipt.json`);
	assert.equal(sha256(receiptBytes), "726ec4f76cd953e74d887108c8b75f3be5b1e89d7e492a261f6b773436c302e6");
	const receipt = JSON.parse(receiptBytes);
	const source = async (profile, extension) => {
		const path = `tests/fixtures/fin-callback-consumers/${profile}.${extension}`;
		const expected = receipt.sourceFiles.find(file => file.path === path).sha256;
		const previous = beforeFinRefinementSource(path, await readFile(path, "utf8"), expected);
		assert.equal(sha256(previous), expected, path);
		return previous;
	};
	return {
		c: sha256(`${Object.entries(names).map(([macro, name]) => `#define ${macro} ${name}`).join("\n")}\n${await source("c", "c")}`)
		, cpp: sha256(await source("cpp", "cpp"))
	};
};

test("native callback archive preserves the exact producer, consumers, packages and separate dispatch layers", async () => {
	const receiptSource = await readFile(`${directory}/receipt.json`, "utf8");
	assert.equal(sha256(receiptSource), "726ec4f76cd953e74d887108c8b75f3be5b1e89d7e492a261f6b773436c302e6");
	const receipt = JSON.parse(receiptSource);
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.planNode, 1445);
	assert.equal(receipt.execution, "local");
	assert.equal(receipt.revision, "722e9fc190aebb5419fe1da7e5919dc833209442");
	assert.deepEqual(receipt.scope, scope);
	assert.deepEqual(receipt.producerEnvironment, { nodeVersion: "v22.23.3", glibcFloor: "2.36", cpu: 3, concurrency: 1 });
	assert.equal(receipt.sourceFiles.length, 11);
	assert.equal(new Set(receipt.sourceFiles.map(file => file.path)).size, 11);
	for(const file of receipt.sourceFiles)
	{
		// The integration added one history-test import after the frozen producer. Stop
		// at that exact integration source before reversing only the known import.
		const testPath = file.path === "tests/native-fin-callbacks.test.mjs";
		let source = beforeFinRefinementSource(file.path, await readFile(file.path, "utf8"), testPath
			? "80dfd0ffe65d3723ddb7cfd752df240cfd6c34b659fde7ed2137c6f08fcac9fd" : file.sha256);
		if(testPath)
		{
			const added = 'import "./helpers/callback-code-ci-repair-source-history-tests.mjs";\n';
			assert.equal(source.split(added).length, 2);
			source = source.replace(added, "");
		}
		assert.equal(sha256(source), file.sha256, file.path);
	}
	const original = {};
	for(const [key, digest] of Object.entries(digests))
	{
		assert.equal(receipt[key].sha256, digest);
		const path = `${directory}/${key === "report" ? "ordinary.json" : key === "log" ? "ordinary.tap" : "queue.log"}`;
		assert.equal(receipt[key].path, path);
		original[key] = await readFile(path, "utf8");
		assert.equal(sha256(original[key]), digest);
	}
	validate(JSON.parse(original.report), await consumers());
	for(const [key, value] of Object.entries({ tests: 1, pass: 1, fail: 0, skipped: 0 }))
		assert.match(original.log, new RegExp(`^# ${key} ${value}$`, "mu"));
	assert.match(original.log, /^exit=0$/mu); assert.doesNotMatch(original.log, /^not ok /mu);
	assert.match(original.queue, /^revision=722e9fc190aebb5419fe1da7e5919dc833209442$/mu);
	assert.match(original.queue, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.36/u);
	assert.match(original.queue, /exit=0 # pass 1 # fail 0 # skipped 0/u);
	assert.deepEqual([receipt.log.passed, receipt.log.failed, receipt.log.skipped], [1, 0, 0]);
});

test("native callback archive rejects weakened isolation, changed packages and invented dispatch", async () => {
	const report = JSON.parse(await readFile(`${directory}/ordinary.json`, "utf8")), hashes = await consumers();
	for(const mutate of [
		value => { value.reports.pop(); }
		, value => { value.reports[0].checks--; }
		, value => { value.reports[1].checks--; }
		, value => { value.reports[0].consumerSha256 = "0".repeat(64); }
		, value => { value.reports[1].bindingIrSha256 = "0".repeat(64); }
		, value => { value.reports[0].path = "reviewed-source"; }
		, value => { value.reports[0].sourceRemovedBeforeInstallation = false; }
		, value => { value.reports[1].offlineInstall = false; }
		, value => { value.reports[1].compilerFreePath = false; }
		, value => { value.reproducible = false; }
		, value => { value.reports[0].packages[0].requires.push("author checkout"); }
		, value => { value.reports[1].packages[0].artifacts[0].sha256 = "0".repeat(64); }
		, value => { value.reports[0].dispatch.observed[2][2][2]++; }
		, value => { value.reports[0].dispatch.observed[6][2][2] = 0; }
		, value => { value.reports[0].dispatch.columns.reverse(); }
		, value => { value.reports[1].dispatch = structuredClone(dispatch); }
	]) {
		const changed = structuredClone(report); mutate(changed);
		assert.throws(() => validate(changed, hashes));
	}
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	for(const key of ["reviewedContracts", "otherNativeHosts", "hostProducedRefinedReplies"])
		assert.throws(() => assert.deepEqual({ ...receipt.scope, [key]: true }, scope));
});
