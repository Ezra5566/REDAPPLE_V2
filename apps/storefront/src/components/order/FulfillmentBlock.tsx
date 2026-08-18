"use client";

import type { Address, Fulfillment, Order } from "@spree/sdk";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { AddressBlock } from "@/components/order/AddressBlock";
import { LineItemCard } from "@/components/order/LineItemCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getFulfillmentStatusColor } from "@/lib/utils/format";

interface FulfillmentBlockProps {
  fulfillment: Fulfillment;
  shipAddress: Address | null;
  basePath: string;
  lineItems: Order["items"];
}

export function FulfillmentBlock({
  fulfillment,
  shipAddress,
  basePath,
  lineItems,
}: FulfillmentBlockProps) {
  const t = useTranslations("orders");
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
        <div className="flex flex-col lg:flex-row lg:gap-6 gap-4">
          {shipAddress && (
            <div className="lg:w-1/2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {t("deliveryAddress")}
              </h3>
              <AddressBlock address={shipAddress} />
            </div>
          )}
          <div className="lg:w-1/2 lg:flex justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {t("shippingMethod")}
              </h3>
              <p className="text-sm text-gray-900 dark:text-white">
                {fulfillment.delivery_method?.name || t("canceled")}
              </p>
              {fulfillment.stock_location && (
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                  {t("shippedFrom", {
                    location: fulfillment.stock_location.name,
                  })}
                </p>
              )}
              <span
                className={`inline-flex items-center mt-2 px-2.5 py-0.5 rounded-lg text-xs font-medium capitalize ${getFulfillmentStatusColor(fulfillment.status)}`}
              >
                {fulfillment.status}
              </span>
            </div>
            <div className="mt-4 lg:mt-0">
              {fulfillment.status === "shipped" && fulfillment.tracking_url ? (
                <Button size="sm" asChild>
                  <a
                    href={fulfillment.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("trackItems")}
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  {t("trackItems")}
                </Button>
              )}
            </div>
          </div>
        </div>

        {fulfillment.status === "canceled" && !fulfillment.fulfilled_at && (
          <Alert variant="destructive" className="mt-3">
            <CircleAlert />
            <AlertDescription>{t("shipmentCanceledRefund")}</AlertDescription>
          </Alert>
        )}
        {fulfillment.status !== "canceled" &&
          fulfillment.status !== "shipped" &&
          !fulfillment.tracking && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-neutral-800 rounded-xl text-sm text-gray-500 dark:text-neutral-400 text-center">
              {t("noTrackingInfo")}
            </div>
          )}
      </div>

      <div className="divide-y divide-gray-200 dark:divide-neutral-800">
        {lineItems.map((item) => (
          <div key={item.id} className="px-6 py-4">
            <LineItemCard item={item} basePath={basePath} />
          </div>
        ))}
      </div>
    </div>
  );
}
