/**
 * Authenticate the original hosted specialization reports, ZIP membership and producer sources.
 * Historical expectations are fixed here, not derived from mutable current compiler helpers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripVTControlCharacters } from "node:util";
import { inflateRawSync } from "node:zlib";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

export const hostedSpecializationDirectory = "docs/evidence/hosted-specializations-20261009";
export const hostedSpecializationReceiptSha256 = "8a13545f11d2b3a6c0f85c4303651cb4e2a4a61cdf2049bf934c81e9cdc7ad44";
const revision = "93c60a0487d0b2acc0b6d562cd72a3876738a666";
const run = 37873560469;
const groups = ["c-family", "python", "rust", "dotnet", "jvm", "ruby", "php-native", "wit-wasi", "perl-5.36.3-threaded", "perl-5.36.3-unthreaded", "perl-5.38.2-threaded", "perl-5.38.2-unthreaded"];
const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", ruby: "rb", perl: "pl", "php-native": "php", "wit-wasi": "c" };
const markers = { c: "  for (unsigned long i", cpp: "  for (unsigned i", python: "for i in range(1000):", rust: "    for i in 0..1000u64", dotnet: "        for (int i", java: "        for (long i", kotlin: "    for (i in 0L", ruby: "1000.times do", perl: "for my $i (0 .. 999)", "php-native": "for ($i = 0;", "wit-wasi": "  for (uint64_t i" };
const counts = {
	functions: { c: 2016, cpp: 2011, python: 2020, rust: 2011, dotnet: 2030, java: 2070, kotlin: 2036, ruby: 2020, perl: 2019, "php-native": 2020, "wit-wasi": 2021 }
	, records: { c: 1013, cpp: 1012, python: 1019, rust: 1013, dotnet: 1018, java: 1018, kotlin: 1015, ruby: 1021, perl: 1025, "php-native": 1021, "wit-wasi": 1019 }
	, specialized: { c: 1029, cpp: 1024, python: 1036, rust: 1025, dotnet: 1034, java: 1034, kotlin: 1030, ruby: 1036, perl: 1040, "php-native": 1035, "wit-wasi": 1036 }
};
const testNames = {
	functions: "relocated source-free native packages install concrete specializations without the generic declaration"
	, records: "relocated source-free native packages construct and project alias-named generic records"
	, specialized: "relocated source-free native packages construct specialized generic records in two namespaces and Option/List aliases"
};
const functions = ["echoWord", "echoText", "echoNat", "echoWords", "chooseWord", "chooseText", "chooseWords", "firstTextWord", "doubleWord", "doubleNat", "plain"].map(name => `Specialized.${name}`);
const primitive = name => ({ kind: "primitive", name });
const named = id => ({ kind: "named", id });
const instantiations = {
	WordPair: { structure: "Pair", arguments: [primitive("string"), primitive("nat")] }
	, NatBox: { structure: "Box", arguments: [primitive("nat")] }
	, TextBox: { structure: "Box", arguments: [primitive("string")] }
	, NatBoxAgain: { structure: "Box", arguments: [primitive("nat")] }
	, MaybeBox: { structure: "Box", arguments: [{ kind: "apply", constructor: "option", arguments: [primitive("nat")] }] }
	, BoxPair: { structure: "Pair", arguments: [named("NatBox"), named("TextBox")] }
	, TaggedNat: { structure: "Tagged", arguments: [primitive("string"), primitive("nat")] }
	, MarkerTag: { structure: "Tag", arguments: [named("Marker")], fields: 1 }
};
const specializations = Object.entries({ echoNatBox: "NatBox", echoAgain: "NatBoxAgain", echoTextBox: "TextBox", echoLeft: "Left.LeftBox", echoRight: "Right.RightBox", echoBoxes: "Boxes", echoOptionalBoxes: "OptionalBoxes", echoNats: "Nats", echoOptionalNat: "OptionalNat" })
	.map(([name, type]) => ({ name: `GenericRecords.${name}`, declaration: "GenericRecords.echo", types: [`GenericRecords.${type}`] }));
const kindOf = member => member.startsWith("native-specializations/") ? "functions" : member.includes("/specialized-") ? "specialized" : "records";
const profilesOf = group => group === "c-family" ? ["c", "cpp"] : group === "jvm" ? ["java", "kotlin"] : [group.startsWith("perl-") ? "perl" : group];

const crcTable = Array.from({ length: 256 }, (_, value) => {
	for(let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
	return value >>> 0;
});
const crc32 = bytes => {
	let crc = 0xffffffff;
	for(const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
	return (crc ^ 0xffffffff) >>> 0;
};

/**
 * Inspect selected members of an authenticated GitHub ZIP. Nothing is extracted or executed.
 * The caller authenticates the entire archive and selection against the fixed receipt first.
 *
 * @param bytes - Original ZIP bytes.
 * @param selected - Exact report names from the pinned capture.
 */
const membersOf = (bytes, selected) => {
	assert.ok(bytes.length > 22 && bytes.length < 8 * 1024 ** 2);
	assert.equal(new Set(selected).size, selected.length);
	const end = bytes.length - 22;
	assert.equal(bytes.readUInt32LE(end), 0x06054b50); assert.equal(bytes.readUInt32LE(end + 4), 0);
	assert.equal(bytes.readUInt16LE(end + 20), 0);
	const count = bytes.readUInt16LE(end + 8), centralStart = bytes.readUInt32LE(end + 16);
	assert.ok(count > 0 && count < 256); assert.equal(bytes.readUInt16LE(end + 10), count);
	assert.equal(centralStart + bytes.readUInt32LE(end + 12), end);
	let central = centralStart, local = 0;
	const paths = new Set(), found = new Map();
	for(let index = 0; index < count; index++)
	{
		assert.ok(central + 46 <= end && local + 30 <= centralStart);
		assert.equal(bytes.readUInt32LE(central), 0x02014b50);
		assert.equal(bytes.readUInt16LE(central + 6), 20);
		assert.equal(bytes.readUInt16LE(central + 8), 8); assert.equal(bytes.readUInt16LE(central + 10), 8);
		assert.equal(bytes.readUInt32LE(central + 30), 0); assert.equal(bytes.readUInt32LE(central + 34), 0);
		assert.equal(bytes.readUInt32LE(central + 42), local);
		const nameSize = bytes.readUInt16LE(central + 28), packed = bytes.readUInt32LE(central + 20), size = bytes.readUInt32LE(central + 24);
		assert.ok(central + 46 + nameSize <= end);
		const nameBytes = bytes.subarray(central + 46, central + 46 + nameSize), name = nameBytes.toString("utf8");
		assert.deepEqual(Buffer.from(name), nameBytes); assert.match(name, /^[A-Za-z0-9_.+/-]+$/u);
		assert.ok(!name.startsWith("/") && !name.split("/").some(part => ["", ".", ".."].includes(part)) && !paths.has(name)); paths.add(name);
		assert.equal(bytes.readUInt32LE(local), 0x04034b50);
		assert.deepEqual(bytes.subarray(local + 4, local + 14), bytes.subarray(central + 6, central + 16));
		assert.deepEqual(bytes.subarray(local + 14, local + 26), Buffer.alloc(12));
		assert.equal(bytes.readUInt16LE(local + 26), nameSize); assert.equal(bytes.readUInt16LE(local + 28), 0);
		assert.deepEqual(bytes.subarray(local + 30, local + 30 + nameSize), nameBytes);
		const start = local + 30 + nameSize, descriptorStart = start + packed;
		assert.ok(descriptorStart + 16 <= centralStart);
		assert.equal(bytes.readUInt32LE(descriptorStart), 0x08074b50);
		assert.deepEqual(bytes.subarray(descriptorStart + 4, descriptorStart + 16), bytes.subarray(central + 16, central + 28));
		if(selected.includes(name))
		{
			assert.ok(size > 0 && size < 65536);
			const source = inflateRawSync(bytes.subarray(start, descriptorStart), { maxOutputLength: size });
			assert.equal(source.length, size); assert.equal(crc32(source), bytes.readUInt32LE(central + 16)); found.set(name, source);
		}
		local = descriptorStart + 16; central += 46 + nameSize;
	}
	assert.equal(local, centralStart); assert.equal(central, end);
	assert.deepEqual([...found.keys()].sort(), [...selected].sort());
	return found;
};
/** The same strict GitHub artifact ZIP reader, for other hosted archives. */
export { membersOf as strictArtifactZipMembers };

/**
 * Check one report's semantics against fixed historical contracts and retained consumer sources.
 *
 * @param data - Parsed report file.
 * @param group - Hosted job group.
 * @param member - Selected artifact member.
 * @param source - Reads authenticated historical source, never executing it.
 */
export const assertHostedSpecializationReport = (data, group, member, source) => {
	assert.ok(groups.includes(group));
	const kind = kindOf(member);
	assert.equal(data.schemaVersion, 1); assert.equal(data.reproducible, true);
	assert.deepEqual(data.reports.map(report => report.profile), profilesOf(group));
	const archives = {};
	for(const report of data.reports)
	{
		const profile = report.profile, extension = extensions[profile];
		assert.deepEqual([report.path, report.checks], ["ordinary-source", counts[kind][profile]]);
		for(const key of ["sourceRemovedBeforeInstallation", "compilerFreePath", "offlineInstall"]) assert.equal(report[key], true, key);
		for(const key of ["sourceTreeSha256", "modelSha256", "bindingIrSha256", "receiptSha256"]) assert.match(report[key], /^[a-f0-9]{64}$/u);
		let consumer = source(`tests/fixtures/${kind === "functions" ? "specialization-consumers" : "generic-record-consumers"}/${profile}.${extension}`);
		if(kind === "specialized")
		{
			const fragment = source(`tests/fixtures/generic-record-specialization-consumers/${profile}.${extension}`);
			assert.equal(consumer.split(markers[profile]).length, 2);
			consumer = consumer.replace(markers[profile], `${fragment}\n${markers[profile]}`);
			assert.deepEqual(report.specializations, specializations);
		}
		assert.equal(report.consumerSha256, sha256(consumer), `${group}/${member}/${profile} consumer`);
		if(kind === "functions") assert.deepEqual(report.exports, functions);
		else assert.deepEqual(report.instantiations, instantiations);
		assert.ok(report.packages.length > 0);
		for(const pkg of report.packages) for(const artifact of pkg.artifacts)
		{
			assert.match(artifact.sha256, /^[a-f0-9]{64}$/u); assert.ok(artifact.bytes > 0);
			if(Object.hasOwn(archives, artifact.path)) assert.equal(archives[artifact.path], artifact.sha256);
			archives[artifact.path] = artifact.sha256;
		}
		if(kind !== "functions" && ["rust", "dotnet", "java", "kotlin"].includes(profile))
		{
			const checked = report.rustTypes ?? report.managedTypes;
			assert.equal(checked.repeatExecutionAfterTypeRejection, true);
			const extra = profile === "rust" ? ["specialized-list", "specialized-option"] : ["specialized-field", "specialized-missing"];
			assert.deepEqual(checked.rejected.map(item => item.case), ["alias", "field", "missing", ...kind === "specialized" ? ["namespace", ...extra] : []]);
			for(const rejection of checked.rejected)
			{
				assert.match(rejection.sourceSha256, /^[a-f0-9]{64}$/u); assert.ok(rejection.diagnostics.length > 0);
				for(const diagnostic of rejection.diagnostics)
				{
					assert.equal(diagnostic.file, `invalid-${rejection.case}.${extension}`);
					assert.ok(diagnostic.line > 0 && diagnostic.column > 0);
				}
			}
			if(profile !== "rust")
			{
				assert.equal(checked.positiveCompiles, true); assert.equal(checked.artifactUnchanged, true);
				for(const key of ["artifactSha256", "positiveSourceSha256"]) assert.match(checked[key], /^[a-f0-9]{64}$/u);
			}
		}
	}
	assert.deepEqual(data.archives, archives);
};

/**
 * Require completed selected tests even when a later C-family test caused job cancellation.
 *
 * @param group - Captured job descriptor.
 * @param job - Original GitHub job response.
 * @param artifact - Original GitHub artifact response.
 * @param log - Original job log.
 */
export const assertHostedSpecializationJob = (group, job, artifact, log) => {
	assert.ok(groups.includes(group.name));
	assert.deepEqual([job.id, job.run_id, job.head_sha, job.status, job.conclusion], [group.job, run, revision, "completed", group.name === "c-family" ? "cancelled" : "success"]);
	assert.deepEqual(job.labels, ["ubuntu-24.04"]);
	assert.deepEqual([artifact.id, artifact.workflow_run.id, artifact.workflow_run.head_sha, artifact.name, artifact.digest, artifact.size_in_bytes]
		, [group.artifact, run, revision, `type-corpus-${group.name}-${revision}`, `sha256:${group.sha256}`, group.bytes]);
	const clean = stripVTControlCharacters(log).replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /gmu, "");
	if(group.name === "python")
	{
		// Setup order is insufficient: the compare step explicitly selects 3.11, then overrides it for 3.12.
		const ordinary = "LEAN_BRIDGE_GENERIC_RECORD_PROFILES=python node --test --test-name-pattern='relocated source-free native packages construct' tests/generic-records.test.mjs";
		const headers = [...clean.matchAll(/^##\[group\]Run [^\n]*\n([\s\S]*?)^##\[endgroup\]$/gmu)].map(match => match[1]);
		const selected = headers.filter(header => header.split("\n").includes(ordinary));
		assert.equal(selected.length, 1, "one Python compare step");
		const lines = selected[0].split("\n");
		assert.ok(lines.includes("  LEAN_BRIDGE_PYTHON: /opt/hostedtoolcache/Python/3.11.17/x64/bin/python"), "Python 3.11 compare-step environment");
		assert.ok(lines.includes("LEAN_BRIDGE_SPECIALIZATION_PROFILES=python node --test tests/native-specializations.test.mjs"), "function selection uses the step interpreter");
		assert.ok(lines.includes(`LEAN_BRIDGE_PYTHON="/opt/hostedtoolcache/Python/3.12.15/x64/bin/python" LEAN_BRIDGE_GENERIC_RECORD_REPORT=build/generic-records/python312.json LEAN_BRIDGE_GENERIC_RECORD_SPECIALIZED_REPORT=build/generic-records/specialized-python312.json ${ordinary}`), "Python 3.12 command selects both python312 reports");
		assert.doesNotMatch(selected[0], /^ {2}LEAN_BRIDGE_GENERIC_RECORD_(?:SPECIALIZED_)?REPORT:/mu, "no step-level report override changes the default 3.11 report paths");
	}
	for(const kind of Object.keys(testNames))
	{
		const passes = [...clean.matchAll(new RegExp(`^ok \\d+ - ${testNames[kind]}$`, "gmu"))];
		assert.equal(passes.length, group.name === "python" && kind !== "functions" ? 2 : 1, `${group.name} ${kind} unskipped executions`);
		for(const pass of passes)
		{
			const start = clean.lastIndexOf("TAP version 13\n", pass.index), end = clean.indexOf("# duration_ms ", pass.index);
			assert.ok(start >= 0 && end > pass.index);
			const tap = clean.slice(start, end);
			assert.doesNotMatch(tap, /^not ok /mu);
			for(const field of ["fail", "cancelled", "todo"]) assert.match(tap, new RegExp(`^# ${field} 0$`, "mu"));
		}
	}
	for(const report of group.reports) assert.ok(clean.includes(`test -s build/${report.member}`));
	if(group.name.startsWith("perl-")) assert.ok(clean.includes(`Perl ${group.name.slice(5)}`));
};

/**
 * Authenticate the complete immutable archive before using any paths or retained report claims.
 *
 * @param receipt - Parsed archive receipt.
 * @param read - Archive byte reader, injectable for corruption controls.
 */
export const assertHostedSpecializationArchive = async (receipt, read = readFile) => {
	assert.equal(sha256(canonicalJson(receipt)), hostedSpecializationReceiptSha256, "fixed archive receipt before any file read");
	const files = new Map();
	for(const file of receipt.files)
	{
		const bytes = await read(file.path);
		assert.ok(Buffer.isBuffer(bytes)); assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
		assert.ok(!files.has(file.path)); files.set(file.path, bytes);
	}
	const root = hostedSpecializationDirectory, captureBytes = files.get(`${root}/capture.json`), capture = JSON.parse(captureBytes);
	assert.equal(sha256(captureBytes), receipt.captureSha256);
	assert.deepEqual([capture.revision, capture.run], [revision, run]);
	assert.deepEqual(capture.captures.map(item => item.name), groups);
	const source = path => files.get(`${root}/sources/${path}.txt`).toString("utf8");
	let reports = 0, observations = 0;
	for(const group of capture.captures)
	{
		const path = `${root}/${group.name}`, zip = files.get(`${path}/artifact.zip`), log = files.get(`${path}/job.log`);
		assert.equal(zip.length, group.bytes); assert.equal(sha256(zip), group.sha256); assert.equal(sha256(log), group.logSha256);
		assertHostedSpecializationJob(group, JSON.parse(files.get(`${path}/job.json`)), JSON.parse(files.get(`${path}/artifact.json`)), log.toString("utf8"));
		const members = membersOf(zip, group.reports.map(item => item.member));
		for(const member of group.reports)
		{
			const bytes = files.get(`${path}/${member.member}`);
			assert.equal(bytes.length, member.bytes); assert.equal(sha256(bytes), member.sha256);
			assert.ok(bytes.equals(members.get(member.member)), "report bytes equal their original ZIP member");
			const data = JSON.parse(bytes);
			assertHostedSpecializationReport(data, group.name, member.member, source);
			reports++; observations += data.reports.length;
		}
	}
	assert.equal(reports, 38); assert.equal(observations, 44);
	assert.equal(receipt.files.filter(file => file.originalPath.startsWith(`git:${revision}:`)).length, 58);
	return { reports, observations, groups: capture.captures.length, sources: 58 };
};
