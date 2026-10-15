/**
 * Isolated controls for the wasm nominal entry probe: fixture instrumentation, expected entries, the
 * probe consumer and the stderr accounting. Synthetic traces are not measurements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nominalSubtypeFixture, nominalSubtypeModule } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeDispatchSteps } from "./nominal-subtype-dispatch.mjs";
import { accountNominalSubtypeEntry, assertNominalSubtypeEntryReport, instrumentNominalSubtypeLean, nominalSubtypeEntryBegin, nominalSubtypeEntryConsumer, nominalSubtypeEntryEnd, nominalSubtypeEntryExpected, nominalSubtypeEntryInstrumentation, nominalSubtypeEntryMarker } from "./nominal-subtype-entry.mjs";

const fixture = () => readFileSync(`${nominalSubtypeFixture}/${nominalSubtypeModule}.lean`, "utf8");
const trace = expected => expected.map(item => [`${nominalSubtypeEntryBegin} ${item.step}`, ...item.entries.map(entry => `${nominalSubtypeEntryMarker} ${entry}`), `${nominalSubtypeEntryEnd} ${item.step}`].join("\n")).join("\n") + "\n";
const rows = expected => expected.map(item => [item.step, item.status]);

test("nominal entry instrumentation marks each selected constructor and measured source once and nothing else", () => {
	const original = fixture(), probe = instrumentNominalSubtypeLean(original);
	const markers = [...probe.matchAll(/dbgTrace "lean-bridge-nominal-entry (constructor|source) (\w+)" fun _ =>/gu)].map(match => `${match[1]} ${match[2]}`);
	assert.deepEqual(markers.sort(), ["constructor plusOne", "constructor plusTwo", "source combine", "source echo", "source eventFirst", "source first", "source nested", "source second"]);
	assert.ok(probe.includes('def plusOne (value : Nat) : Option Positive := dbgTrace "lean-bridge-nominal-entry constructor plusOne" fun _ =>\n  if value < 100'));
	assert.ok(probe.includes('def first (value : Envelope) : Nat := dbgTrace "lean-bridge-nominal-entry source first" fun _ => value.payload.val'));
	assert.ok(probe.includes('def eventFirst (value : Event) : Nat := dbgTrace "lean-bridge-nominal-entry source eventFirst" fun _ => eventFirstBody value\ndef eventFirstBody : Event → Nat\n  | .empty => 0'));
	// Every other line is byte-identical and the unmeasured definitions keep their bodies.
	const originalLines = original.split("\n"), probeLines = probe.split("\n");
	assert.equal(probeLines.length, originalLines.length + 1);
	assert.ok(probeLines.includes("def eventSecond (value : Event) : Nat := eventFirst value"));
	assert.ok(probeLines.includes("def scalar (value : Nat) : Positive := ⟨value + 1, Nat.zero_lt_succ value⟩"));
	assert.equal(originalLines.filter(line => !probeLines.includes(line)).length, 8);
	assert.throws(() => instrumentNominalSubtypeLean(probe), /already instrumented/u);
	assert.throws(() => instrumentNominalSubtypeLean(original.replace("def plusTwo ", "def plusTwo_ ")), /definition plusTwo/u);
	assert.throws(() => instrumentNominalSubtypeLean(original.replace("def eventFirst : Event → Nat", "def eventFirst :\n    Event → Nat")), /unsupported definition shape/u);
});

test("nominal entry expectations follow the shared step list with one constructor per entered leaf", () => {
	const expected = nominalSubtypeEntryExpected();
	assert.deepEqual(expected.map(item => item.step), nominalSubtypeDispatchSteps.slice(1).map(item => item.step));
	const at = step => expected.find(item => item.step === step);
	assert.deepEqual(at("public-valid-first").entries, ["constructor plusOne", "source first"]);
	assert.deepEqual(at("public-valid-second").entries, ["constructor plusTwo", "source second"]);
	assert.deepEqual(at("public-invalid-first"), { step: "public-invalid-first", status: 1, entries: ["constructor plusOne"] });
	assert.deepEqual(at("public-late-combine").entries, ["constructor plusOne", "constructor plusTwo"]);
	assert.deepEqual(at("public-early-combine").entries, ["constructor plusOne"]);
	assert.deepEqual(at("public-late-nested").entries, ["constructor plusOne", "constructor plusTwo"]);
	assert.deepEqual(at("public-inactive-event").entries, ["source eventFirst"]);
	assert.deepEqual(at("public-active-event-box").entries, ["constructor plusOne", "source eventFirst"]);
	assert.deepEqual(at("public-valid-event-choices").entries, ["constructor plusOne", "constructor plusTwo", "source eventFirst"]);
	assert.deepEqual(at("public-invalid-event-choices").entries, ["constructor plusOne"]);
	assert.deepEqual(at("public-recovery-first").entries, ["constructor plusOne", "source first"]);
	assert.ok(expected.every(item => (item.status === 0) === item.entries.some(entry => entry.startsWith("source "))));
});

test("nominal entry consumer brackets every step on stderr through the public API only", () => {
	const consumer = nominalSubtypeEntryConsumer("nominalsubtypes");
	for(const item of nominalSubtypeDispatchSteps.slice(1)) assert.ok(consumer.includes(`step(${JSON.stringify(item.step)}, () => api.`), item.step);
	assert.equal(consumer.match(/^step\(/gmu).length, nominalSubtypeDispatchSteps.length - 1);
	assert.ok(consumer.startsWith('import * as api from "nominalsubtypes";\n'));
	assert.ok(!consumer.includes("runtime") && !consumer.includes("lb_"), "the consumer reaches Lean only through public exports");
	assert.ok(consumer.includes(`console.error("${nominalSubtypeEntryBegin} " + name)`) && consumer.includes(`console.error("${nominalSubtypeEntryEnd} " + name)`));
	assert.throws(() => nominalSubtypeEntryConsumer("Bad Name"));
});

test("nominal entry accounting requires exactly the expected entries inside each bracket", () => {
	const expected = nominalSubtypeEntryExpected(), stderr = trace(expected);
	const { observed, counts } = accountNominalSubtypeEntry(stderr, rows(expected));
	assert.deepEqual(observed, expected);
	assert.equal(counts["source first"], 2); assert.equal(counts["constructor plusTwo"], 6); assert.equal(counts["constructor plusOne"], 12);
	const broken = [
		[stderr.slice(0, -1), /newline/u]
		, [stderr.replace(`${nominalSubtypeEntryMarker} constructor plusOne\n`, ""), /public-valid-first/u]
		, [stderr.replace(`${nominalSubtypeEntryMarker} source first\n`, `${nominalSubtypeEntryMarker} source first\n${nominalSubtypeEntryMarker} source first\n`), /public-valid-first/u]
		, [stderr.replace(`${nominalSubtypeEntryEnd} public-valid-first\n`, ""), /nested or unclosed/u]
		, [`${nominalSubtypeEntryMarker} source first\n${stderr}`, /outside any step/u]
		, [stderr.replace(`${nominalSubtypeEntryMarker} source first`, "noise line"), /unexpected stderr line/u]
		, [stderr.replace(`${nominalSubtypeEntryMarker} source first`, `${nominalSubtypeEntryMarker} validator first`), /validator/u]
		, [stderr + `${nominalSubtypeEntryBegin} extra\n${nominalSubtypeEntryEnd} extra\n`, /one bracket/u]
	];
	for(const [text, pattern] of broken) assert.throws(() => accountNominalSubtypeEntry(text, rows(expected)), pattern);
	assert.throws(() => accountNominalSubtypeEntry(stderr, rows(expected).map((row, index) => index === 2 ? [row[0], 0] : row)), /public-invalid-first/u);
	assert.throws(() => accountNominalSubtypeEntry(stderr, rows(expected).slice(1)), /one row/u);
	// A trace without any constructor entry cannot pass, even when expectations are weakened to match.
	const silent = expected.map(item => ({ ...item, entries: item.entries.filter(entry => !entry.startsWith("constructor ")) }));
	assert.throws(() => accountNominalSubtypeEntry(trace(silent), rows(silent), silent), /never entered/u);
});

test("nominal entry report checker requires distinct probe identities, exact rows and an explicit validator statement", () => {
	const expected = nominalSubtypeEntryExpected(), { counts } = accountNominalSubtypeEntry(trace(expected), rows(expected));
	const digest = "a".repeat(64), sideModule = { name: "x.wasm", sha256: digest };
	const entry = { instrumentation: nominalSubtypeEntryInstrumentation, consumerSha256: digest, install: { status: 0 } };
	entry.fixture = { originalSha256: digest, probeSha256: "b".repeat(64) };
	entry.probe = { receiptSha256: digest, packageSha256: digest, runtimeSha256: digest, bindingIrSha256: digest, linkManifest: {}, sideModule };
	entry.rows = rows(expected); entry.observed = expected; entry.counts = counts;
	entry.sideModuleExports = { exports: 3, adapters: 1, validators: { exported: ["lb_a_refinement_0"], referencedByPackageJavaScript: [] } };
	entry.unmodifiedReleasePackages = true; entry.validatorExportsReferenced = false;
	assert.deepEqual(assertNominalSubtypeEntryReport(entry), counts);
	assert.throws(() => assertNominalSubtypeEntryReport({ ...entry, fixture: { originalSha256: digest, probeSha256: digest } }), /distinct/u);
	assert.throws(() => assertNominalSubtypeEntryReport({ ...entry, instrumentation: "release packages" }));
	assert.throws(() => assertNominalSubtypeEntryReport({ ...entry, rows: rows(expected).slice(1) }));
	assert.throws(() => assertNominalSubtypeEntryReport({ ...entry, observed: expected.map(item => ({ ...item, entries: [] })) }));
	assert.throws(() => assertNominalSubtypeEntryReport({ ...entry, unmodifiedReleasePackages: false }));
	assert.throws(() => assertNominalSubtypeEntryReport({ ...entry, validatorExportsReferenced: true }));
	assert.throws(() => assertNominalSubtypeEntryReport({ ...entry, sideModuleExports: { validators: { exported: [], referencedByPackageJavaScript: [] } } }), /listed/u);
});
