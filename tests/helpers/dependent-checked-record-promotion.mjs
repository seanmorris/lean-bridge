/**
 * Bind the eleven hosted dependent checked-record archives to exactly the
 * copied top-level parameter and result cells they execute. Fields,
 * callbacks, owned positions and every other shape stay outside this
 * promotion, and no lane is inferred from another host or from compiler-only
 * tests.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { dependentCheckedRecordRoutes } from "./dependent-checked-record-browser-fixture.mjs";

export const dependentCheckedRecordPromotionLanes = Object.freeze([
	{ lane: "browser", name: "Browser"
		, profiles: ["node-javascript", "node-typescript"
			, "browser-javascript", "browser-react", "browser-worker"] }
	, { lane: "native", name: "Native", profiles: ["c", "cpp"] }
	, { lane: "dotnet", name: "Dotnet", profiles: ["dotnet"] }
	, { lane: "jvm", name: "Jvm", profiles: ["java", "kotlin"] }
	, { lane: "php", name: "Php", profiles: ["php-native"] }
	, { lane: "php-wasm", name: "PhpWasm", profiles: ["php-wasm"] }
	, { lane: "python", name: "Python", profiles: ["python"] }
	, { lane: "ruby", name: "Ruby", profiles: ["ruby"] }
	, { lane: "rust", name: "Rust", profiles: ["rust"] }
	, { lane: "perl", name: "Perl", profiles: ["perl"] }
	, { lane: "wit", name: "Wit", profiles: ["wit-wasi"] }
].map(value => Object.freeze({
	...value, profiles: Object.freeze(value.profiles)
})));

export const dependentCheckedRecordPromotionRoutes = dependentCheckedRecordRoutes;
export const dependentCheckedRecordPromotionProfiles = Object.freeze(
	dependentCheckedRecordPromotionLanes.flatMap(item => item.profiles));
export const dependentCheckedRecordPromotionPaths = Object.freeze([
	"ordinary-source", "reviewed-ir"
]);
export const dependentCheckedRecordPromotionPositions = Object.freeze([
	"parameter", "result"
]);
export const dependentCheckedRecordPromotionPath
	= "docs/evidence/dependent-checked-record-promotion.md";
export const dependentCheckedRecordPromotionPinBaseline
	= "44486151261f342e06f0a57290c5ac261921a621";

export const dependentCheckedRecordPromotionLimit
	= "Hosted dependent checked-record acceptance covers only the retained top-level copied DependentRecords.Dependent parameter and result sites, whose Fin bound field depends on the runtime bound field and whose proof is rebuilt by the selected mkDependent constructor. Full packages cover parameters and results; standalone result-only packages cover results only. Dependent fields of other kinds, nested or recursive dependent records, checked-record fields, callbacks, owned positions, open or opaque indices and zero-payload records remain unreviewed here. The PHP-Wasm cells are the shared result tracked by #1461 and are not inferred from native PHP. External runtimes, compilers, package managers and operating-system distributions remain trusted recorded inputs.";

export const dependentCheckedRecordPromotionConversion
	= "The proof-free host value carries bound and below as payload fields. Full packages validate each host input through the selected DependentRecords.mkDependent constructor, which rejects below >= bound before Lean code runs, preserve rejected caller values and return the exact proof-free result. Standalone result-only packages expose Lean-produced results without checked-input metadata.";

/**
 * Reconcile only the current-source paths selected by the promotion driver.
 * Immutable archive paths are not inferred or rewritten here.
 *
 * @param original - Promoted type-surface inventory.
 * @param currentDigests - Current SHA-256 by changed repository path.
 */
export const reconcileDependentCheckedRecordSourcePins = (
	original, currentDigests
) => {
	assert.ok(currentDigests instanceof Map && currentDigests.size > 0);
	const inventory = structuredClone(original);
	let refreshed = 0;
	for(const evidence of inventory.evidence)
		for(const file of evidence.files)
		{
			const digest = currentDigests.get(file.path);
			if(digest === undefined) continue;
			assert.match(digest, /^[a-f0-9]{64}$/u, file.path);
			if(file.sha256 !== digest)
			{
				file.sha256 = digest;
				refreshed++;
			}
		}
	return { inventory, refreshed };
};

const evidenceRoot = lane => `docs/evidence/dependent-checked-record-${lane}-20261021`;
const verifierPath = lane => `tests/helpers/dependent-checked-record-${lane}-evidence.mjs`;
const verifierUrl = path => new URL(`../../${path}`, import.meta.url).href;
const sourcePath = route => route.replace(/^result-only-/u, "");
const resultOnly = route => route.startsWith("result-only-");
const referenceId = (lane, route) =>
	`dependent-checked-record-${lane}-${route}-hosted-installed`;
const commitPattern = /^[a-f0-9]{40}$/u, digestPattern = /^[a-f0-9]{64}$/u;
const referenceKeys = Object.freeze([
	"archiverRevision", "artifact", "artifacts", "checkerRevision", "command"
	, "consumerRevision", "files", "hostedRun", "id", "job", "lane", "mode"
	, "positions", "profiles", "revision", "route", "scope", "sourcePath"
]);

/**
 * Load every lane's archive verifier and refuse while any is missing. A
 * missing verifier means its archive has not been captured, so no reference
 * for that lane may exist.
 *
 * @param load - Module loader, injectable only for focused tests.
 */
export const loadDependentCheckedRecordVerifiers = async (
	load = path => import(`../../${path}`)
) => {
	const verifiers = [], missing = [];
	for(const definition of dependentCheckedRecordPromotionLanes)
	{
		const path = verifierPath(definition.lane);
		let module;
		try
		{ module = await load(path); }
		catch(error)
		{
			if(error?.code !== "ERR_MODULE_NOT_FOUND"
				|| error.url !== verifierUrl(path))
				throw error;
			missing.push(definition.lane);
			continue;
		}
		const check = module[`checkDependentCheckedRecord${definition.name}Evidence`];
		const evidence = module[`dependentCheckedRecord${definition.name}Evidence`];
		const indexSha256 = module[`dependentCheckedRecord${definition.name}EvidenceSha256`];
		assert.equal(typeof check, "function", `${path} exports no archive verifier`);
		assert.equal(evidence, evidenceRoot(definition.lane), path);
		assert.match(indexSha256, digestPattern, path);
		verifiers.push({ lane: definition.lane, check, evidence, indexSha256 });
	}
	if(missing.length)
		throw new Error(`Dependent checked-record promotion refuses: no archive verifier for ${missing.join(", ")}`);
	return verifiers;
};

/**
 * Refuse missing, reordered, duplicated or forged route references.
 *
 * @param references - Hosted route records to authenticate.
 */
export const assertDependentCheckedRecordPromotionReferences = references => {
	assert.ok(Array.isArray(references));
	assert.equal(references.length, dependentCheckedRecordPromotionLanes.length
		* dependentCheckedRecordPromotionRoutes.length);
	const runs = new Map(), artifactDigests = new Set(), laneArtifacts = new Map();
	let index = 0;
	for(const definition of dependentCheckedRecordPromotionLanes)
		for(const route of dependentCheckedRecordPromotionRoutes)
		{
			const reference = references[index++];
			assert.deepEqual(Object.keys(reference).sort(), referenceKeys);
			assert.equal(reference.id, referenceId(definition.lane, route));
			assert.equal(reference.lane, definition.lane);
			assert.equal(reference.route, route);
			assert.equal(reference.sourcePath, sourcePath(route));
			assert.equal(reference.mode, resultOnly(route) ? "result-only" : "full");
			assert.deepEqual(reference.profiles, definition.profiles);
			assert.deepEqual(reference.positions, resultOnly(route)
				? ["result"] : ["parameter", "result"]);
			for(const key of ["revision", "consumerRevision", "checkerRevision"
				, "archiverRevision"])
				assert.match(reference[key], commitPattern, `${reference.id} ${key}`);
			for(const key of ["hostedRun", "job", "artifact"])
				assert.ok(Number.isSafeInteger(reference[key]) && reference[key] > 0
					, `${reference.id} ${key}`);
			// One lane, one archive: every route shares it and no other lane may.
			const run = `${reference.hostedRun}/${reference.job}/${reference.artifact}/${reference.revision}`;
			assert.equal(runs.get(definition.lane) ?? run, run, reference.id);
			if(!runs.has(definition.lane))
			{
				assert.ok(![...runs.values()].some(value =>
					value.split("/")[0] === String(reference.hostedRun))
				, `${reference.id} reuses another lane's hosted run`);
				runs.set(definition.lane, run);
			}
			const root = evidenceRoot(definition.lane);
			assert.ok(reference.files.length > 1, reference.id);
			assert.equal(reference.files[0].path, `${root}/index.json`);
			assert.equal(new Set(reference.files.map(file => file.path)).size
				, reference.files.length, reference.id);
			for(const file of reference.files)
			{
				assert.deepEqual(Object.keys(file).sort(), ["path", "sha256"]);
				assert.ok(file.path.startsWith(`${root}/`), file.path);
				assert.match(file.sha256, digestPattern, file.path);
			}
			for(const file of reference.files.slice(1))
				assert.ok([
					`${root}/${route}/`, `${root}/sources/`, `${root}/hosted/`
				].some(prefix => file.path.startsWith(prefix))
				, `${reference.id} includes an unrelated file: ${file.path}`);
			assert.ok(reference.files.some(file =>
				file.path.startsWith(`${root}/${route}/`)), `${reference.id} has no route records`);
			assert.ok(reference.artifacts.length > 0, reference.id);
			const fileDigests = new Map(reference.files.map(file => [file.path, file.sha256]));
			for(const artifact of reference.artifacts)
			{
				assert.deepEqual(Object.keys(artifact).sort(), ["path", "sha256"]);
				assert.ok(artifact.path.startsWith(`${root}/hosted/`)
					, `${reference.id} artifact is not a hosted part: ${artifact.path}`);
				assert.match(artifact.sha256, digestPattern, artifact.path);
				assert.equal(fileDigests.get(artifact.path), artifact.sha256
					, `${reference.id} artifact is absent from its authenticated files`);
			}
			const exactArtifacts = JSON.stringify(reference.artifacts);
			if(route === dependentCheckedRecordPromotionRoutes[0])
			{
				// No single part may recur in another lane, whatever its order
				// or company.
				for(const artifact of reference.artifacts)
					assert.ok(!artifactDigests.has(artifact.sha256)
						, `${reference.id} reuses another lane's artifact part`);
				for(const artifact of reference.artifacts)
					artifactDigests.add(artifact.sha256);
				laneArtifacts.set(definition.lane, exactArtifacts);
			}
			else assert.equal(exactArtifacts, laneArtifacts.get(definition.lane)
				, `${reference.id} changes its lane artifact`);
			assert.equal(reference.command
				, `node --input-type=module -e "await (await import('./${verifierPath(definition.lane)}')).checkDependentCheckedRecord${definition.name}Evidence()"`);
			assert.ok(reference.scope.endsWith(dependentCheckedRecordPromotionLimit)
				, reference.id);
		}
	assert.equal(new Set(references.map(item => item.id)).size, references.length);
	return references;
};

/**
 * Replay every immutable archive and derive one reference per lane route.
 *
 * @param verifiers - Loaded lane verifiers; all eleven must exist.
 * @param read - Repository-relative byte reader for archive indices.
 */
export const dependentCheckedRecordPromotionReferences = async (
	verifiers, read = readFile
) => {
	assert.deepEqual(verifiers.map(item => item.lane)
		, dependentCheckedRecordPromotionLanes.map(item => item.lane));
	const references = [];
	for(const [position, definition] of dependentCheckedRecordPromotionLanes.entries())
	{
		const verifier = verifiers[position];
		const checked = await verifier.check();
		assert.equal(checked.hostedAcceptance, true, definition.lane);
		assert.equal(checked.supportPromoted, false, definition.lane);
		const indexBytes = Buffer.from(await read(`${verifier.evidence}/index.json`));
		assert.equal(sha256(indexBytes), verifier.indexSha256, definition.lane);
		const index = JSON.parse(indexBytes);
		assert.equal(checked.producer, index.producerCommit, definition.lane);
		assert.equal(checked.consumer, index.consumerCommit, definition.lane);
		assert.equal(checked.checker, index.checkerCommit, definition.lane);
		assert.equal(checked.archiver, index.archiveCommit, definition.lane);
		assert.deepEqual(checked.files, index.files, definition.lane);
		assert.deepEqual(checked.hostedRun, index.hostedRun, definition.lane);
		assert.deepEqual(index.runs.map(run => run.route)
			, dependentCheckedRecordPromotionRoutes, definition.lane);
		const artifacts = index.hostedRun.artifact.parts.map(part => ({
			path: `${verifier.evidence}/${part.path}`, sha256: part.sha256
		}));
		for(const route of dependentCheckedRecordPromotionRoutes)
		{
			const mode = resultOnly(route) ? "result-only" : "full";
			const selected = index.files.filter(file =>
				file.path.startsWith(`${route}/`)
				|| file.path.startsWith("sources/")
				|| file.path.startsWith("hosted/"));
			references.push({
				id: referenceId(definition.lane, route)
				, lane: definition.lane, route, mode, sourcePath: sourcePath(route)
				, profiles: [...definition.profiles]
				, positions: resultOnly(route) ? ["result"] : ["parameter", "result"]
				, revision: checked.producer, consumerRevision: checked.consumer
				, checkerRevision: checked.checker, archiverRevision: checked.archiver
				, hostedRun: index.hostedRun.runId, job: index.hostedRun.job.id
				, artifact: index.hostedRun.artifact.id
				, command: `node --input-type=module -e "await (await import('./${verifierPath(definition.lane)}')).checkDependentCheckedRecord${definition.name}Evidence()"`
				, scope: `Hosted GitHub Actions run ${index.hostedRun.runId}, job ${index.hostedRun.job.id}, artifact ${index.hostedRun.artifact.id} rebuilt the ${mode} ${sourcePath(route)} ${definition.profiles.join("/")} package selection. The author routes reproduce the package, remove author sources, install without network access and replay unchanged typed callers. ${resultOnly(route) ? "The standalone result-only API exposes Lean-produced proof-free dependent results without checked-input metadata." : "The full API exercises valid and rejected dependent inputs through the selected constructor, unchanged rejected values, recovery and proof-free results."} The retained archive authenticates every original artifact byte, route result, package, caller observation and selected source. ${dependentCheckedRecordPromotionLimit}`
				, files: [
					{ path: `${verifier.evidence}/index.json`, sha256: verifier.indexSha256 }
					, ...selected.map(file => ({
						path: `${verifier.evidence}/${file.path}`, sha256: file.sha256
					}))
				]
				, artifacts
			});
		}
	}
	return assertDependentCheckedRecordPromotionReferences(references);
};

/**
 * Render the human-readable boundary shared by the support inventory and all
 * eleven independently replayed archives.
 *
 * @param references - Forty-four authenticated hosted route references.
 */
export const renderDependentCheckedRecordPromotion = references => {
	assertDependentCheckedRecordPromotionReferences(references);
	const rows = dependentCheckedRecordPromotionLanes.map(definition => {
		const reference = references.find(item => item.lane === definition.lane);
		return `| ${definition.lane} | ${definition.profiles.join(", ")} | ${dependentCheckedRecordPromotionRoutes.join(", ")} | [archive index](dependent-checked-record-${definition.lane}-20261021/index.json) | ${reference.hostedRun} | \`${reference.revision}\` |`;
	});
	return `# Dependent checked records

Eleven immutable hosted archives establish proof-free dependent checked records at copied top-level parameters and results in seventeen consumer profiles. Ordinary Lean source and independently reviewed Binding IR use the same selected constructor, each as a full package and as a standalone result-only package.

| Evidence lane | Consumer profiles | Author routes | Retained evidence | Hosted run | Producer revision |
| --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

The support inventory gains evidence for exactly 68 cells: seventeen profiles, two author paths and two positions. Each parameter cell cites its full route; each result cell cites its full and result-only routes. \`DependentRecords.Dependent\` carries \`bound\` and \`below : Fin bound\` as proof-free host fields. A host input is rebuilt only through \`DependentRecords.mkDependent\`, which rejects \`below >= bound\` before Lean code runs; rejected caller values are preserved and the next valid call succeeds.

PHP-Wasm is the shared result tracked by #1461 and is not inferred from native PHP. This promotion does not cover other dependent field kinds, nested or recursive dependent records, checked-record fields, callbacks, owned positions, open or opaque indices or zero-payload records. External runtimes, compilers, package managers and operating-system distributions remain trusted recorded inputs.
`;
};

/**
 * Add hosted dependent evidence to exactly sixty-eight existing cells.
 *
 * @param original - Type surface before dependent checked-record promotion.
 * @param references - Forty-four independently authenticated route references.
 */
export const promoteDependentCheckedRecords = (original, references) => {
	assertDependentCheckedRecordPromotionReferences(references);
	const inventory = structuredClone(original);
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, `Already promoted: ${reference.id}`);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: reference.files, artifacts: reference.artifacts
		});
	}
	for(const profile of dependentCheckedRecordPromotionProfiles)
		for(const path of dependentCheckedRecordPromotionPaths)
			for(const position of dependentCheckedRecordPromotionPositions)
			{
				const matches = references.filter(reference =>
					reference.profiles.includes(profile)
					&& reference.sourcePath === path
					&& reference.positions.includes(position));
				assert.equal(matches.length, position === "result" ? 2 : 1
					, `${profile}/${path}/${position}`);
				const observations = inventory.observations.filter(item =>
					item.profiles.includes(profile)
					&& item.shapes.includes("checked-record")
					&& item.path === path && item.positions.includes(position));
				assert.equal(observations.length, 1
					, `Missing or overlapping dependent cell: ${profile}/${path}/${position}`);
				const observation = observations[0];
				assert.deepEqual([observation.profiles, observation.shapes
					, observation.positions], [[profile], ["checked-record"], [position]]
				, `Dependent cell is not exact: ${observation.id}`);
				const ids = matches.map(item => item.id);
				const scope = matches.map(item => item.scope).join(" ");
				observation.scope += ` Additional hosted dependent acceptance: ${scope}`;
				observation.conversionNotes["checked-record"] += ` ${dependentCheckedRecordPromotionConversion}`;
				observation.limitations.push(dependentCheckedRecordPromotionLimit);
				for(const stage of Object.values(observation.stages))
				{
					assert.equal(stage.state, "passed", observation.id);
					stage.evidence.push(...ids);
					assert.equal(new Set(stage.evidence).size, stage.evidence.length
						, observation.id);
					stage.note += ` Additional hosted dependent acceptance: ${scope}`;
				}
			}
	return inventory;
};
