/** @file Read the original hosted owned-record evidence by its selected revision and digest. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {readFile} from "node:fs/promises";
import {dirname,join} from "node:path";
import {promisify} from "node:util";
import {sha256} from "../../src/capsule/node.mjs";

const exec=promisify(execFile);
const replayFile="docs/evidence/owned-checked-record-aligned-matrix-replay-20261026.json";
/**
 * Read one selected lane without unpacking its entire hosted job.
 *
 * @param lane - Name in the original eleven-lane archive selection.
 */
export async function selectedTicketArchive(lane)
{
	const replay=JSON.parse(await readFile(replayFile)),revision=replay.replay.revision;
	const git=async path=>(await exec("git",["cat-file","blob",revision+":"+path],{encoding: "buffer",maxBuffer: 32<<20})).stdout;
	const checked=async(path,expected)=>{
		const bytes=await git(path);assert.equal(sha256(bytes),expected,path);return bytes;
	};
	const selection=JSON.parse(await checked(replay.selection.path,replay.selection.sha256));
	const entry=selection.archives.find(row=>row.lane===lane),capture=replay.replay.captures.find(row=>row.lane===lane);
	assert.deepEqual(entry.index,capture.index);
	const index=JSON.parse(await checked(entry.index.path,entry.index.sha256));assert.equal(index.lane,lane);
	const base=dirname(entry.index.path),files=new Map(index.files.map(f=>[f.path,f]));
	assert.equal(files.size,index.files.length);
	const read=async path=>{
		const f=files.get(path);assert.ok(f,path);
		const raw=await checked(join(base,path),f.sha256);assert.equal(raw.length,f.bytes);return raw;
	};
	return {revision,index,read,files};
}
