/**
 * Exercise successful cleanup and retained original subprocess failures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { withPhpWasmRecursiveFailureEvidence } from "./php-wasm-recursive-failure-evidence.mjs";
import { phpWasmPartitionJob, phpWasmPartitionStep } from "./php-wasm-corpus-partition.mjs";
import "./php-wasm-failure-diagnostics-history-tests.mjs";

const scratch = async t => {
	const parent = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-failure-controls-"));
	t.after(() => rm(parent, { recursive: true }));
	return parent;
};

test("recursive PHP-Wasm diagnostics remove only successful probe scratch", async t => {
	const parent = await scratch(t);
	await writeFile(join(parent, "unrelated"), "preserve");
	const result = await withPhpWasmRecursiveFailureEvidence(async directory => {
		await writeFile(join(directory, "check.php"), "test input");
		return { passed: true };
	}, { parent, diagnostic: () => assert.fail("No failure expected") });
	assert.deepEqual(result, { passed: true });
	assert.deepEqual(await readdir(parent), ["unrelated"]);
	assert.equal(await readFile(join(parent, "unrelated"), "utf8"), "preserve");
});

test("recursive PHP-Wasm diagnostics retain original files and code or signal", async t => {
	const parent = await scratch(t), diagnostics = [];
	for(const [source, code, signal] of [
		["process.exit(7)", 7, null]
		, ["process.kill(process.pid, 'SIGTERM')", null, "SIGTERM"]
	]) {
		let originalError, directory;
		await assert.rejects(withPhpWasmRecursiveFailureEvidence(async root => {
			directory = root;
			await writeFile(join(root, "check.php"), "original failing caller");
			await writeFile(join(root, "probe.so"), Buffer.from([0, 1, 2, 3]));
			try
			{
				await processBuildRunner.capture({
					command: process.execPath, args: ["-e", source], cwd: root
				});
			}
			catch(error)
			{
				originalError = new Error(JSON.stringify(error.details), { cause: error });
				throw originalError;
			}
		}, { parent, diagnostic: message => diagnostics.push(message) }), error => error === originalError);
		assert.equal(await readFile(join(directory, "check.php"), "utf8"), "original failing caller");
		assert.deepEqual(await readFile(join(directory, "probe.so")), Buffer.from([0, 1, 2, 3]));
		const record = JSON.parse(await readFile(join(directory, "failure.json")));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.directory, directory);
		assert.equal(record.error.message, originalError.message);
		assert.equal(record.error.cause.code, "build-command-failed");
		assert.deepEqual(record.error.cause.details, {
			command: process.execPath, args: ["-e", source]
			, exitCode: code, signal, stdout: "", stderr: ""
		});
		assert.equal(record.node.version, process.version);
		assert.equal(record.node.sha256, sha256(await readFile(process.execPath)));
		for(const [path, digest] of Object.entries(record.sources))
			assert.equal(digest, sha256(await readFile(path)));
	}
	assert.equal((await readdir(parent)).length, 2);
	assert.equal(diagnostics.length, 2);
	assert.ok(diagnostics.every(text => text.includes("Original failing PHP-Wasm probe retained")));
});

test("recursive PHP-Wasm diagnostics do not overwrite a prior failure file", async t => {
	const parent = await scratch(t), original = new Error("original probe failure");
	let directory;
	await assert.rejects(withPhpWasmRecursiveFailureEvidence(async root => {
		directory = root;
		await writeFile(join(root, "failure.json"), "preserve original");
		throw original;
	}, { parent }), error => {
		assert.ok(error instanceof AggregateError);
		assert.equal(error.errors[0], original);
		assert.equal(error.errors[1].code, "EEXIST");
		return true;
	});
	assert.equal(await readFile(join(directory, "failure.json"), "utf8"), "preserve original");
});

const assertFailureUpload = workflow => {
	const job = phpWasmPartitionJob(workflow, "php-wasm-corpus");
	const section = phpWasmPartitionStep(job, "Upload PHP-Wasm value corpus evidence");
	assert.match(section, /^ {8}if: always\(\) && matrix\.profile == 'values'$/mu);
	assert.match(section, /^ {8}uses: actions\/upload-artifact@v7$/mu);
	assert.match(section, /^ {10}if-no-files-found: error$/mu);
	assert.ok(section.includes("            build/recursive-callables/php-wasm-generated-failure-*/\n"));
	assert.ok(section.includes("            build/recursive-callables/php-wasm-generated.json\n"));
};

test("recursive PHP-Wasm CI uploads failed probe directories unconditionally", async () => {
	assertFailureUpload(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("recursive PHP-Wasm failure uploads reject missing, ambiguous or success-only collection", async t => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const job = phpWasmPartitionJob(workflow, "php-wasm-corpus");
	const section = phpWasmPartitionStep(job, "Upload PHP-Wasm value corpus evidence");
	const changed = [
		workflow.replace(job, ""), workflow + job
		, workflow.replace(section, "")
		, workflow.replace(section, () => section + section)
		, ...[
			["always()", "success()"]
			, ["always()", "failure()"]
			, ["matrix.profile == 'values'", "matrix.profile == 'refinements'"]
			, ["        if: always() && matrix.profile == 'values'\n", ""]
			, ["            build/recursive-callables/php-wasm-generated-failure-*/\n", ""]
			, ["            build/recursive-callables/php-wasm-generated.json\n", ""]
			, ["uses: actions/upload-artifact@v7", "uses: actions/download-artifact@v5"]
			, ["if-no-files-found: error", "if-no-files-found: ignore"]
		].map(([before, after]) => workflow.replace(section, () => section.replace(before, after)))
	];
	for(const source of changed)
	{ assert.notEqual(source, workflow); assert.throws(() => assertFailureUpload(source)); }
	assert.equal(changed.length, 12); t.diagnostic("Twelve required failure-upload controls");
});

test("recursive PHP-Wasm upload repair retains the original hosted and locally reproduced failure", async () => {
	const root = "docs/evidence/php-wasm-corpus-upload-failure-20261014";
	const indexBytes = await readFile(root + "/index.json");
	assert.equal(sha256(indexBytes), "025c19403fb6dc05d49670b7699882e6dfa3ee49c3cc00c921ce758a279405d5");
	const index = JSON.parse(indexBytes), content = {};
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "php-wasm-value-upload-contract-failure-v1");
	assert.equal(index.revision, "d4dd322f1e61c52a6505fbaa9294ee3d19cc0a33");
	assert.equal(index.runId, 38541149971); assert.equal(index.jobId, 115775933281);
	assert.equal(index.retryPerformed, false); assert.equal(index.installedAcceptance, false);
	assert.deepEqual(index.files.map(file => file.path), [
		"job.json", "job.log.gz", "original-failure-test.mjs"
		, "reproduced.tap", "reproduction.json"
	]);
	for(const file of index.files)
	{
		const bytes = await readFile(root + "/" + file.path);
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256);
		content[file.path] = bytes;
	}
	const job = JSON.parse(content["job.json"]), reproduction = JSON.parse(content["reproduction.json"]);
	assert.equal(job.id, index.jobId); assert.equal(job.run_id, index.runId);
	assert.equal(job.conclusion, "failure"); assert.equal(job.html_url, index.url);
	const logBytes = gunzipSync(content["job.log.gz"], { maxOutputLength: 32 * 1024 * 1024 });
	assert.equal(sha256(logBytes), index.logSha256);
	const log = logBytes.toString();
	assert.ok(log.includes("not ok 13 - recursive PHP-Wasm CI uploads failed probe directories unconditionally"));
	assert.ok(log.includes("Cannot read properties of undefined (reading 'split')"));
	assert.ok(log.includes("ok 14 - generated recursive Zend callables execute in actual wasm32 PHP with allocation-failure cleanup"));
	assert.ok(log.includes("No files were found with the provided path: build/owned-wasm32/owned-scalars.json"));
	assert.equal(reproduction.expectedFailure, true); assert.equal(reproduction.code, 1);
	assert.equal(reproduction.signal, null);
	assert.equal(reproduction.sourceSha256, sha256(content["original-failure-test.mjs"]));
	assert.equal(reproduction.tapSha256, sha256(content["reproduced.tap"]));
	const tap = content["reproduced.tap"].toString();
	for(const [key, value] of Object.entries({ tests: 1, pass: 0, fail: 1, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(tap, new RegExp(`^# ${key} ${value}$`, "mu"));
	assert.ok(tap.includes("Cannot read properties of undefined (reading 'split')"));
});
