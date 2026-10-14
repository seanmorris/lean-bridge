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
import { sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { withPhpWasmRecursiveFailureEvidence } from "./php-wasm-recursive-failure-evidence.mjs";
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

test("recursive PHP-Wasm CI uploads failed probe directories unconditionally", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const section = workflow.split("      - name: Upload PHP-Wasm corpus evidence\n")[1].split("      - name:")[0];
	assert.match(section, /^ {8}if: always\(\)\n/u);
	assert.ok(section.includes("            build/recursive-callables/php-wasm-generated-failure-*/\n"));
	assert.ok(section.includes("            build/recursive-callables/php-wasm-generated.json\n"));
});
