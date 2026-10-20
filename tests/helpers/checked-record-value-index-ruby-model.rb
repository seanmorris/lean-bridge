# frozen_string_literal: true

# Independent model used only to exercise the immutable Ruby caller. It does
# not share generated binding code, native conversion code, or package files.
module CheckedRecordValueIndexRubyModel
  module_function

  def record_class(*fields)
    Class.new do
      attr_reader(*fields)
      define_method(:initialize) do |**values|
        raise ArgumentError, "unexpected record fields" unless values.keys.sort == fields.sort
        fields.each { |field| instance_variable_set(:"@#{field}", values.fetch(field)) }
        freeze
      end
    end
  end

  def nat(value)
    raise TypeError, "Expected Integer" unless value.instance_of?(Integer)
    raise RangeError, "Nat cannot be negative" if value.negative?
    value
  end

  def record(value, kind)
    raise TypeError, "Expected #{kind}" unless value.instance_of?(kind)
    value
  end

  def refusal(prefix, constructor)
    raise RangeError, "#{prefix}0 was rejected by CheckedRecordValueIndices.#{constructor}"
  end

  def build_api(result_only, prefix)
    api = Module.new
    on = record_class(:count); off = record_class(:count); ab = record_class(:size)
    empty_token = record_class(:count); unicode_token = record_class(:count)
    empty_sized = record_class(:data); zero_token = record_class(:count); wide_token = record_class(:count)
    { On: on, Off: off, Ab: ab, EmptyToken: empty_token, UnicodeToken: unicode_token,
      EmptySized: empty_sized, ZeroToken: zero_token, WideToken: wide_token }.each do |name, kind|
      api.const_set(name, kind)
    end

    unless result_only
      api.define_singleton_method(:true_bool_index) do |value|
        value = CheckedRecordValueIndexRubyModel.record(value, on); count = CheckedRecordValueIndexRubyModel.nat(value.count)
        CheckedRecordValueIndexRubyModel.refusal(prefix, "mkOn") unless count.zero?; count
      end
      api.define_singleton_method(:false_bool_index) do |value|
        value = CheckedRecordValueIndexRubyModel.record(value, off); count = CheckedRecordValueIndexRubyModel.nat(value.count)
        CheckedRecordValueIndexRubyModel.refusal(prefix, "mkOff") if count.zero?; count
      end
      api.define_singleton_method(:ab_string_index) do |value|
        value = CheckedRecordValueIndexRubyModel.record(value, ab); size = CheckedRecordValueIndexRubyModel.nat(value.size)
        CheckedRecordValueIndexRubyModel.refusal(prefix, "mkAb") unless size == 2; size
      end
      api.define_singleton_method(:empty_string_index) do |value|
        CheckedRecordValueIndexRubyModel.nat(CheckedRecordValueIndexRubyModel.record(value, empty_token).count)
      end
      api.define_singleton_method(:unicode_string_index) do |value|
        CheckedRecordValueIndexRubyModel.nat(CheckedRecordValueIndexRubyModel.record(value, unicode_token).count)
      end
      api.define_singleton_method(:empty_sized_index) do |value|
        value = CheckedRecordValueIndexRubyModel.record(value, empty_sized)
        raise TypeError, "Expected Array" unless value.data.instance_of?(Array)
        CheckedRecordValueIndexRubyModel.refusal(prefix, "mkEmptySized") unless value.data.empty?; 0
      end
      api.define_singleton_method(:zero_nat_index) do |value|
        CheckedRecordValueIndexRubyModel.nat(CheckedRecordValueIndexRubyModel.record(value, zero_token).count)
      end
      api.define_singleton_method(:wide_nat_index) do |value|
        CheckedRecordValueIndexRubyModel.nat(CheckedRecordValueIndexRubyModel.record(value, wide_token).count)
      end
    end
    api.define_singleton_method(:produce_true_bool) { on.new(count: 0) }
    api.define_singleton_method(:produce_false_bool) { off.new(count: 1) }
    api.define_singleton_method(:produce_ab) { ab.new(size: 2) }
    api.define_singleton_method(:produce_empty_string) { |count| empty_token.new(count: CheckedRecordValueIndexRubyModel.nat(count)) }
    api.define_singleton_method(:produce_unicode_string) { |count| unicode_token.new(count: CheckedRecordValueIndexRubyModel.nat(count)) }
    api.define_singleton_method(:produce_empty_sized) { empty_sized.new(data: []) }
    api.define_singleton_method(:produce_zero_nat) { |count| zero_token.new(count: CheckedRecordValueIndexRubyModel.nat(count)) }
    api.define_singleton_method(:produce_wide_nat) { |count| wide_token.new(count: CheckedRecordValueIndexRubyModel.nat(count)) }
    api
  end
end

unless ARGV.empty?
  caller = ARGV.shift
  load caller
  result_only = ARGV.include?("--result-only")
  reviewed = ARGV.include?("--reviewed")
  api = CheckedRecordValueIndexRubyModel.build_api(result_only, reviewed ? "value" : "arg")
  puts JSON.generate(check_value_index_records(api, result_only, reviewed ? "value" : "arg"))
end
