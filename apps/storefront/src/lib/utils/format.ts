export function formatDate(
  dateString: string | null,
  fallback = "-",
  locale = "en-US",
): string {
  if (!dateString) return fallback;
  return new Date(dateString).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(
  dateString: string | null,
  locale = "en-US",
): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getPaymentStatusColor(state: string | null): string {
  switch (state) {
    case "paid":
      return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
    case "balance_due":
    case "pending":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
    case "failed":
    case "void":
      return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
    default:
      return "bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-neutral-300";
  }
}

export function getFulfillmentStatusColor(state: string | null): string {
  switch (state) {
    case "shipped":
    case "delivered":
      return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
    case "ready":
    case "pending":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
    case "canceled":
      return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
    default:
      return "bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-neutral-300";
  }
}
