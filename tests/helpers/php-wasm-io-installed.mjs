/** @file Install and relocate an actual PHP-Wasm IO CLI release before exercising it. */
import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { brickMathRepository, composerFileUrl } from "./brick-math.mjs";
import { exerciseInstalledIOBrowser } from "./php-wasm-io-installed-browser.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const release = process.env.LEAN_BRIDGE_PHP_WASM_IO_RELEASE;
test("installed PHP-Wasm synchronous IO survives relocation in both ecosystems", { skip: !release, timeout: 300_000 }, async t => {
	const receiptPath = join(release,"package-set-receipt.json");
	const {receipt} = await readVerifiedPackageSetReceipt({receiptPath});
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
	if(peer)
	{
		const other = (await readVerifiedPackageSetReceipt({receiptPath: join(peer,"package-set-receipt.json")})).receipt;
		assert.deepEqual(other.profiles.map(p=>p.id),["php-wasm-copied-v1"]);
		const runtime = set => set.packages.find(p=>p.role === "runtime").artifacts[0].sha256;
		assert.equal(runtime(receipt),runtime(other));
		const adapter = other.packages.find(p=>p.name === "@example/willow-php-wasm"), item = adapter.artifacts[0];
		const path = join(feed,item.path.split("/").pop());
		await cp(join(peer,item.path),path); npm.push(path);
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
	if(peer) await cp(join(fixture,"installed-peer.mjs"),join(app,"installed-peer.mjs"));
	await rename(app,moved); await rename(feed,join(work,"disabled-feed"));
	for(const mode of ["embedded","composer"])
	for(const loading of ["startup","lazy"])
	{
		const result = await run(process.execPath,["installed-node.mjs",mode,loading],moved,{PATH: "/no-build-tools"});
		assert.equal(result.stdout.trim(),"php-api:30"); assert.equal(result.stderr,"");
		t.diagnostic(mode+"/"+loading+": "+result.stdout.trim());
	}
	if(process.env.LEAN_BRIDGE_PHP_WASM_BROWSER_TEST === "1") await exerciseInstalledIOBrowser({app: moved,host,t});
	if(peer) for(const order of ["io-first","pure-first"])
	{
		const result = await run(process.execPath,["installed-peer.mjs",order],moved,{PATH: "/no-build-tools"});
		assert.equal(result.stderr,""); assert.equal(result.stdout.trim(),"17:7; one runtime, two components");
		t.diagnostic(order+": "+result.stdout.trim());
	}
});
