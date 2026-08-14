/**
 * Implements the pending operations module in the runtime subsystem.
 *
 * @file
 */

const MAX_SLOT = 0xffff;
const MAX_GENERATION = 0xffff;

/**
 * Reports pending operation failures with stable machine-readable codes and structured diagnostic context.
 */
export class PendingOperationError extends Error
{
	/**
   * Initializes the error used to report pending operation failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   * @param cause - Underlying error that triggered the failure, when available.
   */
	constructor(code, message, details = {}, cause)
	{
		super(message, cause === undefined ? undefined : { cause });
		this.name = "PendingOperationError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const encodeToken = (slot, generation) =>
	(((generation & MAX_GENERATION) << 16) | (slot + 1)) >>> 0;

const decodeToken = token => ({
	slot: (token & MAX_SLOT) - 1
	, generation: token >>> 16
});

const cancellationError = (reason, details) =>
	new PendingOperationError(
		"operation-cancelled",
		reason ?? "the pending operation was cancelled",
		details,
	);

/**
 * Tracks asynchronous native operations from allocation through settlement, cancellation, and cleanup.
 */
export class PendingOperationRegistry
{
	/**
   * Initializes bounded pending-operation storage and an optional lifecycle observer.
   *
   * @param root0 - Named initialization options and dependency overrides for the new instance.
   * @param root0.capacity - Maximum number of simultaneously live generation-safe handles.
   * @param root0.onTransition - Observer notified when pending operations change state.
   */
	constructor({ capacity = 1024, onTransition } = {})
	{
		if(!Number.isSafeInteger(capacity) || capacity < 1 || capacity > MAX_SLOT)
		{
			throw new PendingOperationError(
				"invalid-pending-capacity",
				`pending operation capacity must be from 1 through ${MAX_SLOT}`,
				{ capacity },
			);
		}
		this.capacity = capacity;
		this.onTransition = onTransition;
		this.state = "open";
		this.epoch = 1;
		this.slots = [];
		this.live = 0;
		this.counters = {
			begun: 0
			, resolved: 0
			, rejected: 0
			, cancelled: 0
			, late: 0
			, cleanupRuns: 0
			, cleanupFailures: 0
			, observerFailures: 0
		};
	}

	/**
   * Applies one allowed state transition and records immutable evidence for the change.
   *
   * @param event - Lifecycle event being observed or applied.
   * @param entry - Resolved registry entry whose lifecycle is being updated.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	transition(event, entry, details = {})
	{
		try
		{
			this.onTransition?.(
				Object.freeze({
					event
					, token: entry?.token ?? null
					, declarationId: entry?.plan.declarationId ?? null
					, epoch: this.epoch,
					...details
				}),
			);
		} catch
		{
			this.counters.observerFailures += 1;
		}
	}

	/**
   * Allocates a pending-operation token and records its cleanup and cancellation policy.
   *
   * @param plan - Validated plan that defines the allowed operation and targets.
   * @param root0 - Cleanup and cancellation hooks registered with the new pending operation.
   * @param root0.cleanup - Lifecycle hook invoked exactly once when the pending operation settles.
   * @param root0.cancel - Native cancellation symbol or lifecycle hook invoked to stop unfinished work.
   */
	begin(plan, { cleanup = [], cancel } = {})
	{
		if(this.state !== "open")
		{
			throw new PendingOperationError(
				"pending-registry-closed",
				"cannot begin an operation after pending-operation shutdown",
				{ state: this.state, epoch: this.epoch },
			);
		}
		if(plan?.kind !== "pending-operation-v1" || plan.abiVersion !== 1)
		{
			throw new PendingOperationError(
				"invalid-pending-plan",
				"pending operation requires a version 1 generated plan",
			);
		}
		if(!Array.isArray(cleanup) || cleanup.some(item => typeof item !== "function"))
		{
			throw new PendingOperationError(
				"invalid-pending-cleanup",
				"pending cleanup must be an array of functions",
			);
		}
		if(cancel !== undefined && typeof cancel !== "function")
		{
			throw new PendingOperationError(
				"invalid-pending-cancel",
				"pending cancellation must be a function when supplied",
			);
		}
		if(this.live >= this.capacity)
		{
			throw new PendingOperationError(
				"pending-capacity",
				"pending operation registry is full",
				{ capacity: this.capacity },
			);
		}

		let slot = this.slots.findIndex(entry => entry.state === "free" && !entry.retired);
		if(slot < 0)
		{
			if(this.slots.length >= this.capacity)
			{
				throw new PendingOperationError(
					"pending-capacity",
					"pending operation registry has no reusable slots",
					{ capacity: this.capacity },
				);
			}
			slot = this.slots.length;
			this.slots.push({ generation: 1, state: "free", retired: false });
		}
		const entry = this.slots[slot];
		const token = encodeToken(slot, entry.generation);
		let resolvePromise;
		let rejectPromise;
		const promise = new Promise((resolve, reject) => {
			resolvePromise = resolve;
			rejectPromise = reject;
		});
		Object.assign(entry, {
			state: "pending"
			, token
			, plan
			, cleanup: [...cleanup]
			, cancel
			, resolvePromise
			, rejectPromise
		});
		this.live += 1;
		this.counters.begun += 1;
		this.transition("begin", entry);
		return Object.freeze({ token, promise });
	}

	/**
   * Resolves a token only when its operation is still pending in the current generation.
   *
   * @param token - Generation-safe handle identifying the live native entry.
   */
	requirePending(token)
	{
		if(!Number.isInteger(token) || token <= 0 || token > 0xffff_ffff)
		{
			this.counters.late += 1;
			throw new PendingOperationError(
				"invalid-pending-token",
				"pending operation token is invalid",
				{ token },
			);
		}
		const normalized = token >>> 0;
		const decoded = decodeToken(normalized);
		const entry = this.slots[decoded.slot];
		if(
			decoded.slot < 0
      || decoded.generation === 0
      || entry?.state !== "pending"
      || entry.generation !== decoded.generation
      || entry.token !== normalized
		) {
			this.counters.late += 1;
			throw new PendingOperationError(
				"stale-pending-operation",
				"pending operation has already settled or belongs to another generation",
				{ token: normalized },
			);
		}
		return { entry, slot: decoded.slot };
	}

	/**
   * Runs registered cleanup actions once and records any cleanup failures.
   *
   * @param entry - Resolved registry entry whose lifecycle is being updated.
   */
	runCleanup(entry)
	{
		const failures = [];
		for(const operation of entry.cleanup.reverse())
		{
			try
			{
				operation();
				this.counters.cleanupRuns += 1;
			} catch(error)
			{
				failures.push(error);
				this.counters.cleanupFailures += 1;
			}
		}
		entry.cleanup = [];
		return failures;
	}

	/**
   * Invalidates one generation-safe slot and returns it to the reusable free list.
   *
   * @param slot - Registry slot associated with the generation-safe handle.
   * @param entry - Resolved registry entry whose lifecycle is being updated.
   */
	retire(slot, entry)
	{
		this.live -= 1;
		entry.state = "free";
		entry.token = undefined;
		entry.plan = undefined;
		entry.resolvePromise = undefined;
		entry.rejectPromise = undefined;
		entry.cancel = undefined;
		if(entry.generation === MAX_GENERATION)
		{
			entry.retired = true;
		} else
		{
			entry.generation += 1;
		}
		this.slots[slot] = entry;
	}

	/**
   * Completes one pending operation, retires its handle, and returns the normalized outcome.
   *
   * @param token - Generation-safe handle identifying the live native entry.
   * @param outcome - Normalized completion outcome recorded for the operation.
   * @param value - Fulfillment or rejection payload delivered to the pending operation's promise.
   */
	settle(token, outcome, value)
	{
		const { entry, slot } = this.requirePending(token);
		const resolvePromise = entry.resolvePromise;
		const rejectPromise = entry.rejectPromise;
		const cleanupFailures = [];
		if(outcome === "cancel" && entry.cancel)
		{
			try
			{
				entry.cancel(entry.token);
			} catch(error)
			{
				cleanupFailures.push(error);
				this.counters.cleanupFailures += 1;
			}
		}
		cleanupFailures.push(...this.runCleanup(entry));
		const details = { outcome, cleanupFailures: cleanupFailures.length };
		this.transition(outcome, entry, details);
		this.retire(slot, entry);

		if(cleanupFailures.length > 0)
		{
			const error = new PendingOperationError(
				"pending-cleanup-failed",
				"pending operation cleanup failed",
				{ token: token >>> 0, outcome, failures: cleanupFailures.length },
				cleanupFailures[0],
			);
			this.counters.rejected += 1;
			rejectPromise(error);
			return false;
		}
		if(outcome === "resolve")
		{
			this.counters.resolved += 1;
			resolvePromise(value);
		} else
		{
			if(outcome === "cancel") this.counters.cancelled += 1;
			else this.counters.rejected += 1;
			rejectPromise(value);
		}
		return true;
	}

	/**
   * Resolves a validated handle or request while rejecting stale and incompatible identities.
   *
   * @param token - Generation-safe handle identifying the live native entry.
   * @param value - Fulfillment value delivered after the token and lifecycle state are validated.
   */
	resolve(token, value)
	{
		return this.settle(token, "resolve", value);
	}

	/**
   * Raises or records a structured failure with stable code and diagnostic details.
   *
   * @param token - Generation-safe handle identifying the live native entry.
   * @param error - Error or rejection value to normalize and propagate.
   */
	reject(token, error)
	{
		return this.settle(token, "reject", error);
	}

	/**
   * Cancels a pending operation through its registered hook and deterministic cleanup path.
   *
   * @param token - Generation-safe handle identifying the live native entry.
   * @param reason - Human-readable reason for cancellation or disposal.
   */
	cancel(token, reason)
	{
		return this.settle(
			token,
			"cancel",
			cancellationError(reason, { token: token >>> 0, epoch: this.epoch }),
		);
	}

	/**
   * Rejects or releases every live entry and leaves the registry closed to further work.
   *
   * @param reason - Human-readable reason for cancellation or disposal.
   */
	shutdown(reason = "the runtime shut down before the operation settled")
	{
		if(this.state === "closed") return false;
		this.state = "closing";
		const tokens = this.slots
      .filter(entry => entry.state === "pending")
      .map(entry => entry.token);
		for(const token of tokens) this.cancel(token, reason);
		this.state = "closed";
		this.epoch += 1;
		return true;
	}

	/**
   * Returns an immutable diagnostic view of current state without exposing mutable registry internals.
   */
	snapshot()
	{
		return Object.freeze({
			state: this.state
			, epoch: this.epoch
			, capacity: this.capacity
			, live: this.live,
			...this.counters
		});
	}
}
