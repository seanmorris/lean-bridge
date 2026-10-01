  def self.receiver_members
    owners = []
    keep = ->(value) { owners << value; value }
    root = keep.call(ticket(42))
    check(root.serial == root.get.serial && root.serial == 42)
    check(root.label == root.get.label && root.label == "native\0🙂")
    check(API::Value.instance_method(:serial).arity.zero?)
    check(API::Value.instance_method(:serial).bind_call(root) == 42)
    view = keep.call(root.retain_ticket)
    descendant = keep.call(view.retain_ticket)
    retained = keep.call(view.retain)
    copied = root.label
    root.close
    check(view.closed? && descendant.closed? && copied == "native\0🙂")
    rejected(API::LeanBridgeError, 4) { view.serial }
    check(retained.serial == 42)
    [retained, retained.get].each do |receiver|
      argument = keep.call(ticket(81))
      selected = keep.call(receiver.choose_ticket(argument))
      check(selected.serial == 81)
      argument.close
      check(selected.closed? && retained.serial == 42)
    end
    receiver, argument = keep.call(ticket(1)), keep.call(ticket(2))
    selected = keep.call(receiver.choose_ticket(argument))
    receiver.close
    check(selected.serial == 2)
    argument.close
    check(selected.closed?)
    rejected(TypeError) { retained.choose_ticket(retained.get) }
    rejected(NoMethodError) { retained.get.retain_ticket }
    rejected(NoMethodError) { retained.serial = 9 }
    record = keep.call(API.copy_value(bundle(retained.get)))
    check(record.payload == bundle(retained.get).payload)
    primary = keep.call(record.primary)
    check(primary.serial == record.get.primary.serial && primary.serial == 42)
    rejected(NoMethodError) { record.serial }
    rejected(NoMethodError) { API::Value.instance_method(:serial).bind_call(record) }
    record_view = keep.call(record.echo_record)
    callback_view = keep.call(record.callback_record(->(incoming) { incoming }))
    closure = keep.call(record.make_record)
    received = keep.call(closure.call(false, bundle(retained.get)))
    check(received.get.primary.serial == 42)
    record.close
    check(record_view.closed? && callback_view.closed? && closure.closed? && primary.closed?)
    check(!received.closed? && received.get.primary.serial == 42)
    [API::Choice::Empty.new, API::Choice::Many.new(tickets: []),
      API::Choice::One.new(ticket: retained.get)].each do |value|
      owner = keep.call(API.copy_value(value))
      borrowed = keep.call(owner.echo_variant)
      check(borrowed.get == value)
      owner.close
      check(borrowed.closed?)
    end
    [API::Tree::Branch.new(children: []), API::Tree::Leaf.new(ticket: retained.get)].each do |value|
      owner = keep.call(API.copy_value(value))
      borrowed = keep.call(owner.echo_recursive)
      callback = keep.call(owner.callback_recursive(->(incoming) { incoming }))
      closure = keep.call(owner.make_recursive)
      output = keep.call(closure.call(false, value))
      check(output.get == borrowed.get && output.get == callback.get && output.get == value)
      owner.close
      check(borrowed.closed? && callback.closed? && closure.closed?)
      check(!output.closed? && output.get == value)
    end
    owner = keep.call(ticket(12))
    alias_owner = keep.call(owner.dup)
    dependent = keep.call(owner.retain_ticket)
    moved = keep.call(owner.transfer_ticket)
    check(owner.closed? && alias_owner.closed? && dependent.closed? && moved.serial == 12)
    record = keep.call(API.copy_value(bundle(retained.get)))
    alias_owner = keep.call(record.dup)
    dependent = keep.call(record.echo_record)
    escaped = []
    moved = keep.call(record.move_record(->(incoming) {
      check(record.closed? && alias_owner.closed? && dependent.closed?)
      check(incoming.primary.serial == 42)
      escaped << incoming.primary
      incoming
    }))
    check(moved.get.primary.serial == 42)
    rejected(API::LeanBridgeError, 4) { escaped[0].serial }
    owner, argument = keep.call(ticket(6)), keep.call(ticket(9))
    mixed = keep.call(owner.mixed_ticket(argument))
    check(!owner.closed? && argument.closed? && mixed.serial == 9)
    owner.close
    check(mixed.closed?)
    owner = keep.call(ticket(77))
    later = owner.method(:retain_ticket)
    owner.close
    rejected(API::LeanBridgeError, 4) { later.call }
  ensure
    owners&.reverse_each(&:close)
  end
  receiver_members

