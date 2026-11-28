/** @file The Node application's heap remains usable after its independent module worker closes. */
import {once} from "node:events";
import {isMainThread,parentPort,Worker} from "node:worker_threads";
import {closeTaskRuntime,taskRuntimeStats} from "@lean-bridge/runtime";
import {make,read} from "@example/lean-depot";
import {exercise} from "./calls.mjs";

if(isMainThread)
{
	const ticket=make(31), worker=new Worker(new URL(import.meta.url));
	try
	{
		const [report]=await once(worker,"message");
		if(read(ticket)!==31 || taskRuntimeStats().nativeOwners!==1 || !ticket.dispose()) throw new Error("Worker changed parent ownership");
		console.log(JSON.stringify(report));
	} finally
	{ await worker.terminate(); await closeTaskRuntime(); }
} else parentPort.postMessage(await exercise());
