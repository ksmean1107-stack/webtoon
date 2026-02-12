export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    // 1. 기본 파라미터 추출
    const bgParam = searchParams.get('bg') || '1';
    const bgNum = parseInt(bgParam) || 1;
    const imgParam = searchParams.get('img') || '1';
    const deRaw = searchParams.get('de') || '';
    const textRaw = searchParams.get('text') || '';
    const efRaw = searchParams.get('ef') || '';

    // 2. BG 대역별 허용 파라미터 필터링
    let showDe = false, showText = false, showEf = false;

    if (bgNum >= 1 && bgNum <= 3) {
      showDe = true; showText = true; // de, img, text 허용
    } else if ((bgNum >= 4 && bgNum <= 10) || (bgNum >= 15 && bgNum <= 18)) {
      showText = true; // img, text 허용
    } else if (bgNum >= 11 && bgNum <= 14) {
      showText = true; showEf = true; // img, text, ef 허용
    } else if (bgNum >= 19 && bgNum <= 20) {
      showDe = true; // de, img 허용
    }

    // 텍스트 전처리 (_ 공백, / 줄바꿈)
    const process = (str) => str ? str.replace(/_/g, ' ').split('/') : [];
    const esc = (s) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&#x22;',"'":'&#x27;'}[m]));

    const deLines = showDe ? process(deRaw) : [];
    const textLines = showText ? process(textRaw) : [];
    const efLines = showEf ? process(efRaw) : [];

    // 3. 레이아웃 엔진 (BG 번호별 상세 커스텀 가능)
    const LAYOUTS = {
      "1-3":   { img: {x:51, y:465, w:794, h:1204}, de: {y:180, size:42}, text: {y:1780, size:50}, ef: {x:512, y:950, size:130, rot:-5} },
      "4-10":  { img: {x:0, y:200, w:1024, h:1400}, de: {y:150, size:40}, text: {y:1850, size:55}, ef: {x:512, y:1000, size:130, rot:0} },
      "11-14": { img: {x:50, y:100, w:924, h:1500}, de: {y:150, size:40}, text: {y:1800, size:50}, ef: {x:512, y:800, size:160, rot:-10} },
      "15-18": { img: {x:112, y:400, w:800, h:800},  de: {y:150, size:40}, text: {y:1850, size:55}, ef: {x:512, y:1000, size:130, rot:5} },
      "19-20": { img: {x:0, y:0, w:1024, h:2000},   de: {y:250, size:60}, text: {y:1800, size:50}, ef: {x:512, y:1000, size:130, rot:0} }
    };

    let conf;
    if (bgNum <= 3) conf = LAYOUTS["1-3"];
    else if (bgNum <= 10) conf = LAYOUTS["4-10"];
    else if (bgNum <= 14) conf = LAYOUTS["11-14"];
    else if (bgNum <= 18) conf = LAYOUTS["15-18"];
    else conf = LAYOUTS["19-20"];

    // 4. 이미지 로드 (프록시 적용)
    const getImg = async (url) => {
      try {
        const resp = await fetch(`https://wsrv.nl/?url=${encodeURIComponent(url)}`);
        if (!resp.ok) return "";
        const buf = await resp.arrayBuffer();
        return `data:image/png;base64,${btoa(String.fromCharCode(...new Uint8Array(buf)))}`;
      } catch { return ""; }
    };

    const bgUrl = `https://igx.kr/v/1H/WEBTOON/${bgNum}`;
    const imgUrl = imgParam.startsWith('http') ? imgParam : `https://igx.kr/v/1H/WEB_IMG/${imgParam}`;
    const [bgData, imgData] = await Promise.all([getImg(bgUrl), getImg(imgUrl)]);

    // 5. 말풍선 너비/높이 계산 (완전 타원형)
    const fSize = conf.text.size;
    const calcW = (lines) => {
      let maxW = 0;
      lines.forEach(l => {
        let w = 0;
        for (let i=0; i<l.length; i++) {
          const c = l.charCodeAt(i);
          w += (c > 0x2500) ? fSize : (c >= 48 && c <= 57 || c === 32) ? fSize * 0.6 : fSize * 0.8;
        }
        if (w > maxW) maxW = w;
      });
      return maxW;
    };

    const tW = calcW(textLines);
    const rx = (tW + 140) / 2;
    const ry = ((textLines.length * fSize * 1.4) + 100) / 2;
    const cy = conf.text.y;

    // 6. SVG 출력
    const svg = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <image href="${bgData}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />
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
