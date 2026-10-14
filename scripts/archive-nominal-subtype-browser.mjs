/**
 * Retain four original nominal browser selections, complete npm archives and frozen producers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { nominalSubtypeBrowserRecords, checkNominalSubtypeBrowserReport } from "../tests/helpers/nominal-subtype-browser-report.mjs";
import { nominalSubtypeBrowserHandoffRecords } from "../tests/helpers/nominal-subtype-browser-package.mjs";
import { waitNominalSubtypeDotnetResources } from "../tests/helpers/nominal-subtype-dotnet-resources.mjs";
import { nominalSubtypeBrowserSelections, assertNominalSubtypeBrowserRun } from "../tests/helpers/nominal-subtype-browser-provenance.mjs";
import { nominalSubtypeBrowserOriginal, nominalSubtypeBrowserSnapshot, nominalSubtypeBrowserGeneratorClosure } from "../tests/helpers/nominal-subtype-browser-sources.mjs";
import { checkNominalSubtypeBrowserControls } from "../tests/helpers/nominal-subtype-browser-controls.mjs";

const roots = process.argv.slice(2);
assert.equal(roots.length, 4, "Supply ordinary/full, ordinary/result-only, reviewed/full and reviewed/result-only run directories");
const destination = "docs/evidence/nominal-subtype-browser-20261014";
await assert.rejects(access(destination), { code: "ENOENT" });
const producerCommit = "2f723c1300abf84975454486b80882130b97048b";
const runtime = { node: "v22.23.2", platform: "linux", arch: "x64" };
const runner = await readFile("build/vo1468-browser-installed-runner.mjs");
const files = new Map([["runner.mjs", runner]]), runs = [];
const snapshot = nominalSubtypeBrowserSnapshot(producerCommit);
for(const [index, [route, mode]] of nominalSubtypeBrowserSelections.entries())
{
	await waitNominalSubtypeDotnetResources("build", { notify: console.log });
	const prefix = roots[index], label = `${route}-${mode}`;
	assert.match(prefix, new RegExp(`^build/vo1468-browser-installed-${route}-${mode}-r[1-9][0-9]*-${producerCommit.slice(0, 7)}$`, "u"));
	const startBytes = await readFile(join(prefix, "start.json")), endBytes = await readFile(join(prefix, "end.json"));
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes), tap = await readFile(join(prefix, "run.tap"));
	assertNominalSubtypeBrowserRun({ start, end, tap, route, mode, producerCommit, runtime, runner });
	assert.equal(startBytes.toString(), canonicalJson(start)); assert.equal(endBytes.toString(), canonicalJson(end));
	assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_OUTPUT, resolve(prefix, "records"));
	assert.deepEqual(start.sources, snapshot);
	if(index) assert.ok(Date.parse(runs[index - 1].finished) <= Date.parse(start.started));
	const root = join(prefix, "records", route, mode);
	await verifyComponentPackageReceipt({ receiptPath: join(root, "handoff/component-package-receipt.json") });
	const report = JSON.parse(await readFile(join(root, "report.json")));
	const records = [...nominalSubtypeBrowserRecords(mode), ...nominalSubtypeBrowserHandoffRecords(report.receipt)].sort();
	assert.equal(new Set(records).size, records.length);
	assert.deepEqual(await nativeArtifactPaths(root), records);
	const originals = new Map();
	for(const path of records) originals.set(path, await readFile(join(root, path)));
	const read = async path => { assert.ok(originals.has(path), path); return originals.get(path); };
	const checked = await checkNominalSubtypeBrowserReport(read, { route, mode, producerCommit, runtime });
	const controls = await checkNominalSubtypeBrowserControls(originals, { route, mode, producerCommit, runtime });
	const browser = JSON.parse(originals.get("browser.json")), browserVersions = {};
	for(const profile of browser.reports) for(const execution of profile.browser.executions)
	{
		browserVersions[execution.engine] ??= execution.observation.hostVersion;
		assert.equal(browserVersions[execution.engine], execution.observation.hostVersion);
	}
	for(const [path, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${path}`, bytes);
	for(const [path, bytes] of originals) files.set(`${label}/records/${path}`, bytes);
	runs.push({ ...checked, label, originalRoot: resolve(root)
		, started: start.started
		, finished: end.finished
		, records
		, controls
		, browserVersions
		, tapSha256: sha256(tap)
		, reportSha256: sha256(originals.get("report.json"))
		, browserSha256: sha256(originals.get("browser.json")) });
	process.stdout.write(canonicalJson({ label, records: records.length, controls, browserVersions }));
}

const generatorClosure = nominalSubtypeBrowserGeneratorClosure(producerCommit);
const selectedSources = [...new Set([
	...generatorClosure
	, "src/analyze/NativeExports.lean"
	, "package.json"
	, "package-lock.json"
	, "tests/helpers/nominal-subtype-installed-fixture.mjs"
	, "tests/helpers/nominal-subtype-npm-installed-tests.mjs"
	, "tests/helpers/nominal-subtype-npm-report.mjs"
	, ...["fixture", "report", "package"].map(name => `tests/helpers/nominal-subtype-browser-${name}.mjs`)
	, "tests/helpers/nominal-subtype-browser.mjs"
	, "tests/helpers/nominal-subtype-dotnet-resources.mjs"
	, "tests/helpers/structural-subtype-npm-package.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-archives.mjs"
	, "tests/helpers/type-corpus-browser.mjs"
	, "tests/helpers/type-corpus-browser-build.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/refinement-engine.mjs"
	, "tests/helpers/lake-workspace.mjs", "tests/helpers/module-closure.mjs"
	, "scripts/verify-playwright-browsers.mjs"
	, ...["javascript.mjs", "browser.mjs", "index.mts", "results.mts"].map(path => `tests/fixtures/nominal-subtype-consumers/${path}`)
	, "tests/fixtures/structural-subtype-consumers/javascript.mjs"
	, ...["plain", "react", "worker-main", "worker"].map(name => `tests/fixtures/type-corpus/consumers/browser/${name}.mjs`)
	, ...["NominalSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(path => `tests/fixtures/onboarding/nominal-subtypes/${path}`)
])].sort();
for(const path of selectedSources)
{
	const bytes = nominalSubtypeBrowserOriginal(producerCommit, path);
	assert.equal(snapshot[path], sha256(bytes), path); files.set("sources/" + path, bytes);
}
const checkers = ["tests/helpers/nominal-subtype-npm-report.mjs"
	, ...["fixture", "report", "package", "provenance", "controls", "sources"].map(name => `tests/helpers/nominal-subtype-browser-${name}.mjs`)];
for(const path of checkers) files.set("checkers/" + path, await readFile(path));
const index = { schemaVersion: 1, kind: "nominal-subtype-browser-installed-v1"
	, producerCommit, runs, generatorClosure, selectedSources, checkers
	, sourceSnapshotCount: Object.keys(snapshot).length
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Local Linux x64 Node and Chromium/Firefox/WebKit observations, not hosted CI acceptance."
		, "The named nominal Nat fixture includes mixed Fin fields, aliases and result-only APIs. Other primitive bases and transports remain separate tasks."
		, "All public callers are original source bytes. Unit-test runtime doubles are absent from these installed runs."
		, "Both complete component and shared-runtime npm archives are retained, with exact installed closures and served Wasm identities."
		, "The local build executes the real compiler through the existing Nix command transport adapter. It does not establish Nix sandbox execution."
		, "No constructor/source-entry counters or algorithm-memory measurements."
		, "The launchers record their own pre-launch hashes and the Node executable identity. Browser versions and full inherited-environment hashes are recorded; complete browser, compiler and operating-system distributions remain trusted."
		, "Browser bundles, framework archives and command binaries are not retained. Original bundle, framework and browser-served asset identities are recorded."
		, "This archive alone does not promote support or establish a required recurring installed CI gate."] };
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
