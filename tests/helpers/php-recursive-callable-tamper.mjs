/**
 * Reject every altered PHP native asset before loading Lean, on separate copies.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { cp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '../../src/capsule/node.mjs';
import { nativeArtifactPaths, verifyNativeFiles } from '../../src/build/native-artifacts.mjs';
import { withCorruptedNativeAsset } from './native-asset-tamper.mjs';
import { runCopied } from './copied-fixture-install.mjs';
import { saveLakeFile } from './lake-workspace.mjs';

export const phpRecursiveTamperSource = `<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
try { \\LeanStructured\\make_recursive(new \\LeanStructured\\TreeLeaf(\\Brick\\Math\\BigInteger::of(7))); }
catch(RuntimeException $error) {
    if(!str_contains($error->getMessage(),'Native library differs from compiled evidence'))throw $error;
    if(preg_match('~/liblean(?:shared|_bridge_native)\\.so(?: \\(deleted\\))?$~m',file_get_contents('/proc/self/maps')))throw new RuntimeException('Mapped before rejection');
    echo "rejected-before-native-loading\\n";exit;
}
throw new RuntimeException('Native tamper accepted');
`;

/**
 * Alter only copied deployment assets and verify original installed bytes afterward.
 *
 * @param options - Original deployment, receipt, tools and a separate workspace.
 * @param options.root - Task-owned tamper workspace.
 * @param options.installed - Original unchanged Composer deployment.
 * @param options.php - Verified installed PHP evidence.
 * @param options.environment - Explicit PHP executable.
 */
export const checkPhpRecursiveTamper = async ({ root, installed, php, environment }) => {
	await verifyNativeFiles(installed, php.deployment);
	const cases = [];
	for(const [path, identity] of Object.entries(php.packageReceipt.files).filter(([path]) => path.startsWith('native/linux-x64/')))
	{
		const work = join(root, String(cases.length));
		try
		{
			await cp(join(installed, 'vendor'), join(work, 'vendor'), { recursive: true });
			await saveLakeFile(work, 'probe.php', phpRecursiveTamperSource);
			const target = join(work, 'vendor/lean-bridge/structured', path);
			const result = await withCorruptedNativeAsset(target, () => runCopied(environment.LEAN_BRIDGE_PHP, [...php.runtimeOptions, 'probe.php'], work));
			assert.equal(result.stderr, ''); assert.equal(result.stdout, 'rejected-before-native-loading\n');
			assert.equal(sha256(await readFile(target)), identity.sha256);
			cases.push({ path, sha256: identity.sha256, rejectedBeforeMapping: true, separateCopy: true });
		} finally
		{ await rm(work, { recursive: true, force: true }); }
	}
	assert.equal(cases.length, 4);
	assert.deepEqual((await nativeArtifactPaths(installed)).sort(), Object.keys(php.deployment).sort());
	await verifyNativeFiles(installed, php.deployment);
	return { sourceSha256: sha256(phpRecursiveTamperSource), originalPackagesUnchanged: true, cases };
};
