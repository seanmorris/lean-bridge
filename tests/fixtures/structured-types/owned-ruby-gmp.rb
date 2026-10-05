require "fiddle"
require "json"
Process.setrlimit(Process::RLIMIT_CORE, 0)

root, lean_path = ARGV
deep = Fiddle::RTLD_NOW | Fiddle::RTLD_GLOBAL | 8 # glibc RTLD_DEEPBIND
system = Fiddle::Handle.new("libgmp.so.10", Fiddle::RTLD_NOW | 4) # RTLD_NOLOAD
read_pointer = ->(address) { Fiddle::Pointer.new(address)[0, 8].unpack1("Q<") }
version = ->(handle) { Fiddle::Pointer.new(read_pointer.call(handle["__gmp_version"])).to_s }
allocator_names = ["__gmp_allocate_func", "__gmp_reallocate_func", "__gmp_free_func"]
allocators = ->(handle) { allocator_names.map { |name| read_pointer.call(handle[name]) } }
ruby_allocators = allocators.call(system)

# First prove the failure mode with the same linked library, then unload it.
shallow = Fiddle::Handle.new(File.join(root, "libprobe.so"), Fiddle::RTLD_NOW)
where = Fiddle::Function.new(shallow["probe_gmp_path"], [], Fiddle::TYPE_VOIDP, need_gvl: true)
interposed = where.call.to_s == system.file_name
shallow.close
raise "Expected ordinary loading to use host GMP" unless interposed

bundled = Fiddle::Handle.new(File.join(root, "libgmp-lean-bridge.so.10"), deep)
lean = Fiddle::Handle.new(lean_path, deep)
bridge = Fiddle::Handle.new(File.join(root, "libprobe.so"), deep)
where = Fiddle::Function.new(bridge["probe_gmp_path"], [], Fiddle::TYPE_VOIDP, need_gvl: true)
private_path = where.call.to_s
raise "Bridge still resolves host GMP: #{private_path}" unless private_path == bundled.file_name
raise "Private GMP adopted Ruby allocators" unless allocators.call(bundled).zip(ruby_allocators).all? { |a, b| a != b }
raise "Lean adopted Ruby allocators" unless allocators.call(lean).zip(ruby_allocators).all? { |a, b| a != b }

invoke = Fiddle::Function.new(bridge["probe_integer"], [Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP, Fiddle::TYPE_SIZE_T], Fiddle::TYPE_INT, need_gvl: true)
output = Fiddle::Pointer.malloc(16384, Fiddle::RUBY_FREE)
begin
  500.times do |index|
    value = (1 << (1024 + index)) + index
    value = -value if index.odd?
    input = "#{value}\0"
    raise "Native arithmetic failed" unless invoke.call(input, output, 16384).zero?
    raise "Incorrect integer round trip" unless output.to_s.to_i == value * 7 + 11
    # Exercise Ruby's own GMP path after each bridge allocation/release.
    raise "Ruby GMP failed" unless (value * value).div(value) == value
    GC.start if index % 50 == 0
  end
ensure
  output.call_free
end
raise "Ruby allocators changed" unless allocators.call(system) == ruby_allocators
puts JSON.generate({ ruby: RUBY_DESCRIPTION, hostVersion: version.call(system), bundledVersion: version.call(bundled),
  interposedWithoutDeepBind: interposed, privateWithDeepBind: true, rubyAllocatorsUnchanged: true,
  privateAllocatorsIndependent: true, leanAllocatorsIndependent: true, roundTrips: 500 })
