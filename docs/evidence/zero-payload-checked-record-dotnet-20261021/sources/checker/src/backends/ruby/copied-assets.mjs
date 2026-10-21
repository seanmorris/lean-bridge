/**
 * Render verified process-wide native loading for installed ordinary gems.
 *
 * @file
 */
import { verifiedRubyAssets } from "./verified-assets.mjs";

/**
 * Quote Ruby data without allowing string interpolation.
 *
 * @param value - String or array of strings embedded in generated Ruby.
 */
export const rubyLiteral = value => JSON.stringify(value).replaceAll("#", "\\#");

export const copiedRubyRuntime = `# frozen_string_literal: true
module LeanBridge
  module NativeCopiedRuntimeV1
    PID = ::Process.pid
    LOCK = ::Mutex.new
    STATE = { components: {}, handles: [] }
    def self.context_error
      return "Lean packages cannot be used from another Ractor" unless ::Ractor.current.equal?(::Ractor.main)
      return "Lean packages cannot be used after fork; start a fresh process" unless ::Process.pid == PID
      nil
    end
  end
  private_constant :NativeCopiedRuntimeV1
end
`;

/**
 * Bind compiled native identities into the generated loader.
 *
 * @param model - Closed Ruby projection.
 * @param evidence - Optional verified native library evidence.
 */
export const copiedRubyAssets = (model, evidence) => verifiedRubyAssets(evidence);
