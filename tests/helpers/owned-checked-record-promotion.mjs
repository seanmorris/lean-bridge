/**
 * Promote only the owned checked-record shapes exercised by the complete,
 * independently replayed hosted matrix. Projection is not archive acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	ownedCheckedRecordHostedLaneNames, ownedCheckedRecordHostedRoutes
} from "./owned-checked-record-hosted-contracts.mjs";
import {
	assertOwnedCheckedRecordMatrixIndexes, ownedCheckedRecordArchiveRootLane
	, verifyOwnedCheckedRecordHostedMatrix
} from "./owned-checked-record-hosted-matrix.mjs";

export const ownedCheckedRecordPromotionSelectionPath
	= "docs/evidence/owned-checked-record-matrix-selection-20261025.json";
export const ownedCheckedRecordPromotionPath
	= "docs/evidence/owned-checked-record-promotion-20261025.md";
export const ownedCheckedRecordPromotionProfiles = Object.freeze({
	native: Object.freeze(["c", "cpp"])
	, perl: Object.freeze(["perl"])
	, python: Object.freeze(["python"])
	, ruby: Object.freeze(["ruby"])
	, rust: Object.freeze(["rust"])
	, dotnet: Object.freeze(["dotnet"])
	, jvm: Object.freeze(["java", "kotlin"])
	, php: Object.freeze(["php-native"])
	, wit: Object.freeze(["wit-wasi"])
	, javascript: Object.freeze(["node-javascript", "node-typescript"
		, "browser-javascript", "browser-react", "browser-worker"])
	, "php-wasm": Object.freeze(["php-wasm"])
});
assert.deepEqual(Object.keys(ownedCheckedRecordPromotionProfiles), ownedCheckedRecordHostedLaneNames);
const paths = Object.freeze(["ordinary-source", "reviewed-ir"]);
const positions = Object.freeze(["parameter", "result", "field", "callback-parameter", "callback-result"]);
const stages = Object.freeze(["analysis", "generation", "compilation", "packaging", "installedExecution"]);
const evidenceId = lane => `owned-checked-record-${lane}-hosted-installed`;
const command = `node scripts/check-owned-checked-record-matrix.mjs --selection ${ownedCheckedRecordPromotionSelectionPath}`;
const validators = Object.freeze([
	"scripts/check-owned-checked-record-matrix.mjs"
	, "scripts/promote-owned-checked-record-evidence.mjs"
	, "scripts/refresh-owned-checked-record-evidence.mjs"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/owned-checked-record-hosted-contracts.mjs"
	, "tests/helpers/owned-checked-record-hosted-evidence.mjs"
	, "tests/helpers/owned-checked-record-hosted-output.mjs"
	, "tests/helpers/owned-checked-record-hosted-matrix.mjs"
	, "tests/helpers/owned-checked-record-promotion.mjs"
	, "tests/helpers/owned-checked-record-promotion-tests.mjs"
	, "tests/helpers/owned-checked-record-documentation.mjs"
	, "tests/helpers/type-surface-promotion-io.mjs"
	, "tests/helpers/promotion-file-transaction.mjs"
]);
export const ownedCheckedRecordPromotionLimit
	= "Owned checked-record acceptance covers the tested acyclic Booking with its copied checked Window, and Claim with its Ticket resource and checked quota. Full packages cover borrowed and transferred inputs, leased results, synchronous host callbacks and returned Lean closures. Standalone result-only packages expose Lean-produced Claim results without checked-input, transfer or callback metadata. This does not establish Grant or its nested Subtype, arbitrary owned containers, recursive owned graphs, retained or asynchronous callbacks, other predicates, dispatch cost or peak memory. PHP-Wasm and native PHP require their own distinct archives. External runtimes, compilers, package managers and operating-system distributions remain trusted recorded inputs.";

const closedPath = path => {
	assert.equal(typeof path, "string");
	assert.ok(path.length > 0 && !/[\\\0\r\n]/u.test(path));
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
};

/**
 * Bind a compact reference to the original index, API records and every ZIP
 * part. The full matrix verifier separately authenticates and replays all files.
 *
 * @param index - Fully replayed index, not an acceptance shortcut.
 * @param root - Selected immutable archive root.
 * @param bytes - Selected original canonical index bytes.
 */
export const ownedCheckedRecordPromotionArchiveReferences = (index, root, bytes) => {
	assert.ok(ownedCheckedRecordHostedLaneNames.includes(index.lane));
	assert.equal(ownedCheckedRecordArchiveRootLane(root), index.lane
		, "Archive root must match the selected lane");
	assert.ok(Buffer.isBuffer(bytes));
	assert.equal(bytes.toString(), canonicalJson(index), "Index changed after replay");
	const manifest = new Map();
	for(const file of index.files)
	{
		closedPath(file.path);
		assert.notEqual(file.path, "index.json");
		assert.ok(!manifest.has(file.path), `Duplicate archive file: ${file.path}`);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		manifest.set(file.path, file);
	}
	const bind = (path, record) => {
		const file = manifest.get(path);
		assert.ok(file, `Missing archive manifest binding: ${path}`);
		assert.equal(record.sha256, file.sha256, path);
		assert.equal(record.bytes, file.bytes, path);
		return { path: `${root}/${path}`, sha256: file.sha256 };
	};
	const { apiRecords, artifact } = index.hostedRun;
	assert.deepEqual(Object.keys(apiRecords).sort(), ["artifact", "job", "run"]);
	const files = [{ path: `${root}/index.json`, sha256: sha256(bytes) }
		, ...["artifact", "job", "run"].map(name =>
			bind(`hosted/api/${name}.json`, apiRecords[name]))];
	assert.ok(Array.isArray(artifact.parts) && artifact.parts.length > 0);
	let offset = 0;
	const artifacts = artifact.parts.map((part, number) => {
		assert.equal(part.path, `hosted/artifact.zip.parts/${String(number).padStart(4, "0")}.part`);
		assert.equal(part.offset, offset);
		assert.ok(Number.isSafeInteger(part.bytes) && part.bytes > 0);
		offset += part.bytes;
		assert.ok(Number.isSafeInteger(offset));
		return bind(part.path, part);
	});
	assert.equal(offset, artifact.bytes);
	return { files: [...files, ...artifacts], artifacts };
};

const assertReferences = references => {
	assert.deepEqual(references.map(reference => reference.lane), ownedCheckedRecordHostedLaneNames);
	for(const reference of references)
	{
		assert.deepEqual(Object.keys(reference).sort(), [
			"artifacts", "command", "files", "id"
			, "kind", "lane", "profiles", "revision", "routes", "scope"]);
		assert.equal(reference.id, evidenceId(reference.lane));
		assert.equal(reference.kind, "installed");
		assert.deepEqual(reference.profiles, ownedCheckedRecordPromotionProfiles[reference.lane]);
		assert.deepEqual(reference.routes, ownedCheckedRecordHostedRoutes);
		assert.match(reference.revision, /^[a-f0-9]{40}$/u);
		assert.equal(reference.command, command);
		assert.equal(typeof reference.scope, "string");
		assert.ok(reference.scope.length > 0);
		assert.ok(reference.files.length > 0 && reference.artifacts.length > 0);
		for(const collection of [reference.files, reference.artifacts])
		{
			assert.equal(new Set(collection.map(file => file.path)).size, collection.length);
			for(const file of collection)
			{
				assert.deepEqual(Object.keys(file).sort(), ["path", "sha256"]);
				closedPath(file.path);
				assert.match(file.sha256, /^[a-f0-9]{64}$/u);
			}
		}
		const indexPath = reference.files[0].path;
		assert.ok(indexPath.endsWith("/index.json"), "Select the original capture index.json");
		assert.equal(ownedCheckedRecordArchiveRootLane(indexPath.slice(0, -"/index.json".length))
			, reference.lane, "Archive root must match the selected lane");
		for(const artifact of reference.artifacts)
		{
			assert.ok(artifact.path.startsWith(dirname(reference.files[0].path) + "/hosted/artifact.zip.parts/"));
			assert.ok(reference.files.some(file => file.path === artifact.path && file.sha256 === artifact.sha256));
		}
	}
	assert.equal(new Set(references.filter(reference => !["javascript", "php-wasm"].includes(reference.lane))
		.map(reference => reference.revision)).size, 1, "Native/managed producers must share one revision");
};

/**
 * The only production reference builder: replay the complete committed matrix
 * first. No injected checker or caller-supplied success receipt bypasses it.
 *
 * @param selection - Closed eleven-lane committed capture selection.
 * @param onLane - Optional progress observer, not a verifier.
 */
export const ownedCheckedRecordPromotionReferences = async (selection, onLane) => {
	const replay = await verifyOwnedCheckedRecordHostedMatrix(selection, onLane);
	const bytes = [];
	for(const entry of selection.archives) bytes.push(await readFile(entry.index.path));
	const indexes = assertOwnedCheckedRecordMatrixIndexes(selection, bytes);
	const liveFiles = [];
	for(const path of validators) liveFiles.push({ path, sha256: sha256(await readFile(path)) });
	const references = indexes.map((index, number) => {
		const capture = replay.captures[number];
		assert.deepEqual(capture.index, selection.archives[number].index);
		assert.equal(capture.producerCommit, index.producerCommit);
		assert.deepEqual(capture.accepted, index.accepted);
		const compact = ownedCheckedRecordPromotionArchiveReferences(index
			, dirname(capture.index.path), bytes[number]);
		return {
			lane: index.lane
			, profiles: [...ownedCheckedRecordPromotionProfiles[index.lane]]
			, routes: [...ownedCheckedRecordHostedRoutes], id: evidenceId(index.lane)
			, kind: "installed", revision: index.producerCommit, command
			, scope: `GitHub Actions run ${capture.runId}, job ${capture.jobId}, artifact ${capture.artifactId}: complete committed ${index.lane} archive and four installed package routes independently replayed. ${index.limitations.join(" ")}`
			, files: [...compact.files, ...liveFiles], artifacts: compact.artifacts };
	});
	assertReferences(references);
	return { references, replay };
};

const profilePrefixes = Object.freeze({
	c: ["c", "native-c"], cpp: ["cpp", "native-cpp"]
	, "node-javascript": ["node-javascript", "browser-node-javascript"]
	, "node-typescript": ["node-typescript", "browser-node-typescript"]
	, python: ["native-python", "python"], ruby: ["native-ruby", "ruby"]
	, rust: ["native-rust", "rust"], dotnet: ["native-dotnet", "dotnet"]
	, java: ["native-java", "jvm-java"], kotlin: ["native-kotlin", "jvm-kotlin"]
	, "php-native": ["native-php-native", "php"]
	, "wit-wasi": ["native-wit-wasi", "wit"]
	, perl: ["perl", "perl"]
	, "browser-javascript": ["browser-browser-javascript", "browser-browser-javascript"]
	, "browser-react": ["browser-browser-react", "browser-browser-react"]
	, "browser-worker": ["browser-browser-worker", "browser-browser-worker"]
	, "php-wasm": ["php-wasm", "php-wasm"]
});
const callbackGroups = Object.freeze({
	languages: ["python", "ruby", "rust"]
	, remaining: ["dotnet", "java", "kotlin", "php-native", "wit-wasi"]
	, browser: [...ownedCheckedRecordPromotionProfiles.javascript]
	, native: ["c", "cpp"], perl: ["perl"], "php-wasm": ["php-wasm"]
});
const cells = [];
for(const path of paths)
{
	for(const [profile, [direct, nested]] of Object.entries(profilePrefixes))
	{
		for(const position of ["parameter", "result"])
			cells.push({ id: `checked-record-${direct}-${path}-${position}`
				, profiles: [profile], positions: [position], path });
		cells.push({ id: `nested-checked-record-${nested}-${path}-field`
			, profiles: [profile], positions: ["field"], path });
	}
	for(const [group, profiles] of Object.entries(callbackGroups))
		cells.push({ id: `callback-checked-record-${group}-${path === "ordinary-source" ? "ordinary" : "reviewed"}`
			, profiles, positions: ["callback-parameter", "callback-result"], path });
}
const note = "Independent owned checked-record acceptance adds the acyclic Booking/Window and Ticket/Claim forms only. Host-produced inputs use the selected mkWindow or mkClaim before ownership transfer or Lean entry; Lean-produced values omit proofs. Full packages also check synchronous host replies and returned-closure inputs, preserve rejected caller values and recover on later valid calls. Standalone result-only packages expose Claim results without input-constructor, transfer or callback metadata. Earlier composition limits still apply to those earlier fixtures.";
const hostTypes = Object.freeze({
	parameter: "borrowed or transferred Booking/Claim payload with a live Ticket owner"
	, result: "leased proof-free Booking/Claim payload; standalone result-only Claim"
	, field: "copied checked Window field inside the resource-bearing owned Booking"
	, "callback-parameter": "proof-free Claim with a live Ticket owner at synchronous host arguments and checked returned-closure inputs"
	, "callback-result": "checked host Claim reply or proof-free returned Lean closure result with the Ticket owner retained"
});

/**
 * Refine exactly 170 existing cells (17 profiles, two author routes, five
 * positions). Pure projection cannot establish the input archive's authenticity.
 *
 * @param original - Validated pre-promotion inventory or its bounded projection.
 * @param references - References produced by the complete matrix replay.
 */
export const promoteOwnedCheckedRecords = (original, references) => {
	assertReferences(references);
	const inventory = structuredClone(original);
	assert.equal(new Set(inventory.observations.map(observation => observation.id)).size
		, inventory.observations.length, "Duplicate observation");
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), `Already promoted: ${reference.id}`);
		inventory.evidence.push(Object.fromEntries(Object.entries(reference)
			.filter(([key]) => !["lane", "profiles", "routes"].includes(key))));
	}
	for(const cell of cells)
	{
		const observation = inventory.observations.find(item => item.id === cell.id);
		assert.ok(observation, `Missing owned promotion cell: ${cell.id}`);
		assert.deepEqual(observation.profiles, cell.profiles, cell.id);
		assert.deepEqual(observation.positions, cell.positions, cell.id);
		assert.deepEqual(observation.shapes, ["checked-record"], cell.id);
		assert.equal(observation.path, cell.path, cell.id);
		assert.deepEqual(Object.keys(observation.stages), stages, cell.id);
		const ids = references.filter(reference => reference.profiles.some(profile =>
			cell.profiles.includes(profile))).map(reference => reference.id);
		observation.scope += ` ${note}`;
		observation.conversionNotes["checked-record"] += ` ${note}`;
		for(const position of cell.positions)
		{
			assert.ok(positions.includes(position));
			assert.equal(typeof observation.hostTypes["checked-record"][position], "string", cell.id);
			observation.hostTypes["checked-record"][position] += `; ${hostTypes[position]}`;
		}
		for(const stage of Object.values(observation.stages))
		{
			assert.equal(stage.state, "passed", cell.id);
			stage.evidence.push(...ids);
			assert.equal(new Set(stage.evidence).size, stage.evidence.length, cell.id);
			stage.note += ` ${note}`;
		}
		assert.ok(!observation.limitations.includes(ownedCheckedRecordPromotionLimit));
		observation.limitations.push(ownedCheckedRecordPromotionLimit);
	}
	assert.equal(cells.length, 114);
	assert.equal(cells.reduce((sum, cell) => sum + cell.profiles.length * cell.positions.length, 0), 170);
	return inventory;
};

/**
 * Replace the complete matrix's evidence bindings without widening support.
 * Only a full independent replay may supply production references.
 *
 * @param original - Previously published validated inventory projection.
 * @param references - New complete, independently replayed matrix references.
 */
export const refreshOwnedCheckedRecords = (original, references) => {
	assertReferences(references);
	const selected = new Map(references.map(reference => [reference.id
		, Object.fromEntries(Object.entries(reference)
			.filter(([key]) => !["lane", "profiles", "routes"].includes(key)))]));
	const owned = original.evidence.filter(entry =>
		/^owned-checked-record-[a-z-]+-hosted-installed$/u.test(entry.id));
	assert.deepEqual(owned.map(entry => entry.id), [...selected.keys()]
		, "Refresh requires the previously published complete owned matrix");
	assert.ok(owned.every(entry => entry.kind === "installed"));
	return { ...structuredClone(original), evidence: original.evidence.map(entry =>
		structuredClone(selected.get(entry.id) ?? entry)) };
};

/**
 * Render the exact hosted scope without claiming general owned composition.
 *
 * @param references - Complete authenticated archive references.
 */
export const renderOwnedCheckedRecordPromotion = references => {
	assertReferences(references);
	const rows = references.map(reference => `| ${reference.lane} | ${reference.profiles.join(", ")} | [archive index](${reference.files[0].path.slice("docs/evidence/".length)}) | \`${reference.revision}\` |`);
	return `# Owned checked records\n\nEleven immutable hosted archives cover seventeen consumer profiles, four ordinary/reviewed full/result-only package routes per lane, and exactly 170 existing parameter, result, field and synchronous callback cells. Native PHP and PHP-Wasm have independent archives.\n\n| Evidence lane | Consumer profiles | Retained evidence | Producer revision |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n\n${note}\n\n${ownedCheckedRecordPromotionLimit}\n\nEvery selected index and retained byte is authenticated from Git before the original hosted ZIP, API records, package receipts, reports and source closure are independently replayed. A partial matrix, a local qualification or an expiring Actions artifact alone cannot authorize this promotion.\n`;
};
