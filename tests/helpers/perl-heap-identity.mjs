/**
 * Exercise provenance reconstruction without creating any resource, compiler or package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { heapResourceIdentities } from "../../src/analyze/heap-resource-identity.mjs";
import { perlResourceKinds } from "../../src/backends/perl/io-resources.mjs";
import { sha256 } from "../../src/capsule/node.mjs";

test("resource identity follows the complete owner import family, not every application module",()=>{
	const names=["Base","Shared","Middle","Unrelated","Main"];
	const resourceImports = { Base: [], Middle: ["Base"], Shared: ["Middle","Base"]
		, Unrelated: [], Main: ["Shared","Unrelated"] };
	const resources = ["Model.Ticket","Model.Badge"].map(declaration => ({ module: "Shared", declaration }));
	const e = { compilerSha256: sha256("compiler"), resourceImports, resources
		, interfaces: names.map(module => ({ module, sourceSha256: sha256(module) })) };
	const id=x=>heapResourceIdentities(x).map(r=>r.identity);
	const initial=id(e); assert.notEqual(initial[0],initial[1]);
	for(const module of names)
	{
		const changed=structuredClone(e); changed.interfaces.find(i=>i.module===module).sourceSha256=sha256("changed");
		if(["Shared","Middle","Base"].includes(module)) assert.notDeepEqual(id(changed),initial);
		else assert.deepEqual(id(changed),initial);
	}
	const reordered=structuredClone(e); reordered.interfaces.reverse(); reordered.resourceImports.Shared.reverse();
	assert.deepEqual(id(reordered),initial);
	assert.notDeepEqual(id({...e,compilerSha256: sha256("different compiler")}),initial);
	for(const change of [
		x=>{delete x.resourceImports.Unrelated;}, x=>{x.resourceImports.Extra=[];}
		, x=>{x.resourceImports.Shared=["Missing"];}
		, x=>{x.resourceImports.Base=["Shared"];}
		, x=>{x.resourceImports.Unrelated=["Unrelated"];}
		, x=>{x.resourceImports.Shared=["Base","Base"];}
		, x=>{x.resources.push(x.resources[0]);}
		, x=>{x.resources[0].module="NoSuchModule";}
		, x=>{x.interfaces[0].sourceSha256="bad";}
	]){
		const invalid=structuredClone(e); change(invalid);
		assert.throws(()=>id(invalid),/Invalid compiler-resolved heap resource provenance/u);
	}
});
test("Perl cannot relabel a wire lease or substitute a different resource owner",()=>{
	const source=sha256("Shared"),decl="Shared.Ticket";
	const resources=[{module: "Shared",declaration: decl}];
	const interfaces = [{ module: "Shared", sourceSha256: source }];
	const proof = { compilerSha256: sha256("lean"), interfaces, resourceImports: { Shared: [] }, metadata: { leanResources: resources }, selection: { leanResources: [decl] } };
	const [{identity: hash}]=heapResourceIdentities({...proof,resources});
	const extensions = { "lean-bridge.dev/resource-identity": hash };
	const type = { id: "lean:"+decl, kind: "resource", host: null, resource: { kindId: "resource:"+decl+"/"+hash }, source: { declaration: decl, extensions } };
	const key="lease:"+hash,stem="lbwire_test";
	const lease = { type: key, hash, name: "Ticket", tag: 3, symbol: stem+"_lease_0" };
	const id = sha256("runtime");
	const ledger = { id, sha256: sha256("library"), library: "liblb_task_resources_"+id+".so" };
	const wire = { clear: stem+"_clear", leases: [lease] };
	const model = { api: { types: [type] }, wire, proof, ledger };
	const kinds=m=>perlResourceKinds(m.api,m.wire,m.proof,m.ledger);
	assert.equal(kinds(model).get(key).brokerKind,"lean:"+decl+":"+source);
	for(const change of [
		m=>{m.wire.leases[0].tag=4;},m=>{m.wire.leases[0].symbol="another_lease_0";}
		, m=>{m.wire.leases[0].type="lease:"+sha256("different");}
		, m=>{m.wire.leases[0].name="Badge";}
		, m=>{m.proof.interfaces[0].sourceSha256=sha256("other source");}
		, m=>{m.proof.selection.leanResources=["Shared.Other"];}
		, m=>{m.ledger.library="libwrong.so";}
		, m=>{m.api.types[0].resource.kindId="resource:"+decl+"/unverified";}
	]){
		const altered=structuredClone(model); change(altered); assert.throws(()=>kinds(altered));
	}
});
const depot=process.env.LEAN_BRIDGE_PRIOR_DEPOT;
test("reconstruct the nominal identities of a previously built Depot release",{skip: !depot},async()=>{
	const json=async file=>JSON.parse(await readFile(join(depot,"handoff",file),"utf8"));
	const api=await json("binding-ir.json"), proof=await json("host-export-evidence.json");
	const resourceImports={Shared: [],Depot: ["Shared"],Exchange: ["Depot"]};
	for(const {module,sourceSha256} of proof.interfaces)
	{
		const source=await readFile(join(depot,"source",module+".lean"),"utf8"); assert.equal(sha256(source),sourceSha256);
		// Only this retained three-file fixture uses these simple import statements.
		// Production uses lean --src-deps, never source parsing.
		assert.deepEqual([...source.matchAll(/^import ([A-Za-z.]+)$/gmu)].map(m=>m[1]).filter(n=>Object.hasOwn(resourceImports,n)),resourceImports[module]);
	}
	const result=heapResourceIdentities({...proof,resourceImports,resources: proof.metadata.leanResources});
	for(const x of result) assert.equal(x.identity,api.types.find(t=>t.id==="lean:"+x.declaration).source.extensions["lean-bridge.dev/resource-identity"]);
	assert.equal(result.length,2);
});
