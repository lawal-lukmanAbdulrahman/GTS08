import { Hero } from "./_components/landing/hero";
import { Bestsellers } from "./_components/landing/bestsellers";
import { Categories } from "./_components/landing/categories";
import { ShowcaseBanners } from "./_components/landing/showcase-banners";
import { NewArrivals } from "./_components/landing/new-arrivals";
import { CrazyFinds } from "./_components/landing/crazy-finds";
import { Testimonials } from "./_components/landing/testimonials";
import { FAQ } from "./_components/landing/faq";
import { Footer } from "./_components/landing/footer";

export default function LandingPage() {
  return (
    <main className="bg-white min-h-screen filter-card-scroll">
      <Hero />
      <Bestsellers />
      <Categories />
      <NewArrivals />
      <ShowcaseBanners />
      <CrazyFinds />
      <Testimonials />
      <FAQ />
      <Footer />
    </main>
  );
}
