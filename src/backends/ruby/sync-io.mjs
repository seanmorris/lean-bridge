/**
 * Generate ordinary Ruby methods over a compiler-authenticated synchronous wire.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { copiedRubyRuntime, rubyLiteral } from "./copied-assets.mjs";
import { isReservedRubyName } from "./copied-model.mjs";
import { verifiedRubyAssets } from "./verified-assets.mjs";

/**
 * Produce a private loader and a public module with distinct IO and EIO exceptions.
 *
 * @param options - Validated gem coordinates, wire descriptors and library digests.
 */
export const generateRubySyncSources = async options => {
	const { name, wire, evidence } = options;
	const slug = name.replaceAll("-", "_"), ns = slug.split("_").map(s => s[0].toUpperCase() + s.slice(1)).join("");
	if(!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u.test(slug) || isReservedRubyName(ns)
		|| ["DeclaredError", "IOError", "BoundaryError", "WrongContext", "Unavailable", "Ok", "Err", "NativeSyncWireV1"].includes(ns))
		throw new TypeError("Invalid or reserved Ruby component namespace");
	const path = "lean_bridge/" + slug, seen = new Set();
	const methods = wire.methods.map((m, i) => {
		const field = isReservedRubyName(m.name) ? m.name + "_" : m.name;
		if(seen.has(field)) throw new TypeError("Ruby export name collides: " + field);
		seen.add(field); return { ...m, field, i, params: m.args.map((_, n) => "v" + n).join(", ") };
	});
	const pub = `# frozen_string_literal: true
module LeanBridge
  module ${ns}
    UNIT = ::Object.new.freeze
    Ok = ::Data.define(:value)
    Err = ::Data.define(:value)
    class BoundaryError < ::StandardError; end
    class WrongContext < BoundaryError; end
    class Unavailable < BoundaryError; end
    class IOError < ::IOError
      attr_reader :declaration
      def initialize(declaration, message)
        @declaration = declaration
        super(message)
      end
    end
    class DeclaredError < ::StandardError
      attr_reader :declaration, :payload
      def initialize(declaration, payload)
        @declaration, @payload = declaration, payload
        super("Lean EIO failed in #{declaration}")
      end
    end
${methods.map(m => `    def self.${m.field}(${m.params})
      raise WrongContext, "Lean calls require the main Ractor and main thread" unless ::Ractor.current.equal?(::Ractor.main) && ::Thread.current.equal?(::Thread.main)
      Native.call${m.i}(${m.params})
    end`).join("\n")}
  end
end
require_relative "${slug}/native"
LeanBridge::${ns}.private_constant :Native
`;
	const native = `# frozen_string_literal: true
require "fiddle"
require "digest/sha2"
require_relative "sync_wire"
module LeanBridge
  module ${ns}
    module Native
${verifiedRubyAssets(evidence)}
      P = ::Fiddle::TYPE_VOIDP
      CLEAR = ::Fiddle::Function.new(LIBRARY[${rubyLiteral(wire.clear)}], [P], ::Fiddle::TYPE_VOID)
${methods.map(m => `      CALL${m.i} = ::Fiddle::Function.new(LIBRARY[${rubyLiteral(m.symbol)}], [P, P, P], ::Fiddle::TYPE_INT)
      def self.call${m.i}(${m.params})
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise WrongContext, reason
        end
        NativeSyncWireV1.call(::LeanBridge::${ns}, CALL${m.i}, CLEAR, ${rubyLiteral(m.declaration)}, ${rubyLiteral(m.args)}, ${rubyLiteral(m.result)}, ${m.error ? rubyLiteral(m.error) : "nil"}, ${rubyLiteral(m.effect)}, ${m.tagBytes}, [${m.params}])
      end`).join("\n")}
    end
  end
end
`;
	const helper = (await readFile(new URL("sync-wire.rb", import.meta.url), "utf8")).replace("LeanBridge::GeneratedSyncComponent", "LeanBridge::" + ns);
	return { namespace: "LeanBridge::" + ns, requirePath: path
		, files: { [`lib/${path}.rb`]: pub, [`lib/${path}/native.rb`]: native
			, "lib/lean_bridge/native_copied_runtime_v1.rb": copiedRubyRuntime
			, [`lib/${path}/sync_wire.rb`]: helper } };
};
