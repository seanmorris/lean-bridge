import { runNativeConsumer } from "./app.mjs";

try
{
	const started = performance.now();
	const result = await runNativeConsumer();
	postMessage({ ok: true, result, elapsedMs: performance.now() - started });
} catch(error)
{
	postMessage({ ok: false, error: String(error?.stack ?? error) });
}
