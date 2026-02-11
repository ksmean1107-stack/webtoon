export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    const bgNum = searchParams.get('bg') || '1';
    const imgParam = searchParams.get('img') || '1';
    const deRaw = searchParams.get('de') || '';
    const textRaw = searchParams.get('text') || '';
    const efRaw = searchParams.get('ef') || '';

    // [커스텀 변수] 여백 및 크기 조절 (여기서 상하좌우 여백 조절 가능)
    const padX = 70; // 말풍선 좌우 여백 (타원형이므로 글자와 테두리 사이의 넓은 공간)
    const padY = 50; // 말풍선 위아래 여백

    // 텍스트 처리: _(공백), /(줄바꿈)
    const processText = (str) => str.replace(/_/g, ' ').split('/');
    const esc = (s) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&#x22;',"'":'&#x27;'}[m]));

    const deLines = processText(deRaw);
    const textLines = processText(textRaw);
    const efLines = processText(efRaw);

    // 이미지 데이터 로드
    const bgUrl = `https://igx.kr/v/1H/WEBTOON/${bgNum}`;
    const targetImgUrl = imgParam.startsWith('http') ? imgParam : `https://igx.kr/v/1H/WEB_IMG/${imgParam}`;

    const getImgData = async (url) => {
      try {
        const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
        const resp = await fetch(proxyUrl);
        if (!resp.ok) return "";
        const arrayBuffer = await resp.arrayBuffer();
        return `data:image/png;base64,${btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))}`;
      } catch { return ""; }
    };

    const [finalBgData, finalImgData] = await Promise.all([getImgData(bgUrl), getImgData(targetImgUrl)]);

    // 레이아웃 수치 (여기서 BG별 설정 가능)
    const conf = {
      img:  { x: 50, y: 350, w: 924, h: 1100 },
      de:   { y: 180, size: 42 },
      text: { y: 1780, size: 50 }, // 텍스트 기준점
      ef:   { x: 512, y: 950, size: 130, rotate: -5 }
    };

    // [핵심] 글자 종류별 너비 자동 계산 (한글/영어/숫자/특수문자/공백 등)
    const calculateWidth = (lines, fontSize) => {
      let maxWidth = 0;
      lines.forEach(line => {
        let width = 0;
        for (let i = 0; i < line.length; i++) {
          const char = line.charCodeAt(i);
          if (char > 0x2500) width += fontSize * 1.0; // 한글
          else if (char >= 65 && char <= 90) width += fontSize * 0.9; // 대문자
          else if (char >= 48 && char <= 57) width += fontSize * 0.7; // 숫자
          else if (char === 32) width += fontSize * 0.5; // 공백
          else width += fontSize * 0.8; // 소문자, 특수문자 등
        }
        if (width > maxWidth) maxWidth = width;
      });
      return maxWidth;
    };

    const fontSize = conf.text.size;
    const textWidth = calculateWidth(textLines, fontSize);
    
    // 타원형의 가로, 세로 반지름 계산
    const ellipseRx = (textWidth + padX * 2) / 2; // 가로 반지름
    const ellipseRy = ((textLines.length * fontSize * 1.4) + padY * 2) / 2; // 세로 반지름

    // 타원형의 중심점
    const ellipseCx = 1024 / 2;
    const ellipseCy = conf.text.y; // 텍스트 기준점 그대로 타원형 중심 Y로 사용

    // 5. SVG 조립
    let svgContent = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <image href="${finalBgData}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />
      ${finalImgData ? `<image href="${finalImgData}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />` : ''}

      ${deLines.map((line, i) => `
        <text x="512" y="${conf.de.y + (i * conf.de.size * 1.3)}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${conf.de.size}" fill="#222">${esc(line)}</text>
      `).join('')}

      ${textRaw ? `
        <ellipse cx="${ellipseCx}" cy="${ellipseCy}" rx="${ellipseRx}" ry="${ellipseRy}" 
          fill="white" stroke="black" stroke-width="6" />
        ${textLines.map((line, i) => `
          <text x="512" y="${ellipseCy - ellipseRy + padY + (i + 0.8) * fontSize * 1.4}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${fontSize}" fill="#000">${esc(line)}</text>
        `).join('')}
      ` : ''}

      ${efLines.map((line, i) => `
        <text x="${conf.ef.x}" y="${conf.ef.y + (i * conf.ef.size * 1.0)}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.size}" 
          fill="#FFFF00" stroke="#000000" stroke-width="10" stroke-linejoin="round"
          transform="rotate(${conf.ef.rotate}, ${conf.ef.x}, ${conf.ef.y})">${esc(line)}</text>
      `).join('')}
    </svg>`;

    return new Response(svgContent.trim(), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } });
  } catch (err) {
    return new Response(`<svg><text y="20">Error: ${err.message}</text></svg>`, { headers: { 'Content-Type': 'image/svg+xml' } });
  }
}
