import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { getStoreName } from "@/lib/store";

interface HeroSectionProps {
  basePath: string;
  locale: string;
}

export async function HeroSection({ basePath, locale }: HeroSectionProps) {
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "home",
  });
  const storeName = getStoreName();

  return (
    <section className="relative border-b border-gray-200 dark:border-neutral-800 min-h-[823px] md:min-h-[560px] flex items-center overflow-hidden">
      <Image
        src="/REDAPPLEKE/redapplegeroimg.png"
        alt={storeName}
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        className="object-cover"
      />
      {/* Soft overlay keeps the text legible over the banner image */}
      <div className="absolute inset-0 bg-white/60 dark:bg-black/70" aria-hidden="true" />
      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t("welcome", { storeName })}
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-neutral-300 max-w-2xl mx-auto">
            {t("heroDescription")}
          </p>
          <div className="mt-8 flex justify-center gap-4 flex-wrap">
            <Button size="lg" asChild>
              <Link href={`${basePath}/products`}>{t("shopNow")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
