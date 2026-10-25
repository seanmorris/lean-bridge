/**
 * Bind authenticated owned-Subtype package evidence to exactly the
 * non-PHP-Wasm checked-field cells that it executes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { verifyOwnedJavaScriptBrowserEvidence } from "./owned-javascript-package-evidence.mjs";
import {
	checkOwnedSubtypeHostedEvidence
} from "./owned-subtype-hosted-evidence.mjs";

export const ownedSubtypePromotionPredecessor
	= "da5bae8a9e48c3afb2f905c052cc3410f56faf86";
export const ownedSubtypePromotionPath
	= "docs/evidence/owned-subtype-promotion-20261023.md";

const routes = Object.freeze(["ordinary", "reviewed"]);
const paths = Object.freeze(["ordinary-source", "reviewed-ir"]);
const position = "field";
const javascriptEvidencePath
	= "docs/evidence/owned-subtype-javascript-transfer-acceptance-20261020.json";
const javascriptHistoryPath
	= "docs/evidence/owned-subtype-javascript-transfer-source-history-20261020.json";
const javascriptImplementation
	= "c95b9ca0bcfcc5138cc50072a868dc37942291b4";

export const ownedSubtypePromotionLanes = Object.freeze([
	{ lane: "javascript"
		, profiles: [
			"node-javascript", "node-typescript", "browser-javascript"
			, "browser-react", "browser-worker"
		]
	}
	, { lane: "native", profiles: ["c", "cpp"] }
	, { lane: "perl", profiles: ["perl"] }
	, { lane: "languages", profiles: ["python", "ruby", "rust"] }
	, { lane: "dotnet", profiles: ["dotnet"] }
	, { lane: "jvm", profiles: ["java", "kotlin"] }
	, { lane: "php-native", profiles: ["php-native"] }
	, { lane: "wit-wasi", profiles: ["wit-wasi"] }
].map(item => Object.freeze({
	...item, profiles: Object.freeze(item.profiles)
})));

export const ownedSubtypePromotionLimit
	= "Owned Subtype acceptance covers one selected Nat Subtype field in the tested acyclic Bundle, borrowed and transferred inputs, leased or retained results, rejection before ownership movement, exact cleanup and recovery through the named public package APIs. Recursive owned graphs, owned checked-record fields, owned callback positions, arbitrary predicates, dispatch cost and peak memory remain separate work. PHP-Wasm has separate owned-Subtype evidence and is not widened by this promotion. External runtimes, compilers, package managers and operating-system distributions remain trusted recorded inputs.";

const validators = Object.freeze([
	"scripts/promote-owned-subtype-evidence.mjs"
	, "tests/owned-subtype-hosted-ci.test.mjs"
	, "tests/owned-subtype-promotion.test.mjs"
	, "tests/owned-subtype-retained-packages.test.mjs"
	, "tests/helpers/owned-subtype-hosted-evidence.mjs"
	, "tests/helpers/owned-subtype-hosted-output.mjs"
	, "tests/helpers/owned-subtype-promotion.mjs"
]);

const hostedRoot = lane => `docs/evidence/owned-subtype-${lane}-hosted-20261023`;
const evidenceId = lane => `owned-subtype-${lane}-${lane === "javascript"
	? "local" : "hosted"}-installed`;
const artifactRecord = (route, artifact) => ({
	path: `owned-subtype-javascript/${route}/${artifact.path}`
	, sha256: artifact.sha256
});

/**
 * Recheck the authenticated relocated JavaScript package record used by the
 * five npm/browser profiles.
 */
export const ownedSubtypeJavaScriptPromotionReference = async () => {
	const [evidenceBytes, historyBytes] = await Promise.all([
		readFile(javascriptEvidencePath), readFile(javascriptHistoryPath)
	]);
	const evidence = JSON.parse(evidenceBytes);
	assert.deepEqual(Object.keys(evidence).toSorted()
		, ["command", "implementationCommit", "profile", "reports"
			, "schemaVersion"]);
	assert.equal(evidence.schemaVersion, 1);
	assert.equal(evidence.profile, "installed-owned-subtype-javascript-transfer");
	assert.equal(evidence.implementationCommit, javascriptImplementation);
	assert.equal(evidence.reports.length, 2);
	assert.deepEqual(evidence.reports.map(report => report.reviewed)
		, [false, true]);
	const artifacts = [];
	for(const report of evidence.reports)
	{
		for(const flag of ["archiveReproduction", "installedNode"
			, "installedTypeScript", "relocatedInstallation"
			, "sourceRemovedBeforeInstall"
			, "transferredInputCheckedBeforeHandoff"])
			assert.equal(report[flag], true, flag);
		assert.deepEqual(report.observed, {
			checks: 18, first: true, retainedRejected: true, second: true
			, serial: "41", transferRejected: true, transferred: true
		});
		// The historical report has nine development/StrictMode cells. It
		// cannot establish production coverage or retain missing package bytes.
		const assets = report.browser.executions[0]?.assets;
		assert.ok(Array.isArray(assets) && assets.includes(report.wasm.sha256));
		verifyOwnedJavaScriptBrowserEvidence(report.browser, {
			checks: 18, assets, version: 1
		});
		const route = report.reviewed ? "reviewed" : "ordinary";
		for(const pkg of report.packageSetReceipt.packages)
			for(const artifact of pkg.artifacts)
				artifacts.push(artifactRecord(route, artifact));
	}
	assert.equal(new Set(artifacts.map(file => file.path)).size
		, artifacts.length);
	return {
		lane: "javascript"
		, profiles: [...ownedSubtypePromotionLanes[0].profiles]
		, routes: [...routes], id: evidenceId("javascript")
		, kind: "installed", revision: javascriptImplementation
		, command: evidence.command
		, scope: "Two independently authored npm package sets execute after source removal and relocation through Node JavaScript, strict TypeScript, browser pages, React Strict Mode and dedicated workers. Chromium, Firefox and WebKit each replay page, React and worker consumers twice per route. The authenticated record binds valid borrowed, retained and transferred values, rejection before ownership movement, later recovery and explicit disposal to the exact package archive digests."
		, files: [
			{ path: javascriptEvidencePath, sha256: sha256(evidenceBytes) }
			, { path: javascriptHistoryPath, sha256: sha256(historyBytes) }
		]
		, artifacts
	};
};

const hostedPromotionReference = async lane => {
	const root = hostedRoot(lane);
	const index = await checkOwnedSubtypeHostedEvidence(lane, root);
	const definition = ownedSubtypePromotionLanes.find(item =>
		item.lane === lane);
	assert.ok(definition, lane);
	assert.deepEqual(index.profiles, definition.profiles);
	assert.deepEqual(index.accepted.accepted.routes, routes);
	assert.equal(index.accepted.producerCommit, index.producerCommit);
	const indexPath = `${root}/index.json`;
	const files = [
		{ path: indexPath, sha256: sha256(await readFile(indexPath)) }
		, ...index.files.map(file => ({
			path: `${root}/${file.path}`, sha256: file.sha256
		}))
		, ...await Promise.all(validators.map(async path => ({
			path, sha256: sha256(await readFile(path))
		})))
	];
	assert.equal(new Set(files.map(file => file.path)).size, files.length);
	const artifacts = index.hostedRun.artifact.parts.map(part => ({
		path: `${root}/${part.path}`, sha256: part.sha256
	}));
	assert.ok(artifacts.length > 0);
	return {
		lane, profiles: [...definition.profiles], routes: [...routes]
		, id: evidenceId(lane), kind: "installed"
		, revision: index.producerCommit
		, command: `node --test --test-name-pattern='^retained ${lane} owned Subtype evidence replays$' tests/owned-subtype-hosted-ci.test.mjs`
		, scope: `GitHub Actions run ${index.hostedRun.runId}, job ${index.hostedRun.job.id}, artifact ${index.hostedRun.artifact.id} executes ordinary Lean source and independently reviewed Binding IR through installed ${definition.profiles.join(", ")} packages. ${index.limitations.join(" ")}`
		, files, artifacts
	};
};

/** Replay every evidence lane and derive exact inventory references. */
export const ownedSubtypePromotionReferences = async () => Promise.all(
	ownedSubtypePromotionLanes.map(definition => definition.lane === "javascript"
		? ownedSubtypeJavaScriptPromotionReference()
		: hostedPromotionReference(definition.lane))
);

const groups = Object.freeze([
	{ prefix: "nominal-subtype-npm-fields"
		, profiles: ["node-javascript", "node-typescript"], lane: "javascript" }
	, { prefix: "nominal-subtype-browser-fields"
		, profiles: ["browser-javascript", "browser-react", "browser-worker"]
		, lane: "javascript" }
	, { prefix: "nominal-subtype-native-fields"
		, profiles: ["c", "cpp"], lane: "native" }
	, { prefix: "nominal-subtype-perl-fields"
		, profiles: ["perl"], lane: "perl" }
	, { prefix: "nominal-subtype-python-fields"
		, profiles: ["python"], lane: "languages" }
	, { prefix: "nominal-subtype-ruby-fields"
		, profiles: ["ruby"], lane: "languages" }
	, { prefix: "nominal-subtype-rust-fields"
		, profiles: ["rust"], lane: "languages" }
	, { prefix: "nominal-subtype-dotnet-fields"
		, profiles: ["dotnet"], lane: "dotnet" }
	, { prefix: "nominal-subtype-jvm-fields"
		, profiles: ["java", "kotlin"], lane: "jvm" }
	, { prefix: "nominal-subtype-php-fields"
		, profiles: ["php-native"], lane: "php-native" }
	, { prefix: "nominal-subtype-wit-fields"
		, profiles: ["wit-wasi"], lane: "wit-wasi" }
]);

const evidenceEntry = reference => Object.fromEntries(Object.entries(
	reference
).filter(([key]) => [
	"id", "kind", "revision", "command", "scope", "files", "artifacts"
].includes(key)));

const appendUnique = (values, addition) => {
	assert.ok(!values.includes(addition), `Already contains ${addition}`);
	return [...values, addition];
};

/**
 * Promote exactly thirty-two owned-Subtype field cells without widening any
 * callback, PHP-Wasm, recursive or checked-record claim.
 *
 * @param original - Type surface before owned-Subtype promotion.
 * @param references - Eight independently authenticated lane references.
 */
export const promoteOwnedSubtypes = (original, references) => {
	assert.deepEqual(references.map(reference => reference.lane)
		, ownedSubtypePromotionLanes.map(item => item.lane));
	for(const [index, definition] of ownedSubtypePromotionLanes.entries())
	{
		const reference = references[index];
		assert.equal(reference.id, evidenceId(definition.lane));
		assert.deepEqual(reference.profiles, definition.profiles);
		assert.deepEqual(reference.routes, routes);
		assert.equal(reference.kind, "installed");
		assert.match(reference.revision, /^[a-f0-9]{40}$/u);
		assert.ok(reference.files.length > 0 && reference.artifacts.length > 0);
	}
	const inventory = structuredClone(original);
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, `Already promoted: ${reference.id}`);
		inventory.evidence.push(evidenceEntry(reference));
	}
	for(const group of groups)
	{
		const reference = references.find(item => item.lane === group.lane);
		assert.ok(reference, group.lane);
		for(const path of paths)
		{
			const observation = inventory.observations.find(item =>
				item.id === `${group.prefix}-${path}`);
			assert.ok(observation, `${group.prefix}-${path}`);
			assert.deepEqual(observation.profiles, group.profiles);
			assert.deepEqual(observation.shapes, ["subtype"]);
			assert.deepEqual(observation.positions, [position]);
			assert.equal(observation.path, path);
			const note = `Authenticated ${group.lane} owned-Subtype evidence executes the tested acyclic owned Bundle through ${reference.profiles.join(", ")} on both author routes.`;
			observation.scope += ` ${note}`;
			observation.hostTypes.subtype.field += "; the tested acyclic owned Bundle preserves this checked field beside explicit resource identities";
			observation.conversionNotes.subtype += " In the tested acyclic owned Bundle, the selected constructor validates the checked field before a successful transferred-input handoff; rejection leaves ownership unchanged, and later valid calls recover.";
			for(const stage of Object.values(observation.stages))
			{
				assert.ok(["passed", "limited"].includes(stage.state));
				stage.state = "passed";
				stage.evidence = appendUnique(stage.evidence, reference.id);
				stage.note += ` ${note}`;
			}
			observation.limitations.push(ownedSubtypePromotionLimit);
		}
	}
	return inventory;
};

/**
 * Render the exact human-readable promotion boundary.
 *
 * @param references - Eight independently authenticated lane references.
 */
export const renderOwnedSubtypePromotion = references => {
	assert.deepEqual(references.map(reference => reference.lane)
		, ownedSubtypePromotionLanes.map(item => item.lane));
	const rows = references.map((reference, index) => {
		assert.deepEqual(reference.profiles
			, ownedSubtypePromotionLanes[index].profiles);
		assert.deepEqual(reference.routes, routes);
		const link = reference.lane === "javascript"
			? "owned-subtype-javascript-transfer-acceptance-20261020.json"
			: `owned-subtype-${reference.lane}-hosted-20261023/index.json`;
		return `| ${reference.lane} | ${reference.profiles.join(", ")} | ${reference.routes.join(", ")} | [evidence](${link}) | \`${reference.revision}\` |`;
	});
	return `# Checked fields inside owned resource values

Eight authenticated evidence lanes establish one selected proof-erased \`Nat\` Subtype field inside the tested acyclic owned Bundle across all sixteen non-PHP-Wasm consumer profiles. Ordinary Lean source and independently reviewed Binding IR retain the exact per-export constructor and ownership contract.

| Evidence lane | Consumer profiles | Author routes | Evidence | Producer revision |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

The support inventory refines exactly 32 existing cells: sixteen profiles, two author routes and the checked field position. Borrowed inputs preserve their owner, transferred inputs are validated before ownership movement, invalid values leave ownership unchanged, leased or retained outputs keep explicit identities, and every lane proves cleanup plus recovery through installed public package APIs.

This promotion does not widen PHP-Wasm, which has separate owned-Subtype evidence. It does not cover recursive owned graphs, owned checked-record fields, owned callback positions, arbitrary predicates, dispatch cost or peak memory. External runtimes, compilers, package managers and operating-system distributions remain trusted recorded inputs.
`;
};
