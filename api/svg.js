export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  // 1. 파라미터 추출
  const bg = searchParams.get('bg') || '1';
  const bgNum = parseInt(bg);
  const imgParam = searchParams.get('img'); 
  const text = searchParams.get('text') || '';
  const de = searchParams.get('de') || '';
  const ef = searchParams.get('ef') || '';

  // 이미지 프록시 및 Base64 변환 (서버 차단 우회 및 렌더링 보장)
  const getImgData = async (url) => {
    try {
      if (!url) return "";
      const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
      const resp = await fetch(proxyUrl);
      if (!resp.ok) return url;
      const arrayBuffer = await resp.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      return `data:image/png;base64,${base64}`;
    } catch (e) { return url; }
  };

  // 2. 이미지 주소 결정
  const bgUrl = `https://igx.kr/v/1H/WEBTOON/${bg}`;
  const IMG_LIST = {
    "1": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=1024",
    "2": "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=1024"
  };
  const imgUrl = IMG_LIST[imgParam] || imgParam;

  const [finalBgData, finalImgData] = await Promise.all([
    getImgData(bgUrl),
    getImgData(imgUrl)
  ]);

  // 3. 레이아웃 설정 (1024x2000 꽉 차는 비율로 재설정)
  const LAYOUT_CONFIG = {
    "1-3": { 
      show: ["de", "img", "text"],
      img:  { x: 0, y: 0, w: 1024, h: 2000 }, // 배경과 동일하게 꽉 채움
      de:   { y: 150, fontSize: 45, color: "#333" },
      text: { y: 1850, fontSize: 55, color: "#000" },
      ef:   { x: 512, y: 1000, fontSize: 100, rotate: -5 }
    },
    "4-10": { 
      show: ["img", "text"],
      img:  { x: 0, y: 200, w: 1024, h: 1600 }, // 상하 여백만 살짝 둔 꽉 찬 스타일
      de:   { y: 150, fontSize: 45, color: "#333" },
      text: { y: 1900, fontSize: 55, color: "#000" },
      ef:   { x: 512, y: 1000, fontSize: 100, rotate: -5 }
    },
    "11-14": { 
      show: ["img", "text", "ef"],
      img:  { x: 0, y: 0, w: 1024, h: 2000 },
      de:   { y: 150, fontSize: 45, color: "#333" },
      text: { y: 1850, fontSize: 55, color: "#000" },
      ef:   { x: 512, y: 800, fontSize: 120, rotate: 10 }
    },
    "15-18": { 
      show: ["img", "text"],
      img:  { x: 0, y: 0, w: 1024, h: 2000 },
      de:   { y: 150, fontSize: 45, color: "#333" },
      text: { y: 1850, fontSize: 55, color: "#000" },
      ef:   { x: 512, y: 1000, fontSize: 100, rotate: -5 }
    },
    "19-20": { 
      show: ["de", "img"],
      img:  { x: 0, y: 0, w: 1024, h: 2000 },
      de:   { y: 200, fontSize: 60, color: "#fff" },
      text: { y: 1850, fontSize: 55, color: "#000" },
      ef:   { x: 512, y: 1000, fontSize: 100, rotate: -5 }
    }
  };

  let conf;
  if (bgNum <= 3) conf = LAYOUT_CONFIG["1-3"];
  else if (bgNum <= 10) conf = LAYOUT_CONFIG["4-10"];
  else if (bgNum <= 14) conf = LAYOUT_CONFIG["11-14"];
  else if (bgNum <= 18) conf = LAYOUT_CONFIG["15-18"];
  else conf = LAYOUT_CONFIG["19-20"];

  const esc = (s) => (s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // 4. SVG 생성
  const svg = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="2000" fill="#ffffff" />

      <image href="${finalBgData}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />

      ${conf.show.includes("img") && finalImgData ? `
        <image href="${finalImgData}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />
      ` : ''}

      ${conf.show.includes("de") && de ? `
        <text x="512" y="${conf.de.y}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${conf.de.fontSize}" fill="${conf.de.color}">${esc(de)}</text>
      ` : ''}

      ${conf.show.includes("text") && text ? `
        <text x="512" y="${conf.text.y}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${conf.text.fontSize}" fill="${conf.text.color}">${esc(text)}</text>
      ` : ''}

      ${conf.show.includes("ef") && ef ? `
        <text x="${conf.ef.x}" y="${conf.ef.y}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.fontSize}" fill="#ff0" stroke="#000" stroke-width="4" transform="rotate(${conf.ef.rotate}, ${conf.ef.x}, ${conf.ef.y})">${esc(ef)}</text>
      ` : ''}
    </svg>
  `.trim();

  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } });
}
