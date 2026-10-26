/**
 * Authenticated, process-wide loading shared by copied and owned Ruby APIs.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";

const literal = value => JSON.stringify(value).replaceAll("#", "\\#");

/**
 * Keep Lean and private GMP bindings independent of Ruby's system GMP hooks.
 * The same registry and loading policy apply regardless of package order.
 *
 * @param evidence - Compiler-authenticated native identities, or null.
 */
export const verifiedRubyAssets = evidence => {
	if(!evidence) return '      raise LoadError, "Build a compiled RubyGems release before calling this API"\n';
	const names = Object.keys(evidence.libraries ?? {}).sort();
	if(!/^[a-f0-9]{64}$/u.test(evidence.runtimeIdentity) || typeof evidence.componentId !== "string"
		|| !["libleanshared.so", "liblean_bridge_native.so", evidence.library].every(name => names.includes(name))
		|| names.includes("libgmp.so.10")
		|| names.some(name => !/^[A-Za-z0-9_-]+\.so(?:\.[0-9]+)*$/u.test(name) || !/^[a-f0-9]{64}$/u.test(evidence.libraries[name])))
		throw new TypeError("Invalid authenticated Ruby native library evidence");
	const libraries = `{${names.map(name => `${literal(name)} => ${literal(evidence.libraries[name])}`).join(", ")}}`;
	return `      raise LoadError, "This Lean package requires MRI Ruby 3.3 on Linux x86-64" unless RUBY_ENGINE == "ruby" && RUBY_VERSION.start_with?("3.3.") && RUBY_PLATFORM.include?("x86_64-linux") && ::Fiddle::SIZEOF_VOIDP == 8 && [1].pack("I") == [1].pack("L<")
      raise LoadError, "Lean packages cannot be loaded from another Ractor" unless ::Ractor.current.equal?(::Ractor.main)
      require "lean_bridge/native_copied_runtime_v1"
      if (reason = NativeCopiedRuntimeV1.context_error)
        raise LoadError, reason
      end
      root = ::File.expand_path("native/linux-x64", __dir__)
      [::File.dirname(root), root].each do |directory|
        raise LoadError, "Native library directory must be a regular directory" unless ::File.lstat(directory).directory?
      end
      libraries = ${libraries}.freeze
      libraries.each do |name, expected|
        path = ::File.join(root, name)
        raise LoadError, "Native library differs from compiled evidence: #{name}" unless ::File.lstat(path).file? && ::Digest::SHA256.file(path).hexdigest == expected
      end
      LIBRARY = ::Thread.handle_interrupt(::Object => :never) do
        NativeCopiedRuntimeV1::LOCK.synchronize do
          state = NativeCopiedRuntimeV1::STATE
          raise LoadError, "Lean native loading failed earlier" if state[:failed]
          identity = ${literal(evidence.runtimeIdentity)}
          component = ${literal(evidence.componentId)}
          receipt = ${literal(sha256(canonicalJson(evidence)))}
          policy = "linux-x64-deepbind-v1"
          raise LoadError, "Incompatible Lean runtime identities" if state[:identity] && state[:identity] != identity
          raise LoadError, "Incompatible Lean native loading policy" if state[:identity] && state[:policy] != policy
          known = state[:libraries] ||= {}
          libraries.each do |name, expected|
            raise LoadError, "Conflicting builds of the same native library: #{name}" if known[name] && known[name][:sha256] != expected
          end
          previous = state[:components][component]
          raise LoadError, "Conflicting builds of the same Lean component" if previous && previous[:receipt] != receipt
          begin
            unless previous
              # RTLD_NOLOAD rejects unverified preloads before any new load.
              libraries.each_key do |name|
                next if known[name]
                [name, ::File.join(root, name)].each do |candidate|
                  handle = begin
                    ::Fiddle::Handle.new(candidate, ::Fiddle::RTLD_NOW | 4)
                  rescue ::Fiddle::DLError
                    nil
                  end
                  # glibc can return NULL without dlerror for RTLD_NOLOAD.
                  # Fiddle then returns a null Handle, which must not be closed.
                  if handle && !handle.to_i.zero?
                    handle.close
                    raise LoadError, "Unverified native library is already loaded: #{name}"
                  end
                end
              end
              # glibc RTLD_DEEPBIND gives each verified dependency its own
              # symbols before the Ruby process's existing global symbols.
              flags = ::Fiddle::RTLD_NOW | ::Fiddle::RTLD_GLOBAL | 8
              order = ["libleanshared.so", "liblean_bridge_native.so"]
              order << "libgmp-lean-bridge.so.10" if libraries.key?("libgmp-lean-bridge.so.10")
              order.concat(libraries.keys.reject { |name| order.include?(name) || name == ${literal(evidence.library)} })
              order << ${literal(evidence.library)}
              order.each do |name|
                next if known[name]
                handle = ::Fiddle::Handle.new(::File.join(root, name), flags)
                state[:handles] << handle
                known[name] = { sha256: libraries.fetch(name), handle: handle }
              end
              previous = { receipt: receipt, library: known.fetch(${literal(evidence.library)}).fetch(:handle) }
              state[:components][component] = previous
              state[:identity], state[:policy] = identity, policy
            end
            previous[:library]
          rescue ::Exception
            state[:failed] = true
            raise
          end
        end
      end
`;
};
