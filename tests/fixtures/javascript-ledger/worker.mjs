/** @file Exercise an independent Ledger instance in a dedicated module worker. */
import * as api from "@example/ledger-io";
import {exercise} from "./calls.mjs";

globalThis.onmessage = () => {
	try
	{ globalThis.postMessage({result: exercise(api)}); }
	catch(error)
	{ globalThis.postMessage({error: String(error.stack ?? error)}); }
};
globalThis.postMessage({ready: true});
