const fs = require('fs');
const path = require('path');

const SUPABASE_URL = "https://oqeiaaworcarixndtomj.supabase.co";
const SUPABASE_KEY = "sb_publishable_xVY0MJETNgpC820jW4yO1w_XUd9QzqZ";
const SITE = "https://ses-profile.vercel.app";

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 코드로 제안서 1건의 공개 정보(고객명·지점·상품명)만 조회: DB → 샘플(data.json) 순서
async function lookup(code) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_proposal_by_code`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code })
    });
    if (r.ok) {
      const d = await r.json();
      if (d) return { customer: d.customer, branch: d.branch_name, manager: d.manager_name,
                      titles: (d.items || []).map(i => i.title).filter(Boolean), raw: d };
    }
  } catch (e) { /* 아래 샘플 확인으로 */ }
  try {
    const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'proposals', 'data.json'), 'utf-8'));
    const p = data.proposals && data.proposals[code];
    if (p) return { customer: p.customer, branch: data.branch.name, manager: data.branch.manager,
                    titles: (p.items || []).map(i => data.products[i.product] && data.products[i.product].title).filter(Boolean) };
  } catch (e) { /* 없음 */ }
  return null;
}

module.exports = async (req, res) => {
  try {
    const code = String((req.query && req.query.code) || '').slice(0, 64);
    let html = fs.readFileSync(path.join(process.cwd(), 'proposal.html'), 'utf-8');

    let title = '맞춤 제안서 | IBK기업은행';
    let embed = '';
    let desc = 'IBK기업은행이 준비한 맞춤 제안서입니다.';
    if (code) {
      const info = await lookup(code);
      if (info) {
        const t = info.titles;
        const list = t.length ? `${t[0]}${t.length > 1 ? ` 외 ${t.length - 1}건` : ''}` : '';
        title = `${info.customer} 고객님께 드리는 맞춤 제안서`;
        desc = `IBK기업은행 ${info.branch} ${info.manager} 지점장이 준비한 맞춤 제안서입니다.${list ? ` (${list})` : ''}`;
        // 같은 조회 결과를 HTML에 실어 보내 브라우저가 DB를 다시 부르지 않게 함(첫 화면 지연 단축)
        if (info.raw) {
          const json = JSON.stringify(info.raw).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
          embed = `<script>window.__PROPOSAL__=${json};</script>\n`;
        }
      }
    }
    const url = `${SITE}/p${code ? `?code=${encodeURIComponent(code)}` : ''}`;
    const T = esc(title), D = esc(desc);

    // 카카오톡·문자 등 링크 미리보기가 읽는 title / og 태그를 고객별로 서버에서 미리 바꿔 내려줌
    html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${T}</title>`);   // 함수 형태: 치환문자열의 $ 패턴 방지
    const headTags = embed + [
      `<meta property="og:title" content="${T}">`,
      `<meta property="og:description" content="${D}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:url" content="${esc(url)}">`,
      `<meta property="og:site_name" content="IBK기업은행">`,
      `<meta name="twitter:card" content="summary">`,
      `<meta name="twitter:title" content="${T}">`,
      `<meta name="twitter:description" content="${D}">`
    ].join('\n') + '\n</head>';
    html = html.replace('</head>', () => headTags);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');   // 조회수·유효기간·상품 수정이 바로 반영되도록 캐시하지 않음
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('페이지를 불러오는 중 오류가 발생했습니다.');
  }
};
