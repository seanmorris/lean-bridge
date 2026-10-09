/**
 * Authenticate hosted Python/Rust container entry measurements without rewriting older evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { assertHostedContainerMembership, hostedContainerMembershipPath } from "./hosted-container-artifact-membership.mjs";

// Frozen at producer 93c60a0. Live helper changes must not reinterpret historical observations.
const expected = {
	columns: ["l_FinContainers_mirrorAll", "l_FinContainers_orDefault", "lb_aba29fbaeffa9ce68e9e3ae2", "lb_d6e2d2cd1dc6db4690d6dfb7"]
	, rows: [["start", 0, [0, 0, 0, 0]], ["public-valid-mirror", 0, [1, 0, 1, 0]], ["public-invalid-mirror", 1, [1, 0, 1, 0]], ["public-valid-absent", 0, [1, 1, 1, 1]], ["public-invalid-present", 1, [1, 1, 1, 1]], ["raw-invalid-mirror", 1, [1, 1, 2, 1]], ["raw-invalid-present", 1, [1, 1, 2, 2]], ["raw-valid-mirror", 1, [2, 1, 3, 2]], ["raw-valid-absent", 1, [2, 2, 3, 3]]]
	, refinements: {
		"FinContainers.countNone": {
			parameters: [{
				arguments: [{
					bound: "0"
					, kind: "fin"
				}]
				, kind: "array"
			}]
			, result: null
		}
		, "FinContainers.flatten": {
			parameters: [{
				arguments: [{
					arguments: [{
						bound: "10"
						, kind: "fin"
					}]
					, kind: "array"
				}]
				, kind: "list"
			}]
			, result: {
				arguments: [{
					arguments: [{
						bound: "10"
						, kind: "fin"
					}]
					, kind: "list"
				}]
				, kind: "option"
			}
		}
		, "FinContainers.label": {
			parameters: [null, {
				arguments: [{
					bound: "4"
					, kind: "fin"
				}]
				, kind: "array"
			}]
			, result: null
		}
		, "FinContainers.mirrorAll": {
			parameters: [{
				arguments: [{
					bound: "10"
					, kind: "fin"
				}]
				, kind: "array"
			}]
			, result: {
				arguments: [{
					bound: "10"
					, kind: "fin"
				}]
				, kind: "array"
			}
		}
		, "FinContainers.orDefault": {
			parameters: [{
				arguments: [{
					bound: "1"
					, kind: "fin"
				}]
				, kind: "option"
			}]
			, result: null
		}
		, "FinContainers.present": {
			parameters: [{
				arguments: [{
					arguments: [{
						bound: "10"
						, kind: "fin"
					}]
					, kind: "option"
				}]
				, kind: "array"
			}]
			, result: {
				arguments: [{
					bound: "10"
					, kind: "fin"
				}]
				, kind: "array"
			}
		}
		, "FinContainers.sumHuge": {
			parameters: [{
				arguments: [{
					bound: "1180591620717411303424"
					, kind: "fin"
				}]
				, kind: "list"
			}]
			, result: null
		}
		, "FinContainers.wrapAll": {
			parameters: [null]
			, result: {
				arguments: [{
					bound: "7"
					, kind: "fin"
				}]
				, kind: "array"
			}
		}
	}
	, probes: {
		python: "fd82ffb532c8c901d46ff2636f78d0ea39aac83398ccf88abf53166797accf74"
		, rust: "dde4d20e7cd49dc47314b56623d27b6fceb2e9ae8ab649a71659799dd8c853b4"
	}
	, interposer: "5cb718a2436c9517d8ba5f24fa29014fee5daf1f264e318cc374ef2a3373d61c"
};

const profiles = {
	python: { job: 113636827939
		, artifact: 11596416341
		, checks: 2029
		, extension: "py"
		, artifactSha256: "461d3e810c8bee043e7f498206f030ec9a18b4d79ca6636896d2b150f5a93b08"
		, step: "Compare installed Python corpus packages with fresh Lean results" }
	, rust: { job: 113636828054
		, artifact: 11595796933
		, checks: 2027
		, extension: "rs"
		, artifactSha256: "00290557169f1c38a67ba1d06208dbd048912b90d77a336b11a8e74f9c143a9b"
		, step: "Compare isolated Cargo corpus consumers with fresh Lean" }
};

/**
 * Exact repository path of one selected producer source snapshot.
 *
 * @param path - Repository-relative producer source.
 */
export const hostedContainerSnapshot = path => `${hostedContainerDirectory}/sources/${path}.txt`;

/**
 * Interpret each report independently of its authenticated file digest.
 *
 * @param data - Original installed report.
 * @param profile - Python or Rust host.
 * @param route - Ordinary source or reviewed IR.
 */
export const assertHostedContainerReport = (data, profile, route) => {
	assert.ok(Object.hasOwn(profiles, profile));
	assert.ok(["ordinary-source", "reviewed-ir"].includes(route));
	const spec = profiles[profile];
	assert.deepEqual(Object.keys(data).sort(), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.equal(data.schemaVersion, 1); assert.equal(data.reproducible, true); assert.equal(data.reports.length, 1);
	const report = data.reports[0], dispatch = report.dispatch;
	assert.equal(report.profile, profile); assert.equal(report.path, route); assert.equal(report.checks, spec.checks);
	assert.deepEqual(report.refinements, expected.refinements);
	assert.equal(report.consumerSha256, hostedContainerSources[`tests/fixtures/fin-container-consumers/${profile}.${spec.extension}`]);
	for(const flag of ["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation"]) assert.equal(report[flag], true);
	assert.deepEqual(dispatch.columns, expected.columns); assert.deepEqual(dispatch.observed, expected.rows);
	for(const flag of ["compilerFreePath", "installedFilesUnchanged", "missingInterposerRejected"]) assert.equal(dispatch[flag], true);
	assert.equal(dispatch.interposer, "LD_PRELOAD");
	assert.equal(dispatch.positiveControl, "valid public and raw calls increment source and adapter counts inside the installed host process");
	assert.equal(dispatch.interposerSha256, expected.interposer); assert.equal(dispatch.probeSha256, expected.probes[profile]);
	assert.match(dispatch.installedFilesSha256, /^[a-f0-9]{64}$/u);
	for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(report[field], /^[a-f0-9]{64}$/u);
	assert.equal(report.packages.length, 1);
	const [pkg] = report.packages;
	assert.deepEqual([pkg.name, pkg.version, pkg.target, pkg.runtimeDelivery, pkg.profile], ["fincontainers", "1.0.0", profile === "python" ? "pypi" : "cargo", "embedded", "native-library-v1"]);
	assert.equal(pkg.artifacts.length, 1);
	for(const artifact of pkg.artifacts)
	{
		assert.equal(data.archives[artifact.path], artifact.sha256); assert.ok(artifact.bytes > 0);
		assert.match(artifact.path, profile === "python" ? /manylinux_2_38_x86_64\.whl$/u : /fincontainers-1\.0\.0\.crate$/u);
	}
};

/**
 * Check successful jobs and selected unskipped executions, retaining the unrelated run failure.
 *
 * @param profile - Python or Rust host.
 * @param job - Original GitHub job metadata.
 * @param artifact - Original GitHub artifact metadata.
 * @param log - Complete original job log.
 */
export const assertHostedContainerJob = (profile, job, artifact, log) => {
	assert.ok(Object.hasOwn(profiles, profile)); const spec = profiles[profile];
	assert.equal(job.id, spec.job); assert.equal(job.run_id, hostedContainerRun); assert.equal(job.head_sha, hostedContainerRevision);
	assert.equal(job.status, "completed"); assert.equal(job.conclusion, "success");
	assert.equal(job.name, `Native consumer (${profile})`); assert.deepEqual(job.labels, ["ubuntu-24.04"]);
	const selected = job.steps.filter(step => step.name === spec.step); assert.equal(selected.length, 1);
	assert.equal(selected[0].status, "completed"); assert.equal(selected[0].conclusion, "success");
	assert.equal(artifact.id, spec.artifact); assert.equal(artifact.expired, false);
	assert.equal(artifact.workflow_run.id, hostedContainerRun); assert.equal(artifact.workflow_run.head_sha, hostedContainerRevision);
	assert.equal(artifact.name, `type-corpus-${profile}-${hostedContainerRevision}`);
	assert.equal(artifact.digest, `sha256:${spec.artifactSha256}`);
	assert.equal(artifact.size_in_bytes, profile === "python" ? 993757 : 841995);
	// These unique executions belong to the successful selected step in the byte-pinned original log.
	for(const title of ["relocated source-free native packages check Fin inside arrays, lists and options", "independently reviewed native packages check container and alias Fin bounds after source-free installation"])
	{
		const accepted = log.split("\n").filter(line => new RegExp(`Z ok [0-9]+ - ${title}\\r?$`, "u").test(line));
		assert.equal(accepted.length, 1, title);
		assert.doesNotMatch(log, new RegExp(`Z (?:not ok [0-9]+ - ${title}|ok [0-9]+ - ${title} # SKIP)`, "u"));
	}
};

/**
 * Build a receipt restricted to these two hosts, four reports and four measured columns.
 *
 * @param artifacts - Exact immutable original and Git snapshot descriptors.
 */
export const hostedContainerReceipt = artifacts => ({
	schemaVersion: 1
	, kind: "hosted-container-dispatch-acceptance"
	, revision: hostedContainerRevision
	, run: hostedContainerRun
	, scope: { profiles: ["python", "rust"]
		, routes: ["ordinary-source", "reviewed-ir"]
		, rowsPerReport: 9
		, measuredEntrypoints: ["FinContainers.mirrorAll", "FinContainers.orDefault"]
		, publicAndRawSameHostProcess: true
		, sourceFreeOfflineReproducible: true
		, pythonGlibcFloor: "2.38"
		, installedTreeRelocation: false
		, overallWorkflowSucceeded: false
		, sourceIdentity: "Selected producer sources, not a complete dependency closure"
		, packageArchiveBytesRetained: false }
	, artifacts
	, sources: Object.entries(hostedContainerSources).map(([path, digest]) => ({ path, sha256: digest, snapshot: hostedContainerSnapshot(path) }))
});

/**
 * Authenticate all fixed paths before reading them, then check provenance, reports and live sources.
 *
 * @param receipt - Parsed immutable receipt.
 * @param read - Archive reader, injectable for corruption controls.
 * @param options - Staging or independent source normalization options.
 * @param options.currentSources - False only while constructing authenticated Git snapshots.
 * @param options.normalizeSource - Exact history normalizer from the checkout being reviewed.
 */
export const assertHostedContainerArchive = async (receipt, read = readFile, { currentSources = true, normalizeSource = beforeFinRefinementSource } = {}) => {
	const paths = [...Object.keys(hostedContainerOriginals).map(name => `${hostedContainerDirectory}/${name}`), ...Object.keys(hostedContainerSources).map(hostedContainerSnapshot)];
	assert.ok(Array.isArray(receipt.artifacts)); assert.deepEqual(receipt.artifacts.map(file => file.path), paths);
	assert.deepEqual(receipt, hostedContainerReceipt(receipt.artifacts));
	const files = new Map();
	for(const file of receipt.artifacts)
	{
		const name = file.path.slice(hostedContainerDirectory.length + 1), original = hostedContainerOriginals[name];
		const source = Object.keys(hostedContainerSources).find(path => hostedContainerSnapshot(path) === file.path);
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "originalPath", "path", "sha256"]);
		assert.equal(file.originalPath, original?.original ?? `git:${hostedContainerRevision}:${source}`);
		assert.equal(file.sha256, original?.sha256 ?? hostedContainerSources[source]);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		if(original) assert.equal(file.bytes, original.bytes);
		const bytes = await read(file.path); assert.ok(Buffer.isBuffer(bytes));
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.path);
		files.set(file.path, bytes);
	}
	const bytes = name => files.get(`${hostedContainerDirectory}/${name}`), json = name => JSON.parse(bytes(name));
	for(const profile of Object.keys(profiles))
	{
		assertHostedContainerJob(profile, json(`${profile}.job.json`), json(`${profile}.artifact.json`), bytes(`${profile}.job.log`).toString());
		for(const [index, route] of [[0, "ordinary-source"], [1, "reviewed-ir"]]) assertHostedContainerReport(json(`${profile}-container-${index}.json`), profile, route);
	}
	await assertHostedContainerMembership(JSON.parse(await read(hostedContainerMembershipPath)), read);
	if(currentSources) for(const [path, digest] of Object.entries(hostedContainerSources))
		assert.equal(sha256(normalizeSource(path, await readFile(path, "utf8"), digest)), digest, path);
	return receipt;
};

/**
 * Preserve originals and refuse to replace any existing different bytes.
 *
 * @param path - Explicit archive destination.
 * @param bytes - Authenticated original bytes.
 */
export const writeHostedContainerArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `Refusing to replace an existing artifact: ${path}`);
	}
};

export const hostedContainerDirectory = "docs/evidence/python-rust-container-dispatch-20261009";
export const hostedContainerRevision = "93c60a0487d0b2acc0b6d562cd72a3876738a666";
export const hostedContainerRun = 37873560469;
export const hostedContainerOriginals = Object.freeze({
	"python-container-0.json": { original: "build/vo1436-hosted-container-dispatch-93c60a0/python-container-0.json", sha256: "b077637d30352605c00e51ef30201ac42b4e1f886a3b09732bb74dc2d5696e01", bytes: 7409 }
	, "python-container-1.json": { original: "build/vo1436-hosted-container-dispatch-93c60a0/python-container-1.json", sha256: "64c372dd30625a8ae892a398efbd9f8ac5e373222ae148b3f68cebfad4ea0174", bytes: 7503 }
	, "python.artifact.json": { original: "build/vo1436-hosted-container-dispatch-93c60a0/python.artifact.json", sha256: "44b519c797e11fad8ca057137075298f55877744f173a66fe6c41bacf6285b9d", bytes: 759 }
	, "python.job.json": { original: "build/vo1436-hosted-container-dispatch-93c60a0/python.job.json", sha256: "6923d8813aae778d5ced003e8ba4420abb7eb009489a6dc2d581e07e7fc4d5fe", bytes: 6417 }
	, "python.job.log": { original: "build/vo1436-hosted-container-dispatch-93c60a0/python.job.log", sha256: "5d0b3fbc7cf5039bff9ec1e7544a3321ba62c310f28fcc8f70b18cf0d993c5e2", bytes: 540989 }
	, "rust-container-0.json": { original: "build/vo1436-hosted-container-dispatch-93c60a0/rust-container-0.json", sha256: "103b7958c4998d35a88200918491e0da254f862f6ebaddee03d818c2e89f4d7e", bytes: 7351 }
	, "rust-container-1.json": { original: "build/vo1436-hosted-container-dispatch-93c60a0/rust-container-1.json", sha256: "b90abe4011f42be90e11e2cda638c160f71b0bdaf9e2a54dbf1bcc0ebb597df6", bytes: 7445 }
	, "rust.artifact.json": { original: "build/vo1436-hosted-container-dispatch-93c60a0/rust.artifact.json", sha256: "8f7361acdba9310d9e8c42c58a27c560b63f0d4bda722d6fb14159146c2ca362", bytes: 757 }
	, "rust.job.json": { original: "build/vo1436-hosted-container-dispatch-93c60a0/rust.job.json", sha256: "9304bff00f833ffa0c404d6cbdc2cf68f7d92186611cbda664ab931ca424502a", bytes: 6023 }
	, "rust.job.log": { original: "build/vo1436-hosted-container-dispatch-93c60a0/rust.job.log", sha256: "df26bf71d85c9fa7d2d36f1377bbcadab093a18213e90a97fec849a46dd86361", bytes: 464910 }
});
export const hostedContainerSources = Object.freeze({
	".github/workflows/consumer-matrix.yml": "f65f2adfde627a7860f4de7449cc4409318c0882bf959c8805106d6337e9dc61"
	, "tests/native-fin-containers.test.mjs": "7080d24a49f84f8a1e5abd3f51946243e75eb41539ef6ebdf3a33bdcc40b44c5"
	, "tests/helpers/fin-container-host-dispatch.mjs": "86f5552563e619bb7dcfc4c2c60d7811393adb334724c78921292e8cfbf87c9a"
	, "tests/helpers/fin-container-host-probes.mjs": "665ed67f9ae23e42d80d6e7ebac757df9fc2a85a7857f14cf2ac4687d7549284"
	, "tests/helpers/fin-container-host-dispatch-tests.mjs": "fb3d462b4f17bea1940c5f8a8359317ea8f60eb7de5139d5c19a22f3fbb1d957"
	, "tests/helpers/fin-container-dispatch.mjs": "b38adb2fb6026e8a8a6808d4a99247997d585344b6d20f7265c1639c671a09c9"
	, "tests/helpers/fin-container-install.mjs": "2024d6c6a44687293750c3ee5c25f092d689065e17beb8d535610963921c9329"
	, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
	, "tests/helpers/reviewed-fin-container-fixture.mjs": "5e4d92f9bb4ccff65fb9356cc3a6613f5102665e59dbe38b99868e4804c8a132"
	, "tests/fixtures/onboarding/native-fin-containers/FinContainers.lean": "f10a680c805bac2f8357b488c41d6f805cd394a9286e28bdcc7c356cedb014be"
	, "tests/fixtures/fin-container-consumers/python.py": "ee267c0ba444e24710624cd1e090cb4d5c8cd6bcad17201bbc7622cb2a780261"
	, "tests/fixtures/fin-container-consumers/rust.rs": "da7f42bc0719d4f6ca1134bb6be473d5b4e82beece57f91518907d729236278a"
	, "src/analyze/NativeExports.lean": "46b46cbb21fe51d166ab700cde2c41583bc3a093f67cecd07d104cdf649f61ce"
	, "src/analyze/native-types.mjs": "6e3612687fc26c12d8cacc0eb07612598c0bb16eaa61026165dddebdef4ff971"
	, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
	, "src/build/native-project.mjs": "b941e848c291a05a4fab3e93f2d9f5d3a5c9380f9a290c5668378c05ae5b5cf7"
	, "src/build/component-refinements.mjs": "ee003a614e93bbfa542625357eb5ff752c5af4805f9e2f81ca5168ccd1134df8"
	, "src/backends/c/native-copied-values.mjs": "ba14b12ba6d0f7df8ff091f472d70fd74c003e78e1ac6e58dc8170eee2163640"
	, "src/backends/python/copied-values.mjs": "8c0c6432d1bbccca1d6608757d56345ae5f50fa7746ee8e615c212cbf0799cc7"
	, "src/backends/rust/copied-values.mjs": "e3c604b3c9a70cbfa664053dc4b6aa4bcee6c6aa80d1738929af8639cb0fbac1"
	, "src/build/native-python-artifacts.mjs": "01fa5c28acb7fdb67d85f00cd1f9f9e6e35344e25aaf2d65c3995d99bb7f99e6"
	, "src/build/native-artifacts.mjs": "5fd01aa0ad402df7512b90a63a22b1cacb97ff0a06f2a44e1bd9a5089f7ffbc4"
});
