export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    const bg = searchParams.get('bg') || '1';
    const bgNum = parseInt(bg) || 1;
    const imgParam = searchParams.get('img') || '1';
    const deRaw = searchParams.get('de') || '';
    const textRaw = searchParams.get('text') || '';
    const efRaw = searchParams.get('ef') || '';

    const processText = (str) => str.replace(/_/g, ' ').split('/');
    const esc = (s) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

    const deLines = processText(deRaw);
    const textLines = processText(textRaw);
    const efLines = processText(efRaw);

    const bgUrl = `https://igx.kr/v/1H/WEBTOON/${bgNum}`;
    const targetImgUrl = imgParam.startsWith('http') ? imgParam : `https://igx.kr/v/1H/WEB_IMG/${imgParam}`;

    const getImgData = async (url) => {
      try {
        const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
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

    const LAYOUT_CONFIG = {
      "1": {
        img:  { x: 50, y: 350, w: 924, h: 1100 },
        de:   { y: 180, size: 42 },
        text: { y: 1750, size: 48 }, // 대사 기본 높이
        ef:   { x: 512, y: 950, size: 130, rotate: -5 }
      },
      "default": {
        img:  { x: 50, y: 350, w: 924, h: 1100 },
        de:   { y: 180, size: 42 },
        text: { y: 1780, size: 48 },
        ef:   { x: 512, y: 950, size: 130, rotate: -5 }
      }
    };
    const conf = LAYOUT_CONFIG[bg] || LAYOUT_CONFIG["default"];

    // --- 진짜 동그란 타원형 계산 (반원 캡) ---
    const fontSize = conf.text.size;
    const lineHeight = fontSize * 1.4;
    const longestLineLen = Math.max(...textLines.map(l => l.length), 1);
    
    // 너비를 글자 수보다 넉넉히 잡아 타원형 여백 확보
    const bubbleW = Math.min(longestLineLen * fontSize * 1.2 + 120, 960); 
    const bubbleH = textLines.length * lineHeight + 80; // 높이도 넉넉히
    const bubbleX = (1024 - bubbleW) / 2;
    const bubbleY = conf.text.y - (bubbleH / 2);

    let svgContent = `
    <svg width="1024" height="2000" viewBox="0 0 1024 2000" xmlns="http://www.w3.org/2000/svg">
      <image href="${finalBgData}" x="0" y="0" width="1024" height="2000" preserveAspectRatio="xMidYMid slice" />
      ${finalImgData ? `<image href="${finalImgData}" x="${conf.img.x}" y="${conf.img.y}" width="${conf.img.w}" height="${conf.img.h}" preserveAspectRatio="xMidYMid slice" />` : ''}

      ${deLines.map((line, i) => `
        <text x="512" y="${conf.de.y + (i * conf.de.size * 1.3)}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${conf.de.size}" fill="#222">${esc(line)}</text>
      `).join('')}

      ${textRaw ? `
        <rect x="${bubbleX}" y="${bubbleY}" width="${bubbleW}" height="${bubbleH}" 
          rx="${bubbleH / 1.8}" ry="${bubbleH / 2}" 
          fill="white" stroke="black" stroke-width="6" />
        ${textLines.map((line, i) => `
          <text x="512" y="${bubbleY + (lineHeight * (i + 1)) + 5}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${fontSize}" fill="#000">${esc(line)}</text>
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
