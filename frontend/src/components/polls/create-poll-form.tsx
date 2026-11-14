"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeading } from "@/components/common/page-heading";
import { pollService } from "@/services/poll-service";
import type { PollCreatePayload, PollStatus, ResultVisibility } from "@/types/poll";
import { getErrorMessage } from "@/utils/errors";

type DraftQuestion = { name: string; description: string; options: string[] };

const newQuestion = (): DraftQuestion => ({ name: "", description: "", options: ["", ""] });

function toLocalDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return (
    date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" +
    pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes())
  );
}

function toIsoDateTime(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function CreatePollForm({ pollId }: { pollId?: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [resultVisibility, setResultVisibility] = useState<ResultVisibility>("after_submission");
  const [loadedStatus, setLoadedStatus] = useState<PollStatus>("draft");
  const [canManage, setCanManage] = useState(!pollId);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()]);
  const [loading, setLoading] = useState(Boolean(pollId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pollId) return;
    let active = true;
    pollService.getById(pollId)
      .then(({ data }) => {
        if (!active) return;
        if (!data.can_manage || data.status !== "draft") {
          setError("Only the poll owner or Superadmin can edit draft polls. In-progress and completed polls are read-only.");
          return;
        }
        setCanManage(true);
        setLoadedStatus(data.status);
        setName(data.name);
        setDescription(data.description);
        setResultVisibility(data.result_visibility);
        setStartsAt(toLocalDateTime(data.starts_at));
        setEndsAt(toLocalDateTime(data.ends_at));
        setQuestions(data.questions.map((question) => ({
          name: question.question_name,
          description: question.question_description,
          options: question.options.slice().sort((a, b) => a.order - b.order).map((option) => option.name),
        })));
      })
      .catch((caught) => { if (active) setError(getErrorMessage(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pollId]);

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((current) => current.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question));
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    setQuestions((current) => current.map((question, index) => {
      if (index !== questionIndex) return question;
      return { ...question, options: question.options.map((option, itemIndex) => itemIndex === optionIndex ? value : option) };
    }));
  }

  function addOption(questionIndex: number) {
    setQuestions((current) => current.map((question, index) => index === questionIndex ? { ...question, options: [...question.options, ""] } : question));
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    setQuestions((current) => current.map((question, index) => index === questionIndex ? { ...question, options: question.options.filter((_, itemIndex) => itemIndex !== optionIndex) } : question));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const shouldPublish = submitter?.value === "publish";

    setError("");
    setBusy(true);

    const payload: PollCreatePayload = {
      name: name.trim(),
      description: description.trim(),
      result_visibility: resultVisibility,
      starts_at: toIsoDateTime(startsAt),
      ends_at: toIsoDateTime(endsAt),
      ...(loadedStatus === "draft" ? { questions: questions.map((question) => ({
        name: question.name.trim(),
        description: question.description.trim(),
        options: question.options.filter((option) => option.trim()).map((option, index) => ({
          name: option.trim(),
          order: index + 1,
        })),
      })) } : {}),
    };

    try {
      if (pollId) {
        await pollService.update(pollId, payload);
        router.push("/polls/" + pollId);
      } else {
        const result = await pollService.create(payload);
        const createdPollId = result.data.id;

        if (shouldPublish) {
          try {
            await pollService.publish(createdPollId);
          } catch (publishError) {
            window.alert(
              "The poll was saved as a draft, but publishing failed: " +
              getErrorMessage(publishError) +
              ". You can review the draft and try publishing again."
            );
          }
        }

        router.push("/polls/" + createdPollId);
      }
      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-8 text-center text-sm text-muted">Loading poll…</div>;
  }

  if (pollId && !canManage) {
    return (
      <div className="panel p-6">
        <p role="alert" className="text-sm text-red-700">{error || "You do not have permission to manage this poll."}</p>
        <Link href={"/polls/" + pollId} className="mt-4 inline-block text-sm font-semibold text-interactive">← Back to poll</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/polls" className="text-sm font-semibold text-interactive hover:underline">← Back to polls</Link>
      <div className="mt-4">
        <PageHeading
          eyebrow={pollId ? "Poll management" : "Poll builder"}
          title={pollId ? (loadedStatus === "draft" ? "Edit draft poll" : "Edit poll details") : "Create a poll"}
          description={pollId ? (loadedStatus === "draft" ? "Update the poll, questions and options before publishing." : "Update poll details. Published polls can only have their end time extended; completed poll schedules are locked.") : "New polls are saved as drafts. Review and publish them when ready."}
        />
      </div>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={submit} className="mt-6 space-y-6">
        <section className="panel space-y-4 p-5">
          <h2 className="font-bold text-brand">Poll details</h2>
          <div>
            <label className="field-label" htmlFor="name">Poll name</label>
            <input className="field" id="name" name="name" maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="description">Description</label>
            <textarea className="field" id="description" name="description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="result_visibility">Result visibility</label>
            <select className="field" id="result_visibility" name="result_visibility" value={resultVisibility} onChange={(event) => setResultVisibility(event.target.value as ResultVisibility)}>
              <option value="live">Live</option>
              <option value="after_submission">After submission</option>
              <option value="polls_end">After polls end</option>
              <option value="restricted">Restricted</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="field-label" htmlFor="starts_at">Starts at</label><input className="field" type="datetime-local" id="starts_at" value={startsAt} disabled={loadedStatus !== "draft"} onChange={(event) => setStartsAt(event.target.value)} /></div>
            <div><label className="field-label" htmlFor="ends_at">Ends at</label><input className="field" type="datetime-local" id="ends_at" value={endsAt} disabled={loadedStatus === "completed"} onChange={(event) => setEndsAt(event.target.value)} /></div>
          </div>
        </section>

        {loadedStatus === "draft" && questions.map((question, questionIndex) => (
          <section key={questionIndex} className="panel space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-brand">Question {questionIndex + 1}</h2>
              {questions.length > 1 && <button type="button" className="text-sm font-semibold text-red-600" onClick={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))}>Remove question</button>}
            </div>
            <div>
              <label className="field-label" htmlFor={"question-" + questionIndex}>Question text</label>
              <input className="field" id={"question-" + questionIndex} maxLength={255} value={question.name} onChange={(event) => updateQuestion(questionIndex, { name: event.target.value })} required />
            </div>
            <div>
              <label className="field-label" htmlFor={"question-description-" + questionIndex}>Question description (optional)</label>
              <textarea className="field" id={"question-description-" + questionIndex} rows={2} value={question.description} onChange={(event) => updateQuestion(questionIndex, { description: event.target.value })} />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Answer options (at least two)</p>
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input className="field" aria-label={"Option " + (optionIndex + 1)} maxLength={255} placeholder={"Option " + (optionIndex + 1)} value={option} onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)} required />
                  {question.options.length > 2 && <button type="button" aria-label="Remove option" className="rounded-lg border border-border px-3 py-2 text-sm text-red-600" onClick={() => removeOption(questionIndex, optionIndex)}>×</button>}
                </div>
              ))}
              <button type="button" className="text-sm font-semibold text-interactive hover:underline" onClick={() => addOption(questionIndex)}>+ Add option</button>
            </div>
          </section>
        ))}

        {loadedStatus === "draft" && <button type="button" className="btn-secondary w-full" onClick={() => setQuestions((current) => [...current, newQuestion()])}>+ Add another question</button>}
        <div className="flex flex-wrap justify-end gap-3">
          {pollId ? (
            <>
              <Link href={"/polls/" + pollId} className="btn-secondary">Cancel</Link>
              <button type="submit" name="intent" value="draft" className="btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Discard this new poll? All unsaved information will be lost.")) {
                    router.push("/polls");
                  }
                }}
              >
                Discard
              </button>
              <button type="submit" name="intent" value="publish" className="btn-primary" disabled={busy}>
                {busy ? "Publishing…" : "Publish"}
              </button>
              <button type="submit" name="intent" value="draft" className="btn-secondary" disabled={busy}>
                {busy ? "Saving…" : "Save as Draft"}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
