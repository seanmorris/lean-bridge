/**
 * Provides the runner test fixture.
 *
 * @file
 */

import { runNativeConsumer } from "./app.mjs";

globalThis.leanBridgeResultPromise = runNativeConsumer();
