/**
 * Refusal controls for Core's shard-scoped retained-evidence checkout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import {
	collectCoreContractEvidencePlan, collectCoreTypeSurfaceEvidencePlan
	, coreContractDocumentationEvidenceFiles
	, coreContractDocumentationReferences, coreContractEvidenceBaseline
	, coreContractEvidenceDirectoryReferences, coreContractExecutableEvidenceFiles
	, coreContractEvidenceFragments, coreContractReadsTypeSurface
	, coreSparseCheckoutMode
	, coreTypeSurfaceEvidenceDirectories, coreTypeSurfaceEvidenceReceipt
} from "../../scripts/core-contract-evidence.mjs";
import { readTypeSurface } from "../../src/adoption/type-surface.mjs";
import {
	assertTypeSurfaceEvidenceReceipt, createTypeSurfaceEvidenceReceipt
	, typeSurfaceEvidenceFiles, typeSurfaceEvidenceSourcePaths
} from "../../src/adoption/type-surface-evidence-receipt.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	assertHistoricalTypeSurfaceEvidence, historicalTypeSurfaceGitSources
} from "./type-surface-historical-evidence.mjs";
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
		enumerated, "enumerated.mjs", directories)].sort(), []
		, "index-only enumeration needs no payload directories"
	);
	const replayed = enumerated
		+ "; await checkOwnedCheckedRecordHostedEvidence(lane, root)";
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		replayed, "replayed.mjs", directories)].sort(), [
		"owned-checked-record-native-hosted-20990101"
		, "owned-checked-record-perl-hosted-20990101"]);
	const regex = 'readdirSync("docs/evidence"); /^zero-payload-checked-record-.+-20990101$/u';
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		regex, "regex.mjs", directories)], []);
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		regex + "; checkZeroPayloadEvidence(root)", "regex.mjs", directories)], [
		"zero-payload-checked-record-rust-20990101"]);
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

test("Core evidence planning closes dynamic callback and dependent lanes", async () => {
	const callbackLanes = [
		"browser", "native", "languages", "perl", "dotnet", "jvm"
		, "php-native", "wit-wasi"
	];
	const callbackDirectories = callbackLanes.map(lane =>
		`callback-checked-record-${lane}-20990101`);
	const callbackSource = await readFile(
		"tests/helpers/callback-checked-record-hosted-evidence-sources.mjs"
		, "utf8");
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		callbackSource
		, "tests/helpers/callback-checked-record-hosted-evidence-sources.mjs"
		, callbackDirectories)].sort(), callbackDirectories.sort());
	const callbackSubtypeDirectories = [
		"callback-subtype-browser-20261022"
		, "callback-subtype-native-20261020"
		, "callback-subtype-native-20261022"
		, "callback-subtype-languages-20261022"
		, "callback-subtype-perl-20261022"
		, "callback-subtype-dotnet-20261022"
		, "callback-subtype-jvm-20261022"
		, "callback-subtype-php-native-20261022"
		, "callback-subtype-wit-wasi-20261022"
	];
	const callbackSubtypeSource = await readFile(
		"tests/helpers/callback-subtype-hosted-evidence-sources.mjs"
		, "utf8");
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		callbackSubtypeSource
		, "tests/helpers/callback-subtype-hosted-evidence-sources.mjs"
		, callbackSubtypeDirectories)].sort()
	, callbackSubtypeDirectories.filter(directory =>
		directory !== "callback-subtype-native-20261020").sort());

	const dependentLanes = [
		"browser", "native", "dotnet", "jvm", "php", "php-wasm"
		, "python", "ruby", "rust", "perl", "wit"
	];
	const dependentDirectories = dependentLanes.map(lane =>
		`dependent-checked-record-${lane}-20990101`);
	const dependentSource = await readFile(
		"tests/helpers/dependent-checked-record-promotion.mjs", "utf8");
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		dependentSource, "tests/helpers/dependent-checked-record-promotion.mjs"
		, dependentDirectories)].sort(), dependentDirectories.sort());

	const ownedDirectories = [
		"javascript", "native", "perl", "languages", "dotnet", "jvm"
		, "php-native", "wit-wasi"
	].map(lane =>
		`owned-subtype-${lane}-hosted-20990101`);
	const ownedSource = await readFile(
		"tests/helpers/owned-subtype-promotion-catalog.mjs", "utf8");
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		ownedSource, "tests/helpers/owned-subtype-promotion-catalog.mjs"
		, ownedDirectories)].sort(), ownedDirectories.sort());
});

test("Core evidence planning closes native specialization inventory files", async () => {
	const source = await readFile(
		"tests/helpers/native-specialization-closure.mjs", "utf8");
	const available = [
		"generic-record-specializations-20990101"
		, "generic-record-arrays-20990101"
		, "unrelated-specializations-20990101"
	];
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		source, "tests/helpers/native-specialization-closure.mjs", available)]
		, ["generic-record-specializations-20990101"
			, "generic-record-arrays-20990101"]);
});

test("Core evidence planning closes the original reviewed Fin archive", async () => {
	const source = await readFile(
		"tests/helpers/fin-refinement-source-history.mjs", "utf8");
	const available = ["python-refinements-20990101"
		, "reviewed-fin-20990101", "reviewed-fin-hosts-20990101"];
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		source, "tests/helpers/fin-refinement-source-history.mjs", available)]
		, ["reviewed-fin-20990101", "python-refinements-20990101"]);
});

test("Core evidence planning ignores rendered documentation links in code", () => {
	const source = 'const prose = "[record](../evidence/owned-subtype-jvm-hosted-20990101/index.json)";';
	assert.deepEqual([...coreContractEvidenceDirectoryReferences(
		source, "generator.mjs", directories)], []);
});

test("Core evidence planning retains exact historical additions", () => {
	const path = "docs/evidence/nominal-primitive-subtype-supplement-20990101/.gitattributes";
	const source = `export const added = ["${path}"];`;
	assert.deepEqual([...coreContractExecutableEvidenceFiles(
		source, "repair-source-history.mjs", [path])], [path]);
	assert.deepEqual([...coreContractExecutableEvidenceFiles(
		source, "repair-source-history.mjs", [])], []);
});

test("Core evidence planning follows documentation named by contracts", async () => {
	const path = "tests/component-consumer-docs.test.mjs";
	const source = await readFile(path, "utf8");
	const references = await coreContractDocumentationReferences(source, path);
	assert.deepEqual([...references].sort(), [
		"docs/consume/browser.md"
		, "docs/consume/javascript.md"
		, "docs/consume/typescript.md"
		, "docs/javascript-typescript.md"
	].sort());
	const documents = await Promise.all([...references].map(async reference => ({
		reference, source: await readFile(reference, "utf8")
	})));
	const expected = new Set();
	for(const { reference, source: document } of documents)
		for(const match of document.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu))
		{
			const target = match[1].split("#")[0];
			if(!target || /^[a-z]+:/u.test(target)) continue;
			const path = relative(resolve(".")
				, resolve(dirname(reference), target)).replaceAll("\\", "/");
			if(/^docs\/evidence\/[^/]+\//u.test(path)) expected.add(path);
		}
	assert.ok(expected.size > 20);
	assert.ok(expected.has(
		"docs/evidence/scalar-fin-source-entry-20261008/receipt.json"));
	assert.ok(expected.has(
		"docs/evidence/browser-callback-fin-20261008/receipt.json"));
	const selected = new Set();
	for(const { reference, source: document } of documents)
		for(const value of coreContractDocumentationEvidenceFiles(
			document, reference, [...expected]))
			selected.add(value);
	assert.deepEqual([...selected].sort(), [...expected].sort());
	assert.deepEqual([...await coreContractDocumentationReferences(
		'const paths = ["docs/evidence/archive/report.md"'
			+ ', "outside.md", "docs/missing.md"];', path)], []);
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

test("one exact workflow receipt closes repeated type-surface reads", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-type-surface-receipt-"));
	t.after(() => rm(root, { recursive: true }));
	const sources = Object.fromEntries(await Promise.all(
		typeSurfaceEvidenceSourcePaths.map(async path => [
			path, await readFile(path)
		])
	));
	const document = JSON.parse(
		sources["docs/type-surface.v1.json"].toString("utf8")
	);
	const commit = execFileSync("git", ["rev-parse", "HEAD"])
		.toString().trim();
	const sourceSha256 = Object.fromEntries(typeSurfaceEvidenceSourcePaths
		.map(path => [path
		, createHash("sha256").update(sources[path])
			.digest("hex")]));
	const receipt = createTypeSurfaceEvidenceReceipt({
		commit, document, sourceSha256
	});
	const citations = document.evidence.flatMap(evidence => evidence.files);
	const uniqueFiles = typeSurfaceEvidenceFiles(document);
	assert.equal(uniqueFiles.length, receipt.evidence.count);
	assert.ok(citations.length > uniqueFiles.length);
	assert.throws(() => typeSurfaceEvidenceFiles({ evidence: [
		{ files: [{ path: "same", sha256: "0".repeat(64) }] }
		, { files: [{ path: "same", sha256: "1".repeat(64) }] }
	] }), /Conflicting evidence digest/u);
	assert.equal(assertTypeSurfaceEvidenceReceipt(receipt, {
		commit, document, sourceSha256
	}), true);
	const path = join(root, "receipt.json");
	await writeFile(path, JSON.stringify(receipt));
	assert.deepEqual(await coreTypeSurfaceEvidenceReceipt(path), receipt);
	assert.equal((await readTypeSurface({ evidenceReceipt: path }))
		.document.contractVersion, document.contractVersion);
	const [shard, reviewedFinShard, pythonRefinementShard, corpus]
		= await Promise.all([
		collectCoreContractEvidencePlan("1/12", resolve(".")
			, { evidenceReceipt: path })
		, collectCoreContractEvidencePlan("10/12", resolve(".")
			, { evidenceReceipt: path })
		, collectCoreContractEvidencePlan("11/12", resolve(".")
			, { evidenceReceipt: path })
		, collectCoreTypeSurfaceEvidencePlan()
		]);
	assert.equal(shard.evidence.completeTypeSurface, true);
	assert.equal(shard.evidence.typeSurfaceAuthentication
		, "workflow-receipt-v1");
	assert.ok(shard.evidence.directoryCount < corpus.evidence.directoryCount);
	assert.ok(reviewedFinShard.evidence.directories.includes(
		"reviewed-fin-20261007"));
	assert.ok(pythonRefinementShard.evidence.directories.includes(
		"python-refinements-20261007"));
	for(const forged of [
		{ ...receipt, commit: "0".repeat(40) }
		, { ...receipt, evidence: { ...receipt.evidence, count: 0 } }
		, { ...receipt, sources: {
			...receipt.sources
			, "docs/type-surface.v1.json": "0".repeat(64)
		} }
	]) assert.throws(() => assertTypeSurfaceEvidenceReceipt(forged, {
		commit, document, sourceSha256
	}));
});

test("historical type-surface checks reuse live pins and reconstruct only changed Git sources", async () => {
	const same = Buffer.from("same\n"), liveBytes = Buffer.from("live\n");
	const oldBytes = Buffer.from("old\n");
	const live = { evidence: [{ files: [
		{ path: "same.txt", sha256: sha256(same) }
		, { path: "changed.txt", sha256: sha256(liveBytes) }
	] }] };
	const historical = { evidence: [{ files: [
		{ path: "same.txt", sha256: sha256(same) }
		, { path: "changed.txt", sha256: sha256(oldBytes) }
	] }] };
	const reads = [];
	const readSources = (paths, revision) => {
		reads.push(paths); assert.match(revision, /^[a-f0-9]{40}$/u);
		return new Map([["changed.txt", liveBytes]]);
	};
	const normalize = (path, source, expected) => {
		assert.equal(path, "changed.txt"); assert.deepEqual(source, liveBytes);
		assert.equal(expected, sha256(oldBytes)); return oldBytes;
	};
	assert.deepEqual(await assertHistoricalTypeSurfaceEvidence(historical, {
		live, normalize, readSources
	}), { count: 2, inherited: 1, reconstructed: 1 });
	assert.deepEqual(reads, [["changed.txt"]]);
	await assert.rejects(() => assertHistoricalTypeSurfaceEvidence(historical, {
		live, normalize: () => Buffer.from("forged\n"), readSources
	}), /changed[.]txt/u);
});

test("historical type-surface Git reads are exact, bounded and isolated from callers", async () => {
	const revision = execFileSync("git", ["rev-parse", "HEAD"])
		.toString().trim();
	const expected = await readFile("package.json");
	const first = historicalTypeSurfaceGitSources([
		"package.json", "package.json"
	], revision);
	assert.equal(first.size, 1);
	assert.deepEqual(first.get("package.json"), expected);
	first.get("package.json")[0] ^= 255;
	assert.deepEqual(historicalTypeSurfaceGitSources([
		"package.json"
	], revision).get("package.json"), expected);
	for(const paths of [["../package.json"], ["/package.json"]
		, ["package.json\nHEAD:package-lock.json"]])
		assert.throws(() => historicalTypeSurfaceGitSources(paths, revision));
	assert.throws(() => historicalTypeSurfaceGitSources(
		["package.json"], "HEAD"));
});

// The 153-import legacy inventory is the partition split's own; later history layers only append.
const checkedJavaScriptPartitionMilestone = "ee99d0b30784e0402d59eaa7d326865d98d59051";
const checkedJavaScriptImports = source => [...source.matchAll(
	checkedJavaScriptImportPattern)].map(match => match[1]);
const assertCheckedJavaScriptSchedule = (legacy, live) => {
	assert.equal(new Set(live).size, live.length
		, "A checked-JavaScript helper must be scheduled exactly once");
	assert.deepEqual(legacy.filter(path => !live.includes(path)), []
		, "Every legacy helper-test import must stay scheduled");
};

test("checked-JavaScript partitions preserve the exact legacy test inventory", async () => {
	const imports = [], live = [];
	for(const path of checkedJavaScriptPartitionPaths)
	{
		imports.push(...checkedJavaScriptImports(execFileSync("git", ["show"
			, `${checkedJavaScriptPartitionMilestone}:${path}`], { encoding: "utf8" })));
		live.push(...checkedJavaScriptImports(await readFile(path, "utf8")));
	}
	assertCheckedJavaScriptSchedule(imports, live);
	for(const changed of [live.filter(path => path !== imports[0])
		, [...live, imports.at(-1)]])
		assert.throws(() => assertCheckedJavaScriptSchedule(imports, changed));
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

test("type surface binds every live nominal browser workflow pin", async () => {
	const path = ".github/workflows/nominal-primitive-subtype-browser.yml";
	const [workflow, inventorySource] = await Promise.all([
		readFile(path), readFile("docs/type-surface.v1.json", "utf8")
	]);
	const currentSha256 = createHash("sha256").update(workflow).digest("hex");
	const inventory = JSON.parse(inventorySource);
	const pins = inventory.evidence.flatMap(evidence => evidence.files)
		.filter(file => file.path === path);
	assert.equal(pins.length, 4);
	assert.ok(pins.every(file => file.sha256 === currentSha256));
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
