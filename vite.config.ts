import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { readFileSync } from 'node:fs'

const SITE_URL = (process.env.VITE_SITE_URL || 'https://unifinderai.com').replace(/\/+$/, '')
const DESCRIPTION =
  'Find universities and courses worldwide, compare fees and entry requirements, and apply with the help of counsellors and an AI assistant. Track your documents and application from offer to enrolment.'

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The landing page ("/") is served as a plain static index.html by the web server in front of Node, so Node's own
 * SEO renderer (server/src/seo.js) never gets to add anything to it. Bake the landing page's structured data (Organization,
 * WebSite, FAQPage — built from the same src/data/landingFaq.json the visible FAQ uses) and a <noscript> copy of its text
 * into the built index.html. server/src/seo.js strips both again for every other route it renders.
 */
function landingSeo(): Plugin {
  return {
    name: 'landing-seo',
    transformIndexHtml(html) {
      const faq = JSON.parse(readFileSync(new URL('./src/data/landingFaq.json', import.meta.url), 'utf8')) as { q: string; a: string }[]
      const ld = [
        { '@context': 'https://schema.org', '@type': 'Organization', name: 'UnifinderAi', url: SITE_URL, logo: `${SITE_URL}/brand/share.png`, description: DESCRIPTION },
        { '@context': 'https://schema.org', '@type': 'WebSite', name: 'UnifinderAi', url: SITE_URL, description: DESCRIPTION },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        },
      ]
      const scripts = ld.map((o) => `<script type="application/ld+json" data-landing-seo>${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n    ')
      const noscript = `<noscript data-landing-seo><main><h1>UnifinderAi — Find your next university</h1><p>${escHtml(DESCRIPTION)}</p><p><a href="/news">News &amp; Updates</a> · <a href="/login">Sign in</a> · <a href="/signup">Create an account</a></p><h2>Frequently asked questions</h2>${faq.map((f) => `<h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p>`).join('')}</main></noscript>`
      return html
        .replace('</head>', `    <link rel="canonical" href="${SITE_URL}/" />\n    ${scripts}\n  </head>`)
        .replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), landingSeo()],
})
