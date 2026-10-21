# frozen_string_literal: true

# Independent model used only to exercise the immutable zero-payload Ruby
# caller. It does not share generated binding code, native conversion code, or
# package files.
module ZeroPayloadRubyModel
  module_function

  def record_class(*fields)
    Class.new do
      attr_reader(*fields)
      define_method(:initialize) do |**values|
        raise ArgumentError, "unexpected record fields" unless values.keys.sort == fields.sort
        fields.each { |field| instance_variable_set(:"@#{field}", values.fetch(field)) }
        freeze
      end
      define_method(:==) do |other|
        other.instance_of?(self.class) &&
          fields.all? { |field| instance_variable_get(:"@#{field}") == other.instance_variable_get(:"@#{field}") }
      end
      alias_method :eql?, :==
      define_method(:hash) { [self.class, *fields.map { |field| instance_variable_get(:"@#{field}") }].hash }
    end
  end

  def exact(value, kind)
    raise TypeError, "Expected #{kind}" unless value.instance_of?(kind)
    value
  end

  def nat(value)
    raise TypeError, "Expected Integer" unless value.instance_of?(Integer)
    raise RangeError, "Nat cannot be negative" if value.negative?
    value
  end

  def boolean(value)
    raise TypeError, "Expected true or false" unless value.equal?(true) || value.equal?(false)
    value
  end

  def build_api(result_only, prefix, fault = nil)
    api = Module.new
    unit = Object.new.freeze
    witness = record_class
    token = record_class(:tag)
    marker = record_class
    mark = Class.new
    blank = Class.new(mark) { define_method(:initialize) { freeze }; define_method(:==) { |o| o.instance_of?(self.class) } }
    marked = record_class(:witness)
    some = Data.define(:value)
    mark.const_set(:Blank, blank)
    mark.const_set(:Marked, marked)
    { Witness: witness, Token: token, Marker: marker, Mark: mark, Some: some, UNIT: unit }.each do |name, kind|
      api.const_set(name, kind)
    end
    witness_input = lambda do |value|
      next value if fault == "host-accepts-nil" && value.nil?
      ZeroPayloadRubyModel.exact(value, witness)
    end
    unit_input = lambda do |value|
      raise TypeError, "Expected UNIT" unless value.equal?(unit)
      value
    end
    api.define_singleton_method(:produce_witness) { fault == "wrong-produced" ? marker.new : witness.new }
    api.define_singleton_method(:produce_token) { token.new(tag: unit) }
    api.define_singleton_method(:witnesses) do |count|
      length = ZeroPayloadRubyModel.nat(count)
      length -= 1 if fault == "array-length" && length.positive?
      Array.new(length) { witness.new }
    end
    api.define_singleton_method(:maybe_witness) do |present|
      next nil unless ZeroPayloadRubyModel.boolean(present)
      fault == "option-collapsed" ? witness.new : some.new(value: witness.new)
    end
    api.define_singleton_method(:produce_marker) { marker.new }
    api.define_singleton_method(:produce_mark) do |active|
      ZeroPayloadRubyModel.boolean(active) ? marked.new(witness: witness.new) : blank.new
    end
    if !result_only || fault == "inputs-exported"
      api.define_singleton_method(:witness_count) { |value| witness_input.call(value); 1 }
      api.define_singleton_method(:absent_count) do |value|
        witness_input.call(value)
        next 0 if fault == "accept-invalid"
        message_prefix = fault == "wrong-message" ? "wrong" : prefix
        error = fault == "wrong-status" ? TypeError : RangeError
        raise error, "#{message_prefix}0 was rejected by ZeroPayloadCheckedRecords.mkAbsent"
      end
      api.define_singleton_method(:token_tag) { |value| unit_input.call(ZeroPayloadRubyModel.exact(value, token).tag) }
      api.define_singleton_method(:marker_count) { |value| ZeroPayloadRubyModel.exact(value, marker); 0 }
      api.define_singleton_method(:mark_count) do |value|
        next 0 if value.instance_of?(blank)
        if value.instance_of?(marked)
          ZeroPayloadRubyModel.exact(value.witness, witness)
          next 1
        end
        raise TypeError, "Expected an exact Mark constructor"
      end
    end
    api.singleton_class.send(:remove_method, :produce_mark) if fault == "missing-producer"
    api
  end
end

unless ARGV.empty?
  caller = ARGV.shift
  load caller
  if ARGV == ["--faults"]
    rejected = {}
    { "full" => [false, %w[accept-invalid wrong-status wrong-message wrong-produced missing-producer option-collapsed array-length host-accepts-nil]],
      "result-only" => [true, %w[wrong-produced missing-producer inputs-exported option-collapsed array-length]] }.each do |mode, (result_only, faults)|
      rejected[mode] = []
      faults.each do |fault|
        begin
          check_zero_payload_records(ZeroPayloadRubyModel.build_api(result_only, "arg", fault), result_only, "arg")
        rescue RuntimeError
          rejected[mode] << fault
        else
          raise "caller accepted fault: #{fault}"
        end
      end
    end
    puts JSON.generate(rejected)
  else
    result_only = ARGV.include?("--result-only")
    reviewed = ARGV.include?("--reviewed")
    api = ZeroPayloadRubyModel.build_api(result_only, reviewed ? "value" : "arg")
    puts JSON.generate(check_zero_payload_records(api, result_only, reviewed ? "value" : "arg"))
  end
end
