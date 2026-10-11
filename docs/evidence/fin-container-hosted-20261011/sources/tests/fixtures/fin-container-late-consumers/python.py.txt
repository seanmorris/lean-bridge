late_before = checks
late_names = ['alpha', 'mid\0dle', 'omega']
late_saved_names = late_names.copy()
late_offsets = [1, 2, 3]
late_saved_offsets = late_offsets.copy()
for late_i in range(3):
    late_names[late_i] += '!'
    check(late_names != late_saved_names, 'name snapshot detects each changed position')
    late_names[late_i] = late_saved_names[late_i]
    late_offsets[late_i] += 1
    check(late_offsets != late_saved_offsets, 'offset snapshot detects each changed position')
    late_offsets[late_i] -= 1
check(late_names == late_saved_names, 'name controls restored')
check(late_offsets == late_saved_offsets, 'offset controls restored')
# Nine position/value combinations, then 1,000 rejection/recovery pairs.
for late_cycle in range(1009):
    late_position, late_representation = late_cycle % 3, (late_cycle // 3) % 3
    late_offsets = [1, 2, 3]
    late_offsets[late_position] = [4, 5, 2**70][late_representation]
    late_saved_offsets = late_offsets.copy()
    check(rejected(lambda: api.label(late_names, late_offsets), f'arg1[{late_position}]', '4'), 'late bound diagnostic')
    check(late_names == late_saved_names and all(type(v) is str for v in late_names), 'all names unchanged after rejection')
    check(late_offsets == late_saved_offsets and all(type(v) is int for v in late_offsets), 'all offsets unchanged after rejection')
    late_offsets = [1, 2, 3]
    late_saved_offsets = late_offsets.copy()
    check(api.label(late_names, late_offsets) == 'alpha:1,mid\0dle:2,omega:3', 'late recovery output')
    check(late_names == late_saved_names and all(type(v) is str for v in late_names), 'all names unchanged after recovery')
    check(late_offsets == late_saved_offsets and all(type(v) is int for v in late_offsets), 'all offsets unchanged after recovery')
check(checks - late_before == 6062, 'complete late-input assertion count')
