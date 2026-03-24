import * as deepl from "deepl-node";

// Free tier: api-free.deepl.com / Pro tier: api.deepl.com
// deepl-node SDK automatically uses Free endpoint when API key ends with ':fx'

let _translator: deepl.Translator | null = null;
let _cachedKey: string | null = null;

/** 매 요청 시 키를 읽고, 빈 키로 Translator를 만들어 캐시하는 실수를 방지 */
function getTranslator(): deepl.Translator | null {
  const key = process.env.DEEPL_API_KEY?.trim() ?? "";
  if (!key) {
    _translator = null;
    _cachedKey = null;
    return null;
  }
  if (_cachedKey !== key) {
    _translator = new deepl.Translator(key);
    _cachedKey = key;
  }
  return _translator;
}

// \uB2E8\uC77C \uD14D\uC2A4\uD2B8\uB97C \uD55C\uAD6D\uC5B4\uB85C \uBC88\uC5ED (\uC2E4\uD328 \uC2DC \uC6D0\uBB38 \uBC18\uD658)
export async function translateToKorean(text: string): Promise<string> {
  if (!text.trim()) return text;
  const translator = getTranslator();
  if (!translator) return text;
  try {
    const result = await translator.translateText(text, null, "ko");
    return Array.isArray(result) ? result[0].text : result.text;
  } catch {
    return text;
  }
}

// \uC81C\uBAA9 + \uBCF8\uBB38\uC744 \uD55C\uAD6D\uC5B4\uB85C \uBC88\uC5ED
export async function translateEntry(
  title: string,
  content: string
): Promise<{ title: string; summary: string }> {
  // \uBCF8\uBB38\uC740 500\uC790\uB85C \uC81C\uD55C\uD574 \uC694\uC57D \uC5ED\uD560
  const trimmedContent = content.slice(0, 500);

  const [translatedTitle, translatedSummary] = await Promise.all([
    translateToKorean(title),
    translateToKorean(trimmedContent),
  ]);

  return {
    title: translatedTitle.slice(0, 60),    // \uC81C\uBAA9 \uCD5C\uB300 60\uC790
    summary: translatedSummary.slice(0, 300), // \uC694\uC57D \uCD5C\uB300 300\uC790
  };
}