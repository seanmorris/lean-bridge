/** @file Run vanilla, mounted React, and a dedicated worker in their actual browser contexts. */
/* global Worker */
import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {closeTaskRuntime} from "@lean-bridge/runtime";
import {exerciseObjects} from "./object-app.mjs";

/** Resolve only after React has committed the result computed by its mounted component. */
export const exercisePage=async()=>{
	globalThis.objectPositionPhase="page call";
	const page=await exerciseObjects();
	const view=globalThis.document.querySelector("#component"),root=createRoot(view),commit=Promise.withResolvers();
	const App=()=>{
		const [observed,setObserved]=useState(null);
		useEffect(()=>{exerciseObjects().then(setObserved,commit.reject);},[]);
		useEffect(()=>{if(observed) commit.resolve(observed);},[observed]);
		return React.createElement("output",null,observed?observed.levels.join(":"):"running");
	};
	let react,text;
	try
	{
		globalThis.objectPositionPhase="mounted React call";
		flushSync(()=>root.render(React.createElement(App)));
		react=await commit.promise;text=view.querySelector("output").textContent;
	} finally
	{flushSync(()=>root.unmount());}
	globalThis.objectPositionPhase="page shutdown";
	await closeTaskRuntime();
	const job=new Worker(new URL("./object-worker.mjs",import.meta.url),{type: "module"});
	try
	{
		const worker=await new Promise((ok,bad)=>{
			globalThis.objectPositionPhase="worker startup";
			job.onmessage=({data})=>{
				if(data.ready)
				{globalThis.objectPositionPhase="worker call";job.postMessage("run");}
				else if(data.error) bad(new Error(data.error));
				else ok(data.value);
			};
			job.onerror=e=>bad(new Error(e.message));
		});
		return {page,react,text,worker};
	} finally
	{job.terminate();}
};
