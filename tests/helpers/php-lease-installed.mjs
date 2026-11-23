/**
 * Produce compatible PHP resource packages from the same declaring Lean module,
 * and a third, same-named resource whose compiled definition differs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, asyncRoot = env.LEAN_BRIDGE_PHP_TASK_LEASE_BUILD;
const root = asyncRoot ?? env.LEAN_BRIDGE_PHP_LEASE_BUILD;
const load = async file => JSON.parse(await readFile(file,"utf8"));
const fx = resolve("tests/fixtures"), shared = join(fx,"resource-tasks");
test("compile installed PHP resource owners from independent ordinary, reviewed and incompatible projects"
	, { skip: !root, timeout: 7_200_000 }
	, async t => {
	const routes=asyncRoot ? ["ordinary","reviewed"] : ["ordinary","reviewed","peer","foreign"];
	for(const route of env.LEAN_BRIDGE_PHP_LEASE_ROUTE ? [env.LEAN_BRIDGE_PHP_LEASE_ROUTE] : routes)
	{
		assert.ok(routes.includes(route));
		const dir = resolve(root,route), src = join(dir,"source"), out = join(dir,"handoff"), foreign = route === "foreign";
		const depot = ["ordinary","reviewed"].includes(route);
		const mod = depot ? "Depot" : route === "peer" ? "Counter" : "ForeignPeer", modules = depot ? [mod,"Exchange"] : [mod];
		const name = "lean-bridge/"+mod.toLowerCase();
		await mkdir(src,{ recursive: true });
		const copy = (from,to) => copyFile(from,join(src,to),constants.COPYFILE_EXCL);
		const save = (n,bytes) => writeFile(join(src,n),bytes,{ flag: "wx" });
		await copy(join(shared,"lean-toolchain"),"lean-toolchain");
		const original = await readFile(join(shared,"Shared.lean"),"utf8"), field = "  descriptor : IO.FS.Handle";
		assert.equal(original.split(field).length,2);
		await save("Shared.lean",foreign ? original.replace(field,"  changed : String\n"+field) : original);
		let exports;
		if(depot)
		{
			await copy(join(shared,"Depot.lean"),"Depot.lean"); await copy(join(fx,"php-io-resources/Exchange.lean"),"Exchange.lean");
			exports = ["Depot.make","Depot.alias","Depot.add","Depot.badge","Depot.count","Exchange.choose"];
			if(asyncRoot)
			{
				await copy(join(fx,"php-task-resources/AsyncExchange.lean"),"AsyncExchange.lean");
				modules.push("AsyncExchange");
				exports.push(...["checked","closes","pending","release","reset","state","tickets"].map(n=>"Depot."+n),"AsyncExchange.revisit");
			}
		}
		else if(foreign)
		{
			await copy(join(fx,"php-io-resources/ForeignPeer.lean"),"ForeignPeer.lean");
			exports = ["ForeignPeer.issue","ForeignPeer.aliasTicket","ForeignPeer.aliasBadge","ForeignPeer.label"];
		}
		else
		{
			await copy(join(fx,"jvm-sync-resources/Counter.lean"),"Counter.lean");
			exports = ["Counter.issue","Counter.bump","Counter.readBadge"];
		}
		await save("lakefile.toml",'name="'+mod.toLowerCase()+'"\nversion="1.0.0"\n'+["Shared",...modules].map(n => '[[lean_lib]]\nname="'+n+'"\n').join(""));
		const cfg = { schemaVersion: 1, modules, exports, resources: ["Shared.Badge","Shared.Ticket"], nativeEffects: ["filesystem"], targets: { "php-native": { name, version: "1.0.0" } } };
		if(asyncRoot) Object.assign(cfg,{taskExports: ["AsyncExchange.revisit","Depot.pending","Depot.checked"],taskIOErrors: ["AsyncExchange.revisit"],asyncIterators: [{open: "Depot.tickets",next: "Depot.next",close: "Depot.close"}]});
		if(route === "reviewed")
		{
			delete cfg.exports; await copy(resolve(root,"ordinary/handoff/binding-ir.json"),"public.binding-ir.json");
		}
		await save("lean-bridge.exports.json",canonicalJson(cfg));
		await buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: ["php-native"], environment: env })
			.catch(e => { throw new Error(e.message+"\n"+JSON.stringify(e.details),{ cause: e }); });
		const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(out,"package-set-receipt.json") });
		assert.equal(receipt.profiles[0].id,asyncRoot ? "native-php-task-v1" : "native-php-io-v1");
		const pin = await load(join(out,"packages/php-native/composer/lean-bridge/package-receipt.json"));
		assert.equal(pin.ledger.library,"liblb_task_resources_"+pin.ledger.id+".so"); assert.equal(pin.ledger.sha256,pin.libraries[pin.ledger.library]);
		if(route === "reviewed") assert.deepEqual(await load(join(out,"binding-ir.json")),await load(join(src,"public.binding-ir.json")));
		t.diagnostic(route+": "+receipt.packages[0].artifacts[0].sha256);
	}}
);
