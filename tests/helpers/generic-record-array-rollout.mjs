/**
 * Attach authenticated local Array executions to the existing native generic observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { arrayEvidenceDirectory, arraySelections, assertArrayEvidenceArchive } from "./generic-record-array-evidence.mjs";
import { arrayHostDirectory, arrayHostAttempts, assertArrayHostArchive } from "./generic-record-array-host-evidence.mjs";

export const arrayRolloutReceipts = Object.freeze([
	[`${arrayEvidenceDirectory}/receipt.json`, "a85b99bb05b235f603a22a44528f4d4d17518d6b91d7428000a574ee20074cc6"]
	, [`${arrayHostDirectory}/receipt.json`, "5b11315bfe2ddcd2c05f35bbd020c7d8e502ec1aac348801526bf502b8ed6c67"]
]);
export const arrayRolloutObservations = Object.freeze([
	"native-specializations-c-cpp-ordinary-source"
	, "native-specializations-python-ordinary-source"
	, "native-specializations-rust-ordinary-source"
	, "native-specializations-ruby-ordinary-source"
	, "native-specializations-dotnet-ordinary-source"
	, "native-specializations-java-kotlin-ordinary-source"
	, "native-specializations-php-native-ordinary-source"
	, "native-specializations-wit-wasi-ordinary-source"
	, "perl-finite-specializations-ordinary-source"
]);
export const arrayRolloutNote = "The local Array supplement verifies Array-valued fields and arrays of alias-named records, alongside every original direct export and nine finite specializations. It covers ordinary-source native packages on glibc 2.36, not hosted release-floor acceptance or reviewed generic records.";
const shellWord = value => "'" + value.replaceAll("'", "'\"'\"'") + "'";

/**
 * Revalidate every original, then select only successful reports with their own source revisions.
 *
 * @param read - Original byte reader, injectable for corruption controls.
 */
export const arrayRolloutEvidence = async (read = readFile) => {
	const receipts = [];
	for(const [path, digest] of arrayRolloutReceipts)
	{
		const bytes = await read(path); assert.equal(sha256(bytes), digest, path);
		receipts.push(JSON.parse(bytes));
	}
	await assertArrayEvidenceArchive(receipts[0], read);
	await assertArrayHostArchive(receipts[1], read);
	const selected = [
		...arraySelections.map(item => ({ receipt: 0, name: item.name, report: `${arrayEvidenceDirectory}/${item.report}`, revision: receipts[0].revision }))
		, ...receipts[1].attempts.filter(item => item.outcome === "passed").map(item => ({ receipt: 1, name: item.selection, report: item.report, revision: arrayHostAttempts.find(attempt => attempt.id === item.attempt).revision }))
	];
	assert.equal(selected.length, 13);
	const references = [];
	for(const item of selected)
	{
		const member = receipts[item.receipt].artifacts.find(file => file.path === item.report);
		const bytes = await read(item.report); assert.equal(sha256(bytes), member.sha256, item.report);
		const report = JSON.parse(bytes);
		const queuePath = item.report.slice(0, item.report.lastIndexOf("/")) + "/queue.json";
		const queueMember = receipts[item.receipt].artifacts.find(file => file.path === queuePath);
		const queueBytes = await read(queuePath); assert.equal(sha256(queueBytes), queueMember.sha256, queuePath);
		const queue = JSON.parse(queueBytes), selection = queue.selections.find(selection => selection.name === item.name);
		assert.deepEqual(selection.profiles, report.profiles);
		const command = "env " + Object.entries(selection.environment).map(([key, value]) => shellWord(`${key}=${value}`)).join(" ") + " " + queue.command.map(shellWord).join(" ");
		references.push({ ...item, id: `generic-record-array-${item.name.replaceAll(".", "-")}-local`
			, command
			, profiles: report.profiles
			, checks: report.reports.map(row => [row.profile, row.checks])
			, sha256: member.sha256 });
	}
	assert.equal(new Set(references.map(item => item.id)).size, 13);
	const paths = ["tests/helpers/generic-record-array-rollout.mjs"
		, "tests/generic-record-array-rollout.test.mjs"
		, "tests/helpers/generic-record-array-evidence.mjs"
		, "tests/generic-record-array-evidence.test.mjs"
		, "tests/helpers/generic-record-array-host-evidence.mjs"
		, "tests/generic-record-array-host-evidence.test.mjs"];
	const common = await Promise.all(paths.map(async path => ({ path, sha256: sha256(await read(path)) })));
	const groups = [];
	for(const [index, receipt] of receipts.entries())
	{
		const [path, digest] = arrayRolloutReceipts[index];
		assert.equal(sha256(await read(path)), digest, path);
		const files = [{ path, sha256: digest }, ...common];
		for(const member of receipt.artifacts)
		{
			assert.equal(sha256(await read(member.path)), member.sha256, member.path);
			files.push({ path: member.path, sha256: member.sha256 });
		}
		groups.push(files);
	}
	const entries = references.map(item => ({ id: item.id
		, kind: "test", revision: item.revision
		, command: item.command
		, scope: `Ordinary-source ${item.profiles.join(", ")}: ${item.checks.map(([profile, count]) => `${profile} ${count} checks`).join("; ")}. ArrayBox, BoxRow and RowBox run through generated public APIs, including empty values, invalid representable members, recovery and 1000 Array rounds. Original direct exports, List/Option cases, namespaces, nominal aliases and nine specializations remain in each consumer. Two author roots reproduce packages, then author inputs are removed before offline, compiler-free installation. Local glibc 2.36 only; these reports do not establish hosted release-floor acceptance. Report ${item.report} SHA-256 ${item.sha256}. Package archives are identified by report-carried digests; archive bytes are not retained here. No reviewed-IR, browser, PHP-Wasm, callback, inherited, indexed or refined generic-record coverage is added.`
		, files: structuredClone(groups[item.receipt]), artifacts: [] }));
	return { references, entries };
};

/**
 * Supplement exactly the nine existing native observations without promoting any support state.
 *
 * @param previous - Complete predecessor inventory.
 * @param read - Original byte reader.
 */
export const supplementArrayRolloutInventory = async (previous, read = readFile) => {
	const document = structuredClone(previous), { references, entries } = await arrayRolloutEvidence(read);
	for(const entry of entries) assert.ok(!document.evidence.some(item => item.id === entry.id), `already supplemented: ${entry.id}`);
	for(const id of arrayRolloutObservations)
	{
		const matches = document.observations.filter(item => item.id === id); assert.equal(matches.length, 1, id);
		const observation = matches[0];
		assert.equal(observation.path, "ordinary-source"); assert.deepEqual(observation.positions, ["signature"]);
		assert.deepEqual(observation.shapes, ["generic", "implicit", "instance"]);
		assert.ok(Object.values(observation.stages).every(stage => stage.state === "passed"));
		assert.ok(observation.stages.installedExecution.evidence.some(id => document.evidence.some(entry => entry.id === id && entry.kind === "installed")));
		const selected = references.filter(item => item.profiles.some(profile => observation.profiles.includes(profile)));
		assert.ok(selected.length > 0, id);
		assert.deepEqual([...new Set(selected.flatMap(item => item.profiles))].sort(), [...observation.profiles].sort(), id);
		observation.stages.installedExecution.evidence.push(...selected.map(item => item.id));
		observation.scope += ` ${arrayRolloutNote}`;
		observation.conversionNotes.generic += " Array-valued fields and arrays of alias-named records use the host's ordinary array representation with recursive element checks.";
	}
	document.evidence.push(...entries);
	return document;
};
