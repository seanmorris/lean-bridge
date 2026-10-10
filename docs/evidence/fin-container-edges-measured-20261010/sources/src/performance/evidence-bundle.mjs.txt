/**
 * Implements the evidence bundle module in the performance subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";

import { canonicalizeJsonValue } from "../binding-ir/canonical.mjs";
import { canonicalJson } from "../capsule/node.mjs";
import {
	assemblePerformanceCiReport,
	performanceCiFamilies,
	renderPerformanceCiSummary,
} from "./ci-report.mjs";
import { validatePerformanceCorpus } from "./corpus.mjs";

const sha256Pattern = /^[0-9a-f]{64}$/;
const commitPattern = /^[0-9a-f]{40}$/;
const sha256 = value => createHash("sha256").update(value).digest("hex");
const semanticSha256 = value => sha256(canonicalizeJsonValue(value));
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

const contractPaths = Object.freeze([
	"schema/performance-ci-report.schema.json"
	, "schema/performance-evidence-bundle.schema.json"
	, "schema/performance-evidence-index.schema.json"
	, "schema/performance-corpus.schema.json"
	, "schema/performance-workloads.schema.json"
	, "schema/performance-methodology.schema.json"
	, "schema/performance-result.schema.json"
	, "schema/performance-scaling-result.schema.json"
	, "schema/performance-overhead-result.schema.json"
	, "schema/performance-lifecycle-result.schema.json"
	, "schema/performance-self-consistency-result.schema.json"
	, "schema/performance-build-reproducibility.schema.json"
]);

/**
 * Reports performance evidence bundle failures with stable machine-readable codes and structured diagnostic context.
 */
export class PerformanceEvidenceBundleError extends Error
{
	/**
   * Initializes the error used to report performance evidence bundle failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "PerformanceEvidenceBundleError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new PerformanceEvidenceBundleError(code, message, details);
};

const exactKeys = (value, keys, label) => {
	if(!isObject(value)) fail("invalid-bundle", `${label} must be an object`);
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	if(JSON.stringify(actual) !== JSON.stringify(expected))
	{
		fail("invalid-bundle", `${label} fields must be closed`, { actual, expected });
	}
};

const nonEmptyString = (value, label) => {
	if(typeof value !== "string" || value.length === 0) fail("invalid-bundle", `${label} must be a non-empty string`);
};

const digest = (value, label) => {
	if(!sha256Pattern.test(value ?? "")) fail("invalid-bundle", `${label} must be a SHA-256 identity`);
};

const relativePath = (value, label) => {
	nonEmptyString(value, label);
	if(value.startsWith("/") || value.includes("\\") || value.split("/").includes(".."))
	{
		fail("unsafe-path", `${label} must be a portable relative path`, { path: value });
	}
};

const fileRecordKeys = Object.freeze(["path", "bytes", "sha256"]);
const validateFileRecord = (value, label) => {
	exactKeys(value, fileRecordKeys, label);
	relativePath(value.path, `${label}.path`);
	if(!Number.isSafeInteger(value.bytes) || value.bytes < 0) fail("invalid-bundle", `${label}.bytes must be non-negative`);
	digest(value.sha256, `${label}.sha256`);
};

const validateSourceRecord = (value, label) => {
	exactKeys(value, ["role", "sourcePath", ...fileRecordKeys], label);
	nonEmptyString(value.role, `${label}.role`);
	relativePath(value.sourcePath, `${label}.sourcePath`);
	validateFileRecord({ path: value.path, bytes: value.bytes, sha256: value.sha256 }, label);
};

const validateArtifactRecord = (value, label) => {
	exactKeys(value, ["role", "mediaType", "sourcePath", ...fileRecordKeys], label);
	nonEmptyString(value.role, `${label}.role`);
	nonEmptyString(value.mediaType, `${label}.mediaType`);
	relativePath(value.sourcePath, `${label}.sourcePath`);
	validateFileRecord({ path: value.path, bytes: value.bytes, sha256: value.sha256 }, label);
};

const validateMeasurementRecord = (value, label) => {
	exactKeys(value, ["family", "claimKind", "path", "bytes", "sha256", "semanticSha256"], label);
	if(!performanceCiFamilies.includes(value.family)) fail("invalid-bundle", `${label}.family is unsupported`);
	if(value.claimKind !== "compiled-artifact-measurement") fail("claim-kind-drift", `${label} must remain a measured artifact claim`);
	validateFileRecord({ path: value.path, bytes: value.bytes, sha256: value.sha256 }, label);
	digest(value.semanticSha256, `${label}.semanticSha256`);
};

/**
 * Validates performance evidence bundle against its closed contract before it enters the reproducible performance evidence pipeline.
 *
 * @param manifest - Domain manifest whose schema, closed fields, and recorded identities are validated or serialized.
 */
export const validatePerformanceEvidenceBundle = manifest => {
	exactKeys(manifest, [
		"schemaVersion"
		, "kind"
		, "identity"
		, "source"
		, "status"
		, "report"
		, "summary"
		, "validation"
		, "inputs"
		, "contracts"
		, "artifacts"
		, "measurements"
		, "claims"
		, "index"
	], "performance evidence bundle");
	if(manifest.schemaVersion !== 1 || manifest.kind !== "lean-bridge-performance-evidence-bundle")
	{
		fail("unsupported-bundle", "performance evidence bundle version is not supported");
	}
	exactKeys(manifest.identity, ["sha256"], "identity");
	digest(manifest.identity.sha256, "identity.sha256");
	exactKeys(manifest.source, ["commit", "dirty"], "source");
	if(!commitPattern.test(manifest.source.commit) || manifest.source.dirty !== false)
	{
		fail("invalid-source", "performance evidence must identify one clean committed source");
	}
	exactKeys(manifest.status, ["accepted", "informational", "policy", "budget"], "status");
	if(
		manifest.status.accepted !== true
    || manifest.status.informational !== true
    || manifest.status.policy !== "informational-no-approved-budget"
    || manifest.status.budget !== null
	) fail("invalid-status", "published performance evidence must be accepted and keep its budget status explicit");
	validateFileRecord(manifest.report, "report");
	validateFileRecord(manifest.summary, "summary");
	validateFileRecord(manifest.validation, "validation");
	for(const [field, validator] of [
		["inputs", validateSourceRecord]
		, ["contracts", validateSourceRecord]
		, ["artifacts", validateArtifactRecord]
		, ["measurements", validateMeasurementRecord]
	]) {
		if(!Array.isArray(manifest[field]) || manifest[field].length === 0) fail("invalid-bundle", `${field} must not be empty`);
		manifest[field].forEach((value, index) => validator(value, `${field}[${index}]`));
	}
	const families = new Set(manifest.measurements.map(value => value.family));
	if(families.size !== performanceCiFamilies.length || performanceCiFamilies.some(value => !families.has(value)))
	{
		fail("missing-measurement", "the evidence bundle must contain every performance family");
	}
	exactKeys(manifest.claims, ["complexity"], "claims");
	validateFileRecord(manifest.claims.complexity, "claims.complexity");
	validateFileRecord(manifest.index, "index");
	return true;
};

const validateComplexityMetric = (value, label) => {
	exactKeys(value, ["state", "bound", "evidence"], label);
	if(!["proved", "asserted", "unknown"].includes(value.state)) fail("invalid-index", `${label}.state is unsupported`);
	if(value.state === "unknown")
	{
		if(value.bound !== null || value.evidence !== null) fail("proof-laundering", `${label} cannot attach evidence to an unknown claim`);
		return;
	}
	nonEmptyString(value.bound, `${label}.bound`);
	if(!isObject(value.evidence)) fail("invalid-index", `${label}.evidence must be an object`);
	exactKeys(value.evidence, ["id", "state", "basis", "theorem"], `${label}.evidence`);
	nonEmptyString(value.evidence.id, `${label}.evidence.id`);
	nonEmptyString(value.evidence.state, `${label}.evidence.state`);
	nonEmptyString(value.evidence.basis, `${label}.evidence.basis`);
	if(value.evidence.theorem !== null) nonEmptyString(value.evidence.theorem, `${label}.evidence.theorem`);
	if(value.state === "proved" && (value.evidence.state !== "proved" || value.evidence.theorem === null))
	{
		fail("proof-laundering", `${label} claims a proof without theorem-backed evidence`);
	}
};

/**
 * Validates performance evidence index against its closed contract before it enters the reproducible performance evidence pipeline.
 *
 * @param index - Zero-based position of the item being processed.
 */
export const validatePerformanceEvidenceIndex = index => {
	exactKeys(index, ["schemaVersion", "kind", "component", "source", "evidence", "properties"], "performance evidence index");
	if(index.schemaVersion !== 1 || index.kind !== "lean-bridge-performance-property-index")
	{
		fail("unsupported-index", "performance evidence index version is not supported");
	}
	exactKeys(index.component, ["id", "version"], "component");
	nonEmptyString(index.component.id, "component.id");
	nonEmptyString(index.component.version, "component.version");
	exactKeys(index.source, ["commit"], "index source");
	if(!commitPattern.test(index.source.commit)) fail("invalid-index", "index source commit is invalid");
	exactKeys(index.evidence, ["identitySha256", "manifestPath", "reportPath", "reportSha256", "summaryPath"], "index evidence");
	digest(index.evidence.identitySha256, "index evidence identity");
	relativePath(index.evidence.manifestPath, "index evidence manifestPath");
	relativePath(index.evidence.reportPath, "index evidence reportPath");
	digest(index.evidence.reportSha256, "index evidence reportSha256");
	relativePath(index.evidence.summaryPath, "index evidence summaryPath");
	exactKeys(index.properties, ["runtime", "targets", "performance", "interfaces"], "index properties");
	if(index.properties.runtime !== "shared-application-runtime") fail("private-runtime", "indexed components must share the application runtime");
	if(!Array.isArray(index.properties.targets) || index.properties.targets.length === 0) fail("invalid-index", "index targets must not be empty");
	exactKeys(index.properties.performance, ["claimKind", "informational", "budget", "families"], "index performance");
	if(
		index.properties.performance.claimKind !== "compiled-artifact-measurement"
    || index.properties.performance.informational !== true
    || index.properties.performance.budget !== null
	) fail("claim-kind-drift", "measured performance must remain informational without an approved budget");
	if(!Array.isArray(index.properties.interfaces) || index.properties.interfaces.length === 0) fail("invalid-index", "indexed interfaces must not be empty");
	for(const [position, item] of index.properties.interfaces.entries())
	{
		const label = `index properties.interfaces[${position}]`;
		exactKeys(item, ["component", "interface", "complexity"], label);
		nonEmptyString(item.component, `${label}.component`);
		nonEmptyString(item.interface, `${label}.interface`);
		exactKeys(item.complexity, ["claimKind", "time", "auxiliarySpace"], `${label}.complexity`);
		if(item.complexity.claimKind !== "algorithmic-complexity") fail("claim-kind-drift", `${label} must identify algorithmic complexity`);
		validateComplexityMetric(item.complexity.time, `${label}.complexity.time`);
		validateComplexityMetric(item.complexity.auxiliarySpace, `${label}.complexity.auxiliarySpace`);
	}
	return true;
};

const ensureEmptyOutput = async output => {
	await mkdir(output, { recursive: true });
	if((await readdir(output)).length !== 0) fail("output-not-empty", `performance evidence output is not empty: ${output}`);
};

const safeAbsolute = (root, path) => {
	relativePath(path, "source path");
	const absolute = resolve(root, path);
	if(absolute !== root && !absolute.startsWith(`${root}${sep}`)) fail("unsafe-path", `source path escapes the project: ${path}`);
	return absolute;
};

const mediaType = path => {
	if(path.endsWith(".wasm")) return "application/wasm";
	if(path.endsWith(".json")) return "application/json";
	if(path.endsWith(".mjs") || path.endsWith(".js")) return "text/javascript";
	if(path.endsWith(".d.ts") || path.endsWith(".ts")) return "text/typescript";
	if([".c", ".h", ".map", ".txt", ".lean"].includes(extname(path))) return "text/plain";
	return "application/octet-stream";
};

const artifactRole = path => {
	if(path.endsWith(".wasm")) return "wasm";
	if(path.endsWith(".d.ts") || path.includes("/bindings/") || /bindings\.(mjs|js)$/.test(path)) return "generated-binding";
	if(path.includes("/audit/") || path.endsWith(".link.map")) return "build-audit";
	if(path.endsWith(".json")) return "build-metadata";
	return "build-artifact";
};

const copyVerified = async ({ project, output, sourcePath, bundlePath, expected, role, artifact = false }) => {
	const source = safeAbsolute(project, sourcePath);
	const bytes = await readFile(source).catch(error => {
    if(error.code === "ENOENT") fail("missing-file", `evidence source is missing: ${sourcePath}`);
    throw error;
	});
	const actual = { bytes: bytes.length, sha256: sha256(bytes) };
	if(expected && (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256))
	{
		fail("artifact-drift", `evidence source changed: ${sourcePath}`, { expected, actual });
	}
	const target = safeAbsolute(output, bundlePath);
	await mkdir(dirname(target), { recursive: true });
	await copyFile(source, target);
	return artifact
		? Object.freeze({ role, mediaType: mediaType(sourcePath), sourcePath, path: bundlePath, ...actual })
		: Object.freeze({ role, sourcePath, path: bundlePath, ...actual });
};

const writeRecord = async (output, path, value) => {
	const contents = canonicalJson(value);
	const absolute = safeAbsolute(output, path);
	await mkdir(dirname(absolute), { recursive: true });
	await writeFile(absolute, contents);
	return Object.freeze({ path, bytes: Buffer.byteLength(contents), sha256: sha256(contents) });
};

const fileRecord = async (path, contents) => Object.freeze({
	path
	, bytes: Buffer.byteLength(contents)
	, sha256: sha256(contents)
});

const auditReport = report => {
	exactKeys(report, [
		"schemaVersion"
		, "kind"
		, "recordedAt"
		, "accepted"
		, "informational"
		, "source"
		, "workflow"
		, "toolchain"
		, "identities"
		, "build"
		, "jobs"
		, "measurements"
		, "validation"
		, "policy"
		, "artifact"
		, "limitations"
	], "performance report");
	if(report.schemaVersion !== 1 || report.kind !== "lean-bridge-performance-ci-report")
	{
		fail("unsupported-report", "performance report version is not supported");
	}
	if(
		!isObject(report) || report.accepted !== true || report.informational !== true
    || report.validation?.accepted !== true || report.validation?.issueCount !== 0
    || report.policy?.status !== "informational-no-approved-budget" || report.policy?.budget !== null
    || report.policy?.regressionFailureAuthorized !== false
	) fail("unaccepted-report", "only accepted informational evidence can become a published performance bundle");
	if(!commitPattern.test(report.source?.commit ?? "") || report.source?.dirty !== false)
	{
		fail("invalid-source", "the performance report must identify one clean committed source");
	}
	const artifacts = report.build?.artifacts;
	if(!Array.isArray(artifacts) || artifacts.length === 0) fail("missing-artifacts", "the performance report has no build artifacts");
	const paths = new Set();
	let totalBytes = 0;
	for(const item of artifacts)
	{
		relativePath(item.path, "build artifact path");
		if(paths.has(item.path)) fail("duplicate-artifact", `duplicate measured artifact ${item.path}`);
		paths.add(item.path);
		if(!Number.isSafeInteger(item.bytes) || item.bytes < 0) fail("invalid-artifact", `invalid bytes for ${item.path}`);
		digest(item.sha256, `artifact ${item.path}`);
		totalBytes += item.bytes;
	}
	if(
		report.build.artifactCount !== artifacts.length
    || report.build.totalBytes !== totalBytes
    || report.build.sha256 !== semanticSha256(artifacts)
	) fail("build-inventory-drift", "the performance report build inventory does not match its aggregate identity");
	const records = {};
	for(const family of performanceCiFamilies)
	{
		const measurement = report.measurements?.[family];
		if(!isObject(measurement) || !isObject(measurement.record) || measurement.sha256 !== semanticSha256(measurement.record))
		{
			fail("measurement-drift", `${family} does not match its semantic identity`);
		}
		records[family] = measurement.record;
	}
	const rechecked = assemblePerformanceCiReport({
		manifest: {
			schemaVersion: 1
			, kind: "lean-bridge-performance-ci-manifest"
			, recordedAt: report.recordedAt
			, source: report.source
			, workflow: report.workflow
			, toolchain: report.toolchain
			, identities: report.identities
			, artifacts
			, resource: {}
			, limitations: []
		}
		, records
		, jobs: report.jobs
		, artifact: report.artifact
	});
	if(!rechecked.accepted) fail("report-audit-failed", "the accepted report does not pass an independent aggregate audit", { issues: rechecked.validation.issues });
	return records;
};

const complexityMetric = (metric, evidence) => {
	if(metric.state === "unknown") return Object.freeze({ state: "unknown", bound: null, evidence: null });
	const source = evidence.get(metric.evidence);
	return Object.freeze({
		state: metric.state
		, bound: metric.bound
		, evidence: Object.freeze({ id: source.id, state: source.state, basis: source.basis, theorem: source.theorem })
	});
};

const complexityClaims = corpus => {
	const evidence = new Map(corpus.evidence.map(value => [value.id, value]));
	return corpus.interfaces.map(value => Object.freeze({
		component: value.component
		, interface: value.id
		, complexity: Object.freeze({
			claimKind: "algorithmic-complexity"
			, time: complexityMetric(value.complexity.time, evidence)
			, auxiliarySpace: complexityMetric(value.complexity.auxiliarySpace, evidence)
		})
	}));
};

const bundleFiles = manifest => [
	manifest.report
	, manifest.summary
	, manifest.validation
	, ...manifest.inputs
	, ...manifest.contracts
	, ...manifest.artifacts
	, ...manifest.measurements
	, manifest.claims.complexity
	, manifest.index
];

/**
 * Loads verified performance evidence bundle, verifies its structure and identity, and returns it to the reproducible performance evidence pipeline.
 *
 * @param bundleRoot - Filesystem root containing the bundle.
 */
export const readVerifiedPerformanceEvidenceBundle = async bundleRoot => {
	const root = resolve(bundleRoot);
	const manifestSource = await readFile(join(root, "performance-evidence.json"), "utf8");
	const manifest = JSON.parse(manifestSource);
	validatePerformanceEvidenceBundle(manifest);
	const manifestSha256 = sha256(manifestSource);
	const inventory = await readFile(join(root, "performance-evidence.sha256"), "utf8");
	if(inventory !== `${manifestSha256}  performance-evidence.json\n`)
	{
		fail("manifest-drift", "the performance evidence manifest hash inventory does not match");
	}
	const paths = new Set();
	for(const record of bundleFiles(manifest))
	{
		if(paths.has(record.path)) fail("duplicate-bundle-path", `duplicate bundle path ${record.path}`);
		paths.add(record.path);
		const bytes = await readFile(safeAbsolute(root, record.path));
		if(bytes.length !== record.bytes || sha256(bytes) !== record.sha256)
		{
			fail("bundle-file-drift", `performance evidence file changed: ${record.path}`);
		}
	}
	const [report, index] = await Promise.all([
		readFile(join(root, manifest.report.path), "utf8").then(JSON.parse)
		, readFile(join(root, manifest.index.path), "utf8").then(JSON.parse)
	]);
	auditReport(report);
	validatePerformanceEvidenceIndex(index);
	const identitySha256 = semanticSha256({
		source: manifest.source
		, reportSha256: manifest.report.sha256
		, buildSha256: report.build.sha256
		, inputs: manifest.inputs.map(({ role, sourcePath, sha256: value }) => ({ role, sourcePath, sha256: value }))
		, measurements: manifest.measurements.map(({ family, semanticSha256: value }) => ({ family, semanticSha256: value }))
		, complexitySha256: manifest.claims.complexity.sha256
	});
	if(
		identitySha256 !== manifest.identity.sha256
    || index.evidence.identitySha256 !== identitySha256
    || index.evidence.reportPath !== manifest.report.path
    || index.evidence.reportSha256 !== manifest.report.sha256
    || index.evidence.summaryPath !== manifest.summary.path
    || index.source.commit !== manifest.source.commit
	) fail("bundle-identity-drift", "the evidence manifest, report, and property index identify different subjects");
	return Object.freeze({ root, manifest, index, identitySha256, manifestSha256 });
};

/**
 * Builds performance evidence bundle from validated inputs with deterministic output suitable for the reproducible performance evidence pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to build performance evidence bundle.
 * @param root0.projectRoot - Filesystem root containing the project.
 * @param root0.reportPath - Filesystem path to the report.
 * @param root0.summaryPath - Filesystem path to the summary.
 * @param root0.validationPath - Filesystem path to the validation.
 * @param root0.outputRoot - Filesystem root containing the output.
 * @param root0.verifyProjectRevision - Injected check that proves the evidence bundle matches the requested source revision.
 */
export const buildPerformanceEvidenceBundle = async ({
	projectRoot
	, reportPath
	, summaryPath
	, validationPath
	, outputRoot
	, verifyProjectRevision = true
}) => {
	const project = resolve(projectRoot);
	const output = resolve(outputRoot);
	await ensureEmptyOutput(output);

	const [reportSource, summarySource, validationSource] = await Promise.all([
		readFile(resolve(reportPath), "utf8")
		, readFile(resolve(summaryPath), "utf8")
		, readFile(resolve(validationPath), "utf8")
	]);
	const report = JSON.parse(reportSource);
	const validation = JSON.parse(validationSource);
	const records = auditReport(report);
	if(verifyProjectRevision)
	{
		const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
		const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=all", "--", "."], {
			cwd: project
			, encoding: "utf8"
		}).trim();
		if(revision !== report.source.commit || dirty !== "")
		{
			fail("source-checkout-drift", "the evidence bundle must be built from the clean source revision named by the report", {
				expected: report.source.commit
				, actual: revision
				, dirty: dirty !== ""
			});
		}
	}
	if(canonicalizeJsonValue(validation) !== canonicalizeJsonValue(report.validation))
	{
		fail("validation-drift", "the standalone validation report differs from the aggregate report");
	}
	if(summarySource !== renderPerformanceCiSummary(report))
	{
		fail("summary-drift", "the accessible summary differs from the aggregate report");
	}

	await mkdir(join(output, "reports"), { recursive: true });
	await writeFile(join(output, "reports/report.json"), reportSource);
	await writeFile(join(output, "reports/summary.md"), summarySource);
	await writeFile(join(output, "reports/validation.json"), validationSource);
	const reportRecord = await fileRecord("reports/report.json", reportSource);
	const summaryRecord = await fileRecord("reports/summary.md", summarySource);
	const validationRecord = await fileRecord("reports/validation.json", validationSource);

	const inputs = [];
	for(const [role, identity] of Object.entries(report.identities).sort(([left], [right]) => left.localeCompare(right)))
	{
		inputs.push(await copyVerified({
			project
			, output
			, sourcePath: identity.path
			, bundlePath: `inputs/${identity.path}`
			, expected: identity
			, role
		}));
	}

	const contracts = [];
	for(const sourcePath of contractPaths)
	{
		contracts.push(await copyVerified({ project, output, sourcePath, bundlePath: `contracts/${sourcePath}`, role: "schema" }));
	}

	const artifacts = [];
	for(const item of report.build.artifacts)
	{
		artifacts.push(await copyVerified({
			project
			, output
			, sourcePath: item.path
			, bundlePath: `artifacts/${item.path}`
			, expected: item
			, role: artifactRole(item.path)
			, artifact: true
		}));
	}

	const measurements = [];
	for(const family of performanceCiFamilies)
	{
		const path = `measurements/${family}.json`;
		const record = await writeRecord(output, path, records[family]);
		measurements.push(Object.freeze({
			family
			, claimKind: "compiled-artifact-measurement"
			, ...record
			, semanticSha256: report.measurements[family].sha256
		}));
	}

	const corpusInput = inputs.find(value => value.role === "corpus");
	const corpus = JSON.parse(await readFile(join(output, corpusInput.path), "utf8"));
	validatePerformanceCorpus(corpus);
	const claims = Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-algorithmic-complexity-claims"
		, corpus: Object.freeze({ path: corpusInput.path, sha256: corpusInput.sha256 })
		, claims: Object.freeze(complexityClaims(corpus))
	});
	const complexityRecord = await writeRecord(output, "claims/complexity.json", claims);

	const identitySha256 = semanticSha256({
		source: report.source
		, reportSha256: reportRecord.sha256
		, buildSha256: report.build.sha256
		, inputs: inputs.map(({ role, sourcePath, sha256: value }) => ({ role, sourcePath, sha256: value }))
		, measurements: measurements.map(({ family, semanticSha256: value }) => ({ family, semanticSha256: value }))
		, complexitySha256: complexityRecord.sha256
	});
	const index = Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-performance-property-index"
		, component: Object.freeze({ id: corpus.id, version: corpus.version })
		, source: Object.freeze({ commit: report.source.commit })
		, evidence: Object.freeze({
			identitySha256
			, manifestPath: "performance-evidence.json"
			, reportPath: reportRecord.path
			, reportSha256: reportRecord.sha256
			, summaryPath: summaryRecord.path
		})
		, properties: Object.freeze({
			runtime: "shared-application-runtime"
			, targets: Object.freeze(["wasm32-emscripten"])
			, performance: Object.freeze({
				claimKind: "compiled-artifact-measurement"
				, informational: true
				, budget: null
				, families: Object.freeze([...performanceCiFamilies])
			})
			, interfaces: Object.freeze(complexityClaims(corpus))
		})
	});
	validatePerformanceEvidenceIndex(index);
	const indexRecord = await writeRecord(output, "metadata/property-index.json", index);

	const manifest = Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-performance-evidence-bundle"
		, identity: Object.freeze({ sha256: identitySha256 })
		, source: report.source
		, status: Object.freeze({
			accepted: true
			, informational: true
			, policy: "informational-no-approved-budget"
			, budget: null
		})
		, report: reportRecord
		, summary: summaryRecord
		, validation: validationRecord
		, inputs: Object.freeze(inputs)
		, contracts: Object.freeze(contracts)
		, artifacts: Object.freeze(artifacts)
		, measurements: Object.freeze(measurements)
		, claims: Object.freeze({ complexity: complexityRecord })
		, index: indexRecord
	});
	validatePerformanceEvidenceBundle(manifest);
	const manifestSource = canonicalJson(manifest);
	const manifestSha256 = sha256(manifestSource);
	await writeFile(join(output, "performance-evidence.json"), manifestSource);
	await writeFile(join(output, "performance-evidence.sha256"), `${manifestSha256}  performance-evidence.json\n`);
	return Object.freeze({ output, identitySha256, manifestSha256, artifactCount: artifacts.length });
};
