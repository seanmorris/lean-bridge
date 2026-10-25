/**
 * Installed PHP-Wasm acceptance for owned checked records, host callbacks and
 * returned Lean closures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkOwnedPhpWasmPackages } from "./helpers/owned-php-wasm-packages.mjs";
import { bindPhpWasmReceiptArchives } from "./helpers/php-wasm-graph-packages.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { compileOwnedPhpZendModel } from "../src/backends/php/owned-zend-model.mjs";
import { generateOwnedPhpZendPhp } from "../src/backends/php/owned-zend-php.mjs";
import { ownedCheckedRecordMixedSelection } from "./helpers/owned-checked-record-mixed-fixture.mjs";
import {
	assertOwnedCheckedRecordPhpWasmModelCorpus, ownedCheckedRecordPhpWasmCorpora
	, ownedCheckedRecordPhpWasmCorpus
} from "./helpers/owned-checked-record-php-wasm-corpus.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_CHECKED_RECORD_PHP_WASM_TEST === "1";
const modeVariable = "LEAN_BRIDGE_OWNED_CHECKED_RECORD_PHP_WASM_MODES";
const allModes = Object.freeze(["full", "result-only"]);
const modes = process.env[modeVariable]?.split(",") ?? [...allModes];
assert.ok(modes.length && modes.every(mode => allModes.includes(mode)));
assert.equal(new Set(modes).size, modes.length);
const output = resolve("build/owned-checked-record-php-wasm");
const reports = [];

test.before(async () => {
	if(!enabled) return;
	if(modes.length === allModes.length)
		await rm(output, { recursive: true, force: true });
	else
	{
		await rm(join(output, "packages.json"), { force: true });
		for(const mode of modes)
		{
			await rm(join(output, `${mode}.json`), { force: true });
			await rm(join(output, "evidence", mode), { recursive: true, force: true });
		}
	}
});

test.after(async () => {
	if(!enabled || reports.length !== modes.length) return;
	const complete = [];
	for(const mode of allModes)
	{
		try
		{
			const report = JSON.parse(await readFile(join(output, `${mode}.json`), "utf8"));
			assert.equal(report.mode, mode);
			complete.push(report);
		}
		catch(error)
		{
			if(error.code !== "ENOENT") throw error;
		}
	}
	if(complete.length !== allModes.length) return;
	await saveLakeFile(output, "packages.json", canonicalJson({
		schemaVersion: 1
		, profile: "installed-owned-checked-record-php-wasm"
		, reports: complete.toSorted((left, right) => left.mode.localeCompare(right.mode))
	}));
});

for(const mode of modes) test(`installed PHP-Wasm ${mode} owned checked records execute in Node and Chromium`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-owned-checked-record-php-wasm-${mode}-`));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true, force: true });
		else t.diagnostic(`Retained failed ${mode} owned checked-record PHP-Wasm inputs: ${directory}`);
	});
	const report = await checkOwnedPhpWasmPackages(directory, message => {
		t.diagnostic(message); process.stderr.write(message + "\n");
	}, {
		checkedRecords: true, resultOnly: mode === "result-only"
		, evidenceRoot: join(output, "evidence", mode)
	});
	assert.equal(report.mode, mode);
	assert.equal(report.observations.length, 2);
	await saveLakeFile(output, `${mode}.json`, canonicalJson(report));
	reports.push(report); complete = true;
});

test("owned checked-record PHP-Wasm acceptance remains a separate recurring gate", async () => {
	const consumer = await readFile("tests/fixtures/structured-types/owned-checked-record-php-wasm.php");
	assert.equal(ownedCheckedRecordPhpWasmCorpus(consumer), ownedCheckedRecordPhpWasmCorpora.mixed);
	for(const mode of allModes)
	{
		const full = mode === "full";
		const ir = ownedCheckedRecordMixedSelection(`reviewed-${mode}`).reviewedIr;
		const model = compileOwnedPhpZendModel(ir, { transferredInputs: full, hostCallbacks: full });
		const php = generateOwnedPhpZendPhp(model);
		assert.equal(model.integerBits, 32); assert.equal(model.wordBits, 32);
		assert.equal(model.callbacks.length, full ? 2 : 0);
		assertOwnedCheckedRecordPhpWasmModelCorpus({
			exports: model.functions.map(fn => ({ bindingId: fn.id }))
			, ownedGraph: full ? { inputTransfers: { exports: model.functions.filter(fn => fn.transfers?.length)
				.map(fn => ({ bindingId: fn.id, parameters: fn.transfers })) } } : {}
		}, mode, ownedCheckedRecordPhpWasmCorpora.mixed);
		if(full)
			for(const symbol of [
				"booking_span", "claim_quota", "echo_grant", "echo_claims"
				, "transfer_pair_claim", "transfer_with_claim_callback"
			])
				assert.ok(php["src/Api.php"].includes(`function ${symbol}(`), symbol);
	}
	const workflow = await readFile(".github/workflows/owned-checked-record-php-wasm.yml", "utf8");
	const cli = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	for(const dependency of [
		"src/abi/owned-refinement-model.mjs"
		, "src/build/owned-refinement-carriers.mjs"
	]) assert.ok(cli.files.includes(dependency), dependency);
	for(const required of [
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
		, "cancel-in-progress: true"
		, "npm run test:owned-checked-record-php-wasm"
		, "rg '^# fail 0$'"
		, "rg '^# skipped 0$'"
		, "test -s build/owned-checked-record-php-wasm/packages.json"
		, "build/owned-checked-record-php-wasm/evidence"
		, "if: always()\n        uses: actions/upload-artifact@v7"
		, "if: always() && steps.acceptance.outcome != 'success'"
	]) assert.ok(workflow.includes(required), required);
	assert.doesNotMatch(workflow, /continue-on-error:\s*true/u);
});

const writeReceiptHandoff = async (root, archives) => {
	const receipt = { packages: archives.map(item => ({ artifacts: [{
		path: `packages/php-wasm/archives/${item.archive}`
		, bytes: item.content.length, sha256: sha256(item.content)
	}] })) };
	const bytes = canonicalJson(receipt);
	await saveLakeFile(root, "package-set-receipt.json", bytes);
	await saveLakeFile(root, "package-set-receipt.json.sha256"
		, `${sha256(bytes)}  package-set-receipt.json\n`);
	for(const item of archives)
		await saveLakeFile(root, `packages/php-wasm/archives/${item.archive}`, item.content);
	return { archives: archives.map(item => ({ archive: item.archive
		, bytes: item.content.length, sha256: sha256(item.content) })) };
};

test("PHP-Wasm receipt handoff binds exactly the verified archive bytes", async t => {
	const parent = await mkdtemp(join(tmpdir(), "lean-php-wasm-receipt-handoff-"));
	t.after(() => rm(parent, { recursive: true, force: true }));
	const archives = [
		{ archive: "component.tgz", content: Buffer.from("component archive") }
		, { archive: "api.zip", content: Buffer.from("composer archive") }
	];
	let index = 0;
	const handoff = async () => {
		const root = join(parent, `handoff-${index++}`);
		return { root, report: await writeReceiptHandoff(root, archives) };
	};
	const valid = await handoff();
	assert.equal(await bindPhpWasmReceiptArchives(valid.root, valid.report)
		, join(valid.root, "packages/php-wasm/archives"));

	const source = await handoff();
	await saveLakeFile(source.root, "OwnedCheckedRecords.lean", "-- author source\n");
	await assert.rejects(bindPhpWasmReceiptArchives(source.root, source.report)
		, /exactly the receipt-named package set/u);
	const extra = await handoff();
	await saveLakeFile(extra.root, "packages/php-wasm/archives/extra.tgz", "extra");
	await assert.rejects(bindPhpWasmReceiptArchives(extra.root, extra.report)
		, /exactly the receipt-named package set/u);
	const missing = await handoff();
	await rm(join(missing.root, "packages/php-wasm/archives/api.zip"));
	await assert.rejects(bindPhpWasmReceiptArchives(missing.root, missing.report)
		, /exactly the receipt-named package set/u);
	const changed = await handoff();
	await saveLakeFile(changed.root, "packages/php-wasm/archives/api.zip", "composer archivE");
	await assert.rejects(bindPhpWasmReceiptArchives(changed.root, changed.report)
		, /packages\/php-wasm\/archives\/api\.zip/u);
	const linked = await handoff();
	await rm(join(linked.root, "packages/php-wasm/archives/api.zip"));
	await symlink(join(valid.root, "packages/php-wasm/archives/api.zip")
		, join(linked.root, "packages/php-wasm/archives/api.zip"));
	await assert.rejects(bindPhpWasmReceiptArchives(linked.root, linked.report)
		, /must be regular files/u);
	const unlisted = await handoff();
	await assert.rejects(bindPhpWasmReceiptArchives(unlisted.root
		, { archives: unlisted.report.archives.slice(1) })
	, /exactly the verified package archives/u);
	const pretty = await handoff();
	const receipt = JSON.parse(await readFile(join(pretty.root, "package-set-receipt.json"), "utf8"));
	await saveLakeFile(pretty.root, "package-set-receipt.json", JSON.stringify(receipt, null, 2));
	await assert.rejects(bindPhpWasmReceiptArchives(pretty.root, pretty.report)
		, /receipt must be canonical/u);
	const sidecar = await handoff();
	await saveLakeFile(sidecar.root, "package-set-receipt.json.sha256"
		, `${"0".repeat(64)}  package-set-receipt.json\n`);
	await assert.rejects(bindPhpWasmReceiptArchives(sidecar.root, sidecar.report)
		, /sidecar must match/u);
});

test("owned PHP-Wasm consumers install the same receipt-only bytes that are retained", async t => {
	const helper = await readFile("tests/helpers/owned-php-wasm-packages.mjs", "utf8");
	for(const required of [
		"await retainPackageSetEvidence(buildRoot, retainedRoot)"
		, "await copyPackageSetHandoff(retainedRoot ?? buildRoot, handoff)"
		, "const archiveRoot = await bindPhpWasmReceiptArchives(handoff, release.report)"
		, "release: { ...release, output: sourceFree ? packageHandoff : releaseRoot, archiveRoot }"
	]) assert.ok(helper.includes(required), required);
	assert.doesNotMatch(helper, /cp\(handoff/u);
	const installer = await readFile("tests/helpers/php-wasm-graph-packages.mjs", "utf8");
	assert.ok(installer.includes(
		"readFile(join(entry.archiveRoot ?? join(entry.output, \"archives\"), item.archive))"));

	const directory = await mkdtemp(join(tmpdir(), "lean-php-wasm-evidence-root-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	for(const evidenceRoot of [join(directory, "evidence"), directory, join(directory, "..")])
		await assert.rejects(checkOwnedPhpWasmPackages(directory, () => {}, {
			checkedRecords: true, evidenceRoot
		}), /outside the test-owned author and consumer root/u);
});
