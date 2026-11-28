import {run,close} from "./public.mjs";
try { console.log(JSON.stringify(await run())); }
finally { await close(); }
