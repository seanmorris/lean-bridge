# Synthetic nested caller controls only. No Lean compilation or installed acceptance.
require "json"
raise "expected caller path and optional generated values" unless [1, 2].include?(ARGV.length)
load ARGV.fetch(0)
if ARGV.length == 2
  source = File.read(ARGV.fetch(1), encoding: "UTF-8")
  require_line = 'require_relative "nestedcheckedrecords/native"' + "\n"
  private_line = 'LeanBridge::Nestedcheckedrecords.private_constant :Native' + "\n"
  raise "unexpected generated loader boundary" unless source.scan(require_line).length == 1 && source.scan(private_line).length == 1
  eval(source.sub(require_line, "").sub(private_line, ""), TOPLEVEL_BINDING, ARGV.fetch(1))
  GENERATED_NESTED_VALUES = LeanBridge::Nestedcheckedrecords
end

RESULT_FAULTS = ["produce-offset", "produce-array-length", "produce-frozen-array",
                 "produce-bare-packet", "accept-true", "wrong-host-exception"].freeze
RESULT_ONLY_FAULTS = ["inputs-exported"].freeze
INPUT_FAULTS = ["missing-fin", "fin-after-constructor", "missing-normalization",
                "conflated-constructor", "diagnostic-suffix", "wrong-error-class", "wrong-path",
                "wrong-choice", "except-swapped", "holder-tag", "echo-normalizes", "echo-aliases-input",
                "echo-swapped-fields", "mutate-accepted-input", "mutate-rejected-input",
                "list-as-array", "lean-host-message"].freeze

def nested_record(owner, name, fields, parent = Object)
  owner.const_set(name, Class.new(parent) do
    attr_reader(*fields)
    define_method(:initialize) do |**values|
      raise "unexpected constructor fields" unless values.keys.sort == fields.sort
      fields.each { |field| instance_variable_set(:"@#{field}", values.fetch(field)) }
      freeze
    end
  end)
end

def nested_model(result_only = false, prefix = "arg", fault = nil)
  api = Module.new
  full_surface = !result_only || fault == "inputs-exported"
  if defined?(GENERATED_NESTED_VALUES)
    names = full_surface ? [:Packet, :Holder, :Choice, :Some, :Ok, :Err] : [:Packet, :Some]
    names.each { |name| api.const_set(name, GENERATED_NESTED_VALUES.const_get(name)) }
  else
    nested_record(api, :Packet, [:digit, :word])
    api.const_set(:Some, Data.define(:value))
    if full_surface
      nested_record(api, :Holder, [:packet, :tag])
      choice = api.const_set(:Choice, Class.new)
      nested_record(choice, :Empty, [], choice)
      nested_record(choice, :Packet, [:value], choice)
      [:Ok, :Err].each { |name| api.const_set(name, Data.define(:value)) }
    end
  end
  packet = api.const_get(:Packet)
  some = api.const_get(:Some)
  host = lambda do |kind, message|
    raise(fault == "wrong-host-exception" ? StandardError : kind, fault == "lean-host-message" ? "#{prefix}0 was rejected by NestedCheckedRecords.mkPacket" : message)
  end
  natural = lambda do |value|
    host.call(TypeError, "Expected Integer") unless value.instance_of?(Integer) || (fault == "accept-true" && value.equal?(true))
    value = 1 if value.equal?(true)
    host.call(RangeError, "Nat cannot be negative") if value.negative?
    value
  end
  shaped = lambda do |value|
    host.call(TypeError, "Expected Packet") unless value.instance_of?(packet)
    natural.call(value.digit); natural.call(value.word); value
  end
  sequence = lambda do |values|
    host.call(TypeError, "Expected Array") unless values.instance_of?(Array)
    values.each { |item| shaped.call(item) }; values
  end
  reject = lambda do |message|
    suffix = fault == "diagnostic-suffix" ? "." : ""
    raise(fault == "wrong-error-class" ? ArgumentError : RangeError, message + suffix)
  end
  # Fin 10 digit, then the word constructor, then the packet constructor.
  accept = lambda do |value, path, site|
    packet_choice, word_choice = site
    digit, word = value.digit, value.word
    reject.call("#{path}.digit is not below its Fin 10 bound") if !["missing-fin", "fin-after-constructor"].include?(fault) && digit >= 10
    word_choice = :mk if fault == "missing-normalization"
    reject.call("#{path}.word was rejected by NestedCheckedRecords.mkWord") if word_choice == :mk && word.zero?
    word += 1 if word_choice == :normalize
    reject.call("#{path}.digit is not below its Fin 10 bound") if fault == "fin-after-constructor" && digit >= 10
    packet_choice = :mk if fault == "conflated-constructor"
    reject.call("#{path} was rejected by NestedCheckedRecords.mkPacket") if packet_choice == :mk && digit > word
    packet_choice == :normalize ? digit + 1 : word
  end
  total = lambda do |values, site|
    values.each_with_index.sum { |item, index| accept.call(item, fault == "wrong-path" ? "#{prefix}0.#{index}" : "#{prefix}0[#{index}]", site) }
  end
  mutate = ->(values) { values[0] = packet.new(digit: 9, word: 9) if values.instance_of?(Array) && !values.empty? }
  produced = ->(value, offset) { packet.new(digit: 0, word: natural.call(value) + offset + (fault == "produce-offset" ? 1 : 0)) }
  api.define_singleton_method(:produce_option) do |value|
    item = produced.call(value, 1)
    fault == "produce-bare-packet" ? item : some.new(item)
  end
  api.define_singleton_method(:produce_array) do |value|
    items = [produced.call(value, 1), produced.call(value, 2)]
    items.pop if fault == "produce-array-length"
    fault == "produce-frozen-array" ? items.freeze : items
  end
  return api unless full_surface

  holder = api.const_get(:Holder)
  choice_empty, choice_packet = [:Empty, :Packet].map { |name| api.const_get(:Choice).const_get(name) }
  ok, err = [:Ok, :Err].map { |name| api.const_get(name) }

  api.define_singleton_method(:first) { |value| accept.call(shaped.call(value), "#{prefix}0", [:mk, :mk]) }
  api.define_singleton_method(:second) { |value| accept.call(shaped.call(value), "#{prefix}0", [:normalize, :normalize]) }
  api.define_singleton_method(:pair) do |left, right|
    shaped.call(left); shaped.call(right)
    accept.call(left, "#{prefix}0", [:mk, :mk]) + accept.call(right, "#{prefix}1", [:normalize, :normalize])
  end
  api.define_singleton_method(:in_array) do |values|
    sequence.call(values)
    begin
      result = total.call(values, [:mk, :mk])
    rescue RangeError, ArgumentError
      mutate.call(values) if fault == "mutate-rejected-input"
      raise
    end
    mutate.call(values) if fault == "mutate-accepted-input"
    result
  end
  api.define_singleton_method(:in_list) do |values|
    total.call(sequence.call(values), fault == "list-as-array" ? [:mk, :mk] : [:normalize, :normalize])
  end
  api.define_singleton_method(:in_option) do |value|
    host.call(TypeError, "Option requires nil or Some(value)") unless value.nil? || value.instance_of?(some)
    value.nil? ? 0 : accept.call(shaped.call(value.value), "#{prefix}0?", [:mk, :normalize])
  end
  api.define_singleton_method(:in_product) do |value|
    host.call(TypeError, "Prod requires a two-element Array") unless value.instance_of?(Array)
    host.call(ArgumentError, "Prod requires exactly two elements") unless value.length == 2
    left, right = shaped.call(value[0]), shaped.call(value[1])
    accept.call(left, "#{prefix}0.0", [:mk, :mk]) + accept.call(right, "#{prefix}0.1", [:normalize, :normalize])
  end
  api.define_singleton_method(:in_except) do |value|
    host.call(TypeError, "Result requires Ok(value) or Err(error)") unless value.instance_of?(ok) || value.instance_of?(err)
    success = value.instance_of?(ok) != (fault == "except-swapped")
    accept.call(shaped.call(value.value), "#{prefix}0.#{success ? 'ok' : 'error'}", success ? [:normalize, :mk] : [:mk, :normalize])
  end
  api.define_singleton_method(:in_holder) do |value|
    host.call(TypeError, "Expected Holder") unless value.instance_of?(holder)
    tag = natural.call(value.tag)
    word = accept.call(shaped.call(value.packet), "#{prefix}0.packet", [:normalize, :mk])
    word + (fault == "holder-tag" ? 0 : tag)
  end
  api.define_singleton_method(:in_choice) do |value|
    if value.instance_of?(choice_empty)
      fault == "wrong-choice" ? 1 : 0
    else
      host.call(TypeError, "Expected an exact Choice constructor") unless value.instance_of?(choice_packet)
      accept.call(shaped.call(value.value), "#{prefix}0.packet.value", [:mk, :normalize])
    end
  end
  api.define_singleton_method(:echo_array) do |values|
    total.call(sequence.call(values), [:mk, :mk])
    next values if fault == "echo-aliases-input"
    items = values.map { |item| fault == "echo-swapped-fields" ? packet.new(digit: item.word, word: item.digit) : item }
    items[0] = packet.new(digit: items[0].digit, word: 1) if fault == "echo-normalizes" && !items.empty?
    items
  end
  api
end

results = []
[false, true].each do |result_only|
  ["arg", "value"].each do |prefix|
    actual = check_nested_checked_records(nested_model(result_only, prefix), result_only, 256, prefix)
    results << actual.merge(resultOnly: result_only, parameterPrefix: prefix)
  end
end
rejected = {}
[["full", false, RESULT_FAULTS + INPUT_FAULTS], ["result-only", true, RESULT_FAULTS + RESULT_ONLY_FAULTS]].each do |mode, result_only, faults|
  rejected[mode] = faults.select do |fault|
    begin
      check_nested_checked_records(nested_model(result_only, "arg", fault), result_only, 2)
      raise "caller accepted #{mode} fault: #{fault}"
    rescue RuntimeError => error
      raise if error.message.start_with?("caller accepted")
      raise "wrong failure for #{fault}: #{error.message}" unless error.message.start_with?("failed: ")
      true
    end
  end
end
puts JSON.generate({results: results, rejectedFaults: rejected, generatedValueClasses: ARGV.length == 2, installedAcceptance: false})
