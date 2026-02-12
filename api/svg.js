export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    const bgParam = searchParams.get('bg') || '1';
    const bgNum = parseInt(bgParam) || 1;
    const imgParam = searchParams.get('img') || '1';
    const deRaw = searchParams.get('de') || '';
    const textRaw = searchParams.get('text') || '';
    const efRaw = searchParams.get('ef') || '';

    // 1. 대역별 파라미터 제한 로직
    let showDe = false, showText = false, showEf = false;
    if (bgNum >= 1 && bgNum <= 3) { showDe = true; showText = true; }
    else if ((bgNum >= 4 && bgNum <= 10) || (bgNum >= 15 && bgNum <= 18)) { showText = true; }
    else if (bgNum >= 11 && bgNum <= 14) { showText = true; showEf = true; }
    else if (bgNum >= 19 && bgNum <= 20) { showDe = true; }

    const process = (str) => str ? str.replace(/_/g, ' ').split('/') : [];
    const esc = (s) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&#x22;',"'":'&#x27;'}[m]));

    const deLines = showDe ? process(deRaw) : [];
    const textLines = showText ? process(textRaw) : [];
    const efLines = showEf ? process(efRaw) : [];

    // 2. [수정] 레이아웃 1-3 좌표 반영 (51, 462, 795, 1204)
    const LAYOUTS = {
      "1-3":   { img: {x:51, y:462, w:795, h:1204}, de: {y:180, size:42}, text: {y:1800, size:50}, ef: {x:512, y:950, size:130, rot:-5} },
      "4-10":  { img: {x:0, y:200, w:1024, h:1400}, de: {y:150, size:40}, text: {y:1850, size:55}, ef: {x:512, y:1000, size:130, rot:0} },
      "11-14": { img: {x:50, y:100, w:924, h:1500}, de: {y:150, size:40}, text: {y:1800, size:50}, ef: {x:512, y:800, size:160, rot:-10} },
      "15-18": { img: {x:112, y:400, w:800, h:800},  de: {y:150, size:40}, text: {y:1850, size:55}, ef: {x:512, y:1000, size:130, rot:5} },
      "19-20": { img: {x:0, y:0, w:1024, h:2000},   de: {y:250, size:60}, text: {y:1800, size:50}, ef: {x:512, y:1000, size:130, rot:0} }
    };

    let conf = (bgNum <= 3) ? LAYOUTS["1-3"] : (bgNum <= 10) ? LAYOUTS["4-10"] : (bgNum <= 14) ? LAYOUTS["11-14"] : (bgNum <= 18) ? LAYOUTS["15-18"] : LAYOUTS["19-20"];

    // 3. [이미지 로드 강화] 프록시 옵션 추가 및 에러 핸들링
    const getImg = async (url) => {
      try {
        // wsrv.nl 뒤에 &n=1 옵션을 추가하여 캐시 문제나 인코딩 문제를 방어합니다.
        const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&n=1`;
        const resp = await fetch(proxyUrl);
        if (!resp.ok) return "";
        const buf = await resp.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        return `data:image/png;base64,${base64}`;
      } catch (e) {
        console.error("Img Load Error:", e);
        return "";
      }
    };

    const bgUrl = `https://igx.kr/v/1H/WEBTOON/${bgNum}`;
    const imgUrl = imgParam.startsWith('http') ? imgParam : `https://igx.kr/v/1H/WEB_IMG/${imgParam}`;
    const [bgData, imgData] = await Promise.all([getImg(bgUrl), getImg(imgUrl)]);

    // 4. 말풍선 계산 (타원형)
    const fSize = conf.text.size;
    const calcW = (lines) => {
      let maxW = 0;
      lines.forEach(l => {
        let w = 0;
        for (let i=0; i<l.length; i++) {
          const c = l.charCodeAt(i);
          w += (c > 0x2500) ? fSize : (c >= 48 && c <= 57 || c === 32 || c === 63 || c === 33) ? fSize * 0.6 : fSize * 0.8;
        }
        if (w > maxW) maxW = w;
      });
      return maxW;
    };

    const tW = calcW(textLines);
    const rx = (tW + 140) / 2;
    const ry = ((textLines.length * fSize * 1.4) + 100) / 2;
    const cy = conf.text.y;

    // 5. SVG 생성
    const svg = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="2000" fill="#eee" /> <image href="${bgData}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />
      ${imgData ? `<image href="${imgData}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />` : ''}
      
      ${deLines.map((l, i) => `<text x="512" y="${conf.de.y + (i*conf.de.size*1.3)}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${conf.de.size}" fill="#222">${esc(l)}</text>`).join('')}

      ${textLines.length > 0 ? `
        <ellipse cx="512" cy="${cy}" rx="${rx}" ry="${ry}" fill="white" stroke="black" stroke-width="6" />
        ${textLines.map((l, i) => `<text x="512" y="${cy - ry + 50 + (i+0.8)*fSize*1.4}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${fSize}" fill="#000">${esc(l)}</text>`).join('')}
      ` : ''}

      ${efLines.map((l, i) => `<text x="${conf.ef.x}" y="${conf.ef.y + (i*conf.ef.size)}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.size}" fill="#FF0" stroke="#000" stroke-width="10" stroke-linejoin="round" transform="rotate(${conf.ef.rot}, ${conf.ef.x}, ${conf.ef.y})">${esc(l)}</text>`).join('')}
    </svg>`;

    return new Response(svg.trim(), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } });
  } catch (e) {
    return new Response(`<svg><text y="20">Error: ${e.message}</text></svg>`, { headers: { 'Content-Type': 'image/svg+xml' } });
  }
}
