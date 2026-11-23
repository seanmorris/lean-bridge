/**
 * Exercise resource-bearing Composer releases in fresh installed PHP processes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { appendFile, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { installPhpIOComponents } from "./php-io-install.mjs";

const env = process.env, root = env.LEAN_BRIDGE_PHP_LEASE_CONSUME, fixture = resolve("tests/fixtures/php-io-resources");
const json = async f => JSON.parse(await readFile(f,"utf8"));
test("installed PHP resource identities cross independent packages, not incompatible Lean definitions"
	, { skip: !root, timeout: 3_600_000 }
	, async t => {
	const sources = {}, reports = [], releases = {};
	const phps = JSON.parse(env.LEAN_BRIDGE_TEST_PHPS ?? '["/usr/bin/php"]');
	assert.ok(phps.length > 0 && new Set(phps).size === phps.length);
	const files = ["example.php","installed.php","integrity.php"];
	for(const f of files) sources[f] = sha256(await readFile(join(fixture,f)));
	for(const route of ["ordinary","reviewed"])
	{
		const stage = await mkdtemp(join(tmpdir(),"php-lease-client-"));
		try
		{
			const local = join(stage,"install"), deploy = join(stage,"relocated app"); await mkdir(local);
			for(const f of files) await copyFile(join(fixture,f),join(local,f));
			const labels = [route,"peer","foreign"];
			const { components, vendor } = await installPhpIOComponents(stage,local,deploy,labels.map(r => resolve(root,r,"handoff")));
			let ledger;
			for(const [i,r] of labels.entries())
			{
				const { pkg, receiptSha256 } = components[i], prefix = join(vendor,pkg.name);
				const pin = await json(join(prefix,"lean-bridge/package-receipt.json"));
				const ir = await json(join(prefix,"lean-bridge/binding-ir.json"));
				ledger ??= pin.ledger; assert.deepEqual(ledger,pin.ledger);
				assert.equal(pin.libraries[ledger.library],ledger.sha256);
				const keys = Object.fromEntries(ir.types.map(type => [type.name,type.resource.kindId]));
				assert.deepEqual(Object.keys(keys).sort(),["Badge","Ticket"]);
				const data = { receiptSha256, archive: pkg.artifacts[0], runtime: pkg.runtimeIdentity, ledger, keys, bindingIrSha256: pin.bindingIrSha256 };
				if(releases[r]) assert.deepEqual(releases[r],data); else releases[r] = data;
			}
			assert.deepEqual(releases[route].keys,releases.peer.keys);
			for(const n of ["Badge","Ticket"]) assert.notEqual(releases[route].keys[n],releases.foreign.keys[n]);
			const path = join(vendor,components[0].pkg.name,"native/linux-x64",ledger.library), lib = await readFile(path);
			assert.equal(sha256(lib),ledger.sha256);
			const isolated = { PATH: "/unavailable", LANG: "C.UTF-8", TMPDIR: deploy, LEAN_NUM_THREADS: "1" };
			for(const php of phps)
			{
				const staticFFI = await run(php,["-n","-r","echo (int)extension_loaded('ffi');"],deploy,isolated);
				const flags = staticFFI === "1" ? ["-n"] : ["-n","-d","extension=ffi"]; flags.push("-d","ffi.enable=1");
				await appendFile(path,"!");
				try
				{ assert.equal(await run(php,[...flags,"integrity.php"],deploy,isolated),"modified ledger refused"); }
				finally
				{ await writeFile(path,lib); }
				await run(php,[...flags,"example.php"],deploy,isolated);
				for(const order of ["depot-first","peer-first"])
				{
					const row = JSON.parse(await run(php,[...flags,"installed.php",order],deploy,isolated));
					assert.equal(row.order,order); assert.deepEqual(row.final,[3,1,3,0]);
					assert.equal(typeof row.fork,"boolean"); assert.equal(row.checks,row.fork ? 35 : 34);
					reports.push({ route,...row, flags, modifiedLedgerRefused: true });
					t.diagnostic(route+" / PHP "+row.php+" / "+order+": "+row.checks+" checks");
				}
			}
		}
		finally
		{ await rm(stage,{ recursive: true, force: true }); }
	}
	const record = canonicalJson({ sources, reports, releases });
	if(env.LEAN_BRIDGE_PHP_LEASE_EXPECTED) assert.equal(record,await readFile(resolve(env.LEAN_BRIDGE_PHP_LEASE_EXPECTED),"utf8"));
		else await writeFile(resolve(root,"installed-php-leases.json"),record,{ flag: "wx" });}
);
