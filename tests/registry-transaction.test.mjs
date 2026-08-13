import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
	createRegistryTransactionPublisher,
	RegistryTransactionError,
	registryRecoveryPolicies,
	validateRegistryTransaction,
} from "../src/release/registry-transaction.mjs";

const hash = character => character.repeat(64);
const target = ({ order, ecosystem, operation = "publish", artifact = ecosystem[0] }) => Object.freeze({
	order
	, candidateId: hash("a")
	, ecosystem
	, coordinate: ecosystem === "pypi" ? `lean-bridge-alpha==1.0.${order}` : `lean-bridge-alpha@1.0.${order}`
	, operation
	, destination: operation === "publish"
		? Object.freeze({ kind: ecosystem, endpoint: `https://${ecosystem}.example.invalid/` })
		: Object.freeze({ kind: "archive", endpoint: null })
	, archives: Object.freeze([{ sha256: hash(artifact) }])
	, idempotencyKey: hash(String(order))
});

const planFor = targets => Object.freeze({
	authorization: Object.freeze({ candidateId: hash("a") })
	, targets: Object.freeze(targets)
});

const attestation = Object.freeze({
	statementSha256: hash("b")
	, envelopeSha256: hash("c")
});

const ready = (overrides = {}) => ({
	permission: "granted"
	, coordinateState: "available"
	, immutable: true
	, registryReference: null
	, artifacts: []
	, dependencies: [],
	...overrides
});

const published = (targetRecord, overrides = {}) => ({
	status: "published"
	, registryReference: `registry:${targetRecord.coordinate}`
	, artifacts: targetRecord.archives.map(item => ({ sha256: item.sha256 }))
	, externalWrite: true
	, failure: null,
	...overrides
});

const matching = targetRecord => ready({
	coordinateState: "matching"
	, registryReference: `registry:${targetRecord.coordinate}`
	, artifacts: targetRecord.archives.map(item => ({ sha256: item.sha256 }))
});

const credentials = calls => ({
	withTarget:
		/**
     * Provides one target credential to a bounded callback and verifies that no secret escapes it.
     *
     * @param targetRecord - Publication target record temporarily selected by the transaction test helper.
     * @param operation - Publisher callback granted access to the selected test credential.
     */
		async function(targetRecord, operation) {
			calls.push(["credential", targetRecord.ecosystem]);
			return operation(Object.freeze({
				names: Object.freeze([`${targetRecord.ecosystem.toUpperCase()}_TOKEN`])
				, get:
				/**
         * Validates the requested registry token name and returns the fixture-only secret.
         *
         * @param name - Ecosystem-specific token name expected for the selected target.
         */
				function(name) {
					assert.equal(name, `${targetRecord.ecosystem.toUpperCase()}_TOKEN`);
					return "test-only-secret";
				}
			}));
		}
});

const fixture = async () => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-registry-transaction-"));
	const manifestPath = join(root, "publish-manifest.json");
	await writeFile(manifestPath, "{}", "utf8");
	return { root, manifestPath };
};

const invoke = ({ publisher, plan, manifestPath, calls, onProgress }) => publisher({
	plan
	, manifestPath
	, manifestSha256: hash("d")
	, candidateRoot: join(manifestPath, "..", "release")
	, credentials: credentials(calls)
	, attestation
	, onProgress
});

test("all registry preflights finish before the first ordered write", async t => {
  const { root, manifestPath } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [];
  const targets = [
    target({ order: 1, ecosystem: "c", operation: "retain", artifact: "1" })
    , target({ order: 2, ecosystem: "cargo", artifact: "2" })
    , target({ order: 3, ecosystem: "npm", artifact: "3" })
    , target({ order: 4, ecosystem: "pypi", artifact: "4" })
  ];
  const adapters = targets.filter(item => item.operation === "publish").map(item => ({
    ecosystem: item.ecosystem
    , kind: "test-adapter"
    , preflight: ({ credentials: view }) => {
      calls.push(["preflight", item.ecosystem, view.get(`${item.ecosystem.toUpperCase()}_TOKEN`)]);
      return ready();
    }
    , publish: () => {
      calls.push(["publish", item.ecosystem]);
      return published(item);
    }
  }));
  const progress = [];
  const result = await invoke({
    publisher: createRegistryTransactionPublisher({ adapters, now: () => "2026-08-10T00:00:00.000Z" })
    , plan: planFor(targets)
    , manifestPath
    , calls
    , onProgress: event => progress.push(event)
  });

  assert.equal(result.transaction.status, "complete");
  assert.equal(result.transaction.atomicity, "independent-registry-commits");
  assert.equal(result.externalRegistryWrites, true);
  assert.deepEqual(result.results.map(item => item.status), ["retained", "published", "published", "published"]);
  const callKinds = calls.filter(item => item[0] !== "credential").map(item => `${item[0]}:${item[1]}`);
  assert.deepEqual(callKinds, [
    "preflight:cargo", "preflight:npm", "preflight:pypi"
    , "publish:cargo", "publish:npm", "publish:pypi"
  ]);
  assert.equal(calls.some(item => item.includes("test-only-secret")), true);
  assert.equal(JSON.stringify(result).includes("test-only-secret"), false);
  assert.equal(progress.at(-1).message, "Every registry target reached a durable terminal state");

  const source = await readFile(join(root, "registry-transaction.json"), "utf8");
  const state = JSON.parse(source);
  assert.equal(validateRegistryTransaction(state), true);
  assert.equal(source.endsWith("\n"), true);
  assert.equal(state.targets[1].recovery.strategy, "publish-corrective-version-then-yank");
  assert.equal(state.targets[2].recovery.command.startsWith("npm deprecate"), true);
  assert.equal(state.targets[3].recovery.strategy, "yank-files-or-publish-corrective-version");
});

test("a collision, denied permission, or unavailable dependency blocks every write", async t => {
  const scenarios = [
    [ready({ coordinateState: "collision", registryReference: "registry:occupied" }), "registry-coordinate-collision"]
    , [ready({ permission: "denied" }), "registry-permission-denied"]
    , [ready({ dependencies: [{ coordinate: "missing@1", status: "unavailable" }] }), "registry-dependency-unavailable"]
    , [ready({ immutable: false }), "registry-immutability-unverified"]
  ];
  for(const [preflight, code] of scenarios)
{
    const { root, manifestPath } = await fixture();
    t.after(() => rm(root, { recursive: true, force: true }));
    const calls = [];
    const npm = target({ order: 1, ecosystem: "npm", artifact: "5" });
    const publisher = createRegistryTransactionPublisher({
      adapters: [{
        ecosystem: "npm"
        , kind: "test-adapter"
        , preflight: () => preflight
        , publish: () => {
          calls.push(["publish", "npm"]);
          return published(npm);
        }
      }]
      , transactionFile: `${code}.json`
      , now: () => "2026-08-10T00:00:00.000Z"
    });
    await assert.rejects(
      invoke({ publisher, plan: planFor([npm]), manifestPath, calls }),
      error => error instanceof RegistryTransactionError && error.code === code && error.details.result.externalRegistryWrites === false,
    );
    assert.deepEqual(calls.filter(item => item[0] === "publish"), []);
}
});

test("a partial multi-registry release resumes without republishing completed coordinates", async t => {
  const { root, manifestPath } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [];
  const npm = target({ order: 1, ecosystem: "npm", artifact: "6" });
  const pypi = target({ order: 2, ecosystem: "pypi", artifact: "7" });
  const remote = new Map([["npm", "available"], ["pypi", "available"]]);
  let pypiAttempts = 0;
  const adapter = targetRecord => ({
    ecosystem: targetRecord.ecosystem
    , kind: "test-adapter"
    , preflight: () => remote.get(targetRecord.ecosystem) === "matching" ? matching(targetRecord) : ready()
    , publish: () => {
      calls.push(["publish", targetRecord.ecosystem]);
      if(targetRecord.ecosystem === "pypi" && pypiAttempts++ === 0)
{
        remote.set("pypi", "matching");
        return {
          status: "failed"
          , registryReference: null
          , artifacts: []
          , externalWrite: "unknown"
          , failure: { code: "registry-timeout", retryable: true }
        };
}
      remote.set(targetRecord.ecosystem, "matching");
      return published(targetRecord);
    }
  });
  const publisher = createRegistryTransactionPublisher({
    adapters: [adapter(npm), adapter(pypi)]
    , now: () => "2026-08-10T00:00:00.000Z"
  });

  await assert.rejects(
    invoke({ publisher, plan: planFor([npm, pypi]), manifestPath, calls }),
    error => {
      assert.equal(error.code, "registry-transaction-partial");
      assert.equal(error.details.result.transaction.status, "partial");
      assert.deepEqual(error.details.result.results.map(item => item.status), ["published", "failed"]);
      assert.equal(error.details.result.results[1].failure.retryable, true);
      return true;
    },
  );
  remote.set("npm", "matching");
  const resumed = await invoke({ publisher, plan: planFor([npm, pypi]), manifestPath, calls });
  assert.equal(resumed.transaction.status, "complete");
  assert.equal(resumed.transaction.attemptCount, 2);
  assert.deepEqual(resumed.results.map(item => item.status), ["published", "published"]);
  assert.deepEqual(calls.filter(item => item[0] === "publish"), [["publish", "npm"], ["publish", "pypi"]]);
  const state = JSON.parse(await readFile(join(root, "registry-transaction.json"), "utf8"));
  assert.deepEqual(state.targets.map(item => item.attempts), [1, 1]);
  assert.equal(state.targets[1].result.registryReference, `registry:${pypi.coordinate}`);
});

test("an already-published exact coordinate is idempotent and a mismatched hash is a collision", async t => {
  const exactFixture = await fixture();
  t.after(() => rm(exactFixture.root, { recursive: true, force: true }));
  const npm = target({ order: 1, ecosystem: "npm", artifact: "8" });
  let publishCalls = 0;
  const exactPublisher = createRegistryTransactionPublisher({
    adapters: [{
      ecosystem: "npm"
      , kind: "test-adapter"
      , preflight: () => matching(npm)
      , publish: () => {
        publishCalls += 1;
        return published(npm);
      }
    }]
    , now: () => "2026-08-10T00:00:00.000Z"
  });
  const exact = await invoke({ publisher: exactPublisher, plan: planFor([npm]), manifestPath: exactFixture.manifestPath, calls: [] });
  assert.equal(exact.results[0].status, "already-published");
  assert.equal(exact.externalRegistryWrites, false);
  assert.equal(publishCalls, 0);

  const collisionFixture = await fixture();
  t.after(() => rm(collisionFixture.root, { recursive: true, force: true }));
  const collisionPublisher = createRegistryTransactionPublisher({
    adapters: [{
      ecosystem: "npm"
      , kind: "test-adapter"
      , preflight: () => ready({
        coordinateState: "matching"
        , registryReference: "registry:wrong"
        , artifacts: [{ sha256: hash("9") }]
      })
      , publish: () => published(npm)
    }]
    , now: () => "2026-08-10T00:00:00.000Z"
  });
  await assert.rejects(
    invoke({ publisher: collisionPublisher, plan: planFor([npm]), manifestPath: collisionFixture.manifestPath, calls: [] }),
    error => error.code === "registry-coordinate-collision",
  );
});

test("dependency ordering, adapter availability, transaction identity, and locks fail closed", async t => {
  const dependencyFixture = await fixture();
  t.after(() => rm(dependencyFixture.root, { recursive: true, force: true }));
  const npm = target({ order: 1, ecosystem: "npm", artifact: "e" });
  const badDependency = createRegistryTransactionPublisher({
    adapters: [{
      ecosystem: "npm"
      , kind: "test-adapter"
      , preflight: () => ready({ dependencies: [{ coordinate: "later@1", status: "planned-earlier" }] })
      , publish: () => published(npm)
    }]
    , now: () => "2026-08-10T00:00:00.000Z"
  });
  await assert.rejects(
    invoke({ publisher: badDependency, plan: planFor([npm]), manifestPath: dependencyFixture.manifestPath, calls: [] }),
    error => error.code === "registry-dependency-order-invalid",
  );

  const missingFixture = await fixture();
  t.after(() => rm(missingFixture.root, { recursive: true, force: true }));
  const noAdapter = createRegistryTransactionPublisher({ now: () => "2026-08-10T00:00:00.000Z" });
  await assert.rejects(
    invoke({ publisher: noAdapter, plan: planFor([npm]), manifestPath: missingFixture.manifestPath, calls: [] }),
    error => error.code === "registry-adapter-unavailable",
  );

  const lockFixture = await fixture();
  t.after(() => rm(lockFixture.root, { recursive: true, force: true }));
  await writeFile(join(lockFixture.root, "registry-transaction.json.lock"), "occupied", "utf8");
  await assert.rejects(
    invoke({ publisher: noAdapter, plan: planFor([npm]), manifestPath: lockFixture.manifestPath, calls: [] }),
    error => error.code === "registry-transaction-locked",
  );
});

test("the transaction schema and recovery policies are closed public contracts", async () => {
  const schema = JSON.parse(await readFile("schema/registry-transaction.schema.json", "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.target.additionalProperties, false);
  assert.equal(schema.$defs.preflight.additionalProperties, false);
  assert.equal(schema.$defs.result.additionalProperties, false);
  assert.equal(schema.$defs.failure.additionalProperties, false);
  assert.equal(schema.$defs.recovery.additionalProperties, false);
  assert.equal(registryRecoveryPolicies.npm.source, "https://docs.npmjs.com/policies/unpublish/");
  assert.equal(registryRecoveryPolicies.cargo.source, "https://doc.rust-lang.org/cargo/commands/cargo-yank.html");
  assert.equal(registryRecoveryPolicies.pypi.source, "https://packaging.python.org/en/latest/specifications/file-yanking/");
  assert.equal(registryRecoveryPolicies.nuget.source, "https://learn.microsoft.com/en-us/nuget/api/package-publish-resource");
  assert.equal(registryRecoveryPolicies.maven.source, "https://central.sonatype.org/faq/can-i-change-a-component/");
  assert.equal(registryRecoveryPolicies.rubygems.source, "https://guides.rubygems.org/removing-a-published-gem/");
  assert.equal(registryRecoveryPolicies["wit-wasi"].source, "urn:lean-bridge:policy:local-archive-retention:v1");
});
