/**
 * Transactional Ruby lease consumption over the checked C input-owner slots.
 *
 * @file
 */

/** Collect leases during conversion and observe the native handoff on reentry. */
export const ownedRubyTransfers = `
      class InputTransfers
        attr_reader :owners
        def initialize(state, count, scope)
          @state, @owners, @leases, @finished = state, [], {}.compare_by_identity, false
          begin
            scope.charge(:storage, count, 512)
            count.times do
              owner = Owned::Owner.new(state)
              begin
                Owned.checkpoint
                @owners << owner
              rescue ::Exception
                owner.close
                raise
              end
            end
          rescue ::Exception
            close
            raise
          end
        end
        def ready(lease)
          lease.require_open
          raise Owned::Error.new(1, "A transferred input requires an owning lease") unless lease.state.equal?(@state) && !lease.scope
          raise Owned::Error.new(8, "The input lease already belongs to a handoff") if lease.input_move
        end
        def add(lease, group, scope)
          ready(lease)
          if @leases.key?(lease)
            raise Owned::Error.new(1, "Two transferred inputs cannot consume the same lease") unless @leases.fetch(lease) == group
            return
          end
          scope.charge(:storage, 256)
          Owned.checkpoint
          @leases[lease] = group
        end
        def arm
          @state.require_open
          @owners.each do |owner|
            raise Owned::Error.new(9, "Missing prepared input owner") unless owner.slot && !owner.slot.value.zero?
          end
          @leases.each_key { |lease| ready(lease) }
          # C clears these slots immediately before entering Lean. Every alias
          # therefore reports closed during a synchronous callback reentry.
          @leases.each { |lease, group| lease.input_move = @owners.fetch(group).slot }
        end
        def finish
          return if @finished
          # Invalidate every consumed original owner before native releases can
          # execute user finalizers. An intact slot means no handoff occurred.
          @leases.each do |lease, group|
            signal = @owners.fetch(group).slot
            lease.slot.pending = true if lease.input_move.equal?(signal) && signal.value.zero?
          end
          @leases.each do |lease, group|
            lease.input_move = nil if lease.input_move.equal?(@owners.fetch(group).slot)
          end
          @finished = true
          @state.drain
        end
        def close
          begin
            finish
          ensure
            failure = nil
            @owners.reverse_each do |owner|
              begin; owner.close; rescue ::Exception => error; failure ||= error; end
            end
            @owners.clear; @leases.clear
            raise failure if failure
          end
        end
      end
`;
