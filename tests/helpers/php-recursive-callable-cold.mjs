/**
 * Reject malformed recursive callback inputs before FFI or Lean can load.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '../../src/capsule/node.mjs';
import { bundledBrickMath } from '../../src/backends/php/brick-math.mjs';
import { generateCallablePhpGraphPackage } from '../../src/backends/php/callable-graph-package.mjs';
import { nativeRecursiveCallableReviewedIr } from './native-recursive-callable-fixture.mjs';
import { jvmRecursiveMixedFixture } from './jvm-recursive-callable-mixed.mjs';
import { saveLakeFile } from './lake-workspace.mjs';
import { runCopied } from './copied-fixture-install.mjs';

/**
 * Parse both generated packages and execute weak/strict callers with FFI absent.
 *
 * @param directory - Task-owned temporary workspace.
 * @param php - Absolute PHP executable.
 */
export const checkPhpRecursiveCold = async (directory, php) => {
	const script = await readFile('tests/fixtures/structured-callable-consumers/php-recursive-cold.php', 'utf8');
	const reports = [];
	for(const [name, ir] of [['base', nativeRecursiveCallableReviewedIr()], ['mixed', (await jvmRecursiveMixedFixture()).ir]])
	{
		const before = structuredClone(ir), files = generateCallablePhpGraphPackage(ir), root = join(directory, name);
		assert.deepEqual(ir, before); assert.deepEqual(files, generateCallablePhpGraphPackage(ir));
		const manifest = JSON.parse(files['binding-manifest.json']);
		for(const [path, digest] of Object.entries(manifest.filesSha256)) assert.equal(sha256(files[path]), digest, path);
		assert.ok(manifest.exports.includes('LeanStructured\\LeanClosure'));
		for(const text of Object.values(files)) assert.doesNotMatch(text, /afterReturn|suppressRetirement|_jvm_graph_clear/);
		for(const [path, source] of Object.entries({ ...files, ...bundledBrickMath() })) await saveLakeFile(root, path, source);
		const phpFiles = Object.keys(files).filter(path => path.endsWith('.php'));
		for(const path of phpFiles) await runCopied(php, ['-n', '-l', path], root);
		for(const mode of [0, 1])
		{
			const path = 'check-cold-' + mode + '.php';
			await saveLakeFile(root, path, script.replace('declare(strict_types=1);', 'declare(strict_types=' + mode + ');'));
			const result = await runCopied(php, ['-n', '-d', 'ffi.enable=0', path, name], root);
			assert.equal(result.stderr, '');
			const observation = JSON.parse(result.stdout);
			assert.deepEqual(observation, { coldChecks: name === 'base' ? 26 : 31, ffiDisabled: true, ffiLoaded: false, leanLoaded: false });
			reports.push({ name, mode, phpFiles: phpFiles.length, sourceSha256: sha256(script), ...observation });
		}
	}
	return reports;
};
