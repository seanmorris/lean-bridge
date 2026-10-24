/**
 * Probe-only driver for compiler-derived nominal and recursive PHP-Wasm entries.
 * Normal installed callers continue to reject every stderr byte.
 *
 * @file
 */
import { parseSubtypeEntryTrace } from "./entry-trace.mjs";

const require = (condition, message) => { if(!condition) throw new Error(message); };
const normalized = value => Array.isArray(value) ? value.map(normalized)
	: value && typeof value === "object"
		? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalized(value[key])]))
		: value;
const same = (left, right) => JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
const exact = (value, keys, label) => {
	require(value && typeof value === "object" && !Array.isArray(value), `invalid ${label}`);
	require(same(Object.keys(value).sort(), [...keys].sort()), `open ${label}`);
};

const bounded = value => {
	const text = String(value);
	return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};
const entryName = entry => entry === undefined ? "none" : bounded(`${entry.kind}:${entry.label}`);
/**
 * Name the first planned/observed divergence with bounded identities and counts only.
 *
 * @param calls - Calls parsed from the probe trace.
 * @param cases - Independently planned cases.
 */
const entryMismatch = (calls, cases) => {
	const totals = `cases expected ${cases.length} observed ${calls.length}`;
	for(let index = 0; index < Math.max(calls.length, cases.length); index++)
	{
		const planned = cases[index]?.call, observed = calls[index];
		if(same(observed, planned)) continue;
		const expectedEntries = planned?.entries ?? [], observedEntries = observed?.entries ?? [];
		let entry = 0;
		while(entry < Math.max(expectedEntries.length, observedEntries.length)
			&& same(expectedEntries[entry], observedEntries[entry])) entry++;
		const where = entry < Math.max(expectedEntries.length, observedEntries.length)
			? `entry ${entry}: expected ${entryName(expectedEntries[entry])} observed ${entryName(observedEntries[entry])}`
			: "entries match, call fields differ";
		return `case ${index} (${bounded(cases[index]?.control ?? "unplanned")}) ${where}; `
			+ `entries expected ${expectedEntries.length} observed ${observedEntries.length}; ${totals}`;
	}
	return totals;
};

const optionalKeys = (value, required, optional) => [
	...required, ...optional.filter(key => value && Object.hasOwn(value, key))
];
// Compiler-classified entries that cannot carry a per-call marker.
const unmarked = (plan, key, kinds, fields) => {
	const values = new Map();
	if(!Object.hasOwn(plan, key)) return values;
	require(Array.isArray(plan[key]) && plan[key].length > 0, `entry plan ${key}`);
	for(const item of plan[key])
	{
		exact(item, fields, `entry plan ${key} item`);
		require(kinds.includes(item.kind), `${key} entry kind`);
		require(plan.selected.filter(entry => entry.symbol === item.symbol && entry.kind === item.kind
			&& entry.label === item.label).length === 1, `${key} entry is selected`);
		require(!values.has(item.label), `${key} entry identity`);
		if(key === "reducedArity")
			require(/^l_[A-Za-z0-9_]+___redArg$/u.test(item.target), "reduced-arity call target");
		values.set(item.label, item);
	}
	return values;
};

const validatePlan = plan => {
	exact(plan, optionalKeys(plan, ["scope", "family", "selected", "cases"], ["globals", "reducedArity"]), "entry plan");
	require(plan.scope === "separate-instrumented-probe", "entry plan scope");
	require([
		"nominal-full"
		, "nominal-result-only"
		, "recursive-subtype"
		, "recursive-checked-record"
		, "owned-subtype", "owned-checked-record"
		, "dependent-full", "dependent-result-only"
		, "value-index-full", "value-index-result-only"
		, "zero-payload-full", "zero-payload-result-only"
	].includes(plan.family), "entry plan family");
	require(Array.isArray(plan.selected) && plan.selected.length > 0, "entry plan selection");
	require(Array.isArray(plan.cases) && plan.cases.length > 0, "entry plan cases");
	const globals = unmarked(plan, "globals", ["constructor", "source"], ["symbol", "kind", "label"]);
	const reduced = unmarked(plan, "reducedArity", ["source"], ["symbol", "kind", "label", "target"]);
	const controls = new Set();
	for(const item of plan.cases)
	{
		exact(item, optionalKeys(item, ["control", "outcome", "call"], ["moduleInitialized", "reducedArity"]), "entry case");
		const declared = (key, values) => {
			if(!Object.hasOwn(item, key)) return [];
			require(Array.isArray(item[key]) && item[key].length > 0
				&& same(item[key], [...new Set(item[key])].sort()), `entry case ${key}`);
			for(const label of item[key]) require(values.has(label), `${key} names a classified entry`);
			return item[key].map(label => values.get(label));
		};
		const unmarkedEntries = [...declared("moduleInitialized", globals), ...declared("reducedArity", reduced)];
		require(Array.isArray(item.call?.entries) && !item.call.entries.some(entry => [...globals.values(), ...reduced.values()]
			.some(value => value.kind === entry.kind && value.label === entry.label))
		, "unmarked entries cannot appear in a trace plan");
		const unmarkedSource = unmarkedEntries.some(value => value.kind === "source");
		require(/^[a-z][a-z0-9-]*$/u.test(item.control) && !controls.has(item.control), "entry control identity");
		controls.add(item.control);
		require(["accepted", "refused"].includes(item.outcome), "entry case outcome");
		exact(item.call, ["publicName", "entries", "counts"], "entry call");
		require(typeof item.call.publicName === "string" && Array.isArray(item.call.entries), "entry call shape");
		exact(item.call.counts, ["validator", "constructor", "adapter", "source"], "entry counts");
		const count = kind => item.call.entries.filter(entry => entry.kind === kind).length;
		for(const kind of ["validator", "constructor", "adapter", "source"])
			require(item.call.counts[kind] === count(kind), `entry ${kind} count`);
		const owned = plan.family.startsWith("owned-");
		if(item.outcome === "accepted")
		{
			require(item.call.counts.source > 0 || unmarkedSource, "accepted entry reaches its source");
			if(owned)
			{
				require(item.call.entries.some(entry => entry.kind === "adapter"
					&& entry.label === `${item.call.publicName}:native`), "owned acceptance reaches its native adapter");
				require(item.call.entries.some(entry => entry.kind === "adapter"
					&& entry.label === `${item.call.publicName}:lean`), "owned acceptance reaches its Lean adapter");
			}
			else require(item.call.counts.adapter === 1, "copied acceptance reaches one adapter");
		}
		else
		{
			require(item.call.counts.source === 0 && !unmarkedSource, "refused entry stops before its source");
			if(owned)
			{
				require(item.call.entries.some(entry => entry.kind === "adapter"
					&& entry.label === `${item.call.publicName}:native`), "owned refusal reaches its native adapter");
				require(!item.call.entries.some(entry => entry.kind === "adapter"
					&& entry.label === `${item.call.publicName}:lean`), "owned refusal stops before its Lean adapter");
			}
			else require(item.call.counts.adapter === 0, "copied refusal stops before its adapter");
		}
	}
	for(const [key, values] of [["moduleInitialized", globals], ["reducedArity", reduced]])
		for(const label of values.keys())
			require(plan.cases.some(item => item[key]?.includes(label)), `${label} classification is exercised`);
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
	if(!same(calls, input.entryProbe.cases.map(item => item.call)))
		throw new Error(`probe entry sequence differs from its independent plan: ${entryMismatch(calls, input.entryProbe.cases)}`);
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
