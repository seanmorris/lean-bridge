/**
 * Require the recurring value-index matrix audit to check out only what it
 * reads: live sources, documentation, root evidence records, archive indexes
 * and the retained value-index archives the inventory records cite.
 *
 * @file
 */
import assert from "node:assert/strict";

export const checkedRecordValueIndexMatrixWorkflowPath
	= ".github/workflows/checked-record-value-index-matrix.yml";
export const checkedRecordValueIndexMatrixEvidencePrefix = "checked-record-value-index-";
export const checkedRecordValueIndexMatrixArchivePattern
	= `/docs/evidence/${checkedRecordValueIndexMatrixEvidencePrefix}*/`;
// The Core contract baseline: every live source root, documentation, root
// evidence records and every archive index, without archive payloads.
export const checkedRecordValueIndexMatrixBaselinePatterns = Object.freeze([
	"/*", "!/*/"
	, "/.github/", "/acceptance/", "/config/", "/containers/", "/demos/"
	, "/nix/", "/notices/", "/patches/", "/poc/", "/schema/", "/scripts/"
	, "/site/", "/src/", "/tests/", "/docs/"
	, "!/docs/evidence/*", "/docs/evidence/*.json", "/docs/evidence/*.md"
	, "/docs/evidence/*.xml", "/docs/evidence/*/index.json"
]);
export const checkedRecordValueIndexMatrixSparsePatterns = Object.freeze([
	...checkedRecordValueIndexMatrixBaselinePatterns
	, checkedRecordValueIndexMatrixArchivePattern
]);
export const checkedRecordValueIndexMatrixCheckout = [
	"uses: actions/checkout@v6", "        with:"
	, "          fetch-depth: 0", "          filter: blob:none"
	, "          persist-credentials: false"
	, "          sparse-checkout: |"
	, ...checkedRecordValueIndexMatrixSparsePatterns.map(pattern => `            ${pattern}`)
	, "          sparse-checkout-cone-mode: false"
].join("\n");
const replay = [
	"set -o pipefail"
	, "mkdir -p build/checked-record-value-index-matrix"
	, "node --test tests/checked-record-value-index-matrix.test.mjs \\"
	, "  | tee build/checked-record-value-index-matrix/evidence.tap"
];
const audit = [
	"set -o pipefail"
	, "node --test tests/checked-record-value-index-matrix-inventory.test.mjs \\"
	, "  | tee build/checked-record-value-index-matrix/inventory.tap"
];

const step = (job, name) => {
	const value = job.split(`      - name: ${name}\n`)[1]?.split("\n      - ")[0];
	assert.ok(value, name); return value;
};
const script = value => value.split("        run: |\n")[1]?.trimEnd().replace(/^ {10}/gmu, "");

/**
 * Derive the retained archive directories and live source roots that the
 * value-index inventory records cite. Archive payloads are never inferred
 * from anything but these records.
 *
 * @param inventory - Parsed type-surface inventory.
 */
export const checkedRecordValueIndexMatrixArchiveDirectories = inventory => {
	const records = inventory.evidence.filter(item =>
		item.id.startsWith(checkedRecordValueIndexMatrixEvidencePrefix));
	assert.equal(records.length, 44, "Eleven lanes with four routes each");
	const directories = new Set(), sourceRoots = new Set();
	for(const record of records)
	{
		assert.equal(record.kind, "installed", record.id);
		assert.ok(record.files.length > 0 && record.artifacts.length > 0, record.id);
		for(const file of record.files)
		{
			const archive = /^docs\/evidence\/([^/]+)\/.+$/u.exec(file.path);
			if(archive) directories.add(archive[1]);
			else
			{
				assert.ok(!file.path.startsWith("docs/evidence/"), file.path);
				sourceRoots.add(file.path.split("/")[0]);
			}
		}
	}
	return { directories: [...directories].sort(), sourceRoots: [...sourceRoots].sort() };
};

/**
 * Require the narrowed audit checkout, unchanged test commands and artifact,
 * and a sparse corpus that covers every cited archive and source root.
 *
 * @param workflow - Complete matrix workflow source.
 * @param inventory - Parsed type-surface inventory.
 */
export const assertCheckedRecordValueIndexMatrixCi = (workflow, inventory) => {
	const job = workflow.split("\njobs:\n  audit:\n")[1];
	assert.ok(job, "audit job");
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 45$/mu);
	const checkoutName = "Check out the exact revision";
	assert.equal(step(job, checkoutName).trim(), checkedRecordValueIndexMatrixCheckout);
	assert.ok(job.indexOf(checkoutName) < job.indexOf("uses: actions/setup-node"));
	assert.ok(job.indexOf("uses: actions/setup-node") < job.indexOf("run: npm ci\n"));
	assert.equal(script(step(job, "Replay immutable matrix evidence")), replay.join("\n"));
	assert.equal(script(step(job, "Audit promoted matrix claims")), audit.join("\n"));
	const upload = step(job, "Preserve matrix audit");
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {10}path: build\/checked-record-value-index-matrix$/mu);
	assert.match(upload, /^ {10}retention-days: 14$/mu);
	const cited = checkedRecordValueIndexMatrixArchiveDirectories(inventory);
	for(const directory of cited.directories)
		assert.ok(directory.startsWith(checkedRecordValueIndexMatrixEvidencePrefix)
			&& /^[a-z-]+\d{8}$/u.test(directory.slice(checkedRecordValueIndexMatrixEvidencePrefix.length))
		, `${directory} is outside ${checkedRecordValueIndexMatrixArchivePattern}`);
	for(const root of cited.sourceRoots)
		assert.ok(checkedRecordValueIndexMatrixSparsePatterns.includes(`/${root}/`), `${root} is not a sparse source root`);
	return cited;
};
