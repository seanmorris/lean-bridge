/**
 * Replay the real Counter compiler evidence without a native toolchain.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { generatePhpIOFiles } from "../../src/backends/php/io-package.mjs";
import { generatePhpIOPort } from "../../src/backends/php/io-port.mjs";
import { compilePhpSyncSurface } from "../../src/backends/php/io-surface.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const dir = "tests/fixtures/php-io-resources", json = async p => JSON.parse(await readFile(p,"utf8"));
const recordPath = "docs/evidence/php-heap-lease-20261123.json";
const captured = async () => {
	const base = join(dir,"evidence");
	const api = await json(join(base,"binding-ir.json")), evidence = await json(join(base,"host-export-evidence.json"));
	return { api, evidence, bindingIrSha256: hashBindingIr(api), name: "lean-bridge/counter", version: "1.0.0" };
};
test("PHP resource reconstruction checks compiler identity and the lifetime of every public handle",async () => {
	const input = await captured(), model = compilePhpSyncSurface(input);
	assert.deepEqual([...model.leases.values()].map(r => r.publicName),["Badge","Ticket"]);
	for(const [module,source] of [["Counter","jvm-sync-resources"],["Shared","resource-tasks"]])
	{
		const fingerprint = input.evidence.interfaces.find(x => x.module === module);
		assert.equal(fingerprint.sourceSha256,sha256(await readFile(join("tests/fixtures",source,module+".lean"))));
	}
	for(const change of [
		x => { x.evidence.interfaces.find(i => i.module === "Shared").sourceSha256=sha256("other"); }
		, x => { x.evidence.compilerSha256=sha256("other compiler"); }
		, x => { x.evidence.resourceImports.Shared=["Counter"]; }
		, x => { delete x.evidence.resourceImports.Counter; }
		, x => { x.api.declarations[0].parameters[0].ownership="copy"; }
		, x => { x.api.declarations[0].result.lifetime.scope="call"; }
		, x => { x.api.types[0].resource.kindId=x.api.types[1].resource.kindId; }
	]){
		const altered = structuredClone(input); change(altered);
		// The IR contract rejects impossible lifetimes before a hash exists;
		// otherwise the compiler reconciliation must reject the rehashed review.
		assert.throws(() => {
			altered.bindingIrSha256 = hashBindingIr(altered.api);
			compilePhpSyncSurface(altered);
		});
	}
	const wrong = structuredClone(model.wire); wrong.leases[0].symbol = wrong.leases[1].symbol;
	assert.throws(() => generatePhpIOPort({ ...model, wire: wrong }),/Invalid PHP resource wire/u);
	const empty = { componentId: input.api.component.id, componentIdentity: sha256("component"), runtimeIdentity: sha256("runtime") };
	await assert.rejects(generatePhpIOFiles(model,empty),/lease library/u);
});
test("PHP resource documentation runs the installed example and names actual Lean declarations",async () => {
	const snippet = async (file,title) => (await readFile(file,"utf8")).split(title+"\n")[1].match(/\x60{3}\w+\n([\s\S]*?)\x60{3}/u)[1];
	assert.equal(await snippet("docs/php.md","### Share a resource between native PHP packages"),await readFile(join(dir,"example.php"),"utf8"));
	const cfg = JSON.parse(await snippet("docs/publish/php.md","### Export a directly owned IO result"));
	validateExportConfiguration(cfg); assert.deepEqual(cfg.resources,["Shared.Ticket"]);
	const lean = await readFile("tests/fixtures/resource-tasks/Depot.lean","utf8");
	for(const name of cfg.exports) assert.ok(lean.includes("\ndef "+name.split(".")[1]+" "));
	for(const file of ["package.json","config/cli-package.v1.json","nix/perl-engine-source-boundary.json"])
	{
		const config = await json(file);
		for(const name of ["io-lease.php","io-lease-codec.php"]) assert.ok((config.files ?? config.includedFiles).includes("src/backends/php/"+name));
	}
});

test("PHP resource evidence names every host, input route, load order and verified fixture",async () => {
	const pin = await json(recordPath);
	for(const name of ["installed.php","example.php","integrity.php"]) assert.equal(sha256(await readFile(join(dir,name))),pin.sources[name]);
	const keys = new Set(), { ordinary, reviewed, peer, foreign } = pin.releases;
	assert.deepEqual(ordinary.keys,peer.keys); assert.deepEqual(ordinary.keys,reviewed.keys);
	for(const name of ["Badge","Ticket"]) assert.notEqual(ordinary.keys[name],foreign.keys[name]);
	for(const p of [reviewed,peer,foreign]) assert.deepEqual(p.ledger,ordinary.ledger);
	assert.equal(hashBindingIr((await captured()).api),peer.bindingIrSha256);
	for(const row of pin.reports)
	{
		assert.ok(["ordinary","reviewed"].includes(row.route) && ["peer-first","depot-first"].includes(row.order));
		assert.ok(["8.2.35","8.5.10"].includes(row.php)); assert.equal(row.fork,row.php==="8.2.35");
		assert.equal(row.checks,row.fork?35:34); assert.equal(row.modifiedLedgerRefused,true); assert.deepEqual(row.final,[3,1,3,0]);
		keys.add([row.route,row.order,row.php].join(":"));
	}
	assert.equal(pin.reports.length,8); assert.equal(keys.size,8);
});
const original = process.env.LEAN_BRIDGE_PHP_LEASE_AUDIT;
test("resource and copied-only Composer archives reproduce with the same independently installed CLI"
	, { skip: !original }
	, async () => {
	const pin = await json(recordPath), rebuilds = await json("docs/evidence/php-heap-lease-rebuild-20261123.json");
	assert.equal(await readFile(join(original,"installed-php-leases.json"),"utf8"),await readFile(recordPath,"utf8"));
	for(const [route,pkg] of Object.entries(pin.releases))
	{
		const h = join(original,route,"handoff"), { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(h,"package-set-receipt.json") });
		assert.equal(result.receiptSha256,pkg.receiptSha256); assert.deepEqual(receipt.packages[0].artifacts,[pkg.archive]);
		const manifest = await json(join(h,"packages/php-native/composer/lean-bridge/package-receipt.json"));
		assert.equal(manifest.runtimeIdentity,pkg.runtime); assert.deepEqual(manifest.ledger,pkg.ledger);
		assert.equal(manifest.bindingIrSha256,pkg.bindingIrSha256); assert.equal(manifest.libraries[pkg.ledger.library],pkg.ledger.sha256);
		const api = await json(join(h,"binding-ir.json")), evidence = await json(join(h,"host-export-evidence.json"));
		const name = receipt.packages[0].name, bindingIrSha256 = hashBindingIr(api);
		assert.equal(bindingIrSha256,pkg.bindingIrSha256);
		const model = compilePhpSyncSurface({ name, version: "1.0.0", api, evidence, bindingIrSha256 });
		assert.deepEqual(Object.fromEntries([...model.leases.values()].map(r => [r.publicName,"resource:Shared."+r.name+"/"+r.hash])),pkg.keys);
		if(route==="peer") for(const f of ["binding-ir.json","host-export-evidence.json"])
			assert.deepEqual(await readFile(join(h,f)),await readFile(join(dir,"evidence",f)));
	}
	const copied = await json("docs/evidence/php-sync-io-20261123.json");
	for(const [name,source,repro] of [
		["resource",pin.releases.ordinary,process.env.LEAN_BRIDGE_PHP_LEASE_REBUILT]
		, ["copied",copied.packages.ordinary,process.env.LEAN_BRIDGE_PHP_COPIED_REBUILT]
	]){
		const expected = rebuilds[name], observed = await json(join(repro,"reproduction.json"));
		assert.deepEqual(observed,expected);
		const { result } = await readVerifiedPackageSetReceipt({ receiptPath: join(repro,"handoff/package-set-receipt.json") });
		assert.equal(result.receiptSha256,observed.receiptSha256); assert.equal(result.receiptSha256,source.receiptSha256);
		assert.deepEqual(observed.archive,source.archive);
	}
		assert.equal(rebuilds.resource.cliArchiveSha256,rebuilds.copied.cliArchiveSha256);}
);
