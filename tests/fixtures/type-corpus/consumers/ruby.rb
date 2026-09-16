# Exercise only public APIs installed from the prepared corpus gem.
require "json"

def check(value, message = "Corpus assertion failed")
  raise message unless value
end

def decode(value, api)
  return Integer(value.fetch("integer"), 10) if value.key?("integer")
  return value.fetch("string") if value.key?("string")
  return value.fetch("bool") if value.key?("bool")
  return api::UNIT if value.key?("unit")
  return value.fetch("bytes").pack("C*") if value.key?("bytes")
  ["float32", "float64"].each do |kind|
    next unless value.key?(kind)
    return Float::NAN if value[kind] == "nan"
    format, integer = kind == "float32" ? ["e", "L<"] : ["E", "Q<"]
    return [Integer(value[kind], 10)].pack(integer).unpack1(format)
  end
  return value.fetch("array").map { |item| decode(item, api) } if value.key?("array")
  if value.key?("record")
    fields = value.fetch("fields").to_h { |key, item| [key.to_sym, decode(item, api)] }
    return api.const_get(value.fetch("record")).new(**fields)
  end
  raise "Unknown corpus wire value"
end

def record_fields(value, api)
  RECORD_FIELDS.each do |name, fields|
    return fields if value.instance_of?(api.const_get(name))
  end
  nil
end

def encode(value, api, encoding = "value")
  if ["float32", "float64"].include?(encoding)
    check(value.instance_of?(Float))
    format, integer = encoding == "float32" ? ["e", "L<"] : ["E", "Q<"]
    bits = value.nan? ? "nan" : [value].pack(format).unpack1(integer).to_s
    return {encoding => bits}
  end
  return {"unit" => true} if value.equal?(api::UNIT)
  return {"bool" => value} if value.equal?(true) || value.equal?(false)
  return {"integer" => value.to_s} if value.instance_of?(Integer)
  if value.instance_of?(String)
    return value.encoding == Encoding::BINARY ? {"bytes" => value.bytes} : {"string" => value}
  end
  return {"array" => value.map { |item| encode(item, api) }} if value.instance_of?(Array)
  fields = record_fields(value, api)
  if fields
    return {"record" => value.class.name.split("::").last,
            "fields" => fields.to_h { |field| [field, encode(value.public_send(field), api)] }}
  end
  raise "Unexpected public API result type: #{value.class}"
end

def clear_arrays(value, api)
  if value.instance_of?(Array)
    value.each { |child| clear_arrays(child, api) }
    value.clear
  elsif (fields = record_fields(value, api))
    fields.each { |field| clear_arrays(value.public_send(field), api) }
  end
end

request = JSON.parse(File.read(ARGV.fetch(0), encoding: Encoding::UTF_8))
RECORD_FIELDS = request.fetch("recordFields").freeze
gem request.fetch("distribution"), request.fetch("version")
require request.fetch("require")
api = Object.const_get(request.fetch("module"))
operations = request.fetch("operations")
spec = Gem.loaded_specs.fetch(request.fetch("distribution"))
installed = File.realpath(spec.full_gem_path)
check(installed.start_with?(File.realpath(ENV.fetch("GEM_HOME")) + "/"))
source = api.method(operations.values.first).source_location.fetch(0)
check(File.realpath(source).start_with?(installed + "/"))
baseline = request.fetch("cases").first
results = request.fetch("cases").map do |entry|
  args = entry.fetch("arguments").map { |value| decode(value, api) }
  operation = operations.fetch(entry.fetch("operation"))
  if entry.fetch("expectation").fetch("kind") == "host-rejection"
    caught = nil
    begin
      api.public_send(operation, *args)
    rescue StandardError => error
      caught = error.class.name
    end
    check(caught == request.fetch("errors").fetch(entry.fetch("expectation").fetch("category")), entry.fetch("id"))
    recovered = api.public_send(operations.fetch(baseline.fetch("operation")),
                                *baseline.fetch("arguments").map { |value| decode(value, api) })
    check(encode(recovered, api) == request.fetch("oracle").fetch(baseline.fetch("oracleKey")))
    next {"id" => entry.fetch("id"), "status" => "rejected-as-expected", "exception" => caught, "recovered" => true}
  end
  result = api.public_send(operation, *args)
  observed = encode(result, api, entry.fetch("resultEncoding"))
  check(observed == request.fetch("oracle").fetch(entry.fetch("oracleKey")), entry.fetch("id"))
  if entry.fetch("checkIndependentCopy")
    check(!result.equal?(args.first) && result.frozen?)
    clear_arrays(args.first, api)
    check(encode(result, api) == observed)
  end
  {"id" => entry.fetch("id"), "status" => "matched", "observed" => observed,
   "independentCopy" => entry.fetch("checkIndependentCopy")}
end
puts JSON.generate({"schemaVersion" => 1, "profile" => "ruby", "module" => request.fetch("module"),
                    "hostVersion" => RUBY_VERSION, "results" => results})
