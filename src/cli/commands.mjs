import { diagnostic } from "./contract.mjs";
import { rehearseRelease } from "../release/release-rehearsal.mjs";

const deferred = (command, node) => ({
  status: "blocked",
  result: null,
  diagnostics: [diagnostic({
    code: `${command}-implementation-pending`,
    message: `${command} has a stable CLI contract, but its implementation is not complete`,
    hint: `Complete plan node ${node} before using this command.`,
  })],
  nextActions: [],
});

export const cliHandlers = Object.freeze({
  analyze: async () => deferred("analyze", 877),
  build: async () => deferred("build", 876),
  publish: async request => {
    if (request.mode !== "dry-run") return deferred("publish", 879);
    if (request.bundle === null || request.output === null) {
      return {
        status: "blocked",
        result: null,
        diagnostics: [diagnostic({
          code: "dry-run-input-required",
          message: "publish --dry-run requires --bundle and --output",
          hint: "Build a canonical bundle, then pass its path and an empty local output path.",
        })],
        nextActions: [],
      };
    }
    const rehearsal = await rehearseRelease({ bundleRoot: request.bundle, outputRoot: request.output });
    return {
      status: "ok",
      result: {
        canonicalPublicationIndex: rehearsal.index,
        canonicalPublicationIndexSha256: rehearsal.indexSha256,
        attestation: rehearsal.attestation,
        readyPackages: rehearsal.ready,
        omittedPackages: rehearsal.omitted,
        externalRegistryWrites: false,
      },
      diagnostics: [],
      nextActions: [],
    };
  },
});
