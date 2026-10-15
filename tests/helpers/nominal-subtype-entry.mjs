/**
 * Account for constructor and Lean source entry on the wasm nominal Subtype hosts (npm and browser),
 * following the scalar Fin source-entry precedent: a probe variant of the Nat fixture wraps each selected
 * constructor and each measured source in dbgTrace, and the probe consumer brackets every public call on
 * the same stderr stream, so each marker belongs to exactly one step. In the copied-graph frame ABI the
 * selected constructors run once per entered leaf inside the `_lean` adapter guard, in walk order, and
 * the exported carrier validators are not called by the JavaScript runtime. Probe packages are
 * instrumented builds; they are not the unmodified packages the acceptance suites install.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nominalSubtypeDispatchConstructors, nominalSubtypeDispatchExports, nominalSubtypeDispatchSteps } from "./nominal-subtype-dispatch.mjs";

export const nominalSubtypeEntryMarker = "lean-bridge-nominal-entry";
export const nominalSubtypeEntryBegin = "lean-bridge-nominal-begin";
export const nominalSubtypeEntryEnd = "lean-bridge-nominal-end";
export const nominalSubtypeEntryInstrumentation = "probe build: dbgTrace markers on the selected constructors and measured sources of the fixture, call brackets in the consumer; not the unmodified packages of the acceptance suites";
const measuredSources = nominalSubtypeDispatchExports.map(item => item.name);

/**
 * Wrap each selected constructor and measured source body in a marker naming its role and definition.
 * A pattern-matching definition keeps its equations under a renamed body and gains a marked wrapper.
 *
 * @param lean - Uninstrumented fixture source.
 */
export const instrumentNominalSubtypeLean = lean => {
	assert.equal(typeof lean, "string"); assert.ok(!lean.includes(nominalSubtypeEntryMarker), "already instrumented");
	const lines = lean.split("\n"), marked = new Set();
	const marker = (role, name) => `dbgTrace "${nominalSubtypeEntryMarker} ${role} ${name}" fun _ =>`;
	const roles = [...nominalSubtypeDispatchConstructors.map(name => [name, "constructor"]), ...measuredSources.map(name => [name, "source"])];
	for(const [name, role] of roles)
	{
		const index = lines.findIndex(line => line.startsWith(`def ${name} `) || line.startsWith(`def ${name} :`));
		assert.ok(index >= 0 && !marked.has(name), `definition ${name}`); marked.add(name);
		const line = lines[index];
		if(line.endsWith(" :=")) lines[index] = `${line} ${marker(role, name)}`;
		else if(line.includes(" := ")) lines[index] = line.replace(" := ", ` := ${marker(role, name)} `);
		else
		{
			const header = /^def (\w+) : (\S+) → (\S+)$/u.exec(line);
			assert.ok(header, `unsupported definition shape for ${name}: ${line}`);
			lines.splice(index, 1, `def ${name} (value : ${header[2]}) : ${header[3]} := ${marker(role, name)} ${name}Body value`, `def ${name}Body : ${header[2]} → ${header[3]}`);
		}
	}
	return lines.join("\n");
};

/**
 * The entries one step must produce: the constructor of every entered leaf in walk order, then the
 * measured source when the call is accepted. Derived from the same step list and leaf table as the
 * native lane, with no validator pass and each constructor once.
 */
export const nominalSubtypeEntryExpected = () => nominalSubtypeDispatchSteps.filter(item => item.step !== "start").map(item => {
	const target = nominalSubtypeDispatchExports.find(entry => entry.name === item.name);
	assert.ok(target, item.name); assert.equal(item.entered.length, target.parameters.length, item.step);
	const entries = target.parameters.flatMap((leaves, index) => item.entered[index].map(leaf => `constructor ${leaves[leaf][1]}`));
	if(item.status === 0) entries.push(`source ${target.name}`);
	return { step: item.step, status: item.status, entries };
});

const consumerCalls = {
	"public-valid-first": "api.first(box(40n))"
	, "public-valid-second": "api.second(box(40n))"
	, "public-invalid-first": "api.first(box(100n))"
	, "public-valid-combine": "api.combine(box(40n), box(40n))"
	, "public-late-combine": "api.combine(box(40n), box(95n))"
	, "public-early-combine": "api.combine(box(100n), box(40n))"
	, "public-valid-nested": "api.nested({ left: box(40n), right: box(40n) })"
	, "public-late-nested": "api.nested({ left: box(40n), right: box(95n) })"
	, "public-inactive-event": "api.eventFirst({ kind: \"empty\" })"
	, "public-active-event-box": "api.eventFirst({ kind: \"box\", value: box(40n) })"
	, "public-valid-event-choices": "api.eventFirst(choices(40n))"
	, "public-invalid-event-choices": "api.eventFirst(choices(100n))"
	, "public-valid-echo": "api.echo(box(40n))"
	, "public-recovery-first": "api.first(box(40n))"
};

/**
 * Probe consumer over the installed public API: each step is bracketed on stderr and reported on stdout
 * as one row, status 0 for an accepted call and 1 for a refused one. Payload 95 is accepted by plusOne
 * only, 100 by neither; the choices array walks its ok leaf before its error leaf.
 *
 * @param packageName - Installed npm package name exporting the public API.
 */
export const nominalSubtypeEntryConsumer = packageName => {
	const steps = nominalSubtypeDispatchSteps.filter(item => item.step !== "start").map(item => item.step);
	assert.deepEqual(Object.keys(consumerCalls), steps, "consumer calls must cover the step list exactly once, in order");
	assert.match(packageName, /^[a-z][a-z0-9-]*$/u);
	return `import * as api from ${JSON.stringify(packageName)};
const box = payload => ({ payload, digit: 2n });
const some = value => ({ tag: "some", value }), none = { tag: "none" };
const choices = payload => ({ kind: "choices", values: [none, some({ ok: payload }), some({ error: 40n })] });
const rows = [];
// Begin and end share the stderr stream that Lean's dbgTrace writes, so each marker falls inside its step.
const step = (name, call) => {
  console.error("${nominalSubtypeEntryBegin} " + name);
  let status = 0;
  try { call(); } catch (error) { if (!/failed \\(5\\)/u.test(String(error?.message))) throw error; status = 1; }
  finally { console.error("${nominalSubtypeEntryEnd} " + name); }
  rows.push([name, status]);
};
${steps.map(name => `step(${JSON.stringify(name)}, () => ${consumerCalls[name]});`).join("\n")}
console.log(JSON.stringify(rows));
`;
};

/**
 * Assign every stderr line to one bracketed step and require exactly the expected entries per step,
 * nothing outside a bracket and nothing else on stderr.
 *
 * @param stderr - Probe consumer stderr.
 * @param rows - Parsed stdout rows, [step, status].
 * @param expected - Rows from nominalSubtypeEntryExpected.
 */
export const accountNominalSubtypeEntry = (stderr, rows, expected = nominalSubtypeEntryExpected()) => {
	assert.equal(typeof stderr, "string");
	const lines = stderr.split("\n");
	assert.equal(lines.pop(), "", "stderr ends with a newline");
	const segments = []; let open = null;
	for(const line of lines)
	{
		const parts = line.split(" ");
		if(parts[0] === nominalSubtypeEntryBegin)
		{
			assert.equal(parts.length, 2, line); assert.equal(open, null, `nested or unclosed step: ${line}`);
			open = { step: parts[1], entries: [] };
		}
		else if(parts[0] === nominalSubtypeEntryEnd)
		{
			assert.equal(parts.length, 2, line); assert.ok(open && parts[1] === open.step, `unmatched end: ${line}`);
			segments.push(open); open = null;
		}
		else if(parts[0] === nominalSubtypeEntryMarker)
		{
			assert.equal(parts.length, 3, line); assert.ok(open, `entry outside any step: ${line}`);
			assert.ok(["constructor", "source"].includes(parts[1]), line);
			open.entries.push(`${parts[1]} ${parts[2]}`);
		}
		else assert.fail(`unexpected stderr line: ${line}`);
	}
	assert.equal(open, null, "unclosed step");
	assert.ok(Array.isArray(rows)); assert.equal(rows.length, expected.length, "every step reported one row");
	assert.equal(segments.length, expected.length, "every step has one bracket");
	const observed = expected.map((item, index) => {
		assert.deepEqual(rows[index], [item.step, item.status], item.step);
		assert.equal(segments[index].step, item.step);
		assert.deepEqual(segments[index].entries, item.entries, item.step);
		return { step: item.step, status: item.status, entries: segments[index].entries };
	});
	const counts = {};
	for(const item of observed) for(const entry of item.entries) counts[entry] = (counts[entry] ?? 0) + 1;
	for(const name of nominalSubtypeDispatchConstructors) assert.ok(counts[`constructor ${name}`] > 0, `${name} never entered`);
	for(const name of measuredSources) assert.ok(counts[`source ${name}`] > 0, `${name} never entered`);
	return { observed, counts };
};
