/** @file Install and relocate an actual PHP-Wasm IO CLI release before exercising it. */
import assert from "node:assert/strict";
import test from "node:test";
import { appendFile, cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { readVerifiedPhpWasmCopiedRuntime } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { buildPhpWasmBrokerSnapshot } from "./php-wasm-broker-snapshot.mjs";
import { brickMathRepository, composerFileUrl } from "./brick-math.mjs";
import { exerciseInstalledIOBrowser } from "./php-wasm-io-installed-browser.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { readPhpWasmIOProjectComponent } from "../../src/build/php-wasm-io-project.mjs";
import { exercisePhpWasmLedgerRoutes } from "./php-wasm-ledger-routes.mjs";

const release = process.env.LEAN_BRIDGE_PHP_WASM_IO_RELEASE;
const installed = async (t, release, immediate = false, route = null) => {
	const receiptPath = join(release,"package-set-receipt.json");
	const {receipt, result: verification} = await readVerifiedPackageSetReceipt({receiptPath});
	await assertJsonSchema("package-set-receipt",receipt);
	assert.deepEqual(receipt.profiles.map(p=>p.id),["php-wasm-sync-io-v1"]);
	const work = await mkdtemp(join(tmpdir(),"php-wasm-installed-io-"));
	t.after(()=>rm(work,{recursive: true,force: true}));
	const app = join(work,"app"), feed = join(work,"feed"), moved = join(work,"relocated");
	await mkdir(app); await mkdir(feed);
	const run = async (command,args,cwd,env=process.env) => {
		try
		{ return await processBuildRunner.capture({ command,args,cwd,env }); }
		catch(error)
		{ t.diagnostic(error.details?.stderr ?? error.message); throw error; }
	};
	const npm = [];
	let composer;
	for(const pkg of receipt.packages)
	{
		const [item] = pkg.artifacts, archive = join(feed,item.path.split("/").pop());
		await cp(join(release,item.path),archive);
		if(pkg.ecosystem === "npm") npm.push(archive);
		else
		{
			const metadata = JSON.parse((await run("unzip",["-p",archive,"composer.json"],app)).stdout);
			assert.equal(metadata.name,pkg.name); assert.equal(metadata.version,pkg.version);
			composer = { ...metadata, dist: {type: "zip",url: composerFileUrl(archive)} };
		}
	}
	assert.equal(npm.length,2); assert.equal(composer.name,"lean-bridge/ledger");
	const peer = process.env.LEAN_BRIDGE_PHP_WASM_IO_PURE_PEER;
	const callbacks = process.env.LEAN_BRIDGE_PHP_WASM_IO_CALLBACK_PEER;
	for(const [root,name] of [[peer,"@example/willow-php-wasm"],[callbacks,"php-wasm-switchboard"]])
	{
		if(!root) continue;
		const other = (await readVerifiedPackageSetReceipt({receiptPath: join(root,"package-set-receipt.json")})).receipt;
		assert.deepEqual(other.profiles.map(p=>p.id),["php-wasm-copied-v1"]);
		const runtime = set => set.packages.find(p=>p.role === "runtime").artifacts[0].sha256;
		assert.equal(runtime(receipt),runtime(other));
		const adapter = other.packages.find(p=>p.name === name), item = adapter.artifacts[0];
		const path = join(feed,item.path.split("/").pop());
		await cp(join(root,item.path),path); npm.push(path);
	}
	await writeFile(join(app,"package.json"),canonicalJson({private: true,type: "module"}));
	await run("npm",["install","--offline","--ignore-scripts","--legacy-peer-deps","--no-fund","--no-audit",...npm],app,{...process.env,npm_config_cache: join(work,"npm-cache")});
	const repositories = [{"packagist.org": false},await brickMathRepository(join(feed,"brick")),{type: "package",package: composer}];
	await writeFile(join(app,"composer.json"),canonicalJson({name: "test/ledger"
		, config: {platform: {php: "8.4.1"}}, repositories
		, require: {[composer.name]: composer.version} }));
	await run("composer",["--no-plugins","--no-scripts","--no-interaction","--no-cache","install","--prefer-dist"],app,{...process.env,COMPOSER_DISABLE_NETWORK: "1",COMPOSER_ALLOW_SUPERUSER: "1",COMPOSER_HOME: join(work,"composer-home")});
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST);
	await symlink(host,join(app,"node_modules/php-wasm"),"dir");
	const fixture = "tests/fixtures/php-wasm-sync-io-probe";
	for(const path of ["consumer.php","installed.mjs","installed-node.mjs"]) await cp(join(fixture,path),join(app,path));
	if(immediate)
	{
		const compiled = join(app,"node_modules/php-wasm-ledger/compiled");
		const api = JSON.parse(await readFile(join(compiled,"io/binding-ir.json")));
		const {io} = JSON.parse(await readFile(join(compiled,"artifacts.json")));
		assert.match(io.zendIdentity,/^[a-f0-9]{64}$/u);
		const entry = (operation,declaration) => {
			const i=api.declarations.findIndex(d=>d.source.declaration===declaration && d.resultMode==="iterator");
			assert.ok(i>=0); return "\\LeanBridge\\WasmIO\\C"+io.zendIdentity+"\\"+operation+i;
		};
		const probe=(await readFile(join(fixture,"immediate.php"),"utf8"))
			.replace("__LB_SEQUENCE_OPEN__",entry("call","Pulls.sequence")).replace("__LB_UNIT_NEXT__",entry("next","Pulls.units"));
		await writeFile(join(app,"consumer.php"),probe);
	}
	if(peer) await cp(join(fixture,"installed-peer.mjs"),join(app,"installed-peer.mjs"));
	if(callbacks)
	{
		for(const path of ["callback-host.mjs","callback-node.mjs","callbacks.php"]) await cp(join(fixture,path),join(app,path));
		const probe = process.env.LEAN_BRIDGE_PHP_WASM_IO_TEST_PROBE, output = join(app,"snapshot.so");
		if(probe) await cp(probe,output);
		else
		{
			const { LEAN_BRIDGE_PHP_WASM_IO_RUNTIME: runtimeRoot
				, LEAN_BRIDGE_PHP_WASM_IO_HEADERS: phpSource
				, LEAN_BRIDGE_PHP_WASM_EMSDK: emsdkRoot } = process.env;
			if(!runtimeRoot || !phpSource || !emsdkRoot) throw new Error("Callback test needs a prebuilt snapshot or the IO runtime, PHP headers and Emscripten SDK");
			const { manifest } = await readVerifiedPhpWasmCopiedRuntime(runtimeRoot);
			await buildPhpWasmBrokerSnapshot({runtimeRoot,runtimeLibrary: manifest.library,phpSource,emsdkRoot,output});
		}
		const api = JSON.parse(await readFile(join(app,"node_modules/php-wasm-ledger/compiled/io/binding-ir.json")));
		await writeFile(join(app,"slots.json"),canonicalJson(Object.fromEntries(api.declarations.map((d,i)=>[d.source.declaration,i]))));
	}
	await rename(app,moved); await rename(feed,join(work,"disabled-feed"));
	let identity;
	const observations = [];
	if(route)
	{
		const [profile] = receipt.profiles;
		const {model} = await readPhpWasmIOProjectComponent(join(moved,"node_modules/php-wasm-ledger/compiled"),profile.runtimeIdentity);
		const {sourceIdentity} = model;
		const review = sourceIdentity.reviewedBindingIr;
		assert.equal(model.bindingIrSha256, profile.bindingIrSha256);
		assert.equal(Boolean(review), route === "reviewed");
		if(review) assert.equal(review.semanticSha256, profile.bindingIrSha256);
		const ledger = sourceIdentity.lakeDependencies.snapshot.rootInputs.find(input => input.path === "Ledger.lean");
		assert.equal(ledger.sha256,sha256(await readFile("tests/fixtures/php-wasm-sync-io/Ledger.lean")));
		const sources = {};
		for(const file of ["consumer.php","installed.mjs","installed-node.mjs"]) sources[file] = sha256(await readFile(join(moved,file)));
		identity = {route, receiptSha256: verification.receiptSha256, bindingIrSha256: model.bindingIrSha256,
			runtimeIdentity: profile.runtimeIdentity, ledgerSha256: ledger.sha256, sourceTreeSha256: sourceIdentity.sourceTreeSha256,
			reviewSha256: review?.sourceSha256 ?? null, archives: Object.fromEntries(receipt.packages.map(p=>[p.name,p.artifacts[0].sha256])),
			clientSha256: sources, phpWasmVersion: JSON.parse(await readFile(join(host,"package.json"))).version};
		assert.equal(identity.phpWasmVersion,"0.1.0");
		// The author retains their handoff for replay; neither downstream client
		// needs the local package repository or the installer's cache.
		await rm(join(work,"disabled-feed"),{recursive: true});
		await rm(join(work,"npm-cache"),{recursive: true,force: true});
	}
	if(immediate)
	{
		// This route owns the release it just built. Only installed packages and
		// the PHP distribution remain available to the downstream processes.
		await rm(release,{recursive: true});
		await rm(join(work,"disabled-feed"),{recursive: true});
		await rm(join(work,"npm-cache"),{recursive: true,force: true});
	}
	if(callbacks) for(const fault of ["pending","sum","padding"])
	{
		const r = await run(process.execPath,["callback-node.mjs",fault],moved,{PATH: "/no-build-tools"});
		assert.equal(r.stderr,""); assert.equal(r.stdout.trim(),"callbacks:"+fault+":retired:0"); t.diagnostic("Node/"+r.stdout.trim());
	}
	for(const mode of ["embedded","composer"])
	for(const loading of ["startup","lazy"])
	{
		const result = await run(process.execPath,["installed-node.mjs",mode,loading,...immediate ? ["immediate"] : []],moved,{PATH: "/no-build-tools"});
		assert.equal(result.stdout.trim(),immediate ? "pulls:12;closes:7;shutdown:1209" : "php-api:30"); assert.equal(result.stderr,"");
		observations.push({host: "Node", mode, loading, result: result.stdout.trim()});
		t.diagnostic(mode+"/"+loading+": "+result.stdout.trim());
	}
	if(route || process.env.LEAN_BRIDGE_PHP_WASM_BROWSER_TEST === "1")
		observations.push(...await exerciseInstalledIOBrowser({app: moved,host,t,callbacks,immediate}));
	if(peer) for(const order of ["io-first","pure-first"])
	{
		const result = await run(process.execPath,["installed-peer.mjs",order],moved,{PATH: "/no-build-tools"});
		assert.equal(result.stderr,""); assert.equal(result.stdout.trim(),"17:7; one runtime, two components");
		t.diagnostic(order+": "+result.stdout.trim());
	}
	if(route) return {...identity,observations};
};
test("installed PHP-Wasm synchronous IO survives relocation in both ecosystems", {skip: !release,timeout: 300_000}, t => installed(t,release));

test("both Ledger author routes execute installed synchronous IO in Zend",
	{skip: !process.env.LEAN_BRIDGE_PHP_WASM_LEDGER_PAIR, timeout: 1_800_000},
	t => exercisePhpWasmLedgerRoutes(t, (handoff,route) => installed(t,handoff,false,route)));

test("PHP-Wasm installs real synchronous Lean iterators in Zend on both source routes",
	{skip: !process.env.LEAN_BRIDGE_PHP_WASM_IMMEDIATE,timeout: 1_800_000}, async t => {
	let review;
	for(const route of ["ordinary","reviewed"]) await t.test(route, async t => {
		const root = await mkdtemp(join(tmpdir(),"php-wasm-direct-"));
		t.after(()=>rm(root,{recursive: true,force: true}));
		const project = join(root,"project"), output = join(root,"release");
		await cp("tests/fixtures/php-wasm-sync-io",project,{recursive: true});
		await cp("tests/fixtures/javascript-immediate/Pulls.lean",join(project,"Pulls.lean"));
		await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname = "Pulls"\n');
		const file = join(project,"lean-bridge.exports.json"), config = JSON.parse(await readFile(file));
		config.modules.push("Pulls");
		config.iterators = [["sequence","next"],["checked","nextChecked"],["units","nextUnit"],["replies","nextReply"]]
			.map(([open,next])=>({open: "Pulls."+open,next: "Pulls."+next,close: "Pulls.finish"}));
		config.exports.push("Pulls.counts",...config.iterators.map(p=>p.open));
		if(route === "reviewed")
{
			assert.ok(review);
			delete config.exports;
			await writeFile(join(project,"public.binding-ir.json"),canonicalJson(review));
}
		await writeFile(file,canonicalJson(config));
		await buildCanonicalProject({projectRoot: project,outputRoot: output,targets: ["php-wasm"]})
			.catch(e => { throw new Error(e.message+" "+JSON.stringify(e.details),{cause: e}); });
		await rm(project,{recursive: true});
		const api = JSON.parse(await readFile(join(output,"php-wasm/component/io/binding-ir.json")));
		assert.equal(api.declarations.filter(d=>d.resultMode==="iterator").length,4);
		if(review) assert.deepEqual(api,review); else review=api;
		const {result}=await readVerifiedPackageSetReceipt({receiptPath: join(output,"package-set-receipt.json")});
		t.diagnostic(route+" package set: "+result.receiptSha256);
		await installed(t,output,true);
	});}
);
