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

    // 2. 파라미터 허용 규칙 (기존 규칙 유지)
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

    // 3. [핵심] 스마트 랜덤 레이아웃 생성기
    // BG 번호를 시드(Seed)로 사용하여, 같은 번호에서는 항상 같은 랜덤 배치가 나오도록 함 (새로고침 시 흔들림 방지)
    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const generateLayout = (seed) => {
      const rand = (min, max, offset = 0) => Math.floor(seededRandom(seed + offset) * (max - min + 1)) + min;
      
      // (1) 이미지 크기와 위치 랜덤 설정
      // 너비: 800~950, 높이: 1000~1400, Y시작점: 300~500
      const imgW = rand(800, 950, 1);
      const imgH = rand(1000, 1400, 2);
      const imgX = (1024 - imgW) / 2; // 이미지는 가로 중앙 정렬
      const imgY = rand(300, 500, 3); // 상단 여백 랜덤

      // (2) DE (나레이션): 이미지 중앙 상단
      const deY = imgY - 100; // 이미지보다 100px 위

      // (3) Text1 (상단 말풍선): 이미지 영역 내 상단 20% 지점
      // 왼쪽(250) 또는 오른쪽(774) 랜덤 결정
      const isLeft1 = seededRandom(seed + 4) > 0.5;
      const t1X = isLeft1 ? 250 : 774;
      const t1Y = imgY + (imgH * 0.2); 

      // (4) Text2 (하단 말풍선): 이미지 영역 내 하단 80% 지점
      // 왼쪽/오른쪽 랜덤 (Text1과 독립적)
      const isLeft2 = seededRandom(seed + 5) > 0.5;
      const t2X = isLeft2 ? 250 : 774;
      const t2Y = imgY + (imgH * 0.8);

      // (5) EF (효과음): 이미지 중앙 근처 랜덤
      const efX = rand(200, 800, 6);
      const efY = imgY + (imgH / 2) + rand(-100, 100, 7);
      const efRot = rand(-15, 15, 8);

      return {
        img: { x: imgX, y: imgY, w: imgW, h: imgH },
        de: { y: deY, size: 42 },
        text1: { x: t1X, y: t1Y, size: 55 },
        text2: { x: t2X, y: t2Y, size: 55 },
        ef: { x: efX, y: efY, size: 130, rot: efRot }
      };
    };

    // 현재 BG 번호에 맞춰 레이아웃 생성
    const conf = generateLayout(bgNum);


    // 4. 이미지 로더 (Chunked Base64)
    const getBase64 = async (url) => {
      try {
        const proxy = `https://wsrv.nl/?url=${encodeURIComponent(url)}&n=1&output=png`;
        const res = await fetch(proxy);
        if (!res.ok) return "";
        const buf = await res.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return `data:image/png;base64,${btoa(binary)}`;
      } catch (e) { return ""; }
    };

    const bgUrl = `https://igx.kr/v/1H/WEBTOON/${bgNum}`;
    const imgUrl = imgParam.startsWith('http') ? imgParam : `https://igx.kr/v/1H/WEB_IMG/${imgParam}`;

    const [finalBg, finalImg] = await Promise.all([getBase64(bgUrl), getBase64(imgUrl)]);

    // 5. 말풍선 렌더링 (타원형)
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
      
      return `
        <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="white" stroke="black" stroke-width="6" />
        ${lines.map((l, i) => `<text x="${x}" y="${y - ry + 50 + (i+0.8)*size*1.4}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${size}" fill="#000">${esc(l)}</text>`).join('')}
      `;
    };

    // 6. SVG 조립
    const svg = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="2000" fill="white" />
      ${finalBg ? `<image href="${finalBg}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />` : ''}
      
      ${finalImg ? `<image href="${finalImg}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />` : ''}
      
      ${deLines.map((l, i) => `<text x="512" y="${conf.de.y + (i*conf.de.size*1.3)}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${conf.de.size}" fill="#222">${esc(l)}</text>`).join('')}

      ${renderBubble(text1Lines, conf.text1)}
      
      ${renderBubble(text2Lines, conf.text2)}

      ${efLines.map((l, i) => `<text x="${conf.ef.x}" y="${conf.ef.y + (i*conf.ef.size)}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.size}" fill="#FF0" stroke="#000" stroke-width="10" stroke-linejoin="round" transform="rotate(${conf.ef.rot}, ${conf.ef.x}, ${conf.ef.y})">${esc(l)}</text>`).join('')}
    </svg>`;

    return new Response(svg.trim(), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } });
  } catch (e) {
    return new Response(`<svg><text y="20">Error: ${e.message}</text></svg>`, { headers: { 'Content-Type': 'image/svg+xml' } });
  }
}
