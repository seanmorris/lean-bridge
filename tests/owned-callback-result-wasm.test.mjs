/**
 * Callback-local owners execute through real Lean in a wasm32 heap.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedJavaScriptWasmLayout } from "../src/backends/javascript/owned-wasm-layout.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedCallbackResultConfiguration, ownedCallbackResultReviewedIr, ownedCallbackResultSource } from "./helpers/owned-callback-result-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("wasm callback result anchors need their own capability and keep callback-local indices", () => {
	const ir = ownedCallbackResultReviewedIr();
	assert.throws(() => compileOwnedJavaScriptWasmLayout(ir, { anchoredResults: true, receiverExports: true }), /explicit output leases/u);
	for(const callbackResultAnchors of [null, 1, "true"])
		assert.throws(() => compileOwnedJavaScriptWasmLayout(ir, { callbackResultAnchors }), /capability must be explicit/u);
	const layout = compileOwnedJavaScriptWasmLayout(ir, { callbackResultAnchors: true });
	assert.equal(layout.native.functions.filter(fn => fn.anchor !== undefined).length, 0);
	assert.equal(layout.native.callbacks.filter(fn => fn.anchor !== undefined).length, 4);
	for(const callback of layout.native.callbacks.filter(fn => fn.anchor !== undefined))
		assert.equal(callback.anchor, callback.parameters.length - 1);
});

test("strict TypeScript requires callback-local owners and accepts borrowed host replies", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-callback-result-types-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const files = generateJavaScriptPackage(ownedCallbackResultReviewedIr());
	await saveLakeFile(directory, "index.d.mts", files["index.d.ts"]);
	await saveLakeFile(directory, "consumer.mts", `import api, {type Bundle, type LeanValue} from "./index.mjs";
const ticket = api.newTicket(42n, "callback");
const input = api.echoRecord({primary: ticket.get(), spare: {tag: "none"}, peers: [], history: [], payload: {count: -1n, bytes: new Uint8Array()}});
const closure = api.makeRecord(input);
const result: LeanValue<Bundle> = closure.get()(true, input);
const nested = closure.get()(false, result);
api.callbackRecord(input, value => value);
api.callbackRecord(input, value => api.echoRecord(value));
const leased = api.makeLeasedRecord(input);
leased.get()(true, input.get());
// @ts-expect-error The selected callback argument requires its whole owner.
closure.get()(false, input.get());
// @ts-expect-error The argument owner's type must match the declared bundle.
closure.get()(false, ticket);
// @ts-expect-error A borrowed result is not an unowned payload.
const raw: Bundle = closure.get()(true, input);
// @ts-expect-error A host reply must match the result type.
api.callbackRecord(input, () => ticket);
nested.dispose(); result.dispose(); closure.dispose(); leased.dispose(); input.dispose(); ticket.dispose();
`);
	const program = ts.createProgram([join(directory, "consumer.mts")], {
		strict: true, noEmit: true, skipLibCheck: false
		, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext
		, moduleResolution: ts.ModuleResolutionKind.NodeNext, types: []
	});
	const diagnostics = ts.getPreEmitDiagnostics(program);
	assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
		getCanonicalFileName: file => file
		, getCurrentDirectory: () => directory, getNewLine: () => "\n"
	}));
});

for(const mode of ["ordinary", "reviewed"]) for(const hostCallbacks of [false, true])
	test(`wasm callback result owners preserve lifetimes with host callbacks ${hostCallbacks} (${mode})`, {
		skip: process.env.LEAN_BRIDGE_OWNED_CALLBACK_RESULT_TEST !== "1"
		, timeout: 600000
	}, async t => {
		let projectFailure = false, attempts = 0, failureAt = 0;
		const failure = new Error("callback result publication failed");
		const fixture = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
			hostCallbacks, callbackResultAnchors: true
			, afterProjection: () => { if(projectFailure) throw failure; }
			, registry: { checkpoint: () => { if(++attempts === failureAt) throw failure; } }
			, fixtureOptions: {
				configuration: await ownedCallbackResultConfiguration()
				, sourceSuffix: ownedCallbackResultSource
				, evidenceName: `wasm-callback-result-${mode}-${hostCallbacks}-inputs.json`
			}
			, ...mode === "reviewed" ? { reviewedIr: ownedCallbackResultReviewedIr() } : {}
		});
		const { call, module } = fixture;
		const live = () => [module._owned_results(), module._owned_live(), module._owned_identities(), fixture.callbackCount()];
		const expired = value => { assert.equal(value.disposed, true); assert.throws(() => value.get(), /expired|disposed/u); };
		const payload = { count: -(1n << 100n), bytes: new Uint8Array([0, 255, 42]) };
		const record = primary => ({ primary, spare: { tag: "none" }, peers: [], history: [], payload });
		const first = call("newTicket", 42n, "callback\0💠"), second = call("newTicket", 99n, "other");
		const captured = call("echoRecord", record(first.get())), supplied = call("echoRecord", record(second.get()));
		const closure = call("makeRecord", captured), leased = call("makeLeasedRecord", captured);
		assert.throws(() => closure.get()(false, supplied.get()), /foreign or wrong-type value/u);
		assert.throws(() => closure.get()(false, first), /type/u);
		const result = closure.get()(true, supplied), nested = closure.get()(false, result);
		assert.equal(call("serial", nested.get().primary), 42n);
		assert.deepEqual(nested.get().payload, payload);
		const copied = nested.retain(), independent = leased.get()(false, supplied);
		captured.dispose(); closure.dispose(); leased.dispose();
		assert.equal(call("serial", result.get().primary), 42n);
		supplied.dispose(); expired(result); expired(nested);
		assert.equal(call("serial", copied.get().primary), 42n);
		assert.equal(call("serial", independent.get().primary), 99n);
		for(const value of [result, nested, copied, independent]) value.dispose();
		const empty = call("echoRecursive", { kind: "branch", children: [] });
		const recursive = call("makeRecursive", empty), emptyView = recursive.get()(false, empty);
		const descendant = recursive.get()(false, emptyView), savedEmpty = descendant.retain();
		emptyView.dispose(); expired(descendant);
		assert.deepEqual(savedEmpty.get(), { kind: "branch", children: [] });
		for(const value of [empty, recursive, descendant, savedEmpty]) value.dispose();
		const owner = call("echoRecord", record(first.get())), callback = call("makeRecord", owner);
		const baseline = live(), faultCounts = {};
		for(const domain of ["native", "host"])
		{
			let complete = false, rejected = 0;
			for(let fault = 1; fault < 1024; fault++)
			{
				attempts = 0; failureAt = domain === "host" ? fault : 0;
				module._owned_fail_after(domain === "native" ? fault : 0);
				let output, failed = false;
				try
				{ output = callback.get()(false, owner); }
				catch(error)
				{ failed = true; rejected++; if(domain === "host") assert.equal(error, failure); else assert.match(error.message, /allocation/u); }
				finally
				{ failureAt = 0; module._owned_fail_after(0); }
				output?.dispose(); assert.deepEqual(live(), baseline);
				assert.equal(call("serial", owner.get().primary), 42n);
				if(!failed)
				{ complete = true; break; }
			}
			assert.ok(complete && rejected > 5); faultCounts[domain] = rejected;
		}
		projectFailure = true; assert.throws(() => callback.get()(false, owner), error => error === failure);
		projectFailure = false; assert.deepEqual(live(), baseline);
		if(hostCallbacks)
		{
			let escaped, returned;
			const host = value => { escaped = value.primary; return value; };
			let output = call("callbackRecord", owner, host);
			assert.equal(escaped.disposed, true); assert.throws(() => call("serial", escaped), /expired|disposed/u);
			assert.equal(call("serial", output.get().primary), 42n); output.dispose();
			output = call("callbackRecord", owner, value => { returned = call("echoRecord", value); return returned; });
			assert.equal(call("serial", output.get().primary), 42n); output.dispose(); returned.dispose();
			assert.throws(() => call("callbackRecord", owner, () => { throw failure; }), error => error === failure);
			assert.throws(() => call("callbackRecord", owner, value => ({ ...value, primary: escaped })), /expired|disposed/u);
			output = call("callbackRecursive", { kind: "branch", children: [{ kind: "leaf", ticket: first.get() }] }, value => value);
			assert.equal(call("serial", output.get().children[0].ticket), 42n); output.dispose();
			assert.deepEqual(live(), baseline);
		}
		callback.dispose(); owner.dispose(); first.dispose(); second.dispose();
		assert.deepEqual(live(), [0, 0, 0, 0]);
		const { evidence } = fixture;
		await saveLakeFile("build/owned-callback-results", `wasm-${mode}-${hostCallbacks}.json`, canonicalJson({
			mode, hostCallbacks, input: evidence.input, privateAbi: evidence.privateAbi
			, faultCounts, live: live()
			, sourceSha256: sha256(await readFile(join(evidence.directory, "probe.c")))
			, binarySha256: sha256(await readFile(join(evidence.directory, "probe.wasm")))
		}));
		t.diagnostic(JSON.stringify({ mode, hostCallbacks, faultCounts, live: live() }));
	});
