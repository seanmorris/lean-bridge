/**
 * Reconstruct nominal heap identities from compiler-resolved application imports.
 * Standard library imports belong to the pinned compiler, not this graph.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";

/**
 * Use only the declaring module and its transitive application dependencies.
 *
 * @param evidence - Elaborated module and input provenance.
 * @param evidence.compilerSha256 - Compiler binary used for every interface.
 * @param evidence.interfaces - Module names and checked source digests.
 * @param evidence.resourceImports - Exact per-module application import edges.
 * @param evidence.resources - Lean's nominal declarations and defining modules.
 */
export const heapResourceIdentities = ({compilerSha256,interfaces,resourceImports,resources}) => {
	const digest=x=>typeof x==="string" && /^[a-f0-9]{64}$/u.test(x);
	const validName=x=>typeof x==="string" && /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/u.test(x);
	const fail=()=>{throw new TypeError("Invalid compiler-resolved heap resource provenance");};
	if(!digest(compilerSha256)||!Array.isArray(interfaces)||!resourceImports||!Array.isArray(resources)) fail();
	const byName=new Map();
	for(const {module,sourceSha256} of interfaces)
	{
		if(!validName(module)||byName.has(module)||!digest(sourceSha256)) fail();
		byName.set(module,sourceSha256);
	}
	if(Object.keys(resourceImports).length!==byName.size) fail();
	const parents=new Map([...byName.keys()].map(name=>[name,[]])), remaining=new Map(), ready=[];
	for(const name of byName.keys())
	{
		if(!Object.hasOwn(resourceImports,name)) fail();
		const edges=resourceImports[name];
		if(!Array.isArray(edges)||new Set(edges).size!==edges.length) fail();
		for(const dep of edges)
		{ if(!byName.has(dep)) fail(); parents.get(dep).push(name); }
		remaining.set(name,edges.length); if(!edges.length) ready.push(name);
	}
	for(let cursor=0;cursor<ready.length;++cursor) for(const parent of parents.get(ready[cursor]))
	{
		const count=remaining.get(parent)-1; remaining.set(parent,count); if(!count) ready.push(parent);
	}
	if(ready.length!==byName.size) fail();
	const families=new Map();
	const family=owner=>{
		if(families.has(owner)) return families.get(owner);
		const seen=new Set([owner]), stack=[owner];
		while(stack.length) for(const dep of resourceImports[stack.pop()]) if(!seen.has(dep))
		{ seen.add(dep); stack.push(dep); }
		const out=[...seen].sort().map(module=>({module,sourceSha256: byName.get(module)}));
		families.set(owner,out); return out;
	};
	const declarations=new Set();
	return resources.map(r=>{
		if(!validName(r.declaration)||declarations.has(r.declaration)||!byName.has(r.module)) fail();
		declarations.add(r.declaration);
		const modules=family(r.module);
		return {...r,identity: sha256(canonicalJson({abi: "lean-bridge/heap-resource-v1",declaration: r.declaration,compilerSha256,modules}))};
	});
};
