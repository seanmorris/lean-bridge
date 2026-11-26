/** @file Exercise the synchronous API in a mounted React event handler. */
import React, {useState} from "react";
import {flushSync} from "react-dom";
import {createRoot} from "react-dom/client";
import * as api from "@example/ledger-io";
import {exercise} from "./calls.mjs";

const runWorker = () => new Promise((resolve, reject) => {
	const worker = new Worker(new URL("./worker.mjs", import.meta.url), {type: "module"});
	worker.onmessage = ({data}) => {
		if(data.ready)
		{ worker.postMessage("start"); return; }
		worker.terminate();
		if(data.error) reject(new Error(data.error));
		else resolve(data.result);
	};
	worker.onerror = error => { worker.terminate(); reject(new Error(error.message)); };
});

/** Run the click first, then ask a fresh worker to run the same cases on its own heap. */
export const runUI = async () => {
	const view = globalThis.document.querySelector("#ledger"), root = createRoot(view);
	let report, failure;
	const App = () => {
		const [total, setTotal] = useState(null);
		const click = () => {
			try
			{ report = exercise(api); setTotal(report.counter); }
			catch(error)
			{ failure = error; }
		};
		return React.createElement("button", {onClick: click}, total === null ? "Run" : "Total: " + total);
	};
	try
	{
		flushSync(() => root.render(React.createElement(App)));
		const button = view.querySelector("button");
		flushSync(() => button.click());
		if(failure) throw failure;
		const text = button.textContent, worker = await runWorker();
		return {react: report, text, worker, parentAfterWorker: api.add(1)};
	}
	finally
	{ flushSync(() => root.unmount()); }
};
