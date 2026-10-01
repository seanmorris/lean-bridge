/**
 * Executed PHP and Zend mutations must break the original public assertions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Parse PHP or compile the complete extension before checking semantic failure.
 *
 * @param options - Exact original files and the real VM execution commands.
 * @param options.directory - Temporary generated source tree.
 * @param options.files - Unmodified source bytes for each mutant.
 * @param options.run - Checked compiler and VM process execution.
 * @param options.compile - Recompile and link the complete Zend extension.
 */
export const rejectOwnedPhpWasmBorrowMutants = async ({ directory, files, run, compile }) => {
	const mutations = [
		["share-is-independent", "src/Api.php"
			, "return new self(Internal\\Native::owner('share', $type, $owner), $type, $payload, $retain);"
			, "return $this->retain();", /shared root keeps descendants alive/u]
		, ["retain-is-shared", "src/Api.php"
			, "return $retain($payload);", "return $this->share();"
			, /Compiled Lean ownership call failed/u]
		, ["wrapper-identity", "src/Internal/Native.php"
			, "Native::sameIdentity($this->type, $this->resource, $other->resource)"
			, "$this->resource === $other->resource"
			, /canonical resource equality/u]
		, ["last-root", "extension.c", "if (!--lease->roots) lease->invalid = 1;"
			, "--lease->roots;", /transitive expiry/u]
		, ["empty-root", "extension.c", "if (!--lease->roots) lease->invalid = 1;"
			, "if (!--lease->roots && lease->owner.batch.entries) lease->invalid = 1;"
			, /empty descendants expire/u]
		, ["unpublished-owner", "src/Internal/Native.php"
			, "if ($unpublishedOwner !== null) self::owner('close', $fn['result'], $unpublishedOwner);"
			, "/* broken: rely on exception-held resource destruction */"
			, /native cleanup/u]
	];
	const observations = [];
	for(const [name, path, before, after, failure] of mutations)
	{
		const original = files[path];
		assert.equal(original.split(before).length, 2, name);
		const changed = original.replace(before, after);
		try
		{
			await saveLakeFile(directory, path, changed);
			if(path.endsWith(".php")) await run(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", ["-n", "-l", path]);
			else await compile();
			await assert.rejects(() => run(process.execPath, ["host.mjs"]), error => {
				assert.match(error.message, failure, name);
				assert.doesNotMatch(error.message, /Parse error|syntax error|Segmentation fault|memory access out of bounds/u);
				return true;
			});
			observations.push({ name, path, sourceSha256: sha256(changed), parsed: true, semanticRejection: true });
		}
		finally
		{
			await saveLakeFile(directory, path, original);
			if(!path.endsWith(".php")) await compile();
		}
	}
	return observations;
};
