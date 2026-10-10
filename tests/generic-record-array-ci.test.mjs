/**
 * Require every native Array selection, its report and failure propagation in recurring CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertHostedArrayArchive, assertHostedArrayExecution, assertHostedArrayReport, hostedArrayDirectory } from "./helpers/generic-record-array-hosted-evidence.mjs";
import "./helpers/native-specialization-closure-tests.mjs";
import "./helpers/fin-native-hosted-evidence-tests.mjs";

const paths = [".github/workflows/consumer-matrix.yml", ".github/workflows/perl-consumer.yml"];
const selections = [
	["c,cpp", "c-cpp", "type_corpus_c_family"]
	, ["python", "python", "type_corpus_python"]
	, ["python", "python312", "type_corpus_python"]
	, ["rust", "rust", "type_corpus_rust"]
	, ["ruby", "ruby", "type_corpus_ruby"]
	, ["dotnet", "dotnet", "type_corpus_dotnet"]
	, ["java,kotlin", "java-kotlin", "type_corpus_jvm"]
	, ["php-native", "php-native", "type_corpus_php_native"]
	, ["wit-wasi", "wit-wasi", "ordinary_wit"]
	, ["perl", "perl", null]
];
const python312 = '${{ steps.collection_python312.outputs.python-path }}';
const command = (profiles, name) => (name === "python312" ? `LEAN_BRIDGE_PYTHON="${python312}" LEAN_BRIDGE_GENERIC_RECORD_ARRAY_REPORT=build/generic-records/array-python312.json ` : "")
	+ `LEAN_BRIDGE_GENERIC_RECORD_ARRAY_PROFILES=${profiles} node --test --test-concurrency=1 tests/generic-record-arrays.test.mjs`;
const jobOf = (source, text) => source.split(/(?=^ {2}[a-z][a-z0-9-]*:\n)/mu).find(job => job.includes(text));
const stepsOf = source => source.split(/^ {6}- name: /mu).slice(1);

/**
 * Check literal execution, upload and outcome guards independently of historical workflow normalization.
 *
 * @param sources - Consumer and Perl workflow text.
 */
const check = sources => {
	for(const [profiles, name, id] of selections)
	{
		const source = sources[name === "perl" ? 1 : 0], invocation = command(profiles, name);
		const report = `build/generic-records/array-${name}.json`;
		const block = `          ${invocation}\n          test -s ${report}\n`;
		assert.equal(source.split(block).length, 2, `${name}: exactly one real command and mandatory report`);
		const job = jobOf(source, block), steps = stepsOf(job), run = steps.find(step => step.includes(block));
		const matrix = ["php-native", "wit-wasi", "perl"].includes(name) ? null : name === "c-cpp" ? "c-family" : name === "java-kotlin" ? "jvm" : name === "python312" ? "python" : name;
		assert.equal(/^ {8}if: (.+)$/mu.exec(run)?.[1], matrix ? `matrix.profile == '${matrix}'` : undefined, `${name}: execute on the selected route`);
		assert.ok(run.includes(`test -s build/generic-records/specialized-${name}.json\n`), `${name}: preserve the base specialization gate`);
		if(id)
		{
			assert.ok(run.includes(`        id: ${id}\n`), `${name}: correct result step`);
			assert.ok(job.includes(`steps.${id}.outcome`), `${name}: failure affects the consumer result`);
			const recorded = command(profiles, name).replaceAll('"', "'");
			assert.ok(steps.some(step => step.includes("consumer-ci.mjs record") && step.includes(recorded)), `${name}: record the actual command`);
		}
		else
		{
			assert.ok(!run.includes("continue-on-error:"));
			assert.ok(run.startsWith("Compare installed Perl corpus packages with fresh Lean results\n"));
			assert.ok(!/^ {8}if:/mu.test(run));
			for(const floor of ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"])
				assert.ok(job.includes(`          - ${floor}\n`), floor);
			assert.ok(run.includes('export LEAN_BRIDGE_CORPUS_PERL="$PWD/.toolchains/perl/$CORPUS_PERL_CONFIGURATION/bin/perl"'));
			assert.ok(source.includes("needs.perl.result == 'success'"));
		}
		const uploads = steps.filter(step => step.includes(`            ${report}\n`));
		assert.equal(uploads.length, 1, `${name}: upload in its own job`);
		assert.equal(/^ {8}if: (.+)$/mu.exec(uploads[0])?.[1], `always()${matrix ? ` && matrix.profile == '${matrix}'` : ""}`);
		assert.ok(uploads[0].includes("uses: actions/upload-artifact@") && uploads[0].includes("if-no-files-found: error"));
	}
};

test("every native Array selection runs serially, requires its own report and retains failures", async () => {
	check(await Promise.all(paths.map(path => readFile(path, "utf8"))));
});

test("Array CI rejects missing commands, profiles, reports, uploads and swallowed failures", async () => {
	const sources = await Promise.all(paths.map(path => readFile(path, "utf8")));
	for(const [profiles, name] of selections)
	{
		const index = name === "perl" ? 1 : 0, original = sources[index], invocation = command(profiles, name);
		const report = `build/generic-records/array-${name}.json`;
		const mutations = [
			original.replace(`          ${invocation}\n`, "")
			, original.replace(`          ${invocation}\n`, `          ${invocation} || true\n`)
			, original.replace(`          ${invocation}\n`, `          ${invocation.replace(`ARRAY_PROFILES=${profiles}`, "ARRAY_PROFILES=wrong")}\n`)
			, original.replace(`          test -s ${report}\n`, "")
			, original.replace(`            ${report}\n`, "")
		];
		for(const changed of mutations)
		{
			assert.notEqual(changed, original);
			const inputs = [...sources]; inputs[index] = changed;
			assert.throws(() => check(inputs), name);
		}
	}
});

test("Array CI requires the second Python floor and all four Perl configurations", async () => {
	const sources = await Promise.all(paths.map(path => readFile(path, "utf8")));
	const python = sources[0].replace(command("python", "python312"), command("python", "python"));
	assert.throws(() => check([python, sources[1]]));
	const job = jobOf(sources[1], `          ${command("perl", "perl")}\n`);
	for(const floor of ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"])
		assert.throws(() => check([sources[0], sources[1].replace(job, job.replace(`          - ${floor}\n`, ""))]));
});

const hostedReceipt = async () => JSON.parse(await readFile(`${hostedArrayDirectory}/receipt.json`));
const hostedJson = async name => JSON.parse(await readFile(`${hostedArrayDirectory}/${name}`));

test("completed hosted Array rollout authenticates every ZIP, runtime, report and source snapshot", async () => {
	assert.deepEqual(await assertHostedArrayArchive(await hostedReceipt()), {
		groups: 12, arraySelections: 13, arrayObservations: 15
		, genericReports: 39, genericObservations: 45, files: 150
	});
});

test("hosted Array closure refuses forged receipts before reads and corrupt or missing originals", async () => {
	const receipt = await hostedReceipt();
	for(const mutate of [value => { value.revision = "0".repeat(40); }, value => { value.files.pop(); }, value => { value.groups.pop(); }, value => { value.scope.supportPromotion = true; }])
	{
		const changed = structuredClone(receipt); mutate(changed); let reads = 0;
		await assert.rejects(assertHostedArrayArchive(changed, async () => { reads++; return Buffer.alloc(0); }));
		assert.equal(reads, 0);
	}
	for(const suffix of ["c-family.zip", "job-113952963002.log", "python/generic-records/array-python312.json", "perl-5.38.2-unthreaded/generic-records/array-perl.json", "sources/tests/helpers/generic-record-arrays.mjs.txt"])
	{
		const target = `${hostedArrayDirectory}/${suffix}`;
		await assert.rejects(assertHostedArrayArchive(receipt, async path => path === target ? Buffer.from("corrupted original") : readFile(path)));
		await assert.rejects(assertHostedArrayArchive(receipt, async path => {
			if(path === target) throw new Error("missing original");
			return readFile(path);
		}), /missing original/u);
	}
});

test("hosted Array semantic audit rejects lost checks, provenance, isolation and nominal compiler controls", async () => {
	const receipt = await hostedReceipt(), sources = new Map();
	for(const file of receipt.files.filter(file => file.original.startsWith("git:")))
		sources.set(file.original.slice(`git:${receipt.revision}:`.length), await readFile(file.path, "utf8"));
	const source = path => { assert.ok(sources.has(path)); return sources.get(path); };
	for(const group of receipt.groups) for(const file of group.reports.filter(item => item.member.startsWith("generic-records/array-")))
	{
		const name = file.member, data = await hostedJson(`${group.name}/${name}`);
		const base = await hostedJson(`${group.name}/${name.replace("/array-", "/")}`);
		const specialized = await hostedJson(`${group.name}/${name.replace("/array-", "/specialized-")}`);
		const verify = value => assertHostedArrayReport(value, group.name, name, source, base, specialized);
		verify(data);
		const mutations = [
			value => { value.authorRoots = 1; }, value => { value.reproducible = false; }
			, value => { value.reports[0].checks--; }
			, value => { value.reports[0].consumerSha256 = "0".repeat(64); }
			, value => { value.reports[0].sourceRemovedBeforeInstallation = false; }
			, value => { value.reports[0].offlineInstall = false; }
			, value => { value.reports[0].specializations.pop(); }
			, value => { value.reports[0].arrayExports.pop(); }
			, value => { value.reports[0].cases.pop(); }
			, value => { delete value.reports[0].instantiations["lean:GenericRecords.RowBox"]; }
			, value => { value.archives = {}; }
		];
		if(group.name === "python") mutations.push(value => { value.reports[0].python.version = "3.10.0"; });
		if(["rust", "dotnet", "jvm"].includes(group.name)) mutations.push(value => {
			(value.reports[0].rustTypes ?? value.reports[0].managedTypes).rejected[0].diagnostics[0].code = "unrelated-error";
		});
		for(const mutate of mutations)
		{ const changed = structuredClone(data); mutate(changed); assert.throws(() => verify(changed), name); }
	}
});

test("hosted Array execution audit rejects skipped tests, wrong interpreters and failed compare steps", async () => {
	const receipt = await hostedReceipt();
	for(const group of receipt.groups)
	{
		const job = await hostedJson(`job-${group.jobId}.json`), log = await readFile(`${hostedArrayDirectory}/job-${group.jobId}.log`, "utf8");
		assertHostedArrayExecution(group, job, log);
		for(const changed of [log.replace("ok 12 - relocated source-free native packages carry Array fields", "not ok 12 - relocated source-free native packages carry Array fields")
			, log.replaceAll("test -s build/generic-records/array-", "echo build/generic-records/array-")
			, log + "\nLEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36\n"])
			assert.throws(() => assertHostedArrayExecution(group, job, changed));
		const failed = structuredClone(job); failed.conclusion = "failure";
		assert.throws(() => assertHostedArrayExecution(group, failed, log));
		const skipped = structuredClone(job);
		for(const step of skipped.steps) if(step.conclusion === "success") step.conclusion = "skipped";
		assert.throws(() => assertHostedArrayExecution(group, skipped, log));
		if(group.name === "python") assert.throws(() => assertHostedArrayExecution(group, job, log.replaceAll("Python/3.12.15", "Python/3.11.17")));
		if(group.name.startsWith("perl-")) assert.throws(() => assertHostedArrayExecution(group, job, log.replaceAll(`CORPUS_PERL_CONFIGURATION: ${group.name.slice(5)}`, "CORPUS_PERL_CONFIGURATION: wrong")));
	}
});
