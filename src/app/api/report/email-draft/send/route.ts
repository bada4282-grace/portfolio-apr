import { appendFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

/** 디버그 ingest가 파일에 안 남는 환경용 — 비밀값·이메일 전체는 기록하지 않음 */
function agentDebugLog(payload: Record<string, unknown>): void {
  const obj = {
    sessionId: "8a06d9",
    ...payload,
    timestamp: Date.now(),
  };
  const line = JSON.stringify(obj) + "\n";
  // Turbopack 워커는 console.error 일부가 IDE 터미널에 안 보일 수 있어 stdout에도 동기 기록
  const oneLine = "__AGENT_DEBUG_8a06d9__" + JSON.stringify(obj) + "\n";
  try {
    process.stdout.write(oneLine);
  } catch {
    /* ignore */
  }
  console.error("__AGENT_DEBUG_8a06d9__" + JSON.stringify(obj));
  // npm run 시 루트는 INIT_CWD가 더 안정적일 때가 있음(Turbopack/서브프로세스에서 cwd 불일치)
  const roots = [...new Set([process.env.INIT_CWD, process.cwd()].filter(Boolean) as string[])];
  let ok = false;
  for (const root of roots) {
    try {
      appendFileSync(join(root, "debug-8a06d9.log"), line, "utf8");
      ok = true;
      break;
    } catch {
      /* 다음 후보 경로 시도 */
    }
  }
  if (!ok && process.env.NODE_ENV === "development") {
    console.warn("[agentDebugLog] debug-8a06d9.log 기록 실패(쓰기 권한·경로 확인). 시도한 루트:", roots);
  }
}

const BodySchema = z.object({
  to: z.string().email("유효한 이메일 주소를 입력해 주세요."),
  subject: z.string().min(1, "제목을 입력해 주세요.").max(998),
  body: z.string().min(1, "본문을 입력해 주세요.").max(100_000),
});

/** .env에 실수로 감싼 따옴표가 값에 들어가면 Gmail이 535로 거부할 수 있음 */
function unquoteEnvValue(raw: string | undefined): string {
  if (raw == null) return "";
  let s = raw.replace(/^\uFEFF/, "").trim();
  if (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
  ) {
    s = s.slice(1, -1).replace(/^\uFEFF/, "").trim();
  }
  return s;
}

/** 복사 시 섞이는 ZWSP 등 — 글자 수는 같아 보여도 SMTP 비밀번호가 달라져 535이 날 수 있음 */
function stripInvisibleFromSecret(s: string): string {
  return s.replace(/[\u200B-\u200D\uFEFF\u2060\u180E]/g, "");
}

/** Gmail 앱 비밀번호는 화면에 공백으로 보이나 실제 값은 공백 없음 — .env에 공백이 들어가면 535 EAUTH 발생 */
function normalizeGmailAppPassword(raw: string | undefined): string {
  if (raw == null || raw === "") return "";
  const spaced = unquoteEnvValue(raw).replace(/\s+/g, "");
  return stripInvisibleFromSecret(spaced);
}

function normalizeGmailUser(raw: string | undefined): string {
  const u = unquoteEnvValue(raw).trim();
  if (/@(gmail|googlemail)\.com$/i.test(u)) {
    return u.toLowerCase();
  }
  return u;
}

/** nodemailer 오류 필드가 enumerable이 아니면 직접 읽히지 않아 분기가 빗나갈 수 있음 */
function readSmtpErrMeta(err: unknown): {
  responseCode: number | null;
  code: string | null;
  command: string | null;
} {
  if (!err || typeof err !== "object") {
    return { responseCode: null, code: null, command: null };
  }
  const o = err as Record<string, unknown>;
  return {
    responseCode: typeof o.responseCode === "number" ? o.responseCode : null,
    code: typeof o.code === "string" ? o.code : null,
    command: typeof o.command === "string" ? o.command : null,
  };
}

type GmailInit =
  | { transporter: ReturnType<typeof nodemailer.createTransport>; user: string }
  | { error: string; invalidAppPassLength?: boolean };

/** Nodemailer 권장: service 'gmail' (내부적으로 SMTP·TLS 처리) */
function createGmailTransport(): GmailInit {
  const user = normalizeGmailUser(process.env.GMAIL_USER);
  const pass = normalizeGmailAppPassword(process.env.GMAIL_APP_PASS);

  if (!user || !pass) {
    return { error: "GMAIL_USER 또는 GMAIL_APP_PASS가 설정되지 않았습니다." };
  }

  // Google 일반 계정 앱 비밀번호는 공백 제거 후 16자 — 한 글자만 빠져도 535 EAUTH
  if (pass.length !== 16) {
    return {
      error: `GMAIL_APP_PASS는 공백·따옴표 제거 후 정확히 16자여야 합니다. 현재 ${pass.length}자로 읽혔습니다. Google 계정 → 보안 → 앱 비밀번호에서 새로 발급해 .env.local에 붙여넣으세요.`,
      invalidAppPassLength: true,
    };
  }

  // #region agent log — 비밀번호 값은 출력하지 않음. 길이로 env 주입·따옴표 여부만 확인.
  {
    const rawPass = process.env.GMAIL_APP_PASS;
    const envLine = `[email-draft/send] USER: ${user} | PASS rawLen: ${rawPass?.length ?? 0} | PASS normalizedLen: ${pass.length} (값 미출력)\n`;
    try {
      process.stdout.write(envLine);
    } catch {
      /* ignore */
    }
    console.log(
      "[email-draft/send] USER:",
      user,
      "| PASS rawLen:",
      rawPass?.length ?? 0,
      "| PASS normalizedLen:",
      pass.length,
      "(값 미출력)",
    );
  }
  // #endregion

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return { transporter, user };
}

export async function POST(req: Request) {
  const gmail = createGmailTransport();
  if ("error" in gmail) {
    // #region agent log
    {
      const passLen = normalizeGmailAppPassword(process.env.GMAIL_APP_PASS).length;
      {
        const body = {
          sessionId: "8a06d9",
          runId: "terminal-ndjson",
          hypothesisId: gmail.invalidAppPassLength ? "A" : "C",
          location: "send/route.ts:POST:gmail-init-error",
          message: "Gmail transport init failed",
          data: {
            invalidAppPassLength: Boolean(gmail.invalidAppPassLength),
            passLenAfterNormalize: passLen,
            envPassSet: Boolean(process.env.GMAIL_APP_PASS),
            envUserSet: Boolean(process.env.GMAIL_USER),
          },
        };
        agentDebugLog(body);
        fetch("http://127.0.0.1:7941/ingest/0fffd798-6878-4afb-8f04-8b34eb04beba", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8a06d9" },
          body: JSON.stringify({ ...body, timestamp: Date.now() }),
        }).catch(() => {});
      }
    }
    // #endregion
    const status = gmail.invalidAppPassLength ? 400 : 503;
    return NextResponse.json({ error: gmail.error }, { status });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      first.to?.[0] ?? first.subject?.[0] ?? first.body?.[0] ?? "입력값을 확인해 주세요.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { to, subject, body } = parsed.data;
  const { transporter, user } = gmail;
  const appPassLen = normalizeGmailAppPassword(process.env.GMAIL_APP_PASS).length;

  try {
    await transporter.sendMail({
      from: user,
      to,
      subject,
      text: body,
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("Gmail SMTP 발송 오류:", err);
    const smtp = readSmtpErrMeta(err);
    const u = normalizeGmailUser(process.env.GMAIL_USER);
    // #region agent log
    const smtpFailMeta = {
      sessionId: "8a06d9",
      runId: "catch-always",
      hypothesisId: "B",
      location: "send/route.ts:POST:sendMail-catch",
      message: "sendMail failed",
      data: {
        nodeEnv: process.env.NODE_ENV ?? "",
        responseCode: smtp.responseCode,
        smtpCode: smtp.code,
        /** SMTP AUTH에 실제로 넣은 주소(정규화 후) */
        smtpAuthUser: user,
        passRawLen: process.env.GMAIL_APP_PASS?.length ?? 0,
        passNormalizedLen: appPassLen,
        gmailUserDomain: u.includes("@") ? (u.split("@")[1] ?? "").toLowerCase() : "",
        authCommand: smtp.command,
      },
    };
    agentDebugLog(smtpFailMeta);
    if (smtp.responseCode === 535 || smtp.code === "EAUTH") {
      fetch("http://127.0.0.1:7941/ingest/0fffd798-6878-4afb-8f04-8b34eb04beba", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8a06d9" },
        body: JSON.stringify({ ...smtpFailMeta, timestamp: Date.now() }),
      }).catch(() => {});
    }
    // #endregion
    const base =
      "메일 발송에 실패했습니다. GMAIL_USER(전체 이메일)·앱 비밀번호, Gmail 보안 설정(2단계 인증·앱 비밀번호), 수신 스팸함을 확인해 주세요.";
    const msg535 =
      smtp.responseCode === 535 ||
      (err instanceof Error && /\b535\b/.test(err.message));
    const hint535 = msg535
      ? ` 앱 비밀번호는 공백·따옴표 제거 후 보통 정확히 16자입니다(현재 ${appPassLen}자로 읽힘). 한 글자 누락·복사 오류를 확인하세요. GMAIL_USER는 앱 비밀번호를 발급한 Google 계정과 동일해야 합니다. 회사 Workspace는 관리자가 앱 비밀번호를 막았을 수 있습니다.`
      : "";
    const errText = base + hint535;
    // 개발 빌드에서는 항상 진단 포함(플래그 불필요). 프로덕션은 PORTFOLIO_SMTP_DEBUG=1일 때만.
    const includeSmtpDiag =
      process.env.NODE_ENV !== "production" || process.env.PORTFOLIO_SMTP_DEBUG === "1";
    const headers = { "Cache-Control": "private, no-store" } as const;
    if (includeSmtpDiag) {
      return NextResponse.json({ error: errText, _agentDebug: smtpFailMeta }, { status: 502, headers });
    }
    return NextResponse.json({ error: errText }, { status: 502, headers });
  }
}
