import {exercise} from "./calls.mjs";

const api = await import("@example/tariff-quotes");
const result = exercise(false);
const fallback = api.makeTariff(100).quote;
let seen = 0;
try {
    const typedValue = api.visitApplicationQuote(n => { ++seen; return n + 900; }, (fn, n) => {
        const forwarded = api.passApplicationQuote(fn);
        try { return api.stagedQuote(api.withRecovery(() => forwarded, fallback), 0, n); }
        finally { forwarded.dispose(); }
    }, 3);
    if (seen !== 1 || typedValue !== 903) throw Error("typed callback did not return the host price");
    console.log(JSON.stringify({...result, typedValue}));
} finally { fallback.dispose(); }
