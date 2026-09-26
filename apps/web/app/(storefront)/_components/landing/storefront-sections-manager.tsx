"use client";

import React, { useState, useEffect } from "react";
import { Hero } from "./hero";
import { Bestsellers } from "./bestsellers";
import { Trending } from "./trending";
import { NewArrivals } from "./new-arrivals";
import { ForYou } from "./for-you";
import { CrazyDeals } from "./crazy-finds";
import { BeautyHygieneDeals } from "./beauty-hygiene-deals";
import { Categories } from "./categories";
import { FAQ } from "./faq";
import { Footer } from "./footer";

export interface SectionConfig {
  id?: string;
  section_key: string;
  title: string;
  is_active: boolean;
  sort_order: number;
  config?: Record<string, any>;
}

export const DEFAULT_STOREFRONT_SECTIONS: SectionConfig[] = [
  { section_key: "hero", title: "Hero Carousel", is_active: true, sort_order: 0 },
  { section_key: "trending", title: "Trending", is_active: true, sort_order: 1 },
  { section_key: "bestselling", title: "Bestselling", is_active: true, sort_order: 2 },
  { section_key: "new-arrivals", title: "New Arrivals", is_active: true, sort_order: 3 },
  { section_key: "for-you", title: "For You", is_active: true, sort_order: 4 },
  { section_key: "crazy-deals", title: "Crazy Deals", is_active: true, sort_order: 5 },
  { section_key: "beauty", title: "Beauty & Hygiene", is_active: true, sort_order: 6 },
  { section_key: "categories", title: "Categories", is_active: true, sort_order: 7 },
  { section_key: "faq", title: "FAQ", is_active: true, sort_order: 8 },
  { section_key: "footer", title: "Footer", is_active: true, sort_order: 9 },
];

export function StorefrontSectionsManager() {
  const [sections, setSections] = useState<SectionConfig[]>(DEFAULT_STOREFRONT_SECTIONS);

  useEffect(() => {
    let mounted = true;
    async function loadSections() {
      try {
        const res = await fetch("/api/v1/storefront/sections");
        if (res.ok) {
          const json = await res.json();
          if (mounted && Array.isArray(json.data) && json.data.length > 0) {
            setSections(json.data);
          }
        }
      } catch {
        // Fallback to DEFAULT_STOREFRONT_SECTIONS
      }
    }
    void loadSections();
    return () => {
      mounted = false;
    };
  }, []);

  const renderSection = (sec: SectionConfig) => {
    switch (sec.section_key) {
      case "hero":
        return <Hero key="hero" />;
      case "bestselling":
        return <Bestsellers key="bestselling" />;
      case "trending":
        return <Trending key="trending" />;
      case "new-arrivals":
        return <NewArrivals key="new-arrivals" />;
      case "for-you":
        return <ForYou key="for-you" />;
      case "crazy-deals":
      case "crazy-finds":
        return <CrazyDeals key="crazy-deals" />;
      case "beauty":
        return <BeautyHygieneDeals key="beauty" categorySlug={sec.config?.category_slug} />;
      case "categories":
        return <Categories key="categories" />;
      case "faq":
        return <FAQ key="faq" />;
      case "footer":
        return <Footer key="footer" />;
      default:
        return null;
    }
  };

  const activeSections = sections.filter((s) => s.is_active !== false);

  return (
    <div className="flex flex-col w-full">
      {activeSections.map((sec) => (
        <div key={sec.section_key} id={`storefront-section-${sec.section_key}`} className="w-full">
          {renderSection(sec)}
        </div>
      ))}
    </div>
  );
}
