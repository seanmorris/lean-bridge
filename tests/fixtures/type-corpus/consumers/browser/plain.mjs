/**
 * Framework-free browser calls through the installed npm package.
 *
 * @file
 */
import { executeCorpus } from "./javascript.mjs";
import { loadApi, request } from "./package.mjs";

const output = document.querySelector("#result");
let runs = 0;
const run = async () => {
	output.dataset.status = "loading";
	try
	{
		const api = await loadApi();
		globalThis.corpusResult = { schemaVersion: 1, profile: request.profile
			, module: request.module, realm: "window"
			, results: executeCorpus(request, api) };
		output.textContent = String(++runs);
		output.dataset.status = "ready";
	}
	catch(error)
	{ output.textContent = error.message; output.dataset.status = "error"; }
};
document.querySelector("#rerun").addEventListener("click", run);
void run();
