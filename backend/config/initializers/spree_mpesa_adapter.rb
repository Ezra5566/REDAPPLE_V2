# frozen_string_literal: true

# Makes the upstream spree_mpesa gem bootable on Spree 5.6.1 without editing
# the gem (it is a git dependency pinned to a third-party repo).
#
# Root cause: spree_mpesa was written against the legacy Spree API V2. Its two
# serializer files live under app/serializers/spree/api/v2 and subclass a V2
# BaseSerializer that no longer exists, so Rails crashes during eager loading
# (production boot) with:
#
#   uninitialized constant Spree::Api::V2::Platform::BaseSerializer (NameError)
#
# Those serializers were only needed by the removed V2 API. Nothing in Spree
# 5.6.1 (or this app) references them, so they are dead weight that breaks
# boot. Fix:
#   1. Exclude the legacy V2 serializer directory from Zeitwerk autoloading /
#      eager loading so boot never evaluates those files.
#   2. Provide equivalent serializers under the current V3 architecture in
#      app/serializers/spree/api/v3 (see those files) for any future V3 use.
#   3. Ensure the payment method is registered (defensively; the gem's own
#      engine already does this in an after_initialize hook).

require 'spree_mpesa'

module SpreeMpesaAdapter
  class << self
    def install
      ignore_legacy_v2_serializers
      register_payment_method_after_init
    end

    private

    # Must run before the eager-load finisher. Rails loads config/initializers
    # before it eager loads, so calling ignore here prevents the gem's V2
    # serializer files from ever being evaluated.
    def ignore_legacy_v2_serializers
      gem_root = Gem.loaded_specs['spree_mpesa']&.full_gem_path
      return if gem_root.blank?

      legacy_dir = File.join(gem_root, 'app/serializers/spree/api/v2')
      if defined?(Rails.autoloaders) && Rails.autoloaders.main
        Rails.autoloaders.main.ignore(legacy_dir)
        Rails.logger&.info "[SpreeMpesaAdapter] Zeitwerk ignoring legacy V2 serializer dir: #{legacy_dir}"
      end
    rescue StandardError => e
      Rails.logger&.warn "[SpreeMpesaAdapter] Could not ignore #{legacy_dir}: #{e.class} #{e.message}"
    end

    # Spree::PaymentMethod and the gem's model are autoloaded lazily and are
    # not guaranteed to exist during the initializer phase, so registration is
    # deferred exactly like the gem's own engine does (after_initialize).
    def register_payment_method_after_init
      return unless defined?(Rails) && Rails.application

      Rails.application.config.after_initialize do
        Rails.application.config.spree.payment_methods ||= []
        unless Rails.application.config.spree.payment_methods.include?(Spree::PaymentMethod::Mpesa)
          Rails.application.config.spree.payment_methods << Spree::PaymentMethod::Mpesa
        end
      end
    end
  end
end

SpreeMpesaAdapter.install