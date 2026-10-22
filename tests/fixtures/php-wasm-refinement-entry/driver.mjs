/**
 * Probe-only driver for compiler-derived nominal and recursive PHP-Wasm entries.
 * Normal installed callers continue to reject every stderr byte.
 *
 * @file
 */
import { parseSubtypeEntryTrace } from "./entry-trace.mjs";

const require = (condition, message) => { if(!condition) throw new Error(message); };
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exact = (value, keys, label) => {
	require(value && typeof value === "object" && !Array.isArray(value), `invalid ${label}`);
	require(same(Object.keys(value).sort(), [...keys].sort()), `open ${label}`);
};

const validatePlan = plan => {
	exact(plan, ["scope", "family", "selected", "cases"], "entry plan");
	require(plan.scope === "separate-instrumented-probe", "entry plan scope");
	require(["nominal-full", "nominal-result-only", "recursive-subtype", "recursive-checked-record"].includes(plan.family), "entry plan family");
	require(Array.isArray(plan.selected) && plan.selected.length > 0, "entry plan selection");
	require(Array.isArray(plan.cases) && plan.cases.length > 0, "entry plan cases");
	const controls = new Set();
	for(const item of plan.cases)
	{
		exact(item, ["control", "outcome", "call"], "entry case");
		require(/^[a-z][a-z0-9-]*$/u.test(item.control) && !controls.has(item.control), "entry control identity");
		controls.add(item.control);
		require(["accepted", "refused"].includes(item.outcome), "entry case outcome");
		exact(item.call, ["publicName", "entries", "counts"], "entry call");
		require(typeof item.call.publicName === "string" && Array.isArray(item.call.entries), "entry call shape");
		exact(item.call.counts, ["validator", "constructor", "adapter", "source"], "entry counts");
		const count = kind => item.call.entries.filter(entry => entry.kind === kind).length;
		for(const kind of ["validator", "constructor", "adapter", "source"])
			require(item.call.counts[kind] === count(kind), `entry ${kind} count`);
		if(item.outcome === "accepted")
			require(item.call.counts.adapter === 1 && item.call.counts.source > 0, "accepted entry reaches adapter and source");
		else require(item.call.counts.adapter === 0 && item.call.counts.source === 0, "refused entry stops before adapter");
	}
	return [...controls];
};

/**
 * Run one relocated instrumented package and authenticate its complete call trace.
 *
 * @param options - Installed host, descriptor and independently authored inputs.
 */
export const executePhpWasmCorpus = async options => {
	const { Php, api, loading, mode, request, source, mount } = options;
	require(["startup", "lazy"].includes(loading) && ["weak", "strict"].includes(mode), "unknown probe execution mode");
	const input = JSON.parse(request), controls = validatePlan(input.entryProbe);
	require(typeof input.module === "string" && typeof input.autoload === "string", "invalid probe request");
	require(input.operations && typeof input.operations.probe === "string", "missing probe operation");
	const libraries = [], phases = [], descriptor = loading === "lazy" ? api.lazy : api;
	const selected = mount ? descriptor.extensions : descriptor;
	const php = new Php({ version: "8.4"
		, autoTransaction: false
		, ini: "memory_limit=512M"
		, sharedLibs: loading === "startup" ? [selected] : []
		, dynamicLibs: loading === "lazy" ? [selected] : []
		, locateFile: name => { if(name.endsWith(".so") && name !== "libxml2.so") libraries.push(name); } });
	let stdout = "", stderr = "";
	php.addEventListener("output", event => { stdout += event.detail.join(""); });
	php.addEventListener("error", event => { stderr += event.detail.join(""); });
	const run = async code => {
		const status = await php.run(code);
		require(status === 0, JSON.stringify({ status, stdout, stderr }));
	};
	const silent = () => require(stdout === "" && stderr === "", "unexpected output before entry cases");
	await php.binary; silent(); phases.push({ stage: "ready", libraries: [...libraries] });
	if(mount) await mount(php);
	await run("<?php require_once '/" + input.autoload + "';"); silent();
	phases.push({ stage: "autoload", libraries: [...libraries] });
	const call = input.module + "\\" + input.operations.probe;
	await run("<?php try { " + call + "(1); throw new Exception('Expected TypeError'); } catch (TypeError $error) {}"); silent();
	phases.push({ stage: "invalid", libraries: [...libraries] });
	await php.writeFile("/request.json", request); await php.writeFile("/" + mode + ".php", source);
	await run("<?php require '/" + mode + ".php';");
	const observation = JSON.parse(stdout), trace = stderr;
	const calls = parseSubtypeEntryTrace(trace, input.entryProbe.selected);
	require(same(calls, input.entryProbe.cases.map(item => item.call)), "probe entry sequence differs from its independent plan");
	phases.push({ stage: "complete", libraries: [...libraries] });
	return { phases, observation
		, entryProbe: {
			scope: input.entryProbe.scope, family: input.entryProbe.family
			, trace, calls: calls.length, controls
			, counts: Object.fromEntries(["validator", "constructor", "adapter", "source"].map(kind => [
				kind, calls.reduce((sum, item) => sum + item.counts[kind], 0)
			]))
		}
	};
};
