/** @file Execute strict TypeScript against the exact npm handoff selected by the hosted receipt. */
import assert from "node:assert/strict";
import {mkdir, mkdtemp, readFile, rename, rm, writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";

const require = createRequire(import.meta.url);
const cases = {
	"ticket-positions": {serial: ((1n << 90n) + 7n).toString(), retained: true, staleRejected: true, closed: true}
	, "ticket-fields": {received: 41, returned: 73, rollback: true, transferred: true, calls: 1, closed: true}
	, "ticket-result-only": {serial: "20", quota: "0", inputAbsent: true, closed: true}
};

/**
 * Install in a fresh offline consumer. Remove the private feed and run the emitted files after relocation.
 *
 * @param handoff - Verified component and runtime packages.
 * @param selection - Route and receipt digest from the independently replayed hosted report.
 */
export async function checkNpmCandidateConsumer(handoff, selection)
{
	const work = await mkdtemp(join(tmpdir(), "candidate-ticket-"));
	try
	{
		const feed = join(work, "feed"), app = join(work, "app"), moved = join(work, "relocated");
		await copyPackageSetHandoff(handoff, feed);
		const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(feed,"package-set-receipt.json")});
		assert.equal(result.receiptSha256, selection.receiptSha256);
		assert.deepEqual(receipt.packages.map(p => p.role).sort(), ["component","runtime"]);
		const full = selection.route.endsWith("-full"), base = "@lean-bridge/owned-checked-records";
		const name = full ? base : base+"-result-only";
		assert.equal(receipt.packages.find(p=>p.role==="component").name,name);
		const runtime = receipt.packages.find(p => p.role === "runtime");
		const files = receipt.packages.flatMap(p => p.artifacts.map(a => join(feed,a.path)));
		assert.equal(files.length,2);
		await mkdir(app); await writeFile(join(app,"package.json"), '{"type":"module","private":true}');
		const flags = ["--offline","--ignore-scripts","--no-fund","--no-audit","--cache",join(work,"cache")];
		// Seed npm's lock with the original archive locations without installing any code.
		await run("npm", ["install","--package-lock-only",...flags,...files], app, process.env);
		await run("npm", ["uninstall","--package-lock-only",...flags,runtime.name], app, process.env);
		const manifest = JSON.parse(await readFile(join(app,"package.json")));
		assert.deepEqual(Object.keys(manifest.dependencies), [name]);
		// This consumer requests the component alone. npm must keep the exact runtime transitively.
		await run("npm", ["ci",...flags], app, process.env);
		const installed = async id => JSON.parse(await readFile(join(app,"node_modules",id,"package.json")));
		const component = await installed(name), dependency = await installed(runtime.name);
		assert.equal(component.dependencies[runtime.name], runtime.version);
		assert.equal(dependency.name, runtime.name);
		assert.equal(dependency.version, runtime.version);
		await rename(app, moved); await rm(feed,{recursive: true});
		const names = ["ticket-positions",full ? "ticket-fields" : "ticket-result-only"];
		for(const n of names)
		{
			let source = await readFile(resolve("tests/fixtures/structured-types",n+".mts"),"utf8");
			if(!full && n==="ticket-positions") source=source.replace(JSON.stringify(base),JSON.stringify(name));
			assert.ok(source.includes("from "+JSON.stringify(name)));
			await writeFile(join(moved,n+".mts"),source);
		}
		const compilerOptions = {types: [],strict: true,noEmitOnError: true,target: "ES2022",module: "NodeNext",skipLibCheck: false};
		await writeFile(join(moved,"tsconfig.json"), canonicalJson({files: names.map(n=>n+".mts"),compilerOptions}));
		const env = {PATH: "/without-author-tools", LANG: "C"};
		await run(process.execPath,[require.resolve("typescript/bin/tsc"),"-p","tsconfig.json"],moved,env);
		const clients = {};
		for(const n of names)
		{
			const observed = JSON.parse(await run(process.execPath,[n+".mjs"],moved,env));
			assert.deepEqual(observed,cases[n]);
			clients[n] = {sourceSha256: sha256(await readFile(join(moved,n+".mts")))
				, emittedSha256: sha256(await readFile(join(moved,n+".mjs"))), observed};
		}
		return {
			route: selection.route, receiptSha256: result.receiptSha256, clients
			, directDependency: name
			, transitiveRuntime: {name: dependency.name, version: dependency.version}
		};
	}
	finally
	{
		await rm(work,{recursive: true,force: true});
	}
}
