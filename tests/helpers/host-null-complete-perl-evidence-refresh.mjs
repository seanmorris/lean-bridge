/**
 * Rebind only the older evidence entries whose live Perl alias validator was
 * extended by HostNull. The complete hosted scripting lane must requalify the
 * exact current bytes before this metadata-only refresh can run.
 *
 * @file
 */
import assert from "node:assert/strict";

export const hostNullPerlSharedSource
	= "src/backends/perl/copied-aliases.mjs";
export const hostNullPerlPreviousSourceSha256
	= "3e77c70117d27939a323383a9ef772a6d713d4ed23483445a777d8e277bd0956";
export const hostNullPerlRequalifiedEvidenceIds = Object.freeze([
	"perl-variants-installed"
	, "perl-aliases-installed"
	, "wit-wasi-recursive-installed"
	, "perl-structured-callables-installed"
	, "perl-recursive-callables-installed"
]);

/**
 * Refresh the exact shared source digest without widening support or replacing
 * any original artifact, revision, command, scope, or observation.
 *
 * @param inventory - Full retained evidence projection.
 * @param reference - Independently replayed complete HostNull reference.
 * @param currentSha256 - Current and producer-authenticated shared source hash.
 */
export const refreshHostNullPerlEvidence = (
	inventory, reference, currentSha256
) => {
	assert.equal(reference.id, "hosted-host-null-complete-installed");
	assert.match(reference.revision, /^[a-f0-9]{40}$/u);
	assert.match(currentSha256, /^[a-f0-9]{64}$/u);
	assert.notEqual(currentSha256, hostNullPerlPreviousSourceSha256);
	const refreshed = structuredClone(inventory);
	const selected = new Set(hostNullPerlRequalifiedEvidenceIds);
	assert.equal(refreshed.evidence.filter(entry => selected.has(entry.id)).length
		, selected.size);
	for(const entry of refreshed.evidence)
	{
		if(!selected.has(entry.id)) continue;
		const files = entry.files.filter(file =>
			file.path === hostNullPerlSharedSource);
		assert.equal(files.length, 1, entry.id);
		assert.equal(files[0].sha256, hostNullPerlPreviousSourceSha256, entry.id);
		files[0].sha256 = currentSha256;
	}
	return refreshed;
};
