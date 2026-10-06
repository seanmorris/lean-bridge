/**
 * Carry a bounded, allowlisted component engine diagnostic across its process boundary.
 * The final stderr line is a format for the parent, not an authentication of child output.
 *
 * @file
 */
import { basename } from "node:path";
import { CanonicalBuildError } from "./build-error.mjs";

export const componentEngineFailurePrefix = "lean-bridge-engine-error ";
// The process runner retains only the last 8000 bytes of stderr; the whole line stays well inside it.
export const componentEngineFailureLimit = 6000;
const messageLimit = 2048;
const diagnosticLimit = 2048;
const textLimit = 512;
const listLimit = 16;
const name = /^[A-Za-z][A-Za-z0-9]{0,63}$/u;
const code = /^[a-z][a-z0-9-]{0,127}$/u;
const fallback = Object.freeze({ code: null, details: null, hint: null, message: "Component engine failed", name: "Error" });
const fields = "code,details,hint,message,name";
const detailFields = ["declaration", "diagnostic", "diagnostics", "hints", "projections", "source"];
const recordFields = { diagnostics: ["category", "code", "declaration", "message", "module", "path", "severity"]
	, projections: ["declaration", "message", "reason", "status"] };
const sourceFields = ["path", "startLine", "startColumn", "endLine", "endColumn"];
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value)
	&& Object.getPrototypeOf(value) === Object.prototype;
const line = value => `${componentEngineFailurePrefix}${JSON.stringify(value)}\n`;
const size = value => Buffer.byteLength(line(value));

/**
 * Keep at most the given UTF-8 byte count, cutting only at code-point boundaries.
 *
 * @param text - Source text.
 * @param limit - Maximum UTF-8 bytes.
 */
const truncate = (text, limit) => {
	let used = 0, result = "";
	for(const point of text)
	{
		const width = Buffer.byteLength(point);
		if(used + width > limit) break;
		used += width; result += point;
	}
	return result;
};

const read = (source, key) => {
	try
	{ return source?.[key]; } catch
	{ return undefined; }
};
const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : undefined;
const bounded = (value, limit = textLimit) => typeof value === "string" && value.length > 0 && Buffer.byteLength(value) <= limit ? value : undefined;

// Values of sensitive environment variables are removed; other text, including
// Lean expressions that resemble KEY=value, is left intact.
const secrets = () => Object.entries(process.env)
	.filter(([key, value]) => /token|secret|password|credential|private|auth|key/iu.test(key) && typeof value === "string" && value.length >= 8)
	.map(([, value]) => value).sort((left, right) => right.length - left.length);

/**
 * Best-effort sanitization: absolute paths keep only their final component and
 * known secret values are redacted. Relative file:line:column text is unchanged.
 *
 * @param text - Compiler or error text.
 */
export const sanitizeComponentEngineText = text => {
	let result = String(text).replace(/(^|[\s'"`(=])(\/[^\s'"`():]+)/gu, (_, lead, path) => `${lead}<abs>/${basename(path)}`);
	for(const secret of secrets()) result = result.split(secret).join("[redacted]");
	return result;
};

const record = (value, keys) => {
	if(!plain(value)) return undefined;
	const kept = Object.fromEntries(keys.map(key => [key, bounded(read(value, key)) && truncate(sanitizeComponentEngineText(read(value, key)), textLimit)]).filter(([, text]) => text));
	return Object.keys(kept).length ? kept : undefined;
};
const records = (value, keys) => {
	if(!Array.isArray(value)) return undefined;
	const kept = value.slice(0, listLimit).map(item => record(item, keys)).filter(Boolean);
	return kept.length ? kept : undefined;
};

/**
 * Compiler text from the known subprocess and extractor failure shapes, head first,
 * because Lean reports the first error at the top of its output.
 *
 * @param error - Engine failure.
 * @param details - Its details object.
 */
const compilerText = (error, details) => {
	const nested = plain(read(details, "compilerDetails")) ? read(details, "compilerDetails") : null;
	const sources = nested ?? (read(error, "code") === "build-command-failed" ? details : null);
	if(!sources) return undefined;
	const text = ["stderr", "stdout"].map(key => read(sources, key)).filter(value => typeof value === "string" && value.trim()).join("\n").trim();
	return text ? truncate(sanitizeComponentEngineText(text), diagnosticLimit) : undefined;
};

/**
 * Keep only the diagnostic shapes engine failures are known to carry.
 *
 * @param error - Engine failure.
 */
const allowlisted = error => {
	const details = read(error, "details");
	if(!plain(details)) return null;
	const source = read(details, "source");
	const position = plain(source) ? Object.fromEntries([
		["path", bounded(read(source, "path"))]
		, ...sourceFields.slice(1).map(key => [key, integer(read(source, key))])
	].filter(([, value]) => value !== undefined)) : null;
	const hints = Array.isArray(read(details, "hints")) ? read(details, "hints").slice(0, listLimit)
		.map(item => bounded(item) && truncate(sanitizeComponentEngineText(item), textLimit)).filter(Boolean) : [];
	const value = {
		declaration: bounded(read(details, "declaration"))
		, diagnostic: compilerText(error, details)
		, diagnostics: records(read(details, "diagnostics"), recordFields.diagnostics)
		, hints: hints.length ? hints : undefined
		, projections: records(read(details, "projections"), recordFields.projections)
		, source: position?.path ? position : undefined
	};
	const kept = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
	return Object.keys(kept).length ? kept : null;
};

// Each step removes or shrinks something, so the sequence always terminates.
const reductions = [
	value => { if(value.details?.projections) delete value.details.projections; }
	, value => { if(value.details?.diagnostics?.length > 4) value.details.diagnostics.length = 4; }
	, value => { if(value.details?.hints?.length > 4) value.details.hints.length = 4; }
	, value => { if(value.details?.diagnostics) delete value.details.diagnostics; }
	, value => { if(value.details?.diagnostic) value.details.diagnostic = truncate(value.details.diagnostic, 1024); }
	, value => { if(value.details?.diagnostic) value.details.diagnostic = truncate(value.details.diagnostic, 256); }
	, value => { if(value.details?.hints) delete value.details.hints; }
	, value => { value.message = truncate(value.message, 1024) || fallback.message; }
	, value => { value.message = truncate(value.message, 256) || fallback.message; }
	, value => { value.hint = null; }
	, value => { value.details = null; }
];

/**
 * Render one bounded stderr line. It never throws and never includes stacks,
 * causes, request documents or the environment.
 *
 * @param error - Any value thrown inside the engine process.
 */
export const encodeComponentEngineFailure = error => {
	try
	{
		const errorName = read(error, "name"), errorCode = read(error, "code"), hint = read(error, "hint");
		let message = read(error, "message");
		if(typeof message !== "string") message = typeof error === "string" ? error : fallback.message;
		const value = {
			code: typeof errorCode === "string" && code.test(errorCode) ? errorCode : null
			, details: allowlisted(error)
			, hint: typeof hint === "string" && hint ? truncate(sanitizeComponentEngineText(hint), textLimit) : null
			, message: truncate(sanitizeComponentEngineText(message), messageLimit) || fallback.message
			, name: typeof errorName === "string" && name.test(errorName) ? errorName : "Error"
		};
		for(const reduce of reductions)
		{
			if(size(value) <= componentEngineFailureLimit) break;
			reduce(value);
			if(value.details && !Object.keys(value.details).length) value.details = null;
		}
		return size(value) <= componentEngineFailureLimit ? line(value) : line(fallback);
	} catch
	{ return line(fallback); }
};

/**
 * Bound the human-readable prelude by the same rules as the structured line.
 *
 * @param error - Any value thrown inside the engine process.
 */
export const describeComponentEngineFailure = error =>
	`Component engine failed: ${JSON.parse(encodeComponentEngineFailure(error).slice(componentEngineFailurePrefix.length)).message}\n`;

const text = (value, limit = textLimit) => typeof value === "string" && value.length > 0 && Buffer.byteLength(value) <= limit;
const validDetails = details => {
	if(details === null) return true;
	if(!plain(details) || !Object.keys(details).length || Object.keys(details).some(key => !detailFields.includes(key))) return false;
	if("declaration" in details && !text(details.declaration)) return false;
	if("diagnostic" in details && !text(details.diagnostic, diagnosticLimit)) return false;
	if("hints" in details && (!Array.isArray(details.hints) || !details.hints.length || details.hints.length > listLimit || !details.hints.every(item => text(item)))) return false;
	for(const key of ["diagnostics", "projections"])
		if(key in details && (!Array.isArray(details[key]) || !details[key].length || details[key].length > listLimit
			|| !details[key].every(item => plain(item) && Object.keys(item).length && Object.entries(item).every(([field, value]) => recordFields[key].includes(field) && text(value))))) return false;
	if("source" in details && (!plain(details.source) || !text(details.source.path)
		|| Object.entries(details.source).some(([field, value]) => !sourceFields.includes(field) || (field !== "path" && integer(value) === undefined)))) return false;
	return true;
};

const decode = stderr => {
	if(typeof stderr !== "string" || !stderr.endsWith("\n")) return null;
	const last = stderr.slice(0, -1).split("\n").at(-1);
	if(!last.startsWith(componentEngineFailurePrefix) || Buffer.byteLength(last) + 1 > componentEngineFailureLimit) return null;
	let value;
	try
	{ value = JSON.parse(last.slice(componentEngineFailurePrefix.length)); } catch
	{ return null; }
	if(!plain(value) || Object.keys(value).sort().join(",") !== fields) return null;
	if(typeof value.name !== "string" || !name.test(value.name)) return null;
	if(value.code !== null && (typeof value.code !== "string" || !code.test(value.code))) return null;
	if(!text(value.message, messageLimit) || (value.hint !== null && !text(value.hint))) return null;
	return validDetails(value.details) ? value : null;
};

/**
 * Prefer the engine's diagnostic when its final stderr line is valid. Every other
 * process failure, including timeouts, cancellation and output limits, is unchanged.
 *
 * @param error - Failure reported by the command runner.
 */
export const decodeComponentEngineFailure = error => {
	if(error?.code !== "build-command-failed") return error;
	const engine = decode(error.details?.stderr);
	if(engine === null) return error;
	// An inner command failure is only actionable with its compiler reason.
	const reason = engine.details?.diagnostic?.split("\n").find(item => item.trim());
	return new CanonicalBuildError(engine.code ?? "component-engine-failed", reason ? `${engine.message}: ${reason}` : engine.message, {
		hint: engine.hint ?? error.hint ?? null
		, details: { engine: { name: engine.name, code: engine.code, details: engine.details }
			, process: { command: error.details.command ?? null, exitMessage: error.message } }
	});
};
