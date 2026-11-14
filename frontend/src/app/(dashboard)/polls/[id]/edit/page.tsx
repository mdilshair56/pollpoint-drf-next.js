import { notFound } from "next/navigation";
import { CreatePollForm } from "@/components/polls/create-poll-form";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPollPage({ params }: PageProps) {
  const { id } = await params;
  const pollId = Number(id);
  if (!Number.isSafeInteger(pollId) || pollId < 1) notFound();
  return <CreatePollForm pollId={pollId} />;
}
