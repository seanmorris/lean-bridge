ARG NIX_IMAGE=nixos/nix@sha256:4bfe741027f0bfbef745862cbf3b5f424ee99801c04138146c0000a28759636d
ARG DEBIAN_IMAGE=debian@sha256:abd67ffcfa541b485a3dff59865ab629aa048a6c613e639d36e7456b0b229241

FROM ${NIX_IMAGE} AS nix
FROM ${DEBIAN_IMAGE}

COPY --from=nix /nix /nix
COPY --chmod=0555 entrypoint.sh /usr/local/bin/lean-bridge-builder
COPY nix.conf /etc/nix/nix.conf

ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV TZ=UTC
ENV PATH=/nix/var/nix/profiles/default/bin:/usr/bin:/bin
ENV SSL_CERT_FILE=/nix/var/nix/profiles/default/etc/ssl/certs/ca-bundle.crt
ENV GIT_SSL_CAINFO=/nix/var/nix/profiles/default/etc/ssl/certs/ca-bundle.crt
ENV NIX_SSL_CERT_FILE=/nix/var/nix/profiles/default/etc/ssl/certs/ca-bundle.crt

WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/lean-bridge-builder"]
CMD ["build"]
