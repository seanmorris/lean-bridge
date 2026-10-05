# Independent structured values, not derived from generated ABI metadata.
require "lean_bridge/structured"

module StructuredValues
  extend self
  API = LeanBridge::Structured
  SHAPES = %w[array list option result tuple record variant alias].freeze

  def payload(shape, seed)
    text = ["", "a\0λ🌿", "\u{10ffff}", "e\u0301"][seed % 4] + seed.to_s
    rows = seed % 5 == 0 ? [] : [nil, API::Some.new(text), API::Some.new(""), API::Some.new("\0")]
    huge = (1 << (256 + seed)) + (1 << 64) + seed
    case shape
    when "array" then rows
    when "list"
      seed % 5 == 0 ? [] : [API::Ok.new([(1 << 32) - 1, text]), API::Err.new(text),
                             API::Ok.new([seed, ""]), API::Err.new("")]
    when "option" then [nil, API::Some.new(nil), API::Some.new(API::Some.new(API::UNIT))][seed % 3]
    when "result"
      [API::Ok.new(nil), API::Ok.new(API::Some.new(seed)), API::Err.new([text, "", "\0"]), API::Err.new([])][seed % 4]
    when "tuple" then [text, [seed.even? ? "".b : "\0\xff\x80".b + (0..255).to_a.pack("C*"), huge]]
    when "record", "alias"
      nested = [nil, API::Some.new(API::Ok.new([(1 << 64) - 1, API::UNIT])), API::Some.new(API::Err.new(text))][seed % 3]
      API::Payload.new(text: text, rows: rows, count: huge, nested: nested)
    when "variant"
      [API::Packet::Empty.new, API::Packet::Payload.new(label: text, rows: rows),
       API::Packet::Counts.new(positive: huge, negative: -huge)][seed % 3]
    else raise ArgumentError, shape
    end
  end

  def snapshot(value)
    return value if value.equal?(API::UNIT)
    case value
    when String then value.dup
    when Array then value.map { |item| snapshot(item) }
    when API::Some, API::Ok, API::Err then value.class.new(snapshot(value.value))
    when API::Payload, API::Packet
      value.class.new(**value.deconstruct_keys(nil).transform_values { |item| snapshot(item) })
    else value
    end
  end
end
