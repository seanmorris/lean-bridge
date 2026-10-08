/**
 * Reconcile reviewed generic-record specializations without extending instance or browser claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";

export const reviewedRecordReceiptPath = "docs/evidence/reviewed-instantiations-20261008/receipt.json";
export const reviewedRecordHosts = Object.freeze({
	native: { original: "reviewed-finite-specializations-c-cpp-reviewed-ir", observation: "reviewed-record-specializations-c-cpp-reviewed-ir", evidence: "reviewed-record-specializations-c-cpp-installed", profiles: ["c", "cpp"] }
	, npm: { original: "reviewed-finite-specializations-npm-reviewed-ir", observation: "reviewed-record-specializations-npm-reviewed-ir", evidence: "reviewed-record-specializations-npm-installed", profiles: ["node-javascript", "node-typescript"] }
});

/**
 * Split out only the observed generic/implicit signatures, keeping instance cells unchanged.
 *
 * @param observations - Previously accepted observations.
 */
export const reconcileReviewedRecordObservations = observations => {
	const result = structuredClone(observations);
	for(const [host, ids] of Object.entries(reviewedRecordHosts))
	{
		const original = result.find(item => item.id === ids.original);
		assert.ok(original);
		assert.deepEqual(original.profiles, ids.profiles);
		assert.deepEqual(original.shapes, ["generic", "implicit", "instance"]);
		assert.deepEqual(original.positions, ["signature"]);
		assert.equal(original.path, "reviewed-ir");
		assert.ok(!result.some(item => item.id === ids.observation));
		const expanded = structuredClone(original);
		expanded.id = ids.observation;
		expanded.shapes = ["generic", "implicit"];
		delete expanded.hostTypes.instance;
		delete expanded.conversionNotes.instance;
		original.shapes = ["instance"];
		for(const key of ["generic", "implicit"])
		{
			delete original.hostTypes[key];
			delete original.conversionNotes[key];
		}
		const measured = host === "native"
			? "The direct packages pass 1013 C and 1012 C++ checks; the composed packages pass 1029 C and 1024 C++ checks."
			: "The direct package passes 1010 Node checks and 1005 rejections; the composed package passes 1019 checks and 1010 rejections. Strict TypeScript compiles against both installed packages with skipLibCheck disabled.";
		expanded.scope += ` Separately archived reviewed packages execute ten direct exports over eight alias-named generic-record instantiations, then nine specializations of echo over closed record and List/Option aliases in two namespaces. ${measured} Both routes reproduce archives from two builds and install offline after actual author/build deletion.`;
		expanded.hostTypes.generic.signature = host === "native"
			? "Concrete reviewed function over named structs and List/Option aliases"
			: "Concrete reviewed function over named readonly interfaces and List/Option aliases";
		expanded.conversionNotes.generic += " Reviewed generic records retain each alias's name and compiler-resolved origin. Call the generated concrete function with the named record, List or Option value; no runtime type argument crosses the boundary.";
		expanded.conversionNotes.implicit = "Reviewed record specializations fix the implicit type to a closed record or List/Option alias before compilation.";
		expanded.limitations = [
			"The earlier finite-specialization reports still support their original primitive/alias choices. Instance-dictionary coverage remains in the unchanged separate instance observation; these record echo reports contain no instance dictionary."
			, "Only reviewed C/C++ and Node JavaScript/TypeScript packages. Reviewed-browser and other native-host generic-record execution are not established by this archive."
			, "Only closed alias-named, nonrecursive, noninherited, unrefined records and configured function specializations. Open, inherited, recursive, indexed, dependent and refined generic applications need separate evidence."
			, "Local producers only; native glibc floor override 2.36. No hosted CI, release-floor, source-entry counter or sanitizer measurement is added."
		];
		for(const [stage, value] of Object.entries(expanded.stages))
		{
			assert.equal(value.state, "passed");
			value.evidence.push(ids.evidence);
			value.note += stage === "installedExecution" ? ` ${measured}`
				: " The additional archive covers reviewed direct alias-record exports and nine composed record/List/Option specializations.";
		}
		result.push(expanded);
	}
	return result;
};

/**
 * Pin the original reports and their current authenticated readers independently for each host.
 */
export const reviewedRecordEvidence = async () => {
	const receiptBytes = await readFile(reviewedRecordReceiptPath);
	assert.equal(sha256(receiptBytes), "3cc7ab64f600c37c5c85705a24f64c41ebe1569f20470ec27173f56495b811e9");
	const receipt = JSON.parse(receiptBytes), entries = [];
	for(const [host, ids] of Object.entries(reviewedRecordHosts))
	{
		const paths = [...new Set([...receipt.producers[host].files.map(file => file.path)
			, reviewedRecordReceiptPath
			, ...receipt.artifacts.map(file => file.path)
			, "tests/helpers/reviewed-instantiation-evidence.mjs"
			, "tests/helpers/reviewed-instantiation-evidence-tests.mjs"
			, "tests/helpers/reviewed-record-promotion.mjs"
			, "tests/helpers/reviewed-record-promotion-tests.mjs"])];
		const artifacts = [];
		for(const kind of ["direct", "composed"])
		{
			const report = JSON.parse(await readFile(`docs/evidence/reviewed-instantiations-20261008/${host}-${kind}.json`));
			const archives = host === "native" ? report.archives : {
				"component.tgz": report.archiveSha256
				, "runtime.tgz": report.runtimeArchiveSha256
			};
			for(const [name, digest] of Object.entries(archives)) artifacts.push({ path: `reviewed-records/${host}/${kind}/${name}`, sha256: digest });
		}
		entries.push({
			id: ids.evidence
			, kind: "installed"
			, revision: receipt.producers[host].revision
			, command: host === "native"
				? "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 LEAN_BRIDGE_REVIEWED_INSTANTIATION_PROFILES=c,cpp node --test --test-concurrency=1 --test-name-pattern='^(independently reviewed C and C\\+\\+ packages install every alias-named generic record from source-free archives|a composed review installs C and C\\+\\+ specializations over alias-instantiated records in two namespaces)$' tests/reviewed-instantiations.test.mjs"
				: "env -u LEAN_BRIDGE_LAKE_ENGINE LEAN_BRIDGE_LAKE_RUNTIME_ROOT=/app/build/lean-link-spike/lazy LEAN_BRIDGE_REVIEWED_INSTANTIATION_NPM_TEST=1 node --test --test-concurrency=1 --test-name-pattern='^(an independently reviewed npm package keeps every alias-named record for Node and strict TypeScript|a composed review keeps npm specializations over alias-instantiated records for Node and strict TypeScript)$' tests/reviewed-instantiations.test.mjs"
			, scope: "Local installed reviewed direct and composed alias-record packages, with actual author/build deletion, offline installation and two-build archive reproduction. The command combines two recorded selections for reproduction; the original separate queue/TAP steps remain archived. The standalone fresh-Lean log has no original queue or revision record; its attribution rests on the retained filename and matching test names, not an independently recorded execution revision. Native floor override: glibc 2.36. npm used the local runtime at /app/build/lean-link-spike/lazy and build/lean-runtime. No new instance-dictionary, reviewed-browser, hosted CI, source-entry counter, sanitizer or inheritance claim."
			, files: await Promise.all(paths.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
			, artifacts });
	}
	return entries;
};
