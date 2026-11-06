/**
 * The recurring value-index matrix audit checks out only its sparse corpus.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertCheckedRecordValueIndexMatrixCi
	, checkedRecordValueIndexMatrixArchiveDirectories
	, checkedRecordValueIndexMatrixArchivePattern
	, checkedRecordValueIndexMatrixBaselinePatterns
	, checkedRecordValueIndexMatrixSparsePatterns
	, checkedRecordValueIndexMatrixWorkflowPath
} from "./checked-record-value-index-matrix-ci.mjs";

const load = async () => [
	await readFile(checkedRecordValueIndexMatrixWorkflowPath, "utf8")
	, JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"))
];

test("value-index matrix audit checks out blob-filtered sparse sources and derives its eleven archive roots", async () => {
	const [workflow, inventory] = await load();
	const cited = assertCheckedRecordValueIndexMatrixCi(workflow, inventory);
	assert.equal(cited.directories.length, 11);
	const lanes = ["browser", "dotnet", "jvm", "native", "perl", "php", "php-wasm", "python", "ruby", "rust", "wit"];
	assert.deepEqual(cited.directories.map(directory => directory.replace(/-\d{8}$/u, ""))
		, lanes.map(lane => `checked-record-value-index-${lane}`));
	assert.deepEqual(cited.sourceRoots, [".github", "scripts", "tests"]);
	assert.deepEqual(checkedRecordValueIndexMatrixSparsePatterns.at(-1), checkedRecordValueIndexMatrixArchivePattern);
	assert.deepEqual(new Set(checkedRecordValueIndexMatrixBaselinePatterns).size, checkedRecordValueIndexMatrixBaselinePatterns.length);
});

test("value-index matrix audit rejects a wider checkout, a missing corpus class or a changed audit", async () => {
	const [workflow, inventory] = await load();
	const checkout = workflow.split("      - name: Check out the exact revision\n")[1].split("\n      - ")[0];
	const mutants = [
		["actions/checkout@v6", "actions/checkout@v4"]
		, ["          fetch-depth: 0\n", "          fetch-depth: 1\n"]
		, ["          filter: blob:none\n", ""]
		, ["          persist-credentials: false\n", ""]
		, ["          sparse-checkout-cone-mode: false", "          sparse-checkout-cone-mode: true"]
		, [`            ${checkedRecordValueIndexMatrixArchivePattern}\n`, "            /docs/evidence/checked-record-*/\n"]
		, ["            /docs/evidence/*/index.json\n", ""]
		, ["            !/docs/evidence/*\n", ""]
		, ["node --test tests/checked-record-value-index-matrix.test.mjs \\", "node --test tests/checked-record-value-index-matrix.test.mjs --test-skip-pattern=history \\"]
		, ["node --test tests/checked-record-value-index-matrix-inventory.test.mjs \\", "true \\"]
		, ["        if: always()\n", "        if: success()\n"]
		, ["    timeout-minutes: 45\n", "    timeout-minutes: 240\n"]
		, ...checkedRecordValueIndexMatrixSparsePatterns.map(pattern => [`            ${pattern}\n`, ""])
	];
	for(const [before, after] of mutants)
	{
		const changed = workflow.replace(before, after);
		assert.notEqual(changed, workflow, before);
		assert.throws(() => assertCheckedRecordValueIndexMatrixCi(changed, inventory), before);
	}
	assert.ok(checkout.includes("filter: blob:none"));
	// A record citing an archive outside the value-index pattern, or a source root outside the sparse set, is refused.
	const forged = structuredClone(inventory);
	const record = forged.evidence.find(item => item.id.startsWith("checked-record-value-index-"));
	record.files[0] = { ...record.files[0], path: "docs/evidence/checked-records-20261008/index.json" };
	assert.throws(() => assertCheckedRecordValueIndexMatrixCi(workflow, forged), /outside/u);
	record.files[0] = { ...record.files[0], path: "build/retained/report.json" };
	assert.throws(() => assertCheckedRecordValueIndexMatrixCi(workflow, forged), /not a sparse source root/u);
	forged.evidence = forged.evidence.filter(item => item !== record);
	assert.throws(() => checkedRecordValueIndexMatrixArchiveDirectories(forged), /Eleven lanes/u);
});
