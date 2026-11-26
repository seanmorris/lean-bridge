/** @file Replay two source routes and the last-owner contract from verified wheels without rebuilding Lean. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,link,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,dirname,join,resolve} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {packageSetReceiptName,readVerifiedPackageSetReceipt,validatePackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {checkPythonHostErrors,policyClient} from "./python-host-error-client.mjs";

const exec=promisify(execFile);
const json=async path=>JSON.parse(await readFile(path));
test("wheel-only replay keeps sole error payloads and refuses stale nested results", {timeout: 600000},async t=>{
	const python=process.env.LEAN_BRIDGE_HOST_PYTHON, saved=process.env.LEAN_BRIDGE_PYTHON_ERROR_REPLAY;
	assert.ok(python && saved,"set LEAN_BRIDGE_HOST_PYTHON and LEAN_BRIDGE_PYTHON_ERROR_REPLAY (the ABI evidence directory)");
	const abi=resolve(saved),root=await mkdtemp(join(tmpdir(),"python-error-replay-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const wheels=join(root,"archives"); await mkdir(wheels);
	const archives=new Map(),releases=[];
	for(const name of ["workshop","workshop-peer"])
	{
		const dir=join(abi,name),path=join(dir,packageSetReceiptName),receipt=await json(path);
		validatePackageSetReceipt(receipt);
		assert.equal(receipt.packages.length,2);
		for(const pkg of receipt.packages)
		{
			assert.equal(pkg.name,pkg.role==="runtime"?"lean-bridge-host-runtime":"lean-"+name);
			assert.equal(pkg.artifacts.length,1);
			const [a]=pkg.artifacts,filename=basename(a.path);
			assert.equal(a.path,"archives/"+filename);
			assert.ok(filename.endsWith(".whl"));
			if(archives.has(filename))
			{
				assert.equal(archives.get(filename),a.sha256);
				continue;
			}
			archives.set(filename,a.sha256);
			const source=join(dirname(abi),"wheels",filename),target=join(wheels,filename);
			try
			{ await link(source,target); }
			catch(e)
			{ if(e.code!=="EXDEV") throw e; await copyFile(source,target); }
		}
		const verified=await readVerifiedPackageSetReceipt({receiptPath: path,artifactRoot: root});
		const selected=await json(join(dir,"host-export-evidence.json"));
		assert.equal(selected.sourceTreeSha256,receipt.source.treeSha256);
		assert.equal(hashBindingIr(await json(join(dir,"binding-ir.json"))),receipt.profiles[0].bindingIrSha256);
		const review=name==="workshop-peer"?sha256(await readFile(join(dir,"source/api.binding-ir.json"))):null;
		assert.equal(selected.reviewedSourceSha256,review);
		releases.push({name,receipt: verified.result.receiptSha256,source: selected.sourceTreeSha256,review});
	}
	assert.equal(archives.size,3,"two components must share the exact runtime");
	const prefix=join(root,"prefix"),relocated=join(root,"relocated");
	await exec(python,["-I","-m","pip","--isolated","--disable-pip-version-check","install","--no-cache-dir","--no-index","--no-compile","--no-deps","--target",prefix,...Array.from(archives.keys(),k=>join(wheels,k))],{cwd: root});
	await rename(prefix,relocated);
	const env={PATH: "/unavailable",PYTHONPATH: relocated,PYTHONNOUSERSITE: "1",LEAN_NUM_THREADS: "1"};
	const owner=fileURLToPath(new URL("../fixtures/host-object/strong.py",import.meta.url));
	const run=await exec(python,["-S","-B",owner],{cwd: root,env,timeout: 45000});
	assert.equal(run.stderr,""); assert.match(run.stdout,/nested typed error alone owns the counter: peer reads 23 then 42, one finalization/u);
	const terminal=await checkPythonHostErrors(python,root,env),output=process.env.LEAN_BRIDGE_PYTHON_ERROR_POLICY_OUTPUT;
	const report={
		abi: basename(abi)
		, archives: Object.fromEntries(archives)
		, releases
		, owner: run.stdout.trim()
		, ownerClientSha256: sha256(await readFile(owner))
		, terminalClientSha256: sha256(await readFile(policyClient))
		, terminal
	};
	if(output)
	{
		await mkdir(output,{recursive: true});
		await writeFile(join(output,basename(abi)+".json"),canonicalJson(report));
	}
	t.diagnostic(report.abi+": both installed directions rejected stale results and drained");
});
