import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { archiveQuery } from "@/lib/data";
import { archiveHead } from "@/lib/digest/meta";
import { ArchiveView } from "@/components/digest/ArchiveView";
import { DigestNotFound } from "@/components/digest/NotFound";

export const Route = createFileRoute("/digest/archive")({
  loader: ({ context }) => context.queryClient.ensureQueryData(archiveQuery()).then(() => undefined),
  head: () => archiveHead(),
  component: () => { const { data } = useSuspenseQuery(archiveQuery()); return <ArchiveView issues={data} />; },
  errorComponent: () => <DigestNotFound v="digestArchive.failed" />,
});
