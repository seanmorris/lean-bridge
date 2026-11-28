/** @file Race real retained registrations against cancellation without a clock or a mock. */
const equal = (actual, expected, message) => {
	if(actual !== expected) throw new Error(message + ": expected " + expected + ", got " + actual);
};

const counts = stats => {
	const {frames, allocations, pending, notifications, nativeOwners} = stats();
	return [frames, allocations, pending, notifications, nativeOwners];
};

const race = async (api, stats, idle, rejectOld) => {
	const first = Promise.withResolvers(), second = Promise.withResolvers();
	const enteredFirst = Promise.withResolvers(), enteredSecond = Promise.withResolvers();
	const calls = [];
	const handler = n => {
		calls.push(n);
		if(n === 1) { enteredFirst.resolve(); return first.promise; }
		if(n === 2) { enteredSecond.resolve(); return second.promise; }
		throw new Error("unexpected callback input");
	};
	let successes = 0, failures = 0, freshSettlements = 0;
	const oldTask = api.single(1, handler);
	const observed = oldTask.then(() => { successes++; return "delivered"; }, error => { failures++; return error.code; });
	await enteredFirst.promise;
	equal(oldTask.cancel(), true, "initial cancel");
	equal(oldTask.cancel(), false, "repeated cancel");
	equal(await observed, "operation-cancelled", "public cancellation");
	// No application answer has been supplied. Cancellation alone must allow
	// Lean's worker to finish and release its frame and notification.
	await idle();
	const beforeReply = counts(stats);
	equal(beforeReply.every(n => n === 0), true, "native drain before host callback settles");
	const fresh = api.single(2, handler);
	const delivered = fresh.then(n => { freshSettlements++; return n; }, error => { freshSettlements++; throw error; });
	await enteredSecond.promise;
	if(rejectOld) first.reject(new Error("stale application failure"));
	else first.resolve(777);
	// Yield through another compiled Lean task. The old reply must not be
	// delivered to the new registration or poison its still-healthy peer.
	equal(await api.single(40, n => n + 2), 42, "sibling completed with replacement parked");
	equal(freshSettlements, 0, "late reply settled replacement");
	second.resolve(42);
	equal(await delivered, 42, "replacement got its own reply");
	equal(fresh.cancel(), false, "completion beat cancellation");
	await idle();
	equal(calls.join(","), "1,2", "crossed registration or resubmitted callback");
	equal(successes, 0, "cancelled task succeeded");
	equal(failures, 1, "cancelled task rejected more than once");
	equal(freshSettlements, 1, "replacement did not settle once");
	return {beforeReply, successes, failures, freshSettlements, calls};
};

/**
 * Exercise cancellation before admission, after callback entry, and after settlement.
 *
 * @param api - Installed Budget API.
 * @param stats - Installed shared runtime's observable ownership counts.
 * @param idle - Wait for actual native notification and frame cleanup.
 */
export async function runBudget(api, stats, idle) {
	let earlyEntries = 0;
	const early = api.single(0, n => { earlyEntries++; return n; });
	const ended = early.then(() => "delivered", error => error.code);
	equal(early.cancel(), true, "cancellation before event-loop admission");
	equal(await ended, "operation-cancelled", "early settlement");
	await idle();
	equal(earlyEntries, 0, "cancelled registration called application code");
	const lateValue = await race(api, stats, idle, false);
	const lateError = await race(api, stats, idle, true);
	const recovered = await api.single(41, n => n + 1);
	await idle();
	return {earlyEntries, lateValue, lateError, recovered, live: counts(stats)};
}
