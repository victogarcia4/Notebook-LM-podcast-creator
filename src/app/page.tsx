import PodcastGenerator from "@/components/PodcastGenerator";

export default function HomePage() {
  return (
    <div>
      <section className="mb-8 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">
          Convierte cualquier tema en un{" "}
          <span className="text-brand-light">podcast</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-400">
          Escribe un tema o una pregunta. NotebookLM investiga, escribe el guion
          y genera un podcast conversacional que puedes escuchar y compartir.
        </p>
      </section>
      <PodcastGenerator />
    </div>
  );
}
