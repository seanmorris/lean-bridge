/**
 * Read language-neutral export selection without modifying the Lean project.
 *
 * @file
 */
import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { componentNpmIdentity } from "../release/component-package-receipt.mjs";
import { validateOrdinaryPhpSettings } from "../backends/php/copied-model.mjs";
import { validateGeneratorConfiguration } from "./generator-configuration.mjs";

export const exportConfigurationFile = "lean-bridge.exports.json";
const legacyFile = "lean-bridge.native.json";
const leanName = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/;
const specializationName = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$(?![\s\S])/;
const effects = ["allocates", "reads-resource", "writes-resource", "fails", "host-call", "async", "nondeterministic"];
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
	closed(configuration, ["schemaVersion", "modules", "exports", "resources", "arities", "specializations", "contracts", "generators", "targets"], exportConfigurationFile);
	if(configuration.schemaVersion !== 1) fail("invalid-export-configuration", `${exportConfigurationFile} requires schemaVersion 1`);
	if(configuration.generators !== undefined) validateGeneratorConfiguration(configuration.generators);
	if(configuration.contracts !== undefined)
	{
		if(!object(configuration.contracts) || Object.keys(configuration.contracts).length > 128)
			fail("invalid-export-configuration", "contracts must map at most 128 exact export names to author decisions");
		for(const [name, contract] of Object.entries(configuration.contracts))
		{
			if(!specializationName.test(name)) fail("invalid-export-configuration", "contracts require exact Lean export names");
			if(configuration.exports !== undefined && (!Array.isArray(configuration.exports) || !configuration.exports.includes(name)))
				fail("invalid-export-configuration", `Contract ${name} must refer to a selected export`);
			closed(contract, ["parameters", "result", "effects"], `contracts.${name}`);
			if(!Object.keys(contract).length) fail("invalid-export-configuration", `Contract ${name} must declare a decision`);
			if(contract.effects !== undefined && (!Array.isArray(contract.effects)
				|| contract.effects.some(effect => !effects.includes(effect))
				|| new Set(contract.effects).size !== contract.effects.length))
				fail("invalid-export-configuration", `Contract ${name} has invalid or duplicate effects`);
			if(contract.parameters !== undefined && (!Array.isArray(contract.parameters) || contract.parameters.length > 1024))
				fail("invalid-export-configuration", `Contract ${name} requires an ordered array of at most 1024 parameter sites`);
			const sites = [...(contract.parameters ?? [])];
			if(contract.result !== undefined) sites.push(contract.result);
			for(const site of sites)
			{
				closed(site, ["ownership", "lifetime", "refinement"], `Contract ${name} site`);
				if(!["copy", "borrow", "lease", "transfer"].includes(site.ownership) || site.lifetime === undefined)
					fail("invalid-export-configuration", `Contract ${name} sites require ownership and lifetime`);
				if(site.ownership === "copy")
				{
					if(site.lifetime !== null) fail("invalid-export-configuration", "Copied values cannot declare an identity lifetime");
				}
				else
				{
					closed(site.lifetime, ["scope", "anchor"], `Contract ${name} lifetime`);
					const { scope, anchor } = site.lifetime;
					if(!["call", "receiver", "parameter", "explicit", "runtime"].includes(scope)
						|| (scope === "parameter" ? typeof anchor !== "string" || !/^arg(?:0|[1-9][0-9]*)$(?![\s\S])/.test(anchor) : anchor !== null))
						fail("invalid-export-configuration", `Contract ${name} has an invalid lifetime or parameter anchor`);
					if(scope === "parameter" && contract.parameters && Number(anchor.slice(3)) >= contract.parameters.length)
						fail("invalid-export-configuration", `Contract ${name} lifetime anchor is outside its parameters`);
				}
				if(site.refinement !== undefined && site.refinement !== "reject")
				{
					closed(site.refinement, ["constructor"], `Contract ${name} checked refinement`);
					if(typeof site.refinement.constructor !== "string" || !specializationName.test(site.refinement.constructor))
						fail("invalid-export-configuration", `Contract ${name} refinement needs a checked constructor name`);
				}
			}
		}
	}
	if(configuration.specializations !== undefined)
	{
		const values = configuration.specializations;
		if(!Array.isArray(values) || values.length > 128)
			fail("invalid-export-configuration", "specializations must be an array of at most 128 concrete exports");
		const names = new Set();
		for(const value of values)
		{
			closed(value, ["name", "declaration", "types"], "specialization");
			if([value.name, value.declaration].some(name => typeof name !== "string" || !specializationName.test(name))
				|| value.name === value.declaration || names.has(value.name)
				|| !Array.isArray(value.types) || !value.types.length || value.types.length > 8
				|| value.types.some(name => typeof name !== "string" || !specializationName.test(name)))
				fail("invalid-export-configuration", "Each specialization needs a unique new Lean name, a source declaration and one to eight closed type names");
			if(configuration.exports !== undefined && (!Array.isArray(configuration.exports) || !configuration.exports.includes(value.name)))
				fail("invalid-export-configuration", `Specialization ${value.name} must appear in exports when exports is configured`);
			names.add(value.name);
		}
		if(values.some(value => names.has(value.declaration)))
			fail("invalid-export-configuration", "Specializations must refer to source declarations, not other specializations");
	}
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
			if(target === "php-wasm")
			{
				closed(settings, ["npm", "composer"], "targets.php-wasm");
				for(const [ecosystem, values] of Object.entries(settings))
				{
					closed(values, ["name", "version"], `targets.php-wasm.${ecosystem}`);
					try
					{
						if(Object.values(values).some(value => typeof value !== "string" || value.trim() !== value)) throw new TypeError("Package settings must be unpadded strings");
						if(ecosystem === "composer") validateOrdinaryPhpSettings(values);
						else
						{
							const identity = componentNpmIdentity({ name: "php-wasm-package", version: "0.0.0" }, values);
							if(identity.name === "@lean-bridge/php-wasm-copied-runtime") throw new TypeError("The component cannot replace its PHP-Wasm runtime package");
						}
					} catch(error)
					{ fail("invalid-export-configuration", `targets.php-wasm.${ecosystem}: ${error.message}`); }
				}
				continue;
			}
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
 * Carry finite author choices into a deterministic compiler request.
 *
 * @param configuration - Validated source configuration.
 */
export const compilerExportSelection = configuration => {
	const selection = {};
	if(configuration.specializations?.length)
		selection.specializations = configuration.specializations.toSorted((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
	if(Object.keys(configuration.contracts ?? {}).length)
	{
		const entries = [];
		for(const name of Object.keys(configuration.contracts).sort())
		{
			const contract = configuration.contracts[name];
			entries.push([name, { ...contract, ...(contract.effects ? { effects: contract.effects.toSorted() } : {}) }]);
		}
		selection.contracts = Object.fromEntries(entries);
	}
	return selection;
};

/**
 * Look up an authored contract without treating object prototype names as exports.
 *
 * @param contracts - Optional map from exact Lean names to decisions.
 * @param name - Compiler-owned declaration or specialization name.
 */
export const exportContractFor = (contracts, name) => contracts && Object.hasOwn(contracts, name) ? contracts[name] : undefined;

/**
 * Describe the ownership implemented by the current scalar and native profiles.
 *
 * @param type - Compiler-owned structural runtime type.
 * @param result - Whether this is a returned value instead of a call argument.
 */
export const exportContractOwnership = (type, result = false) => ["resource", "callback"].includes(type.kind)
	? { ownership: result ? "lease" : "borrow", lifetime: { scope: result ? "explicit" : "call", anchor: null } }
	: { ownership: "copy", lifetime: null };

/**
 * Describe the boundary effects implemented for a compiled runtime signature.
 *
 * @param projection - Compiler-owned parameters and result, without source-text parsing.
 */
export const exportContractEffects = projection => projection.parameters.some(parameter => parameter.type.kind === "callback") ? ["fails", "host-call"] : [];

/**
 * Reject author decisions the current runtime signature cannot honor.
 *
 * @param contract - Structurally validated decisions for one selected export.
 * @param projection - Supported compiler-owned runtime projection.
 */
export const exportContractProblem = (contract, projection) => {
	if(!contract || projection.status !== "supported") return null;
	if(contract.effects && canonicalJson(contract.effects.toSorted()) !== canonicalJson(exportContractEffects(projection)))
		return "effects differ from the implemented boundary effects";
	if(contract.parameters && contract.parameters.length !== projection.parameters.length)
		return "parameter decisions must cover the exact runtime argument count";
	const sites = (contract.parameters ?? []).map((site, index) => ({ site, type: projection.parameters[index].type, result: false, label: `arg${index}` }));
	if(contract.result) sites.push({ site: contract.result, type: projection.result, result: true, label: "result" });
	for(const { site, type, result, label } of sites)
	{
		if(site.refinement !== undefined && site.refinement !== "reject") return `${label}: checked refinement constructors are not implemented by this profile`;
		if(canonicalJson({ ownership: site.ownership, lifetime: site.lifetime }) !== canonicalJson(exportContractOwnership(type, result)))
			return `${label}: ownership or lifetime differs from the implemented adapter`;
	}
	return null;
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
 * Explicit module names may have a custom source-directory prefix when the
 * compiler will confirm each name/path pair using Lake ownership.
 *
 * @param configuration - Validated shared selection.
 * @param inputs - Captured root input inventory.
 * @param options - Selection used by a compiler-owned source-intent request.
 * @param options.lakeOwnership - Require subsequent Lake ownership validation.
 */
export const selectSourceModules = (configuration, inputs, { lakeOwnership = false } = {}) => {
	const sources = inputs.filter(input => input.path.endsWith(".lean") && input.path !== "lakefile.lean");
	if(!configuration.modules) return sources.map(input => ({ ...input, module: input.path.replace(/\.lean$/, "").replaceAll("/", ".") }));
	const resolvedByLake = lakeOwnership || inputs.some(input => input.path === "lake-manifest.json");
	const selected = configuration.modules.map(module => {
		const suffix = `${module.replaceAll(".", "/")}.lean`;
		const candidates = sources.filter(input => input.path === suffix || (resolvedByLake && input.path.endsWith(`/${suffix}`)));
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
