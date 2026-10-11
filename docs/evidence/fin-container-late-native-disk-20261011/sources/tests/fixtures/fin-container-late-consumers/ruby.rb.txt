late_before = $checks
late_names = ['alpha', "mid\0dle", 'omega']
late_saved_names = late_names.map(&:dup)
late_offsets = [1, 2, 3]
late_saved_offsets = late_offsets.dup
3.times do |i|
  late_names[i] << '!'
  check(late_names != late_saved_names, 'name snapshot detects mutation')
  late_names[i].chop!
  late_offsets[i] += 1
  check(late_offsets != late_saved_offsets, 'offset snapshot detects mutation')
  late_offsets[i] -= 1
end
check(late_names == late_saved_names, 'name controls restored')
check(late_offsets == late_saved_offsets, 'offset controls restored')
# Nine position/value combinations, then 1,000 rejection/recovery pairs.
1009.times do |cycle|
  position, representation = cycle % 3, (cycle / 3) % 3
  late_offsets = [1, 2, 3]
  late_offsets[position] = [4, 5, 2**70][representation]
  late_saved_offsets = late_offsets.dup
  check(rejected("arg1[#{position}]", '4') { API.label(late_names, late_offsets) }, 'late bound diagnostic')
  check(late_names == late_saved_names && late_names.all? { |v| v.instance_of?(String) }, 'all names unchanged after rejection')
  check(late_offsets == late_saved_offsets && late_offsets.all? { |v| v.instance_of?(Integer) }, 'all offsets unchanged after rejection')
  late_offsets = [1, 2, 3]; late_saved_offsets = late_offsets.dup
  check(API.label(late_names, late_offsets) == "alpha:1,mid\0dle:2,omega:3", 'late recovery output')
  check(late_names == late_saved_names && late_names.all? { |v| v.instance_of?(String) }, 'all names unchanged after recovery')
  check(late_offsets == late_saved_offsets && late_offsets.all? { |v| v.instance_of?(Integer) }, 'all offsets unchanged after recovery')
end
check($checks - late_before == 6062, 'complete late-input assertion count')
