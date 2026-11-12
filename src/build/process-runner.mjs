/**
 * Implements the process runner module in the build subsystem.
 *
 * @file
 */

import { spawn } from "node:child_process";

import { CanonicalBuildError } from "./build-error.mjs";

const outputPolicies = new Set(["fail", "bounded-tail"]);
const defaultMaximumOutputBytes = 32 * 1024 * 1024;

const capture = ({
	command, args, cwd, env = process.env, timeoutMs = 30 * 60 * 1000
	, signal = undefined, outputPolicy = "fail"
	, maximumOutputBytes = defaultMaximumOutputBytes
}) => new Promise((accept, reject) => {
	if(!outputPolicies.has(outputPolicy))
	{
		reject(new CanonicalBuildError("invalid-build-runner-output-policy"
			, `Unsupported build output policy: ${outputPolicy}`));
		return;
	}
	if(!Number.isSafeInteger(maximumOutputBytes) || maximumOutputBytes <= 0)
	{
		reject(new CanonicalBuildError("invalid-build-runner-output-limit"
			, "The build output limit must be a positive safe integer"));
		return;
	}
	if(signal?.aborted)
	{
		reject(new CanonicalBuildError("build-cancelled", signal.reason?.message ?? "Build cancelled before process start"));
		return;
	}
	const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
	const output = () => ({ chunks: [], retained: 0, observed: 0 });
	const stdout = output();
	const stderr = output();
	let bytes = 0;
	let settled = false;
	let cancellation = null, cancellationTimer;
	const cleanup = () => {
		clearTimeout(timer);
		clearTimeout(cancellationTimer);
		signal?.removeEventListener("abort", abort);
	};
	const rejectOnce = error => {
		if(settled) return;
		settled = true;
		cleanup();
		reject(error);
	};
	const acceptOnce = value => {
		if(settled) return;
		settled = true;
		cleanup();
		accept(value);
	};
	const collect = target => chunk => {
		bytes += chunk.length;
		target.observed += chunk.length;
		if(outputPolicy === "fail" && bytes > maximumOutputBytes)
		{
			child.kill("SIGKILL");
			rejectOnce(new CanonicalBuildError("build-output-limit"
				, `${command} exceeded the ${maximumOutputBytes}-byte diagnostic limit`));
			return;
		}
		target.chunks.push(chunk);
		target.retained += chunk.length;
		if(outputPolicy === "bounded-tail")
		{
			while(target.retained > maximumOutputBytes)
			{
				const overflow = target.retained - maximumOutputBytes;
				const first = target.chunks[0];
				if(first.length <= overflow)
				{
					target.chunks.shift();
					target.retained -= first.length;
				}
				else
				{
					target.chunks[0] = first.subarray(overflow);
					target.retained -= overflow;
				}
			}
		}
	};
	child.stdout.on("data", collect(stdout));
	child.stderr.on("data", collect(stderr));
	const timer = setTimeout(() => {
    child.kill("SIGKILL");
    rejectOnce(new CanonicalBuildError("build-timeout", `${command} exceeded its execution deadline`));
	}, timeoutMs);
	const abort = () => {
		cancellation = new CanonicalBuildError("build-cancelled", signal.reason?.message ?? `Build cancelled while running ${command}`);
		child.kill("SIGTERM");
		// Wait for exit before callers dispose workspaces the child may still use.
		cancellationTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
	};
	signal?.addEventListener("abort", abort, { once: true });
	if(signal?.aborted) abort();
	child.once("error", error => {
    rejectOnce(error);
	});
	child.once("close", (code, terminationSignal) => {
		if(cancellation)
		{ rejectOnce(cancellation); return; }
    const result = {
      code
      , stdout: Buffer.concat(stdout.chunks).toString("utf8")
      , stderr: Buffer.concat(stderr.chunks).toString("utf8")
    };
    if(code === 0) acceptOnce(result);
		else
		{
			const reason = terminationSignal
				? `terminated by signal ${terminationSignal}`
				: `exited with status ${code}`;
			rejectOnce(new CanonicalBuildError("build-command-failed", `${command} ${reason}`, {
				details: { command, args, exitCode: code, signal: terminationSignal
					, stderr: result.stderr.slice(-8000), stdout: result.stdout.slice(-8000)
					, outputPolicy, stdoutBytes: stdout.observed
					, stderrBytes: stderr.observed
					, stdoutTruncated: stdout.observed > stdout.retained
					, stderrTruncated: stderr.observed > stderr.retained }
			}));
		}
	});
});

export const processBuildRunner = Object.freeze({ capture });
