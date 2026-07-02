import AuthBanner from "@/components/AuthBanner";
import Hero from "@/components/Hero";
import PodcastGenerator from "@/components/PodcastGenerator";

export default function HomePage() {
  return (
    <div>
      <AuthBanner />
      <Hero />
      <PodcastGenerator />
    </div>
  );
}
