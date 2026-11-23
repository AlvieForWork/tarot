export function localDate(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
export function parseReviewId(value) {
  if (typeof value !== 'string' || !/^\d{1,3}$/.test(value.trim())) return null;
  const id = Number(value.trim());
  return id >= 1 && id <= 100 ? id : null;
}
export function randomId(cryptoProvider, previousId = null) {
  const skip = Number.isInteger(previousId) && previousId >= 1 && previousId <= 100;
  const count = skip ? 99 : 100;
  const buffer = new Uint32Array(1);
  // 拒絕餘數區間，讓可抽的每支籤等機率；排除剛抽到的一支。
  const ceiling = Math.floor(2 ** 32 / count) * count;
  do { cryptoProvider.getRandomValues(buffer); } while (buffer[0] >= ceiling);
  const id = buffer[0] % count + 1;
  return skip && id >= previousId ? id + 1 : id;
}
