# Container build path

[`builder`](builder/) defines the pinned Docker execution path used to build canonical artifacts from a read-only source mount.

The builder manifest identifies base images, file hashes, execution mounts, locale, timezone, and authorized flake outputs. The entrypoint delegates compilation to the locked Nix closure instead of maintaining a second toolchain definition.

See the [Docker engine evidence](../docs/evidence/docker-component-engine.md) and [toolchain inventory](../docs/evidence/toolchain-inventory.md).
