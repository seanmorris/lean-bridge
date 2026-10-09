/**
 * Require every native Array selection, its report and failure propagation in recurring CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
