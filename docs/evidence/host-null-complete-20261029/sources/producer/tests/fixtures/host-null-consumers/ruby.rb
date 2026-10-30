# frozen_string_literal: true
# Independent HostNull consumer for an installed, source-free Ruby gem.
require "json"
require "lean_bridge/host_null_demo"

API = LeanBridge::HostNullDemo
None_ = API::None
Some = API::Some
$checks = 0

def check(value, message = "")
  $checks += 1
  raise "HostNull check #{$checks}: #{message}" unless value
end

def rejects(kind)
  begin
    yield
  rescue kind => error
    check(true)
    return error
  end
  raise "Expected #{kind}"
end

check(API.echo(nil).nil?, "direct null")
check(API.echo(42) == 42, "direct value")
check(API.nullable_option(nil).nil?, "nullable Option outer null")
check(API.nullable_option(None_.new).instance_of?(None_), "nullable Option none")
check(API.nullable_option(Some.new(42)) == Some.new(42), "nullable Option value")
check(API.optional_nullable(None_.new).instance_of?(None_), "optional nullable none")
check(API.optional_nullable(Some.new(nil)) == Some.new(nil), "optional nullable null")
check(API.optional_nullable(Some.new(42)) == Some.new(42), "optional nullable value")
check(API.nullable_option(nil).nil? && API.nullable_option(None_.new).instance_of?(None_),
  "HostNull null differs from Option.none")
check(API.optional_nullable(None_.new).instance_of?(None_) &&
  API.optional_nullable(Some.new(nil)) == Some.new(nil),
  "Option.none differs from Some HostNull.null")

packet = API::Packet.new(direct: nil, nullable_option: None_.new,
  optional_nullable: Some.new(nil))
echoed = API.echo_packet(packet)
check(echoed == packet, "record equality")
check(!echoed.equal?(packet), "record copied")
check(echoed.direct.nil?, "record direct field")
check(echoed.nullable_option.instance_of?(None_), "record nullable Option field")
check(echoed.optional_nullable == Some.new(nil), "record optional nullable field")

check(API.call_host(nil) { |value|
  check(value.nil?, "callback null parameter")
  None_.new
}.instance_of?(None_), "callback tagged result")
check(API.call_host(42) { |value|
  check(value == 42, "callback value parameter")
  Some.new(43)
} == Some.new(43), "callback value result")
check(API.call_host(0) { |value|
  check(value == 0, "callback zero parameter")
  nil
}.nil?, "callback outer null result")
marker = RuntimeError.new("host callback marker")
check(rejects(RuntimeError) { API.call_host(nil) { raise marker } }.equal?(marker),
  "callback exception identity")

closure = API.make_closure(Some.new(77))
check(closure.instance_of?(API::LeanClosure) && !closure.closed?, "open closure")
check(closure.call(nil) == Some.new(77), "closure null parameter")
check(closure.call(2) == Some.new(77), "closure value parameter")
alias_ = closure
check(alias_.equal?(closure), "closure identity")
closure.close
closure.close
check(closure.closed?, "idempotent closure close")
rejects(API::LeanBridgeError) { alias_.call(nil) }

rejects(TypeError) { API.echo(false) }
rejects(TypeError) { API.nullable_option(Some.new(nil)) }
rejects(TypeError) { API.optional_nullable(nil) }
rejects(TypeError) { API.echo_packet(API::Packet.new(direct: false,
  nullable_option: None_.new, optional_nullable: None_.new)) }
rejects(TypeError) { API.call_host(nil, nil) }
rejects(TypeError) { API.call_host(nil) { false } }
rejects(TypeError) { API.make_closure(Some.new(nil)) }

spec = Gem.loaded_specs.fetch("host-null-demo-api")
puts JSON.generate(checks: $checks, api: API.method(:echo).source_location.fetch(0),
  gem_root: spec.full_gem_path, ruby: RUBY_DESCRIPTION)
