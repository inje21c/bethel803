// 앱 아이콘/스플래시 소스 이미지 생성 → assets/
// 그 후 `npx capacitor-assets generate`가 플랫폼별 리소스를 만든다.
import sharp from 'sharp';
import { 테스터AdirSync } from 'node:fs';

const NAVY = '#1F3A73';
const CREAM = '#F8F4EC';
const GOLD = '#D9A441';

테스터AdirSync('assets', { recursive: true });

// 펼친 책 마크 (배경 rect 없이, 투명) — viewBox 512
const bookPaths = `
  <path d="M256 154C239.26 138.717 216.292 129.033 191.867 129.033C174.098 129.033 156.83 134.203 142.533 143.804V341.053C156.83 331.452 174.098 326.282 191.867 326.282C216.292 326.282 239.26 335.966 256 351.249" stroke="${CREAM}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M256 154C272.74 138.717 295.708 129.033 320.133 129.033C337.902 129.033 355.17 134.203 369.467 143.804V341.053C355.17 331.452 337.902 326.282 320.133 326.282C295.708 326.282 272.74 335.966 256 351.249" stroke="${CREAM}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M256 154V351.249" stroke="${CREAM}" stroke-width="28" stroke-linecap="round"/>
  <path d="M162.4 183.6C171.285 180.391 181.406 178.664 191.867 178.664C212.059 178.664 230.554 184.747 245.4 195.702" stroke="${GOLD}" stroke-width="20" stroke-linecap="round"/>
  <path d="M349.6 183.6C340.715 180.391 330.594 178.664 320.133 178.664C299.941 178.664 281.446 184.747 266.6 195.702" stroke="${GOLD}" stroke-width="20" stroke-linecap="round"/>
`;

// 풀 아이콘 (네이비 라운드 + 책)
const fullIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="118" fill="${NAVY}"/>${bookPaths}</svg>`;

// adaptive 전경 (책만, 투명) — 1024
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">${bookPaths}</svg>`;

// 책 마크 단독 PNG 버퍼 (스플래시 합성용, 투명)
const markBuf = await sharp(Buffer.from(foreground)).resize(820, 820).png().toBuffer();

async function solid(size, color) {
  return sharp({ create: { width: size, height: size, channels: 4, background: color } });
}

// 1) 아이콘 소스들
await sharp(Buffer.from(fullIcon)).png().toFile('assets/icon-only.png');
await sharp(Buffer.from(foreground)).png().toFile('assets/icon-foreground.png');
await (await solid(1024, NAVY)).png().toFile('assets/icon-background.png');

// 2) 스플래시 (2732) — 라이트: 크림 배경 + 책 마크, 다크: 네이비 배경 + 책 마크
const SP = 2732;
const offset = Math.round((SP - 820) / 2);
await (await solid(SP, CREAM))
  .composite([
    // 라이트 배경엔 네이비 라운드 칩 위에 책이 보이도록 풀 아이콘 축소 합성
    { input: await sharp(Buffer.from(fullIcon)).resize(900, 900).png().toBuffer(), top: Math.round((SP - 900) / 2), left: Math.round((SP - 900) / 2) },
  ])
  .png()
  .toFile('assets/splash.png');

await (await solid(SP, NAVY))
  .composite([{ input: markBuf, top: offset, left: offset }])
  .png()
  .toFile('assets/splash-dark.png');

console.log('생성 완료: assets/{icon-only,icon-foreground,icon-background,splash,splash-dark}.png');
