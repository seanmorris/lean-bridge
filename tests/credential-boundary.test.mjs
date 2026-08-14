/**
 * Tests the credential boundary behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	createEnvironmentCredentialProvider,
	createPublishCredentialBoundary,
	CredentialBoundaryError,
} from "../src/release/credentials.mjs";

const plan = Object.freeze({
	targets: Object.freeze([
		Object.freeze({
			order: 1
			, ecosystem: "c"
			, coordinate: "lean-bridge-alpha@0.0.0"
			, operation: "retain"
			, idempotencyKey: "c-target"
			, credentialEnvironment: Object.freeze([])
		})
		, Object.freeze({
			order: 2
			, ecosystem: "npm"
			, coordinate: "@lean-bridge/alpha@0.0.0"
			, operation: "publish"
			, idempotencyKey: "npm-target"
			, credentialEnvironment: Object.freeze(["NPM_TOKEN"])
		})
	])
});

test("environment provider exposes only explicitly requested nonempty values", () => {
  const provider = createEnvironmentCredentialProvider({
    environment: { NPM_TOKEN: "registry-secret", EMPTY_TOKEN: "" }
  });
  assert.equal(provider.kind, "environment");
  assert.equal(provider.has("NPM_TOKEN"), true);
  assert.equal(provider.has("EMPTY_TOKEN"), false);
  assert.equal(provider.read("NPM_TOKEN"), "registry-secret");
  assert.throws(
    () => provider.read("EMPTY_TOKEN"),
    error => error instanceof CredentialBoundaryError && error.code === "publish-credential-missing" && !error.message.includes("registry-secret"),
  );
  assert.throws(
    () => provider.has("lowercase"),
    error => error.code === "invalid-credential-name",
  );
});

test("preflight checks names without reading values and target access is just in time", async () => {
  const calls = [];
  const boundary = createPublishCredentialBoundary({
    plan
    , provider: {
      kind: "test-provider"
      , has:
        /**
         * Checks whether the named registry credential is available without reading its secret value.
         *
         * @param name - Uppercase environment-variable name requested by the publication target.
         */
        function(name) {
        calls.push(["has", name]);
        return true;
        }
      , read:
        /**
         * Records a credential read and returns the fixture secret, or throws, so the test can verify just-in-time access.
         *
         * @param name - Uppercase environment-variable name requested by the publication target.
         */
        function(name) {
        calls.push(["read", name]);
        return "registry-secret";
        }
    }
  });
  const preflight = await boundary.preflight();
  assert.equal(preflight.status, "ready");
  assert.equal(preflight.valuesRead, false);
  assert.deepEqual(calls, [["has", "NPM_TOKEN"]]);
  assert.deepEqual(preflight.targets.map(item => [item.ecosystem, item.requiredNames, item.available, item.accessCount]), [
    ["c", [], true, 0]
    , ["npm", ["NPM_TOKEN"], true, 0]
  ]);

  const result = await boundary.withTarget("npm-target", credentials => {
    assert.deepEqual(credentials.names, ["NPM_TOKEN"]);
    assert.equal(credentials.get("NPM_TOKEN"), "registry-secret");
    assert.throws(
      () => credentials.get("CARGO_REGISTRY_TOKEN"),
      error => error.code === "credential-name-not-authorized",
    );
    return { status: "accepted", requestId: "public-request-id" };
  });
  assert.deepEqual(result, { status: "accepted", requestId: "public-request-id" });
  assert.deepEqual(calls, [["has", "NPM_TOKEN"], ["read", "NPM_TOKEN"]]);
  const complete = boundary.complete();
  assert.equal(complete.status, "complete");
  assert.equal(complete.valuesRead, true);
  assert.equal(complete.valuesRetained, false);
  assert.equal(complete.targets[1].accessCount, 1);
  assert.equal(JSON.stringify(complete).includes("registry-secret"), false);
  assert.equal(boundary.close(), true);
  await assert.rejects(
    boundary.withTarget("npm-target", () => null),
    error => error.code === "credential-boundary-state",
  );
});

test("missing credentials block before any value is read", async () => {
  const calls = [];
  const boundary = createPublishCredentialBoundary({
    plan
    , provider: {
      kind: "test-provider"
      , has:
        /**
         * Checks whether the named registry credential is available without reading its secret value.
         *
         * @param name - Uppercase environment-variable name requested by the publication target.
         */
        function(name) {
        calls.push(["has", name]);
        return false;
        }
      , read:
        /**
         * Records a credential read and returns the fixture secret, or throws, so the test can verify just-in-time access.
         *
         * @param name - Uppercase environment-variable name requested by the publication target.
         */
        function(name) {
        calls.push(["read", name]);
        return "must-not-be-read";
        }
    }
  });
  await assert.rejects(
    boundary.preflight(),
    error => {
      assert.equal(error.code, "publish-credentials-missing");
      assert.deepEqual(error.details.missing, [{
        order: 2
        , ecosystem: "npm"
        , coordinate: "@lean-bridge/alpha@0.0.0"
        , names: ["NPM_TOKEN"]
      }]);
      assert.equal(JSON.stringify(error).includes("must-not-be-read"), false);
      return true;
    },
  );
  assert.deepEqual(calls, [["has", "NPM_TOKEN"]]);
  const audit = boundary.snapshot();
  assert.equal(audit.status, "blocked");
  assert.equal(audit.valuesRead, false);
  assert.equal(audit.valuesRetained, false);
  boundary.close();
});

test("credential values cannot escape through results or thrown errors", async () => {
  const makeBoundary = async () => {
    const boundary = createPublishCredentialBoundary({
      plan
      , provider: {
        kind: "test-provider"
        , has: () => true
        , read: () => "registry-secret"
      }
    });
    await boundary.preflight();
    return boundary;
  };

  const resultLeak = await makeBoundary();
  await assert.rejects(
    resultLeak.withTarget("npm-target", credentials => ({ authorization: credentials.get("NPM_TOKEN") })),
    error => error.code === "credential-value-leak" && !error.message.includes("registry-secret"),
  );
  assert.equal(resultLeak.snapshot().status, "failed");
  assert.throws(
    () => resultLeak.assertSafe({ nested: ["prefix registry-secret suffix"] }),
    error => error.code === "credential-value-leak",
  );
  resultLeak.close();

  const errorLeak = await makeBoundary();
  await assert.rejects(
    errorLeak.withTarget("npm-target", credentials => {
      const error = new Error(`registry rejected ${credentials.get("NPM_TOKEN")}`);
      error.code = "registry-rejected";
      throw error;
    }),
    error => {
      assert.equal(error.code, "credential-operation-failed");
      assert.equal(error.details.causeCode, "registry-rejected");
      assert.equal(error.message.includes("registry-secret"), false);
      assert.equal(JSON.stringify(error.details).includes("registry-secret"), false);
      return true;
    },
  );
  assert.equal(errorLeak.snapshot().status, "failed");
  errorLeak.close();

  const directPublisherError = await makeBoundary();
  await directPublisherError.withTarget("npm-target", credentials => {
    assert.equal(credentials.get("NPM_TOKEN"), "registry-secret");
    return { status: "authenticated" };
  });
  const sanitized = directPublisherError.sanitize(new Error("publisher exposed registry-secret"));
  assert.equal(sanitized.code, "credential-value-leak");
  assert.equal(sanitized.message.includes("registry-secret"), false);
  directPublisherError.close();
});

test("credential inspection fails closed when publisher output has a throwing accessor", async () => {
  const boundary = createPublishCredentialBoundary({
    plan
    , provider: {
      kind: "test-provider"
      , has: () => true
      , read: () => "registry-secret"
    }
  });
  await boundary.preflight();
  await assert.rejects(
    boundary.withTarget("npm-target", credentials => {
      assert.equal(credentials.get("NPM_TOKEN"), "registry-secret");
      return Object.defineProperty({}, "authorization", {
        enumerable: true
        , get:
          /**
           * Returns the live value for a key and removes the entry when collection has already occurred.
           */
          function() {
          throw new Error("registry-secret");
          }
      });
    }),
    error => error.code === "credential-output-uninspectable" && !error.message.includes("registry-secret"),
  );
  assert.equal(boundary.snapshot().status, "failed");
  boundary.close();
});

test("credential audit schema closes every report field", async () => {
  const schema = JSON.parse(await readFile("schema/credential-audit.schema.json", "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.valuesRetained.const, false);
  assert.equal(schema.properties.targets.items.additionalProperties, false);
});
