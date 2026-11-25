"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeading } from "@/components/common/page-heading";
import { AutocompleteInput } from "@/components/common/autocomplete-input";
import { notify } from "@/lib/notifications";
import { pollService, searchPolls } from "@/services/poll-service";
import { searchQuestions } from "@/services/question-service";
import type { PollCreatePayload, PollStatus, ResultVisibility } from "@/types/poll";
import { getErrorMessage } from "@/utils/errors";

type DraftOption = { id: string; name: string };
type DraftQuestion = {
  id: string;
  name: string;
  description: string;
  options: DraftOption[];
};

const newOption = (): DraftOption => ({
  id: crypto.randomUUID(),
  name: "",
});

const newQuestion = (): DraftQuestion => ({
  id: crypto.randomUUID(),
  name: "",
  description: "",
  options: [newOption(), newOption()],
});

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
  // useId is stable between the server render and client hydration.
  const initialQuestionId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [resultVisibility, setResultVisibility] = useState<ResultVisibility>("after_submission");
  const [emailReportOnCompletion, setEmailReportOnCompletion] = useState(false);
  const [emailReportExcel, setEmailReportExcel] = useState(false);
  const [emailReportPdf, setEmailReportPdf] = useState(false);
  const [loadedStatus, setLoadedStatus] = useState<PollStatus>("draft");
  const [canManage, setCanManage] = useState(!pollId);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => [
    {
      id: initialQuestionId,
      name: "",
      description: "",
      options: [
        { id: initialQuestionId + "-option-1", name: "" },
        { id: initialQuestionId + "-option-2", name: "" },
      ],
    },
  ]);
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
        setEmailReportOnCompletion(data.email_report_on_completion);
        setEmailReportExcel(data.email_report_excel);
        setEmailReportPdf(data.email_report_pdf);
        setStartsAt(toLocalDateTime(data.starts_at));
        setEndsAt(toLocalDateTime(data.ends_at));
        setQuestions(data.questions.map((question) => ({
          id: String(question.id),
          name: question.question_name,
          description: question.question_description,
          options: question.options.slice().sort((a, b) => a.order - b.order).map((option) => ({
            id: String(option.id),
            name: option.name,
          })),
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
      return {
        ...question,
        options: question.options.map((option, itemIndex) => (
          itemIndex === optionIndex ? { ...option, name: value } : option
        )),
      };
    }));
  }

  function addOption(questionIndex: number) {
    const option = newOption();
    setQuestions((current) => current.map((question, index) => (
      index === questionIndex
        ? { ...question, options: [...question.options, option] }
        : question
    )));
  }

  function addQuestion() {
    const question = newQuestion();
    setQuestions((current) => [...current, question]);
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    setQuestions((current) => current.map((question, index) => index === questionIndex ? { ...question, options: question.options.filter((_, itemIndex) => itemIndex !== optionIndex) } : question));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const shouldPublish = submitter?.value === "publish";

    setError("");
    const startsAtIso = toIsoDateTime(startsAt);
    const endsAtIso = toIsoDateTime(endsAt);
    if (!startsAtIso || !endsAtIso) {
      setError("Enter valid poll start and end times.");
      return;
    }
    if (new Date(startsAtIso).getTime() <= Date.now()) {
      setError("The poll start time must be in the future.");
      return;
    }
    if (new Date(endsAtIso).getTime() <= new Date(startsAtIso).getTime()) {
      setError("The poll end time must be after its start time.");
      return;
    }
    if (emailReportOnCompletion && !emailReportExcel && !emailReportPdf) {
      setError("Choose at least one report format to email.");
      return;
    }
    setBusy(true);

    const payload: PollCreatePayload = {
      name: name.trim(),
      description: description.trim(),
      result_visibility: resultVisibility,
      email_report_on_completion: emailReportOnCompletion,
      email_report_excel: emailReportExcel,
      email_report_pdf: emailReportPdf,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      ...(loadedStatus === "draft" ? { questions: questions.map((question) => ({
        name: question.name.trim(),
        description: question.description.trim(),
        options: question.options.filter((option) => option.name.trim()).map((option, index) => ({
          name: option.name.trim(),
          order: index + 1,
        })),
      })) } : {}),
    };

    try {
      if (pollId) {
        await notify.promise(pollService.update(pollId, payload), {
          loading: "Updating poll...",
          success: "Poll updated successfully!",
          error: "Unable to update poll.",
        });
        router.push("/polls/" + pollId);
      } else {
        const result = await notify.promise(pollService.create(payload), {
          loading: "Creating poll...",
          success: "Poll created successfully!",
          error: "Unable to create poll.",
        });
        const createdPollId = result.data.id;

        if (shouldPublish) {
          try {
            await notify.promise(pollService.publishDraft(createdPollId), {
              loading: "Publishing poll...",
              success: "Poll published successfully!",
              error: "Unable to publish poll.",
            });
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
            <AutocompleteInput
              id="name"
              name="name"
              maxLength={100}
              required
              searchFn={searchPolls}
              searchType="poll"
              value={name}
              onChange={setName}
            />
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
            <div><label className="field-label" htmlFor="starts_at">Starts at</label><input className="field" type="datetime-local" id="starts_at" required value={startsAt} disabled={loadedStatus !== "draft"} onChange={(event) => setStartsAt(event.target.value)} /></div>
            <div><label className="field-label" htmlFor="ends_at">Ends at</label><input className="field" type="datetime-local" id="ends_at" required value={endsAt} disabled={loadedStatus === "completed"} onChange={(event) => setEndsAt(event.target.value)} /></div>
          </div>
          <label htmlFor="email_report_on_completion" className="flex items-start gap-3 rounded-lg border border-border p-4">
            <input
              id="email_report_on_completion"
              type="checkbox"
              className="mt-1 h-4 w-4 accent-blue-600"
              checked={emailReportOnCompletion}
              disabled={loadedStatus !== "draft"}
              onChange={(event) => {
                const enabled = event.target.checked;
                setEmailReportOnCompletion(enabled);
                if (!enabled) {
                  setEmailReportExcel(false);
                  setEmailReportPdf(false);
                }
              }}
            />
            <span>
              <span className="block text-sm font-semibold text-brand">Email me the report when this poll ends</span>
              <span className="mt-1 block text-sm text-muted">We’ll send the completed poll report to the poll creator’s account email.</span>
            </span>
          </label>
          {emailReportOnCompletion && (
            <fieldset className="ml-7 space-y-3 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-slate-700">Report attachments</legend>
              <label htmlFor="email_report_excel" className="flex items-center gap-3 text-sm text-slate-700">
                <input
                  id="email_report_excel"
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={emailReportExcel}
                  disabled={loadedStatus !== "draft"}
                  onChange={(event) => setEmailReportExcel(event.target.checked)}
                />
                Excel Raw Report (.xlsx)
              </label>
              <label htmlFor="email_report_pdf" className="flex items-center gap-3 text-sm text-slate-700">
                <input
                  id="email_report_pdf"
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={emailReportPdf}
                  disabled={loadedStatus !== "draft"}
                  onChange={(event) => setEmailReportPdf(event.target.checked)}
                />
                Visual Branded Report (.pdf)
              </label>
              {!emailReportExcel && !emailReportPdf && (
                <p role="alert" className="text-sm text-red-700">Select at least one report format.</p>
              )}
            </fieldset>
          )}
        </section>

        {loadedStatus === "draft" && questions.map((question, questionIndex) => (
          <section key={question.id} className="panel space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-brand">Question {questionIndex + 1}</h2>
              {questions.length > 1 && <button type="button" className="text-sm font-semibold text-red-600" onClick={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))}>Remove question</button>}
            </div>
            <div>
              <label className="field-label" htmlFor={"question-" + question.id}>Question text</label>
              <AutocompleteInput
                id={"question-" + question.id}
                maxLength={255}
                required
                searchFn={searchQuestions}
                searchType="question"
                value={question.name}
                onChange={(value) => updateQuestion(questionIndex, { name: value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor={"question-description-" + questionIndex}>Question description (optional)</label>
              <textarea className="field" id={"question-description-" + questionIndex} rows={2} value={question.description} onChange={(event) => updateQuestion(questionIndex, { description: event.target.value })} />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Answer options (at least two)</p>
              {question.options.map((option, optionIndex) => (
                <div key={option.id} className="flex items-center gap-2">
                  <input
                    id={"option-" + question.id + "-" + option.id}
                    className="field"
                    aria-label={"Option " + (optionIndex + 1)}
                    maxLength={255}
                    placeholder={"Option " + (optionIndex + 1)}
                    required
                    value={option.name}
                    onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)}
                  />
                  {question.options.length > 2 && <button type="button" aria-label="Remove option" className="rounded-lg border border-border px-3 py-2 text-sm text-red-600" onClick={() => removeOption(questionIndex, optionIndex)}>×</button>}
                </div>
              ))}
              <button type="button" className="text-sm font-semibold text-interactive hover:underline" onClick={() => addOption(questionIndex)}>+ Add option</button>
            </div>
          </section>
        ))}

        {loadedStatus === "draft" && <button type="button" className="btn-secondary w-full" onClick={addQuestion}>+ Add another question</button>}
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
