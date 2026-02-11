export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  const bg = searchParams.get('bg') || '1';
  const bgNum = parseInt(bg);
  const imgParam = searchParams.get('img') || '';
  const text = searchParams.get('text') || '';
  const de = searchParams.get('de') || '';
  const ef = searchParams.get('ef') || '';

  // 이미지 프록시 및 Base64 변환 함수
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

  // 1. BG 주소 (프레임)
  const bgUrl = `https://igx.kr/v/1H/WEBTOON/${bg}`;

  // 2. IMG 주소 (일러스트) - 커스텀 링크 로직
  const IMG_LIST = {
    "1": "https://igx.kr/v/1H/WEB_IMG/1",
    "2": "https://igx.kr/v/1H/WEB_IMG/2"
  };
  // 번호(1, 2)면 리스트에서 찾고, 아니면 입력받은 URL 그대로 사용
  const targetImgUrl = IMG_LIST[imgParam] || imgParam;

  const [finalBgData, finalImgData] = await Promise.all([
    getImgData(bgUrl),
    getImgData(targetImgUrl)
  ]);

  // [레이아웃 설정]
  const LAYOUT_CONFIG = {
    "1": { 
      img:  { x: 50, y: 350, w: 924, h: 1100 },
      de:   { y: 180, size: 42, color: "#222" },
      text: { y: 1780, size: 50, color: "#000" },
      ef:   { y: 900, size: 140 }
    }
  };
  const conf = LAYOUT_CONFIG["default"];
  const esc = (s) => (s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const svg = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <image href="${finalBgData}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />

      ${finalImgData ? `
        <image href="${finalImgData}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />
      ` : ''}

      ${de ? `<text x="512" y="${conf.de.y}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${conf.de.size}" fill="${conf.de.color}">${esc(de)}</text>` : ''}

      ${text ? `<text x="512" y="${conf.text.y}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${conf.text.size}" fill="${conf.text.color}">${esc(text)}</text>` : ''}

      ${ef ? `
        <text x="512" y="${conf.ef.y}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.size}" 
          fill="#FFFF00" stroke="#000000" stroke-width="8" stroke-linejoin="round"
          transform="rotate(-7, 512, ${conf.ef.y})">
          ${esc(ef)}
        </text>` : ''}
    </svg>
  `.trim();

  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } });
}
