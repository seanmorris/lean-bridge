require 'lean_bridge/structured'
require 'json'
require_relative 'ruby-values'
API = LeanBridge::Structured
checks = 0
check = ->(value) { checks += 1; raise "recursive check #{checks} failed" unless value }
leaf = API::Tree::Leaf.new(value: 1 << 257)
empty = API::Tree::Branch.new(children: [])
tree = API::Tree::Branch.new(children: [leaf, empty])
seen = []
wrapped = API.call_recursive(tree) { |value| seen << value; API::Tree::Branch.new(children: [value]) }
check.call(wrapped == API::Tree::Branch.new(children: [tree]))
check.call(!seen[0].equal?(tree) && !seen[0].children.equal?(tree.children))
check.call(API.twice_recursive(tree) { |value| value } == tree)
API.make_recursive(tree).with do |closure|
  check.call(closure.call(true, empty) == tree)
  check.call(closure.call(false, empty) == empty)
  copy = closure.call(true, empty)
  copy.children.clear
  check.call(closure.call(true, empty) == tree)
  GC.start
  check.call(closure.call(true, empty) == tree)
end
64.times do |depth|
  value = leaf
  depth.times { value = API::Tree::Branch.new(children: [value]) }
  check.call(API.call_recursive(value) { |item| item } == value)
  API.make_recursive(value).with { |closure| check.call(closure.call(true, empty) == value) }
end
bad = leaf
64.times { bad = API::Tree::Branch.new(children: [bad]) }
begin
  API.call_recursive(bad) { |value| value }
  raise 'depth accepted'
rescue RangeError
  checks += 1
end
check.call(API.call_recursive(tree) { |item| item } == tree)
[RuntimeError, NoMemoryError, SystemExit].each do |kind|
  marker = kind.new('marker')
  begin
    API.twice_recursive(tree) { raise marker }
    raise 'callback exception swallowed'
  rescue kind => error
    check.call(error.equal?(marker))
  end
  check.call(API.call_recursive(tree) { |item| item } == tree)
end
check.call(API.call_recursive(tree) { |item| API.call_recursive(item) { |inner| inner } } == tree)
24.times do |seed|
  value = StructuredValues.payload('record', seed)
  expected = value.text + '<none>' + value.text
  check.call(API.call_nested_alias(value) { |items| items } == expected)
  check.call(API.call_nested_plain(value) { |items| items } == expected)
  [:make_nested_alias, :make_nested_plain].each do |name|
    API.public_send(name, value).with do |closure|
      result = closure.call([])
      check.call(result == [API::Some.new(value), nil, API::Some.new(value)])
      result.first.value.rows.clear
      check.call(closure.call([]) == [API::Some.new(value), nil, API::Some.new(value)])
    end
  end
end
seen = []
cycle_children = []
cycle = API::Tree::Branch.new(children: cycle_children)
cycle_children << cycle
invalid = [nil, API::Tree::Leaf.new(value: -1), API::Tree::Leaf.new(value: true),
           API::Tree::Branch.new(children: [leaf, Object.new]), cycle]
invalid.each do |value|
  [-> { API.call_recursive(value) { |item| seen << item; item } },
   -> { API.call_recursive(tree) { value } },
   -> { API.make_recursive(value) }].each do |operation|
    begin
      operation.call
      raise 'invalid tree accepted'
    rescue TypeError, ArgumentError, RangeError
      checks += 1
    end
  end
  check.call(seen.empty?)
  check.call(API.call_recursive(tree) { |item| item } == tree)
end
marker = API::LeanBridgeError.new(4, 'user supplied status')
begin
  API.call_recursive(tree) { raise marker }
  raise 'user error swallowed'
rescue API::LeanBridgeError => error
  check.call(error.equal?(marker))
end
check.call(API.call_recursive(tree) { |item| item } == tree)
4.times.map do
  Thread.new do
    8.times do
      raise 'thread copy differs' unless API.call_recursive(tree) { |item| item } == tree
      API.make_recursive(tree).with { |closure| raise 'thread capture differs' unless closure.call(true, empty) == tree }
    end
  end
end.each(&:value)
checks += 64
puts JSON.generate(checks: checks)
