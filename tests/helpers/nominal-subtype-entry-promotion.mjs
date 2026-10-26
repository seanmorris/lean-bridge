/**
 * Promote retained nominal Subtype entry measurements as test-only evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkNominalSubtypeEntryHostedEvidence, nominalSubtypeEntryHostedLanes
} from "./nominal-subtype-entry-hosted-evidence.mjs";

export const nominalSubtypeEntryPromotionPath
	= "docs/evidence/nominal-subtype-entry-promotion-20261026.md";
export const nominalSubtypeEntryPromotionRoots = Object.freeze({
	native: "docs/evidence/nominal-subtype-entry-native-hosted-20261024"
	, browser: "docs/evidence/nominal-subtype-entry-browser-hosted-20261024"
});
export const nominalSubtypeEntryDocumentationPaths = Object.freeze({
	javascript: "docs/javascript-typescript.md"
	, author: "docs/lean/existing-package.md"
	, c: "docs/consume/c.md"
	, cpp: "docs/consume/cpp.md"
});

const validators = Object.freeze([
	"scripts/archive-nominal-subtype-entry-evidence.mjs"
	, "scripts/promote-nominal-subtype-entry-evidence.mjs"
	, "tests/nominal-subtype-entry-hosted-evidence.test.mjs"
	, "tests/helpers/nominal-subtype-entry-hosted-evidence.mjs"
	, "tests/helpers/nominal-subtype-entry-hosted-summary.mjs"
	, "tests/helpers/nominal-subtype-entry-promotion.mjs"
	, "tests/helpers/type-surface-promotion-io.mjs"
	, "tests/helpers/promotion-file-transaction.mjs"
]);

const profiles = Object.freeze({
	native: Object.freeze(["c", "cpp"])
	, browser: Object.freeze(["node-javascript", "node-typescript"
		, "browser-javascript", "browser-react", "browser-worker"])
});
const evidenceId = lane => `nominal-subtype-entry-${lane}-hosted-instrumented`;

const evidenceEntry = reference => Object.fromEntries(Object.entries(
	reference
).filter(([key]) => [
	"id", "kind", "revision", "command", "scope", "files", "artifacts"
].includes(key)));

const manifestMap = index => {
	const map = new Map();
	for(const file of index.files)
	{
		assert.ok(typeof file.path === "string" && file.path.length > 0);
		assert.ok(!map.has(file.path), `Duplicate archive file: ${file.path}`);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		map.set(file.path, file);
	}
	return map;
};

/**
 * Bind the compact inventory reference to the complete replayed archive.
 *
 * @param index - Canonical retained archive index.
 * @param root - Exact immutable evidence root.
 * @param indexBytes - Original canonical index bytes.
 */
export const nominalSubtypeEntryPromotionArchiveReferences = (
	index, root, indexBytes
) => {
	assert.equal(root, nominalSubtypeEntryPromotionRoots[index.lane]);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	const manifest = manifestMap(index);
	const bind = (path, record) => {
		const file = manifest.get(path);
		assert.ok(file, `Missing archive manifest binding: ${path}`);
		assert.equal(file.sha256, record.sha256, path);
		assert.equal(file.bytes, record.bytes, path);
		return { path: `${root}/${path}`, sha256: file.sha256 };
	};
	const files = [{ path: `${root}/index.json`, sha256: sha256(indexBytes) }];
	for(const name of ["artifact", "job", "run"])
		files.push(bind(`hosted/api/${name}.json`
			, index.hostedRun.apiRecords[name]));
	let offset = 0;
	const artifacts = index.hostedRun.artifact.parts.map((part, number) => {
		assert.equal(part.path
			, `hosted/artifact.zip.parts/${String(number).padStart(4, "0")}.part`);
		assert.equal(part.offset, offset);
		offset += part.bytes;
		return bind(part.path, part);
	});
	assert.equal(offset, index.hostedRun.artifact.bytes);
	return { files: [...files, ...artifacts], artifacts };
};

const validateReference = reference => {
	assert.ok(nominalSubtypeEntryHostedLanes.includes(reference.lane));
	assert.equal(reference.id, evidenceId(reference.lane));
	assert.equal(reference.kind, "test");
	assert.deepEqual(reference.profiles, profiles[reference.lane]);
	assert.match(reference.revision, /^[a-f0-9]{40}$/u);
	assert.ok(reference.files.length > 0 && reference.artifacts.length > 0);
};

/**
 * Replay both archives serially and construct their exact inventory entries.
 *
 * @param check - Complete archive replay function.
 * @param read - Exact byte reader.
 */
export const nominalSubtypeEntryPromotionReferences = async (
	check = checkNominalSubtypeEntryHostedEvidence, read = readFile
) => {
	const references = [];
	for(const lane of nominalSubtypeEntryHostedLanes)
	{
		const root = nominalSubtypeEntryPromotionRoots[lane];
		const index = await check(lane, root);
		assert.equal(index.lane, lane);
		assert.deepEqual(index.profiles, profiles[lane]);
		assert.deepEqual(
			index.summary.selections.map(item => [item.route, item.mode])
			, [
				["ordinary", "full"], ["ordinary", "result-only"]
				, ["reviewed", "full"], ["reviewed", "result-only"]
			]
		);
		const compact = nominalSubtypeEntryPromotionArchiveReferences(
			index, root, await read(`${root}/index.json`));
		const files = [
			...compact.files
			, ...await Promise.all(validators.map(async path => ({
				path, sha256: sha256(await read(path))
			})))
		];
		assert.equal(new Set(files.map(file => file.path)).size, files.length);
		const common = `GitHub Actions run ${index.hostedRun.runId}, job ${index.hostedRun.job.id}, artifact ${index.hostedRun.artifact.id} retains ordinary-source and reviewed-IR full and result-only instrumented packages. `;
		const boundary = "This is test-only entry evidence for separate instrumented packages; it does not change any installed support state or imply counters in an unmodified release. External toolchains and runtimes remain trusted recorded inputs.";
		const scope = lane === "native"
			? common + "The full C package measures public entry, validator, selected plusOne/plusTwo constructor, adapter and Lean source across valid, invalid, inactive-branch, late-failure and recovery cases on Linux x64/glibc 2.39 against the declared 2.38 floor. Both C++ package modes execute, but C++ entry counters are explicitly unmeasured; result-only packages are explicitly classified as having no constructor/source measurement. " + boundary
			: common + "The full package measures public JavaScript entry, selected validator and plusOne/plusTwo constructor, direct component adapter and Lean source in Node, strict TypeScript, Chromium, Firefox and WebKit pages, React effects and workers, including valid, invalid, inactive-branch, late-failure and recovery cases. Result-only packages retain explicit entry nonmeasurement. " + boundary;
		const reference = {
			lane, profiles: [...profiles[lane]], id: evidenceId(lane)
			, kind: "test", revision: index.producerCommit
			, command: `node --test --test-name-pattern='^retained ${lane} nominal Subtype entry evidence replays$' tests/nominal-subtype-entry-hosted-evidence.test.mjs`
			, scope, files, artifacts: compact.artifacts
		};
		validateReference(reference); references.push(reference);
	}
	return references;
};

/**
 * Append test evidence while preserving every support observation exactly.
 *
 * @param original - Current semantic inventory projection.
 * @param references - Replayed native and browser references.
 */
export const promoteNominalSubtypeEntryEvidence = (original, references) => {
	assert.deepEqual(references.map(reference => reference.lane)
		, nominalSubtypeEntryHostedLanes);
	for(const reference of references) validateReference(reference);
	const promoted = structuredClone(original);
	const observations = structuredClone(promoted.observations);
	for(const reference of references)
	{
		assert.ok(!promoted.evidence.some(item => item.id === reference.id)
			, `Already promoted: ${reference.id}`);
		promoted.evidence.push(evidenceEntry(reference));
	}
	assert.deepEqual(promoted.observations, observations
		, "Entry measurements cannot widen support observations");
	return promoted;
};

const replaceOnce = (source, marker, replacement, name) => {
	assert.equal(source.split(marker).length, 2, `${name} marker must occur once`);
	return source.replace(marker, `${marker}\n\n${replacement}`);
};

const documentation = Object.freeze({
	javascript: {
		marker: "These local runs do not measure dispatch counts or establish hosted release-floor\nacceptance. Refined callback signatures remain separate work. Owned Subtypes have\nthe narrower installed boundary described next."
		, text: `The separate [hosted constructor/source-entry measurement](evidence/nominal-subtype-entry-promotion-20261026.md) replays instrumented ordinary-source and reviewed-IR full and result-only packages. Full packages record public JavaScript entry, the selected validator and constructor, the direct component adapter and Lean source in Node, strict TypeScript, pages, React and workers across Chromium, Firefox and WebKit. Result-only packages record explicit entry nonmeasurement. These test probes do not add counters to unmodified releases or change their installed support.`
	}
	, c: {
		marker: "These earlier checks cover top-level parameters and results; see the [installed checks](../evidence/native-subtype-20261007.md)."
		, text: `The separate [hosted nominal entry measurement](../evidence/nominal-subtype-entry-promotion-20261026.md) executes ordinary-source and reviewed-IR full and result-only C and C++ packages after source-free offline installation and relocation on Linux x64/glibc 2.39, above the declared 2.38 floor. Full C probes distinguish public entry, validator, the selected \`plusOne\` or \`plusTwo\` constructor, adapter and Lean source; invalid and inactive paths stop at their proper boundary, late failures preserve the earlier entries, and later valid calls recover. C++ executes the same consumers without claiming entry counters. Result-only packages explicitly record no constructor or source measurement. These instrumented probes do not change the unmodified installed-package support claim.`
	}
	, cpp: {
		marker: "These structural runs do not measure dispatch counts or establish hosted\nrelease-floor acceptance."
		, text: `A separate [hosted nominal entry measurement](../evidence/nominal-subtype-entry-promotion-20261026.md) runs the ordinary-source and reviewed-IR full and result-only C++ consumers after source-free offline installation and relocation on Linux x64/glibc 2.39. The same artifact measures C full-package public, validator, selected-constructor, adapter and Lean-source entries, but C++ is explicitly classified as executed without entry counters. Result-only packages record no constructor or source measurement. These test-only instrumented packages do not change the unmodified C++ support claim.`
	}
	, author: {
		marker: "[Nominal PHP-Wasm acceptance](../evidence/nominal-subtype-php-wasm-promotion-20261014.md) adds both source routes and API modes on wasm32 PHP 8.4.1 in Node 22.23.2 and Chromium 151.0.7922.34. All twelve contexts per selection pass after offline installation and relocation; the archive retains all three reproduced packages. Native and shared component source checks also pass. Directional callback Subtypes have separate acceptance and do not follow from scalar or container checks."
		, text: `The separate [hosted nominal constructor/source-entry measurement](../evidence/nominal-subtype-entry-promotion-20261026.md) retains ordinary-source and reviewed-IR full and result-only instrumented packages. Native execution covers C and C++ after relocation at the glibc 2.38 release floor: full C records public, validator, selected-constructor, adapter and Lean-source entries, while C++ is explicitly executed without counters. Browser execution covers Node, strict TypeScript and twelve Chromium, Firefox and WebKit page, React and worker contexts per route and mode; full packages record entry observations and result-only packages record explicit nonmeasurement. These test probes leave all unmodified support observations unchanged.`
	}
});

/**
 * Render the four hand-written documentation additions fail-closed.
 *
 * @param sources - Current documentation sources by logical name.
 */
export const renderNominalSubtypeEntryDocumentation = sources =>
	Object.fromEntries(Object.entries(documentation).map(([name, value]) => [
		name, replaceOnce(sources[name], value.marker, value.text, name)
	]));

/**
 * Render the human-readable evidence boundary from the replayed references.
 *
 * @param references - Replayed native and browser references.
 */
export const renderNominalSubtypeEntryPromotion = references => {
	assert.equal(references.length, 2);
	for(const reference of references) validateReference(reference);
	const native = references.find(item => item.lane === "native");
	const browser = references.find(item => item.lane === "browser");
	return `# Nominal Subtype constructor and source-entry measurement\n\n`
		+ `These retained GitHub-hosted runs measure separate instrumented packages. They do not add instrumentation to release packages and do not change any support cell.\n\n`
		+ `| Lane | Original run | Measured execution | Boundary |\n| --- | --- | --- | --- |\n`
		+ `| Native | Run ${native.scope.match(/run (\d+)/u)[1]}, producer \`${native.revision}\` | Ordinary and reviewed full C: 4 executions, 4,149 C checks and 4,122 C++ checks per route. Result-only: 4 executions and 2,042 checks per consumer per route. Linux x64/glibc 2.39, declared floor 2.38. | C full packages count public, validator, selected constructor, adapter and Lean-source entry. C++ executes without entry counters. Result-only records explicit nonmeasurement. |\n`
		+ `| Browser | Run ${browser.scope.match(/run (\d+)/u)[1]}, producer \`${browser.revision}\` | Per route and mode: 2 Node and 12 browser executions across Chromium, Firefox and WebKit, with 51 lifecycle observations. Full: 3,172 checks and 1,032 expected rejections. Result-only: 2,078 checks. | Full packages record public JavaScript, validator, selected constructor, direct adapter and Lean-source entry. Result-only records explicit nonmeasurement. |\n\n`
		+ `Both lanes cover ordinary-source and independently reviewed packages, valid and normalizing constructors, invalid-only paths, inactive branches, late failures and recovery. The archives retain the original GitHub API responses and artifact ZIP bytes plus the exact producer, checker and archiver source closure; the Core test reconstructs and independently replays every selection.\n\n`
		+ `External compilers, runtimes, package managers, browsers and operating-system distributions remain trusted recorded inputs.\n`;
};
