# Container build path

This directory defines the pinned Docker execution path for canonical component builds. The container provides isolation around the same Nix toolchain and build request used by the native engine.

## Directory layout

| Path | Responsibility |
|---|---|
| [`builder/Dockerfile`](builder/Dockerfile) | Creates the minimal builder image from the pinned base and copies the reviewed entrypoint and Nix configuration. |
| [`builder/entrypoint.sh`](builder/entrypoint.sh) | Validates mounted paths and invokes the authorized flake output for a closed engine request. |
| [`builder/manifest.json`](builder/manifest.json) | Records base-image identity, copied-file hashes, mounts, locale, timezone, network posture, and allowed flake outputs. |
| [`builder/nix.conf`](builder/nix.conf) | Configures the Nix behavior available inside the image. |
| [`builder/.dockerignore`](builder/.dockerignore) | Restricts the Docker build context to reviewed inputs. |

## Execution model

```text
closed engine request + read-only project source
                         |
                         v
                 pinned builder image
                         |
                         v
                 locked Nix flake output
                         |
                         v
               declared writable output mount
```

The image does not maintain a second compiler definition. Its entrypoint delegates compilation to the locked Nix closure, which keeps native and Docker engines aligned. The builder manifest makes the remaining container-specific choices reviewable.

Source mounts are read-only. Build output uses an explicit writable mount. Locale, timezone, working directory, user, and permitted environment inputs are fixed because they can otherwise change archive metadata or diagnostics.

## Trust boundary

Only files admitted by the Docker build context and builder manifest become part of the image identity. Project sources enter later through the execution request and declared mount. Registry credentials and publication code do not belong in this image.

The container may isolate a build, but isolation alone does not establish reproducibility. CI compares the complete output inventory from authorized engines and records any byte difference.

## Building and testing

`npm run build:builder-image` validates the manifest and builds the pinned image. Component commands select it through the engine request rather than invoking the Dockerfile directly. The Docker engine tests exercise mount validation, manifest identity, and equivalence with the native request path.

When changing a base image, copied file, mount, or environment setting, update `builder/manifest.json`, regenerate its reviewed hashes, rebuild through the repository command, and compare the complete component output against the native engine.

See the [Docker engine evidence](../docs/evidence/docker-component-engine.md), [native component engine evidence](../docs/evidence/native-component-engine.md), and [toolchain inventory](../docs/evidence/toolchain-inventory.md) for executed paths and pinned identities.
