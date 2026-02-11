export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    // 1. 파라미터 추출 및 전처리
    const bg = searchParams.get('bg') || '1';
    const bgNum = parseInt(bg) || 1;
    const imgParam = searchParams.get('img') || '1';
    const deRaw = searchParams.get('de') || '';
    const textRaw = searchParams.get('text') || '';
    const efRaw = searchParams.get('ef') || '';

    // 띄어쓰기(_)와 줄바꿈(/) 처리 함수
    const processText = (str) => str.replace(/_/g, ' ').split('/');
    const esc = (s) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

    const deLines = processText(deRaw);
    const textLines = processText(textRaw);
    const efLines = processText(efRaw);

    // 2. 이미지 주소 결정 (기본 경로 반영)
    const bgUrl = `https://igx.kr/v/1H/WEBTOON/${bgNum}`;
    const targetImgUrl = imgParam.startsWith('http') ? imgParam : `https://igx.kr/v/1H/WEB_IMG/${imgParam}`;

    // 이미지 프록시 함수 (에러 방지 내장)
    const getImgData = async (url) => {
      try {
        const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&default=https://via.placeholder.com/1024x2000?text=Load+Error`;
        const resp = await fetch(proxyUrl);
        if (!resp.ok) return "";
        const arrayBuffer = await resp.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        return `data:image/png;base64,${base64}`;
      } catch { return ""; }
    };

    const [finalBgData, finalImgData] = await Promise.all([
      getImgData(bgUrl),
      getImgData(targetImgUrl)
    ]);

    // 3. 레이아웃 설정
    const LAYOUT_CONFIG = {
      "1": {
        img:  { x: 112, y: 450, w: 800, h: 800 },
        de:   { y: 150, size: 40 },
        text: { y: 1700, size: 45 },
        ef:   { x: 512, y: 900, size: 140, rotate: -7 }
      },
      "default": {
        img:  { x: 50, y: 350, w: 924, h: 1100 },
        de:   { y: 180, size: 42 },
        text: { y: 1750, size: 50 },
        ef:   { x: 512, y: 950, size: 130, rotate: -5 }
      }
    };
    const conf = LAYOUT_CONFIG[bg] || LAYOUT_CONFIG["default"];

    // 4. 가변 말풍선 계산 로직 (대사 기준)
    const lineHeight = conf.text.size * 1.3;
    const maxCharCount = Math.max(...textLines.map(l => l.length), 1);
    const bubbleW = Math.min(maxCharCount * conf.text.size * 0.9 + 60, 900);
    const bubbleH = textLines.length * lineHeight + 50;
    const bubbleX = (1024 - bubbleW) / 2;
    const bubbleY = conf.text.y - (bubbleH / 2) - 10;

    // 5. SVG 생성
    let svgContent = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="2000" fill="#ffffff" />
      <image href="${finalBgData}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />
      ${finalImgData ? `<image href="${finalImgData}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />` : ''}

      ${deLines.map((line, i) => `
        <text x="512" y="${conf.de.y + (i * conf.de.size * 1.2)}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${conf.de.size}" fill="#222">${esc(line)}</text>
      `).join('')}

      ${textRaw ? `
        <rect x="${bubbleX}" y="${bubbleY}" width="${bubbleW}" height="${bubbleH}" rx="30" fill="white" stroke="black" stroke-width="4" />
        <path d="M ${512-20} ${bubbleY+bubbleH-2} L 512 ${bubbleY+bubbleH+30} L ${512+20} ${bubbleY+bubbleH-2}" fill="white" stroke="black" stroke-width="4" />
        <rect x="${bubbleX+5}" y="${bubbleY+bubbleH-10}" width="${bubbleW-10}" height="15" fill="white" />
        ${textLines.map((line, i) => `
          <text x="512" y="${bubbleY + (lineHeight * (i + 1)) - 10}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${conf.text.size}" fill="#000">${esc(line)}</text>
        `).join('')}
      ` : ''}

      ${efLines.map((line, i) => `
        <text x="${conf.ef.x}" y="${conf.ef.y + (i * conf.ef.size * 0.9)}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${conf.ef.size}" 
          fill="#FFFF00" stroke="#000000" stroke-width="8" stroke-linejoin="round"
          transform="rotate(${conf.ef.rotate}, ${conf.ef.x}, ${conf.ef.y})">${esc(line)}</text>
      `).join('')}
    </svg>`;

    return new Response(svgContent.trim(), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } });

  } catch (err) {
    return new Response(`<svg xmlns="http://www.w3.org/2000/svg"><text y="20">Error: ${err.message}</text></svg>`, { headers: { 'Content-Type': 'image/svg+xml' } });
  }
}
