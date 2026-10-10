/**
 * Implements the engine output comparison module in the build subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * Reports engine output comparison failures with stable machine-readable codes and structured diagnostic context.
 */
export class EngineOutputComparisonError extends Error
{
	/**
   * Initializes the error used to report engine output comparison failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "EngineOutputComparisonError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new EngineOutputComparisonError(code, message, details);
};

const sha256 = value => createHash("sha256").update(value).digest("hex");

const readJson = async (path, label) => {
	try
	{
		return JSON.parse(await readFile(path, "utf8"));
	} catch(error)
	{
		fail("engine-output-invalid-json", `${label} is missing or invalid`, { path, cause: error.message });
	}
};

const inventory = async root => {
	const files = [];
	const visit = async relative => {
		for(const entry of await readdir(join(root, relative), { withFileTypes: true }))
		{
			const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
			if(entry.isDirectory()) await visit(path);
			else if(entry.isFile())
			{
				const bytes = await readFile(join(root, path));
				files.push(Object.freeze({ path, bytes: bytes.length, sha256: sha256(bytes) }));
			} else fail("engine-output-unsupported-entry", `Bundle contains a non-file entry: ${path}`, { path });
		}
	};
	await visit("");
	return files.sort((left, right) => left.path.localeCompare(right.path));
};

const withoutBackend = report => {
	const { backend, ...common } = report;
	return { backend, common };
};

/**
 * Compares component engine outputs and returns bounded diagnostics for every material difference.
 *
 * @param root0 - Named inputs and dependency overrides used to compare component engine outputs.
 * @param root0.nativeRoot - Filesystem root containing the native.
 * @param root0.dockerRoot - Filesystem root containing the docker.
 */
export const compareComponentEngineOutputs = async ({ nativeRoot, dockerRoot }) => {
	const native = resolve(nativeRoot);
	const docker = resolve(dockerRoot);
	const [nativeRequest, dockerRequest, nativeReport, dockerReport, nativeFiles, dockerFiles] = await Promise.all([
		readFile(join(native, "engine-execution-request.json"))
		, readFile(join(docker, "engine-execution-request.json"))
		, readJson(join(native, "engine-execution-report.json"), "Native execution report")
		, readJson(join(docker, "engine-execution-report.json"), "Docker execution report")
		, inventory(join(native, "bundle"))
		, inventory(join(docker, "bundle"))
	]);
	if(!nativeRequest.equals(dockerRequest)) fail("engine-request-backend-drift", "Native and Docker builds did not consume identical execution request bytes");
	const nativeExecution = withoutBackend(nativeReport);
	const dockerExecution = withoutBackend(dockerReport);
	if(nativeExecution.backend !== "native-nix" || dockerExecution.backend !== "docker-nix") fail("engine-report-backend-invalid", "Execution reports do not identify the expected backends", { native: nativeExecution.backend, docker: dockerExecution.backend });
	if(JSON.stringify(nativeExecution.common) !== JSON.stringify(dockerExecution.common)) fail("engine-report-backend-drift", "Execution reports differ outside the backend label");
	if(JSON.stringify(nativeFiles) !== JSON.stringify(dockerFiles)) fail("engine-authorized-output-drift", "Authorized component bundle outputs differ between native Nix and Docker", { native: nativeFiles, docker: dockerFiles });
	const requestSha256 = sha256(nativeRequest);
	if(nativeReport.requestSha256 !== requestSha256) fail("engine-report-request-drift", "Execution reports do not identify the compared request", { requestSha256 });
	return Object.freeze({
		schemaVersion: 1
		, status: "passed"
		, requestSha256
		, engineIdentitySha256: nativeReport.engineIdentitySha256
		, bundleManifestSha256: nativeReport.bundleManifestSha256
		, bundleIdentitySha256: nativeReport.bundleIdentitySha256
		, comparedFileCount: nativeFiles.length
		, comparedBytes: nativeFiles.reduce((total, file) => total + file.bytes, 0)
		, backendReportDifference: "backend-label-only"
		, files: Object.freeze(nativeFiles)
	});
};
