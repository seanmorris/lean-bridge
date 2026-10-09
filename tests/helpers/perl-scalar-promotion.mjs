/**
 * Add measured scalar Fin evidence to Perl's existing ordinary and reviewed observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertPerlScalarArchive, perlScalarConfigurations, perlScalarDirectory, perlScalarRevision } from "./perl-scalar-hosted-evidence.mjs";

export const perlScalarOrdinaryId = "perl-fin-containers-ordinary-source";
export const perlScalarReviewedId = "reviewed-fin-perl-scalar-containers";
export const perlScalarEvidenceIds = ["perl-scalar-ordinary-hosted-installed", "perl-scalar-reviewed-hosted-installed"];
const receiptPath = `${perlScalarDirectory}/receipt.json`;
const command = "LEAN_BRIDGE_PERL_FIN_TEST=1 node --test tests/perl-fin.test.mjs";
const environment = "Perl 5.36.3 and 5.38.2, each threaded and unthreaded, on hosted Ubuntu 24.04. Packages record a glibc 2.38 floor; the runs do not establish execution on a minimum-libc machine.";
const execution = "Each configuration executes 2024 public checks, then repeats the unchanged consumer after moving the installed tree. Two clean author roots reproduce the archives. Author sources are removed before offline, compiler-free installation.";
const counters = "Four LD_PRELOAD controls measure the mirror, impossible and label Lean source functions in the relocated Perl process. Invalid-only calls enter none; valid mirror, valid label and rejection followed by recovery enter only their expected source. These controls do not count typed-adapter entries or the other exports.";

/** Authenticate the four hosted configurations before constructing either route's evidence. */
export const perlScalarPromotionEvidence = async () => {
	const bytes = await readFile(receiptPath);
	assert.equal(sha256(bytes), "627c0ecfe938dd4608d05830da7f15499813bbec3c2bbb3b231e685194ae38fb");
	const receipt = JSON.parse(bytes);
	const { runs } = await assertPerlScalarArchive(receipt);
	assert.deepEqual(runs, perlScalarConfigurations.flatMap(item => [[item.name, "ordinary-source", 2024], [item.name, "reviewed-ir", 2024]]));
	const paths = [receiptPath, "tests/helpers/perl-scalar-hosted-evidence.mjs"
		, "tests/helpers/hosted-specialization-evidence.mjs"
		, "tests/perl-scalar-hosted-evidence.test.mjs"
		, "tests/helpers/perl-scalar-promotion.mjs"
		, "tests/perl-scalar-promotion.test.mjs"
		, ...receipt.files.map(file => file.path)];
	// Read ZIPs as bytes. Their inventory identities must match the original GitHub artifacts.
	const files = await Promise.all(paths.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	return Promise.all(["ordinary", "reviewed"].map(async (route, index) => ({
		id: perlScalarEvidenceIds[index]
		, kind: "installed"
		, revision: perlScalarRevision
		, command
		, scope: `${route === "ordinary" ? "Ordinary-source" : "Independently reviewed"} top-level scalar Fin parameters/results and transparent aliases, including bounds 0, 1, 10, 300 and 2^70, exact bound diagnostics, result-only Fin, unchanged caller data and 1000 rejection/recovery cycles. ${environment} ${execution} ${counters} Original report identities and GitHub artifact ZIP membership are authenticated; model, Binding IR and receipt digests remain report-carried identities because the full build documents are absent. Selected Git snapshots are not a complete source dependency closure. Container, nominal-field, callback, product, Except and Subtype acceptance are separate.`
		, files: structuredClone(files)
		, artifacts: (await Promise.all(perlScalarConfigurations.map(async configuration => {
			const report = JSON.parse(await readFile(`${perlScalarDirectory}/${configuration.name}/${route}.json`));
			return Object.entries(report.archives).map(([path, sha256]) => ({ path: `${configuration.name}/${route}/${path}`, sha256 }));
		}))).flat()
	})));
};

/**
 * Extend the existing ordinary Fin cell with scalar coverage and supplement reviewed scalar execution.
 *
 * @param previous - Unchanged predecessor observations.
 */
export const promotePerlScalarObservations = previous => {
	const observations = structuredClone(previous), reviewed = observations.find(item => item.id === perlScalarReviewedId);
	const ordinary = observations.find(item => item.id === perlScalarOrdinaryId);
	assert.ok(ordinary);
	assert.deepEqual([ordinary.profiles, ordinary.shapes, ordinary.positions, ordinary.path], [["perl"], ["fin"], ["parameter", "result"], "ordinary-source"]);
	assert.ok(!ordinary.stages.installedExecution.evidence.includes(perlScalarEvidenceIds[0]), "Ordinary Perl scalar Fin already recorded");
	assert.ok(reviewed);
	assert.deepEqual([reviewed.profiles, reviewed.shapes, reviewed.positions, reviewed.path], [["perl"], ["fin"], ["parameter", "result"], "reviewed-ir"]);
	assert.ok(!reviewed.stages.installedExecution.evidence.includes(perlScalarEvidenceIds[1]), "Reviewed Perl scalar evidence already attached");
	reviewed.stages.installedExecution.evidence.push(perlScalarEvidenceIds[1]);
	reviewed.stages.installedExecution.note += ` The separate hosted scalar reports cover both Perl versions and threading modes. ${execution} ${counters}`;
	const previousLimit = "The new hosted relocation reports cover reviewed Array/List/Option Fin only. Earlier scalar evidence remains unchanged; fresh scalar relocation and reviewed Subtype require separate acceptance.";
	assert.equal(reviewed.limitations.filter(note => note === previousLimit).length, 1);
	reviewed.limitations = reviewed.limitations.map(note => note === previousLimit
		? "Earlier hosted relocation reports cover reviewed Array/List/Option Fin. The separately dated hosted scalar reports now establish top-level Fin relocation on all four Perl configurations. Reviewed Subtype retains its separate acceptance requirements."
		: note);
	reviewed.limitations.push(counters);
	const notes = {
		analysis: "Fresh Lean metadata preserves exact closed Fin bounds on scalar parameters/results and transparent aliases."
		, generation: "Generated XS accepts exact Math::BigInt values and checks every parameter against its declared bound; generated documentation retains that bound."
		, compilation: "Compiled XS rejects invalid inputs before calling the guarded adapter. The installed source-counter controls separately observe three named Lean functions."
		, packaging: `${environment} Two independent author roots reproduce the original CPAN component and required runtime archives.`
		, installedExecution: `${execution} ${counters}`
	};
	for(const [stage, note] of Object.entries(notes))
	{
		assert.equal(ordinary.stages[stage].state, "passed");
		ordinary.stages[stage].evidence.push(perlScalarEvidenceIds[0]);
		ordinary.stages[stage].note += ` Separate scalar evidence: ${note}`;
	}
	const oldScope = "This observation covers container parameters/results, not the separate top-level scalar native-fin relocation gate.";
	assert.ok(ordinary.scope.endsWith(oldScope));
	ordinary.scope = ordinary.scope.slice(0, -oldScope.length) + "Separate hosted scalar reports establish top-level Fin parameters/results and transparent aliases, including bounds wider than a machine word and result-only Fin.";
	assert.equal(ordinary.limitations[0], "Container parameters/results only; no nominal-field, product, Except or callback promotion.");
	ordinary.limitations[0] = "Scalar and tested container parameters/results only; no nominal-field, product, Except or callback promotion.";
	ordinary.limitations.push(counters, environment);
	ordinary.conversionNotes.fin += " For scalar Fin, pass an exact Math::BigInt below the closed bound. Fin 0 rejects every input. A negative value retains the Nat conversion error; other invalid bounds die with the parameter and exact bound. Caller values remain unchanged, and valid calls still succeed after rejection.";
	return observations;
};

/**
 * Construct the exact permitted inventory change after authenticating the archive.
 *
 * @param previous - Unmodified inventory at the integration predecessor.
 */
export const promotePerlScalarInventory = async previous => {
	const inventory = structuredClone(previous), evidence = await perlScalarPromotionEvidence();
	for(const entry of evidence) assert.ok(!inventory.evidence.some(old => old.id === entry.id), `Already recorded: ${entry.id}`);
	inventory.evidence.push(...evidence);
	inventory.observations = promotePerlScalarObservations(previous.observations);
	return inventory;
};

/**
 * Permit only this measured promotion and exact source-pin transitions in earlier evidence.
 *
 * @param current - Candidate current inventory.
 * @param previous - Exact predecessor inventory.
 * @param updates - Authenticated source history transitions.
 */
export const assertPerlScalarPromotion = async (current, previous, updates) => {
	const expected = await promotePerlScalarInventory(previous);
	for(const entry of expected.evidence.slice(0, previous.evidence.length)) for(const file of entry.files)
	{
		const update = updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update) file.sha256 = update.currentSha256;
	}
	assert.deepEqual(current, expected, "Only the measured Perl scalar promotion and exact predecessor source pins may change");
};
