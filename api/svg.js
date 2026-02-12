export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    // 1. 파라미터 추출 (bg 제거, 존재하는 것만 처리)
    const imgParam = searchParams.get('img');
    const deRaw = searchParams.get('de');
    const text1Raw = searchParams.get('text1');
    const text2Raw = searchParams.get('text2');
    const efRaw = searchParams.get('ef');

    const process = (str) => str ? str.replace(/_/g, ' ').split('/') : [];
    const esc = (s) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

    const deLines = process(deRaw);
    const text1Lines = process(text1Raw);
    const text2Lines = process(text2Raw);
    const efLines = process(efRaw);

    // 2. 완전 랜덤 레이아웃 생성기 (이미지 및 텍스트 끝단 배치)
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // (1) 이미지 크기 및 위치 (중앙 부근 배치)
    const imgW = rand(800, 950);
    const imgH = rand(1000, 1400);
    const imgX = (1024 - imgW) / 2 + rand(-30, 30);
    const imgY = rand(300, 500);

    // (2) DE (묘사): 이미지 X값 상관없이 무조건 중앙(512), 이미지보다 훨씬 위
    const deX = 512;
    const deY = imgY - rand(150, 250); // 이미지 상단에서 150~250px 위

    // (3) Text (대사창): 이미지의 모서리/끝단 쪽으로 배치
    // Text1: 이미지 상단 모서리 쪽 (왼쪽 끝 또는 오른쪽 끝)
    const t1Side = Math.random() > 0.5;
    const t1X = t1Side ? (imgX + 50) : (imgX + imgW - 50); 
    const t1Y = imgY + 80; // 이미지 최상단 부근

    // Text2: 이미지 하단 모서리 쪽 (왼쪽 끝 또는 오른쪽 끝)
    const t2Side = Math.random() > 0.5;
    const t2X = t2Side ? (imgX + 50) : (imgX + imgW - 50);
    const t2Y = imgY + imgH - 80; // 이미지 최하단 부근

    const conf = {
      img: { x: imgX, y: imgY, w: imgW, h: imgH },
      de: { x: deX, y: deY, size: 42 },
      text1: { x: t1X, y: t1Y, size: 55 },
      text2: { x: t2X, y: t2Y, size: 55 },
      ef: { x: rand(200, 800), y: rand(imgY, imgY+imgH), size: 130, rot: rand(-20, 20) }
    };

    // 3. 이미지 로더 (img 파라미터가 있을 때만 실행)
    const getBase64 = async (url) => {
      if (!url) return "";
      try {
        const fullUrl = url.startsWith('http') ? url : `https://igx.kr/v/1H/WEBTOON_IMG/${url}`;
        const proxy = `https://wsrv.nl/?url=${encodeURIComponent(fullUrl)}&n=1&output=png`;
        const res = await fetch(proxy);
        if (!res.ok) return "";
        const buf = await res.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return `data:image/png;base64,${btoa(binary)}`;
      } catch (e) { return ""; }
    };

    const finalImg = await getBase64(imgParam);

    // 4. 말풍선 렌더링 (화면 이탈 방지 로직 포함)
    const renderBubble = (lines, textConf) => {
      if (!lines.length || !textConf) return "";
      const { x, y, size } = textConf;
      
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
      
      // 모서리 배치 시 화면 밖으로 나가지 않게 보정
      let fx = x;
      if (fx - rx < 30) fx = 30 + rx;
      if (fx + rx > 994) fx = 994 - rx;

      return `
        <ellipse cx="${fx}" cy="${y}" rx="${rx}" ry="${ry}" fill="white" stroke="black" stroke-width="6" />
        ${lines.map((l, i) => `<text x="${fx}" y="${y - ry + 50 + (i+0.8)*size*1.4}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${size}" fill="#000">${esc(l)}</text>`).join('')}
      `;
    };

    // 5. SVG 조립 (입력된 것만 렌더링)
    const svg = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="2000" fill="white" />
      
      ${finalImg ? `<image href="${finalImg}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />` : ''}
      
      ${deLines.length ? deLines.map((l, i) => `<text x="${conf.de.x}" y="${conf.de.y + (i*conf.de.size*1.3)}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${conf.de.size}" fill="#222">${esc(l)}</text>`).join('')} : ''}

      ${renderBubble(text1Lines, conf.text1)}
      ${renderBubble(text2Lines, conf.text2)}

      ${efLines.length ? efLines.map((l, i) => `<text x="${conf.ef.x}" y="${conf.ef.y + (i*conf.ef.size)}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.size}" fill="#FF0" stroke="#000" stroke-width="10" stroke-linejoin="round" transform="rotate(${conf.ef.rot}, ${conf.ef.x}, ${conf.ef.y})">${esc(l)}</text>`).join('')} : ''}
    </svg>`;

    return new Response(svg.trim(), { 
      headers: { 
        'Content-Type': 'image/svg+xml', 
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      } 
    });
  } catch (e) {
    return new Response(`<svg><text y="20">Error: ${e.message}</text></svg>`, { headers: { 'Content-Type': 'image/svg+xml' } });
  }
}
