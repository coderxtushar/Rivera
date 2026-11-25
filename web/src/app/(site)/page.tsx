import { Hero } from "./_components/hero";
import { FeaturedCourses, HowItWorks, NewCourses, TeachBand } from "./_components/home-sections";

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeaturedCourses />
      <HowItWorks />
      <NewCourses />
      <TeachBand />
    </>
  );
}
