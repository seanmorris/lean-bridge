/**
 * Worker request, rerun and teardown UI for the installed corpus.
 *
 * @file
 */
import { request } from "./package.mjs";

const output = document.querySelector("#result");
let worker, sequence = 0;
const stop = () => {
	worker?.terminate(); worker = undefined; sequence++;
	output.dataset.status = "stopped";
};
const run = () => {
	const id = ++sequence;
	output.dataset.status = "loading";
	if(!worker)
	{
		worker = new Worker(new URL("./worker.mjs", import.meta.url), { type: "module" });
		worker.onerror = event => { output.textContent = event.message; output.dataset.status = "error"; };
	}
	worker.onmessage = ({ data }) => {
		if(data.id !== sequence) return;
		if(data.error)
		{ output.textContent = data.error; output.dataset.status = "error"; return; }
		globalThis.corpusResult = data.result;
		output.textContent = String(data.id);
		output.dataset.status = "ready";
	};
	worker.postMessage({ request, id });
};
document.querySelector("#stop").addEventListener("click", stop);
document.querySelector("#rerun").addEventListener("click", run);
addEventListener("pagehide", stop);
run();
