/**
 * Replay the ownership of installed native PHP task results and step errors
 * against actual source evidence and the independently built peer packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { generatePhpIOFiles } from "../../src/backends/php/io-package.mjs";
import { generatePhpIOPort } from "../../src/backends/php/io-port.mjs";
import { compilePhpSyncSurface, compilePhpTaskSurface } from "../../src/backends/php/io-surface.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { schedulerPackages } from "./php-task-feed.mjs";

const dir="tests/fixtures/php-task-resources", file="docs/evidence/php-task-leases-20261123.json";
const json=async p=>JSON.parse(await readFile(p,"utf8"));
const source=name=>join(name==="integrity.php"?"tests/fixtures/php-io-resources":dir,name);
test("the native PHP resource task examples match the installed consumer and select concrete Lean declarations",async()=>{
	const snippet=async (path,heading)=>(await readFile(path,"utf8")).split(heading+"\n")[1].match(/\x60{3}\w+\n([\s\S]*?)\x60{3}/u)[1];
	assert.equal(await snippet("docs/php.md","### Pass a resource to a native PHP task"),await readFile(source("example.php"),"utf8"));
	const cfg=JSON.parse(await snippet("docs/publish/php.md","### Export a resource through a task or stream"));
	validateExportConfiguration(cfg); await assertJsonSchema("lean-export-configuration",cfg);
	assert.deepEqual(cfg.resources,["Shared.Ticket"]); assert.deepEqual(cfg.taskExports,["Depot.pending"]);
	const lean=await readFile("tests/fixtures/resource-tasks/Depot.lean","utf8");
	for(const n of [...cfg.exports,...Object.values(cfg.asyncIterators[0])]) assert.match(lean,new RegExp("\\bdef "+n.split(".")[1]+"\\b","u"));
});
test("the PHP task loan record covers every release, installed host and load order",async()=>{
	const pin=await json(file), sync=await json("docs/evidence/php-heap-lease-20261123.json");
	for(const r of ["peer","foreign"]) assert.deepEqual(pin.releases[r],sync.releases[r]);
	assert.deepEqual(pin.releases.ordinary.keys,pin.releases.peer.keys);
	assert.deepEqual(pin.releases.reviewed.keys,pin.releases.peer.keys);
	for(const n of ["Ticket","Badge"]) assert.notEqual(pin.releases.peer.keys[n],pin.releases.foreign.keys[n]);
	assert.deepEqual(pin.scheduler,schedulerPackages);
	assert.deepEqual(Object.keys(pin.sources).sort(),["example.php","installed.php","integrity.php","shutdown.php"]);
	for(const [name,hash] of Object.entries(pin.sources)) assert.equal(sha256(await readFile(source(name))),hash);
	const expected=[];
	for(const route of ["ordinary","reviewed"]) for(const php of ["8.2.35","8.5.10"])
		for(const order of ["depot-first","peer-first"]) expected.push([route,php,order].join("/"));
	const cells=pin.reports.map(row=>{
		assert.ok(row.modifiedLedgerRefused && row.shutdown); assert.deepEqual(row.final,[3,1,3,0]);
		assert.equal(row.descriptorDelta,0); assert.equal(row.checks,59);
		return [row.route,row.php,row.order].join("/");
	});
	assert.deepEqual(cells.sort(),expected.sort());
	assert.deepEqual(pin.offlineCLI.archive,pin.releases.ordinary.archive);
	assert.equal(pin.offlineCLI.receiptSha256,pin.releases.ordinary.receiptSha256);
	const previous=await json("docs/evidence/php-task-delivery-20261123.json");
	assert.equal(pin.offlineCLI.cliArchiveSha256,previous.offlineCLI.cliArchiveSha256);
});
const env=process.env, retainedFile="docs/evidence/php-retained-resource-loans-20261123.json";
test("a retained PHP callback can close a peer's last handle without losing the borrowed Lean resource",async()=>{
	const pin=await json(retainedFile), earlier=await json(file),retained="tests/fixtures/php-retained-resources";
	const snippet=async(path,heading)=>(await readFile(path,"utf8")).split(heading+"\n")[1].match(/\x60{3}\w+\n([\s\S]*?)\x60{3}/u)[1];
	assert.equal(await snippet("docs/php.md","#### Close a resource from a worker callback"),await readFile(join(retained,"example.php"),"utf8"));
	const cfg=JSON.parse(await snippet("docs/publish/php.md","#### Let a worker borrow a resource and call PHP"));
	validateExportConfiguration(cfg); await assertJsonSchema("lean-export-configuration",cfg);
	assert.deepEqual(cfg.resources,["Shared.Ticket"]); assert.deepEqual(cfg.taskExports,["Exchange.revisit"]); assert.deepEqual(cfg.taskIOErrors,cfg.taskExports);
	assert.deepEqual(pin.releases.peer,earlier.releases.peer); assert.deepEqual(pin.releases.foreign,earlier.releases.foreign);
	assert.deepEqual(pin.releases.ordinary.keys,pin.releases.peer.keys); assert.deepEqual(pin.releases.ordinary.keys,pin.releases.reviewed.keys);
	assert.notEqual(pin.releases.ordinary.keys.Ticket,pin.releases.foreign.keys.Ticket);
	assert.equal(pin.releases.ordinary.bindingIrSha256,pin.releases.reviewed.bindingIrSha256);
	assert.notEqual(pin.releases.ordinary.receiptSha256,pin.releases.reviewed.receiptSha256);
	assert.deepEqual(pin.scheduler,schedulerPackages);
	assert.deepEqual(Object.keys(pin.sources).sort(),["example.php","installed.php","integrity.php","shutdown.php"]);
	for(const [f,hash] of Object.entries(pin.sources)) assert.equal(sha256(await readFile(f==="integrity.php"?source(f):join(retained,f))),hash);
	const cells=pin.reports.map(row=>{
		assert.ok(row.shutdown && row.modifiedLedgerRefused); assert.equal(row.checks,54);
		assert.equal(row.descriptorDelta,0); assert.deepEqual(row.final,[3,1,3,0]); return [row.route,row.php,row.order].join("/");
	});
	const expected=earlier.reports.map(row=>[row.route,row.php,row.order].join("/"));
	assert.equal(cells.length,8); assert.deepEqual(cells.sort(),expected.sort());
	assert.deepEqual(pin.offlineCLI.archive,pin.releases.ordinary.archive); assert.equal(pin.offlineCLI.receiptSha256,pin.releases.ordinary.receiptSha256);
	assert.equal(pin.offlineCLI.cliArchiveSha256,(await json("docs/evidence/php-retained-tasks-20261123.json")).offlineCLI.cliArchiveSha256);
});
for(const retained of [false,true])
{
	const root=retained?env.LEAN_BRIDGE_PHP_RETAINED_LEASE_AUDIT:env.LEAN_BRIDGE_PHP_TASK_LEASE_AUDIT;
	test("replay PHP resource ownership and offline reproduction for "+(retained?"retained worker callbacks":"direct tasks and streams")
		,{skip: !root},async()=>{
	const pin=await json(retained?retainedFile:file), {offlineCLI,...expected}=pin;
	assert.deepEqual(await json(join(root,"installed-php-leases.json")),expected);
	for(const route of ["ordinary","reviewed","peer","foreign"])
	{
		const task=route==="ordinary"||route==="reviewed";
		const h=join(task?root:env.LEAN_BRIDGE_PHP_LEASE_PEERS,route,"handoff"), base=join(h,"packages/php-native/composer");
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(h,"package-set-receipt.json")});
		const ref=pin.releases[route], [pkg]=receipt.packages, manifest=await json(join(base,"lean-bridge/package-receipt.json"));
		assert.equal(result.receiptSha256,ref.receiptSha256); assert.deepEqual(pkg.artifacts,[ref.archive]);
		assert.equal(pkg.profile,task?"native-php-task-v1":"native-php-io-v1"); assert.deepEqual(manifest.ledger,ref.ledger);
		const api=await json(join(h,"binding-ir.json")), evidence=await json(join(h,"host-export-evidence.json"));
		const bindingIrSha256=hashBindingIr(api); assert.equal(bindingIrSha256,ref.bindingIrSha256);
		const input={name: pkg.name,version: pkg.version,api,evidence,bindingIrSha256};
		const model=(task?compilePhpTaskSurface:compilePhpSyncSurface)(input);
		const {componentIdentity,runtimeIdentity,libraries,ledger}=manifest;
		const assets={componentId: api.component.id,componentIdentity,runtimeIdentity,libraries,ledger,library: "lib"+model.prefix+".so"};
		const files=await generatePhpIOFiles(model,assets);
		for(const [name,bytes] of Object.entries(files)) assert.equal(bytes,await readFile(join(base,name),"utf8"));
		if(!task) continue;
		const port=generatePhpIOPort(model); assert.equal(port.source,await readFile(join(base,"lean-bridge/port.c"),"utf8"));
		const lease=model.leases.get("lease:"+ref.keys.Ticket.split("/").at(-1)).type;
		const deliveries=model.methods.filter(m=>m.delivery);
		assert.deepEqual(deliveries.map(m=>m.name).sort(),retained?["lend","revisit"]:["checked","pending","revisit","tickets"]);
		if(retained)
		{
			assert.equal(evidence.selection.phpTaskCallbacks,true);
			const sourceFiles={Depot: "resource-tasks/Depot.lean",Shared: "resource-tasks/Shared.lean",Exchange: "ruby-task-resources/Exchange.lean",LeaseFactory: "php-retained-resources/LeaseFactory.lean"};
			for(const [mod,path] of Object.entries(sourceFiles))
			{
				const fixture=await readFile(join("tests/fixtures",path));
				assert.deepEqual(fixture,await readFile(join(root,route,"source",mod+".lean")));
				assert.equal(evidence.interfaces.find(i=>i.module===mod).sourceSha256,sha256(fixture));
			}
		}
		for(const m of deliveries)
		{
			assert.equal(m.result,lease); assert.ok(m.args.includes(lease));
			const d=api.declarations.find(x=>x.name===m.name);
			assert.equal(d.result.ownership,"lease"); assert.deepEqual(d.result.lifetime,{scope: "explicit",anchor: null});
			assert.equal(d.parameters.find(p=>p.type.id==="lean:Shared.Ticket").ownership,"borrow");
			if(retained)
			{
				assert.deepEqual(m.args,[lease,"callback"]); assert.deepEqual(m.callbacks,[[1,"uint32",m.name==="revisit"?"uint32":"bool"]]);
				const cb=d.parameters[1]; assert.deepEqual(cb.lifetime,{scope: "explicit",anchor: null}); assert.equal(cb.ownership,"lease");
				assert.deepEqual(api.types.find(t=>t.id===cb.type.id).callable.failure.errors,["error:PhpCallbackException"]);
			}
		}
		const method=n=>model.methods.find(m=>m.name===n);
		if(retained)
		{
			assert.equal(method("lend").error,lease);
			assert.equal(api.errors.find(e=>e.id==="error:EIO.LeaseFactory.lend").payload.id,"lean:Shared.Ticket");
			assert.deepEqual(api.declarations.find(d=>d.name==="revisit").failure.errors,["error:TaskIO.Error","error:PhpCallbackException"]);
		}
		else
{ assert.equal(method("checked").error,lease); assert.equal(method("tickets").terminal,lease); }
		assert.equal(method("revisit").terminal,"string");
	}
	const rebuilt=retained?env.LEAN_BRIDGE_PHP_RETAINED_LEASE_REBUILT:env.LEAN_BRIDGE_PHP_TASK_LEASE_REBUILT;
	const copy=await readVerifiedPackageSetReceipt({receiptPath: join(rebuilt,"handoff/package-set-receipt.json")});
	assert.equal(copy.result.receiptSha256,offlineCLI.receiptSha256);
			assert.deepEqual(await json(join(rebuilt,"reproduction.json")),offlineCLI);}
	);
}
