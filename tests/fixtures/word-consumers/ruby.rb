require "lean_bridge/words"
API = LeanBridge::Words
US = [0, 1, 2**32 - 1, 2**53 + 1, 2**64 - 1]
SS = [-2**63, -2**53 - 1, -1, 0, 2**63 - 1]
$checks = 0
def check(value)
  raise "Platform integer mismatch" unless value
  $checks += 1
end
check(API.word_bits == 64)
US.zip(SS).each do |u, s|
  check(API.keep_unsigned(u) == u)
  check(API.keep_signed(s) == s)
  check(API.unsigned_text(u) == u.to_s)
  check(API.signed_text(s) == s.to_s)
  check(API.advance_unsigned(u) == (u + 1) % 2**64)
  check(API.advance_signed(s) == (s == 2**63 - 1 ? -2**63 : s + 1))
end
[['unsigned', [-1, 2**64]], ['signed', [-2**63 - 1, 2**63]]].each do |name, bads|
  (bads + [true, nil, 1.5, '1', [1]]).each do |bad|
    [-> { API.public_send("keep_#{name}", bad) },
     -> { API.public_send("keep_#{name}_values", [0, bad]) },
     -> { API.public_send("keep_#{name}_rows", [[0], [bad]]) },
     -> { API.keep_sample(API::Sample.new(natural: name == 'unsigned' ? bad : 1, integer: name == 'signed' ? bad : -1, unsigned_values: US, signed_values: SS)) },
     -> { API.keep_sample(API::Sample.new(natural: 1, integer: -1, unsigned_values: name == 'unsigned' ? [bad] : US, signed_values: name == 'signed' ? [bad] : SS)) }].each do |call|
      rejected = false
      begin
        call.call
      rescue TypeError, RangeError
        rejected = true
      end
      check(rejected)
      check(API.keep_signed(-1) == -1)
    end
  end
end
1000.times do
  sample = API.keep_sample(API::Sample.new(natural: US[-1], integer: SS[0], unsigned_values: US, signed_values: SS))
  check(sample.natural == US[-1] && sample.integer == SS[0])
  check(sample.unsigned_values == US && sample.signed_values == SS)
  check(API.keep_unsigned_values(US) == US)
  check(API.keep_signed_values(SS) == SS)
  check(API.keep_unsigned_rows([US, []]) == [US, []])
  check(API.keep_signed_rows([SS, []]) == [SS, []])
end
puts "word-ok:#{$checks}"
