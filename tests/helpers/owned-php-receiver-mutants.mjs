/**
 * Executed negative controls for nominal PHP receiver ownership.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Every mutation must parse, fail a consumer assertion, and restore its source.
 *
 * @param compiled - Fresh compiled Lean and its generated PHP files.
 * @param probe - Public calls and independent ownership assertions.
 */
export const rejectOwnedPhpReceiverMutants = async (compiled, probe) => {
	const choose = compiled.model.functions.find(fn => fn.name === "chooseTicket");
	const parameter = choose.publicParameters[1];
	const mutations = [
		["last-root", "src/Internal/OwnedRuntime.php"
			, "if (--$this->roots === 0) $this->invalidate();", "--$this->roots;"
			, /member follows the original anchor/u]
		, ["share-is-independent", "src/Api.php"
			, "return new static($lease, $type, $payload, $retain);"
			, "return $this->retain();"
			, /member share preserves the original anchor/u]
		, ["retain-is-shared", "src/Api.php"
			, "return $retain($payload);", "return $this->share();"
			, /Resource is closed/u]
		, ["wrapper-identity", "src/Internal/OwnedRuntime.php"
			, "return ($this->equalCall)($this, $other);", "return $this === $other;"
			, /member preserves a nonreceiver anchor/u]
		, ["callback-never-expires", "src/Internal/OwnedRuntime.php"
			, "if (isset($this->scope)) $this->scope->active = false;"
			, "/* broken: scope remains active */"
			, /Owned PHP calls: Invalid argument/u]
		, ["receiver-anchor-is-copy", "src/Api.php"
			, "return retain_ticket($this);", "return retain_ticket(copy_value($this));"
			, /Resource is closed/u]
		, ["parameter-anchor-is-receiver", "src/Api.php"
			, `return choose_ticket($this->get(), $${parameter});`
			, "return choose_ticket($this->get(), $this);"
			, /nonreceiver anchor survives receiver close/u]
		, ["consume-copied-receiver", "src/Api.php"
			, "return transfer_ticket($this);"
			, "return transfer_ticket($this->retain());"
			, /member consumes the original receiver/u]
		, ["erase-nominal-owner", "src/Internal/Values.php"
			, `\\${compiled.model.namespace}\\TicketValue::class`
			, `\\${compiled.model.namespace}\\Value::class`
			, /Return value must be of type .*TicketValue/u]
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
