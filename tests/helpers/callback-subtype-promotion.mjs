/**
 * Bind the eight hosted callback Subtype archives to exactly the
 * copied callback cells they execute. PHP-Wasm and every other position stay
 * outside this promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkCallbackSubtypeHostedEvidence
} from "./callback-subtype-hosted-evidence.mjs";

export const callbackSubtypePromotionLanes = Object.freeze([
	{ lane: "browser"
		, profiles: ["node-javascript"
			, "node-typescript"
			, "browser-javascript", "browser-react", "browser-worker"] }
	, { lane: "native", profiles: ["c", "cpp"] }
	, { lane: "languages", profiles: ["python", "ruby", "rust"] }
	, { lane: "perl", profiles: ["perl"] }
	, { lane: "dotnet", profiles: ["dotnet"] }
	, { lane: "jvm", profiles: ["java", "kotlin"] }
	, { lane: "php-native", profiles: ["php-native"] }
	, { lane: "wit-wasi", profiles: ["wit-wasi"] }
].map(value => Object.freeze({
	...value, profiles: Object.freeze(value.profiles)
})));

export const callbackSubtypePromotionLimit
	= "Hosted callback Subtype acceptance covers the fixture's selected Nat Subtypes, admitted copied containers, synchronous host callback replies and inputs to returned Lean closures. Retained or asynchronous callbacks, checked-record callback positions, owned Subtypes, arbitrary predicates, recursive or generic refined payloads, dispatch cost, peak memory and PHP-Wasm remain separate work. External runtimes, compilers, package managers and operating-system distributions remain trusted recorded inputs.";

export const callbackSubtypePromotionPath
	= "docs/evidence/callback-subtype-promotion-20261022.md";

const routes = Object.freeze(["ordinary", "reviewed"]);
const positions = Object.freeze(["callback-parameter", "callback-result"]);
const archiveRoot = lane =>
	`docs/evidence/callback-subtype-${lane}-20261022`;
const evidenceId = lane =>
	`callback-subtype-${lane}-hosted-installed`;
const validators = Object.freeze([
	"scripts/promote-callback-subtype-evidence.mjs"
	, "tests/callback-subtype-hosted-evidence.test.mjs"
	, "tests/callback-subtype-promotion.test.mjs"
	, "tests/helpers/callback-subtype-hosted-archive.mjs"
	, "tests/helpers/callback-subtype-hosted-evidence-sources.mjs"
	, "tests/helpers/callback-subtype-hosted-evidence.mjs"
	, "tests/helpers/callback-subtype-promotion.mjs"
]);

/**
 * Replay all eight immutable archives and derive exact type-surface evidence.
 *
 * @param check - Archive replay function, injectable only for focused tests.
 */
export const callbackSubtypePromotionReferences = async (
	check = checkCallbackSubtypeHostedEvidence
) => Promise.all(callbackSubtypePromotionLanes.map(async definition => {
	const root = archiveRoot(definition.lane);
	const index = await check(definition.lane, root);
	assert.equal(index.lane, definition.lane);
	assert.deepEqual(index.profiles, definition.profiles);
	assert.deepEqual(index.accepted.routes, routes);
	assert.equal(index.producerCommit, index.accepted.producerCommit);
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
		lane: definition.lane, profiles: [...definition.profiles]
		, routes: [...routes], id: evidenceId(definition.lane)
		, kind: "installed", revision: index.producerCommit
		, command: `node --test --test-name-pattern='^retained ${definition.lane} callback Subtype evidence replays$' tests/callback-subtype-hosted-evidence.test.mjs`
		, scope: `GitHub Actions run ${index.hostedRun.runId}, job ${index.hostedRun.job.id}, artifact ${index.hostedRun.artifact.id} executes ordinary Lean source and independently reviewed Binding IR through installed ${definition.profiles.join(", ")} packages. The immutable archive retains and independently replays the original artifact, API records, output and exact source closures. ${index.limitations.join(" ")}`
		, files, artifacts
	};
}));

const appendUnique = (values, additions) => {
	const next = [...values, ...additions];
	assert.equal(new Set(next).size, next.length);
	return next;
};

const hostedStageNote = references =>
	`Hosted Ubuntu 24.04 archives independently replay ${references.map(
		reference => reference.profiles.join(", ")).join("; ")} ordinary and reviewed installed packages at the recorded release floor.`;

const existingGroups = Object.freeze([
	{
		prefix: "callback-subtype-native"
		, profiles: ["c", "cpp"], lanes: ["native"]
	}
	, {
		prefix: "callback-subtype-perl"
		, profiles: ["perl"], lanes: ["perl"]
	}
	, {
		prefix: "callback-subtype-languages"
		, profiles: ["python", "ruby", "rust"], lanes: ["languages"]
	}
	, {
		prefix: "callback-subtype-remaining"
		, profiles: ["dotnet", "java", "kotlin", "php-native", "wit-wasi"]
		, lanes: ["dotnet", "jvm", "php-native", "wit-wasi"]
	}
]);

const newGroups = Object.freeze([
	{
		prefix: "callback-subtype-browser"
		, profiles: ["node-javascript", "node-typescript"
			, "browser-javascript", "browser-react", "browser-worker"]
		, lanes: ["browser"]
		, scope: "Installed npm packages carry proof-erased selected Subtype values through synchronous host callbacks and returned Lean closures. Node executes the JavaScript runtime for JavaScript and TypeScript consumers; strict TypeScript checks the generated declarations, and Chromium, Firefox and WebKit execute page, React and dedicated-worker consumers."
		, parameter: "base values validated by the selected constructor when passed to returned Lean closures"
		, result: "base values returned by host callbacks through withRecovery(callback, recovery) and validated by Lean"
		, conversion: "JavaScript and TypeScript pass the Subtype's base value without a proof field. Host callbacks returning a selected Subtype require withRecovery(callback, value); recovery is validated before callback entry and is never successful output. Returned Lean closures apply the selected constructor before their body."
	}
]);

const referencesFor = (references, lanes) => lanes.map(lane => {
	const selected = references.filter(reference => reference.lane === lane);
	assert.equal(selected.length, 1, `Expected one ${lane} reference`);
	return selected[0];
});

const evidenceEntry = reference => Object.fromEntries(Object.entries(
	reference
).filter(([key]) => [
	"id", "kind", "revision", "command", "scope", "files", "artifacts"
].includes(key)));

/**
 * Render the human-readable boundary shared by the exact support inventory and
 * all eight independently replayed archives.
 *
 * @param references - Eight authenticated hosted lane references.
 */
export const renderCallbackSubtypePromotion = references => {
	assert.deepEqual(references.map(reference => reference.lane)
		, callbackSubtypePromotionLanes.map(item => item.lane));
	const rows = references.map((reference, index) => {
		const expected = callbackSubtypePromotionLanes[index];
		assert.deepEqual(reference.profiles, expected.profiles);
		assert.deepEqual(reference.routes, routes);
		assert.match(reference.revision, /^[a-f0-9]{40}$/u);
		return `| ${reference.lane} | ${reference.profiles.join(", ")} | ${reference.routes.join(", ")} | [archive index](callback-subtype-${reference.lane}-20261022/index.json) | \`${reference.revision}\` |`;
	});
	return `# Synchronous callback Subtypes

Eight immutable hosted archives establish proof-erased selected Subtypes across synchronous host callbacks and returned Lean closures in sixteen consumer profiles. Ordinary Lean source and independently reviewed Binding IR use the same selected constructors.

| Evidence lane | Consumer profiles | Author routes | Retained evidence | Producer revision |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

The support inventory promotes exactly 64 cells: sixteen profiles, two author routes and two callback positions. A selected Subtype produced by Lean reaches a host callback or a returned closure result as its proof-erased base value. A base value produced by the host is validated at a callback reply or returned closure input. Host replies require one exact typed recovery value; it is validated before callback entry, used only for Lean's failure path and never returned as successful output.

The fixture covers selected positive-\`Nat\` Subtypes, mixed refined and unrefined arguments, and the admitted option, result and array containers. Rejection preserves caller values and the first error, suppresses later callbacks in the same call and leaves the synchronous callable usable for a later valid invocation.

This promotion does not cover PHP-Wasm, retained or asynchronous callbacks, checked-record callback positions, owned Subtypes, arbitrary predicates, recursive or generic refined payloads, dispatch cost or peak memory. External runtimes, compilers, package managers and operating-system distributions remain trusted recorded inputs.
`;
};

/**
 * Promote exactly sixty-four non-PHP-Wasm copied callback Subtype cells.
 *
 * @param original - Type surface before callback Subtype promotion.
 * @param references - Eight independently authenticated hosted selections.
 */
export const promoteCallbackSubtypes = (original, references) => {
	assert.deepEqual(references.map(reference => reference.lane)
		, callbackSubtypePromotionLanes.map(item => item.lane));
	for(const [index, definition] of callbackSubtypePromotionLanes.entries())
	{
		const reference = references[index];
		assert.equal(reference.id, evidenceId(definition.lane));
		assert.deepEqual(reference.profiles, definition.profiles);
		assert.deepEqual(reference.routes, routes);
		assert.equal(reference.kind, "installed");
		assert.ok(reference.artifacts.length > 0);
	}
	const inventory = structuredClone(original);
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, `Already promoted: ${reference.id}`);
		inventory.evidence.push(evidenceEntry(reference));
	}

	for(const group of existingGroups)
	{
		const selected = referencesFor(references, group.lanes);
		const ids = selected.map(reference => reference.id);
		for(const route of routes)
		{
			const observation = inventory.observations.find(item =>
				item.id === `${group.prefix}-${route}`);
			assert.ok(observation, `${group.prefix}-${route}`);
			assert.deepEqual(observation.profiles, group.profiles);
			assert.deepEqual(observation.shapes, ["subtype"]);
			assert.deepEqual(observation.positions, positions);
			assert.equal(observation.path, route === "ordinary"
				? "ordinary-source" : "reviewed-ir");
			observation.scope += ` ${hostedStageNote(selected)}`;
			for(const stage of Object.values(observation.stages))
			{
				assert.ok(["passed", "inspected"].includes(stage.state));
				stage.state = "passed";
				stage.evidence = appendUnique(stage.evidence, ids);
				stage.note += ` ${hostedStageNote(selected)}`;
			}
			observation.limitations = observation.limitations.filter(note =>
				!(/^(?:Compilation, packaging and installed execution remain inspected|The local reports are retained)/u.test(note)));
			observation.limitations.push(callbackSubtypePromotionLimit);
		}
	}

	for(const group of newGroups)
	{
		const selected = referencesFor(references, group.lanes);
		const ids = selected.map(reference => reference.id);
		for(const route of routes)
		{
			const path = route === "ordinary" ? "ordinary-source" : "reviewed-ir";
			const notes = hostedStageNote(selected);
			const stage = subject => ({
				state: "passed", evidence: ids
				, note: `${subject} ${notes}`
			});
			inventory.observations.push({
				id: `${group.prefix}-${route}`
				, profiles: group.profiles, shapes: ["subtype"]
				, positions: [...positions], path
				, scope: `${group.scope} ${notes}`
				, hostTypes: { "subtype": {
					"callback-parameter": group.parameter
					, "callback-result": group.result
				} }
				, conversionNotes: { "subtype": group.conversion }
				, stages: {
					analysis: stage(`Fresh Lean analysis and the ${path} selection preserve every selected constructor in both callback directions.`)
					, generation: stage("Generated proof-free callback types preserve direction and exact typed recovery.")
					, compilation: stage("The selected package compiles the Lean callback mirror and host adapter at the recorded release floor.")
					, packaging: stage("Two author routes produce source-free packages that install offline before unchanged caller replay.")
					, installedExecution: stage("Independent consumers exercise valid values, exact rejection, unchanged caller values and recovery through public package APIs.")
				}
				, limitations: [callbackSubtypePromotionLimit]
			});
		}
	}
	return inventory;
};
