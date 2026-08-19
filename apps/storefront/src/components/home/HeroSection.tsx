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
    <section className="relative min-h-[823px] md:min-h-[640px] flex items-center overflow-hidden bg-black">
      {/* Full-bleed background image */}
      <Image
        src="/REDAPPLEKE/redapplegeroimg.png"
        alt={storeName}
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        className="object-cover"
      />
      {/*
        Mobile: bottom gradient for text legibility over the image.
        Desktop: left-to-right gradient so text reads cleanly on the left side.
      */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent md:bg-gradient-to-r md:from-black/80 md:via-black/40 md:to-transparent"
        aria-hidden="true"
      />
      {/*
        Mobile: centered text (current behavior, preserved).
        Desktop: left-aligned, larger type — Apple-style hero.
      */}
      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center md:text-left md:max-w-xl">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-tight">
            {t("welcome", { storeName })}
          </h1>
          <p className="mt-4 text-lg md:text-xl text-white/80 max-w-lg mx-auto md:mx-0">
            {t("heroDescription")}
          </p>
          <div className="mt-8 flex justify-center md:justify-start gap-4 flex-wrap">
            <Button size="lg" asChild className="bg-white text-black hover:bg-white/90 border-0">
              <Link href={`${basePath}/products`}>{t("shopNow")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
