/** @file The dedicated Node worker and its Lean pthread pool own a separate heap. */
import {once} from "node:events";
import {Worker,isMainThread,parentPort} from "node:worker_threads";
import {exercise} from "./calls.mjs";
import {closeTaskRuntime,taskRuntimeStats} from "@lean-bridge/runtime";

if(isMainThread)
{
	const child=new Worker(new URL(import.meta.url));
	try
	{
		const [report]=await once(child,"message");
		if(taskRuntimeStats().state!=="open") throw new Error("Worker shutdown affected the parent heap");
		console.log(JSON.stringify(report));
	} finally
	{await child.terminate();await closeTaskRuntime();}
} else parentPort.postMessage(await exercise());
