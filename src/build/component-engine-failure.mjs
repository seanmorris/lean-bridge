/**
 * Carry a bounded, allowlisted component engine diagnostic across its process boundary.
 * The final stderr line is a format for the parent, not an authentication of child output.
 *
 * @file
 */
import { CanonicalBuildError } from "./build-error.mjs";

export const componentEngineFailurePrefix = "lean-bridge-engine-error ";
// The process runner retains only the last 8000 bytes of stderr; the whole line stays well inside it.
export const componentEngineFailureLimit = 6000;
const messageLimit = 2048;
const textLimit = 512;
const name = /^[A-Za-z][A-Za-z0-9]{0,63}$/u;
const code = /^[a-z][a-z0-9-]{0,127}$/u;
const fallback = Object.freeze({ code: null, details: null, message: "Component engine failed", name: "Error" });
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value)
	&& Object.getPrototypeOf(value) === Object.prototype;
const line = value => `${componentEngineFailurePrefix}${JSON.stringify(value)}\n`;
const size = value => Buffer.byteLength(line(value));

/**
 * Truncate at a code-point boundary to at most the given UTF-8 byte count.
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
const bounded = value => typeof value === "string" && value.length > 0 && Buffer.byteLength(value) <= textLimit ? value : undefined;

/**
 * Keep only declaration context that callers already expose in compiler diagnostics.
 *
 * @param details - Arbitrary error details from the engine.
 */
const allowlisted = details => {
	if(!plain(details)) return null;
	const declaration = bounded(read(details, "declaration"));
	const source = read(details, "source");
	const position = plain(source) ? Object.fromEntries([
		["path", bounded(read(source, "path"))]
		, ...["startLine", "startColumn", "endLine", "endColumn"].map(key => [key, integer(read(source, key))])
	].filter(([, value]) => value !== undefined)) : null;
	const value = { ...(declaration ? { declaration } : {}), ...(position?.path ? { source: position } : {}) };
	return Object.keys(value).length ? value : null;
};

/**
 * Render one bounded stderr line. It never throws and never includes stacks, causes,
 * raw output, request data or the environment.
 *
 * @param error - Any value thrown inside the engine process.
 */
export const encodeComponentEngineFailure = error => {
	try
	{
		const errorName = read(error, "name"), errorCode = read(error, "code");
		let message = read(error, "message");
		if(typeof message !== "string") message = typeof error === "string" ? error : fallback.message;
		const value = {
			code: typeof errorCode === "string" && code.test(errorCode) ? errorCode : null
			, details: allowlisted(read(error, "details"))
			, message: truncate(message, messageLimit) || fallback.message
			, name: typeof errorName === "string" && name.test(errorName) ? errorName : "Error"
		};
		// Deterministic reduction: drop details, then halve the message until the line fits.
		if(size(value) > componentEngineFailureLimit) value.details = null;
		while(size(value) > componentEngineFailureLimit && value.message.length > 1)
			value.message = truncate(value.message, Math.floor(Buffer.byteLength(value.message) / 2)) || fallback.message;
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

const decode = stderr => {
	if(typeof stderr !== "string" || !stderr.endsWith("\n")) return null;
	const last = stderr.slice(0, -1).split("\n").at(-1);
	if(!last.startsWith(componentEngineFailurePrefix) || Buffer.byteLength(last) + 1 > componentEngineFailureLimit) return null;
	let value;
	try
	{ value = JSON.parse(last.slice(componentEngineFailurePrefix.length)); } catch
	{ return null; }
	if(!plain(value) || Object.keys(value).sort().join(",") !== "code,details,message,name") return null;
	if(typeof value.name !== "string" || !name.test(value.name)) return null;
	if(value.code !== null && (typeof value.code !== "string" || !code.test(value.code))) return null;
	if(typeof value.message !== "string" || value.message.length === 0 || Buffer.byteLength(value.message) > messageLimit) return null;
	// Details must already be in their allowlisted form; anything else is not a valid line.
	if(value.details !== null && JSON.stringify(allowlisted(value.details)) !== JSON.stringify(value.details)) return null;
	return value;
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
	return new CanonicalBuildError(engine.code ?? "component-engine-failed", engine.message, {
		hint: error.hint ?? null
		, details: { engine: { name: engine.name, code: engine.code, details: engine.details }
			, process: { command: error.details.command ?? null, exitMessage: error.message } }
	});
};
