import UploadCard from "@/components/UploadCard";
import Gallery from "@/components/Gallery";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Redwan&apos;s Method <span className="text-accent">2027</span> Discussion Hub
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-foreground/60">
          A notes-only archive. Upload your image or PDF notes below — they are
          stored on Telegram and published here once an admin verifies them.
        </p>
      </section>

      <UploadCard />
      <Gallery />
    </div>
  );
}
