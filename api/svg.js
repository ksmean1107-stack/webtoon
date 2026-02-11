export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  const bg = searchParams.get('bg') || '1';
  const bgNum = parseInt(bg);
  const imgParam = searchParams.get('img'); 
  const text = searchParams.get('text') || '';
  const de = searchParams.get('de') || '';
  const ef = searchParams.get('ef') || '';

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

  const bgUrl = `https://igx.kr/v/1H/WEBTOON/${bg}`;
  const IMG_LIST = {
    "1": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=600",
    "2": "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=600"
  };
  const imgUrl = IMG_LIST[imgParam] || imgParam;

  const [finalBgData, finalImgData] = await Promise.all([
    getImgData(bgUrl),
    getImgData(imgUrl)
  ]);

  // [레이아웃] img는 각 타입별로 지정된 영역에만 위치함
  const LAYOUT_CONFIG = {
    "1-3": { 
      show: ["de", "img", "text"],
      img:  { x: 100, y: 350, w: 824, h: 1000 }, // 중앙 배치 예시
      de:   { y: 150, fontSize: 45, color: "#333" },
      text: { y: 1850, fontSize: 55, color: "#000" },
      ef:   { x: 512, y: 1000, fontSize: 100, rotate: -5 }
    },
    "4-10": { 
      show: ["img", "text"],
      img:  { x: 112, y: 400, w: 800, h: 800 },
      de:   { y: 150, fontSize: 45, color: "#333" },
      text: { y: 1850, fontSize: 55, color: "#000" },
      ef:   { x: 512, y: 1000, fontSize: 100, rotate: -5 }
    },
    "11-14": { 
      show: ["img", "text", "ef"],
      img:  { x: 50, y: 200, w: 924, h: 1500 },
      de:   { y: 150, fontSize: 45, color: "#333" },
      text: { y: 1850, fontSize: 55, color: "#000" },
      ef:   { x: 512, y: 800, fontSize: 120, rotate: 10 }
    },
    "15-18": { 
      show: ["img", "text"],
      img:  { x: 212, y: 300, w: 600, h: 1000 },
      de:   { y: 150, fontSize: 45, color: "#333" },
      text: { y: 1850, fontSize: 55, color: "#000" },
      ef:   { x: 512, y: 1000, fontSize: 100, rotate: -5 }
    },
    "19-20": { 
      show: ["de", "img"],
      img:  { x: 100, y: 300, w: 824, h: 1200 },
      de:   { y: 150, fontSize: 60, color: "#333" },
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

  const svg = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg" style="background:white;">
      <image href="${finalBgData}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />

      ${conf.show.includes("img") && finalImgData ? `
        <image href="${finalImgData}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />
      ` : ''}

      ${conf.show.includes("de") && de ? `
        <text x="50%" y="${conf.de.y}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${conf.de.fontSize}" fill="${conf.de.color}">${esc(de)}</text>
      ` : ''}

      ${conf.show.includes("text") && text ? `
        <text x="50%" y="${conf.text.y}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${conf.text.fontSize}" fill="${conf.text.color}">${esc(text)}</text>
      ` : ''}

      ${conf.show.includes("ef") && ef ? `
        <text x="${conf.ef.x}" y="${conf.ef.y}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.fontSize}" fill="#ff0" stroke="#000" stroke-width="4" transform="rotate(${conf.ef.rotate}, ${conf.ef.x}, ${conf.ef.y})">${esc(ef)}</text>
      ` : ''}
    </svg>
  `.trim();

  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } });
}
