/**
 * Complete bounded compiler diagnostics, including expected nonzero exits.
 *
 * @file
 */
import { spawn } from "node:child_process";

/**
 * Retain full structured diagnostics instead of a truncated display tail.
 *
 * @param command - Absolute compiler driver.
 * @param args - Compiler arguments.
 * @param cwd - Isolated consumer project.
 * @param env - Restricted compiler environment.
 */
export const captureCorpusCompiler = (command, args, cwd, env) => new Promise((accept, reject) => {
	const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
	const stdout = [], stderr = [];
	let size = 0, failure;
	const stop = reason => { failure ??= new Error(reason); child.kill("SIGKILL"); };
	const timer = setTimeout(() => stop("Corpus compiler check exceeded 180 seconds"), 180_000);
	const collect = output => bytes => {
		size += bytes.length;
		if(size > 8 * 1024 ** 2) stop("Corpus compiler diagnostics exceeded 8 MiB");
		else output.push(bytes);
	};
	child.stdout.on("data", collect(stdout));
	child.stderr.on("data", collect(stderr));
	child.once("error", error => { clearTimeout(timer); reject(error); });
	child.once("close", code => {
		clearTimeout(timer);
		if(failure) reject(failure);
		else accept({ code, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") });
	});
});
