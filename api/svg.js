export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  // 1. 파라미터 받기
  const bg = searchParams.get('bg') || '1';
  const bgNum = parseInt(bg);
  const imgParam = searchParams.get('img'); // 웹툰 그림(일러스트)
  const text = searchParams.get('text') || '';
  const de = searchParams.get('de') || '';
  const ef = searchParams.get('ef') || '';

  // 이미지 프록시 및 Base64 변환 함수 (403 에러 방지)
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
  // bg: 흰색 뒷배경(프레임), img: 실제 그림
  const bgUrl = `https://igx.kr/v/1H/WEBTOON/${bg}`;
  
  // IMG_LIST (주인공/조연 등 프리셋)
  const IMG_LIST = {
    "1": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400",
    "2": "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=400"
  };
  const imgUrl = IMG_LIST[imgParam] || imgParam;

  // 두 이미지 모두 Base64로 변환 (속도와 안정성 위해 병렬 처리)
  const [finalBgData, finalImgData] = await Promise.all([
    getImgData(bgUrl),
    getImgData(imgUrl)
  ]);

  // 3. 레이아웃 설정 (기존 로직 유지)
  const LAYOUT_CONFIG = {
    "1-3": { 
      show: ["de", "img", "text"],
      img:  { x: 20, y: 70, w: 150, h: 150 },
      de:   { y: 35, fontSize: 16, color: "#333" },
      text: { y: 440, fontSize: 20, color: "#000" },
      ef:   { x: 200, y: 250, fontSize: 40, rotate: -5 }
    },
    "4-10": { 
      show: ["img", "text"],
      img:  { x: 50, y: 80, w: 300, h: 300 },
      de:   { y: 35, fontSize: 16, color: "#333" },
      text: { y: 440, fontSize: 20, color: "#000" },
      ef:   { x: 200, y: 250, fontSize: 40, rotate: -5 }
    },
    "11-14": { 
      show: ["img", "text", "ef"],
      img:  { x: 0, y: 0, w: 400, h: 500 }, // 강조형은 크게
      de:   { y: 35, fontSize: 16, color: "#333" },
      text: { y: 440, fontSize: 20, color: "#000" },
      ef:   { x: 200, y: 200, fontSize: 50, rotate: 10 }
    },
    "15-18": { 
      show: ["img", "text"],
      img:  { x: 75, y: 40, w: 250, h: 350 },
      de:   { y: 35, fontSize: 16, color: "#333" },
      text: { y: 440, fontSize: 20, color: "#000" },
      ef:   { x: 200, y: 250, fontSize: 40, rotate: -5 }
    },
    "19-20": { 
      show: ["de", "img"],
      img:  { x: 0, y: 0, w: 400, h: 500 },
      de:   { y: 40, fontSize: 22, color: "#fff" }, // 전체화면형은 글자 크게
      text: { y: 440, fontSize: 20, color: "#000" },
      ef:   { x: 200, y: 250, fontSize: 40, rotate: -5 }
    }
  };

  let conf;
  if (bgNum <= 3) conf = LAYOUT_CONFIG["1-3"];
  else if (bgNum <= 10) conf = LAYOUT_CONFIG["4-10"];
  else if (bgNum <= 14) conf = LAYOUT_CONFIG["11-14"];
  else if (bgNum <= 18) conf = LAYOUT_CONFIG["15-18"];
  else conf = LAYOUT_CONFIG["19-20"];

  const esc = (s) => (s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // SVG 생성
  const svg = `
    <svg width="400" height="500" viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="clip"><rect x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" rx="10" /></clipPath>
      </defs>
      
      <image href="${finalBgData}" width="400" height="500" preserveAspectRatio="xMidYMid slice" />

      ${conf.show.includes("img") && finalImgData ? `
        <image href="${finalImgData}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip)" />
      ` : ''}

      ${conf.show.includes("de") && de ? `
        <text x="50%" y="${conf.de.y}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${conf.de.fontSize}" fill="${conf.de.color || 'black'}">${esc(de)}</text>
      ` : ''}

      ${conf.show.includes("text") && text ? `
        <text x="50%" y="${conf.text.y}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${conf.text.fontSize}" fill="${conf.text.color || 'black'}">${esc(text)}</text>
      ` : ''}

      ${conf.show.includes("ef") && ef ? `
        <text x="${conf.ef.x}" y="${conf.ef.y}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.fontSize}" fill="#ff0" stroke="#000" stroke-width="2" transform="rotate(${conf.ef.rotate}, ${conf.ef.x}, ${conf.ef.y})">${esc(ef)}</text>
      ` : ''}
    </svg>
  `.trim();

  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } });
}
