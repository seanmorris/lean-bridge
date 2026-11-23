/** @file A dedicated module worker owns the application and its own Lean pthreads. */
import {exercise} from "./calls.mjs";

globalThis.onmessage=async () => {
	try
	{
		globalThis.postMessage({last: "worker received start command"});
		const value=await exercise(last => globalThis.postMessage({last}));
		globalThis.postMessage({value});
	} catch(error)
	{
		globalThis.postMessage({error: String(error.stack ?? error)});
	}
};
// A page can post its first message while this module is still awaiting its
// static package imports. Advertise readiness only after installing the handler.
globalThis.postMessage({ready: true});
