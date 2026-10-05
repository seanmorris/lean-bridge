/**
 * Parsed PHP mutants must fail executed ownership semantics, not syntax checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Reuse freshly compiled Lean while changing one generated host lifetime rule.
 *
 * @param compiled - Actual compiled PHP projection and its task-owned directory.
 * @param probe - Unmodified public consumer assertions.
 */
export const rejectOwnedPhpBorrowMutants = async (compiled, probe) => {
	const mutations = [
		["last-root", "src/Internal/OwnedRuntime.php"
			, "if (--$this->roots === 0) $this->invalidate();"
			, "--$this->roots;", /transitive owner expiration/u]
		, ["share-is-independent", "src/Api.php"
			, "return new self($lease, $type, $payload, $retain);"
			, "return $this->retain();", /shared root keeps anchor open/u]
		, ["retain-is-shared", "src/Api.php"
			, "return $retain($payload);", "return $this->share();"
			, /Resource is closed/u]
		, ["wrapper-identity", "src/Internal/OwnedRuntime.php"
			, "return ($this->equalCall)($this, $other);"
			, "return $this === $other;", /canonical identity across distinct views/u]
		, ["callback-never-expires", "src/Internal/OwnedRuntime.php"
			, "if (isset($this->scope)) $this->scope->active = false;"
			, "/* broken: callback scope remains active */"
			, /Owned PHP calls: Invalid argument/u]
	];
	const observations = [];
	for(const [name, path, before, after, semanticFailure] of mutations)
	{
		const original = compiled.model.files[path];
		assert.equal(original.split(before).length, 2, name);
		const changed = original.replace(before, after);
		try
		{
			await saveLakeFile(compiled.directory, path, changed);
			await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", ["-n", "-l", path], compiled.directory);
			await assert.rejects(compiled.execute(probe), error => {
				assert.match(error.details?.stderr ?? "", semanticFailure, name);
				assert.doesNotMatch(error.details?.stderr ?? "", /Parse error|syntax error|Segmentation fault/u);
				return true;
			});
			observations.push({ name, path, sourceSha256: sha256(changed), parsed: true, semanticRejection: true });
		}
		finally
		{ await saveLakeFile(compiled.directory, path, original); }
	}
	return observations;
};
