/**
 * Promote the inherited checked-record contract only after every host archive
 * authenticates its ordinary/reviewed and full/result-only selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkInheritedCheckedRecordBrowserEvidence
	, inheritedCheckedRecordBrowserEvidence
} from "./inherited-checked-record-browser-evidence.mjs";
import {
	checkInheritedCheckedRecordDotnetEvidence
	, inheritedCheckedRecordDotnetEvidence
} from "./inherited-checked-record-dotnet-evidence.mjs";
import {
	checkInheritedCheckedRecordJvmEvidence
	, inheritedCheckedRecordJvmEvidence
} from "./inherited-checked-record-jvm-evidence.mjs";
import {
	checkInheritedCheckedRecordNativeArchive
	, inheritedCheckedRecordNativeArchiveSha256
} from "./inherited-checked-record-native-archive.mjs";
import {
	inheritedCheckedRecordNativeEvidence
} from "./inherited-checked-record-native-evidence.mjs";
import {
	checkInheritedCheckedRecordPerlEvidence
	, inheritedCheckedRecordPerlEvidence
} from "./inherited-checked-record-perl-evidence.mjs";
import {
	checkInheritedCheckedRecordPhpEvidence
	, inheritedCheckedRecordPhpEvidence
} from "./inherited-checked-record-php-evidence.mjs";
import {
	checkInheritedCheckedRecordPhpWasmEvidence
	, inheritedCheckedRecordPhpWasmEvidence
} from "./inherited-checked-record-php-wasm-evidence.mjs";
import {
	checkInheritedCheckedRecordPythonEvidence
	, inheritedCheckedRecordPythonEvidence
} from "./inherited-checked-record-python-evidence.mjs";
import {
	checkInheritedCheckedRecordRubyEvidence
	, inheritedCheckedRecordRubyEvidence
} from "./inherited-checked-record-ruby-evidence.mjs";
import {
	checkInheritedCheckedRecordRustEvidence
	, inheritedCheckedRecordRustEvidence
} from "./inherited-checked-record-rust-evidence.mjs";
import {
	checkInheritedCheckedRecordWitEvidence
	, inheritedCheckedRecordWitEvidence
} from "./inherited-checked-record-wit-evidence.mjs";

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

/** Exact archive lanes; together they partition all seventeen profiles. */
export const inheritedCheckedRecordPromotionLanes = Object.freeze([
	{
		id: "native", evidence: inheritedCheckedRecordNativeEvidence
		, profiles: profiles.native, check: checkInheritedCheckedRecordNativeArchive
		, indexSha256: inheritedCheckedRecordNativeArchiveSha256
	}
	, {
		id: "browser", evidence: inheritedCheckedRecordBrowserEvidence
		, profiles: profiles.browser
		, check: checkInheritedCheckedRecordBrowserEvidence
	}
	, {
		id: "jvm", evidence: inheritedCheckedRecordJvmEvidence
		, profiles: profiles.jvm
		, check: controlsNone(checkInheritedCheckedRecordJvmEvidence)
	}
	, {
		id: "dotnet", evidence: inheritedCheckedRecordDotnetEvidence
		, profiles: profiles.dotnet
		, check: controlsNone(checkInheritedCheckedRecordDotnetEvidence)
	}
	, {
		id: "python", evidence: inheritedCheckedRecordPythonEvidence
		, profiles: profiles.python
		, check: controlsNone(checkInheritedCheckedRecordPythonEvidence)
	}
	, {
		id: "ruby", evidence: inheritedCheckedRecordRubyEvidence
		, profiles: profiles.ruby
		, check: controlsNone(checkInheritedCheckedRecordRubyEvidence)
	}
	, {
		id: "perl", evidence: inheritedCheckedRecordPerlEvidence
		, profiles: profiles.perl
		, check: controlsNone(checkInheritedCheckedRecordPerlEvidence)
	}
	, {
		id: "php", evidence: inheritedCheckedRecordPhpEvidence
		, profiles: profiles.php
		, check: controlsNone(checkInheritedCheckedRecordPhpEvidence)
	}
	, {
		id: "php-wasm", evidence: inheritedCheckedRecordPhpWasmEvidence
		, profiles: profiles["php-wasm"]
		, check: controlsNone(checkInheritedCheckedRecordPhpWasmEvidence)
	}
	, {
		id: "rust", evidence: inheritedCheckedRecordRustEvidence
		, profiles: profiles.rust
		, check: controlsNone(checkInheritedCheckedRecordRustEvidence)
	}
	, {
		id: "wit", evidence: inheritedCheckedRecordWitEvidence
		, profiles: profiles.wit, check: checkInheritedCheckedRecordWitEvidence
	}
].map(lane => Object.freeze({ ...lane, profiles: Object.freeze([...lane.profiles]) })));

export const inheritedCheckedRecordConversion = "The tested Span, Ticket and Stamped inheritance chain remains a chain of nested parent subobjects rather than flattened fields. Generated adapters preserve the parent aliases and public nominal identities, erase the ordered, linked and stamped proof fields, apply the exact per-site Span, Word, Ticket and Stamped constructors in dependency order, retain independent choices for repeated parameters, check the nested Fin 8 mark, preserve rejected caller values and recover on the next valid call. Full packages check inputs and proof-free results; result-only packages project the same inherited payloads without input-constructor metadata.";

export const inheritedCheckedRecordBoundary = "Inherited checked-record acceptance covers only the tested acyclic Span → Ticket → Stamped chain, its Ticket alias, repeated direct parameters, nested parent constraints and proof-free Ticket/Stamped results. Value-carrying receiver-dependent inherited fields, generic or recursive inheritance, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed.";

const routeOrder = new Map([
	["ordinary/full", 0], ["ordinary/result-only", 1]
	, ["reviewed/full", 2], ["reviewed/result-only", 3]
]);
const archivePattern = /\.(?:a|crate|gem|gz|jar|nupkg|so|tgz|wasm|whl|zip)$/u;
const exactSelectionKeys = Object.freeze([...routeOrder.keys()]);
let defaultReferences;

const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const runRoute = run => {
	assert.ok(typeof run.route === "string");
	if(["ordinary", "reviewed"].includes(run.route)) return run.route;
	for(const route of ["ordinary", "reviewed"])
		if(run.route === `${route}-${run.mode}`) return route;
	assert.fail(`Unknown inherited checked-record route: ${run.route}`);
};
const runLabel = run => run.label ?? run.route;
const uniqueFiles = files => {
	const result = [], paths = new Set();
	for(const file of files)
	{
		assert.ok(!paths.has(file.path), `Duplicate promotion file: ${file.path}`);
		paths.add(file.path); result.push(file);
	}
	return result;
};
const laneValidators = lane => [
	`tests/helpers/inherited-checked-record-${lane.id}-evidence.mjs`
	, lane.id === "native"
		? "tests/helpers/inherited-checked-record-native-archive.mjs"
		: `tests/helpers/inherited-checked-record-${lane.id}-provenance.mjs`
	, `scripts/check-inherited-checked-record-${lane.id}-ci.mjs`
	, `scripts/run-inherited-checked-record-${lane.id}-ci.sh`
	, `.github/workflows/inherited-checked-record-${lane.id}.yml`
];

const referencesForLane = async (lane, read) => {
	await lane.check(read);
	const indexPath = `${lane.evidence}/index.json`;
	const indexBytes = Buffer.from(await read(indexPath));
	if(lane.indexSha256) assert.equal(sha256(indexBytes), lane.indexSha256);
	const index = json(indexBytes, indexPath);
	assert.equal(index.schemaVersion, 1);
	assert.match(index.kind, /^inherited-checked-record-[a-z-]+-(?:hosted|installed)-v1$/u);
	assert.match(index.producerCommit, /^[a-f0-9]{40}$/u);
	assert.equal(index.runs.length, 4);
	const references = index.runs.map(run => {
		const route = runRoute(run), mode = run.mode, label = runLabel(run);
		assert.ok(["full", "result-only"].includes(mode));
		assert.ok(index.files.some(file => file.path.startsWith(`${label}/`)), label);
		const retained = index.files.filter(file =>
			file.path.startsWith(`${label}/`) || file.path.startsWith("sources/")
			|| file.path.startsWith("producer/")
		);
		const archives = retained.filter(file =>
			file.path.startsWith(`${label}/`) && archivePattern.test(file.path));
		assert.ok(archives.length > 0, `${lane.id}/${label}: no package archive`);
		const full = mode === "full";
		const limitations = Array.isArray(index.limitations)
			? index.limitations.map(removeUnreviewedInheritance).join(" ") : "";
		return {
			id: `inherited-checked-record-${lane.id}-${route}-${mode}-installed`
			, lane: lane.id, route, mode
			, sourcePath: route === "ordinary"
				? "ordinary-source" : "reviewed-ir"
			, profiles: [...lane.profiles]
			, positions: full ? ["parameter", "result", "field"] : ["result"]
			, revision: index.producerCommit
			, command: `bash scripts/run-inherited-checked-record-${lane.id}-ci.sh`
			, scope: `The ${lane.id} installed lane authenticates the ${route} ${mode} inherited checked-record package selection for ${lane.profiles.join(", ")}. ${full ? "The full API checks valid, normalized, invalid parent, invalid child, alias, nested Fin, repeated-constructor and recovery cases before projecting proof-free results." : "The result-only API projects proof-free inherited Ticket and Stamped results without checked-input metadata."} Two independent author builds, source removal, offline installation, relocation and unchanged caller replay are retained where the host permits them. ${limitations} ${inheritedCheckedRecordBoundary}`.trim()
			, files: uniqueFiles([
				{ path: indexPath, sha256: sha256(indexBytes) }
				, ...retained.map(file => ({
					path: `${lane.evidence}/${file.path}`, sha256: file.sha256
				}))
			])
			, artifacts: archives.map(file => ({
				path: `${lane.evidence}/${file.path}`, sha256: file.sha256
			}))
		};
	});
	assert.deepEqual(references.map(item => `${item.route}/${item.mode}`).sort()
		, [...exactSelectionKeys].sort());
	return references.sort((left, right) => routeOrder.get(`${left.route}/${left.mode}`)
		- routeOrder.get(`${right.route}/${right.mode}`));
};

/**
 * Authenticate one exact configured lane. This exposes bounded preflight to
 * tests without permitting aggregate promotion from a narrowed lane set.
 *
 * @param lane - One object from inheritedCheckedRecordPromotionLanes.
 * @param read - Repository-relative evidence reader.
 */
export const inheritedCheckedRecordLaneReferences = async (
	lane, read = readFile
) => {
	const configured = inheritedCheckedRecordPromotionLanes.find(item =>
		item.id === lane?.id);
	assert.equal(configured, lane, "Use the exact configured promotion lane");
	return referencesForLane(lane, read);
};

/**
 * Authenticate all eleven archives serially and derive exactly 44 references.
 * Serial verification keeps disk and memory pressure bounded on the full tree.
 *
 * @param read - Repository-relative evidence reader.
 */
export const inheritedCheckedRecordReferences = async (read = readFile) => {
	if(read === readFile && defaultReferences)
		return structuredClone(await defaultReferences);
	const checking = (async () => {
		const references = [];
		for(const lane of inheritedCheckedRecordPromotionLanes)
			references.push(...await referencesForLane(lane, read));
		assert.equal(references.length, 44);
		assert.equal(new Set(references.map(item => item.id)).size, references.length);
		return references;
	})();
	if(read === readFile) defaultReferences = checking;
	return structuredClone(await checking);
};

const removeUnreviewedInheritance = text => text
	.replaceAll("Generic, recursive and inherited checked records"
		, "Generic and recursive checked records")
	.replaceAll("Generic, recursive or inherited checked records"
		, "Generic or recursive checked records")
	.replaceAll("generic, recursive and inherited checked records"
		, "generic and recursive checked records")
	.replaceAll("generic, recursive or inherited checked records"
		, "generic or recursive checked records")
	.replaceAll("Generic, recursive and inherited records"
		, "Generic and recursive records")
	.replaceAll("generic, recursive and inherited records"
		, "generic and recursive records")
	.replaceAll("generic, recursive and inherited payload records"
		, "generic and recursive payload records")
	.replaceAll("Generic, recursive, inherited, callback"
		, "Generic, recursive, callback")
	.replaceAll("generic, recursive, inherited, callback"
		, "generic, recursive, callback")
	.replaceAll("recursive or inherited checked records"
		, "recursive checked records")
	.replaceAll("recursive and inherited checked records"
		, "recursive checked records");
const supplement = (text, addition) => `${removeUnreviewedInheritance(text).trimEnd()} ${addition}`;
const hostSuffix = "; also carries the tested proof-free inherited Span, Ticket and Stamped record chain with nested parent subobjects preserved";

/**
 * Add 44 installed references and supplement exactly the 102 copied
 * checked-record cells already owned by the seventeen consumer profiles.
 *
 * @param original - Exact inventory immediately before aggregate promotion.
 * @param references - Independently authenticated installed references.
 */
export const promoteInheritedCheckedRecords = async (original, references) => {
	assert.deepEqual(references, await inheritedCheckedRecordReferences());
	const inventory = structuredClone(original);
	const validatorPaths = [
		"tests/helpers/inherited-checked-record-promotion.mjs"
		, "tests/helpers/inherited-checked-record-promotion-tests.mjs"
		, ...inheritedCheckedRecordPromotionLanes.flatMap(laneValidators)
	];
	const validators = await Promise.all([...new Set(validatorPaths)].map(async path => ({
		path, sha256: sha256(await readFile(path))
	})));
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
	for(const lane of inheritedCheckedRecordPromotionLanes)
		for(const profile of lane.profiles)
			for(const path of ["ordinary-source", "reviewed-ir"])
			{
				const laneReferences = references.filter(item => item.lane === lane.id
					&& item.sourcePath === path);
				assert.equal(laneReferences.length, 2);
				const full = laneReferences.filter(item => item.mode === "full");
				assert.equal(full.length, 1);
				for(const position of ["parameter", "result", "field"])
				{
					const cells = inventory.observations.filter(item =>
						item.profiles.includes(profile) && item.path === path
						&& item.shapes.includes("checked-record")
						&& item.positions.includes(position));
					assert.equal(cells.length, 1
						, `Missing or overlapping inherited cell: ${profile}/${path}/${position}`);
					const cell = cells[0];
					const matched = position === "result" ? laneReferences : full;
					const ids = matched.map(item => item.id);
					const scope = matched.map(item => item.scope).join(" ");
					cell.scope = supplement(cell.scope
						, `Additional inherited ${lane.id} acceptance: ${scope}`);
					cell.conversionNotes["checked-record"] = supplement(
						cell.conversionNotes["checked-record"]
						, inheritedCheckedRecordConversion
					);
					cell.hostTypes["checked-record"][position]
						= removeUnreviewedInheritance(
							cell.hostTypes["checked-record"][position]
						).trimEnd() + hostSuffix;
					const limitations = cell.limitations.map(removeUnreviewedInheritance);
					assert.ok(!limitations.includes(inheritedCheckedRecordBoundary));
					cell.limitations = [...limitations, inheritedCheckedRecordBoundary];
					for(const stage of Object.values(cell.stages))
					{
						assert.equal(stage.state, "passed");
						stage.evidence.push(...ids);
						assert.equal(new Set(stage.evidence).size, stage.evidence.length);
						stage.note = supplement(stage.note
							, `Additional inherited ${lane.id} acceptance: ${scope}`);
					}
				}
			}
	return inventory;
};
