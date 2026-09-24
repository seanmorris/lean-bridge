/**
 * Compare repeated installed C# runs without weakening package identity checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const families = ["aliases", "callables", "collections", "compounds", "lists", "variants"];
const normalizeConsumer = inventory => {
	if(!inventory) return;
	for(const name of ["Consumer.dll", "Consumer.pdb"])
	{
		if(!Object.hasOwn(inventory, name)) continue;
		const file = inventory[name];
		assert.match(file.sha256, /^[a-f0-9]{64}$/);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		// The downstream test application is not a shipped package assembly.
		// Retain its name, size and every other field; normalize only its digest.
		file.sha256 = "consumer-build-digest";
	}
};
const normalizeNugetMetadata = inventory => {
	const metadata = inventory?.[".nupkg.metadata"];
	if(!metadata) return;
	assert.match(metadata.sha256, /^[a-f0-9]{64}$/);
	assert.ok(Number.isSafeInteger(metadata.bytes) && metadata.bytes > 0);
	// NuGet writes the temporary feed path into this local installer record.
	// The actual archive, its SHA-512 sidecar and every payload remain exact.
	metadata.sha256 = "nuget-install-metadata-digest";
};
const comparable = runs => {
	assert.deepEqual(Object.keys(runs).sort(), families);
	const result = structuredClone(runs);
	for(const run of Object.values(result))
	{
		assert.equal(run.executionsSha256, sha256(canonicalJson(run.executions)));
		assert.deepEqual(run.executions.map(item => item.path), ["ordinary-source", "reviewed-ir"]);
		for(const item of run.executions)
		{
			assert.equal(item.profile, "dotnet");
			normalizeConsumer(item.installed?.deployment);
			normalizeConsumer(item.deployment);
			normalizeNugetMetadata(item.installedSnapshot);
			// The existing variant gate records LeakSanitizer's producer path.
			const baseline = item.nativeFaults?.startupLeakBaseline;
			if(baseline) baseline.report = baseline.report.replace(/\/tmp\/lean-bridge-dotnet-variant-author-[A-Za-z0-9]+/g, "/build/author");
			if(item.nativeFaults)
			{
				// The sanitizer test executable embeds temporary -g and rpath paths.
				// Its adapter, instrumented source, caller and observations stay exact;
				// shipped native libraries and NuGet archives are never normalized.
				assert.match(item.nativeFaults.executableSha256, /^[a-f0-9]{64}$/);
				item.nativeFaults.executableSha256 = "sanitizer-probe-build-digest";
			}
		}
		// The authenticated row digest includes the consumer digests and therefore
		// need not be identical across runs.
		delete run.executionsSha256;
	}
	return result;
};

/**
 * Compare all observations except test-build digests and local NuGet bookkeeping.
 * This compares reports; it does not execute or certify a fresh installation.
 *
 * @param current - Fresh normalized execution rows for all six C# families.
 * @param previous - Original independently retained family execution rows.
 */
export const assertRepeatedDotnetFamilies = (current, previous) => {
	assert.deepEqual(comparable(current), comparable(previous));
};
