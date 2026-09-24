/**
 * Preserve original receipts across the read-only native tamper-probe repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertTestManifestRegistration } from "./source-registration-upgrade.mjs";
import { beforeNumericTestFlags } from "./source-registration-flags.mjs";

const receiptPath = "docs/evidence/native-asset-tamper-20260923.json";
const documentationPath = "tests/helpers/perl-graph-documentation.mjs";
const registrationPath = "tests/helpers/source-registration-history.mjs";
const integrationImport = 'import { assertNativeAssetTamperSourceUpdate } from "./native-asset-tamper-history.mjs";\n';
const integrationCall = '\tif(await assertNativeAssetTamperSourceUpdate(path, source, expected)) return true;\n';
const currentProbe = `				const target = join(lib, path);
				await withCorruptedNativeAsset(target, async () => {
					const result = await runCopied(perl, ["tamper.pl", target], caller, env);
					assert.equal(result.stderr, ""); assert.equal(result.stdout, "rejected before dlopen\\n");
				});`;
const previousProbe = `				const target = join(lib, path), original = await readFile(target), corrupt = Buffer.from(original);
				corrupt[corrupt.length - 1] ^= 1;
				try
				{
					await saveLakeFile(dirname(target), target.split("/").at(-1), corrupt);
					const result = await runCopied(perl, ["tamper.pl", target], caller, env);
					assert.equal(result.stderr, ""); assert.equal(result.stdout, "rejected before dlopen\\n");
				}
				finally
				{
					await saveLakeFile(dirname(target), target.split("/").at(-1), original);
				}`;
const installerRecord = path => path.endsWith("/.packlist") || path.endsWith("/perllocal.pod");
const comparable = report => ({ ...report, observations: report.observations.map(run => ({ ...run
	, installs: run.installs.map(item => ({ ...item
		, installedFiles: Object.fromEntries(Object.entries(item.installedFiles).filter(([path]) => !installerRecord(path))) })) })) });

/**
 * Check the non-root reproduction and unchanged original installed packages.
 * No package source, archive identity, native byte or public result is waived.
 */
export const assertNativeAssetTamperRepair = async () => {
	const record = JSON.parse(await readFile(receiptPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), [
		"docs/consume/perl.md", "docs/publish/cpan.md"
		, "tests/helpers/lake-workspace.mjs"
		, "tests/helpers/native-asset-tamper-history.mjs"
		, "tests/helpers/native-asset-tamper.mjs", documentationPath, registrationPath
		, "tests/helpers/source-registration-upgrade.mjs"
		, "tests/native-asset-tamper.test.mjs"
	].sort());
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(beforeNumericTestFlags(path, await readFile(path, "utf8"))), hash, path);
	assert.deepEqual(Object.keys(record.baselines).sort(), ["packages", "regressions"]);
	const baselines = {};
	for(const [name, entry] of Object.entries(record.baselines))
	{
		assert.equal(entry.path, `docs/evidence/perl-recursive-${name}-20260923.json`);
		const bytes = await readFile(entry.path); assert.equal(sha256(bytes), entry.sha256);
		baselines[name] = JSON.parse(bytes);
	}
	for(const log of Object.values(record.logs))
	{
		assert.equal(sha256(log.text), log.sha256);
		assert.match(log.text, /# pass 1\n# fail 0\n# cancelled 0\n# skipped 0/);
	}
	assert.match(record.logs.unprivileged.text, /ok 1 - native tamper probes restore read-only bytes and permissions without root/);
	assert.match(record.logs.documentation.text, /ok 1 - recursive Perl documentation builds original archives and rejects installed native tampering/);
	const previous = baselines.packages.reports.documentation, current = record.documentation;
	assert.deepEqual(comparable(current), comparable(previous));
	assert.deepEqual(current.observations.map(run => run.reviewed), [false, true]);
	for(const [index, run] of current.observations.entries())
	{
		assert.equal(run.installs.length, 4);
		for(const [slot, item] of run.installs.entries())
		{
			const prior = previous.observations[index].installs[slot];
			assert.deepEqual(Object.keys(item.installedFiles), Object.keys(prior.installedFiles));
			const bookkeeping = Object.keys(item.installedFiles).filter(installerRecord);
			assert.equal(bookkeeping.length, 3);
			for(const path of bookkeeping)
			{
				assert.match(item.installedFiles[path].sha256, /^[a-f0-9]{64}$/);
				assert.ok(Number.isSafeInteger(item.installedFiles[path].bytes) && item.installedFiles[path].bytes > 0);
			}
		}
	}
	return { record, baselines };
};

/**
 * Reverse only the measured harness fix and its two-line verifier integration.
 *
 * @param path - Source recorded in an immutable historical receipt.
 * @param source - Complete current source text.
 * @param expected - Original source digest, never rewritten.
 */
export const assertNativeAssetTamperSourceUpdate = async (path, source, expected) => {
	if(![documentationPath, registrationPath].includes(path)) return false;
	source = beforeNumericTestFlags(path, source);
	const { record } = await assertNativeAssetTamperRepair();
	assert.equal(sha256(source), record.sourceHashes[path], path);
	const changes = path === registrationPath ? [[integrationImport, ""], [integrationCall, ""]] : [
		['import { join } from "node:path";\n', 'import { dirname, join } from "node:path";\n']
		, ['import { withCorruptedNativeAsset } from "./native-asset-tamper.mjs";\n', ""]
		, [currentProbe, previousProbe]
	];
	for(const [current, previous] of changes)
	{
		assert.equal(source.split(current).length, 2, "Exactly one native tamper-probe repair");
		source = source.replace(current, previous);
	}
	if(path === registrationPath && sha256(source) !== expected)
		assert.equal(await assertTestManifestRegistration(path, source, expected), true);
	else assert.equal(sha256(source), expected, path);
	return true;
};
