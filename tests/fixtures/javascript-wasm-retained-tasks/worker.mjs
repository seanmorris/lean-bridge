/** @file A Node module worker owns its callbacks and its own Wasm runtime. */
import {once} from "node:events";
import {isMainThread,parentPort,Worker} from "node:worker_threads";
import {closeTaskRuntime,taskRuntimeStats} from "@lean-bridge/runtime";
import {worker as relay} from "@example/lean-relay";
import {exercise} from "./calls.mjs";

if(isMainThread)
{
	const child=new Worker(new URL(import.meta.url));
	try
	{
		const [report]=await once(child,"message");
		if(await relay(1,n => n+1)!==2 || taskRuntimeStats().nativeOwners!==0) throw new Error("Worker closed the parent's callbacks");
		console.log(JSON.stringify(report));
	} finally
	{ await child.terminate(); await closeTaskRuntime(); }
} else parentPort.postMessage(await exercise());
