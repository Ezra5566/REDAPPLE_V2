# frozen_string_literal: true

# V3 equivalent of the upstream gem's Spree::Api::V2::Platform::MpesaSourceSerializer.
# The V2 file is ignored from Zeitwerk (see config/initializers/spree_mpesa_adapter.rb)
# because it subclasses a V2 base serializer that no longer exists in Spree 5.6.1.
module Spree
  module Api
    module V3
      module Platform
        class MpesaSourceSerializer < Spree::Api::V3::BaseSerializer
          typelize phone: :string, status: :string

          attributes :phone, :status, :merchant_request_id, :checkout_request_id,
                     :mpesa_receipt_number, :amount,
                     created_at: :iso8601, updated_at: :iso8601
        end
      end
    end
  end
end