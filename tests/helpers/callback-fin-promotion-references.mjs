/**
 * Select only the archived native, browser and reviewed callback-Fin observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { reviewedCallbackFinEvidenceDirectory } from "./reviewed-callback-fin-evidence.mjs";

const original = async file => {
	const bytes = await readFile(file.path);
	assert.equal(sha256(bytes), file.sha256, file.path);
	if(file.bytes !== undefined) assert.equal(bytes.length, file.bytes, file.path);
	return bytes;
};
const archive = async (path, digest) => {
	const record = JSON.parse(await original({ path, sha256: digest }));
	assert.equal(record.execution, "local");
	const files = record.artifacts ?? [record.report, record.log, record.queue];
	for(const file of files) await original(file);
	return { record, files: [{ path, sha256: digest }, ...files] };
};
const artifacts = report => Object.entries(report.archives).map(([path, sha256]) => ({ path, sha256 }));
const positions = ["callback-parameter", "callback-result"];
const nativeDirections = "Arguments to returned Lean closures, Lean-produced closure results and Lean-produced arguments to host callbacks. Native host-produced refined replies are not covered.";
const nativeEnvironment = "Local runner records Node 22.23.3 and a declared glibc floor of 2.36; it does not measure host glibc. C/C++ consumers compile against the installed package with the system compiler. No hosted or other-floor acceptance is inferred.";
const npmEnvironment = "Local Node 22.23.3 execution and strict TypeScript declaration checking with skipLibCheck false. The TypeScript version is not recorded; it is not a separate runtime execution. No reviewed browser acceptance is inferred.";

/** Return report-bound scopes and reproduction commands for the five installed selections. */
export const callbackFinPromotionReferences = async () => {
	const native = await archive("docs/evidence/native-fin-callbacks-20261008/receipt.json", "726ec4f76cd953e74d887108c8b75f3be5b1e89d7e492a261f6b773436c302e6");
	const browser = await archive("docs/evidence/browser-callback-fin-20261008/receipt.json", "022cd63a5114623b8824c43ee43da061ac5e1db6451c037b21d1681e0fbc1766");
	const reviewed = await archive(`${reviewedCallbackFinEvidenceDirectory}/receipt.json`, "da4f34b51996f6b818998d41cf06e4c381b7faf93da6ef7e86027b79cb64eeba");
	const nativeReport = JSON.parse(await original(native.record.report));
	const browserReport = JSON.parse(await original(browser.record.report));
	assert.deepEqual(nativeReport.reports.map(item => [item.profile, item.checks]), [["c", 297], ["cpp", 283]]);
	assert.deepEqual(browser.record.scope.profiles, ["browser-javascript", "browser-react", "browser-worker"]);
	const references = [
		{ id: "native-callback-fin-ordinary-installed", profiles: ["c", "cpp"]
			, sourcePath: "ordinary-source", positions, revision: native.record.revision
			, files: native.files, artifacts: artifacts(nativeReport)
			, command: "source scripts/env.sh && LEAN_BRIDGE_FIN_CALLBACK_PROFILES=c,cpp LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 taskset -c 3 node --test --test-concurrency=1 --test-name-pattern='^relocated source-free C and C' tests/native-fin-callbacks.test.mjs"
			, scope: `${nativeDirections} Scalar Fin, Array/List/Option/Prod/Except and plain record/variant payloads, including Fin 0 absence and wide bounds. C passes 297 checks and C++ 283. Two-root reproduction and source-free offline installs.`
			, environment: nativeEnvironment
			, dispatch: "Only ordinary C measures public lease entry, checked adapter and source body separately. C++ dispatch is unmeasured." }
		, { id: "browser-callback-fin-ordinary-installed"
			, profiles: [...browser.record.scope.profiles]
			, sourcePath: "ordinary-source", positions, revision: browser.record.revision
			, files: browser.files, artifacts: artifacts(browserReport)
			, command: "source scripts/env.sh && LEAN_BRIDGE_BROWSER_CALLBACK_FIN_TEST=1 LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit taskset -c 3 node --test --test-concurrency=1 tests/browser-callback-fin.test.mjs"
			, scope: "Ordinary-source callback arguments and results, including host-produced Fin 3 and Fin 5 replies, in Chromium, Firefox and WebKit pages, React production/strict lifecycles and dedicated workers. All twelve executions pass 409 checks and 894 rejections, preserve installed/deployed Wasm identities, recover after asset failures and dispose callbacks. Two-root package reproduction, author/build deletion and blocked external network."
			, environment: "The local queue records Node 22.23.3 for the harness; execution occurs in the named browser engines. React and react-dom 19.2.8 are pinned in the deployed report. No reviewed-source or native host-reply acceptance is inferred."
			, dispatch: "Browser dispatch is not measured." }
	];
	for(const run of reviewed.record.runs)
	{
		const report = JSON.parse(await original(run.report)), native = run.id === "c-cpp";
		const selectedFiles = reviewed.files.filter(file => !file.path.endsWith(".json") || file.path.endsWith("/receipt.json") || file.path === run.report.path);
		const command = native
			? "LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_PROFILES=c,cpp LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 taskset -c 3 node --test --test-concurrency=1 --test-name-pattern='^independently reviewed C and C' tests/reviewed-callback-fin.test.mjs"
			: `LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_NPM_TEST=1 taskset -c 3 node --test --test-concurrency=1 --test-name-pattern='^an independently reviewed npm package installs ${run.id === "npm-r1" ? "R1" : "R2"}' tests/reviewed-callback-fin.test.mjs`;
		references.push({ id: `reviewed-callback-fin-${run.id}-installed`
			, profiles: native ? ["c", "cpp"] : ["node-javascript", "node-typescript"]
			, sourcePath: "reviewed-ir", positions, revision: reviewed.record.revision
			, files: selectedFiles
			, artifacts: native ? artifacts(report) : [report.receipt.package, report.receipt.runtime].map(item => ({ path: item.archive, sha256: item.sha256 }))
			, command: `source scripts/env.sh && ${command}`
			, scope: `${native ? nativeDirections + " C passes 266 checks and C++ 260." : `Reviewed ${report.review} Node consumer passes ${report.observed.checks} checks and ${report.observed.rejections} rejections.${report.review === "R2" ? " Includes the npm-only scalar Fin 3 host-produced callback reply." : " R1 does not exercise host-produced refined replies."}`} Exact bounds 3, 5 and 10, Array Fin and List of the Tile record; no Fin 0, wide-bound, recursive or Subtype claim. Two-root reproduction and source-free offline installation.`
			, environment: native ? nativeEnvironment : `${npmEnvironment} Offline installation is established by the pinned tests/reviewed-callback-fin.test.mjs npm install --offline invocation, not a separate field in the original npm report.`
			, dispatch: "Dispatch is not measured in this reviewed selection." });
	}
	assert.equal(references.length, 5);
	return references.map(reference => ({ ...reference, validators: reference.id.startsWith("reviewed-")
		? ["tests/helpers/reviewed-callback-fin-evidence.mjs", "tests/helpers/reviewed-callback-fin-evidence-tests.mjs"]
		: reference.id.startsWith("browser-")
			? ["tests/helpers/browser-callback-fin-evidence-tests.mjs", "tests/helpers/browser-callback-fin.mjs"]
			: ["tests/helpers/native-fin-callback-evidence-tests.mjs", "tests/helpers/fin-callback-install.mjs", "tests/helpers/fin-callback-dispatch.mjs"] }));
};
