/**
 * Checked Fin callbacks and closures of installed npm packages in browser pages, React effects and workers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { refinementEngineTransport } from "./helpers/refinement-engine.mjs";
import { callbackFinCases } from "./helpers/callback-fin-packages.mjs";
import { browserCallbackFinConfiguration, browserCallbackFinExpected, browserCallbackFinProfiles, browserCallbackFinSource, checkBrowserCallbackFinPackages, validateBrowserCallbackFinObservation } from "./helpers/browser-callback-fin.mjs";
import { executeCorpus } from "./fixtures/browser-callback-fin/javascript.mjs";

const enabled = process.env.LEAN_BRIDGE_BROWSER_CALLBACK_FIN_TEST === "1";
const engineRoot = process.cwd();
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
const fixture = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-browser-callback-fin-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project");
	await cp("tests/fixtures/documentation/lean-author", root, { recursive: true });
	return { directory, root };
};
const build = (root, outputRoot) => buildCanonicalProject({ projectRoot: root, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() });

/**
 * A host-side model of the installed package: the public layer rejects with "below", the raw
 * runtime with the compiled adapter's status 5, and host errors pass through unchanged.
 *
 * @param options - Faults to inject into the model.
 * @param options.rawChecks - Whether the raw runtime checks bounds.
 * @param options.rawMessage - Raw rejection text.
 * @param options.retryHost - Whether a failed host reply is retried.
 */
const model = ({ rawChecks = true, rawMessage = "Component structured callable call failed (5)", retryHost = false } = {}) => {
	const layer = raw => {
		const fail = bound => { throw raw ? new Error(rawMessage) : new RangeError(`value must be a bigint below ${bound}`); };
		const fin = bound => value => {
			if((raw && !rawChecks) || (typeof value === "bigint" && value >= 0n && value < bound)) return value;
			return fail(bound);
		};
		const array = item => value => { if(!Array.isArray(value)) fail("array"); return value.map(item); };
		const option = item => value => value?.tag === "none" ? value : value?.tag === "some" ? { tag: "some", value: item(value.value) } : fail("option");
		const own = check => value => {
			if(value === null || typeof value !== "object" || Object.values(Object.getOwnPropertyDescriptors(value)).some(item => !("value" in item)))
				throw new TypeError("callback replies must be own data fields");
			return check(value);
		};
		const pair = value => [fin(3n)(value[0]), "ok" in value[1] ? { ok: fin(5n)(value[1].ok) } : { error: fin(2n)(value[1].error) }];
		const packet = own(value => ({ digit: fin(10n)(value.digit), digits: array(fin(7n))(value.digits) }));
		const tree = value => value.kind === "leaf" ? { kind: "leaf", value: fin(5n)(value.value) } : { kind: "branch", value: array(tree)(value.value) };
		const choice = value => value.kind === "impossible" ? { kind: "impossible", value: fin(0n)(value.value) } : { kind: "digit", value: fin(3n)(value.value) };
		const host = (check, f, value) => {
			const reply = f(check(value));
			try
			{ return check(reply); }
			catch(error)
			{ if(retryHost) f(value); throw error; }
		};
		const lease = (check, body) => {
			let disposed = false;
			const closure = value => { if(disposed) throw new Error("closure disposed"); return body(check(value)); };
			Object.defineProperty(closure, "disposed", { get: () => disposed });
			closure.dispose = () => { disposed = true; };
			return closure;
		};
		const nested = array(option(pair));
		return {
			three: (f, value) => host(fin(3n), f, value)
			, five: (f, value) => host(fin(5n), f, value)
			, closure: offset => lease(fin(3n), value => (value + offset) % 3n)
			, emptyInput: () => lease(fin(0n), value => value)
			, twice: (f, value) => host(fin(3n), f, host(fin(3n), f, value))
			, emptyArray: f => host(array(fin(0n)), f, [])
			, emptyOption: f => host(option(fin(0n)), f, { tag: "none" })
			, nested: (f, value) => host(nested, f, value)
			, packet: (f, value) => host(packet, f, value)
			, digits: (f, value) => host(array(fin(7n)), f, value)
			, tree: (f, value) => host(tree, f, value)
			, choice: (f, value) => host(choice, f, value)
			, packetClosure: offset => lease(packet, value => ({ ...value, digit: (value.digit + offset) % 10n }))
			, scalar: fin(3n)
		};
	};
	return faults => {
		const api = layer(false), raw = layer(true);
		return { ...api, ...faults, raw: (name, args) => raw[name](...args) };
	};
};

test("the shared browser callback checks count the Node cases and fail on any weaker package", () => {
	const request = { module: "onboarding-small" };
	assert.deepEqual(executeCorpus(request, model()()), { module: "onboarding-small", ...browserCallbackFinExpected });
	// Every rejection must come from the package, at the layer that owns it.
	const permissive = new Proxy({}, { get: (_, name) => name === "raw" ? (_name, args) => args.at(-1) : (...args) => args.at(-1) });
	assert.throws(() => executeCorpus(request, permissive), /^Error: (?:failed|accepted)/u);
	assert.throws(() => executeCorpus(request, model({ rawChecks: false })()), /accepted: raw host reply/u);
	assert.throws(() => executeCorpus(request, model({ rawMessage: "value must be a bigint below 3" })()), /wrong rejection: raw host reply/u);
	assert.throws(() => executeCorpus(request, model({ retryHost: true })()), /failed: a failed callback suppresses later host calls/u);
	// A public reply that escapes its bound, or a closure that ignores disposal, is caught too.
	assert.throws(() => executeCorpus(request, model()({ three: (f, value) => f(value) })), /accepted: public host reply/u);
	const kept = model()();
	assert.throws(() => executeCorpus(request, { ...kept, closure: offset => Object.assign(value => (value + offset) % 3n, { disposed: false, dispose: () => undefined }) }), /accepted|failed/u);
	assert.ok(browserCallbackFinExpected.checks > 400 && browserCallbackFinExpected.rejections > 800);
});

test("the browser package reuses both Node callback packages unchanged in one module", () => {
	const source = browserCallbackFinSource();
	assert.equal(source, `${callbackFinCases.scalar.source}\n${callbackFinCases.nominal.source}`);
	const { exports, arities } = browserCallbackFinConfiguration();
	assert.equal(new Set(exports).size, exports.length);
	assert.deepEqual(exports.toSorted(), [...callbackFinCases.scalar.names, ...callbackFinCases.nominal.names].map(name => `OnboardingSmall.${name}`).toSorted());
	assert.deepEqual(arities, { "OnboardingSmall.closure": 1, "OnboardingSmall.emptyInput": 1, "OnboardingSmall.packetClosure": 1 });
	for(const name of exports) assert.match(source, new RegExp(`^def ${name.split(".").at(-1)} `, "mu"), name);
});

test("each browser observation must carry the pinned counts from its own realm", () => {
	const base = { schemaVersion: 1, module: "onboarding-small", results: { module: "onboarding-small", ...browserCallbackFinExpected }, hostVersion: "1" };
	for(const profile of browserCallbackFinProfiles)
	{
		const realm = profile === "browser-worker" ? "dedicated-worker" : "window";
		validateBrowserCallbackFinObservation({ ...base, profile, realm }, profile);
		assert.throws(() => validateBrowserCallbackFinObservation({ ...base, profile, realm: realm === "window" ? "dedicated-worker" : "window" }, profile));
		assert.throws(() => validateBrowserCallbackFinObservation({ ...base, profile, realm, results: { ...base.results, rejections: base.results.rejections - 1 } }, profile));
		assert.throws(() => validateBrowserCallbackFinObservation({ ...base, profile, realm, hostVersion: "" }, profile));
	}
});

test("installed npm Fin callbacks run in browser pages, React effects and dedicated workers", { skip: !enabled, timeout: 3_600_000 }, async t => {
	const observation = await checkBrowserCallbackFinPackages(t, { fixture, build, runtimeRoot });
	for(const profile of browserCallbackFinProfiles)
	{
		const item = observation.observations.find(entry => entry.profile === profile);
		assert.deepEqual(item.browser.executions.map(execution => execution.engine), observation.requestedEngines.flatMap(engine => profile === "browser-react" ? [engine, engine] : [engine]), profile);
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_BROWSER_CALLBACK_FIN_REPORT ?? "build/browser-callback-fin/report.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, profile: "npm-browser", ...observation }));
});
