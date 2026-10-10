/**
 * Recurring hosted wiring of the ten-column FinContainers entry counters (VO #1438): each installed selection
 * that measures them, its exact counted invocation and recorded command, and the report gate that refuses
 * an unobserved, partial or relabelled report. C, Python and Rust keep their own dispatch paths unchanged.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { cppFinContainerEntryLabels, cppFinContainerEntryProbe } from "./cpp-fin-container-entry-probe.mjs";
import { finContainerDispatchColumns, finContainerDispatchExpected } from "./fin-container-dispatch.mjs";
import { finContainerEntryExpected, finContainerEntryInterposer, finContainerEntryKind, finContainerEntryRawExpected, finContainerEntryRawProbe, finContainerEntrySources, finContainerEntrySymbols } from "./fin-container-entry-dispatch.mjs";
import { finContainerEntryLoadTrigger, finContainerEntryProfiles, finContainerEntrySourceDigests } from "./fin-container-entry-probes.mjs";

export const finContainerEntryCiFlag = "LEAN_BRIDGE_FIN_CONTAINER_ENTRY_COUNTERS=1";
export const finContainerEntryCiChecker = "scripts/check-fin-container-entry-reports.mjs";
const workflowPath = ".github/workflows/consumer-matrix.yml";
const componentId = "fincontainers@1.0.0";
// The component library's file name, named as buildNativeComponent names it (src/build/native-component.mjs).
const componentLibrary = `libcomponent_${sha256(componentId).slice(0, 20)}.so`;
const gdb = "LEAN_BRIDGE_GDB=/usr/bin/gdb";
const gdbInstall = "          sudo apt-get install -y python3-venv pkg-config gdb\n";
const rawCaller = "C raw-adapter probe of the same verified installed libraries; not a host-language call";

/**
 * Every installed selection that measures the counters, with its job, unchanged budget and the step whose
 * outcome that job's enforcement step turns into a failure (the steps themselves continue on error).
 */
export const finContainerEntryCiSelections = Object.freeze([
	{ job: "php-consumers", profiles: ["php-native"], counted: ["php-native"], step: "type_corpus_php_native", timeout: "240", gdb: false }
	, { job: "native-consumers", profiles: ["c", "cpp"], counted: ["cpp"], step: "type_corpus_c_family", timeout: "${{ matrix.profile == 'c-family' && 360 || 240 }}", gdb: false }
	, { job: "managed-consumers", profiles: ["dotnet"], counted: ["dotnet"], step: "type_corpus_dotnet", timeout: "240", gdb: true }
	, { job: "managed-consumers", profiles: ["java", "kotlin"], counted: ["java", "kotlin"], step: "type_corpus_jvm", timeout: "240", gdb: true }
	, { job: "managed-consumers", profiles: ["ruby"], counted: ["ruby"], step: "type_corpus_ruby", timeout: "240", gdb: true }
	, { job: "wasi-consumer", profiles: ["wit-wasi"], counted: ["wit-wasi"], step: "ordinary_wit", timeout: "240", gdb: false }
].map(selection => Object.freeze({ ...selection, report: selection.profiles.join("-") })));
// Container selections whose dispatch stays outside these counters: C counts its own package, Python and Rust
// count inside their own host processes.
const unchanged = Object.freeze(["python", "rust"]);

const plain = profiles => `LEAN_BRIDGE_FIN_CONTAINER_PROFILES=${profiles} LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES=${profiles} node --test tests/native-fin-containers.test.mjs`;
/**
 * The counted invocation of one selection.
 *
 * @param selection - One of finContainerEntryCiSelections.
 */
export const finContainerEntryCiInvocation = selection => `${finContainerEntryCiFlag} ${selection.gdb ? `${gdb} ` : ""}${plain(selection.profiles.join(","))}`;
const reports = selection => [`build/native-fin-containers/${selection.report}.json`, `build/native-fin-containers/reviewed-${selection.report}.json`];
const block = (selection, invocation, checked) => `          ${invocation}\n${reports(selection).map(path => `          test -s ${path}\n`).join("")}${checked ? `          node ${finContainerEntryCiChecker} ${selection.profiles.join(",")} ${reports(selection).join(" ")}\n` : ""}`;
/**
 * The exact gated step lines of one selection: its counted run, both route reports and the report gate.
 *
 * @param selection - One of finContainerEntryCiSelections.
 */
export const finContainerEntryCiBlock = selection => block(selection, finContainerEntryCiInvocation(selection), true);

const count = (text, part) => text.split(part).length - 1;
const once = (text, part, label) => {
	const index = text.indexOf(part);
	assert.ok(index >= 0 && text.indexOf(part, index + 1) < 0, `exactly one ${label}`);
	return index;
};
const swap = (workflow, from, to, label) => {
	once(workflow, from, label);
	return workflow.replace(from, () => to);
};
// The job holding an index: the last top-level job key before it.
const jobAt = (workflow, index) => [...workflow.slice(0, index).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];

/**
 * Enable the counters on every selection: its step and its recorded command. Every other byte stays.
 *
 * @param workflow - Workflow text without the counters.
 */
export const enableFinContainerEntryWorkflow = workflow => {
	assert.ok(!workflow.includes(finContainerEntryCiFlag), "the counters are not yet enabled");
	for(const selection of finContainerEntryCiSelections)
	{
		const before = plain(selection.profiles.join(",")), after = finContainerEntryCiInvocation(selection);
		workflow = swap(workflow, block(selection, before, false), finContainerEntryCiBlock(selection), `${selection.report} step`);
		workflow = swap(workflow, `&& ${before}`, `&& ${after}`, `${selection.report} recorded command`);
	}
	return workflow;
};

/**
 * The exact inverse of enableFinContainerEntryWorkflow, for review and history.
 *
 * @param workflow - Workflow text with the counters.
 */
export const disableFinContainerEntryWorkflow = workflow => {
	for(const selection of finContainerEntryCiSelections)
	{
		const before = plain(selection.profiles.join(",")), after = finContainerEntryCiInvocation(selection);
		workflow = swap(workflow, finContainerEntryCiBlock(selection), block(selection, before, false), `${selection.report} step`);
		workflow = swap(workflow, `&& ${after}`, `&& ${before}`, `${selection.report} recorded command`);
	}
	assert.ok(!workflow.includes(finContainerEntryCiFlag), "no other counted invocation");
	return workflow;
};

/**
 * Require every selection's exact counted step and recorded command in its own unchanged-budget job, no other
 * counted or uncounted invocation of it, Python and Rust untouched, and GDB still installed for its hosts.
 *
 * @param workflow - Workflow text.
 */
export const assertFinContainerEntryWorkflow = workflow => {
	assert.deepEqual(finContainerEntryCiSelections.flatMap(selection => selection.counted).sort(), [...finContainerEntryProfiles, "cpp"].sort(), "all seven hosts, each once");
	assert.equal(count(workflow, finContainerEntryCiFlag), 2 * finContainerEntryCiSelections.length, "only the selected steps and recorded commands are counted");
	for(const selection of finContainerEntryCiSelections)
	{
		const invocation = finContainerEntryCiInvocation(selection);
		const start = once(workflow, finContainerEntryCiBlock(selection), `${selection.report} gated step`);
		once(workflow, `&& ${invocation}`, `${selection.report} recorded command`);
		// The counted text is the only form of this selection: no uncounted run beside it.
		assert.equal(count(workflow, plain(selection.profiles.join(","))), 2, `${selection.report} runs only counted`);
		const job = jobAt(workflow, start);
		assert.equal(job, selection.job, `${selection.report} job`);
		const header = workflow.slice(workflow.indexOf(`\n  ${job}:\n`), workflow.indexOf("\n    steps:\n", workflow.indexOf(`\n  ${job}:\n`)) + 1);
		assert.match(header, new RegExp(`\\n {4}timeout-minutes: ${selection.timeout.replace(/[$()*+.?[\\\]^{|}]/gu, "\\$&")}\\n`, "u"), `${selection.report} budget`);
		// The containing step records its outcome; a later enforcement step of the same job fails the job on it.
		const step = workflow.slice(workflow.lastIndexOf("\n      - name: ", start), workflow.indexOf("\n      - name: ", start));
		assert.match(step, new RegExp(`^ {8}id: ${selection.step}\n`, "mu"), `${selection.report} step id`);
		assert.doesNotMatch(step, /set \+e|\|\| true/u, `${selection.report} step stops on the first failure`);
		const end = workflow.slice(start).search(/\n {2}[a-z][a-z0-9-]*:\n/u), rest = end < 0 ? workflow.slice(start) : workflow.slice(start, start + end);
		const enforced = [...rest.matchAll(/\n {6}- name: Enforce [^\n]*\n {8}if: ([^\n]*)\n {8}run: exit 1\n/gu)].filter(([, condition]) => condition.includes(`steps.${selection.step}.outcome != 'success'`));
		assert.equal(enforced.length, 1, `${selection.report} outcome is enforced`);
		if(selection.gdb) assert.ok(workflow.slice(workflow.indexOf(`\n  ${job}:\n`), start).includes(gdbInstall), `${selection.report} installs GDB first`);
	}
	assert.equal(count(workflow, gdbInstall), 3, "GDB installation unchanged");
	for(const profile of unchanged) assert.equal(count(workflow, plain(profile)), 2, `${profile} unchanged`);
	return workflowPath;
};

// C keeps the four-column source and adapter dispatch of its own installed package probe.
const cDispatch = Object.freeze({ columns: finContainerDispatchColumns, interposer: "LD_PRELOAD", observed: finContainerDispatchExpected, positiveControl: "valid public and raw calls increment source and adapter counts" });
const hex = /^[a-f0-9]{64}$/u, library = /^[A-Za-z0-9_.+-]+\.so(?:\.[0-9]+)*$/u;
/**
 * The verified installed libraries of one host, by file name; machine binary digests are bound, never pinned.
 *
 * @param libraries - The report's library identities.
 * @param profile - Host whose layout is checked.
 */
const installedLibraries = (libraries, profile) => {
	const entries = profile === "cpp"
		? Object.entries(libraries?.files ?? {}).map(([path, file]) => [path.replace(/^lib\//u, ""), file?.sha256])
		: Object.entries(libraries?.sha256 ?? {});
	assert.ok(entries.length > 0, `${profile} lists its installed libraries`);
	for(const [name, digest] of entries) assert.ok(library.test(name) && hex.test(digest), `${profile} library identity ${name}`);
	return Object.fromEntries(entries);
};
const strict = ["foreignRootRefused", "misplacedDefinersRefused", "staleRecordRefused"];
const extracted = ["outsideRootRefused", "plantedParentRefused", "preloadedCopiesRefused"];
const instruments = { cpp: "LD_PRELOAD", "php-native": "LD_PRELOAD", "wit-wasi": "LD_PRELOAD", ruby: "gdb-breakpoints", dotnet: "gdb-breakpoints", java: "gdb-breakpoints-extracted-root", kotlin: "gdb-breakpoints-extracted-root" };
const probes = () => {
	const digests = finContainerEntrySourceDigests();
	return { cpp: sha256(cppFinContainerEntryProbe()), "php-native": digests.php, "wit-wasi": digests.wit, ruby: digests.ruby, dotnet: digests.dotnet, java: digests.java, kotlin: digests.kotlin, strict: digests.strictScript, extracted: digests.extractedScript };
};

/**
 * One installed route report of one selection: its exact hosts in order, executed checks, and for every counted
 * host the exact public and separate raw C rows of the component's ten columns with every refusal control.
 *
 * @param data - Parsed report.
 * @param profiles - The selection's hosts, in report order.
 * @param route - Route: ordinary-source or reviewed-ir.
 */
export const assertFinContainerEntryCiReport = (data, profiles, route) => {
	assert.ok(["ordinary-source", "reviewed-ir"].includes(route), "a known route");
	assert.ok(finContainerEntryCiSelections.some(selection => selection.profiles.join(",") === profiles.join(",")), "exactly one wired selection, without duplicates");
	assert.equal(data.schemaVersion, 1); assert.equal(data.reproducible, true);
	assert.ok(Array.isArray(data.reports));
	assert.deepEqual(data.reports.map(item => item.profile), profiles, "every selected host once, in order");
	const digest = probes();
	for(const item of data.reports)
	{
		assert.equal(item.path, route, `${item.profile} route`);
		assert.ok(Number.isSafeInteger(item.checks) && item.checks > 0, `${item.profile} executed its checks`);
		const dispatch = item.dispatch;
		if(!Object.hasOwn(instruments, item.profile))
		{
			assert.equal(item.profile, "c", "only C is selected beside the counted hosts");
			assert.deepEqual(dispatch, cDispatch, "C keeps its own observed four-column dispatch");
			continue;
		}
		assert.equal(dispatch?.kind, finContainerEntryKind, `${item.profile} measured its entries`);
		assert.equal(dispatch.componentId, componentId);
		assert.equal(dispatch.columns?.length, 10);
		assert.deepEqual(dispatch.columns, finContainerEntrySymbols(componentId));
		assert.deepEqual(dispatch.measuredEntrypoints, finContainerEntrySources.map(name => `FinContainers.${name}`));
		const { public: host, rawAdapter: raw } = dispatch, instrument = instruments[item.profile];
		assert.deepEqual([host.instrument, host.probeSha256, host.missingInstrumentRefused], [instrument, digest[item.profile], true], `${item.profile} public instrument`);
		assert.equal(host.observed?.length, 24, `${item.profile} public row count`);
		assert.deepEqual(host.observed, finContainerEntryExpected, `${item.profile} public rows`);
		// Each column's definer is a verified installed library, the same one for the public and raw callers.
		const libraries = installedLibraries(dispatch.libraries, item.profile);
		assert.ok(hex.test(libraries[componentLibrary]), `${item.profile} installs the component library`);
		assert.deepEqual(host.definers, Array(10).fill(componentLibrary), `${item.profile} every column is defined by the component library`);
		assert.deepEqual(raw.definers, host.definers, `${item.profile} raw definers`);
		const interposer = sha256(finContainerEntryInterposer(dispatch.columns));
		if(instrument === "LD_PRELOAD") assert.equal(host.interposerSha256, interposer, `${item.profile} public interposer`);
		else
		{
			assert.deepEqual(host.breakpoints, dispatch.columns.map((symbol, index) => ({ library: host.definers[index], offset: host.breakpoints?.[index]?.offset, symbol })), `${item.profile} breakpoints`);
			for(const point of host.breakpoints) assert.match(point.offset, /^0x[0-9a-f]+$/u);
			assert.ok(hex.test(host.configSha256) && hex.test(host.gdb?.sha256) && /^GNU gdb /u.test(host.gdb?.version), `${item.profile} debugger identity`);
		}
		if(instrument === "gdb-breakpoints-extracted-root")
		{
			assert.ok(Object.keys(host.hashes ?? {}).length > 0, `${item.profile} extracted hashes`);
			for(const [name, digest] of Object.entries(host.hashes)) assert.equal(libraries[name], digest, `${item.profile} extracted ${name}`);
			for(const name of host.definers) assert.ok(Object.hasOwn(host.hashes, name), `${item.profile} definer ${name} was extracted`);
		}
		if(item.profile === "cpp")
		{
			assert.deepEqual(host.parameterNames, cppFinContainerEntryLabels);
			assert.ok(host.repeatedColdProcess === true && hex.test(host.executableSha256) && hex.test(host.packageReceiptSha256), "cpp process identity");
		}
		if(instrument !== "LD_PRELOAD")
		{
			assert.equal(host.scriptSha256, digest[instrument === "gdb-breakpoints" ? "strict" : "extracted"]);
			for(const flag of instrument === "gdb-breakpoints" ? strict : extracted) assert.equal(host[flag], true, `${item.profile} ${flag}`);
			if(item.profile !== "ruby") assert.equal(host.loadTrigger, finContainerEntryLoadTrigger);
		}
		assert.deepEqual([raw.caller, raw.instrument, raw.missingInstrumentRefused], [rawCaller, "LD_PRELOAD", true], `${item.profile} raw instrument`);
		assert.deepEqual([raw.probeSha256, raw.interposerSha256], [sha256(finContainerEntryRawProbe(componentId, dispatch.columns)), interposer], `${item.profile} raw probe and interposer`);
		assert.equal(raw.observed?.length, 11, `${item.profile} raw row count`);
		assert.deepEqual(raw.observed, finContainerEntryRawExpected, `${item.profile} raw rows`);
	}
};
