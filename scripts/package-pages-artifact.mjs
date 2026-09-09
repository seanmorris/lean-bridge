/**
 * Package the exact checked static inventory, including .nojekyll, for Pages.
 *
 * @file
 */

import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/**
 * Enumerate regular files without following links into another directory.
 *
 * @param root - Artifact directory.
 * @param prefix - Relative directory within the artifact.
 */
async function listFiles(root, prefix = '')
{
	const files = [];
	for(const entry of await readdir(resolve(root, prefix), { withFileTypes: true }))
	{
		const name = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isDirectory()) files.push(...await listFiles(root, name));
		else if(entry.isFile()) files.push(name);
		else throw new Error(`Pages artifacts require regular files and directories: ${name}`);
	}
	return files.sort();
}

/**
 * Check source identity and every file against the assembler's inventory.
 *
 * @param root - Assembled site, not the source checkout.
 * @param commit - Exact reviewed revision required by the caller.
 */
export async function verifyPagesInventory(root, commit)
{
	assert.match(commit, /^[0-9a-f]{40}$/u, 'Require an exact reviewed commit');
	const files = await listFiles(root);
	const identityBytes = await readFile(resolve(root, 'build-identity.json'));
	const identity = JSON.parse(identityBytes);
	assert.equal(identity.schemaVersion, 2);
	assert.equal(identity.sourceState, 'clean', 'Rebuild from clean committed sources before archiving');
	assert.equal(identity.commit, commit, 'The artifact belongs to another revision');
	const names = [...Object.keys(identity.artifacts), ...Object.keys(identity.staticFiles)];
	assert.equal(new Set(names).size, names.length, 'Inventory entries must not overlap');
	assert.ok(!names.includes('build-identity.json'), 'The identity cannot inventory itself');
	assert.deepEqual(files, [...names, 'build-identity.json'].sort(), 'Files differ from the checked inventory');
	const inventory = { ...identity.artifacts, ...identity.staticFiles };
	for(const name of names)
	{
		const bytes = await readFile(resolve(root, name));
		assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, inventory[name], `Changed artifact: ${name}`);
	}
	return { identity, files, identitySha256: sha256(identityBytes) };
}

/**
 * Check containment on resolved paths, including similarly named siblings.
 *
 * @param child - Possible descendant.
 * @param parent - Directory boundary.
 */
const within = (child, parent) => {
	const path = relative(parent, child);
	return !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`);
};

/**
 * Snapshot verified bytes and emit a deterministic tar in a fresh output directory.
 *
 * @param options - Assembled site, fresh output path, and exact reviewed commit.
 * @param options.site - Assembled static site.
 * @param options.output - Fresh output directory below an existing parent.
 * @param options.commit - Exact reviewed source revision.
 */
export async function packagePagesArtifact({ site, output, commit })
{
	site = await realpath(site);
	output = resolve(output);
	output = resolve(await realpath(dirname(output)), relative(dirname(output), output));
	assert.ok(!within(output, site) && !within(site, output), 'Archive output must be separate from the site');
	const checked = await verifyPagesInventory(site, commit);
	await mkdir(output);
	const staging = await mkdtemp(resolve(output, '.snapshot-'));
	try
	{
		for(const name of checked.files)
		{
			const destination = resolve(staging, name);
			await mkdir(dirname(destination), { recursive: true });
			await writeFile(destination, await readFile(resolve(site, name)));
		}
		const snapshot = await verifyPagesInventory(staging, commit);
		assert.equal(snapshot.identitySha256, checked.identitySha256, 'The site changed while taking its snapshot');
		await execute('tar', [
			'--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner'
			, '--mode=u=rwX,go=rX', '--format=ustar', '--create'
			, '--file', resolve(output, 'artifact.tar'), '--directory', staging, '.'
		], { timeout: 120000, maxBuffer: 1024 * 1024 });
		const archive = await readFile(resolve(output, 'artifact.tar'));
		const report = {
			schemaVersion: 1, kind: 'lean-bridge-pages-archive', status: 'prepared'
			, commit
			, sourceState: checked.identity.sourceState
			, siteBase: checked.identity.siteBase
			, files: checked.files.length, identitySha256: checked.identitySha256
			, archive: { file: 'artifact.tar', bytes: archive.length, sha256: sha256(archive) }
		};
		await writeFile(resolve(output, 'pages-artifact.json'), `${JSON.stringify(report, null, 2)}\n`);
		return report;
	}
	finally
	{ await rm(staging, { recursive: true, force: true }); }
}

if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
	const options = new Map();
	for(let index = 2; index < process.argv.length; index += 2)
	{
		const [name, value] = process.argv.slice(index, index + 2);
		assert.ok(['--site', '--output', '--commit'].includes(name) && !options.has(name)
			&& value && !value.startsWith('--'), 'Use --site DIRECTORY --output NEW_DIRECTORY --commit SHA');
		options.set(name, value);
	}
	const commit = options.get('--commit') ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
	const report = await packagePagesArtifact({
		site: options.get('--site') ?? 'build/github-pages'
		, output: options.get('--output') ?? 'build/pages-artifact'
		, commit
	});
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
