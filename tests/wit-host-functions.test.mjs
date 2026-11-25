/** @file Keep binding-owned Lean functions nominal on both sides of the WIT adapter. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {hostMemberSymbol} from "../src/abi/host-member-names.mjs";
import {nativeHostSelection, reconcileHostExports} from "../src/analyze/host-export-model.mjs";
import {witApplicationHostImports} from "../src/backends/wit/application-host-imports.mjs";
import {witApplicationExchange} from "../src/backends/wit/application-exchange.mjs";
import {witApplicationOperations} from "../src/backends/wit/application-operations.mjs";
import {witOperationFacade} from "../src/backends/wit/application-operation-facade.mjs";

const fixture = async () => {
	const ir = JSON.parse(await readFile("tests/fixtures/c-host-members/lean-bridge.hosts.json"));
	for(const type of ir.types) type.host.targets = ["wit-wasi"];
	const component = {name: "workshop", version: "1.0.0", id: "workshop@1.0.0"};
	const owner = nativeHostSelection(ir, "wit-wasi"), module = owner.hostModule;
	const read = ir.declarations.find(m => m.name === "read"), type = ir.types.find(t => t.id === read.owner);
	const box = {kind: "named", id: type.id}, scalar = {kind: "primitive", name: "uint32"};
	const member = module + "." + type.name + ".read", policy = "native-host-io-v1";
	const definitions = [["remember", box, box, true], ["reader", scalar, scalar, true], ["plain", scalar, box, false]];
	const entries = definitions.map(([name, argument, reply, uses]) => ({
		declaration: "Closures." + name
		, module: "Closures"
		, parameters: [{name: "captured", type: box}]
		, result: {kind: "io-closure", argument, reply}
		, effect: "IO"
		, hostMembers: uses ? [member] : []
	}));
	const leaf = name => ({name, module, symbol: hostMemberSymbol("wit-wasi", type, read)});
	const roots = entries.map(e => ({declaration: e.declaration, leaves: e.hostMembers.map(leaf)}));
	const metadata = {kind: "lean-bridge-host-export-metadata"
		, schemaVersion: 1
		, leanVersion: "4.32.2"
		, entries
		, nativeEffectAudit: {policy, initializers: [], roots}};
	const selection = {...owner
		, exports: entries.map(e => e.declaration)
		, exportModules: ["Closures"]
		, modules: ["Closures", module]
		, nativeEffectPolicy: policy
		, nativeEffects: []
		, asyncIterators: []};
	return {...reconcileHostExports({component, ir, metadata, selection}), ir
		, descriptor: witApplicationHostImports(ir), name: component.name, version: component.version};
};

test("WIT callers receive nominal functions, not integer tickets or host callback registrations", async () => {
	const options = await fixture(), model = witApplicationOperations(options);
	assert.deepEqual(model.methods.map(m => m.role), Array(3).fill(["make", "invoke", "drop"]).flat());
	assert.match(model.publicWit, /resource %remember-function \{ invoke: func\(%value: borrow<%box>\)/u);
	assert.match(model.publicWit, /%remember: func\(%captured: borrow<%box>\) -> result<own<%remember-function>, %io-failure>/u);
	assert.match(model.publicWit, /variant %remember-function-error \{ closed, failed\(%io-failure\) \}/u);
	assert.doesNotMatch(model.publicWit, /lb_wit|remember-drop|remember-invoke|lean-unit/u);
	for(const change of [
		t => { t.source.extensions["lean-bridge.dev/closure-owner"] = "c-host-binding"; }
		, t => { t.callable.selfDisposal = "immediate"; }
		, t => { t.callable.failure.errors.pop(); }
		, t => { t.callable.result.ownership = "copy"; }
	]){
		const api = structuredClone(options.api);
		change(api.types.find(t => t.source.declaration === "Closures.remember"));
		assert.throws(() => witApplicationOperations({...options, api}), /Inconsistent binding-owned WIT function/u);
	}
});

test("real component tooling accepts the function resource methods, repr conversion and destructor",
	{skip: !process.env.LEAN_BRIDGE_WASM_TOOLS}, async t => {
		const options = await fixture(), model = witApplicationOperations(options);
		const root = await mkdtemp(join(tmpdir(), "lb-wit-fns-"));
		t.after(() => rm(root, {recursive: true, force: true}));
		await mkdir(join(root, "wit/deps"), {recursive: true});
		const exchange = witApplicationExchange(options.descriptor);
		await writeFile(join(root, "wit/deps/objects.wit"), options.descriptor.wit + "\n" + exchange.wit);
		await writeFile(join(root, "wit/api.wit"), model.wit);
		const scratch = await readFile("src/backends/wit/application-operation-scratch.wat", "utf8");
		await writeFile(join(root, "api.wat"), witOperationFacade(model, scratch));
		const run = args => promisify(execFile)(process.env.LEAN_BRIDGE_WASM_TOOLS, args, {cwd: root});
		await run(["component", "embed", "wit", "--world", "bridge", "api.wat", "-o", "api.core"]);
		await run(["component", "new", "api.core", "-o", "api.wasm"]);
		await run(["validate", "api.wasm"]);
	});
