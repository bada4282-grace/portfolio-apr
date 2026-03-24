import { NextResponse } from "next/server";
import { runPolicySyncPipeline } from "@/lib/policySyncRun";

export async function POST() {
  try {
    const result = await runPolicySyncPipeline();
    return NextResponse.json(result);
  } catch (err) {
    console.error("정책 동기화 오류:", err);
    const message =
      err instanceof Error ? err.message : "수집 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
