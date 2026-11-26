import {run,close} from "./public.mjs";
try { const result=await run(); await close(); self.postMessage(result); }
catch (e) { self.postMessage({error:String(e?.stack ?? e)}); }
