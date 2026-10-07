/**
 * Installed ordinary/reviewed scalar and structural Fin npm boundary acceptance.
 *
 * @file
 */
import { dirname, basename, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { checkReviewedFinWasm } from "./reviewed-fin-wasm-install.mjs";
import { reviewedFinWasmSelections } from "./reviewed-fin-wasm-fixture.mjs";
import "./reviewed-fin-wasm-contract-tests.mjs";
import "./reviewed-fin-wasm-evidence-tests.mjs";
import "./reviewed-fin-promotion-tests.mjs";

const browsers = process.env.LEAN_BRIDGE_REVIEWED_FIN_WASM_BROWSER_TEST === "1";
const enabled = process.env.LEAN_BRIDGE_REVIEWED_FIN_WASM_TEST === "1" || browsers;
for(const selection of reviewedFinWasmSelections) for(const reviewed of [false, true])
	test(`${reviewed ? "independently reviewed" : "ordinary"} ${selection} Fin runs in source-free installed npm packages`, { skip: !enabled, timeout: 1_800_000 }, async t => {
		const report = await checkReviewedFinWasm(t, selection, reviewed, { browsers }).catch(error => {
			// Node's test reporter omits custom Error fields. Preserve subprocess diagnostics
			// before the disposable source-free consumer is cleaned up.
			if(error.details) t.diagnostic(JSON.stringify(error.details));
			throw error;
		});
		const path = resolve(process.env.LEAN_BRIDGE_REVIEWED_FIN_WASM_REPORT_DIR ?? "build/reviewed-fin-wasm", `${reviewed ? "reviewed" : "ordinary"}-${selection}.json`);
		await saveLakeFile(dirname(path), basename(path), canonicalJson(report));
	});
