/**
 * Read language-neutral export selection without modifying the Lean project.
 *
 * @file
 */
import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { componentNpmIdentity } from "../release/component-package-receipt.mjs";

export const exportConfigurationFile = "lean-bridge.exports.json";
const legacyFile = "lean-bridge.native.json";
const leanName = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/;
export const exportTargets = Object.freeze([
	"npm", "pypi", "cargo", "c", "cpp", "nuget", "maven", "rubygems"
	, "cpan", "php-native", "php-wasm", "wit-wasi"
]);

/** Reports invalid or unsupported author choices before compilation. */
export class ExportConfigurationError extends Error
{
	/**
	 * Preserve the configuration diagnostic for CLI and build callers.
	 *
	 * @param code - Stable diagnostic identifier.
	 * @param message - Author-facing explanation.
	 */
	constructor(code, message)
	{
		super(message);
		this.name = "ExportConfigurationError";
		this.code = code;
	}
}

const fail = (code, message) => { throw new ExportConfigurationError(code, message); };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const closed = (value, keys, label) => {
	if(!object(value) || Object.keys(value).some(key => !keys.includes(key)))
		fail("invalid-export-configuration", `${label} has invalid fields`);
};
const frozen = value => {
	if(object(value) || Array.isArray(value))
	{
		Object.values(value).forEach(frozen);
		Object.freeze(value);
	}
	return value;
};

/**
 * Validate the closed shared configuration. Backend capability checks are separate.
 *
 * @param configuration - Parsed author configuration.
 */
export const validateExportConfiguration = configuration => {
	closed(configuration, ["schemaVersion", "modules", "exports", "resources", "arities", "targets"], exportConfigurationFile);
	if(configuration.schemaVersion !== 1) fail("invalid-export-configuration", `${exportConfigurationFile} requires schemaVersion 1`);
	for(const key of ["modules", "exports", "resources"])
	{
		if(configuration[key] === undefined) continue;
		const values = configuration[key];
		if(!Array.isArray(values) || (key !== "resources" && values.length === 0)
			|| values.some(value => typeof value !== "string" || !leanName.test(value))
			|| new Set(values).size !== values.length)
			fail("invalid-export-configuration", `${key} must contain unique Lean names${key === "resources" ? "" : " and must not be empty"}`);
	}
	if(configuration.arities !== undefined)
	{
		if(!object(configuration.arities) || Object.entries(configuration.arities).some(([name, arity]) =>
			!leanName.test(name) || !Number.isSafeInteger(arity) || arity < 0 || arity > 32))
			fail("invalid-export-configuration", "arities must map Lean names to argument counts from 0 to 32");
		if(configuration.exports && Object.keys(configuration.arities).some(name => !configuration.exports.includes(name)))
			fail("invalid-export-configuration", "Every configured arity must refer to a selected export");
	}
	if(configuration.targets !== undefined)
	{
		closed(configuration.targets, exportTargets, "targets (use cpan, not the perl CLI alias)");
		for(const [target, settings] of Object.entries(configuration.targets))
		{
			closed(settings, target === "cpan" ? ["module", "version"] : ["name", "version"], `targets.${target}`);
			if(target === "npm")
			{
				try
				{
					for(const value of Object.values(settings))
						if(typeof value !== "string") throw new TypeError("npm settings must be strings");
					componentNpmIdentity({ name: "lean-bridge-package", version: "0.0.0" }, settings);
				} catch(error)
				{
					fail("invalid-export-configuration", `targets.npm: ${error.message}`);
				}
				continue;
			}
			for(const [field, value] of Object.entries(settings))
			{
				if(typeof value !== "string" || !/^[A-Za-z0-9@][A-Za-z0-9_@./:+-]*$/.test(value))
					fail("invalid-export-configuration", `targets.${target}.${field} must be a package identifier`);
			}
			if(target === "cpan")
			{
				if(settings.module !== undefined && !/^LeanBridge::[A-Za-z][A-Za-z0-9_]*(?:::[A-Za-z][A-Za-z0-9_]*)*$/.test(settings.module))
					fail("invalid-export-configuration", "targets.cpan.module must be a LeanBridge:: package name");
				if(settings.version !== undefined && !/^\d+\.\d{3}(?:_\d{2})?$/.test(settings.version))
					fail("invalid-export-configuration", "targets.cpan.version must use CPAN decimal version syntax, such as 0.001");
			}
		}
	}
	return configuration;
};

/**
 * Read optional author intent and reject the removed Perl-only configuration.
 *
 * @param projectRoot - Read-only source project.
 * @param options - Cancellation controls.
 * @param options.signal - Optional abort signal.
 */
export const readExportConfiguration = async (projectRoot, { signal = undefined } = {}) => {
	const root = resolve(projectRoot);
	signal?.throwIfAborted();
	try
	{
		await lstat(join(root, legacyFile));
		fail("legacy-export-configuration", `Replace ${legacyFile} with ${exportConfigurationFile}: keep modules, exports, resources and arities; move module to targets.cpan.module and cpanVersion to targets.cpan.version. Remove the old file. See docs/lean/existing-package/#configure-exports.`);
	} catch(error)
	{
		if(error.code !== "ENOENT") throw error;
	}
	let configuration = { schemaVersion: 1 }, path = null, sourceSha256 = null, stat = null;
	const absolute = join(root, exportConfigurationFile);
	try
	{
		stat = await lstat(absolute);
	} catch(error)
	{
		if(error.code !== "ENOENT") throw error;
	}
	if(stat !== null)
	{
		if(!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024)
			fail("invalid-export-configuration", `${exportConfigurationFile} must be a regular file of at most 1 MiB`);
		const bytes = await readFile(absolute, { signal });
		if(bytes.length > 1024 * 1024) fail("invalid-export-configuration", `${exportConfigurationFile} exceeds 1 MiB`);
		try
		{
			configuration = JSON.parse(bytes.toString("utf8"));
		} catch
		{
			fail("invalid-export-configuration", `${exportConfigurationFile} must contain valid JSON`);
		}
		validateExportConfiguration(configuration);
		path = exportConfigurationFile;
		sourceSha256 = sha256(bytes);
	}
	signal?.throwIfAborted();
	return frozen({ configuration, path, sourceSha256, sha256: sha256(canonicalJson(configuration)) });
};

/**
 * Bind validated author choices to the exact configuration in a source snapshot.
 *
 * @param record - Configuration record captured before analysis or planning.
 * @param inputs - Hashed project inputs, including the optional configuration file.
 */
export const assertExportConfigurationSnapshot = (record, inputs) => {
	const actual = inputs.find(input => input.path === exportConfigurationFile)?.sha256 ?? null;
	if(actual !== record.sourceSha256)
		fail("export-configuration-drift", `${exportConfigurationFile} changed after validation; retry with unchanged source`);
};

/**
 * Reject choices a selected compiler or package projection cannot yet implement.
 *
 * @param configuration - Validated shared author intent.
 * @param options - Explicit backend capabilities.
 * @param options.target - Canonical package target.
 * @param options.fields - Implemented shared configuration fields.
 * @param options.targetFields - Implemented package metadata fields.
 */
export const assertExportConfigurationCapabilities = (configuration, {
	target, fields = ["modules", "exports"], targetFields = []
}) => {
	validateExportConfiguration(configuration);
	for(const field of Object.keys(configuration))
	{
		if(["schemaVersion", "targets", ...fields].includes(field)) continue;
		if(Object.keys(configuration[field]).length === 0) continue;
		fail("unsupported-export-configuration", `${target} does not yet implement ${field} from ${exportConfigurationFile}`);
	}
	for(const field of Object.keys(configuration.targets?.[target] ?? {}))
	{
		if(targetFields.includes(field)) continue;
		fail("unsupported-export-configuration", `${target} does not yet implement targets.${target}.${field} from ${exportConfigurationFile}`);
	}
};

/**
 * Locate provisional root sources without evaluating Lake on the planning host.
 * Explicit module names may have a custom source-directory prefix in locked
 * projects. The compiler must confirm each name/path pair using Lake ownership.
 *
 * @param configuration - Validated shared selection.
 * @param inputs - Captured root input inventory.
 */
export const selectSourceModules = (configuration, inputs) => {
	const sources = inputs.filter(input => input.path.endsWith(".lean") && input.path !== "lakefile.lean");
	if(!configuration.modules) return sources.map(input => ({ ...input, module: input.path.replace(/\.lean$/, "").replaceAll("/", ".") }));
	const locked = inputs.some(input => input.path === "lake-manifest.json");
	const selected = configuration.modules.map(module => {
		const suffix = `${module.replaceAll(".", "/")}.lean`;
		const candidates = sources.filter(input => input.path === suffix || (locked && input.path.endsWith(`/${suffix}`)));
		if(candidates.length === 0) fail("unknown-export-module", `Selected module ${module} was not found in the source project`);
		if(candidates.length !== 1) fail("ambiguous-export-module", `Selected module ${module} matches multiple source files: ${candidates.map(input => input.path).join(", ")}`);
		return { ...candidates[0], module };
	});
	if(new Set(selected.map(input => input.path)).size !== selected.length)
		fail("ambiguous-export-module", "Selected module names refer to the same source file");
	return selected;
};

/**
 * Select declarations while rejecting misspelled names and conflicting module limits.
 *
 * @param configuration - Validated shared selection.
 * @param declarations - Source discoveries with fullName and path fields.
 * @param modules - Provisional root module names and source paths.
 */
export const selectExportDeclarations = (configuration, declarations, modules) => {
	for(const name of configuration.modules ?? [])
		if(!modules.some(module => module.module === name)) fail("unknown-export-module", `Selected module ${name} was not found in the source project`);
	const paths = new Set(modules.map(module => module.path));
	const selected = declarations.filter(item => !configuration.modules
		|| paths.has(item.path));
	for(const name of configuration.exports ?? [])
		if(!selected.some(item => item.fullName === name))
			fail("unknown-export-declaration", `Selected export ${name} was not found in the selected modules`);
	return selected.filter(item => !configuration.exports || configuration.exports.includes(item.fullName));
};
