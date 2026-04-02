import Link from "next/link";
import { Shield, BarChart3, FileText, ArrowRight } from "lucide-react";

export default function Home() {
  const summaryCards = [
    {
      title: "정책 · 뉴스 모니터링",
      description:
        "아마존 · 틱톡샵 관련 정책 · 뉴스를 이커머스 전문 미디어(ChannelX 등)에서 수집해 AI가 요약합니다.",
      href: "/policy",
      icon: Shield,
      number: "1",
    },
    {
      title: "유럽 리뷰 분석",
      description:
        "프랑스 · 영국 VOC : 메디큐브 아마존 공식 스토어 리뷰를 분석하여 제품 인사이트를 파악합니다.",
      href: "/reviews",
      icon: BarChart3,
      number: "2",
    },
    {
      title: "AI 리포트 생성",
      description:
        "아마존/틱톡샵 운영팀을 위한 맞춤 리포트와 자동 발송 이메일 초안을 작성합니다. 한국어 / 영어 동시 출력.",
      href: "/report",
      icon: FileText,
      number: "3",
    },
  ];

  return (
    <div className="flex flex-col">
      {/* 히어로 영역 — 배경 이미지는 별도 레이어로 opacity 70% (텍스트는 선명 유지) */}
      <section className="relative min-h-[min(42vh,420px)] overflow-hidden bg-zinc-50 px-4 pb-20 pt-16 text-center sm:px-6 lg:px-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[url('/Medicube-banner.png')] bg-cover bg-left bg-no-repeat opacity-70"
          aria-hidden
        />
        <div className="relative z-10">
          {/* 실시간 뱃지 — 점 색은 apr_logo.svg 메인 레드(#ea0029)와 동일 */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm font-medium text-zinc-800">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-[#ea0029]"
              aria-hidden
            />
            실시간 모니터링
          </div>

          {/* 히어로 제목 — Inter 계열(sans), 5xl·semibold·#111·tight·mb-6·line-height 1 */}
          <h1 className="mb-6 font-sans text-5xl font-semibold leading-none tracking-tight text-[#111111]">
            에이피알 인텔리전스 대시보드
          </h1>
          {/* \n 줄바꿈 표시를 위해 whitespace-pre-line */}
          <p className="mx-auto max-w-xl whitespace-pre-line text-base leading-relaxed text-zinc-500">
            {`글로벌 이커머스 플랫폼 운영지원 담당자를 위한 올인원 대시보드.
정책 변경 모니터링 · 유럽 VOC 분석 · AI 리포트를 한 곳에서 관리하세요`}
          </p>
        </div>
      </section>

      {/* 카드 섹션 */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {summaryCards.map(({ title, description, href, icon: Icon, number }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-sm"
            >
              <div>
                {/* 아이콘 */}
                <div className="mb-5">
                  <Icon className="h-6 w-6 text-zinc-400" strokeWidth={1.5} />
                </div>

                {/* 번호 + 제목 */}
                <h2 className="mb-2 text-base font-semibold text-zinc-900">
                  {number}. {title}
                </h2>

                {/* 설명 */}
                <p className="text-sm leading-relaxed text-zinc-500">
                  {description}
                </p>
              </div>

              {/* 링크 — 딥 블루 기본 / 호버 시 한 단계 더 어두운 블루 */}
              <div className="mt-6 flex items-center gap-1 text-sm font-medium text-[#1e40af] transition-colors group-hover:text-[#1e3a8a]">
                자세히 보기
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 하단 안내 */}
      <section className="border-t border-zinc-100 py-8 text-center">
        <p className="text-xs text-zinc-400">
          이 대시보드는 공개 정보를 기반으로 구축된 포트폴리오 프로젝트입니다.
        </p>
      </section>
    </div>
  );
}