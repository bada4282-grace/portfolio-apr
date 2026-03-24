import path from "path";
import React from "react";
import { Document, Page, Text, StyleSheet, Font } from "@react-pdf/renderer";

// 자주 쓰는 한글·라틴 묶음(폰트소스 unicode [119])
const fontPath = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-sans-kr/files/noto-sans-kr-119-400-normal.woff"
);

Font.register({
  family: "NotoSansKR",
  src: fontPath,
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "NotoSansKR",
    fontSize: 10,
    lineHeight: 1.55,
  },
  title: { fontSize: 15, marginBottom: 10 },
  meta: { fontSize: 8, color: "#555555", marginBottom: 14 },
  paragraph: { marginBottom: 10 },
});

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** 한 페이지에 넣을 수 있는 분량으로 나눔 */
function chunkBodyForPages(body: string, maxChars = 3600): string[] {
  const paras = splitParagraphs(body);
  const pages: string[] = [];
  let cur = "";
  for (const p of paras) {
    const next = cur ? `${cur}\n\n${p}` : p;
    if (next.length > maxChars && cur) {
      pages.push(cur);
      cur = p;
    } else {
      cur = next;
    }
  }
  if (cur) pages.push(cur);
  return pages.length > 0 ? pages : [body.slice(0, maxChars)];
}

export type ReportPdfDocumentProps = {
  title: string;
  generatedAt: string;
  body: string;
};

export function ReportPdfDocument({ title, generatedAt, body }: ReportPdfDocumentProps) {
  const pageBodies = chunkBodyForPages(body);
  return (
    <Document>
      {pageBodies.map((chunk, idx) => (
        <Page key={idx} size="A4" style={styles.page}>
          {idx === 0 ? (
            <>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.meta}>생성 시각(서버): {generatedAt}</Text>
            </>
          ) : (
            <Text style={styles.meta}>(계속 — {idx + 1}쪽)</Text>
          )}
          {splitParagraphs(chunk).map((p, i) => (
            <Text key={i} style={styles.paragraph}>
              {p}
            </Text>
          ))}
        </Page>
      ))}
    </Document>
  );
}
