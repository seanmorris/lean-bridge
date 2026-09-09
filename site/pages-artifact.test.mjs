/**
 * Reject stale or substituted Pages files and preserve the exact upload inventory.
 *
 * @file
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { packagePagesArtifact, verifyPagesInventory } from '../scripts/package-pages-artifact.mjs';

const commit = 'a'.repeat(40);

/**
 * Create a small assembled-site fixture and register cleanup with its test owner.
 *
 * @param t - Node test context owning this temporary directory.
 */
async function fixture(t)
{
	const scratch = await mkdtemp(join(tmpdir(), 'lean-pages-archive-'));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const site = join(scratch, 'site');
	const files = { 'index.html': '<h1>Checked</h1>', '.nojekyll': '', 'docs/_.data': 'navigation', 'runtime/core.wasm': 'wasm' };
	const identity = { schemaVersion: 2, commit, sourceState: 'clean', siteBase: '/nested/site/', artifacts: {}, staticFiles: {} };
	for(const [name, content] of Object.entries(files))
	{
		await mkdir(dirname(join(site, name)), { recursive: true });
		await writeFile(join(site, name), content);
		identity[name.endsWith('.wasm') ? 'artifacts' : 'staticFiles'][name] = {
			bytes: Buffer.byteLength(content)
			, sha256: createHash('sha256').update(content).digest('hex')
		};
	}
	const writeIdentity = () => writeFile(join(site, 'build-identity.json'), JSON.stringify(identity));
	await writeIdentity();
	return { scratch, site, output: join(scratch, 'archive'), files, identity, writeIdentity };
}

test('Pages tar preserves hidden and navigation files with deterministic metadata', async t => {
	const input = await fixture(t);
	const first = await packagePagesArtifact({ ...input, commit });
	const second = await packagePagesArtifact({ ...input, commit, output: join(input.scratch, 'second') });
	assert.deepEqual(first, second);
	assert.equal(first.status, 'prepared');
	assert.equal(first.siteBase, '/nested/site/');
	assert.equal(first.files, 5);
	assert.deepEqual(await readdir(input.output), ['artifact.tar', 'pages-artifact.json']);
	const unpacked = join(input.scratch, 'unpacked');
	await mkdir(unpacked);
	execFileSync('tar', ['--extract', '--file', join(input.output, 'artifact.tar'), '--directory', unpacked]);
	assert.equal((await verifyPagesInventory(unpacked, commit)).identitySha256, first.identitySha256);
	for(const [name, content] of Object.entries(input.files)) assert.equal(await readFile(join(unpacked, name), 'utf8'), content);
});

test('modified sources and a different revision fail before an archive is created', async t => {
	const input = await fixture(t);
	await assert.rejects(packagePagesArtifact({ ...input, commit: 'b'.repeat(40) }), /another revision/u);
	input.identity.sourceState = 'modified';
	await input.writeIdentity();
	await assert.rejects(packagePagesArtifact({ ...input, commit }), /clean committed sources/u);
	await assert.rejects(access(input.output), { code: 'ENOENT' });
});

test('changed, extra, and missing files fail closed', async t => {
	for(const failure of ['changed', 'extra', 'missing'])
		await t.test(failure, async t => {
			const input = await fixture(t);
			if(failure === 'changed') await writeFile(join(input.site, 'index.html'), 'changed');
			if(failure === 'extra') await writeFile(join(input.site, '.env'), 'must not upload');
			if(failure === 'missing') await unlink(join(input.site, '.nojekyll'));
			await assert.rejects(packagePagesArtifact({ ...input, commit }), /Changed artifact|Files differ/u);
			await assert.rejects(access(input.output), { code: 'ENOENT' });
		});
});

test('links, overlapping records, and traversal inventory entries are rejected', async t => {
	for(const failure of ['symlink', 'overlap', 'traversal'])
		await t.test(failure, async t => {
			const input = await fixture(t);
			if(failure === 'symlink') await symlink(input.scratch, join(input.site, 'outside'));
			if(failure === 'overlap') input.identity.staticFiles['runtime/core.wasm'] = input.identity.artifacts['runtime/core.wasm'];
			if(failure === 'traversal') input.identity.staticFiles['../outside'] = { bytes: 0, sha256: '0'.repeat(64) };
			await input.writeIdentity();
			await assert.rejects(packagePagesArtifact({ ...input, commit }), /regular files|must not overlap|Files differ/u);
			await assert.rejects(access(input.output), { code: 'ENOENT' });
		});
});

test('archiving cannot overwrite a previous handoff or write inside the public site', async t => {
	const input = await fixture(t);
	for(const output of [input.site, input.scratch, join(input.site, 'archive')])
		await assert.rejects(packagePagesArtifact({ ...input, commit, output }), /separate from the site/u);
	await symlink(input.site, join(input.scratch, 'alias'));
	await assert.rejects(packagePagesArtifact({ ...input, commit, output: join(input.scratch, 'alias/archive') }), /separate from the site/u);
	await mkdir(input.output);
	await writeFile(join(input.output, 'retained'), 'previous');
	await assert.rejects(packagePagesArtifact({ ...input, commit }), { code: 'EEXIST' });
	assert.equal(await readFile(join(input.output, 'retained'), 'utf8'), 'previous');
	await verifyPagesInventory(input.site, commit);
});

test('Pages CI uploads the checked tar and keeps it available for rollback', async () => {
	const workflow = await readFile('.github/workflows/demos-pages.yml', 'utf8');
	const step = workflow.split('      - name: Upload Pages artifact\n')[1].split('\n  deploy:')[0];
	assert.match(workflow, /run: npm run demos:archive/u);
	assert.match(step, /actions\/upload-artifact@v4/u);
	assert.match(step, /name: github-pages/u);
	assert.match(step, /path: build\/pages-artifact\/artifact\.tar/u);
	assert.match(step, /retention-days: 30/u);
	assert.match(step, /if-no-files-found: error/u);
	assert.doesNotMatch(workflow, /actions\/upload-pages-artifact/u);
	assert.match(workflow, /needs: build/u);
	assert.match(workflow, /pages: write\n\s+id-token: write/u);
});
