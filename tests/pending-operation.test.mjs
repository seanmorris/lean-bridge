import assert from "node:assert/strict";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
  PendingOperationGenerationError,
  compilePendingOperationV1,
} from "../src/abi/pending-operation.mjs";
import {
  PendingOperationError,
  PendingOperationRegistry,
} from "../src/runtime/pending-operations.mjs";

const clone = value => structuredClone(value);

const promiseFixture = () => {
  const ir = clone(alpha.bindingIr);
  const declaration = ir.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  declaration.resultMode = "promise";
  declaration.effects.push("async");
  return { ir, declaration };
};

test("pending plans come from Promise delivery and ownership semantics", () => {
  const { ir, declaration } = promiseFixture();
  const plan = compilePendingOperationV1(ir, declaration.id);

  assert.deepEqual(plan.execution, {
    suspension: "stackless",
    pendingStack: "empty",
    reentry: "same-agent",
  });
  assert.deepEqual(plan.settlement, {
    cardinality: "exactly-once",
    late: "reject",
    cleanup: "reverse-capture-order",
  });
  assert.deepEqual(plan.captures, [
    {
      source: "parameter",
      name: "payload",
      type: { kind: "named", id: "lean:Alpha.Payload" },
      representation: "copied",
      ownership: "copy",
      lifetime: null,
      capture: "copy-into-operation",
      cleanup: "none",
    },
  ]);
  assert.equal(plan.result.delivery, "lift-copy");
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(ir), false);
});

test("identity borrows receive a generated operation lease", () => {
  const { ir, declaration } = promiseFixture();
  declaration.parameters = [
    {
      name: "box",
      type: { kind: "named", id: "lean:Alpha.Box" },
      ownership: "borrow",
      lifetime: { scope: "call", anchor: null },
      mutability: "read",
      optional: false,
      default: null,
    },
  ];

  const plan = compilePendingOperationV1(ir, declaration.id);
  assert.deepEqual(
    {
      representation: plan.captures[0].representation,
      capture: plan.captures[0].capture,
      cleanup: plan.captures[0].cleanup,
    },
    {
      representation: "identity",
      capture: "retain-borrow-until-settlement",
      cleanup: "release-after-settlement",
    },
  );
});

test("non-Promise declarations cannot receive pending-operation plans", () => {
  assert.throws(
    () => compilePendingOperationV1(alpha.bindingIr, "lean:Alpha.roundTrip"),
    error => {
      assert.equal(error instanceof PendingOperationGenerationError, true);
      assert.equal(error.code, "not-a-promise");
      return true;
    },
  );
});

test("pending operations settle once and reject late settlement", async () => {
  const { ir, declaration } = promiseFixture();
  const plan = compilePendingOperationV1(ir, declaration.id);
  const transitions = [];
  const registry = new PendingOperationRegistry({
    onTransition: transition => transitions.push(transition.event),
  });
  const pending = registry.begin(plan);

  assert.equal(registry.resolve(pending.token, 42), true);
  assert.equal(await pending.promise, 42);
  assert.throws(
    () => registry.reject(pending.token, new Error("late")),
    error => {
      assert.equal(error instanceof PendingOperationError, true);
      assert.equal(error.code, "stale-pending-operation");
      return true;
    },
  );
  assert.deepEqual(transitions, ["begin", "resolve"]);
  assert.deepEqual(registry.snapshot(), {
    state: "open",
    epoch: 1,
    capacity: 1024,
    live: 0,
    begun: 1,
    resolved: 1,
    rejected: 0,
    cancelled: 0,
    late: 1,
    cleanupRuns: 0,
    cleanupFailures: 0,
    observerFailures: 0,
  });
});

test("diagnostic observers cannot change settlement semantics", async () => {
  const { ir, declaration } = promiseFixture();
  const plan = compilePendingOperationV1(ir, declaration.id);
  const registry = new PendingOperationRegistry({
    onTransition() {
      throw new Error("observer failed");
    },
  });
  const pending = registry.begin(plan);

  assert.equal(registry.resolve(pending.token, "done"), true);
  assert.equal(await pending.promise, "done");
  assert.equal(registry.snapshot().observerFailures, 2);
});

test("cancellation runs cleanup in reverse order and rejects late results", async () => {
  const { ir, declaration } = promiseFixture();
  const plan = compilePendingOperationV1(ir, declaration.id);
  const cleanup = [];
  const registry = new PendingOperationRegistry();
  const pending = registry.begin(plan, {
    cleanup: [() => cleanup.push("first"), () => cleanup.push("second")],
  });
  const rejected = assert.rejects(pending.promise, error => {
    assert.equal(error.code, "operation-cancelled");
    return true;
  });

  assert.equal(registry.cancel(pending.token, "request aborted"), true);
  await rejected;
  assert.deepEqual(cleanup, ["second", "first"]);
  assert.throws(
    () => registry.resolve(pending.token, "late"),
    error => error.code === "stale-pending-operation",
  );
});

test("cleanup failure replaces a successful settlement with a boundary error", async () => {
  const { ir, declaration } = promiseFixture();
  const plan = compilePendingOperationV1(ir, declaration.id);
  const registry = new PendingOperationRegistry();
  const pending = registry.begin(plan, {
    cleanup: [() => {
      throw new Error("release failed");
    }],
  });
  const rejected = assert.rejects(pending.promise, error => {
    assert.equal(error.code, "pending-cleanup-failed");
    assert.equal(error.cause.message, "release failed");
    return true;
  });

  assert.equal(registry.resolve(pending.token, 42), false);
  await rejected;
  assert.equal(registry.snapshot().cleanupFailures, 1);
});

test("shutdown cancels every operation and rejects new work", async () => {
  const { ir, declaration } = promiseFixture();
  const plan = compilePendingOperationV1(ir, declaration.id);
  const registry = new PendingOperationRegistry({ capacity: 2 });
  const first = registry.begin(plan);
  const second = registry.begin(plan);
  const rejected = Promise.all([
    assert.rejects(first.promise, error => error.code === "operation-cancelled"),
    assert.rejects(second.promise, error => error.code === "operation-cancelled"),
  ]);

  assert.equal(registry.shutdown(), true);
  await rejected;
  assert.equal(registry.snapshot().live, 0);
  assert.equal(registry.snapshot().cancelled, 2);
  assert.throws(
    () => registry.begin(plan),
    error => error.code === "pending-registry-closed",
  );
});

test("pending capacity fails before allocating another operation", async () => {
  const { ir, declaration } = promiseFixture();
  const plan = compilePendingOperationV1(ir, declaration.id);
  const registry = new PendingOperationRegistry({ capacity: 1 });
  const pending = registry.begin(plan);

  assert.throws(
    () => registry.begin(plan),
    error => error.code === "pending-capacity",
  );
  const rejected = assert.rejects(
    pending.promise,
    error => error.code === "operation-cancelled",
  );
  registry.cancel(pending.token);
  await rejected;
});
