/**
 * Execute shared cases inside a dedicated worker, not the host page.
 *
 * @file
 */
import { executeCorpus } from "./javascript.mjs";
import { loadApi } from "./package.mjs";

self.onmessage = async ({ data: { request, id } }) => {
	try
	{
		if(typeof document !== "undefined" || !(self instanceof DedicatedWorkerGlobalScope)) throw new Error("Wrong execution realm");
		const api = await loadApi();
		self.postMessage({ id
			, result: { schemaVersion: 1, profile: request.profile
				, module: request.module, realm: "dedicated-worker"
				, results: executeCorpus(request, api) } });
	}
	catch(error)
	{ self.postMessage({ id, error: error.message }); }
};
