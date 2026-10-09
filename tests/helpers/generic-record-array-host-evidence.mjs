/**
 * Preserve the remaining native Array generic-record runs, including the failed first Perl attempt.
 * Queue and runner-output identities anchor every source, terminal record, TAP and report.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";

export const arrayHostDirectory = "docs/evidence/generic-record-array-hosts-20261009";
export const arrayHostAttempts = Object.freeze([
	{ id: "hosts-c92090f", revision: "c92090ffdaa6b309da918b254e7be560f787b33e"
		, queueSha256: "c0b1337a434621647af8dd325c9105bd3742231755d4daa6ab76c3b61c0c1a2b"
		, outputSha256: "182058d3b3220c22a9df5a4b0d9143a20aa1cd505521d42768876e3c2fd14cf0"
		, passed: ["rust", "ruby", "dotnet", "java-kotlin", "php-native", "wit-wasi"]
		, failed: ["perl-5.36.3-threaded"]
		, notRun: ["perl-5.36.3-unthreaded", "perl-5.38.2-threaded", "perl-5.38.2-unthreaded"] }
	, { id: "perl-4c54801", revision: "4c54801968fb1bc2a8a87e4570d0ce033ba99bb6"
		, queueSha256: "d0f0fb8997e2d0ad1d2892a89138b46c8b3b560ac512e601aa89dedd0aa203f4"
		, outputSha256: "9c39c26c8d6ce3158f207563b5288c4aa978ffbabfebe360ac682cf776593797"
		, passed: ["perl-5.36.3-threaded", "perl-5.36.3-unthreaded", "perl-5.38.2-threaded", "perl-5.38.2-unthreaded"]
		, failed: [], notRun: [] }
]);
const expected = {
	rust: [2034, 1025, "rs", "    for i in 0..1000u64"]
	, ruby: [2141, 1036, "rb", "1000.times do"]
	, dotnet: [2088, 1034, "cs", "        for (int i"]
	, java: [2105, 1034, "java", "        for (long i"]
	, kotlin: [2067, 1030, "kt", "    for (i in 0L"]
	, "php-native": [2124, 1035, "php", "for ($i = 0;"]
	, "wit-wasi": [2091, 1036, "c", "  for (uint64_t i"]
	, perl: [2145, 1040, "pl", "for my $i (0 .. 999)"] };
const title = "relocated source-free native packages carry Array fields and results over alias-named generic records";
const failedTap = "f8a9b2bda04ce635d192d0a54c4d553ee9b6d39f76ecb985eefb4714f1d253f6";
const aliases = ["NatBox", "NatBoxAgain", "TextBox", "Left.LeftBox", "Right.RightBox", "Boxes", "OptionalBoxes", "Nats", "OptionalNat"];
const exportNames = ["echoNatBox", "echoAgain", "echoTextBox", "echoLeft", "echoRight", "echoBoxes", "echoOptionalBoxes", "echoNats", "echoOptionalNat"];
const caseCounts = { rust: 8, ruby: 10, dotnet: 9, java: 9, kotlin: 9, "php-native": 9, "wit-wasi": 8, perl: 9 };
const array = value => ({ kind: "apply", constructor: "array", arguments: [value] });

/**
 * Rebuild the original specialization and Array consumers from their own pinned source files.
 *
 * @param profile - One of the eight remaining native profiles.
 * @param text - Source snapshot reader, indexed by repository-relative path.
 */
export const composeArrayHostConsumer = (profile, text) => {
	assert.ok(Object.hasOwn(expected, profile));
	const [, , extension, marker] = expected[profile];
	let source = text(`tests/fixtures/generic-record-consumers/${profile}.${extension}`), base;
	for(const kind of ["specialization", "array"])
	{
		const fragment = text(`tests/fixtures/generic-record-${kind}-consumers/${profile}.${extension}`);
		assert.equal(typeof source, "string"); assert.equal(typeof fragment, "string");
		assert.equal(source.split(marker).length, 2);
		assert.ok(!fragment.includes(marker));
		source = source.replace(marker, () => `${fragment}\n${marker}`);
		if(kind === "specialization") base = source;
	}
	return { source, base };
};

/**
 * Validate semantic acceptance independently of the report byte identities.
 *
 * @param report - One original installed report.
 * @param selection - Its exact queue selection.
 * @param queue - Authenticated producer queue.
 * @param text - Reader of that producer's pinned source files.
 */
export const assertArrayHostReport = (report, selection, queue, text) => {
	assert.deepEqual([report.schemaVersion, report.profiles, report.reproducible, report.authorRoots], [1, selection.profiles, true, 2]);
	assert.deepEqual(report.reports.map(item => item.profile), selection.profiles);
	assert.ok(Object.keys(report.archives).length > 0);
	for(const item of report.reports)
	{
		const [checks, baseChecks] = expected[item.profile], consumer = composeArrayHostConsumer(item.profile, text);
		assert.deepEqual([item.checks, item.expectedChecks, item.baseConsumer.checks], [checks, checks, baseChecks]);
		assert.equal(item.baseConsumer.sha256, sha256(consumer.base));
		assert.equal(item.consumerSha256, sha256(consumer.source));
		assert.deepEqual(queue.expected[item.profile], { consumerSha256: item.consumerSha256, checks });
		assert.equal(item.path, "ordinary-source");
		for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(item[flag], true, flag);
		for(const field of ["bindingIrSha256", "modelSha256", "sourceTreeSha256", "receiptSha256"]) assert.match(item[field], /^[a-f0-9]{64}$/u);
		assert.deepEqual(item.arrayExports, ["pushCount", "rowTotal", "rowOf", "rowBoxSum"].map(name => `GenericRecords.${name}`));
		assert.deepEqual(item.specializations, aliases.map((alias, index) => ({ declaration: "GenericRecords.echo", name: `GenericRecords.${exportNames[index]}`, types: [`GenericRecords.${alias}`] })));
		assert.deepEqual(item.instantiations["lean:GenericRecords.ArrayBox"], { structure: "GenericRecords.Box", arguments: [array({ kind: "primitive", name: "nat" })] });
		assert.deepEqual(item.instantiations["lean:GenericRecords.RowBox"], { structure: "GenericRecords.Box", arguments: [array({ kind: "named", id: "lean:GenericRecords.NatBox" })] });
		assert.ok(Array.isArray(item.cases)); assert.equal(item.cases.length, caseCounts[item.profile]);
		assert.equal(item.cases.at(-1), "1000 Array rounds");
		assert.equal(new Set(item.cases).size, item.cases.length);
		const helper = text("tests/helpers/generic-record-arrays.mjs");
		for(const label of item.cases) assert.ok(helper.includes(JSON.stringify(label)), label);
		for(const pkg of item.packages) for(const artifact of pkg.artifacts) assert.equal(report.archives[artifact.path], artifact.sha256);
	}
	return report.reports.map(item => [item.profile, item.checks]);
};

/**
 * Parse and authenticate the entire immutable run graph. The supplied reader may serve staged bytes.
 *
 * @param read - Reader of repository-relative archive paths.
 */
export const collectArrayHostEvidence = async (read = readFile) => {
	const artifacts = [], summaries = [];
	const take = async (path, originalPath, expectedSha) => {
		const bytes = await read(path);
		assert.ok(Buffer.isBuffer(bytes), path);
		assert.equal(sha256(bytes), expectedSha, path);
		assert.ok(!artifacts.some(item => item.path === path));
		artifacts.push({ path, originalPath, sha256: expectedSha, bytes: bytes.length });
		return bytes;
	};
	for(const attempt of arrayHostAttempts)
	{
		const root = `${arrayHostDirectory}/${attempt.id}`, original = `build/vo1439-generic-record-arrays-${attempt.id}`;
		const queue = JSON.parse(await take(`${root}/queue.json`, `${original}/queue.json`, attempt.queueSha256));
		assert.equal(queue.revision, attempt.revision); assert.equal(queue.stopFloorMiB, 2048);
		assert.deepEqual(queue.command.slice(0, 4), ["/usr/bin/taskset", "-c", "3", "/usr/bin/node"]);
		assert.deepEqual(queue.selections.map(item => item.name), [...attempt.passed, ...attempt.failed, ...attempt.notRun]);
		await take(`${root}/runner.mjs.txt`, `build/run-vo1439-generic-record-arrays-${attempt.id}.mjs`, queue.runnerSha256);
		const stdout = (await take(`${root}/runner-output.txt`, `${original}.runner.log`, attempt.outputSha256)).toString("utf8");
		const records = stdout.split("\n").filter(line => line.startsWith("{")).map(line => JSON.parse(line));
		assert.equal(records[0].revision, attempt.revision); assert.equal(records[0].queued, queue.queuedAt);
		assert.equal(records.length, 1 + attempt.passed.length * 3 + attempt.failed.length * 2);
		const sources = new Map();
		for(const [path, hash] of Object.entries(queue.sources))
			sources.set(path, (await take(`${root}/sources/${path}.txt`, `git:${attempt.revision}:${path}`, hash)).toString("utf8"));
		const text = path => { assert.ok(sources.has(path), `missing source: ${path}`); return sources.get(path); };
		let cursor = 1, lastEnd = queue.queuedAt;
		for(const selection of queue.selections)
		{
			if(attempt.notRun.includes(selection.name))
			{
				assert.ok(!records.some(item => item.selection === selection.name));
				summaries.push({ attempt: attempt.id, selection: selection.name, outcome: "not-run" }); continue;
			}
			const began = records[cursor++], ended = records[cursor++];
			assert.equal(began.selection, selection.name); assert.equal(ended.selection, selection.name);
			const startBytes = await read(`${root}/${selection.name}/start.json`), endBytes = await read(`${root}/${selection.name}/end.json`);
			const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
			assert.deepEqual(start, { startedAt: began.startedAt, pid: began.pid, pgid: began.pid });
			const { selection: ignored, ...expectedEnd } = ended; assert.equal(ignored, selection.name);
			assert.deepEqual(end, expectedEnd);
			for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes]])
				await take(`${root}/${selection.name}/${name}`, `${original}/${selection.name}/${name}`, sha256(bytes));
			assert.ok(Number.isSafeInteger(start.pid) && start.pid > 0);
			assert.ok(Date.parse(start.startedAt) >= Date.parse(lastEnd));
			assert.ok(Date.parse(end.endedAt) > Date.parse(start.startedAt)); lastEnd = end.endedAt;
			assert.deepEqual([end.signal, end.stoppedForDisk], [null, false]); assert.ok(end.minimumFreeMiB >= 2048);
			const tap = (await take(`${root}/${selection.name}/run.tap`, `${original}/${selection.name}/run.tap`, end.tapSha256)).toString("utf8");
			const passed = attempt.passed.includes(selection.name);
			assert.equal(end.code, passed ? 0 : 1);
			for(const line of ["# tests 1", `# pass ${passed ? 1 : 0}`, `# fail ${passed ? 0 : 1}`, "# skipped 0", "# cancelled 0", "# todo 0"])
				assert.ok(tap.split("\n").includes(line), line);
			if(!passed)
			{
				assert.equal(end.tapSha256, failedTap); assert.ok(tap.includes(`not ok 1 - ${title}`));
				summaries.push({ attempt: attempt.id, selection: selection.name, outcome: "failed" }); continue;
			}
			assert.ok(tap.includes(`ok 1 - ${title}`)); assert.doesNotMatch(tap, /^not ok /mu);
			const logged = records[cursor++];
			assert.equal(logged.selection, selection.name); assert.equal(logged.report, selection.report);
			const report = JSON.parse(await take(`${root}/${selection.report}`, `${original}/${selection.report}`, logged.sha256));
			const checks = assertArrayHostReport(report, selection, queue, text);
			assert.deepEqual(checks, logged.checks);
			assert.equal(selection.environment.LEAN_BRIDGE_GENERIC_RECORD_ARRAY_PROFILES, selection.profiles.join(","));
			assert.equal(selection.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
			if(selection.perl)
			{
				const [version, threading] = selection.name.slice(5).split("-");
				assert.ok(["5.36.3", "5.38.2"].includes(version));
				assert.deepEqual(selection.perl, { command: `/app/.toolchains/perl/${version}-${threading}/bin/perl`, version: `v${version}`, useithreads: threading === "threaded" ? "define" : "undef", archname: threading === "threaded" ? "x86_64-linux-thread-multi" : "x86_64-linux" });
				assert.equal(selection.environment.LEAN_BRIDGE_CORPUS_PERL, selection.perl.command);
				assert.equal(selection.environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR, "2.36");
			}
			summaries.push({ attempt: attempt.id, selection: selection.name, outcome: "passed", report: `${root}/${selection.report}`, sha256: logged.sha256, checks });
		}
		assert.equal(cursor, records.length);
		if(queue.supersedes)
		{
			assert.equal(queue.supersedes.revision, arrayHostAttempts[0].revision);
			assert.equal(queue.supersedes.tapSha256, failedTap);
			assert.ok(stdout.endsWith("runner exit 0\n"));
			for(const item of queue.supersedes.unlaunchedRunners)
				await take(`${root}/unlaunched/${basename(item.path)}.txt`, item.path.replace(/^\/app\//u, ""), item.sha256);
		}
	}
	return { schemaVersion: 1
		, kind: "generic-record-array-remaining-native-evidence"
		, scope: { route: "ordinary-source", hosts: Object.keys(expected)
			, localGlibc: "2.36"
			, local: true, hostedCi: false, supportPromotion: false
			, retained: "Original run records and selected Git sources; package archives are identified by report-carried digests only" }
		, attempts: summaries, artifacts };
};

/**
 * Require the exact derived receipt, not claims supplied by the receipt author.
 *
 * @param receipt - Parsed receipt.
 * @param read - Original artifact reader.
 */
export const assertArrayHostArchive = async (receipt, read = readFile) => {
	const actual = await collectArrayHostEvidence(read);
	assert.deepEqual(receipt, actual);
	return actual;
};
