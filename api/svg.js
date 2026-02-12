export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    // 1. 파라미터 추출
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

    // 2. 랜덤 레이아웃 엔진
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // (1) 이미지: 중앙 배치
    const imgW = rand(820, 920);
    const imgH = rand(1000, 1300);
    const imgX = (1024 - imgW) / 2;
    const imgY = rand(400, 480);

    // (2) DE (묘사): 상단 중앙 고정
    const deX = 512;
    const deY = imgY - 240;

    // (3) Text (대사창): 위치 및 자연스러운 배치 로직
    // Text1 (상단): 이미지 상단 모서리에 "걸치듯" 배치 (위아래 랜덤성 부여)
    const isT1Left = Math.random() > 0.5;
    const t1X = isT1Left ? imgX + 20 : imgX + imgW - 20;
    const t1Y = imgY + rand(-20, 40); 

    // Text2 (하단): 이미지 하단 테두리보다 "더 아래로" 배치
    const isT2Left = Math.random() > 0.5; // T1과 상관없이 독립적 랜덤
    const t2X = isT2Left ? imgX + 50 : imgX + imgW - 50;
    const t2Y = imgY + imgH + rand(80, 130); // 테두리보다 80~130px 아래로

    // (4) EF (효과음): 크기와 선 굵기 조절을 위한 설정
    const efX = rand(150, 874);
    const efY = rand(imgY + 200, imgY + imgH - 200);
    const efRot = rand(-20, 20);
    const efSize = rand(90, 110); // [수정] 크기 축소 (기존 140)

    const conf = {
      img: { x: imgX, y: imgY, w: imgW, h: imgH },
      de: { x: deX, y: deY, size: 40 },
      text1: { x: t1X, y: t1Y, size: 52 },
      text2: { x: t2X, y: t2Y, size: 52 },
      ef: { x: efX, y: efY, size: efSize, rot: efRot }
    };

    // 3. 이미지 로더
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

    // 4. 말풍선 렌더링
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

      const rx = (maxW + 110) / 2;
      const ry = ((lines.length * size * 1.3) + 80) / 2;
      
      let fx = x;
      if (fx - rx < 15) fx = 15 + rx;
      if (fx + rx > 1009) fx = 1009 - rx;

      return `
        <ellipse cx="${fx}" cy="${y}" rx="${rx}" ry="${ry}" fill="white" stroke="black" stroke-width="5" />
        ${lines.map((l, i) => `<text x="${fx}" y="${y - ry + 40 + (i+0.8)*size*1.3}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${size}" fill="#000">${esc(l)}</text>`).join('')}
      `;
    };

    // 5. SVG 조립
    const svg = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="2000" fill="white" />
      
      ${finalImg ? `
        <image href="${finalImg}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />
        <rect x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" fill="none" stroke="black" stroke-width="6" />
      ` : ''}
      
      ${deLines.length ? deLines.map((l, i) => `<text x="${conf.de.x}" y="${conf.de.y + (i*conf.de.size*1.3)}" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${conf.de.size}" fill="#111">${esc(l)}</text>`).join('') : ''}

      ${renderBubble(text1Lines, conf.text1)}
      ${renderBubble(text2Lines, conf.text2)}

      ${efLines.length ? efLines.map((l, i) => `<text x="${conf.ef.x}" y="${conf.ef.y + (i*conf.ef.size)}" text-anchor="middle" font-family='"Comic Sans MS", "Arial Rounded MT Bold", impact, sans-serif' font-weight="900" font-size="${conf.ef.size}" fill="#FFD700" stroke="#000" stroke-width="7" stroke-linejoin="round" transform="rotate(${conf.ef.rot}, ${conf.ef.x}, ${conf.ef.y})">${esc(l)}</text>`).join('') : ''}
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
