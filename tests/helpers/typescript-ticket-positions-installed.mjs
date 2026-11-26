/** @file Compile and execute the missing TypeScript Ticket placement probe on original npm archives. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalizeJsonValue} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {selectedTicketArchive} from "./resource-position-archives.mjs";

const require=createRequire(import.meta.url);
const name="@lean-bridge/owned-checked-records",fixture=resolve("tests/fixtures/structured-types/ticket-positions.mts");
test("strict TypeScript executes Ticket inputs and results from the two original npm handoffs",async t=>{
	const lane=await selectedTicketArchive("javascript"),seen=new Set();
	for(const route of ["ordinary","reviewed"])
	{
		const root=await mkdtemp(join(tmpdir(),"typescript-ticket-"));t.after(()=>rm(root,{recursive: true,force: true}));
		const prefix="hosted/output/owned-checked-record-javascript-packaging/evidence/"+route+"-full/handoff/";
		const h=join(root,"handoff"),app=join(root,"client"),moved=join(root,"relocated");await mkdir(h);await mkdir(app);
		const receipt="package-set-receipt.json",raw=await lane.read(prefix+receipt),rc=JSON.parse(raw);
		await writeFile(join(h,receipt),raw);await writeFile(join(h,receipt+".sha256"),await lane.read(prefix+receipt+".sha256"));
		assert.deepEqual(rc.packages.map(p=>p.role).sort(),["component","runtime"]);
		const artifacts={};
		for(const pkg of rc.packages)
		{
			const [art]=pkg.artifacts;assert.equal(pkg.artifacts.length,1);assert.ok(!art.path.includes("/"));
			const bytes=await lane.read(prefix+art.path);assert.equal(sha256(bytes),art.sha256);
			await writeFile(join(h,art.path),bytes);artifacts[pkg.role]=art.sha256;
		}
		const {result}=await readVerifiedPackageSetReceipt({receiptPath: join(h,receipt)});seen.add(result.receiptSha256);
		await writeFile(join(app,"package.json"),JSON.stringify({private: true,type: "module"}));
		await run("npm",["install","--offline","--ignore-scripts"
			, "--no-audit","--no-fund","--cache",join(root,"cache")
			, ...rc.packages.map(p=>join(h,p.artifacts[0].path))],app,process.env);
		await copyFile(fixture,join(app,"ticket.mts"));await rename(app,moved);await rm(h,{recursive: true});
		const sourceSha256=sha256(await readFile(join(moved,"ticket.mts")));
		const metadata=join(moved,"node_modules",name,"metadata/compiler/binding-ir.json");
		const rawIr=await readFile(metadata),ir=JSON.parse(rawIr);
		const decl=n=>ir.declarations.find(d=>d.source.declaration==="OwnedCheckedRecords."+n);
		const id="lean:OwnedCheckedRecords.Ticket",ticket={kind: "named",id};
		assert.equal(ir.types.find(t=>t.id===id).kind,"resource");
		const make=decl("newTicket").result,input=decl("serial").parameters;
		assert.equal(input.length,1);assert.deepEqual(input[0].type,ticket);assert.deepEqual(make.type,ticket);
		assert.equal(make.ownership,"lease");assert.equal(make.lifetime.scope,"explicit");
		assert.equal(input[0].ownership,"borrow");assert.equal(input[0].lifetime.scope,"call");
		const bindingIrSha256=sha256(canonicalizeJsonValue(ir));
		assert.equal(bindingIrSha256,rc.profiles[0].bindingIrSha256);
		const options={strict: true,types: [],module: "NodeNext",target: "ES2022",skipLibCheck: false};
		await writeFile(join(moved,"tsconfig.json"),JSON.stringify({files: ["ticket.mts"],compilerOptions: options}));
		const env={PATH: "/without-producer-tools",LANG: "C"};
		await run(process.execPath,[require.resolve("typescript/bin/tsc"),"-p","tsconfig.json"],moved,env);
		const observed=JSON.parse(await run(process.execPath,["ticket.mjs"],moved,env));
		assert.deepEqual(observed,{serial: ((1n<<90n)+7n).toString(),retained: true,staleRejected: true,closed: true});
		const typescript=require("typescript/package.json").version;
		const report={route,revision: lane.revision,receipt: result.receiptSha256
			, artifacts,bindingIrSha256,package: name,sourceSha256,typescript,observed};
		if(process.env.LEAN_BRIDGE_TS_TICKET_OUTPUT)
		{
			const out=resolve(process.env.LEAN_BRIDGE_TS_TICKET_OUTPUT);await mkdir(out,{recursive: true});
			await writeFile(join(out,route+".json"),canonicalJson(report));
		}
		t.diagnostic(route+": "+result.receiptSha256);
	}
	assert.equal(seen.size,2);
});
