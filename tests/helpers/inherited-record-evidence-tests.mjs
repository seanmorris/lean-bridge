/**
 * Refuse altered inheritance evidence, broadened claims and missing installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertInheritedNativeReport, assertInheritedNpmReport, assertInheritedRecordArchive, assertInheritedRuns, inheritedRecordEvidenceDirectory, inheritedRecordEvidenceReceipt, writeInheritedRecordArtifact } from "./inherited-record-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${inheritedRecordEvidenceDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "ebca0e21cecc65b708b8cce1c7999932d7934287085a8291e52022ec2c0883c9");
	return JSON.parse(bytes);
};
const files = async () => Object.fromEntries(await Promise.all((await receipt()).artifacts.map(async file => [file.path.split("/").at(-1), await readFile(file.path, "utf8")])));

test("the inheritance archive authenticates eight originals and all 25 selected producer sources", async () => {
	const record = await receipt();
	assert.deepEqual(record, inheritedRecordEvidenceReceipt());
	assert.deepEqual(Object.values(record.producers).map(producer => producer.files.length), [11, 14]);
	assert.equal(record.artifacts.length, 8);
	await assertInheritedRecordArchive(record);
	assert.match(record.freshLean.attribution, /No original queue or execution-revision record/u);
	assert.match(record.scope.sourceIdentity, /not a complete dependency closure/u);
	assert.match(record.scope.environment, /\/app\/build\/lean-link-spike\/lazy and build\/lean-runtime/u);
});

test("the inheritance archive rejects overclaims and foreign paths before reading any artifact", async () => {
	const original = await receipt();
	for(const mutate of [
		copy => { copy.scope.sourcePath = "reviewed-ir"; }
		, copy => { copy.scope.genericHosts.push("browser-javascript"); }
		, copy => { copy.scope.dispatch = "measured"; }
		, copy => { copy.scope.hostedCi = true; }
		, copy => { copy.scope.binaryArchivesRetained = true; }
		, copy => { copy.scope.exclusions = []; }
		, copy => { copy.freshLean.skipped = 0; }
		, copy => { copy.freshLean.attribution = "verified execution revision"; }
		, copy => { copy.producers.plain.revision = copy.producers.generic.revision; }
		, copy => { copy.producers.generic.files.pop(); }
		, copy => { copy.artifacts.pop(); }
		, copy => { copy.artifacts.push(copy.artifacts[0]); }
		, ...["/etc/passwd", "../receipt.json", "docs/evidence/foreign.json"].map(path => copy => { copy.artifacts[0].path = path; })
	]){
		const changed = structuredClone(original); mutate(changed);
		let reads = 0;
		await assert.rejects(() => assertInheritedRecordArchive(changed, async () => { reads++; return Buffer.alloc(0); }));
		assert.equal(reads, 0);
	}
});

test("every original inheritance artifact and producer source rejects unrecorded bytes", async () => {
	const record = await receipt();
	const paths = [...new Set([...record.artifacts.map(file => file.path), ...Object.values(record.producers).flatMap(producer => producer.files.map(file => file.path))])];
	for(const selected of paths)
		await assert.rejects(() => assertInheritedRecordArchive(record, async path => {
			const bytes = await readFile(path);
			return path === selected ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}), undefined, selected);
});

test("inheritance run validation refuses skipped, partial, reordered and failed installed selections", async () => {
	const original = await files();
	assertInheritedRuns(original);
	for(const name of ["plain.tap", "generic.tap"])
		for(const [label, change] of [
			["failure", text => text.replace("ok 1 -", "not ok 1 -")]
			, ["skip", text => text.replace(/^(ok 1 - .+)$/mu, "$1 # SKIP")]
			, ["wrong count", text => text.replace("# pass 1", "# pass 0")]
			, ["missing plan", text => text.replace("1..1\n", "")]
			, ["duplicate plan", text => text.replace("1..1\n", "1..1\n1..1\n")]
			, ["missing terminal", text => text.replace("exit=0\n", "")]
			, ["nonzero exit", text => text.replace("exit=0", "exit=1")]
			, ["wrong TAP id", text => text.replace("ok 1 -", "ok 2 -")]
		])
			assert.throws(() => assertInheritedRuns({ ...original, [name]: change(original[name]) }), undefined, `${name}/${label}`);
	const generic = original["generic.tap"].split(/^# step /mu).slice(1);
	assert.throws(() => assertInheritedRuns({ ...original, "generic.tap": generic.map(part => `# step ${part}`).reverse().join("") }));
	for(const [name, change] of [
		["plain.queue", text => text.replace("PROFILES=c,cpp", "PROFILES=c")]
		, ["plain.queue", text => text.replace("exit=0", "exit=1")]
		, ["generic.queue", text => text.replace("NPM_TEST=1", "NPM_TEST=0")]
		, ["generic.queue", text => text.replace("end npm", "end other")]
		, ["generic.queue", text => text.replace("2.36", "2.38")]
		, ["plain-lean.tap", text => text.replace("# SKIP", "")]
		, ["plain-lean.tap", text => text.replace("# skipped 1", "# skipped 0")]
	]) assert.throws(() => assertInheritedRuns({ ...original, [name]: change(original[name]) }), undefined, name);
});

test("plain and generic native inheritance reports require their exact consumers, isolation and identities", async () => {
	const original = await files();
	for(const kind of ["plain", "generic"])
	{
		const report = JSON.parse(original[`${kind}-native.json`]);
		await assertInheritedNativeReport(report, kind);
		for(const mutate of [
			copy => { copy.reproducible = false; }
			, copy => { copy.reports.pop(); }
			, copy => { copy.reports.reverse(); }
			, copy => { copy.reports[0].path = "reviewed-ir"; }
			, copy => { copy.reports[0].checks--; }
			, copy => { copy.reports[1].checks--; }
			, copy => { copy.reports[0].sourceRemovedBeforeInstallation = false; }
			, copy => { copy.reports[1].offlineInstall = false; }
			, copy => { copy.reports[0].compilerFreePath = false; }
			, copy => { copy.reports[1].consumerSha256 = "0".repeat(64); }
			, copy => { copy.reports[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
			, copy => { copy.reports[1].modelSha256 = "0".repeat(64); }
			, copy => { copy.reports[0].dispatch = { observed: [] }; }
		]){
			const changed = structuredClone(report); mutate(changed);
			await assert.rejects(() => assertInheritedNativeReport(changed, kind));
		}
	}
	const generic = JSON.parse(original["generic-native.json"]);
	for(const mutate of [
		copy => { copy.independentBuilds = 1; }
		, copy => { copy.records.find(record => record.id.endsWith(".NatChild")).fields.reverse(); }
		, copy => { copy.records.find(record => record.id.endsWith(".MarkerTag")).instantiation.arguments = []; }
		, copy => { copy.reports[0].modelBindingIrSha256 = "0".repeat(64); }
	]){
		const changed = structuredClone(generic); mutate(changed);
		await assert.rejects(() => assertInheritedNativeReport(changed, "generic"));
	}
});

test("npm inheritance evidence requires exact parent types, installed strict TypeScript and actual source deletion", async () => {
	const original = JSON.parse((await files())["generic-npm.json"]);
	await assertInheritedNpmReport(original);
	for(const mutate of [
		copy => { copy.checks--; }
		, copy => { copy.rejections--; }
		, copy => { copy.sourceRemovedBeforeInstallation = false; }
		, copy => { copy.offlineInstall = false; }
		, copy => { copy.compilerFreePath = false; }
		, copy => { copy.reproducible = false; }
		, copy => { copy.independentBuilds = 1; }
		, copy => { copy.typescript.strict = false; }
		, copy => { copy.typescript.skipLibCheck = true; }
		, copy => { copy.typescript.sourceSha256 = "0".repeat(64); }
		, copy => { copy.consumerSha256 = "0".repeat(64); }
		, copy => { copy.receiptSha256 = "0".repeat(64); }
		, copy => { copy.archiveSha256 = "0".repeat(64); }
		, copy => { copy.runtimeArchiveSha256 = "0".repeat(64); }
		, copy => { copy.dispatch = "measured"; }
		, copy => { copy.records.find(record => record.id.endsWith(".NatChild")).fields[0].type.id = "lean:OnboardingSmall.Base"; }
	]){
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertInheritedNpmReport(changed));
	}
});

test("inheritance archival allows identical bytes and refuses an overwrite", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-inheritance-archive-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	for(const name of ["receipt.json", "plain-native.json"])
	{
		const path = join(directory, name), bytes = Buffer.from("original\n");
		await writeInheritedRecordArtifact(path, bytes); await writeInheritedRecordArtifact(path, bytes);
		await assert.rejects(() => writeInheritedRecordArtifact(path, Buffer.from("changed\n")));
		assert.deepEqual(await readFile(path), bytes);
	}
});
