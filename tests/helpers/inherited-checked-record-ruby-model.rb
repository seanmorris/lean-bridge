# Independent source-only model for the inherited-record Ruby caller.
module InheritedCheckedRecordRubyModel
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
    raise TypeError, "expected Nat" unless value.instance_of?(Integer)
    raise RangeError, "expected nonnegative Nat" if value.negative?
    value
  end

  def expect(value, kind)
    raise TypeError, "unexpected public record class" unless value.instance_of?(kind)
    value
  end

  def refused(prefix, suffix, constructor)
    raise RangeError, "#{prefix}#{suffix} was rejected by InheritedCheckedRecords.#{constructor}"
  end

  def span(value, kind, prefix, normalize = false)
    value = expect(value, kind)
    lo, hi = nat(value.lo), nat(value.hi)
    return kind.new(lo: 0, hi: lo + hi) if normalize
    refused(prefix, ".toSpan", "mkSpan") if lo > hi
    kind.new(lo: lo, hi: hi)
  end

  def ticket(value, kinds, prefix, normalize_record = false,
             normalize_parent = false, normalize_word = false)
    span_kind, ticket_kind = kinds
    value = expect(value, ticket_kind)
    parent = span(value.to_span, span_kind, prefix, normalize_parent)
    word = nat(value.word)
    if normalize_word
      word += 1
    elsif word.zero?
      refused(prefix, ".word", "mkWord")
    end
    if normalize_record
      word = parent.hi + 1
    elsif parent.hi > word
      refused(prefix, "", "mkTicket")
    end
    ticket_kind.new(to_span: parent, word: word)
  end

  def build_api(result_only, prefix, fault = nil)
    api = Module.new
    span_kind = record_class(:lo, :hi)
    ticket_kind = record_class(:to_span, :word)
    stamped_kind = record_class(:to_ticket, :mark)
    api.const_set(:Span, span_kind)
    api.const_set(:Ticket, ticket_kind)
    api.const_set(:Stamped, stamped_kind)

    api.define_singleton_method(:produce) do |value|
      raise RangeError, "wrong host exception" if fault == "wrong-host-exception" && value == true
      value = InheritedCheckedRecordRubyModel.nat(value)
      offset = fault == "produce-offset" ? 2 : 1
      ticket_kind.new(to_span: span_kind.new(lo: value, hi: value), word: value + offset)
    end
    unless fault == "missing-produce-stamped"
      api.define_singleton_method(:produce_stamped) do |value|
        value = InheritedCheckedRecordRubyModel.nat(value)
        stamped_kind.new(
          to_ticket: ticket_kind.new(
            to_span: span_kind.new(lo: value, hi: value), word: value + 1
          ), mark: 0
        )
      end
    end
    if result_only
      api.define_singleton_method(:first) { |_value| 0 } if fault == "inputs-exported"
      return api
    end

    kinds = [span_kind, ticket_kind]
    api.define_singleton_method(:first) do |value|
      value = begin
        InheritedCheckedRecordRubyModel.ticket(value, kinds, prefix)
      rescue RangeError
        raise RangeError, "wrong diagnostic" if fault == "wrong-diagnostic"
        next 0 if fault == "accept-invalid"
        raise
      end
      value.to_span.lo + value.to_span.hi + value.word
    end
    api.define_singleton_method(:normalized) do |value|
      value = if fault == "normalize-bypass"
                InheritedCheckedRecordRubyModel.ticket(value, kinds, prefix)
              else
                InheritedCheckedRecordRubyModel.ticket(value, kinds, prefix, true, true, true)
              end
      value.to_span.lo + value.to_span.hi + value.word
    end
    api.define_singleton_method(:pair) do |left, right|
      left = InheritedCheckedRecordRubyModel.ticket(left, kinds, prefix)
      right_prefix = prefix.sub(/0\z/, "1")
      right = InheritedCheckedRecordRubyModel.ticket(right, kinds, right_prefix, true, true, true)
      left.word + right.word
    end
    api.define_singleton_method(:aliased) do |value|
      InheritedCheckedRecordRubyModel.ticket(value, kinds, prefix, false, true, true).word
    end
    api.define_singleton_method(:nested) do |value|
      value = InheritedCheckedRecordRubyModel.expect(value, stamped_kind)
      child = InheritedCheckedRecordRubyModel.ticket(value.to_ticket, kinds, prefix)
      mark = InheritedCheckedRecordRubyModel.nat(value.mark)
      raise RangeError, "#{prefix}.mark is not below its Fin 8 bound" if mark >= 8
      InheritedCheckedRecordRubyModel.refused(prefix, "", "mkStamped") if mark > child.word
      child.word + mark
    end
    api.define_singleton_method(:echo) do |value|
      fault == "echo-alias" ? value :
        InheritedCheckedRecordRubyModel.ticket(value, kinds, prefix, true, false, true)
    end
    api
  end
end

unless ARGV.empty?
  caller = ARGV.shift
  load caller
  result_only = ARGV.include?("--result-only")
  reviewed = ARGV.include?("--reviewed")
  fault = ARGV.find { |argument| argument.start_with?("--fault=") }&.delete_prefix("--fault=")
  api = InheritedCheckedRecordRubyModel.build_api(
    result_only, reviewed ? "value0" : "arg0", fault
  )
  puts JSON.generate(check_inherited_checked_records(
                       api, result_only, 256, reviewed ? "value" : "arg"))
end
