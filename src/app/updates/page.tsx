import { getUpdates } from "@/lib/updates";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkAsReadOnView } from "@/components/updates/markAsReadOnView";

export default function UpdatesPage() {
  const updates = getUpdates();

  return (
    <div className="flex flex-col gap-6 px-6 py-3 pb-12">
      <MarkAsReadOnView />
      <h1 className="mb-3 text-2xl font-bold">Oppdateringer</h1>

      <div className="flex flex-col gap-8">
        {updates.map((update) => (
          <article
            key={update.slug}
            className="border-b border-gray-200 pb-8 last:border-b-0"
          >
            <div className="mb-4">
              <h2 className="text-xl font-bold">{update.title}</h2>
              <time className="text-sm text-gray-500">
                {new Date(update.date).toLocaleDateString("nb-NO", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {update.content}
              </ReactMarkdown>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
