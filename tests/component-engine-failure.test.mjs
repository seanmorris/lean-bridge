/**
 * Bounded, allowlisted engine diagnostics survive the process boundary; nothing else is decoded.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CanonicalBuildError } from "../src/build/build-error.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { componentEngineFailureLimit, componentEngineFailurePrefix, decodeComponentEngineFailure
	, describeComponentEngineFailure, encodeComponentEngineFailure } from "../src/build/component-engine-failure.mjs";
import { isUninhabitedCallbackResult } from "./helpers/callback-fin-packages.mjs";

const rejection = () => Object.assign(new TypeError("Callback result has no finite recovery value"), { code: "uninhabited-callback-result" });
const exited = stderr => new CanonicalBuildError("build-command-failed", "engine exited with status 1", {
	details: { command: "engine", args: [], stderr, stdout: "" }
});
const parse = text => JSON.parse(text.slice(componentEngineFailurePrefix.length));
const bytes = text => Buffer.byteLength(text);

test("a final engine line restores the original code, message and declaration context", () => {
	const encoded = encodeComponentEngineFailure(rejection());
	assert.equal(encoded.split("\n").length, 2, "one line plus its terminator");
	const decoded = decodeComponentEngineFailure(exited(`${describeComponentEngineFailure(rejection())}${encoded}`));
	assert.ok(decoded instanceof CanonicalBuildError);
	assert.equal(decoded.code, "uninhabited-callback-result");
	assert.equal(decoded.message, "Callback result has no finite recovery value");
	assert.deepEqual(decoded.details, { engine: { name: "TypeError", code: "uninhabited-callback-result", details: null }
		, process: { command: "engine", exitMessage: "engine exited with status 1" } });
	assert.equal(isUninhabitedCallbackResult(decoded), true);
	assert.equal(isUninhabitedCallbackResult(rejection()), true);
	const source = { path: "Library.lean", startLine: 3, startColumn: 0, endLine: 3, endColumn: 9 };
	const located = new CanonicalBuildError("unsupported-native-c-signature", "rejected", { details: { declaration: "lean:A.b", source } });
	const kept = decodeComponentEngineFailure(exited(encodeComponentEngineFailure(located)));
	assert.equal(kept.code, "unsupported-native-c-signature");
	assert.deepEqual(kept.details.engine.details, { declaration: "lean:A.b", source });
	const uncoded = decodeComponentEngineFailure(exited(encodeComponentEngineFailure(new Error("plain"))));
	assert.equal(uncoded.code, "component-engine-failed"); assert.equal(uncoded.details.engine.code, null);
});

test("unrelated child failures cannot satisfy the uninhabited callback-result assertion", () => {
	const phrase = "TypeError: Callback result has no finite recovery value\n    at expression (defaults.mjs:91:29)\n";
	const marker = encodeComponentEngineFailure(rejection());
	const envelope = value => `${componentEngineFailurePrefix}${JSON.stringify(value)}\n`;
	const unchanged = [
		exited(phrase)
		, exited(`${marker}later output\n`)
		, exited(marker.slice(0, -1))
		, exited(`${componentEngineFailurePrefix}{not json}\n`)
		, exited(envelope({ code: null, details: null, message: "m", name: "Error", extra: 1 }))
		, exited(envelope({ code: "Bad Code", details: null, message: "m", name: "Error" }))
		, exited(envelope({ code: null, details: null, message: "", name: "Error" }))
		, exited(envelope({ code: null, details: [], message: "m", name: "Error" }))
		, exited(envelope({ code: null, details: { env: { HOME: "/root" } }, message: "m", name: "Error" }))
		, exited(envelope({ code: null, details: null, message: "m".repeat(3000), name: "Error" }))
		, exited(undefined)
	];
	for(const error of unchanged)
	{
		assert.equal(decodeComponentEngineFailure(error), error);
		assert.equal(isUninhabitedCallbackResult(error), false);
	}
	for(const code of ["build-timeout", "build-output-limit", "build-cancelled"])
	{
		const error = new CanonicalBuildError(code, "stopped", { details: { stderr: marker } });
		assert.equal(decodeComponentEngineFailure(error), error, code);
	}
	const other = decodeComponentEngineFailure(exited(encodeComponentEngineFailure(Object.assign(new TypeError("Callback result has no finite recovery value"), { code: "missing-toolchain" }))));
	assert.equal(isUninhabitedCallbackResult(other), false);
	assert.equal(isUninhabitedCallbackResult(Object.assign(new Error("different"), { code: "uninhabited-callback-result" })), false);
});

test("engine lines are bounded, allowlisted and never fail while serializing", () => {
	process.env.LEAN_BRIDGE_ENGINE_FAILURE_SECRET = "not-for-output";
	try
	{
		const details = { declaration: "lean:A.b", env: { ...process.env }, stack: "at x" };
		Object.assign(details, { stdout: "raw", stderr: "raw", request: { secret: 1 } });
		details.source = { path: "A.lean", startLine: 1, token: "nested" };
		const forbidden = encodeComponentEngineFailure(Object.assign(new Error("x"), { code: "c", details, cause: new Error("hidden cause") }));
		assert.deepEqual(parse(forbidden).details, { declaration: "lean:A.b", source: { path: "A.lean", startLine: 1 } });
		assert.doesNotMatch(forbidden, /hidden cause|not-for-output|token|raw|secret|\n {4}at /u);
		// Escaping and multibyte text are measured after serialization.
		for(const message of ["é\u0000\"\\".repeat(4000), "😀".repeat(5000), "x".repeat(20000)])
		{
			const encoded = encodeComponentEngineFailure(Object.assign(new Error(message), { details: { declaration: "d".repeat(512) } }));
			assert.ok(bytes(encoded) <= componentEngineFailureLimit, `${bytes(encoded)} bytes`);
			assert.ok(parse(encoded).message.length > 0);
			assert.equal(decodeComponentEngineFailure(exited(encoded)).message, parse(encoded).message);
			assert.equal(encodeComponentEngineFailure(Object.assign(new Error(message), { details: { declaration: "d".repeat(512) } })), encoded, "deterministic");
		}
		const cyclic = { declaration: "lean:A.b" }; cyclic.self = cyclic;
		assert.deepEqual(parse(encodeComponentEngineFailure(Object.assign(new Error("c"), { details: cyclic }))).details, { declaration: "lean:A.b" });
		/** Accessors that throw stand in for hostile thrown objects. */
		const explode = () => { throw new Error("getter"); };
		const hostile = Object.defineProperties({}, { message: { get: explode }, details: { get: explode } });
		for(const value of [hostile, "text thrown", 7, null, undefined, Symbol("s"), { name: "N".repeat(200), code: "c".repeat(200), message: "m" }])
		{
			const encoded = encodeComponentEngineFailure(value);
			const parsed = parse(encoded);
			assert.ok(bytes(encoded) <= componentEngineFailureLimit);
			assert.ok(parsed.message.length > 0 && /^[A-Za-z]/u.test(parsed.name));
			assert.ok(parsed.code === null || parsed.code.length <= 128);
			assert.equal(typeof describeComponentEngineFailure(value), "string");
		}
		assert.equal(parse(encodeComponentEngineFailure("text thrown")).message, "text thrown");
	} finally
	{ delete process.env.LEAN_BRIDGE_ENGINE_FAILURE_SECRET; }
});

test("the retained stderr tail carries the line through a real subprocess", async () => {
	const encoder = new URL("../src/build/component-engine-failure.mjs", import.meta.url).href;
	const program = `const { encodeComponentEngineFailure, describeComponentEngineFailure } = await import(${JSON.stringify(encoder)});
const error = Object.assign(new TypeError("Callback result has no finite recovery value — é😀\\"\\\\"), { code: "uninhabited-callback-result", details: { declaration: "lean:OnboardingSmall.impossible", env: process.env } });
process.stderr.write("é😀 noise\\n".repeat(4000));
process.stderr.write(describeComponentEngineFailure(error) + encodeComponentEngineFailure(error));
process.exitCode = 1;`;
	const failure = await processBuildRunner.capture({ command: process.execPath, args: ["--input-type=module", "-e", program], timeoutMs: 60000 })
		.then(() => null, error => error);
	assert.equal(failure?.code, "build-command-failed");
	const decoded = decodeComponentEngineFailure(failure);
	assert.equal(decoded.code, "uninhabited-callback-result");
	assert.equal(decoded.message, "Callback result has no finite recovery value — é😀\"\\");
	assert.deepEqual(decoded.details.engine.details, { declaration: "lean:OnboardingSmall.impossible" });
});

test("the real engine entry point reports its failure as a final structured stderr line", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-engine-failure-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const failure = await processBuildRunner.capture({ command: process.execPath
		, args: ["scripts/run-component-engine.mjs", "--request", join(root, "missing.json"), "--component", root, "--output", join(root, "out")]
		, timeoutMs: 60000 }).then(() => null, error => error);
	assert.equal(failure?.code, "build-command-failed");
	assert.ok(failure.details.stderr.trimEnd().split("\n").at(-1).startsWith(componentEngineFailurePrefix));
	const decoded = decodeComponentEngineFailure(failure);
	assert.equal(decoded.code, "component-engine-failed");
	assert.match(decoded.message, /ENOENT|no such file/u);
	assert.equal(decoded.details.engine.name, "Error");
	const usage = await processBuildRunner.capture({ command: process.execPath, args: ["scripts/run-component-engine.mjs", "--bogus", "1"], timeoutMs: 60000 })
		.then(() => null, error => decodeComponentEngineFailure(error));
	assert.match(usage.message, /unknown, duplicate, or incomplete argument --bogus/u);
});

test("known compiler failure shapes keep their reason, hints and records within the budget", () => {
	process.env.LEAN_BRIDGE_TEST_API_TOKEN = "s3cr3t-token-value";
	try
	{
		// The pinned Lean runner reports source errors on stdout under build-command-failed.
		const lean = "OnboardingSmall.lean:2:37: error(lean.synthInstanceFailed): failed to synthesize instance of type class\n  HAdd Nat Nat String\n";
		const workspace = "/tmp/lean-bridge-lake-workspace-x/source";
		const stdout = `${lean}uses x = y and a=b with s3cr3t-token-value\n${workspace}/Other.lean:1:2: note`;
		const runner = { command: "/opt/toolchains/lean", args: ["-R", workspace], stderr: "", stdout };
		const hint = "Fix the Lean source and rebuild";
		const compile = new CanonicalBuildError("build-command-failed", "/opt/toolchains/lean exited with status 1", { hint, details: runner });
		const decoded = decodeComponentEngineFailure(exited(encodeComponentEngineFailure(compile)));
		assert.equal(decoded.code, "build-command-failed");
		assert.equal(decoded.hint, hint);
		assert.equal(decoded.message, "<abs>/lean exited with status 1: OnboardingSmall.lean:2:37: error(lean.synthInstanceFailed): failed to synthesize instance of type class");
		const diagnostic = decoded.details.engine.details.diagnostic;
		assert.match(diagnostic, /HAdd Nat Nat String/u);
		assert.match(diagnostic, /x = y and a=b with \[redacted\]/u, "Lean expressions stay readable; only secret values are removed");
		assert.match(diagnostic, /<abs>\/Other\.lean:1:2: note/u);
		assert.doesNotMatch(JSON.stringify(decoded), /s3cr3t|\/tmp\/lean-bridge|\/opt\/toolchains|"args"/u);
		// The extractor nests the subprocess details under compilerDetails.
		const compilerDetails = { command: "lean", args: [], stderr: "uncaught exception: bad request\n", stdout: "" };
		const extractorDetails = { category: "extractor-failure", cause: "lean exited with status 1", compilerDetails };
		const extractor = Object.assign(new Error("Lean metadata extraction failed"), { code: "lean-metadata-extractor-failed", details: extractorDetails });
		assert.equal(decodeComponentEngineFailure(exited(encodeComponentEngineFailure(extractor))).details.engine.details.diagnostic, "uncaught exception: bad request");
		// Plan and metadata rejections keep their existing record shapes.
		const hints = ["hint:OnboardingSmall.effect:unsupported-effect"];
		const plan = Object.assign(new Error("Build requires a complete Binding IR"), { name: "ComponentBuildPlanError" });
		Object.assign(plan, { code: "component-binding-ir-required", details: { hints } });
		assert.deepEqual(decodeComponentEngineFailure(exited(encodeComponentEngineFailure(plan))).details.engine.details, { hints });
		const record = { category: "export", code: "unsupported-native-type", severity: "error" };
		Object.assign(record, { message: "unsupported", module: "Library", declaration: "Library.f" });
		const projection = { declaration: "Library.f", status: "unsupported" };
		Object.assign(projection, { reason: "unsupported-native-type", message: "Fin inside Array" });
		const details = { diagnostics: [{ ...record, extra: { env: 1 } }], projections: [{ ...projection, parameters: [] }] };
		const rejected = Object.assign(new Error("Native export metadata rejected: unsupported"), { code: "native-elaboration-unsupported", details });
		const kept = decodeComponentEngineFailure(exited(encodeComponentEngineFailure(rejected))).details.engine.details;
		assert.deepEqual(kept, { diagnostics: [record], projections: [projection] });
		// Extreme input always reduces to a valid line that still carries the leading reason.
		const floodDetails = { stdout: `${lean}${"😀\"\\\u0000".repeat(5000)}`, hints: Array(40).fill("x".repeat(512)) };
		floodDetails.diagnostics = Array(40).fill({ message: "m".repeat(512), code: "c" });
		floodDetails.projections = Array(40).fill({ reason: "r".repeat(512) });
		const flood = new CanonicalBuildError("build-command-failed", "é😀\"\\".repeat(4000), { hint: "h".repeat(600), details: floodDetails });
		const bounded = encodeComponentEngineFailure(flood);
		assert.ok(bytes(bounded) <= componentEngineFailureLimit, `${bytes(bounded)} bytes`);
		assert.match(decodeComponentEngineFailure(exited(bounded)).details.engine.details.diagnostic, /^OnboardingSmall\.lean:2:37/u);
		// Unknown detail fields and record fields are never accepted by the parser.
		const envelope = details => exited(`${componentEngineFailurePrefix}${JSON.stringify({ code: null, details, hint: null, message: "m", name: "Error" })}\n`);
		for(const details of [{ env: {} }, { hints: [] }, { diagnostics: [{ stack: "x" }] }, { source: { path: "A.lean", startLine: -1 } }, { diagnostic: "" }])
			assert.equal(decodeComponentEngineFailure(envelope(details)).code, "build-command-failed");
	} finally
	{ delete process.env.LEAN_BRIDGE_TEST_API_TOKEN; }
});

test("oversized hints and record text keep a bounded prefix instead of disappearing", () => {
	const hint = `hint:${"A".repeat(520)}:unsupported-effect`;
	const plan = Object.assign(new Error("Build requires a complete Binding IR"), { code: "component-binding-ir-required", details: { hints: [hint] } });
	const kept = decodeComponentEngineFailure(exited(encodeComponentEngineFailure(plan))).details.engine.details;
	assert.equal(kept.hints.length, 1);
	assert.equal(bytes(kept.hints[0]), 512); assert.ok(hint.startsWith(kept.hints[0]));
	const record = { message: "é".repeat(400), code: "c" };
	const rejected = Object.assign(new Error("rejected"), { code: "native-elaboration-unsupported", details: { diagnostics: [record] } });
	const message = decodeComponentEngineFailure(exited(encodeComponentEngineFailure(rejected))).details.engine.details.diagnostics[0].message;
	assert.equal(bytes(message), 512); assert.equal(message, "é".repeat(256));
	// Identifiers are never shortened into a different name.
	const located = Object.assign(new Error("x"), { details: { declaration: `lean:${"d".repeat(600)}` } });
	assert.equal(decodeComponentEngineFailure(exited(encodeComponentEngineFailure(located))).details.engine.details, null);
});
