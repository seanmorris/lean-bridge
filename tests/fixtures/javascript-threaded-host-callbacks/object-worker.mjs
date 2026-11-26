/** @file Execute the installed package in the dedicated worker's own heap. */
import {closeTaskRuntime} from "@lean-bridge/runtime";
import {exerciseObjects} from "./object-app.mjs";
globalThis.onmessage=async()=>{
	try
	{
		const value=await exerciseObjects();await closeTaskRuntime();globalThis.postMessage({value});
	} catch(error)
	{globalThis.postMessage({error: String(error)});}
};
globalThis.postMessage({ready: true});
