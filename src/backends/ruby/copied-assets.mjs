/**
 * Render verified process-wide native loading for installed ordinary gems.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";

/**
 * Quote Ruby data without allowing string interpolation.
 *
 * @param value - String or array of strings embedded in generated Ruby.
 */
export const rubyLiteral = value => JSON.stringify(value).replaceAll("#", "\\#");

/**
 * Bind compiled native identities into the generated loader.
 *
 * @param model - Closed Ruby projection.
 * @param evidence - Optional verified native library evidence.
 */
export const copiedRubyAssets = (model, evidence) => !evidence ? '      raise LoadError, "Build a compiled RubyGems release before calling this API"\n' : `      raise LoadError, "This Lean package requires MRI Ruby 3.3 on Linux x86-64" unless RUBY_ENGINE == "ruby" && RUBY_VERSION.start_with?("3.3.") && RUBY_PLATFORM.include?("x86_64-linux") && ::Fiddle::SIZEOF_VOIDP == 8 && [1].pack("I") == [1].pack("L<")
      root = ::File.expand_path("native/linux-x64", __dir__)
      libraries = ${JSON.stringify(evidence.libraries).replaceAll(":", " => ")}
      libraries.each do |name, expected|
        path = ::File.join(root, name)
        raise LoadError, "Native library differs from compiled evidence: #{name}" unless ::File.lstat(path).file? && ::Digest::SHA256.file(path).hexdigest == expected
      end
      require "lean_bridge/native_copied_runtime_v1"
      LIBRARY = NativeCopiedRuntimeV1::LOCK.synchronize do
        state = NativeCopiedRuntimeV1::STATE
        raise LoadError, "Lean native loading failed earlier" if state[:failed]
        identity = ${rubyLiteral(evidence.runtimeIdentity)}
        component = ${rubyLiteral(evidence.componentId)}
        receipt = ${rubyLiteral(sha256(canonicalJson(evidence)))}
        raise LoadError, "Incompatible Lean runtime identities" if state[:identity] && state[:identity] != identity
        previous = state[:components][component]
        raise LoadError, "Conflicting builds of the same Lean component" if previous && previous[:receipt] != receipt
        begin
          unless previous
            flags = ::Fiddle::RTLD_NOW | ::Fiddle::RTLD_GLOBAL
            unless state[:identity]
              state[:handles] << ::Fiddle::Handle.new(::File.join(root, "libleanshared.so"), flags)
              state[:handles] << ::Fiddle::Handle.new(::File.join(root, "liblean_bridge_native.so"), flags)
              state[:identity] = identity
            end
            state[:handles] << ::Fiddle::Handle.new(::File.join(root, ${rubyLiteral(Object.keys(evidence.libraries).find(name => name !== evidence.library && !["libleanshared.so","liblean_bridge_native.so"].includes(name)))}), flags)
            library = ::Fiddle::Handle.new(::File.join(root, ${rubyLiteral(evidence.library)}), flags)
            state[:handles] << library
            previous = { receipt: receipt, library: library }
            state[:components][component] = previous
          end
          previous[:library]
        rescue Exception
          state[:failed] = true
          raise
        end
      end
`;
