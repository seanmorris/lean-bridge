import React, { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";

import { runNativeConsumer } from "./app.mjs";

let resolveResult;
let rejectResult;
globalThis.leanBridgeResultPromise = new Promise((resolve, reject) => {
  resolveResult = resolve;
  rejectResult = reject;
});
globalThis.leanBridgeReactEffectRuns = 0;

const Consumer = () => {
  useEffect(() => {
    globalThis.leanBridgeReactEffectRuns += 1;
    let active = true;
    runNativeConsumer().then(result => {
      if (active) {
        resolveResult({
          ...result,
          strictModeEffects: globalThis.leanBridgeReactEffectRuns,
        });
      }
    }, rejectResult);
    return () => {
      active = false;
    };
  }, []);
  return React.createElement("span", null, "Lean loaded");
};

const container = document.createElement("div");
document.body.append(container);
createRoot(container).render(
  React.createElement(StrictMode, null, React.createElement(Consumer)),
);
