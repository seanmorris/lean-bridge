/**
 * The current-source pin preflight reports every drift in one pass and never writes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	auditCurrentSourcePins, currentSourcePinCohort
	, formatCurrentSourcePinPreflight, previewCurrentSourcePinRefresh
} from "./current-source-pin-preflight.mjs";

const digest = text => createHash("sha256").update(text).digest("hex");
const inventoryPath = "docs/type-surface.v1.json";
const script = resolve("scripts/preflight-current-source-pins.mjs");

/**
 * Lay out a small repository whose inventory pins three live sources and one archive.
 *
 * @param t - Test context owning the temporary directory.
 */
const repository = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-pin-preflight-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sources = { "src/a.mjs": "export const a = 1;\n", "src/b.mjs": "export const b = 2;\n", "tests/c.test.mjs": "import test from \"node:test\"; test(\"c\", () => {});\n" };
	await mkdir(join(root, "src"), { recursive: true });
	await mkdir(join(root, "tests"), { recursive: true });
	await mkdir(join(root, "docs/evidence/archive-20260101"), { recursive: true });
	for(const [path, text] of Object.entries(sources)) await writeFile(join(root, path), text);
	await writeFile(join(root, "docs/evidence/archive-20260101/index.json"), "{\"schemaVersion\":1}\n");
	const pin = (path, text = sources[path]) => ({ path, sha256: digest(text) });
	const inventory = { evidence: [
		{ id: "first-installed", files: [pin("src/a.mjs"), pin("src/b.mjs"), pin("docs/evidence/archive-20260101/index.json", "{\"schemaVersion\":1}\n")] }
		, { id: "second-installed", files: [pin("src/a.mjs"), pin("tests/c.test.mjs")] }
		, { id: "third-installed", files: [pin("src/b.mjs"), pin("tests/c.test.mjs")] }
	] };
	const write = async value => writeFile(join(root, inventoryPath), `${JSON.stringify(value, null, 2)}\n`);
	await write(inventory);
	return { root, inventory, sources, write };
};

test("current-source pin preflight passes a clean inventory and selects only live sources", async t => {
	const { root, inventory } = await repository(t);
	assert.deepEqual(currentSourcePinCohort(inventory), ["src/a.mjs", "src/b.mjs", "tests/c.test.mjs"]);
	const report = await auditCurrentSourcePins(inventory, { repository: root });
	assert.deepEqual(report, { cohort: 3, occurrences: 6, findings: [] });
	assert.deepEqual(previewCurrentSourcePinRefresh(inventory, report), { paths: 0, refreshed: 0 });
	assert.equal(formatCurrentSourcePinPreflight(report, { paths: 0, refreshed: 0 })
		, "Current-source pin preflight: 3 cohort path(s), 6 pin occurrence(s), 0 finding(s) (0 stale, 0 missing, 0 conflicting); a refresh would rewrite 0 pin(s) across 0 path(s).");
	const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /^Current-source pin preflight: 3 cohort path\(s\)/u);
});

test("current-source pin preflight aggregates stale, missing and conflicting pins in one run without writing", async t => {
	const { root, inventory, sources, write } = await repository(t);
	await writeFile(join(root, "src/a.mjs"), "export const a = 10;\n");
	await rm(join(root, "tests/c.test.mjs"));
	// A drifted archive is never a current-source finding; its own verifier owns it.
	await writeFile(join(root, "docs/evidence/archive-20260101/index.json"), "{\"schemaVersion\":2}\n");
	inventory.evidence[2].files[0].sha256 = digest("export const b = 3;\n");
	await write(inventory);
	const before = await readFile(join(root, inventoryPath), "utf8");
	const report = await auditCurrentSourcePins(inventory, { repository: root });
	assert.equal(report.cohort, 3); assert.equal(report.occurrences, 6);
	const stale = {
		path: "src/a.mjs", kind: "stale", pins: 2
		, expectedSha256: [digest(sources["src/a.mjs"])]
		, actualSha256: digest("export const a = 10;\n")
		, evidenceIds: ["first-installed", "second-installed"]
	};
	const conflicting = {
		path: "src/b.mjs", kind: "conflicting", pins: 2
		, expectedSha256: [digest(sources["src/b.mjs"]), digest("export const b = 3;\n")].sort()
		, actualSha256: digest(sources["src/b.mjs"])
		, evidenceIds: ["first-installed", "third-installed"]
	};
	const missing = {
		path: "tests/c.test.mjs", kind: "missing", pins: 2
		, expectedSha256: [digest(sources["tests/c.test.mjs"])]
		, actualSha256: null
		, evidenceIds: ["second-installed", "third-installed"]
	};
	assert.deepEqual(report.findings, [stale, conflicting, missing]);
	// Two stale pins of a plus the one conflicting pin of b; the missing source cannot be refreshed.
	assert.deepEqual(previewCurrentSourcePinRefresh(inventory, report), { paths: 2, refreshed: 3 });
	const text = formatCurrentSourcePinPreflight(report, { paths: 2, refreshed: 3 });
	assert.match(text, /^stale src\/a\.mjs: 2 pin\(s\) in 2 record\(s\); expected [a-f0-9]{12}, live [a-f0-9]{12}; first-installed, second-installed\n/u);
	assert.match(text, /\nconflicting src\/b\.mjs: 2 pin\(s\) in 2 record\(s\); expected [a-f0-9]{12}\|[a-f0-9]{12}, live [a-f0-9]{12}; /u);
	assert.match(text, /\nmissing tests\/c\.test\.mjs: 2 pin\(s\) in 2 record\(s\); expected [a-f0-9]{12}, live absent; /u);
	assert.match(text, /\nCurrent-source pin preflight: 3 cohort path\(s\), 6 pin occurrence\(s\), 3 finding\(s\) \(1 stale, 1 missing, 1 conflicting\); a refresh would rewrite 3 pin\(s\) across 2 path\(s\)\.$/u);
	const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
	assert.equal(result.status, 1, result.stderr);
	assert.equal(result.stdout, `${text}\n`);
	assert.equal(await readFile(join(root, inventoryPath), "utf8"), before);
	assert.equal(await readFile(join(root, "src/a.mjs"), "utf8"), "export const a = 10;\n");
});

test("current-source pin preflight audits an exact subset and refuses unpinned or archive paths", async t => {
	const { root, inventory } = await repository(t);
	await writeFile(join(root, "src/a.mjs"), "export const a = 10;\n");
	await writeFile(join(root, "src/b.mjs"), "export const b = 20;\n");
	const subset = await auditCurrentSourcePins(inventory, { repository: root, paths: ["src/b.mjs", "src/b.mjs"] });
	assert.equal(subset.cohort, 1); assert.equal(subset.occurrences, 2);
	assert.deepEqual(subset.findings.map(finding => [finding.path, finding.kind]), [["src/b.mjs", "stale"]]);
	const complete = await auditCurrentSourcePins(inventory, { repository: root });
	assert.deepEqual(complete.findings.map(finding => finding.path), ["src/a.mjs", "src/b.mjs"]);
	for(const paths of [["src/unpinned.mjs"], ["docs/evidence/archive-20260101/index.json"]])
		await assert.rejects(auditCurrentSourcePins(inventory, { repository: root, paths }), assert.AssertionError);
	// An absent repository root reports every source as missing instead of stopping at the first one.
	const absent = await auditCurrentSourcePins(inventory, { repository: join(root, "missing") });
	assert.deepEqual(absent.findings.map(finding => [finding.path, finding.kind, finding.actualSha256])
		, [["src/a.mjs", "missing", null], ["src/b.mjs", "missing", null], ["tests/c.test.mjs", "missing", null]]);
});
