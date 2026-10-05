require 'json'
require_relative 'ruby-values'
API = StructuredValues::API
Native = API.const_get(:Native, false)
layouts = JSON.parse(ARGV.fetch(0)).fetch('ownership')
if ARGV[1] == 'mutant'
  path = $LOADED_FEATURES.find { |file| file.end_with?('/lean_bridge/structured/native.rb') }
  raise 'missing installed native projection' unless path
  methods = File.read(path).scan(/^      def callback_invoke\d+\([^\n]*\n.*?^      end$/m)
  raise 'missing callback mutation targets' unless methods.length == 18
  methods.each do |source|
    raise 'missing return mutation target' unless source.scan('          return status').length == 1
    Native.module_eval(source.sub('          return status', "          frame.scope.close\n          return status"), path)
  end
end
raise 'runtime initialization failed' unless Native::INITIALIZE.call == 0
checks = 0
missing = []
layouts.each do |layout|
  shape = layout.fetch('shape')
  expected = shape == 'recursive' ? API::Tree::Branch.new(children: [API::Tree::Leaf.new(value: 1 << 257)]) : StructuredValues.payload(shape, shape == 'option' ? 2 : 1)
  input_scope = Native::GraphScope.new
  output_scope = Native::GraphScope.new
  frame = Native::GraphCallableFrame.new
  begin
    input = Native.public_send("graph_input#{layout.fetch('input')}", expected, input_scope)
    output = output_scope.allocate(layout.fetch('size'))
    status = Native.public_send("callback_invoke#{layout.fetch('callback')}", ->(_) { expected }, frame, Fiddle::Pointer.new(0), input, output)
    raise 'callback failed in ownership probe' unless status == 0 && frame.failure.nil?
    buffers = frame.scope.instance_variable_get(:@buffers)
    # Check owners BEFORE dereferencing any potentially dangling result pointer.
    if buffers.empty? || buffers.any?(&:freed?)
      missing << shape
      next
    end
    actual = Native.public_send("graph_output#{layout.fetch('output')}", output, output_scope)
    raise 'borrowed callback result differs' unless actual == expected
    checks += 1
  ensure
    frame.close
    input_scope.close
    output_scope.close
  end
end
raise "#{missing.length} Callback owners released before native copying: #{missing.join(',')}" unless missing.empty?
puts JSON.generate(ownership_checks: checks)
