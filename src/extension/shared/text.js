export const normalize = text => String(text||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
// Prefer the Chinese meaning of a bilingual label: 学历 / Degree and 学位 / Degree are distinct.
export const primaryLabel=text=>{const s=String(text||'').trim();return /\p{Script=Han}/u.test(s)?s.replace(/\s*\/\s*[A-Za-z][\s\S]*$/u,'').trim():s;};
