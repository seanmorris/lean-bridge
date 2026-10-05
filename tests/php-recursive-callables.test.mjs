/**
 * Original Composer installs, recursive callback failures and source-free consumers.
 *
 * @file
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../src/capsule/node.mjs';
import { saveLakeFile } from './helpers/lake-workspace.mjs';
import { checkPhpRecursiveCallables } from './helpers/php-recursive-callable-acceptance.mjs';

for(const variant of ['recursive', 'mixed'])
	test(`original ${variant} Composer archives preserve PHP callbacks and owned closures without producer tools`, {
		skip: process.env.LEAN_BRIDGE_PHP_RECURSIVE_CALLABLE_TEST !== '1'
		, timeout: 3_600_000
	}, async t => {
		const root = await mkdtemp(join(tmpdir(), 'lean-bridge-php-' + variant + '-callables-'));
		t.after(() => rm(root, { recursive: true, force: true }));
		const report = await checkPhpRecursiveCallables(root, message => t.diagnostic(message), variant === 'mixed');
		await saveLakeFile('build/recursive-callables', 'php-' + variant + '.json', canonicalJson(report));
	});
