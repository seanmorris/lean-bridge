/**
 * Bundled public PHP-Wasm descriptor in an actual browser.
 *
 * @file
 */
import { PhpWeb } from "./node_modules/php-wasm/PhpWeb.mjs";
import { api } from "./bundled/consumer.mjs";
import { executePhpWasmCorpus } from "./driver.mjs";

const query = new URL(globalThis.location.href).searchParams;
const loading = query.get("loading"), mode = query.get("mode");
try
{
	globalThis.phpCorpus = await executePhpWasmCorpus({
		Php: PhpWeb, api, loading, mode
		, request: await (await fetch("./request-embedded.json")).text()
		, source: await (await fetch("./" + mode + ".php")).text() });
}
catch(error)
{
	globalThis.phpCorpus = { error: error.stack };
}
