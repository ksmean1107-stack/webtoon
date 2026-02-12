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

    // 2. 파라미터 허용 규칙 (기존 유지)
    // bg 1~3, 19~20: de 표시 / bg 1~18: text1 표시 / bg 4~10: text2 표시
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

    // 3. [핵심] 완전 랜덤 레이아웃 생성기 (새로고침마다 변경)
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // (1) 이미지 크기 및 위치 랜덤 설정
    // 너비: 800~980px 사이 (화면 꽉 차거나 적당히 작게)
    const imgW = rand(800, 980);
    // 높이: 1000~1500px 사이 (다양한 비율)
    const imgH = rand(1000, 1500);
    
    // X좌표: 화면(1024) 중앙을 기준으로 약간의 좌우 흔들림 (+/- 40px)
    const centerX = (1024 - imgW) / 2;
    const imgX = centerX + rand(-40, 40);
    
    // Y좌표: 상단 200~450px 사이에서 랜덤 시작
    const imgY = rand(200, 450);

    // (2) DE (나레이션): 이미지 바로 위 정중앙 고정
    const deX = imgX + (imgW / 2); // 이미지의 수평 중앙
    const deY = imgY - 80;         // 이미지 상단보다 80px 위

    // (3) Text1 (상단 대사): 이미지 상체 쪽 (Top 20% 지점)
    // 왼쪽(20% 지점) 또는 오른쪽(80% 지점) 중 하나 랜덤 선택
    const t1IsLeft = Math.random() > 0.5;
    const t1X = t1IsLeft ? (imgX + imgW * 0.25) : (imgX + imgW * 0.75);
    const t1Y = imgY + (imgH * 0.2) + rand(-50, 50); // 상단 20% 지점에서 위아래 랜덤

    // (4) Text2 (하단 대사): 이미지 하체 쪽 (Bottom 20% 지점)
    // Text1과 반대 방향에 있을 확률을 높이거나 완전 랜덤 (여기선 완전 랜덤으로 자연스러움 추구)
    const t2IsLeft = Math.random() > 0.5;
    const t2X = t2IsLeft ? (imgX + imgW * 0.25) : (imgX + imgW * 0.75);
    const t2Y = imgY + (imgH * 0.8) + rand(-50, 50); // 상단 80% 지점

    // (5) EF (효과음): 이미지 주변 어딘가
    const efX = rand(100, 900);
    const efY = rand(imgY, imgY + imgH);
    const efRot = rand(-20, 20);

    // 설정 객체 생성
    const conf = {
      img: { x: imgX, y: imgY, w: imgW, h: imgH },
      de: { x: deX, y: deY, size: 42 }, // de에 x좌표 추가됨
      text1: { x: t1X, y: t1Y, size: 55 },
      text2: { x: t2X, y: t2Y, size: 55 },
      ef: { x: efX, y: efY, size: 130, rot: efRot }
    };


    // 4. 이미지 로더 (Chunked Base64 - 안정성 유지)
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
    const imgUrl = imgParam.startsWith('http') ? imgParam : `https://igx.kr/v/1H/WEBTOON_IMG/${imgParam}`;

    const [finalBg, finalImg] = await Promise.all([getBase64(bgUrl), getBase64(imgUrl)]);


    // 5. 말풍선 렌더링
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
      if (!lines.length || !textConf) return "";
      const { x, y, size } = textConf;
      const tW = calcWidth(lines, size);
      const rx = (tW + 140) / 2;
      const ry = ((lines.length * size * 1.4) + 100) / 2;
      
      // 화면 밖으로 나가는 것 방지 (보정)
      let finalX = x;
      if (finalX - rx < 20) finalX = 20 + rx;
      if (finalX + rx > 1004) finalX = 1004 - rx;

      return `
        <ellipse cx="${finalX}" cy="${y}" rx="${rx}" ry="${ry}" fill="white" stroke="black" stroke-width="6" />
        ${lines.map((l, i) => `<text x="${finalX}" y="${y - ry + 50 + (i+0.8)*size*1.4}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${size}" fill="#000">${esc(l)}</text>`).join('')}
      `;
    };


    // 6. SVG 조립
    const svg = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="2000" fill="white" />
      ${finalBg ? `<image href="${finalBg}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />` : ''}
      
      ${finalImg ? `<image href="${finalImg}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />` : ''}
      
      ${deLines.map((l, i) => `<text x="${conf.de.x}" y="${conf.de.y + (i*conf.de.size*1.3)}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${conf.de.size}" fill="#222" style="text-shadow: 2px 2px 4px white;">${esc(l)}</text>`).join('')}

      ${renderBubble(text1Lines, conf.text1)}
      ${renderBubble(text2Lines, conf.text2)}

      ${efLines.map((l, i) => `<text x="${conf.ef.x}" y="${conf.ef.y + (i*conf.ef.size)}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.size}" fill="#FF0" stroke="#000" stroke-width="10" stroke-linejoin="round" transform="rotate(${conf.ef.rot}, ${conf.ef.x}, ${conf.ef.y})">${esc(l)}</text>`).join('')}
    </svg>`;

    // 7. 캐시 방지 헤더 설정 (새로고침 시 매번 새로운 랜덤 적용)
    return new Response(svg.trim(), { 
      headers: { 
        'Content-Type': 'image/svg+xml', 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    });
  } catch (e) {
    return new Response(`<svg><text y="20">Error: ${e.message}</text></svg>`, { headers: { 'Content-Type': 'image/svg+xml' } });
  }
      }
