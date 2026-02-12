export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    // 1. 파라미터 추출 (text -> text1, text2 추가)
    const bgParam = searchParams.get('bg') || '1';
    const bgNum = parseInt(bgParam) || 1;
    const imgParam = searchParams.get('img') || '1';
    const deRaw = searchParams.get('de') || '';
    const text1Raw = searchParams.get('text1') || '';
    const text2Raw = searchParams.get('text2') || '';
    const efRaw = searchParams.get('ef') || '';

    // 2. 대역별 파라미터 허용 여부 정교화
    let showDe = false, showText1 = false, showText2 = false, showEf = false;
    
    if (bgNum >= 1 && bgNum <= 3) { showDe = true; showText1 = true; } 
    else if (bgNum >= 4 && bgNum <= 10) { showText1 = true; showText2 = true; } // text2는 여기서만 허용
    else if (bgNum >= 11 && bgNum <= 14) { showText1 = true; showEf = true; }
    else if (bgNum >= 15 && bgNum <= 18) { showText1 = true; }
    else if (bgNum >= 19 && bgNum <= 20) { showDe = true; }

    const process = (str) => str ? str.replace(/_/g, ' ').split('/') : [];
    const esc = (s) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

    const deLines = showDe ? process(deRaw) : [];
    const text1Lines = showText1 ? process(text1Raw) : [];
    const text2Lines = showText2 ? process(text2Raw) : [];
    const efLines = showEf ? process(efRaw) : [];

    // 3. 1~20번 개별 레이아웃 (text2 위치값 추가)
    const LAYOUTS = {
      "1": { img: {x:51, y:462, w:795, h:1204}, de: {y:180, size:42}, text1: {x:512, y:1780, size:55}, ef: {x:512, y:950, size:130, rot:-5} },
      "2": { img: {x:51, y:462, w:795, h:1204}, de: {y:180, size:42}, text1: {x:512, y:1780, size:55}, ef: {x:512, y:950, size:130, rot:-5} },
      "3": { img: {x:51, y:462, w:795, h:1204}, de: {y:180, size:42}, text1: {x:512, y:1780, size:55}, ef: {x:512, y:950, size:130, rot:-5} },
      // 4~10번: text2(상단), text1(하단) 기본 배치
      "4": { img: {x:0, y:200, w:1024, h:1400}, text1: {x:512, y:1850, size:55}, text2: {x:512, y:1600, size:55} },
      "5": { img: {x:0, y:200, w:1024, h:1400}, text1: {x:512, y:1850, size:55}, text2: {x:512, y:1600, size:55} },
      "6": { img: {x:0, y:200, w:1024, h:1400}, text1: {x:512, y:1850, size:55}, text2: {x:512, y:1600, size:55} },
      "7": { img: {x:0, y:200, w:1024, h:1400}, text1: {x:512, y:1850, size:55}, text2: {x:512, y:1600, size:55} },
      "8": { img: {x:0, y:200, w:1024, h:1400}, text1: {x:512, y:1850, size:55}, text2: {x:512, y:1600, size:55} },
      "9": { img: {x:0, y:200, w:1024, h:1400}, text1: {x:512, y:1850, size:55}, text2: {x:512, y:1600, size:55} },
      "10": { img: {x:0, y:200, w:1024, h:1400}, text1: {x:512, y:1850, size:55}, text2: {x:512, y:1600, size:55} },
      "11": { img: {x:50, y:100, w:924, h:1500}, text1: {x:512, y:1800, size:55}, ef: {x:512, y:800, size:160, rot:-10} },
      "12": { img: {x:50, y:100, w:924, h:1500}, text1: {x:512, y:1800, size:55}, ef: {x:512, y:800, size:160, rot:-10} },
      "13": { img: {x:50, y:100, w:924, h:1500}, text1: {x:512, y:1800, size:55}, ef: {x:512, y:800, size:160, rot:-10} },
      "14": { img: {x:50, y:100, w:924, h:1500}, text1: {x:512, y:1800, size:55}, ef: {x:512, y:800, size:160, rot:-10} },
      "15": { img: {x:112, y:400, w:800, h:800}, text1: {x:512, y:1850, size:55} },
      "16": { img: {x:112, y:400, w:800, h:800}, text1: {x:512, y:1850, size:55} },
      "17": { img: {x:112, y:400, w:800, h:800}, text1: {x:512, y:1850, size:55} },
      "18": { img: {x:112, y:400, w:800, h:800}, text1: {x:512, y:1850, size:55} },
      "19": { img: {x:0, y:0, w:1024, h:2000}, de: {y:250, size:60} },
      "20": { img: {x:0, y:0, w:1024, h:2000}, de: {y:250, size:60} }
    };

    const conf = LAYOUTS[bgParam] || LAYOUTS["1"];

    // 4. Base64 이미지 로더
    const getBase64 = async (url) => {
      try {
        const resp = await fetch(`https://wsrv.nl/?url=${encodeURIComponent(url)}&output=png`);
        if (!resp.ok) return "";
        const buffer = await resp.arrayBuffer();
        return `data:image/png;base64,${btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''))}`;
      } catch (e) { return ""; }
    };

    const [finalBg, finalImg] = await Promise.all([
      getBase64(`https://igx.kr/v/1H/WEBTOON/${bgNum}`),
      getBase64(imgParam.startsWith('http') ? imgParam : `https://igx.kr/v/1H/WEB_IMG/${imgParam}`)
    ]);

    // 5. 공통 계산 함수 (너비 및 엘립스 생성)
    const calcWidth = (lines, fSize) => {
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

    const renderBubble = (lines, textConf) => {
      if (!lines.length) return "";
      const { x, y, size } = textConf;
      const tW = calcWidth(lines, size);
      const rx = (tW + 140) / 2;
      const ry = ((lines.length * size * 1.4) + 100) / 2;
      return `
        <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="white" stroke="black" stroke-width="6" />
        ${lines.map((l, i) => `<text x="${x}" y="${y - ry + 50 + (i+0.8)*size*1.4}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${size}" fill="#000">${esc(l)}</text>`).join('')}
      `;
    };

    // 6. SVG 조립
    const svg = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="2000" fill="white" />
      <image href="${finalBg}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />
      ${finalImg ? `<image href="${finalImg}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />` : ''}
      
      ${deLines.map((l, i) => `<text x="512" y="${conf.de.y + (i*conf.de.size*1.3)}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${conf.de.size}" fill="#222">${esc(l)}</text>`).join('')}

      ${renderBubble(text1Lines, conf.text1 || {x:512, y:1800, size:55})}
      ${renderBubble(text2Lines, conf.text2 || {x:512, y:1550, size:55})}

      ${efLines.map((l, i) => `<text x="${conf.ef.x}" y="${conf.ef.y + (i*conf.ef.size)}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.size}" fill="#FF0" stroke="#000" stroke-width="10" stroke-linejoin="round" transform="rotate(${conf.ef.rot || 0}, ${conf.ef.x}, ${conf.ef.y})">${esc(l)}</text>`).join('')}
    </svg>`;

    return new Response(svg.trim(), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } });
  } catch (e) {
    return new Response(`<svg><text y="20">Error: ${e.message}</text></svg>`, { headers: { 'Content-Type': 'image/svg+xml' } });
  }
                                                                                         }
