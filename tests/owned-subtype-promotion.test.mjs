/**
 * Prove that owned-Subtype promotion changes only its exact matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
	typeSurfaceCells, validateTypeSurface
} from "../src/adoption/type-surface.mjs";
import {
	renderTypeDocuments, typeGuideProfiles
} from "../scripts/generate-type-docs.mjs";
import {
	ownedSubtypeJavaScriptPromotionReference
	, ownedSubtypePromotionLanes, ownedSubtypePromotionLimit
	, ownedSubtypePromotionReferences
	, promoteOwnedSubtypes, renderOwnedSubtypePromotion
} from "./helpers/owned-subtype-promotion.mjs";
import {
	ownedSubtypeDocumentationPaths, renderOwnedSubtypeDocumentation
} from "./helpers/owned-subtype-documentation.mjs";
import {
	ownedSubtypePromotionArchiveRoot, ownedSubtypePromotionEvidenceId
} from "./helpers/owned-subtype-promotion-catalog.mjs";

import { readPromotionInventory } from "./helpers/type-surface-promotion-io.mjs";
import { gitSourceBytes } from "./helpers/source-history-stream.mjs";

// Freeze only the pre-promotion inputs. Every test invokes the current renderer,
// transformation and validator, including after the published guides change.
const baselineCommit = "9e571b4214df98e1b8d0319f24fe7b6729ab34ba";
const baselinePaths = new Set(["schema/binding-ir.schema.json"
	, "docs/consumer-support.v1.json", ...Object.keys(typeGuideProfiles)
	, ...Object.values(ownedSubtypeDocumentationPaths)]);
const baselineText = path => {
	assert.ok(baselinePaths.has(path), path);
	return execFileSync("git", ["show", `${baselineCommit}:${path}`]
		, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
};
const irSchema = JSON.parse(baselineText("schema/binding-ir.schema.json"));
const consumers = JSON.parse(baselineText("docs/consumer-support.v1.json"));
const contracts = { irSchema, consumers };
const original = await readPromotionInventory(
	gitSourceBytes(baselineCommit, "docs/type-surface.v1.json"), contracts);
assert.deepEqual(original.source, { bytes: 102579190
	, sha256: "a1c0e7d484f135d38f18aab9a8ea9b7c2e6c1b4313440379c90713c76fc1c7f8" });
const document = original.document;
const digest = "0".repeat(64), revision = "0".repeat(40);
const references = ownedSubtypePromotionLanes.map(item => ({
	lane: item.lane, profiles: [...item.profiles]
	, routes: ["ordinary", "reviewed"]
	, id: ownedSubtypePromotionEvidenceId(item.lane)
	, kind: "installed", revision
	, command: `Replay ${item.lane} owned Subtype evidence.`
	, scope: `Test-only ${item.lane} evidence scope.`
	, files: [{ path: `test/${item.lane}.json`, sha256: digest }]
	, artifacts: [{ path: `test/${item.lane}.zip`, sha256: digest }]
}));
const targetProfiles = ownedSubtypePromotionLanes.flatMap(item =>
	item.profiles);
const target = new Set(targetProfiles.flatMap(profile =>
	["ordinary-source", "reviewed-ir"].map(path =>
		`${profile}/subtype/${path}/field`)));

test("owned Subtype promotion closes exactly 32 non-PHP-Wasm cells", () => {
	const promoted = promoteOwnedSubtypes(document, references);
	assert.equal(validateTypeSurface(promoted, contracts), true);
	assert.equal(target.size, 32);
	assert.notEqual(promoted, document);
	assert.notEqual(promoted.evidence, document.evidence);
	assert.notEqual(promoted.observations, document.observations);
	for(const [index, evidence] of document.evidence.entries())
		assert.equal(promoted.evidence[index], evidence);
	const before = new Map(typeSurfaceCells(document, contracts).map(cell =>
		[cell.id, cell]));
	let changed = 0;
	for(const cell of typeSurfaceCells(promoted, contracts))
	{
		const original = before.get(cell.id);
		if(target.has(cell.id))
		{
			assert.notDeepEqual(cell, original, cell.id);
			for(const stage of Object.values(cell.stages))
			{
				assert.equal(stage.state, "passed", cell.id);
				assert.ok(stage.evidence.some(id =>
					id.startsWith("owned-subtype-")), cell.id);
			}
			assert.match(cell.hostType, /tested acyclic owned Bundle/u);
			assert.match(cell.conversionNote
				, /before a successful transferred-input handoff/u);
			assert.ok(cell.limitations.includes(ownedSubtypePromotionLimit));
			changed++;
		}
		else assert.deepEqual(cell, original, cell.id);
	}
	assert.equal(changed, 32);
	for(const path of ["ordinary-source", "reviewed-ir"])
		assert.deepEqual(
			before.get(`php-wasm/subtype/${path}/field`)
			, typeSurfaceCells(promoted, contracts).find(cell =>
				cell.id === `php-wasm/subtype/${path}/field`)
		);
});

test("owned Subtype promotion binds exact lanes and refuses repetition", () => {
	const promoted = promoteOwnedSubtypes(document, references);
	assert.deepEqual(promoted.evidence.slice(-8).map(item => item.id)
		, references.map(item => item.id));
	assert.throws(() => promoteOwnedSubtypes(promoted, references)
		, /Already promoted/u);
	assert.throws(() => promoteOwnedSubtypes(document, references.slice(1))
		, assert.AssertionError);
	const wrong = structuredClone(references);
	wrong[0].profiles = ["php-wasm"];
	assert.throws(() => promoteOwnedSubtypes(document, wrong)
		, assert.AssertionError);
	const historical = structuredClone(references);
	historical[0].id = "owned-subtype-javascript-local-installed";
	assert.throws(() => promoteOwnedSubtypes(document, historical)
		, assert.AssertionError);
});

test("owned Subtype promotion renders the exact boundary", () => {
	const summary = renderOwnedSubtypePromotion(references);
	assert.match(summary, /exactly 32 existing cells/u);
	assert.match(summary, /all sixteen non-PHP-Wasm consumer profiles/u);
	assert.match(summary, /validated before ownership movement/u);
	assert.match(summary, /does not widen PHP-Wasm/u);
	assert.match(summary, /owned checked-record fields/u);
	for(const reference of references)
		assert.match(summary, new RegExp(reference.revision, "u"));
});

test("owned Subtype promotion documents every affected consumer", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-subtype-doc-baseline-"));
	t.after(() => rm(root, { recursive: true }));
	for(const path of Object.keys(typeGuideProfiles))
	{
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), baselineText(path), { flag: "wx" });
	}
	const before = await renderTypeDocuments({
		root, inventory: { document, ...contracts }
	});
	const promoted = promoteOwnedSubtypes(document, references);
	const after = await renderTypeDocuments({
		root, inventory: { document: promoted, ...contracts }
	});
	const evidence = /owned-subtype-promotion-20261023\.md/u;
	for(const [path, source] of Object.entries(after.documents))
	{
		assert.doesNotMatch(before.documents[path], evidence, path);
		assert.match(source, evidence, path);
		assert.match(source, /validates host input before a successful ownership transfer/u
			, path);
		assert.match(source, /rejection leaves ownership with the caller/u, path);
		assert.match(source, /explicit close or release performs cleanup/u, path);
		assert.match(source, /PHP-Wasm keeps its separately audited/u, path);
	}
	assert.doesNotMatch(before.reference, evidence);
	assert.match(after.reference, evidence);
	assert.match(after.reference, /all sixteen non-PHP-Wasm consumer profiles/u);
	assert.match(after.reference, /PHP-Wasm retains its separately audited/u);
});

test("owned Subtype promotion removes exact stale manual boundaries", () => {
	const sources = Object.fromEntries(Object.entries(
		ownedSubtypeDocumentationPaths
	).map(([name, path]) => [name, baselineText(path)]));
	const rendered = renderOwnedSubtypeDocumentation(sources);
	for(const source of Object.values(rendered))
	{
		assert.match(source, /owned-subtype-promotion-20261023\.md/u);
		assert.match(source, /tested acyclic/u);
	}
	assert.match(rendered.existingPackage
		, /establishes ordinary\/reviewed packages across all seventeen profiles/u);
	assert.doesNotMatch(rendered.existingPackage
		, /JavaScript npm and PHP-Wasm installed[^|\n]+other hosts pending/u);
	assert.doesNotMatch(rendered.exportDecisions
		, /owned and recursive Subtypes/u);
	for(const name of ["dotnet", "perl", "python", "ruby"])
	{
		assert.match(rendered[name], /rejection keeps ownership with the caller/u
			, name);
		assert.match(rendered[name], /Owned checked-record fields have \[separate acceptance\]/u, name);
		assert.doesNotMatch(rendered[name], /owned checked-record fields remain unsupported/u, name);
		assert.doesNotMatch(rendered[name]
			, /owned (?:`Subtype` payloads|Subtypes) remain (?:pending|unsupported)/u
			, name);
	}
	assert.throws(() => renderOwnedSubtypeDocumentation(rendered)
		, /Expected one owned-Subtype documentation marker/u);
});

test("historical JavaScript owned Subtype qualification rechecks both relocated routes"
	, async () => {
		const reference = await ownedSubtypeJavaScriptPromotionReference();
		assert.deepEqual(reference.profiles
			, ownedSubtypePromotionLanes[0].profiles);
		assert.deepEqual(reference.routes, ["ordinary", "reviewed"]);
		assert.equal(reference.artifacts.length, 4);
		assert.equal(new Set(reference.artifacts.map(file => file.path)).size, 4);
	}
);

const hostedAvailable = ownedSubtypePromotionLanes.every(item =>
	existsSync(`${ownedSubtypePromotionArchiveRoot(item.lane)}/index.json`));
test("all retained owned Subtype lanes independently replay for promotion"
	, { skip: !hostedAvailable }, async () => {
		const actual = await ownedSubtypePromotionReferences();
		assert.deepEqual(actual.map(reference => reference.lane)
			, ownedSubtypePromotionLanes.map(item => item.lane));
	}
);
