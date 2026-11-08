// One-time tidy-up of existing News posts after the SEO migration: gives each post a clean readable address (the random code at
// the end is dropped), keeps the old address as a redirect, and works out the FAQ from the text.
//
//   node server/scripts/clean-news-slugs.js          shows what would change
//   node server/scripts/clean-news-slugs.js --apply  does it
//
// Safe to run again: a post that already has a clean address is left alone.
const prisma = require("../src/prismaClient");
const { makeSlug, uniqueSlug, detectFaq } = require("../src/blogSeo");

const apply = process.argv.includes("--apply");

(async () => {
  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: "asc" } });
  const taken = new Set();
  for (const p of posts) { taken.add(p.slug); (Array.isArray(p.oldSlugs) ? p.oldSlugs : []).forEach((x) => taken.add(x)); }
  for (const p of posts) {
    const data = { faqJson: detectFaq(p.content) };
    if (/-[a-f0-9]{6}$/.test(p.slug)) {
      taken.delete(p.slug); // its own current address doesn't block it
      const next = uniqueSlug(makeSlug(p.title), (x) => taken.has(x));
      taken.add(next); taken.add(p.slug);
      data.slug = next;
      data.oldSlugs = [...new Set([...(Array.isArray(p.oldSlugs) ? p.oldSlugs : []), p.slug])];
    }
    console.log(`${data.slug ? `${p.slug}\n   -> ${data.slug}` : `${p.slug} (address kept)`}  | FAQ questions: ${data.faqJson.length}`);
    if (apply) await prisma.blogPost.update({ where: { id: p.id }, data });
  }
  console.log(apply ? "Done." : "Dry run — nothing changed. Add --apply to save.");
  await prisma.$disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
