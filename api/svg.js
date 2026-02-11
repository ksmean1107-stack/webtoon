export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  // 1. 파라미터 받기
  const bg = searchParams.get('bg') || '1';
  const bgNum = parseInt(bg);
  const imgParam = searchParams.get('img');
  const text = searchParams.get('text') || '';
  const de = searchParams.get('de') || '';
  const ef = searchParams.get('ef') || '';

  // ==================================================================================
  // [설정 A] BG 리스트: 1부터 20까지 자동 생성 (igx.kr 경로 반영)
  // ==================================================================================
  const BG_LIST = {};
  for (let i = 1; i <= 20; i++) {
    BG_LIST[i.toString()] = `https://igx.kr/v/1H/WEBTOON/${i}`;
  }
  BG_LIST["default"] = "https://via.placeholder.com/400x500/cccccc/666666?text=No+BG+Image";

  // ==================================================================================
  // [설정 B] IMG 리스트
  // ==================================================================================
  const IMG_LIST = {
    "1": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400",
    "2": "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=400",
    "smile": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"
  };

  // ==================================================================================
  // [로직] 최종 이미지 결정 (우선순위: img번호 > img링크 > bg번호)
  // ==================================================================================
  let rawImgUrl = BG_LIST["default"];
  if (imgParam) {
    rawImgUrl = IMG_LIST[imgParam] || imgParam;
  } else if (BG_LIST[bg]) {
    rawImgUrl = BG_LIST[bg];
  }

  // ==================================================================================
  // [보안/작동 핵심] 403 우회 및 Base64 변환
  // ==================================================================================
  let finalImgData = "";
  try {
    // igx.kr의 직접 호출 차단을 피하기 위해 wsrv.nl 프록시 사용
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(rawImgUrl)}`;
    const imageResp = await fetch(proxyUrl);
    if (imageResp.ok) {
      const arrayBuffer = await imageResp.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      finalImgData = `data:image/png;base64,${base64}`;
    }
  } catch (e) {
    finalImgData = rawImgUrl; // 실패 시 원본 링크 시도
  }

  // ==================================================================================
  // [설정 C] 레이아웃 설정 (사용자 코드 그대로 유지)
  // ==================================================================================
  const LAYOUT_CONFIG = {
    "1-3": { 
      show: ["de", "img", "text"],
      img:  { x: 20, y: 70, w: 150, h: 150 },
      de:   { y: 32, fontSize: 14, bgColor: "rgba(0,0,0,0.7)" },
      text: { y: 410, h: 70, fontSize: 18 },
      ef:   { x: 200, y: 250, fontSize: 40, rotate: -5 }
    },
    "4-10": { 
      show: ["img", "text"],
      img:  { x: 50, y: 80, w: 300, h: 300 },
      de:   { y: 32, fontSize: 14, bgColor: "rgba(0,0,0,0.7)" },
      text: { y: 410, h: 70, fontSize: 18 },
      ef:   { x: 200, y: 250, fontSize: 40, rotate: -5 }
    },
    "11-14": { 
      show: ["img", "text", "ef"],
      img:  { x: -50, y: 20, w: 500, h: 500 },
      de:   { y: 32, fontSize: 14, bgColor: "rgba(0,0,0,0.7)" },
      text: { y: 410, h: 70, fontSize: 18 },
      ef:   { x: 200, y: 200, fontSize: 50, rotate: 10 }
    },
    "15-18": { 
      show: ["img", "text"],
      img:  { x: 75, y: 40, w: 250, h: 350 },
      de:   { y: 32, fontSize: 14, bgColor: "rgba(0,0,0,0.7)" },
      text: { y: 410, h: 70, fontSize: 18 },
      ef:   { x: 200, y: 250, fontSize: 40, rotate: -5 }
    },
    "19-20": { 
      show: ["de", "img"],
      img:  { x: 0, y: 0, w: 400, h: 500 },
      de:   { y: 32, fontSize: 16, bgColor: "rgba(255,0,0,0.8)" },
      text: { y: 410, h: 70, fontSize: 18 },
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
      <rect width="100%" height="100%" fill="#eee" />

      ${conf.show.includes("img") ? `
        <image href="${finalImgData}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip)" />
      ` : ''}

      ${conf.show.includes("de") && de ? `
        <rect x="0" y="0" width="400" height="50" fill="${conf.de.bgColor}" />
        <text x="50%" y="${conf.de.y}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${conf.de.fontSize}" fill="white">${esc(de)}</text>
      ` : ''}

      ${conf.show.includes("text") && text ? `
        <rect x="20" y="${conf.text.y}" width="360" height="${conf.text.h}" rx="15" fill="white" stroke="#333" stroke-width="3" />
        <text x="50%" y="${conf.text.y + conf.text.h/2 + 5}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${conf.text.fontSize}" fill="black">${esc(text)}</text>
      ` : ''}

      ${conf.show.includes("ef") && ef ? `
        <text x="${conf.ef.x}" y="${conf.ef.y}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.fontSize}" fill="#ff0" stroke="#000" stroke-width="2" transform="rotate(${conf.ef.rotate}, ${conf.ef.x}, ${conf.ef.y})">${esc(ef)}</text>
      ` : ''}
    </svg>
  `.trim();

  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } });
}
