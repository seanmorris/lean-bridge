/**
 * Keep the focused reviewed-Fin producer bounded and independently runnable.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const path = ".github/workflows/reviewed-fin-wasm-entry.yml";

test("reviewed Fin workflow shares one build across both retained modes"
	, async () => {
		const source = await readFile(path, "utf8");
		assert.match(source, /^ {2}workflow_dispatch:\s*$/mu);
		assert.match(source, /^ {2}push:\s*$/mu);
		assert.match(source, /^ {4}branches:\s*$/mu);
		assert.match(source, /^ {6}- codex\/vo2166-fin-completion$/mu);
		assert.match(source, /^ {4}paths:\s*$/mu);
		assert.doesNotMatch(source, /^ {2}(?:pull_request|schedule):/mu);
		assert.match(source, /^ {4}name: Reviewed Fin Wasm entries$/mu);
		assert.equal(source.match(/nix build \.#universal-core-artifacts/gmu)?.length
			, 1);
		assert.equal(source.match(/nix build \.#component-build-engine/gmu)?.length
			, 1);
		assert.equal(source.match(/^ {8}continue-on-error: true$/gmu)?.length
			, 2);
		for(const mode of ["original", "probe"])
		{
			assert.match(source, new RegExp(
				`--test-name-pattern='\\^${mode} `, "u"));
			assert.match(source, new RegExp(
				`reviewed-fin-wasm-entry-${mode}-\\$\\{\\{ github\\.sha \\}\\}-\\$\\{\\{ github\\.run_attempt \\}\\}`
				, "u"));
		}
		assert.match(source, /steps\.original\.outcome != 'success'/u);
		assert.match(source, /steps\.probe\.outcome != 'success'/u);
		assert.match(source, /^ {12}!\/docs\/\*$/mu);
		assert.match(source, /^ {12}\/docs\/consumer-support\.v1\.json$/mu);
	}
);
