const SERVICE_TYPES = ['supabase', 'cloudinary', 'render'];

export function detectPlatform(url) {
  const host = url.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  if (host.endsWith('vercel.app')) return 'vercel';
  if (host.endsWith('onrender.com')) return 'render';
  return 'other';
}

export function normalizeUrl(raw) {
  const url = raw.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// Parses free-form notes such as:
//   *Website*  <urls...>
//   *Supabase* <email> then project names, ...
// Returns { websites: [{url,name,platform}], services: [{type,account_email,note,projects:[]}] }
export function parseInventory(text) {
  const websites = [];
  const services = [];
  let section = null;
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const header = line.match(/^\*+\s*([^*]+?)\s*\*+$/);
    if (header) {
      const name = header[1].toLowerCase();
      section = name === 'website' ? 'website' : SERVICE_TYPES.includes(name) ? name : null;
      current = null;
      continue;
    }
    if (!section) continue;

    if (section === 'website') {
      const url = normalizeUrl(line);
      websites.push({ url, name: url.replace(/^https?:\/\//, '').split('.')[0], platform: detectPlatform(url) });
      continue;
    }

    const emailMatch = line.match(/^([^\s@]+@[^\s@]+\.[^\s@(]+)\s*(?:\(\s*(.*?)\s*\)?)?$/);
    if (emailMatch) {
      const paren = (emailMatch[2] || '').trim();
      current = { type: section, account_email: emailMatch[1].toLowerCase(), note: '', projects: [] };
      // Render notes name the project; Cloudinary notes describe what the account is for
      if (paren) {
        if (section === 'render') current.projects.push(paren);
        else current.note = paren;
      }
      services.push(current);
    } else if (current) {
      current.projects.push(line);
    }
  }

  return { websites, services };
}
