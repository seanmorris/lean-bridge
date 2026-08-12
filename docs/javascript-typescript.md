# Use a generated package from JavaScript or TypeScript

The supported Node workflow installs separate runtime and component archives. The component depends on `@lean-bridge/runtime`, so several generated components can share one runtime instance.

Complete the [author dry run](lean-author-guide.md) first. The commands below assume its output is `build/lean-bridge-dry-run` in the Lean project.

## Install the archives

Record absolute archive and receipt paths before entering a clean consumer directory:

```sh
export LEAN_BRIDGE_RELEASE="$PWD/build/lean-bridge-dry-run/release/packages/npm"
export LEAN_BRIDGE_RUNTIME_ARCHIVE=$(find "$LEAN_BRIDGE_RELEASE" -maxdepth 1 -name 'lean-bridge-runtime-*.tgz' -print -quit)
export LEAN_BRIDGE_COMPONENT_ARCHIVE=$(find "$LEAN_BRIDGE_RELEASE" -maxdepth 1 -name 'onboarding-small-*.tgz' -print -quit)
export LEAN_BRIDGE_CONSUMER=$(mktemp -d)

cd "$LEAN_BRIDGE_CONSUMER"
npm init --yes
npm pkg set type=module
npm install --ignore-scripts --no-audit --no-fund \
  "$LEAN_BRIDGE_RUNTIME_ARCHIVE" \
  "$LEAN_BRIDGE_COMPONENT_ARCHIVE"
```

The install uses no package lifecycle script. npm copies the generated JavaScript, declarations, runtime, component, and metadata from the archives.

## JavaScript

Create `index.mjs`:

```js
import { add, isEmpty } from "onboarding-small";

const result = {
  add: add(100n, 23n),
  empty: isEmpty(""),
  nonempty: isEmpty("Lean"),
};

if (result.add !== 123n || result.empty !== true || result.nonempty !== false) {
  throw new Error("Lean component returned an unexpected result");
}

console.log(result);
```

Run it on Node 22:

```sh
node index.mjs
```

`add` and `isEmpty` are generated public exports. The package initializes the shared runtime, loads the component, and adapts Lean `Nat`, `String`, and `Bool` behind those calls.

## TypeScript

Install the compiler with lifecycle scripts disabled:

```sh
npm install --save-dev --ignore-scripts --no-audit --no-fund typescript@5.9.3
```

Create `index.ts`:

```ts
import { add, isEmpty } from "onboarding-small";

const sum: bigint = add(20n, 22n);
const empty: boolean = isEmpty("");

if (sum !== 42n || !empty) {
  throw new Error("Lean component returned an unexpected result");
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "skipLibCheck": false,
    "outDir": "dist"
  },
  "include": ["index.ts"]
}
```

Compile and execute the generated JavaScript:

```sh
npx tsc --project tsconfig.json
node dist/index.js
```

The generated declaration for this component contains no public `any`. `Nat` remains `bigint`, so TypeScript rejects a JavaScript `number` at the call site.

## Verify the receipt

Receipt verification is independent of npm's install result. Run it from any directory with access to the checkout and dry-run output:

```sh
node "$LEAN_BRIDGE_CHECKOUT/scripts/verify-component-package-receipt.mjs" \
  --receipt "$LEAN_BRIDGE_RELEASE/component-package-receipt.json"
```

The verifier checks the receipt identity, component identity, shared-runtime requirement, and SHA-256 of both archives. The [plain project acceptance record](evidence/plain-project-package-acceptance.md) records the current call results and retained receipt identity.

## Browser boundary

The browser fixtures execute a real Lean runtime through raw ESM, a module worker, Vite, Rollup, Webpack, and React. The npm archive supplies a browser conditional export. `npm run test:consumer:browser` installs that archive with scripts disabled, bundles an ordinary bare-package import with Vite, and executes Lean in Chromium. See [browser package acceptance](evidence/browser-package-acceptance.md).
