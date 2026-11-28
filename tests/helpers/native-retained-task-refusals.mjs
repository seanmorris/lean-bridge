/**
 * Compile negative cases against a real native task projection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";

/**
 * Refuse unsupported carriers, spurious terminal errors and unselected callbacks.
 *
 * @param root - Empty compiler scratch directory.
 * @param host - Selected native consumer language.
 */
export const verifyNativeTaskRefusals = async (root, host) => {
	const source = `namespace Bad
def reply (_ : UInt32 → IO (Array UInt32)) : Task UInt32 := Task.pure 0
def wrong : Task (Except String Nat) := Task.pure (.ok 1)
def retained (_ : Nat → IO Nat) : Task Nat := Task.pure 1
end Bad`;
	const invalid = [["Bad.reply", host, /must be copied scalars/u]
		, ["Bad.wrong", host, /taskIOErrors requires Task/u]
		, ["Bad.retained", undefined, /unsupported .*carrier/u]];
	for(const [name, target, pattern] of invalid)
	{
		const compile = compileHostSources({ app: await mkdtemp(join(root, "source-"))
			, ir: null, target
			, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
			, environment: { ...process.env, LEAN_NUM_THREADS: "1" }
			, sources: [{ module: "Bad", source }]
			, projectContract: { modules: ["Bad"], exports: [name], taskExports: [name], ...name === "Bad.wrong" ? { taskIOErrors: [name] } : {} }
			, run: (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env }) });
		await assert.rejects(compile, e => {
			assert.match([e.message, e.details?.stdout, e.details?.stderr].join("\n"), pattern); return true;
		});
	}
};
