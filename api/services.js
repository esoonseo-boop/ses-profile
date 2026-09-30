const fs = require('fs');
const path = require('path');

const SUPABASE_URL = "https://oqeiaaworcarixndtomj.supabase.co";
const SUPABASE_KEY = "sb_publishable_xVY0MJETNgpC820jW4yO1w_XUd9QzqZ";

const DEFAULT_BRANCH = {
  branch_name: "상록수지점",
  manager_name: "서애순"
};

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = async (req, res) => {
  try {
    const code = (req.query && req.query.code) || '';

    // services.html은 저장소 루트에 있는 원본 파일을 그대로 읽어옵니다.
    // (서비스 내용은 이 파일 하나만 고치면 되는 구조를 그대로 유지)
    const html0 = fs.readFileSync(path.join(process.cwd(), 'services.html'), 'utf-8');
    let html = html0;

    let branch = DEFAULT_BRANCH;
    if (code) {
      try {
        const r = await fetch(
          `${SUPABASE_URL}/rest/v1/branch_registrations?code=eq.${encodeURIComponent(code)}&select=branch_name,manager_name`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        if (r.ok) {
          const rows = await r.json();
          if (rows && rows.length) branch = rows[0];
        }
      } catch (e) {
        // 조회 실패 시 기본값(상록수지점) 유지
      }
    }

    const branchName = escapeHtml(branch.branch_name);
    const title = `비금융서비스 안내 | IBK기업은행 ${branchName}`;
    const desc = `IBK기업은행 ${branchName}이 기업고객을 위해 제공하는 비금융서비스를 한눈에 안내합니다.`;
    const shareUrl = `https://ses-profile.vercel.app/s${code ? `?code=${encodeURIComponent(code)}` : ''}`;

    // 카카오톡/문자 등 링크 미리보기가 읽는 <title>과 og 태그를
    // 지점 정보에 맞게 서버에서 미리 바꿔서 내려줍니다.
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);

    const metaTags = [
      `<meta property="og:title" content="${title}">`,
      `<meta property="og:description" content="${desc}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:url" content="${shareUrl}">`,
      `<meta name="twitter:card" content="summary">`,
      `<meta name="twitter:title" content="${title}">`,
      `<meta name="twitter:description" content="${desc}">`
    ].join('\n');

    html = html.replace('</head>', `${metaTags}\n</head>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('페이지를 불러오는 중 오류가 발생했습니다.');
  }
};
