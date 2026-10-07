/**
 * Add only installed generic-record observations backed by the frozen reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const directory = "docs/evidence/generic-record-specializations-20261007";
const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const producer = "d5705ff38d67e6410c987a3a3a28cc409162ebfd";
const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", ruby: "rb", perl: "pl", "php-native": "php", "wit-wasi": "c" };
const names = { c: "C", cpp: "C++", python: "Python", rust: "Rust", dotnet: "C#", java: "Java", kotlin: "Kotlin", ruby: "Ruby", perl: "Perl", "php-native": "native PHP", "wit-wasi": "WIT/WASI", npm: "Node/TypeScript" };
const targets = {
	"npm-finite-specializations-ordinary-source": ["npm"]
	, "perl-finite-specializations-ordinary-source": ["perl"]
	, "native-specializations-c-cpp-ordinary-source": ["c", "cpp"]
	, "native-specializations-python-ordinary-source": ["python"]
	, "native-specializations-rust-ordinary-source": ["rust"]
	, "native-specializations-ruby-ordinary-source": ["ruby"]
	, "native-specializations-dotnet-ordinary-source": ["dotnet"]
	, "native-specializations-java-kotlin-ordinary-source": ["java", "kotlin"]
	, "native-specializations-php-native-ordinary-source": ["php-native"]
	, "native-specializations-wit-wasi-ordinary-source": ["wit-wasi"]
};
const sharedFiles = [
	"src/analyze/NativeExports.lean"
	, "src/analyze/native-types.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/analyze/copied-metadata-graph.mjs"
	, "src/build/native-model.mjs"
	, "tests/fixtures/onboarding/generic-records/GenericRecords.lean"
	, "tests/fixtures/generic-record-specializations.lean"
	, "tests/generic-records.test.mjs"
	, "tests/helpers/generic-record-packages.mjs"
	, "tests/helpers/generic-record-specializations.mjs"
	, "tests/helpers/generic-specialization-evidence-tests.mjs"
	, "docs/evidence/generic-record-specializations-20261007.md"
	, `${directory}/receipt.json`
];
const accepted = [];
for(const reference of receipt.reports)
{
	assert.equal(reference.revision, producer);
	const raw = await readFile(reference.path);
	assert.equal(sha256(raw), reference.sha256, reference.path);
	const report = JSON.parse(raw), npm = reference.id === "specialized-npm";
	const id = `generic-record-${reference.id.replaceAll(".", "-")}-installed`;
	assert.ok(!inventory.evidence.some(entry => entry.id === id), `${id} already recorded`);
	const profiles = reference.profiles;
	const files = [...sharedFiles, reference.path];
	if(!npm) for(const profile of profiles) files.push(`tests/fixtures/generic-record-consumers/${profile}.${extensions[profile]}`);
	if(profiles.includes("rust")) files.push("tests/helpers/generic-record-rust.mjs");
	if(profiles.some(profile => ["dotnet", "java", "kotlin"].includes(profile))) files.push("tests/helpers/generic-record-managed-types.mjs");
	const counts = npm ? "Node executes 1019 checks and 1010 runtime rejections; strict TypeScript checks the installed declarations with skipLibCheck disabled."
		: report.reports.map(item => `${names[item.profile]} executes ${item.checks} checks`).join("; ") + ".";
	const runtime = reference.runtime ? ` Runtime: ${reference.runtime}.` : "";
	const scope = "Nine configured function specializations over closed alias-named generic records, two namespaces, List and Option aliases, alongside ten direct generic-record exports. "
		+ counts + runtime + " Two clean author roots reproduce the archives; consumers install offline after author removal. "
		+ (npm ? "Node and strict TypeScript only; browser contexts are unmeasured. " : "Local native execution uses glibc floor 2.36, not the CI distribution floor. ")
		+ "Ordinary source only; reviewed generic signatures, open dispatch and refined generic arguments are not covered.";
	const artifacts = npm
		? [{ path: `${reference.id}/component.tgz`, sha256: report.archiveSha256 }, { path: `${reference.id}/runtime.tgz`, sha256: report.runtimeArchiveSha256 }]
		: Object.entries(report.archives).map(([path, digest]) => ({ path: `${reference.id}/${path}`, sha256: digest }));
	const evidence = { id, kind: "installed", revision: producer
		, command: reference.reproduceCommand, scope
		, files: await Promise.all(files.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts };
	inventory.evidence.push(evidence);
	accepted.push({ id, profiles });
}

const boundary = "Alias-named records cover nonrecursive copied structures over supported copied fields. Inherited, indexed, open and dependent structures, proof fields, unnamed applications and refined generic arguments remain unsupported; reviewed generic signatures and PHP-Wasm are not covered by these runs.";
for(const [id, profiles] of Object.entries(targets))
{
	const cell = inventory.observations.find(entry => entry.id === id);
	assert.equal(cell.path, "ordinary-source");
	const evidenceIds = accepted.filter(entry => entry.profiles.some(profile => profiles.includes(profile))).map(entry => entry.id);
	assert.ok(evidenceIds.length > 0);
	for(const stage of Object.values(cell.stages))
	{
		assert.equal(stage.state, "passed");
		stage.evidence.push(...evidenceIds);
	}
	cell.scope += " Installed packages also execute nine configured specializations over alias-named generic records, separate namespaces and List/Option aliases, alongside the ten direct record exports. Each alias keeps its name and compiler-recorded origin; host assignability follows the host language.";
	if(profiles.includes("npm")) cell.scope += " TypeScript interfaces with the same fields are structurally assignable.";
	cell.limitations = cell.limitations.map(value => value
		.replace(", and this host's installed acceptance of them is not yet recorded", "")
		.replace("Type arguments are closed constants or aliases. Positive generic-structure applications require the separate #1433 implementation and installed host rollout.", "Type arguments are closed constants or aliases; generic structure applications require an abbrev naming the instantiation."));
	cell.limitations.push(boundary);
	cell.conversionNotes.generic += " Name a closed generic structure application with an abbrev to get a host record with instantiated fields. Configured functions over these records, List aliases and Option aliases use ordinary concrete signatures.";
}
await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write(`Recorded ${accepted.length} installed report bundles across ${Object.keys(targets).length} existing generic observations.\n`);
