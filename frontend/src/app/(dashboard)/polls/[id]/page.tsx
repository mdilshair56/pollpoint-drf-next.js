import { notFound } from "next/navigation";
import { PollDetailView } from "@/components/polls/poll-detail";

type PageProps = { params: Promise<{ id: string }> };

export default async function PollDetailPage({ params }: PageProps) {
  const { id } = await params;
  const pollId = Number(id);
  if (!Number.isSafeInteger(pollId) || pollId < 1) notFound();
  return <PollDetailView pollId={pollId} />;
}
