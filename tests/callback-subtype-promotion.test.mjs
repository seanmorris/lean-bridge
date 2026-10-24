/**
 * Keep callback Subtype promotion exact before all hosted lanes settle.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	typeSurfaceCells, validateTypeSurface
} from "../src/adoption/type-surface.mjs";
import {
	renderTypeDocuments, replaceTypeSection
} from "../scripts/generate-type-docs.mjs";
import {
	callbackSubtypePromotionLanes
	, callbackSubtypePromotionLimit
	, promoteCallbackSubtypes
	, renderCallbackSubtypePromotion
} from "./helpers/callback-subtype-promotion.mjs";
import {
	renderCallbackSubtypeLeanAuthorDocs
} from "./helpers/callback-subtype-documentation.mjs";
import {
	callbackSubtypePromotionHistoryPath
} from "./helpers/callback-subtype-promotion-source-history.mjs";
import {
	sourceAtFinHistoryMilestone
} from "./helpers/source-at-fin-history-milestone.mjs";

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const promotionPredecessor = "5b9ca827d621b2bcf8e67c73f85b8d9c8a84b5f0";
const baselineArgs = ["show"
	, `${promotionPredecessor}:docs/type-surface.v1.json`];
const baseline = execFileSync(
	"git", baselineArgs, { encoding: "utf8", maxBuffer: 512 * 1024 ** 2 }
);
const predecessorSource = path => execFileSync("git", ["show"
	, `${promotionPredecessor}:${path}`], { encoding: "utf8"
	, maxBuffer: 512 * 1024 ** 2 });
const document = JSON.parse(baseline);
const [irSchema, consumers] = await Promise.all([
	readJson("schema/binding-ir.schema.json")
	, readJson("docs/consumer-support.v1.json")
]);
const contracts = { irSchema, consumers };
const digest = "0".repeat(64), revision = "0".repeat(40);
const references = callbackSubtypePromotionLanes.map(item => ({
	lane: item.lane, profiles: [...item.profiles]
	, routes: ["ordinary", "reviewed"]
	, id: `callback-subtype-${item.lane}-hosted-installed`
	, kind: "installed", revision
	, command: `Replay ${item.lane} archive.`
	, scope: `Test-only ${item.lane} hosted scope.`
	, files: [{ path: `test/${item.lane}.json`, sha256: digest }]
	, artifacts: [{ path: `test/${item.lane}.zip`, sha256: digest }]
}));
const targetProfiles = callbackSubtypePromotionLanes
	.flatMap(item => item.profiles);
const target = new Set(targetProfiles.flatMap(profile =>
	["ordinary-source", "reviewed-ir"].flatMap(path =>
		["callback-parameter", "callback-result"].map(position =>
			`${profile}/subtype/${path}/${position}`))));

test("callback Subtype promotion closes exactly 64 non-PHP-Wasm cells", () => {
	const promoted = promoteCallbackSubtypes(document, references);
	assert.equal(validateTypeSurface(promoted, contracts), true);
	assert.equal(target.size, 64);
	const before = new Map(typeSurfaceCells(document, contracts).map(cell =>
		[cell.id, cell]));
	let changed = 0;
	for(const cell of typeSurfaceCells(promoted, contracts))
	{
		const original = before.get(cell.id);
		if(target.has(cell.id))
		{
			for(const stage of Object.values(cell.stages))
			{
				assert.equal(stage.state, "passed", cell.id);
				assert.doesNotMatch(stage.note
					, /pending|not claimed|no complete/iu, cell.id);
			}
			assert.ok(cell.hostType && cell.conversionNote, cell.id);
			assert.ok(cell.limitations.includes(
				callbackSubtypePromotionLimit), cell.id);
			changed++;
		}
		else assert.deepEqual(cell, original, cell.id);
	}
	assert.equal(changed, 64);
	for(const path of ["ordinary-source", "reviewed-ir"])
		for(const position of ["callback-parameter", "callback-result"])
			assert.deepEqual(
				before.get(`php-wasm/subtype/${path}/${position}`)
				, typeSurfaceCells(promoted, contracts).find(cell =>
					cell.id === `php-wasm/subtype/${path}/${position}`)
			);
});

test("callback Subtype promotion binds exact lanes and refuses repetition", () => {
	const promoted = promoteCallbackSubtypes(document, references);
	assert.deepEqual(promoted.evidence.slice(-8).map(item => item.id)
		, references.map(item => item.id));
	assert.deepEqual(promoted.observations.slice(-2).map(item => item.id), [
		"callback-subtype-browser-ordinary"
		, "callback-subtype-browser-reviewed"
	]);
	assert.throws(() => promoteCallbackSubtypes(promoted, references)
		, /Already promoted/u);
	assert.throws(() => promoteCallbackSubtypes(document
		, references.slice(1)), assert.AssertionError);
	const wrong = structuredClone(references);
	wrong[0].profiles = ["php-wasm"];
	assert.throws(() => promoteCallbackSubtypes(document, wrong)
		, assert.AssertionError);
});

test("callback Subtype promotion renders the exact hosted boundary", () => {
	const summary = renderCallbackSubtypePromotion(references);
	assert.match(summary, /exactly 64 cells/u);
	assert.match(summary
		, /sixteen profiles, two author routes and two callback positions/u);
	for(const reference of references)
	{
		assert.match(summary, new RegExp(
			`callback-subtype-${reference.lane}-20261022/index\\.json`, "u"
		));
		assert.match(summary, new RegExp(reference.revision, "u"));
	}
	assert.match(summary, /does not cover PHP-Wasm/u);
	assert.match(summary, /retained or asynchronous callbacks/u);
	assert.match(summary, /owned Subtypes/u);
	assert.match(summary, /stops callback entry/u);
	assert.doesNotMatch(summary, /suppresses later callbacks/u);
});

test("callback Subtype promotion documents every affected consumer", async () => {
	const before = await renderTypeDocuments({
		root: ".", inventory: { document, ...contracts }
	});
	const promoted = promoteCallbackSubtypes(document, references);
	const after = await renderTypeDocuments({
		root: ".", inventory: { document: promoted, ...contracts }
	});
	const current = await renderTypeDocuments({
		root: "."
		, inventory: {
			document: await readJson("docs/type-surface.v1.json"), ...contracts
		}
	});
	const evidence = /callback-subtype-promotion-20261022\.md/u;
	for(const [path, source] of Object.entries(after.documents))
	{
		assert.doesNotMatch(before.documents[path], evidence, path);
		assert.match(source, evidence, path);
		assert.match(source, /exact typed recovery wrapper/u, path);
		assert.match(source, /prevents callback entry/u, path);
		assert.match(source, /later valid call/u, path);
		assert.match(current.documents[path], evidence, path);
		assert.equal(await readFile(path, "utf8"), current.documents[path], path);
	}
	assert.doesNotMatch(before.reference, evidence);
	assert.match(after.reference, evidence);
	assert.match(after.reference, /sixteen non-PHP-Wasm consumer profiles/u);
	const referenceSource = await readFile("docs/reference/types.md", "utf8");
	const referenceStart = referenceSource.indexOf("## Full type surface\n\n")
		+ "## Full type surface\n\n".length;
	const referenceEnd = referenceSource.indexOf("\n## Generated host types"
		, referenceStart);
	assert.ok(referenceStart >= 0 && referenceEnd > referenceStart);
	assert.equal(referenceSource.slice(referenceStart, referenceEnd).trimEnd()
		, current.reference.trimEnd());
	for(const source of [before.reference, after.reference])
	{
		assert.match(source, /28 ordinary\/reviewed routes in 26 retained artifacts/u);
		assert.match(source, /do\s+not widen any type-support cell/u);
		assert.match(source, /is not a hosted result/u);
	}
});

test("callback Subtype promotion repairs stale Lean-author and consumer boundaries", async () => {
	const paths = {
		existingPackage: "docs/lean/existing-package.md"
		, exportDecisions: "docs/lean/export-decisions.md"
		, dotnet: "docs/consume/dotnet.md"
		, java: "docs/consume/java.md"
		, witWasi: "docs/consume/wit-wasi.md"
	};
	const rendered = renderCallbackSubtypeLeanAuthorDocs({
		...Object.fromEntries(Object.entries(paths).map(([name, path]) =>
			[name, predecessorSource(path)]))
	});
	const history = await readJson(callbackSubtypePromotionHistoryPath);
	const promotionSource = async path => {
		const update = history.integrationUpdates.find(item => item.path === path);
		assert.ok(update, path);
		return sourceAtFinHistoryMilestone(path, update.currentSha256);
	};
	for(const name of ["existingPackage", "exportDecisions"])
		assert.equal(await promotionSource(paths[name]), rendered[name]
			, paths[name]);
	const omitTypeSection = source => replaceTypeSection(source
		, "### Type conversions\n<!-- generated section omitted -->");
	for(const name of ["dotnet", "java", "witWasi"])
		assert.equal(omitTypeSection(await promotionSource(paths[name]))
			, omitTypeSection(rendered[name]), paths[name]);
	for(const source of [rendered.existingPackage, rendered.exportDecisions])
	{
		assert.match(source, /callback-subtype-promotion-20261022\.md/u);
		assert.match(source, /all sixteen non-PHP-Wasm/u);
		assert.match(source, /Missing or invalid recovery prevents callback entry/u);
		assert.match(source, /later valid call succeeds/u);
		assert.match(source, /callback-subtype-php-wasm-local-qualification/u);
	}
	assert.doesNotMatch(rendered.existingPackage
		, /\.NET, JVM, native PHP and WIT\/WASI remain separate work/u);
	assert.match(rendered.existingPackage
		, /Directional `Subtype` inside callback signatures \| Node, TypeScript, Chromium, Firefox, WebKit, React and workers installed/u);
	assert.match(rendered.existingPackage, /for `Fin` and selected `Subtype`/u);
	assert.match(rendered.existingPackage, /with_recovery\(callback, value\)/u);
	assert.match(rendered.existingPackage, /Runtime::Callback/u);
	assert.match(rendered.existingPackage, /Nested callbacks/u);
	assert.match(rendered.existingPackage
		, /PHP-Wasm callback positions, retained or asynchronous callbacks and owned checked records remain separate/u);
	assert.match(rendered.exportDecisions
		, /The result expires with the selected input owner/u);
	for(const source of Object.values(rendered))
	{
		assert.doesNotMatch(source, /Installed refined-callback acceptance/u);
		assert.doesNotMatch(source, /Refined\ncallbacks, owned/u);
	}
	for(const source of [rendered.dotnet, rendered.java, rendered.witWasi])
		assert.match(source
			, /Synchronous `Fin` callbacks, retained or asynchronous refined callbacks/u);
	assert.match(rendered.exportDecisions
		, /Synchronous `Fin` callbacks outside C\/C\+\+/u);
	assert.throws(() => renderCallbackSubtypeLeanAuthorDocs({
		existingPackage: rendered.existingPackage
		, exportDecisions: rendered.exportDecisions
		, dotnet: rendered.dotnet, java: rendered.java
		, witWasi: rendered.witWasi
	}), /Expected one documentation (?:marker|statement)/u);
});
