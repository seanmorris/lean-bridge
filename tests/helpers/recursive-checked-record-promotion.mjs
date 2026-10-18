/**
 * Authenticate the complete recursive checked-record host matrix before public
 * support promotion. Ten immutable archives are already retained; the native
 * C/C++ lane deliberately keeps the aggregate fail-closed until its hosted
 * index is pinned.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkMutualCheckedRecordDotnetEvidence, mutualCheckedRecordDotnetEvidence
} from "./mutual-checked-record-dotnet-evidence.mjs";
import {
	checkMutualCheckedRecordJvmEvidence, mutualCheckedRecordJvmEvidence
} from "./mutual-checked-record-jvm-evidence.mjs";
import {
	checkMutualCheckedRecordNativeEvidence, mutualCheckedRecordNativeEvidence
} from "./mutual-checked-record-native-evidence.mjs";
import {
	checkMutualCheckedRecordNpmBrowserArchive
	, mutualCheckedRecordNpmBrowserArchive
} from "./mutual-checked-record-npm-browser-archive.mjs";
import {
	checkRecursiveCheckedRecordPerlEvidence, recursiveCheckedRecordPerlEvidence
} from "./recursive-checked-record-perl-evidence.mjs";
import {
	checkRecursiveCheckedRecordPhpEvidence, recursiveCheckedRecordPhpEvidence
} from "./recursive-checked-record-php-evidence.mjs";
import {
	checkRecursiveCheckedRecordPhpWasmEvidence
	, recursiveCheckedRecordPhpWasmEvidence
} from "./recursive-checked-record-php-wasm-evidence.mjs";
import {
	checkRecursiveCheckedRecordPythonEvidence
	, recursiveCheckedRecordPythonEvidence
} from "./recursive-checked-record-python-evidence.mjs";
import {
	checkRecursiveCheckedRecordRubyEvidence, recursiveCheckedRecordRubyEvidence
} from "./recursive-checked-record-ruby-evidence.mjs";
import {
	checkRecursiveCheckedRecordRustEvidence, recursiveCheckedRecordRustEvidence
} from "./recursive-checked-record-rust-evidence.mjs";
import {
	checkRecursiveCheckedRecordWitEvidence, recursiveCheckedRecordWitEvidence
} from "./recursive-checked-record-wit-evidence.mjs";

const controlsNone = check => (read = readFile) => check(read, { controls: "none" });
const profiles = Object.freeze({
	browser: [
		"node-javascript", "node-typescript", "browser-javascript"
		, "browser-react", "browser-worker"
	]
	, dotnet: ["dotnet"]
	, jvm: ["java", "kotlin"]
	, native: ["c", "cpp"]
	, perl: ["perl"]
	, php: ["php-native"]
	, "php-wasm": ["php-wasm"]
	, python: ["python"]
	, ruby: ["ruby"]
	, rust: ["rust"]
	, wit: ["wit-wasi"]
});
const mutual = Object.freeze(["mutual"]);
const recursiveAndMutual = Object.freeze(["recursive", "mutual"]);

/**
 * Exact evidence lanes. They partition all seventeen profiles and yield 36
 * route/fixture references: two each for browser, JVM, .NET and native, and
 * four each for the seven remaining hosts.
 */
export const recursiveCheckedRecordPromotionLanes = Object.freeze([
	{
		id: "native", evidence: mutualCheckedRecordNativeEvidence
		, profiles: profiles.native, fixtures: mutual
		, check: checkMutualCheckedRecordNativeEvidence
		, command: "bash scripts/run-mutual-checked-record-native-ci.sh"
	}
	, {
		id: "browser", evidence: mutualCheckedRecordNpmBrowserArchive
		, profiles: profiles.browser, fixtures: mutual
		, check: checkMutualCheckedRecordNpmBrowserArchive
		, command: "node --test tests/mutual-checked-record-npm-browser-archive.test.mjs"
	}
	, {
		id: "jvm", evidence: mutualCheckedRecordJvmEvidence
		, profiles: profiles.jvm, fixtures: mutual
		, check: checkMutualCheckedRecordJvmEvidence
		, command: "node --test tests/mutual-checked-record-jvm-evidence.test.mjs"
	}
	, {
		id: "dotnet", evidence: mutualCheckedRecordDotnetEvidence
		, profiles: profiles.dotnet, fixtures: mutual
		, check: checkMutualCheckedRecordDotnetEvidence
		, command: "node --test tests/mutual-checked-record-dotnet-evidence.test.mjs"
	}
	, {
		id: "python", evidence: recursiveCheckedRecordPythonEvidence
		, profiles: profiles.python, fixtures: recursiveAndMutual
		, check: controlsNone(checkRecursiveCheckedRecordPythonEvidence)
		, command: "node --test tests/recursive-checked-record-python-evidence.test.mjs"
	}
	, {
		id: "ruby", evidence: recursiveCheckedRecordRubyEvidence
		, profiles: profiles.ruby, fixtures: recursiveAndMutual
		, check: controlsNone(checkRecursiveCheckedRecordRubyEvidence)
		, command: "node --test tests/recursive-checked-record-ruby-evidence.test.mjs"
	}
	, {
		id: "perl", evidence: recursiveCheckedRecordPerlEvidence
		, profiles: profiles.perl, fixtures: recursiveAndMutual
		, check: checkRecursiveCheckedRecordPerlEvidence
		, command: "node --test tests/recursive-checked-record-perl.test.mjs"
	}
	, {
		id: "php", evidence: recursiveCheckedRecordPhpEvidence
		, profiles: profiles.php, fixtures: recursiveAndMutual
		, check: controlsNone(checkRecursiveCheckedRecordPhpEvidence)
		, command: "node --test tests/recursive-checked-record-php.test.mjs"
	}
	, {
		id: "php-wasm", evidence: recursiveCheckedRecordPhpWasmEvidence
		, profiles: profiles["php-wasm"], fixtures: recursiveAndMutual
		, check: controlsNone(checkRecursiveCheckedRecordPhpWasmEvidence)
		, command: "node --test tests/recursive-checked-record-php-wasm.test.mjs"
	}
	, {
		id: "rust", evidence: recursiveCheckedRecordRustEvidence
		, profiles: profiles.rust, fixtures: recursiveAndMutual
		, check: controlsNone(checkRecursiveCheckedRecordRustEvidence)
		, command: "node --test tests/recursive-checked-record-rust.test.mjs"
	}
	, {
		id: "wit", evidence: recursiveCheckedRecordWitEvidence
		, profiles: profiles.wit, fixtures: recursiveAndMutual
		, check: controlsNone(checkRecursiveCheckedRecordWitEvidence)
		, command: "node --test tests/recursive-checked-record-wit.test.mjs"
	}
].map(lane => Object.freeze({
	...lane, profiles: Object.freeze([...lane.profiles])
})));

export const recursiveCheckedRecordConversion = "The tested checked-record graphs preserve nominal identity through a self-recursive Packet and a mutually recursive Envelope ↔ Step pair, including aliases, Array and Option wrappers, active variant branches, exact Nat Subtype constructors and Fin 3 fields. Generated adapters validate every selected input site in dependency order, erase proof fields, expose constructor-free copied results, preserve rejected caller graphs and recover on the next valid call.";

export const recursiveCheckedRecordBoundary = "Recursive checked-record acceptance covers the tested Packet self-cycle and Envelope ↔ Step mutual cycle, their aliases, Array/Option wrappers, active branches, Nat Subtype constructors and Fin 3 fields in copied parameters, results and fields. It does not establish generic recursive records, other recursive graph shapes, value-carrying receiver-dependent fields, other index kinds, open dependent or zero-payload records, callbacks or owned positions.";

const archivePattern = /\.(?:a|crate|gem|gz|jar|nupkg|so|tgz|wasm|whl|zip)$/u;
const fixtureOrder = new Map([["recursive", 0], ["mutual", 1]]);
const routeOrder = new Map([["ordinary", 0], ["reviewed", 1]]);
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const uniqueFiles = files => {
	const result = [], paths = new Set();
	for(const file of files)
	{
		assert.ok(!paths.has(file.path), `Duplicate promotion file: ${file.path}`);
		paths.add(file.path); result.push(file);
	}
	return result;
};
const laneValidators = lane => ({
	native: [
		"tests/helpers/mutual-checked-record-native-evidence.mjs"
		, "tests/helpers/mutual-checked-record-native-controls.mjs"
		, "scripts/check-mutual-checked-record-native-ci.mjs"
		, "scripts/run-mutual-checked-record-native-ci.sh"
		, ".github/workflows/recursive-checked-record-native.yml"
	]
	, browser: [
		"tests/helpers/mutual-checked-record-npm-browser-archive.mjs"
		, "tests/mutual-checked-record-npm-browser-archive.test.mjs"
		, "scripts/archive-mutual-checked-record-npm-browser.mjs"
	]
	, jvm: [
		"tests/helpers/mutual-checked-record-jvm-evidence.mjs"
		, "tests/helpers/mutual-checked-record-jvm-provenance.mjs"
		, "tests/mutual-checked-record-jvm-evidence.test.mjs"
		, "scripts/archive-mutual-checked-record-jvm.mjs"
	]
	, dotnet: [
		"tests/helpers/mutual-checked-record-dotnet-evidence.mjs"
		, "tests/helpers/mutual-checked-record-dotnet-provenance.mjs"
		, "tests/mutual-checked-record-dotnet-evidence.test.mjs"
		, "scripts/archive-mutual-checked-record-dotnet.mjs"
	]
	, python: [
		"tests/helpers/recursive-checked-record-python-evidence.mjs"
		, "tests/helpers/recursive-checked-record-python-provenance.mjs"
		, "scripts/check-recursive-checked-record-python-ci.mjs"
		, "scripts/run-recursive-checked-record-python-ci.sh"
		, ".github/workflows/recursive-checked-record-python.yml"
	]
	, ruby: [
		"tests/helpers/recursive-checked-record-ruby-evidence.mjs"
		, "tests/helpers/recursive-checked-record-ruby-provenance.mjs"
		, "scripts/check-recursive-checked-record-ruby-ci.mjs"
		, "scripts/run-recursive-checked-record-ruby-ci.sh"
		, ".github/workflows/recursive-checked-record-ruby.yml"
	]
	, perl: [
		"tests/helpers/recursive-checked-record-perl-evidence.mjs"
		, "tests/helpers/recursive-checked-record-perl-provenance.mjs"
		, "scripts/check-recursive-checked-record-perl-ci.mjs"
		, "scripts/run-recursive-checked-record-perl-ci.sh"
		, ".github/workflows/recursive-checked-record-perl.yml"
	]
	, php: [
		"tests/helpers/recursive-checked-record-php-evidence.mjs"
		, "tests/helpers/recursive-checked-record-php-provenance.mjs"
		, "scripts/check-recursive-checked-record-php-ci.mjs"
		, "scripts/run-recursive-checked-record-php-ci.sh"
		, ".github/workflows/recursive-checked-record-php.yml"
	]
	, "php-wasm": [
		"tests/helpers/recursive-checked-record-php-wasm-evidence.mjs"
		, "tests/helpers/recursive-checked-record-php-wasm-provenance.mjs"
		, "scripts/check-recursive-checked-record-php-wasm-ci.mjs"
		, "scripts/run-recursive-checked-record-php-wasm-ci.sh"
		, ".github/workflows/recursive-checked-record-php-wasm.yml"
	]
	, rust: [
		"tests/helpers/recursive-checked-record-rust-evidence.mjs"
		, "tests/helpers/recursive-checked-record-rust-provenance.mjs"
		, "scripts/check-recursive-checked-record-rust-ci.mjs"
		, "scripts/run-recursive-checked-record-rust-ci.sh"
		, ".github/workflows/recursive-checked-record-rust.yml"
	]
	, wit: [
		"tests/helpers/recursive-checked-record-wit-evidence.mjs"
		, "tests/helpers/recursive-checked-record-wit-provenance.mjs"
		, "scripts/check-recursive-checked-record-wit-ci.mjs"
		, "scripts/run-recursive-checked-record-wit-ci.sh"
		, ".github/workflows/recursive-checked-record-wit.yml"
	]
}[lane.id]);
const labelForRun = run => run.label ?? run.name ?? run.route;
const fixtureForRun = run => run.fixture ?? "mutual";
const selectionKey = run => `${run.route}/${fixtureForRun(run)}`;
const expectedSelections = lane => ["ordinary", "reviewed"].flatMap(route =>
	[...lane.fixtures].map(fixture => `${route}/${fixture}`));
const referenceDigest = reference => sha256(canonicalJson(reference));

const referencesForLane = async (lane, read) => {
	const checked = await lane.check(read);
	const indexPath = `${lane.evidence}/index.json`;
	const indexBytes = Buffer.from(await read(indexPath));
	const index = json(indexBytes, indexPath);
	assert.match(index.kind
		, /^(?:mutual|recursive)-checked-record-[a-z-]+-(?:hosted|installed)-v1$/u);
	assert.match(index.producerCommit, /^[a-f0-9]{40}$/u);
	assert.equal(checked.producerCommit, index.producerCommit);
	assert.deepEqual(index.runs.map(selectionKey).sort()
		, expectedSelections(lane).sort());
	const labels = new Set(index.runs.map(labelForRun));
	assert.equal(labels.size, index.runs.length);
	const shared = index.files.filter(file => ![...labels].some(label =>
		file.path.startsWith(`${label}/`)));
	const references = index.runs.map(run => {
		assert.ok(["ordinary", "reviewed"].includes(run.route));
		const fixture = fixtureForRun(run), label = labelForRun(run);
		assert.ok(lane.fixtures.includes(fixture));
		const selected = index.files.filter(file => file.path.startsWith(`${label}/`));
		assert.ok(selected.length > 0, `${lane.id}/${label}: no retained records`);
		const retained = uniqueFiles([...shared, ...selected]);
		let artifacts = selected.filter(file => archivePattern.test(file.path));
		if(artifacts.length === 0 && Array.isArray(run.omittedArchives))
			artifacts = run.omittedArchives.map(file => ({
				...file, path: `${label}/records/${file.path}`
			}));
		assert.ok(artifacts.length > 0, `${lane.id}/${label}: no package identity`);
		const limitations = Array.isArray(index.limitations)
			? index.limitations.join(" ") : "";
		return {
			id: `recursive-checked-record-${lane.id}-${run.route}-${fixture}-installed`
			, lane: lane.id, route: run.route, fixture
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...lane.profiles]
			, positions: ["parameter", "result", "field"]
			, revision: index.producerCommit, command: lane.command
			, scope: `The ${lane.id} installed lane authenticates the ${run.route} ${fixture} recursive checked-record selection for ${lane.profiles.join(", ")}. Original inputs, exact failures, preserved rejected values, recovery and proof-free results are retained; independently reproduced packages are installed without author sources and replayed after relocation where the host permits it. ${limitations} ${recursiveCheckedRecordBoundary}`.trim()
			, files: uniqueFiles([
				{ path: indexPath, sha256: sha256(indexBytes) }
				, ...retained.map(file => ({
					path: `${lane.evidence}/${file.path}`, sha256: file.sha256
				}))
			])
			, artifacts: artifacts.map(file => ({
				path: `${lane.evidence}/${file.path}`, sha256: file.sha256
			}))
		};
	});
	return references.sort((left, right) =>
		routeOrder.get(left.route) - routeOrder.get(right.route)
		|| fixtureOrder.get(left.fixture) - fixtureOrder.get(right.fixture));
};

/**
 * Authenticate one configured lane without weakening the aggregate lane set.
 *
 * @param lane - Exact object from recursiveCheckedRecordPromotionLanes.
 * @param read - Repository-relative evidence reader.
 */
export const recursiveCheckedRecordLaneReferences = async (
	lane, read = readFile
) => {
	const configured = recursiveCheckedRecordPromotionLanes.find(item =>
		item.id === lane?.id);
	assert.equal(configured, lane, "Use the exact configured promotion lane");
	return referencesForLane(lane, read);
};

let defaultReferences, defaultDigests;
const authenticateReferences = async read => {
	const references = [];
	for(const lane of recursiveCheckedRecordPromotionLanes)
		references.push(...await referencesForLane(lane, read));
	assert.equal(references.length, 36);
	assert.equal(new Set(references.map(item => item.id)).size, references.length);
	return references;
};
const exactReferences = () => defaultReferences ??= authenticateReferences(readFile);
const exactDigests = async () => defaultDigests
	??= (await exactReferences()).map(referenceDigest);

/**
 * Authenticate all eleven archives serially and derive exactly 36 references.
 *
 * @param read - Repository-relative evidence reader.
 */
export const recursiveCheckedRecordReferences = async (read = readFile) => {
	const references = read === readFile
		? await exactReferences() : await authenticateReferences(read);
	return structuredClone(references);
};

/**
 * Refuse a narrowed, reordered or rewritten aggregate reference set.
 *
 * @param references - Candidate aggregate references.
 */
export const assertExactRecursiveCheckedRecordReferences = async references => {
	const expected = await exactDigests();
	assert.equal(references.length, expected.length
		, "Recursive promotion requires exactly 36 references");
	for(const [index, reference] of references.entries())
		assert.equal(referenceDigest(reference), expected[index]
			, `Recursive promotion reference ${index}`);
};

const removeUnreviewedRecursive = text => text
	.replaceAll("Generic and recursive checked records", "Generic checked records")
	.replaceAll("Generic or recursive checked records", "Generic checked records")
	.replaceAll("generic and recursive checked records", "generic checked records")
	.replaceAll("generic or recursive checked records", "generic checked records")
	.replaceAll("Generic and recursive records", "Generic records")
	.replaceAll("generic and recursive records", "generic records")
	.replaceAll("Generic and recursive payload records", "Generic payload records")
	.replaceAll("generic and recursive payload records", "generic payload records")
	.replaceAll("recursive checked records, dependent types"
		, "other recursive checked-record graph shapes, dependent types");
const supplement = (text, addition) =>
	`${removeUnreviewedRecursive(text).trimEnd()} ${addition}`;
const hostSuffix = lane => lane.fixtures.includes("recursive")
	? "; also carries the tested proof-free recursive Packet and Envelope/Step graphs with nominal identities and active variants preserved"
	: "; also carries the tested proof-free Envelope/Step mutually recursive graph with nominal identities and active variants preserved";

/**
 * Add 36 installed references and supplement exactly the 102 copied
 * checked-record cells already owned by the seventeen consumer profiles.
 *
 * @param original - Exact inventory immediately before aggregate promotion.
 * @param references - Independently authenticated installed references.
 */
export const promoteRecursiveCheckedRecords = async (original, references) => {
	await assertExactRecursiveCheckedRecordReferences(references);
	const inventory = structuredClone(original);
	const validatorPaths = [
		"docs/evidence/recursive-checked-record-promotion-20261018.md"
		, "scripts/generate-type-docs.mjs"
		, "scripts/promote-recursive-checked-record-evidence.mjs"
		, "scripts/update-recursive-checked-record-promotion-source-history.mjs"
		, "tests/nested-checked-records.test.mjs"
		, "tests/helpers/recursive-checked-record-promotion.mjs"
		, "tests/helpers/recursive-checked-record-promotion-tests.mjs"
		, "tests/helpers/recursive-checked-record-promotion-source-history.mjs"
		, "tests/helpers/recursive-checked-record-promotion-source-history-tests.mjs"
		, ...recursiveCheckedRecordPromotionLanes.flatMap(laneValidators)
	];
	const validators = await Promise.all([...new Set(validatorPaths)].map(
		async path => ({ path, sha256: sha256(await readFile(path)) })
	));
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, `Already promoted: ${reference.id}`);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: uniqueFiles([...validators, ...reference.files])
			, artifacts: reference.artifacts.map(item => ({
				...item, path: `${reference.id}/${item.path}`
			}))
		});
	}
	for(const lane of recursiveCheckedRecordPromotionLanes)
		for(const profile of lane.profiles)
			for(const path of ["ordinary-source", "reviewed-ir"])
			{
				const matched = references.filter(item => item.lane === lane.id
					&& item.sourcePath === path);
				assert.equal(matched.length, lane.fixtures.length);
				const ids = matched.map(item => item.id);
				const scope = matched.map(item => item.scope).join(" ");
				for(const position of ["parameter", "result", "field"])
				{
					const cells = inventory.observations.filter(item =>
						item.profiles.includes(profile) && item.path === path
						&& item.shapes.includes("checked-record")
						&& item.positions.includes(position));
					assert.equal(cells.length, 1
						, `Missing or overlapping recursive cell: ${profile}/${path}/${position}`);
					const cell = cells[0];
					cell.scope = supplement(cell.scope
						, `Additional recursive ${lane.id} acceptance: ${scope}`);
					cell.conversionNotes["checked-record"] = supplement(
						cell.conversionNotes["checked-record"]
						, recursiveCheckedRecordConversion
					);
					cell.hostTypes["checked-record"][position]
						= removeUnreviewedRecursive(
							cell.hostTypes["checked-record"][position]
						).trimEnd() + hostSuffix(lane);
					const limitations = cell.limitations.map(removeUnreviewedRecursive);
					assert.ok(!limitations.includes(recursiveCheckedRecordBoundary));
					cell.limitations = [...limitations, recursiveCheckedRecordBoundary];
					for(const stage of Object.values(cell.stages))
					{
						assert.equal(stage.state, "passed");
						stage.evidence.push(...ids);
						assert.equal(new Set(stage.evidence).size, stage.evidence.length);
						stage.note = supplement(stage.note
							, `Additional recursive ${lane.id} acceptance: ${scope}`);
					}
				}
			}
	return inventory;
};
