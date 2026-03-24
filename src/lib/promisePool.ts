/**
 * 비동기 작업을 동시에 최대 poolSize개만 실행 (DeepL/API rate limit 대응)
 */
export async function mapPool<T, R>(
  items: readonly T[],
  poolSize: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const n = items.length;
  const out: R[] = new Array(n);
  let next = 0;

  const worker = async () => {
    while (true) {
      const i = next;
      next += 1;
      if (i >= n) return;
      out[i] = await mapper(items[i]!, i);
    }
  };

  const size = Math.max(1, Math.min(poolSize, n));
  await Promise.all(Array.from({ length: size }, () => worker()));
  return out;
}
