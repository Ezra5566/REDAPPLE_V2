import type { Product } from "@spree/sdk";
import dynamic from "next/dynamic";
import { ProductCardSkeleton } from "@/components/products/ProductCardSkeleton";
import { PRODUCT_CARD_FIELDS } from "@/lib/data/cached";
import { getCategory } from "@/lib/data/categories";
import { cachedListProducts } from "@/lib/data/products";
import { getAccessToken } from "@/lib/spree";

const LazyProductCarousel = dynamic(
  () =>
    import("@/components/products/ProductCarousel").then((mod) => ({
      default: mod.ProductCarousel,
    })),
  {
    loading: () => (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    ),
  },
);

interface FeaturedProductsProps {
  basePath: string;
  locale: string;
  country: string;
  currency?: string;
}

/**
 * Which products show in the homepage "Featured" section.
 *
 * Opt-in, no backend changes: when NEXT_PUBLIC_FEATURED_CATEGORY_PERMALINK is
 * set to the permalink of a dedicated "Featured" category (created in the
 * Spree admin), the section lists the products in that category, newest first.
 * The admin picks featured items purely by adding/removing products to that
 * category.
 *
 * When the env var is unset, the category is missing, or it has no products,
 * we fall back to the catalog's default 8 so the section is never empty.
 */
async function fetchFeaturedProducts(
  locale: string,
  country: string,
  userToken?: string,
): Promise<Product[]> {
  const base = { locale, country };

  const permalink = process.env.NEXT_PUBLIC_FEATURED_CATEGORY_PERMALINK?.trim();
  if (permalink) {
    try {
      const category = await getCategory(permalink);
      if (category) {
        const featured = await cachedListProducts(
          {
            limit: 8,
            in_category: category.id,
            // Newest first: "last added comes first" for featured items.
            sort: "-available_on",
            fields: PRODUCT_CARD_FIELDS,
          },
          base,
          "dtc",
          userToken,
        );
        if (featured.data?.length) return featured.data;
      }
    } catch {
      // Category not found / fetch error: fall through to the default list.
    }
  }

  const fallback = await cachedListProducts(
    { limit: 8, fields: PRODUCT_CARD_FIELDS },
    base,
    "dtc",
    userToken,
  );
  return fallback.data ?? [];
}

export async function FeaturedProducts({
  basePath,
  locale,
  country,
  currency,
}: FeaturedProductsProps) {
  const userToken = await getAccessToken();
  const products = await fetchFeaturedProducts(locale, country, userToken);

  return (
    <LazyProductCarousel
      products={products}
      basePath={basePath}
      currency={currency}
    />
  );
}
