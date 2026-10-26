/**
 * Refusal controls for Core's shard-scoped retained-evidence checkout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	coreContractEvidenceBaseline, coreContractEvidenceDirectoryReferences
	, coreContractEvidenceFragments, coreContractReadsTypeSurface
	, coreSparseCheckoutMode
	, coreTypeSurfaceEvidenceDirectories
} from "../../scripts/core-contract-evidence.mjs";
import { ownedCheckedRecordHostedLaneNames } from "./owned-checked-record-hosted-contracts.mjs";

const directories = Object.freeze([
	"owned-checked-record-native-hosted-20990101"
	, "owned-checked-record-perl-hosted-20990101"
	, "owned-subtype-jvm-hosted-20990101"
	, "zero-payload-checked-record-rust-20990101"
	, "unrelated-archive-20990101"
]);

const checkedJavaScriptPartitionPaths = Object.freeze(Array.from({ length: 12 }
	, (_, index) => `tests/checked-javascript-partition-${String(index + 1)
		.padStart(2, "0")}.test.mjs`));

const checkedJavaScriptImportPattern
	= /^import\s+["'](\.\/helpers\/[^"']+-tests[.]mjs)["'];$/gmu;

const digest = values => createHash("sha256")
	.update(JSON.stringify([...values].toSorted())).digest("hex");

test("Core evidence baseline retains root records and every archive index", () => {
	assert.deepEqual(coreContractEvidenceBaseline, {
		rootPatterns: [
			"/docs/evidence/*.json", "/docs/evidence/*.md"
			, "/docs/evidence/*.xml"
		]
		, archiveIndexPattern: "/docs/evidence/*/index.json"
	});
});

test("Core evidence planning resolves exact paths and enumerated prefixes", () => {
	const exact = 'await readFile("docs/evidence/owned-subtype-jvm-hosted-20990101/report.json")';
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		exact, "exact.mjs", directories)], [
		"owned-subtype-jvm-hosted-20990101"]
	);
	const enumerated = 'readdirSync("docs/evidence"); new RegExp(`^owned-checked-record-${lane}-hosted-\\d{8}$`, "u")';
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		enumerated, "enumerated.mjs", directories)].sort(), [
		"owned-checked-record-native-hosted-20990101"
		, "owned-checked-record-perl-hosted-20990101"]
	);
	const regex = 'readdirSync("docs/evidence"); /^zero-payload-checked-record-.+-20990101$/u';
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		regex, "regex.mjs", directories)], [
		"zero-payload-checked-record-rust-20990101"]
	);
	const partition = "// core-evidence-prefix: owned-subtype-jvm-hosted-";
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		partition, "partition.mjs", directories)], [
		"owned-subtype-jvm-hosted-20990101"]
	);
});

test("Core evidence prefixes do not broaden non-enumerating source", () => {
	const source = 'const label = `owned-checked-record-${lane}`;';
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		source, "metadata.mjs", directories)], []);
	assert.ok(coreContractEvidenceFragments(
		'const path = `owned-subtype-${lane}-hosted`;'
		, "template.mjs").includes("owned-subtype-"));
});

test("Core evidence planning recognizes executable type-surface reads", () => {
	assert.equal(coreContractReadsTypeSurface(
		"const value = await readTypeSurface();", "direct.mjs"), true);
	assert.equal(coreContractReadsTypeSurface(
		"const value = await producer.readTypeSurface();", "property.mjs"), true);
	assert.equal(coreContractReadsTypeSurface(
		"const value = await producer['readTypeSurface']();", "element.mjs"), true);
	assert.equal(coreContractReadsTypeSurface(
		"export function readTypeSurface() {}", "definition.mjs"), false);
	assert.equal(coreContractReadsTypeSurface(
		"// readTypeSurface()", "comment.mjs"), false);
});

test("type-surface reads retain every named evidence directory", () => {
	const document = { evidence: [
		{ files: [
			{ path: "docs/evidence/root-record.json" }
			, { path: "docs/evidence/owned-subtype-jvm-hosted-20990101/report.json" }
			, { path: "src/adoption/type-surface.mjs" }
		] }
		, { files: [
			{ path: "docs/evidence/zero-payload-checked-record-rust-20990101/result.json" }
		] }
	] };
	const expected = [
		"owned-subtype-jvm-hosted-20990101"
		, "zero-payload-checked-record-rust-20990101"
	];
	assert.deepEqual([...coreTypeSurfaceEvidenceDirectories(
		document, directories)], expected);
	assert.throws(() => coreTypeSurfaceEvidenceDirectories({ evidence: [
		{ files: [{ path: "docs/evidence/missing-archive-20990101/report.json" }] }
	] }, directories), /not tracked: missing-archive-20990101/u);
});

test("checked-JavaScript partitions preserve the exact legacy test inventory", async () => {
	const imports = [];
	for(const path of checkedJavaScriptPartitionPaths)
	{
		const source = await readFile(path, "utf8");
		imports.push(...[...source.matchAll(checkedJavaScriptImportPattern)]
			.map(match => match[1]));
	}
	assert.equal(imports.length, 153);
	assert.equal(new Set(imports).size, imports.length
		, "A checked-JavaScript helper must be scheduled exactly once");
	assert.deepEqual(imports.filter(path =>
		path === "./helpers/core-contract-evidence-tests.mjs"), [
		"./helpers/core-contract-evidence-tests.mjs"]
	);
	assert.equal(digest(imports.filter(path =>
		path !== "./helpers/core-contract-evidence-tests.mjs"))
		, "268d568ee5e5c60619aea06b615eb4d62db9c9fac5cdafca7c43ae308142cc3f"
		, "The split must preserve all 152 pre-existing helper-test imports");
});

test("owned checked-record replay partitions bind every lane to its exact archive prefix", async () => {
	for(const lane of ownedCheckedRecordHostedLaneNames)
	{
		const source = await readFile(
			`tests/owned-checked-record-hosted-evidence-${lane}.test.mjs`, "utf8");
		const prefix = `owned-checked-record-${lane}-hosted-`;
		assert.match(source, new RegExp(
			`^// core-evidence-prefix: ${prefix}$`, "mu"));
		assert.match(source, new RegExp(
			`registerOwnedCheckedRecordHostedReplay\\("${lane}"\\s*,\\s*"${prefix}"\\);`, "mu"));
	}
});

test("Core evidence materializer refuses a non-sparse checkout", async () => {
	const source = await readFile(
		"scripts/materialize-core-contract-evidence.mjs", "utf8");
	assert.match(source, /const sparse = coreSparseCheckoutMode\(\)/u);
	assert.match(source, /assert\.equal\(sparse\.sparse, true/u);
	assert.match(source, /assert\.equal\(sparse\.cone, false/u);
	assert.match(source, /execFileSync\("git", \["sparse-checkout", "add", "--stdin"\]/u);
	assert.match(source, /await writeFile\(manifestPath, canonicalJson\(plan\)\)/u);
});

test("Core sparse mode treats checkout's absent cone key as false", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-sparse-mode-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	execFileSync("git", ["init", "--quiet", root]);
	execFileSync("git", ["-C", root, "config", "core.sparseCheckout", "true"]);
	assert.deepEqual(coreSparseCheckoutMode(root)
		, { sparse: true, cone: false });
	execFileSync("git", ["-C", root, "config", "core.sparseCheckoutCone", "true"]);
	assert.deepEqual(coreSparseCheckoutMode(root)
		, { sparse: true, cone: true });
});
