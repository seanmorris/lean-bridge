/**
 * Independent, checksum-verified Composer test repositories for Amp and Revolt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { composerFileUrl } from "./brick-math.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

/** Pinned upstream archives used by offline task consumers. */
export const schedulerPackages=[
	["amphp/amp","v3.1.3","6b9051b59037d5a763a43bed0c44571671ce8dc8d45be4cd256c9afa1fe3cd51"]
	, ["revolt/event-loop","v1.1.0","a316f5d942d896aeae5826db5331738585fe4d8ebb603cbefc01ae4f6e18e4cf"]
];
const env=process.env;
/**
 * Admit only the exact upstream distributions, then use the metadata inside each ZIP.
 *
 * @param cache - Offline Composer cache containing the two upstream releases.
 */
export const schedulerRepositories=async cache=>{
	const repos=[];
	for(const [name,version,hash] of schedulerPackages)
	{
		const dir=join(cache,"files",name);
		let archive, bytes;
		for(const f of (await readdir(dir)).filter(f=>f.endsWith(".zip")))
		{
			const b=await readFile(join(dir,f));
			if(sha256(b)===hash)
			{archive=join(dir,f);bytes=b;break;}
		}
		assert.ok(archive,"Missing exact "+name+" "+version+" upstream ZIP in "+dir);
		const paths=(await run("unzip",["-Z1",archive],dir,env)).trim().split("\n").filter(p=>/^[^/]+\/composer\.json$/u.test(p));
		assert.equal(paths.length,1);
		const meta=JSON.parse(await run("unzip",["-p",archive,paths[0]],dir,env));
		assert.equal(meta.name,name);
		repos.push({type: "package",package: {...meta,version,dist: {type: "zip",url: composerFileUrl(archive),shasum: createHash("sha1").update(bytes).digest("hex")}}});
	}
	return repos;
};
