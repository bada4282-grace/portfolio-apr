import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { ReportPdfDocument } from "@/components/report/ReportPdfDocument";

export const dynamic = "force-dynamic";

interface Body {
  title?: string;
  body?: string;
}

export async function POST(req: Request) {
  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "AI 리포트";
  const body = typeof payload.body === "string" ? payload.body : "";
  if (!body.trim()) {
    return NextResponse.json({ error: "body에 PDF로 넣을 텍스트가 필요합니다." }, { status: 400 });
  }

  const generatedAt = new Date().toISOString();

  try {
    const buffer = await renderToBuffer(
      <ReportPdfDocument title={title} generatedAt={generatedAt} body={body} />
    );

    const safeName = encodeURIComponent(`report-${generatedAt.slice(0, 10)}.pdf`);

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("PDF 생성 오류:", err);
    return NextResponse.json({ error: "PDF 생성에 실패했습니다." }, { status: 500 });
  }
}
