export const access = "public";

export default async function (req, res) {
  const urls = {
    cwc: 'https://ffs.india-water.gov.in/#/',
    google: 'https://sites.research.google/floods/l/0/0/3'
  };
  const result = {};
  for (const [key, url] of Object.entries(urls)) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      result[key] = r.ok;
    } catch (_) {
      result[key] = false;
    }
  }
  res.json({ ...result, checkedAt: new Date().toISOString() });
}