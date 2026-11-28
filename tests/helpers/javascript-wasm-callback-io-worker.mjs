/** @file Verify that retiring a worker's installed Lean runtime leaves its parent usable. */
import assert from "node:assert/strict";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { exercise } from "./calls.mjs";

if(isMainThread)
{
	const options = JSON.parse(process.argv[2]);
	const io = await import(options.ioName), owned = await import(options.ownedName);
	const ticket = owned.newTicket(31n, "parent");
	assert.equal(io.add(20), 20);
	const worker = new Worker(new URL(import.meta.url), {workerData: options});
	let result;
	await new Promise((resolve, reject) => {
		worker.on("message", report => { result = report; });
		worker.once("error", reject);
		worker.once("exit", code => code === 0 ? resolve() : reject(new Error("Worker exited with status " + code)));
	});
	assert.equal(result.finishesAfterTrap, 0);
	assert.equal(owned.serial(ticket), 31n);
	assert.equal(io.add(1), 21);
	assert.ok(ticket.dispose() && owned.close());
	console.log(JSON.stringify({worker: result, parentCounter: io.read_total()}));
}
else parentPort.postMessage(await exercise(workerData));
