/**
 * Implements the package gate module in the binding IR subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";

import { generateCBindingPackage } from "../backends/c/generate.mjs";
import { generateCppBindingPackage } from "../backends/cpp/generate.mjs";
import { generateDotnetBindingPackage } from "../backends/dotnet/generate.mjs";
import { generateJavaScriptPackage } from "../backends/javascript/generate.mjs";
import { generateJvmBindingPackage } from "../backends/jvm/generate.mjs";
import { generatePhpBindingPackage } from "../backends/php/generate.mjs";
import { generatePythonBindingPackage } from "../backends/python/generate.mjs";
import { generateRustBindingPackage } from "../backends/rust/generate.mjs";
import { generateRubyBindingPackage } from "../backends/ruby/generate.mjs";
import { canonicalizeJsonValue, hashBindingIr } from "./canonical.mjs";

/**
 * Reports generated package gate failures with stable machine-readable codes and structured diagnostic context.
 */
export class GeneratedPackageGateError extends Error
{
	/**
   * Initializes the error used to report generated package gate failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "GeneratedPackageGateError";
		this.code = code;
		this.details = Object.freeze(structuredClone(details));
	}
}

const fail = (code, message, details = {}) => {
	throw new GeneratedPackageGateError(code, message, details);
};

const BACKENDS = Object.freeze([
	Object.freeze({ id: "javascript", generate: generateJavaScriptPackage })
	, Object.freeze({ id: "php", generate: generatePhpBindingPackage })
	, Object.freeze({ id: "python", generate: generatePythonBindingPackage })
	, Object.freeze({ id: "c", generate: generateCBindingPackage })
	, Object.freeze({ id: "cpp", generate: generateCppBindingPackage })
	, Object.freeze({ id: "rust", generate: generateRustBindingPackage })
	, Object.freeze({ id: "dotnet", generate: generateDotnetBindingPackage })
	, Object.freeze({ id: "jvm", generate: generateJvmBindingPackage })
	, Object.freeze({ id: "ruby", generate: generateRubyBindingPackage })
]);

/**
 * Generates binding packages from validated semantic input without introducing behavior outside the closed Binding IR semantic contract.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 */
export const generateBindingPackages = ir => Object.freeze(Object.fromEntries(
	BACKENDS.map(backend => [backend.id, Object.freeze({ ...backend.generate(ir) })]),
));

const sha256 = source => createHash("sha256").update(source, "utf8").digest("hex");

const packageManifest = (backend, files) => {
	const source = files["binding-manifest.json"];
	if(typeof source !== "string")
	{
		fail("missing-package-manifest", `${backend} package has no binding manifest`, { backend });
	}
	try
	{
		return JSON.parse(source);
	} catch
	{
		fail("invalid-package-manifest", `${backend} package manifest is not valid JSON`, { backend });
	}
};

const docsFor = files => Object.keys(files).filter(path => /(?:^|\/)README\.md$/.test(path));

const publicFilesFor = (backend, manifest, files) => {
	if(backend === "javascript")
	{
		return ["index.mjs", "index.d.ts", "package.json", ...docsFor(files)];
	}
	if(backend === "python")
	{
		return [manifest.publicModule, manifest.typeStub, "pyproject.toml", ...docsFor(files)];
	}
	if(backend === "php")
	{
		return [...manifest.publicFiles, manifest.stub, "composer.json", ...docsFor(files)];
	}
	if(backend === "c") return [manifest.publicHeader, ...docsFor(files)];
	if(backend === "cpp") return [manifest.publicHeader, ...docsFor(files)];
	if(backend === "rust") return [manifest.publicModule, "Cargo.toml", ...docsFor(files)];
	if(new Set(["dotnet", "jvm", "ruby"]).has(backend))
	{
		return [...manifest.publicFiles, ...docsFor(files)];
	}
	fail("unknown-backend", `no public-file policy exists for ${backend}`, { backend });
};

const forbiddenText = Object.freeze([
	Object.freeze({ code: "generic-dispatch", pattern: /\b(?:ccall|cwrap)\b|\bgeneric dispatch(?:er)?\b/i })
	, Object.freeze({ code: "private-symbol", pattern: /_bridge_/i })
	, Object.freeze({ code: "raw-wasm", pattern: /\bWebAssembly\b/ })
	, Object.freeze({ code: "calling-convention", pattern: /\bcalling convention\b|\bownership flags?\b/i })
]);

/**
 * Checks generated public surface and returns structured evidence instead of relying on prose diagnostics in the closed Binding IR semantic contract.
 *
 * @param backend - Backend identifier or implementation selected for generation, execution, or package projection.
 * @param files - Generated file map or inventory checked for required paths, content, and public-surface constraints.
 */
export const auditGeneratedPublicSurface = (backend, files) => {
	const manifest = packageManifest(backend, files);
	const publicFiles = publicFilesFor(backend, manifest, files);
	for(const path of publicFiles)
	{
		const source = files[path];
		if(typeof source !== "string")
		{
			fail("missing-public-file", `${backend} package is missing public file ${path}`, {
				backend
				, path
			});
		}
		for(const rule of forbiddenText)
		{
			if(rule.pattern.test(source))
			{
				fail(rule.code, `${backend} public file ${path} exposes forbidden bridge machinery`, {
					backend
					, path
				});
			}
		}
	}
	return Object.freeze({ backend, publicFiles: Object.freeze(publicFiles) });
};

const fileRecords = files => Object.keys(files).sort().map(path => Object.freeze({
	path
	, bytes: Buffer.byteLength(files[path], "utf8")
	, sha256: sha256(files[path])
}));

const fileSetHash = records => sha256(records.map(record =>
	`${record.path}\0${record.bytes}\0${record.sha256}\n`
).join(""));

const deepFreeze = value => {
	if(value !== null && typeof value === "object" && !Object.isFrozen(value))
	{
		for(const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
};

/**
 * Compiles generated package gate into the explicit representation consumed by the closed Binding IR semantic contract.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 */
export const compileGeneratedPackageGate = ir => {
	const packages = [];
	for(const backend of BACKENDS)
	{
		const first = backend.generate(ir);
		const second = backend.generate(structuredClone(ir));
		if(canonicalizeJsonValue(first, `${backend.id}.first`) !== canonicalizeJsonValue(second, `${backend.id}.second`))
		{
			fail("nondeterministic-generation", `${backend.id} generated different packages from the same Binding IR`, {
				backend: backend.id
			});
		}
		const manifest = packageManifest(backend.id, first);
		auditGeneratedPublicSurface(backend.id, first);
		const files = fileRecords(first);
		packages.push({
			backend: backend.id
			, generator: structuredClone(manifest.generator)
			, exports: [...manifest.exports]
			, capabilityGaps: structuredClone(manifest.capabilityGaps ?? [])
			, fileSetSha256: fileSetHash(files)
			, files
		});
	}
	return deepFreeze({
		schemaVersion: 1
		, component: ir.component.id
		, bindingIrSha256: hashBindingIr(ir)
		, packages
	});
};

const findDiffs = (expected, actual, path = "report", output = []) => {
	if(Object.is(expected, actual)) return output;
	if(
		expected === null || actual === null
    || typeof expected !== "object" || typeof actual !== "object"
    || Array.isArray(expected) !== Array.isArray(actual)
	) {
		output.push({ path, expected, actual });
		return output;
	}
	const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
	for(const key of [...keys].sort())
	{
		if(!(key in expected) || !(key in actual))
		{
			output.push({ path: `${path}.${key}`, expected: expected[key], actual: actual[key] });
			continue;
		}
		findDiffs(expected[key], actual[key], `${path}.${key}`, output);
	}
	return output;
};

/**
 * Rejects inputs when generated package gate would violate an invariant owned by the closed Binding IR semantic contract.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param expected - Expected generated package surface used to detect missing, extra, or changed files.
 */
export const assertGeneratedPackageGate = (ir, expected) => {
	const actual = compileGeneratedPackageGate(ir);
	const diffs = findDiffs(expected, actual);
	if(diffs.length > 0)
	{
		fail("generated-package-drift", "generated binding packages differ from the reviewed report", {
			diffs
			, expectedBindingIrSha256: expected?.bindingIrSha256
			, actualBindingIrSha256: actual.bindingIrSha256
		});
	}
	return actual;
};
