"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, RefreshCw, Send } from "lucide-react";

export type EmailDraftLocale = "ko" | "en";

type EmailDraftComposerProps = {
  locale: EmailDraftLocale;
};

/** RSS·리뷰 근거 메일 초안 생성 + Gmail SMTP(Nodemailer) 발송 패널 */
export function EmailDraftComposer({ locale }: EmailDraftComposerProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generateLoading, setGenerateLoading] = useState(true);
  const [sendLoading, setSendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendDiag, setSendDiag] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState(false);
  const [metaHint, setMetaHint] = useState<string | null>(null);

  const isEn = locale === "en";

  const loadDraft = useCallback(async () => {
    setError(null);
    setSendDiag(null);
    setSendOk(false);
    setGenerateLoading(true);
    setMetaHint(null);
    try {
      const res = await fetch("/api/report/email-draft/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const json = (await res.json()) as {
        subject?: string;
        body?: string;
        error?: string;
        meta?: { reviewsOk: boolean; reviewTotal: number; policyItemsUsed: number };
      };
      if (!res.ok) {
        throw new Error(
          json.error ??
            (isEn ? `Draft failed (${res.status})` : `초안 생성 실패 (${res.status})`)
        );
      }
      if (typeof json.subject !== "string" || typeof json.body !== "string") {
        throw new Error(isEn ? "Invalid response shape." : "응답 형식이 올바르지 않습니다.");
      }
      setSubject(json.subject);
      setBody(json.body);
      if (json.meta) {
        if (isEn) {
          const r = json.meta.reviewsOk
            ? `${json.meta.reviewTotal} reviews`
            : "Reviews unavailable";
          setMetaHint(`${r} · ${json.meta.policyItemsUsed} policy/news items`);
        } else {
          const r = json.meta.reviewsOk ? `리뷰 ${json.meta.reviewTotal}건` : "리뷰 조회 실패";
          setMetaHint(`${r} · 정책·뉴스 ${json.meta.policyItemsUsed}건 반영`);
        }
      }
    } catch (e) {
      setSubject("");
      setBody("");
      setError(
        e instanceof Error
          ? e.message
          : isEn
            ? "Could not load draft."
            : "초안을 불러오지 못했습니다."
      );
    } finally {
      setGenerateLoading(false);
    }
  }, [locale, isEn]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSendDiag(null);
    setSendOk(false);
    setSendLoading(true);
    try {
      const res = await fetch("/api/report/email-draft/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body: body.trim() }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        _agentDebug?: unknown;
      };
      if (!res.ok) {
        setSendDiag(
          json._agentDebug !== undefined && json._agentDebug !== null
            ? JSON.stringify(json._agentDebug, null, 2)
            : null
        );
        throw new Error(
          json.error ?? (isEn ? `Send failed (${res.status})` : `발송 실패 (${res.status})`)
        );
      }
      setSendOk(true);
    } catch (err) {
      setSendOk(false);
      setError(
        err instanceof Error
          ? err.message
          : isEn
            ? "Send failed."
            : "발송에 실패했습니다."
      );
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <section
      className="mb-6 rounded-[10px] border border-[#e5e7eb] bg-white p-5 sm:p-6"
      aria-labelledby="email-draft-heading"
    >
      <div className="mb-5 flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#ea0029]/10">
            <Mail className="h-5 w-5 text-[#ea0029]" strokeWidth={1.5} aria-hidden />
          </div>
          <div>
            <h2
              id="email-draft-heading"
              className="text-base font-bold tracking-tight text-zinc-900"
            >
              {isEn ? "Platform trends — email draft" : "플랫폼 동향 메일 초안"}
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-zinc-500">
              {isEn
                ? "Policy and news collected via RSS are reflected in the AI-written draft. Edit as needed, then send it directly to recipients."
                : "RSS로 수집한 정책·뉴스를 반영해 AI가 초안을 작성합니다. 수정 후 수신인에게 바로 발송할 수 있습니다."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadDraft()}
          disabled={generateLoading}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-[10px] border border-[#e5e7eb] bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          {generateLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          {isEn ? "Regenerate from RSS" : "RSS·데이터로 다시 작성"}
        </button>
      </div>

      {metaHint && !generateLoading ? (
        <p className="mb-4 text-xs text-zinc-500">{metaHint}</p>
      ) : null}

      {error ? (
        <p
          className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {sendDiag ? (
        <pre
          className="mb-4 max-h-48 overflow-auto rounded-[10px] border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed text-zinc-700"
          aria-label={isEn ? "SMTP diagnostic JSON" : "SMTP 진단 JSON"}
        >
          {sendDiag}
        </pre>
      ) : null}

      {sendOk ? (
        <p
          className="mb-4 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          role="status"
        >
          {isEn ? "Message sent." : "메일이 발송되었습니다."}
        </p>
      ) : null}

      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label htmlFor="email-draft-to" className="mb-1.5 block text-sm font-medium text-zinc-800">
            {isEn ? "To" : "받는 사람"}
          </label>
          <input
            id="email-draft-to"
            type="email"
            autoComplete="email"
            placeholder="colleague@company.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={generateLoading}
            className="w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50"
          />
        </div>
        <div>
          <label
            htmlFor="email-draft-subject"
            className="mb-1.5 block text-sm font-medium text-zinc-800"
          >
            {isEn ? "Subject" : "제목"}
          </label>
          <input
            id="email-draft-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={generateLoading}
            className="w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50"
          />
        </div>
        <div>
          <label htmlFor="email-draft-body" className="mb-1.5 block text-sm font-medium text-zinc-800">
            {isEn ? "Body" : "내용"}
          </label>
          <textarea
            id="email-draft-body"
            rows={14}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={generateLoading}
            className="w-full resize-y rounded-[10px] border border-[#e5e7eb] bg-white px-3.5 py-3 text-sm leading-relaxed text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={
              generateLoading || sendLoading || !to.trim() || !subject.trim() || !body.trim()
            }
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#ea0029] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#c90022] disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {sendLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            {sendLoading ? (isEn ? "Sending…" : "발송 중…") : isEn ? "Send email" : "메일 보내기"}
          </button>
          {generateLoading ? (
            <span className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-hidden />
              {isEn
                ? "Loading RSS & reviews, drafting…"
                : "정책 RSS·리뷰를 불러와 초안을 작성하는 중입니다…"}
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
