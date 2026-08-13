import { spawn } from "node:child_process";

import { CanonicalBuildError } from "./build-error.mjs";

const capture = ({ command, args, cwd, env = process.env, timeoutMs = 30 * 60 * 1000, signal = undefined }) => new Promise((accept, reject) => {
	if(signal?.aborted)
	{
		reject(new CanonicalBuildError("build-cancelled", signal.reason?.message ?? "Build cancelled before process start"));
		return;
	}
	const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
	const stdout = [];
	const stderr = [];
	let bytes = 0;
	let settled = false;
	const maximum = 32 * 1024 * 1024;
	const cleanup = () => {
		clearTimeout(timer);
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
		if(bytes > maximum)
		{
			child.kill("SIGKILL");
			rejectOnce(new CanonicalBuildError("build-output-limit", `${command} exceeded the 32 MiB diagnostic limit`));
			return;
		}
		target.push(chunk);
	};
	child.stdout.on("data", collect(stdout));
	child.stderr.on("data", collect(stderr));
	const timer = setTimeout(() => {
    child.kill("SIGKILL");
    rejectOnce(new CanonicalBuildError("build-timeout", `${command} exceeded its execution deadline`));
	}, timeoutMs);
	const abort = () => {
		child.kill("SIGTERM");
		rejectOnce(new CanonicalBuildError("build-cancelled", signal.reason?.message ?? `Build cancelled while running ${command}`));
	};
	signal?.addEventListener("abort", abort, { once: true });
	if(signal?.aborted) abort();
	child.once("error", error => {
    rejectOnce(error);
	});
	child.once("close", code => {
    const result = {
      code
      , stdout: Buffer.concat(stdout).toString("utf8")
      , stderr: Buffer.concat(stderr).toString("utf8")
    };
    if(code === 0) acceptOnce(result);
    else rejectOnce(new CanonicalBuildError("build-command-failed", `${command} exited with status ${code}`, {
      details: { command, args, stderr: result.stderr.slice(-8000), stdout: result.stdout.slice(-8000) }
    }));
	});
});

export const processBuildRunner = Object.freeze({ capture });
