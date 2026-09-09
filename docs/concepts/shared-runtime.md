# Combine Lean packages

JavaScript users install and import the prepared component package. npm resolves its exact runtime dependency, and module loading initializes the runtime before the component's functions become available. Application code does not create a Lean heap or link the component manually.

This page explains that behavior for ordinary generated npm components. Start with [the installation guide](../javascript-typescript.md) if you have not yet received a package.

## Let the package own initialization

For the tutorial package, normal application code is:

```js
import { add, isEmpty } from 'onboarding-small';

console.log(add(20n, 22n)); // 42n
console.log(isEmpty('Lean')); // false
```

For a screen that loads the feature on demand, use a dynamic import:

```js
const { add } = await import('onboarding-small');
console.log(add(20n, 22n)); // 42n
```

Importing is asynchronous; the pure `add` call is synchronous after import. Catch import failures separately from invalid call arguments. The [React and worker examples](../javascript-typescript.md) use these same public imports.

## Share a compatible runtime instance

If you also receive the `onboarding-scalars` fixture release with the same runtime dependency, both packages can be used together:

```js
import { add } from 'onboarding-small';
import { mixed } from 'onboarding-scalars';

console.log(add(20n, 22n)); // 42n
console.log(mixed(true, 2, 'Lean', 40n)); // 46n
```

These are the two prepared fixture packages described in the [generated API reference](../reference/package-api.md). Their names are examples, not a requirement imposed on an application's libraries.

Each component archive declares an exact `@lean-bridge/runtime` dependency derived from the runtime package's identity. Components resolved to the same installed runtime module in one JavaScript realm use that module's initialized heap and loader. Do not replace the exact dependency with a guessed version.

The loader deduplicates identical component loads. If two requests use the same component ID with different identities, it rejects the conflict. It verifies component bytes before linking and serializes linking so overlapping imports cannot interleave initialization unsafely.

The [runtime loader tests](../../tests/component-runtime.test.mjs) cover concurrent identical loads, identity conflicts, changed descriptors, and failed initialization. The [npm package tests](../../tests/component-npm-package.test.mjs) check the generated package boundary.

## Know when there are separate heaps

A browser worker has its own JavaScript realm. Importing the package in both a page and a worker initializes separate runtime instances. Send copied values or application messages between them, not a resource from one heap for use in another.

Different installed runtime versions, duplicated module URLs, or separate bundles can also create separate instances. Sharing is a property of module resolution and compatible package identities, not a global singleton spanning the whole browser.

Standalone demo adapters bundle their own compiled runtime artifacts. Dijkstra and flood fill do not share a heap merely because they appear on one site. Their [local API reference](../reference/algorithms.md) is a different distribution path from prepared component packages.

## Package and operate it

The publisher must make the exact runtime dependency available wherever consumers resolve packages. For a local offline handoff, supply both runtime and component archives. A registry consumer installs the component and the package manager resolves the dependency.

The bundler must emit the loader's referenced binary assets. Follow the [browser configuration](../javascript-typescript.md#use-the-package-in-a-browser); moving only an entry module without its referenced files breaks loading.

Disposing a prepared solver or resource does not unload the module-wide runtime. The loader keeps successfully linked components for that instance's lifetime. Ending a worker or closing its owning realm releases that whole instance.

Next, read [Ownership and cleanup](ownership.md) or the [prepared package API](../reference/package-api.md).
