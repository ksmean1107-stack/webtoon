export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    // 1. 파라미터 추출
    const bgParam = searchParams.get('bg') || '1';
    const bgNum = parseInt(bgParam) || 1;
    const imgParam = searchParams.get('img') || '1';
    const deRaw = searchParams.get('de') || '';
    const text1Raw = searchParams.get('text1') || '';
    const text2Raw = searchParams.get('text2') || '';
    const efRaw = searchParams.get('ef') || '';

    // 2. 대역별 파라미터 허용 규칙 (요청하신 대로 세밀하게 조정)
    let showDe = (bgNum >= 1 && bgNum <= 3) || (bgNum >= 19 && bgNum <= 20);
    let showText1 = (bgNum >= 1 && bgNum <= 18);
    let showText2 = (bgNum >= 4 && bgNum <= 10);
    let showEf = (bgNum >= 11 && bgNum <= 14);

    const process = (str) => str ? str.replace(/_/g, ' ').split('/') : [];
    const esc = (s) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

    const deLines = showDe ? process(deRaw) : [];
    const text1Lines = showText1 ? process(text1Raw) : [];
    const text2Lines = showText2 ? process(text2Raw) : [];
    const efLines = showEf ? process(efRaw) : [];

    // 3. 1~20번 개별 레이아웃 설정 (모두 size 55 적용)
    const LAYOUTS = {
      "1": { img: {x:51, y:462, w:795, h:1204}, de: {y:180, size:42}, text1: {x:600, y:1700, size:55}, ef: {x:512, y:950, size:130, rot:-5} },
      "2": { img: {x:185, y:545, w:795, h:1204}, de: {y:180, size:42}, text1: {x:500, y:1780, size:55}, ef: {x:512, y:950, size:130, rot:-5} },
      "3": { img: {x:96, y:408, w:795, h:1204}, de: {y:180, size:42}, text1: {x:512, y:1650, size:55}, ef: {x:512, y:950, size:130, rot:-5} },
      "4": { img: {x:45, y:407, w:866, h:1327}, text1: {x:512, y:310, size:55}, text2: {x:650, y:1700, size:55} },
      "5": { img: {x:116, y:445, w:866, h:1327}, text1: {x:450, y:400, size:55}, text2: {x:400, y:1800, size:55} },
      "6": { img: {x:67, y:233, w:866, h:1327}, text1: {x:420, y:230, size:55}, text2: {x:490, y:1550, size:55} },
      "7": { img: {x:0, y:200, w:866, h:1327}, text1: {x:512, y:1850, size:55}, text2: {x:512, y:1600, size:55} },
      "8": { img: {x:0, y:200, w:866, h:1327}, text1: {x:512, y:1850, size:55}, text2: {x:512, y:1600, size:55} },
      "9": { img: {x:0, y:200, w:866, h:1327}, text1: {x:512, y:1850, size:55}, text2: {x:512, y:1600, size:55} },
      "10": { img: {x:0, y:200, w:866, h:1327}, text1: {x:512, y:1850, size:55}, text2: {x:512, y:1600, size:55} },
      "11": { img: {x:50, y:100, w:866, h:1327}, text1: {x:512, y:1800, size:55}, ef: {x:512, y:800, size:160, rot:-10} },
      "12": { img: {x:50, y:100, w:866, h:1327}, text1: {x:512, y:1800, size:55}, ef: {x:512, y:800, size:160, rot:-10} },
      "13": { img: {x:50, y:100, w:866, h:1327}, text1: {x:512, y:1800, size:55}, ef: {x:512, y:800, size:160, rot:-10} },
      "14": { img: {x:50, y:100, w:866, h:1327}, text1: {x:512, y:1800, size:55}, ef: {x:512, y:800, size:160, rot:-10} },
      "15": { img: {x:112, y:400, w:866, h:1327}, text1: {x:512, y:1850, size:55} },
      "16": { img: {x:112, y:400, w:866, h:1327}, text1: {x:512, y:1850, size:55} },
      "17": { img: {x:112, y:400, w:866, h:1327}, text1: {x:512, y:1850, size:55} },
      "18": { img: {x:112, y:400, w:855, h:1327}, text1: {x:512, y:1850, size:55} },
      "19": { img: {x:0, y:0, w:866, h:1327}, de: {y:250, size:60} },
      "20": { img: {x:0, y:0, w:866, h:1327}, de: {y:250, size:60} }
    };

    const conf = LAYOUTS[bgParam] || LAYOUTS["1"];

    // 4. [고도화] 이미지 로더 (에러 방지용 Chunked Base64)
    const getBase64 = async (url) => {
      try {
        const proxy = `https://wsrv.nl/?url=${encodeURIComponent(url)}&n=1&output=png`;
        const res = await fetch(proxy);
        if (!res.ok) return "";
        const buf = await res.arrayBuffer();
        
        // btoa 안정성 확보 (대용량 대응)
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return `data:image/png;base64,${btoa(binary)}`;
      } catch (e) { return ""; }
    };

    const bgUrl = `https://igx.kr/v/1H/WEBTOON/${bgNum}`;
    const imgUrl = imgParam.startsWith('http') ? imgParam : `https://igx.kr/v/1H/WEBTOON_IMG/${imgParam}`;

    // 병렬 로딩
    const [finalBg, finalImg] = await Promise.all([getBase64(bgUrl), getBase64(imgUrl)]);

    // 5. 말풍선 렌더링 함수
    const renderBubble = (lines, textConf) => {
      if (!lines.length || !textConf) return "";
      const { x, y, size } = textConf;
      
      // 글자 너비 계산
      let maxW = 0;
      lines.forEach(l => {
        let w = 0;
        for (let i=0; i<l.length; i++) {
          const c = l.charCodeAt(i);
          w += (c > 0x2500) ? size : (c >= 48 && c <= 57 || c === 32 || c === 63 || c === 33) ? size * 0.6 : size * 0.8;
        }
        if (w > maxW) maxW = w;
      });

      const rx = (maxW + 140) / 2;
      const ry = ((lines.length * size * 1.4) + 100) / 2;
      
      return `
        <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="white" stroke="black" stroke-width="6" />
        ${lines.map((l, i) => `<text x="${x}" y="${y - ry + 50 + (i+0.8)*size*1.4}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${size}" fill="#000">${esc(l)}</text>`).join('')}
      `;
    };

    // 6. SVG 조립 (배경 -> 이미지 -> 텍스트 순서)
    const svg = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="2000" fill="white" />
      ${finalBg ? `<image href="${finalBg}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />` : ''}
      ${finalImg ? `<image href="${finalImg}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />` : ''}
      
      ${deLines.map((l, i) => `<text x="512" y="${conf.de.y + (i*conf.de.size*1.3)}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${conf.de.size}" fill="#222">${esc(l)}</text>`).join('')}

      ${renderBubble(text1Lines, conf.text1)}
      ${renderBubble(text2Lines, conf.text2)}

      ${efLines.map((l, i) => `<text x="${conf.ef.x}" y="${conf.ef.y + (i*conf.ef.size)}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.size}" fill="#FF0" stroke="#000" stroke-width="10" stroke-linejoin="round" transform="rotate(${conf.ef.rot || 0}, ${conf.ef.x}, ${conf.ef.y})">${esc(l)}</text>`).join('')}
    </svg>`;

    return new Response(svg.trim(), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } });
  } catch (e) {
    return new Response(`<svg><text y="20">Error: ${e.message}</text></svg>`, { headers: { 'Content-Type': 'image/svg+xml' } });
  }
}
