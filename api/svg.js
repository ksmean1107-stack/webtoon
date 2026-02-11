export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  const bg = searchParams.get('bg') || '1';
  const bgNum = parseInt(bg);
  const imgParam = searchParams.get('img') || ''; 
  const text = searchParams.get('text') || '';
  const de = searchParams.get('de') || '';
  const ef = searchParams.get('ef') || '';

  const getImgData = async (url) => {
    try {
      if (!url || !url.startsWith('http')) return "";
      const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
      const resp = await fetch(proxyUrl);
      if (!resp.ok) return "";
      const arrayBuffer = await resp.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      return `data:image/png;base64,${base64}`;
    } catch (e) { return ""; }
  };

  const bgUrl = `https://igx.kr/v/1H/WEBTOON/${bg}`;
  const IMG_LIST = { "1": "https://igx.kr/v/1H/WEB_IMG/1" };
  const targetImgUrl = IMG_LIST[imgParam] || imgParam;

  const [finalBgData, finalImgData] = await Promise.all([
    getImgData(bgUrl),
    getImgData(targetImgUrl)
  ]);

  // ==================================================================================
  // [핵심 조절판] BG 번호에 따라 모든 요소를 따로 조절합니다.
  // ==================================================================================
  const LAYOUT_CONFIG = {
    // 1번 배경: 중앙 집중형 (예시)
    "1": {
      img:  { x: 112, y: 400, w: 800, h: 800 },
      de:   { y: 150, size: 45, color: "#222", weight: "600" },
      text: { y: 1850, size: 55, color: "#000", weight: "800" },
      ef:   { x: 512, y: 1000, size: 150, rotate: -7 }
    },
    // 2번 배경: 상단 배치형 (예시)
    "2": {
      img:  { x: 50, y: 200, w: 924, h: 1200 },
      de:   { y: 100, size: 38, color: "#444", weight: "500" },
      text: { y: 1900, size: 45, color: "#111", weight: "700" },
      ef:   { x: 800, y: 500, size: 120, rotate: 15 }
    },
    // 기본값 (번호가 설정되지 않은 경우)
    "default": {
      img:  { x: 50, y: 350, w: 924, h: 1100 },
      de:   { y: 180, size: 42, color: "#222", weight: "600" },
      text: { y: 1780, size: 50, color: "#000", weight: "800" },
      ef:   { x: 512, y: 900, size: 140, rotate: -7 }
    }
  };

  // 현재 bg 번호에 맞는 설정을 가져오거나 없으면 default 사용
  const conf = LAYOUT_CONFIG[bg] || LAYOUT_CONFIG["default"];
  const esc = (s) => (s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const svg = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <image href="${finalBgData}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />

      ${finalImgData ? `
        <image href="${finalImgData}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />
      ` : ''}

      ${de ? `<text x="512" y="${conf.de.y}" text-anchor="middle" font-family="sans-serif" font-weight="${conf.de.weight}" font-size="${conf.de.size}" fill="${conf.de.color}">${esc(de)}</text>` : ''}

      ${text ? `<text x="512" y="${conf.text.y}" text-anchor="middle" font-family="sans-serif" font-weight="${conf.text.weight}" font-size="${conf.text.size}" fill="${conf.text.color}">${esc(text)}</text>` : ''}

      ${ef ? `
        <text x="${conf.ef.x}" y="${conf.ef.y}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.size}" 
          fill="#FFFF00" stroke="#000000" stroke-width="8" stroke-linejoin="round"
          transform="rotate(${conf.ef.rotate}, ${conf.ef.x}, ${conf.ef.y})">
          ${esc(ef)}
        </text>` : ''}
    </svg>
  `.trim();

  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } });
}
