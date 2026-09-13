/**
 * Bind compiler-owned API reports to fresh source and complete interface identities.
 *
 * @file
 */
import { lstat, readFile, realpath } from "node:fs/promises";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { componentScalarTypes } from "../abi/component-scalars.mjs";
import { validateNativeType } from "./native-types.mjs";

const fail = message => { throw Object.assign(new Error(message), { code: "invalid-elaborated-metadata" }); };
const closed = (value, keys) => {
	if(!value || typeof value !== "object" || Array.isArray(value)
		|| canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) fail("Elaborated metadata fields must be closed");
};
const text = value => typeof value === "string" && value.length > 0;
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const ordered = values => Array.isArray(values) && values.every(text) && same(values, [...new Set(values)].sort());
const reasons = ["implicit-parameter", "instance-parameter", "dependent-type", "unsupported-effect", "unsupported-parameter-type", "unsupported-result-type", "unsupported-native-type", "visibility", "specialization-required", "type-declaration", "proof-only", "admitted-implementation", "unreviewed-implementation", "arity-limit"];

/**
 * Hash every interface artifact that Lean may import, including server/private data.
 *
 * @param path - Fresh absolute .olean path.
 * @param signal - Optional cancellation signal.
 */
export const identifyLeanInterface = async (path, signal) => {
	const files = [];
	for(const suffix of ["", ".private", ".server"])
	{
		signal?.throwIfAborted();
		const file = `${path}${suffix}`;
		let before;
		try
		{ before = await lstat(file); }
		catch(error)
		{ if(error.code === "ENOENT" && suffix) continue; throw error; }
		if(!before.isFile() || await realpath(file) !== file) fail("Lean interfaces must be regular files without symlinks");
		const bytes = await readFile(file), after = await lstat(file);
		if(before.ino !== after.ino || before.dev !== after.dev || before.size !== bytes.length
			|| before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) fail("Lean interface changed while reading it");
		files.push({ suffix, bytes: bytes.length, sha256: sha256(bytes) });
	}
	return { oleanSha256: files[0].sha256, interfaceSha256: sha256(canonicalJson(files)) };
};

/**
 * Attach independently measured compiler/source identities to an extraction request.
 *
 * @param request - Selected modules and exact exports, without host type claims.
 * @param context - Verified source, interface, compiler and extractor identities.
 */
export const createMetadataRequest = (request, context) => ({ ...request, metadata: {
	toolchain: context.toolchain
	, modules: context.modules
	, invocationIdentitySha256: sha256(canonicalJson({ request, ...context }))
} });

/**
 * Validate the closed shared report and its binding to this exact compiler invocation.
 *
 * @param report - Fresh Lean-produced metadata, never source-scanned signatures.
 * @param request - Engine-owned request with the measured metadata context.
 */
export const validateElaboratedMetadata = (report, request) => {
	closed(report, ["schemaVersion", "kind", "profile", "producer", "modules", "diagnostics"]);
	const profile = request.profile ?? "component-scalars-v1", native = profile === "native-library-v1";
	if(report.schemaVersion !== 2 || report.kind !== "lean-bridge-elaborated-exports" || report.profile !== profile
		|| !["component-scalars-v1", "native-library-v1"].includes(profile)) fail("Unsupported elaborated metadata profile");
	closed(report.producer, ["adapter", "adapterVersion", "tool", "toolVersion", "toolchain", "invocationIdentitySha256"]);
	if(report.producer.adapter !== "lean-bridge-elaborator" || report.producer.adapterVersion !== 2 || report.producer.tool !== "Lean"
		|| report.producer.toolchain !== request.metadata.toolchain || `leanprover/lean4:v${report.producer.toolVersion}` !== request.metadata.toolchain
		|| report.producer.invocationIdentitySha256 !== request.metadata.invocationIdentitySha256) fail("Metadata producer differs from the authorized invocation");
	if(!Array.isArray(report.modules) || !ordered(report.modules.map(module => module?.name))
		|| !same(report.modules.map(module => module.name), request.modules.toSorted())) fail("Metadata module closure differs from the request");
	const identities = new Set();
	for(const module of report.modules)
	{
		closed(module, ["name", "sourcePath", "sourceSha256", "interfaceSha256", "directImports", "declarations"]);
		const expected = request.metadata.modules.find(item => item.name === module.name);
		if(!expected || ["sourcePath", "sourceSha256", "interfaceSha256"].some(key => module[key] !== expected[key])) fail("Metadata source or interface identity differs from the request");
		if(!ordered(module.directImports) || !Array.isArray(module.declarations) || module.declarations.length > 10000
			|| !ordered(module.declarations.map(item => item?.identity))) fail("Metadata declarations or imports are not canonical");
		for(const declaration of module.declarations)
		{
			closed(declaration, ["identity", "kind", "visibility", "selected", "source", "documentation", "typeExpression", "parameters", "resultExpression", "effects", "theoremReferences", "projection"]);
			if(identities.has(declaration.identity)) fail("Metadata repeats a declaration identity");
			identities.add(declaration.identity);
			if(!["definition", "opaque", "abbreviation", "theorem"].includes(declaration.kind) || !["public", "protected", "private"].includes(declaration.visibility)
				|| typeof declaration.selected !== "boolean" || (declaration.selected && !request.exportModules.includes(module.name))) fail("Invalid declaration kind, visibility or selection");
			if(declaration.documentation !== null && typeof declaration.documentation !== "string") fail("Invalid declaration documentation");
			if(!text(declaration.typeExpression) || !text(declaration.resultExpression) || !ordered(declaration.effects) || !ordered(declaration.theoremReferences)) fail("Invalid elaborated expressions or relationships");
			if(declaration.source !== null)
			{
				const span = declaration.source;
				closed(span, ["path", "startLine", "startColumn", "endLine", "endColumn"]);
				if(span.path !== module.sourcePath || ![span.startLine, span.endLine].every(value => Number.isSafeInteger(value) && value > 0)
					|| ![span.startColumn, span.endColumn].every(value => Number.isSafeInteger(value) && value >= 0)
					|| span.endLine < span.startLine || (span.endLine === span.startLine && span.endColumn < span.startColumn)) fail("Invalid compiler source position");
			}
			if(!Array.isArray(declaration.parameters) || declaration.parameters.length > 1024) fail("Invalid elaborated parameters");
			for(const parameter of declaration.parameters)
			{
				closed(parameter, ["name", "binderInfo", "typeExpression"]);
				if(!text(parameter.name) || !text(parameter.typeExpression) || !["explicit", "implicit", "strict-implicit", "instance-implicit"].includes(parameter.binderInfo)) fail("Invalid elaborated binder");
			}
			const projection = declaration.projection;
			const expectedSelection = request.exportModules.includes(module.name) && (request.exports.length
				? request.exports.includes(declaration.identity)
				: declaration.visibility === "public" && declaration.kind !== "theorem" && !["proof-only", "type-declaration"].includes(projection?.reason));
			if(declaration.selected !== expectedSelection) fail("Metadata selection differs from the authorized public API");
			if(projection?.status === "unsupported")
			{
				closed(projection, ["status", "reason", "expression"]);
				if(!reasons.includes(projection.reason) || !text(projection.expression)) fail("Invalid unsupported projection");
			}
			else
			{
				closed(projection, ["status", "bindingShape", "parameters", "result"]);
				const arity = native ? new Map(request.arities).get(declaration.identity) ?? 1024 : 32;
				if(projection.status !== "supported" || projection.bindingShape !== (native ? "native-function" : "pure-function") || !Array.isArray(projection.parameters)
					|| projection.parameters.length > (native ? 1024 : 32) || projection.parameters.length !== (native ? Math.min(arity, declaration.parameters.length) : declaration.parameters.length)
					|| declaration.parameters.some(parameter => parameter.binderInfo !== "explicit") || declaration.effects.length) fail("Invalid supported projection");
				const scalar = type => { closed(type, ["kind", "name"]); if(type.kind !== "primitive" || !componentScalarTypes.includes(type.name)) fail("Unsupported runtime projection type"); };
				const nativeType = type => {
					validateNativeType(type);
					const check = value => {
						if(value.kind === "resource" && (!request.resources.includes(value.name) || !request.modules.includes(value.module))) fail("Native resource lacks its configured source identity");
						if(value.kind === "array") check(value.element);
						if(value.kind === "record") value.fields.forEach(field => check(field.type));
						if(value.kind === "callback")
						{ value.parameters.forEach(check); check(value.result); }
					};
					check(type);
				};
				const validateType = native ? nativeType : scalar;
				projection.parameters.forEach((parameter, index) => {
					closed(parameter, ["name", "type"]);
					if(parameter.name !== declaration.parameters[index].name) fail("Runtime binder differs from the elaborated binder");
					validateType(parameter.type);
				});
				validateType(projection.result);
			}
		}
	}
	if(!Array.isArray(report.diagnostics)) fail("Invalid metadata diagnostics");
	for(const item of report.diagnostics)
	{
		closed(item, ["category", "code", "severity", "message", "module", "declaration"]);
		if(!["unsupported-meaning", "extractor-failure", "stale-metadata"].includes(item.category) || !/^[a-z][a-z0-9-]*$/.test(item.code)
			|| !["error", "warning"].includes(item.severity) || !text(item.message) || (item.module !== null && typeof item.module !== "string")
			|| (item.declaration !== null && !text(item.declaration))) fail("Invalid metadata diagnostic");
	}
	const key = item => [item.category, item.code, item.module ?? "", item.declaration ?? ""].join("|");
	if(!ordered(report.diagnostics.map(key))) fail("Metadata diagnostics are not canonical");
	for(const module of report.modules)
		for(const declaration of module.declarations.filter(item => item.selected))
		{
			const hasDiagnostic = (category, code) => report.diagnostics.some(item => item.category === category && item.code === code && item.module === module.name && item.declaration === declaration.identity);
			if(declaration.projection.status === "unsupported" && !hasDiagnostic("unsupported-meaning", declaration.projection.reason)) fail("Unsupported export lacks its compiler diagnostic");
			if(declaration.source === null && !hasDiagnostic("extractor-failure", "missing-source-position")) fail("Absent source position lacks an extractor diagnostic");
		}
	for(const name of request.exports)
		if(!identities.has(name) && !report.diagnostics.some(item => item.category === "unsupported-meaning" && item.code === "missing-declaration" && item.declaration === name)) fail("Selected export is missing without a compiler diagnostic");
	return true;
};
