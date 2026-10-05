/**
 * Original Maven installs, recursive callable probes and runtime-only consumers.
 *
 * @file
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../src/capsule/node.mjs';
import { saveLakeFile } from './helpers/lake-workspace.mjs';
import { checkJvmRecursiveCallables } from './helpers/jvm-recursive-callable-acceptance.mjs';

for(const variant of ['recursive', 'mixed'])
	test(`original ${variant} Maven archives preserve Java and Kotlin callbacks and owned closures without producer tools`, {
		skip: process.env.LEAN_BRIDGE_JVM_RECURSIVE_CALLABLE_TEST !== '1'
		, timeout: 3_600_000
	}, async t => {
		const root = await mkdtemp(join(tmpdir(), 'lean-bridge-jvm-' + variant + '-callables-'));
		t.after(() => rm(root, { recursive: true, force: true }));
		const diagnostic = message => t.diagnostic(message);
		const report = await checkJvmRecursiveCallables(root, diagnostic, variant === 'mixed');
		await saveLakeFile('build/recursive-callables', 'jvm-' + variant + '.json', canonicalJson(report));
	});
