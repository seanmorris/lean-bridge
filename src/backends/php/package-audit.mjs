import { createHash } from "node:crypto";

import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import { compilePhpProjection } from "./projection.mjs";

/**
 * Reports PHP package audit failures with stable machine-readable codes and structured diagnostic context.
 */
export class PhpPackageAuditError extends Error
{
	/**
   * Initializes the error used to report PHP package audit failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "PhpPackageAuditError";
		this.code = code;
		this.details = Object.freeze(structuredClone(details));
	}
}

const fail = (code, message, details = {}) => {
	throw new PhpPackageAuditError(code, message, details);
};

const sha256 = source => createHash("sha256").update(source, "utf8").digest("hex");

const parseJson = (files, path) => {
	try
	{
		return JSON.parse(files[path]);
	} catch
	{
		fail("invalid-json", `generated PHP package is missing valid ${path}`, { path });
	}
};

const requireFile = (files, path) => {
	if(typeof files[path] !== "string")
	{
		fail("missing-file", `generated PHP package is missing ${path}`, { path });
	}
	return files[path];
};

const sorted = values => [...values].sort((left, right) => left.localeCompare(right));

const expectedExports = projection => [
	...(projection.requiredCapabilities.includes("bytes-value-v1") ? [`${projection.package.namespace}\\Bytes`] : [])
	, ...(projection.requiredCapabilities.includes("big-integer-value-v1") ? [`${projection.package.namespace}\\BigInteger`] : [])
	, ...(projection.requiredCapabilities.includes("bridge-awaitable-v1") ? [`${projection.package.namespace}\\Awaitable`] : [])
	, ...(projection.requiredCapabilities.includes("bridge-async-iterator-v1") ? [`${projection.package.namespace}\\AsyncIterator`] : [])
	, ...projection.types
    .filter(type => new Set(["value-object", "resource-object", "invokable-object"]).has(type.projection))
    .map(type => type.fqcn)
	, ...projection.errors.map(error => error.fqcn)
	, ...["RuntimeUnavailable", "InitializationError", "UnexpectedError"].map(name => `${projection.package.namespace}\\${name}`)
	, ...projection.operations
    .filter(operation => operation.public.kind === "function")
    .map(operation => `${projection.package.namespace}\\${operation.public.name}`)
].filter((value, index, values) => values.indexOf(value) === index);

const PUBLIC_FORBIDDEN = Object.freeze([
	{ code: "raw-dispatch", expression: /\bccall\b|\bcwrap\b/i, label: "a generic ABI call" }
	, { code: "raw-dispatch", expression: /\bfunction\s+(?:dispatch|invoke)\s*\(/i, label: "a generic dispatcher" }
	, { code: "raw-webassembly", expression: /\bWebAssembly\b/, label: "a WebAssembly object" }
	, { code: "raw-c-symbol", expression: /\b(?:uintptr_t|_bridge_[A-Za-z0-9_]*)\b/, label: "a C or bridge symbol" }
	, { code: "raw-identity", expression: /\b(?:pointer|handle|ownershipFlag|signatureId)\b/i, label: "raw identity state" }
	, { code: "raw-identity", expression: /\bpublic\s+function\s+[A-Za-z_][A-Za-z0-9_]*\([^)]*Internal\\Identity/, label: "an internal identity type" }
]);

const assertCleanPublicSurface = (source, path) => {
	for(const rule of PUBLIC_FORBIDDEN)
	{
		const match = rule.expression.exec(source);
		if(match)
		{
			fail(rule.code, `${path} exposes ${rule.label}`, {
				path
				, match: match[0]
				, offset: match.index
			});
		}
	}
};

/**
 * Checks PHP package and returns structured evidence instead of relying on prose diagnostics in the generated native-language binding pipeline.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param files - Generated file map or inventory checked for required paths, content, and public-surface constraints.
 */
export const auditPhpPackage = (ir, files) => {
	validateBindingIr(ir);
	if(files === null || typeof files !== "object" || Array.isArray(files))
	{
		fail("invalid-package", "generated PHP package must be a file map");
	}
	const projection = compilePhpProjection(ir);
	const manifest = parseJson(files, "binding-manifest.json");
	const composer = parseJson(files, "composer.json");
	const reflection = parseJson(files, "reflection.json");
	const gaps = parseJson(files, "capability-gaps.json");
	const assurance = parseJson(files, "assurance.json");
	const stub = requireFile(files, manifest.stub);
	requireFile(files, "README.md");

	if(
		manifest.schemaVersion !== 1
    || manifest.component !== ir.component.id
    || manifest.bindingIrSha256 !== hashBindingIr(ir)
    || manifest.generator?.id !== "lean-wasm/php"
    || manifest.generator?.version !== 1
	) {
		fail("manifest-identity-drift", "PHP binding manifest does not identify its generator and Binding IR", {
			manifest
		});
	}
	const expected = expectedExports(projection);
	if(JSON.stringify(manifest.exports) !== JSON.stringify(expected))
	{
		fail("public-export-drift", "PHP manifest exports differ from the shared projection", {
			expected
			, actual: manifest.exports
		});
	}
	const actualFiles = sorted(Object.keys(files));
	if(JSON.stringify(sorted(manifest.files ?? [])) !== JSON.stringify(actualFiles))
	{
		fail("manifest-file-drift", "PHP manifest does not name the complete generated file set", {
			expected: actualFiles
			, actual: sorted(manifest.files ?? [])
		});
	}
	const expectedHashedFiles = actualFiles.filter(path => path !== "binding-manifest.json");
	if(JSON.stringify(sorted(Object.keys(manifest.filesSha256 ?? {}))) !== JSON.stringify(expectedHashedFiles))
	{
		fail("manifest-hash-coverage-drift", "PHP manifest must hash every generated file except itself", {
			expected: expectedHashedFiles
			, actual: sorted(Object.keys(manifest.filesSha256 ?? {}))
		});
	}
	for(const [path, digest] of Object.entries(manifest.filesSha256 ?? {}))
	{
		const source = requireFile(files, path);
		if(sha256(source) !== digest)
		{
			fail("generated-file-drift", `${path} differs from the hash-bound generated package`, {
				path
				, expected: digest
				, actual: sha256(source)
			});
		}
	}
	if(Object.keys(manifest.filesSha256 ?? {}).includes("binding-manifest.json"))
	{
		fail("recursive-manifest-hash", "PHP binding manifest cannot hash itself");
	}
	const namespacePrefix = `${projection.package.namespace}\\`;
	const expectedPublicFiles = actualFiles.filter(path => path.startsWith("src/") && !path.startsWith("src/Internal/"));
	const expectedInternalFiles = actualFiles.filter(path => path.startsWith("src/Internal/"));
	if(
		JSON.stringify(sorted(manifest.publicFiles ?? [])) !== JSON.stringify(expectedPublicFiles)
    || JSON.stringify(sorted(manifest.internalFiles ?? [])) !== JSON.stringify(expectedInternalFiles)
	) {
		fail("package-surface-file-drift", "PHP manifest public and internal file sets differ from the package", {
			expectedPublicFiles
			, actualPublicFiles: sorted(manifest.publicFiles ?? [])
			, expectedInternalFiles
			, actualInternalFiles: sorted(manifest.internalFiles ?? [])
		});
	}
	if(
		composer.name !== projection.package.composerName
    || composer.version !== ir.component.version
    || composer.require?.php !== ">=8.2"
    || composer.autoload?.["psr-4"]?.[namespacePrefix] !== "src/"
    || JSON.stringify(composer.autoload?.files) !== JSON.stringify(["src/functions.php"])
    || composer.extra?.["lean-bridge"]?.bindingIrSha256 !== hashBindingIr(ir)
    || composer.extra?.["lean-bridge"]?.transportInterface !== projection.transport.interface
    || composer.extra?.["lean-bridge"]?.stub !== manifest.stub
	) {
		fail("composer-drift", "Composer metadata differs from the PHP projection", { composer });
	}
	if(
		reflection.component !== ir.component.id
    || reflection.bindingIrSha256 !== hashBindingIr(ir)
    || gaps.bindingIrSha256 !== hashBindingIr(ir)
    || assurance.bindingIrSha256 !== hashBindingIr(ir)
	) {
		fail("metadata-drift", "PHP metadata files do not identify the source Binding IR");
	}
	if(gaps.supported !== true || (gaps.capabilityGaps ?? []).some(gap => gap.blocking))
	{
		fail("blocking-capability-gap", "shared PHP package has an unresolved language projection gap", {
			capabilityGaps: gaps.capabilityGaps
		});
	}
	const marker = `Generated from Binding IR SHA-256 ${hashBindingIr(ir)}`;
	if(!stub.includes(marker))
	{
		fail("manual-stub", "PHP stub does not identify the Binding IR that generated it");
	}
	for(const path of [...(manifest.publicFiles ?? []), manifest.stub, "README.md"])
	{
		assertCleanPublicSurface(requireFile(files, path), path);
	}
	if(/\bmixed\b/.test(stub))
	{
		fail("untyped-public-api", "PHP stub exposes mixed on the supported public surface");
	}
	for(const exported of expected)
	{
		const localName = exported.slice(exported.lastIndexOf("\\") + 1);
		if(!stub.includes(localName))
		{
			fail("stub-export-drift", `PHP stub omits ${exported}`, { exported });
		}
	}
	return Object.freeze({
		schemaVersion: 1
		, bindingIrSha256: manifest.bindingIrSha256
		, exports: Object.freeze([...expected])
		, publicFiles: Object.freeze([...(manifest.publicFiles ?? [])])
		, internalFiles: Object.freeze([...(manifest.internalFiles ?? [])])
		, capabilityGaps: Object.freeze(cloneGaps(gaps.capabilityGaps ?? []))
	});
};

const cloneGaps = gaps => gaps.map(gap => Object.freeze(structuredClone(gap)));
