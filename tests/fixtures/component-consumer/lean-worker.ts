/**
 * Execute the same installed component in a separate JavaScript realm.
 *
 * @file
 */

import { calculate, loadLean } from "./lean";
import type { Inputs } from "./lean";

self.addEventListener("message", async (event: MessageEvent<Inputs>) => {
	try
	{
		const api = await loadLean();
		self.postMessage({ ok: true, result: calculate(api, event.data) });
	}
	catch(error)
	{ self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
});
