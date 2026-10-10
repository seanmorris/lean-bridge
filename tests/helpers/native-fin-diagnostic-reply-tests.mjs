/**
 * Preserve ordinary installed host-reply diagnostics without inferring dispatch or reviewed R2 acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { finReplyCompilerModel } from "./fin-reply-model.mjs";
import { finReplyConsumerNames } from "./fin-reply-install.mjs";

const directory = "docs/evidence/native-fin-diagnostic-installed-20261010";
const sources = {
	"tests/fixtures/fin-reply-consumers/c.c": "dbf2f1793f6f278804f19453678ae9552133e44a245800ba9498913a74720595"
	, "tests/fixtures/fin-reply-consumers/cpp.cpp": "2133b5383f4b80142e429897f341af7609902542ccdd518d0a80769ff785350f"
};
const artifacts = [
	{ path: "archives/finreplies-1.0.0-c.tar.gz", bytes: 53929028, sha256: "0f1dac48b1f2571b9596a421f2e7477c78993b7d2a92ed1e56202316000f97d6" }
	, { path: "archives/finreplies-1.0.0-cpp.tar.gz", bytes: 51845025, sha256: "655436607789ad6770db3b502c27def4b39074df4b1d5aed50e5daf7e39238aa" }
];
const validate = (report, consumers) => assert.deepEqual(report, {
	schemaVersion: 1, reproducible: true
	, scope: "source-free installed C/C++ acceptance"
	, archives: Object.fromEntries(artifacts.map(artifact => [artifact.path, artifact.sha256]))
	, reports: ["c", "cpp"].map((profile, index) => ({
		profile, path: "ordinary-source", checks: [81, 74][index]
		, consumerSha256: consumers[profile]
		, bindingIrSha256: "c1678777f048a0258c9729d6ff0ac809dce3e9a36425cf4a045259fa21a79f9e"
		, modelSha256: "52b34a4759519adce17e0473a95fc3e866f33ae2380cc4511d399a1b69339337"
		, receiptSha256: "fb0ceb64d4463bb39dc3fd73039fe37f7c1d3e76e9cb44ac29695123c016b4a3"
		, compilerFreePath: true, offlineInstall: true
		, sourceRemovedBeforeInstallation: true
		, instrumentation: "none: installed packages and consumers as built"
		, result: { checks: [81, 74][index], forkHostCalls: 0, forkStatus: 5 }
		, packages: [{ target: profile, ecosystem: profile, name: "finreplies"
			, version: "1.0.0", profile: "native-library-v1", role: "component"
			, requires: [], runtimeDelivery: "embedded"
			, runtimeIdentity: "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
			, artifacts: [artifacts[index]] }] }))
});

test("fresh host-reply diagnostics bind both original consumers to uninstrumented installed packages", async () => {
	const restored = {};
	for(const [path, digest] of Object.entries(sources))
	{
		const source = beforeFinRefinementSource(path, await readFile(path, "utf8"), digest);
		assert.equal(sha256(source), digest);
		restored[path] = source;
	}
	const names = finReplyConsumerNames(finReplyCompilerModel("FinReplies").bindingIr);
	const consumers = {
		c: sha256(`${Object.entries(names).map(([macro, name]) => `#define ${macro} ${name}`).join("\n")}\n${restored["tests/fixtures/fin-reply-consumers/c.c"]}`)
		, cpp: sha256(restored["tests/fixtures/fin-reply-consumers/cpp.cpp"]) };
	assert.deepEqual(consumers, { c: "bfd064415b45c4379c91ceb8cc79912d49fb76d253ba3905de88c0e3567c90e0", cpp: "2133b5383f4b80142e429897f341af7609902542ccdd518d0a80769ff785350f" });
	const bytes = await readFile(`${directory}/host-replies.json`);
	assert.equal(sha256(bytes), "f9b51208677699c8fb19c2e6ee4aee2e7b30d295fc912fed39b815a5bd6b669f");
	const report = JSON.parse(bytes); validate(report, consumers);
	for(const mutate of [
		value => { value.reproducible = false; }
		, value => { value.reports.pop(); }
		, value => { value.reports[0].result.forkHostCalls = 1; }
		, value => { value.reports[0].result.forkStatus = 0; }
		, value => { value.reports[1].checks--; }
		, value => { value.reports[0].path = "reviewed-source"; }
		, value => { value.reports[0].review = "R2"; }
		, value => { value.reports[0].instrumentation = "measured"; }
		, value => { value.reports[0].consumerSha256 = "0".repeat(64); }
		, value => { value.reports[0].sourceRemovedBeforeInstallation = false; }
		, value => { value.reports[0].packages[0].artifacts[0].bytes--; }
		, value => { value.hostedCi = true; }
	]) {
		const changed = structuredClone(report); mutate(changed);
		assert.throws(() => validate(changed, consumers), assert.AssertionError);
	}
});

test("fresh host-reply TAP retains its complete two-root installed selection without skips", async () => {
	const tap = await readFile(`${directory}/host-replies.tap`, "utf8");
	assert.equal(sha256(tap), "b57ae706c5ec57e8bf78d1987825edeb65226375497193e18c993dfb8418ebe4");
	assert.match(tap, /^ok 1 - relocated source-free C and C\+\+ packages check every host reply bound and recover$/mu);
	assert.match(tap, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.doesNotMatch(tap, /^not ok /mu);
	assert.deepEqual([...tap.matchAll(/^# build ([0-9]+): c, cpp$/gmu)].map(match => match[1]), ["0", "1"]);
	for(const profile of ["c", "cpp"]) assert.ok(tap.includes(`# installing and checking ${profile}\n`));
});
