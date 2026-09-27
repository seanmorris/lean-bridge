/**
 * Reject changed installed native files before loading or reusing owned Perl XS.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Exercise the actual installed module's cold and warm authentication paths.
 *
 * @param options - Test-owned installation and selected interpreter.
 * @param options.consumer - Test-owned consumer directory.
 * @param options.prefix - Relocated installed prefix inside that directory.
 * @param options.perl - Absolute selected Perl interpreter.
 * @param options.owned - The prepared package's owned-native filenames.
 */
export const inspectOwnedPerlInstalledAssets = async ({ consumer, prefix, perl, owned }) => {
	const paths = await nativeArtifactPaths(prefix);
	const locate = suffix => {
		const matches = paths.filter(path => path.endsWith(suffix));
		assert.equal(matches.length, 1, suffix);
		return join(prefix, matches[0]);
	};
	const assets = [locate("/auto/LeanBridge/OwnedProbe/OwnedProbe.so")
		, ...[owned.gmpLibrary, owned.componentLibrary].map(name =>
			locate("/LeanBridge/OwnedProbe/native/" + name))];
	const source = await readFile("tests/fixtures/structured-types/owned-perl-installed-assets.pl", "utf8");
	await saveLakeFile(consumer, "inspect-assets.pl", source);
	const observations = [];
	for(const asset of assets) for(const mode of ["cold", "warm"])
	{
		const original = await readFile(asset), replacement = join(consumer, "changed-native-file");
		await saveLakeFile(consumer, "changed-native-file", Buffer.concat([original, Buffer.from("\ntampered\n")]));
		try
		{
			const result = await runCopied(perl, ["inspect-assets.pl", mode, asset, replacement, ...assets]
				, consumer, { ...copiedCleanEnvironment, PERL5LIB: join(prefix, "lib/perl5") });
			assert.equal(result.stderr, "");
			const observed = JSON.parse(result.stdout);
			assert.equal(observed.mode, mode); assert.equal(observed.brokerIdentities, 0);
			assert.ok(observed.checks >= 7);
			observations.push({ asset: basename(asset), originalSha256: sha256(original), ...observed });
		}
		finally
		{ await saveLakeFile(dirname(asset), basename(asset), original); }
	}
	return { sourceSha256: sha256(source), observations };
};
