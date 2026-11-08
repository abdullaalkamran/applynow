import{n as e}from"./createLucideIcon-ChhPh1Qd.js";import{c as t,n,r}from"./apiClient-DXr9fnNu.js";import{Ft as i}from"./index-Dob-Rfl5.js";import{l as a}from"./blogApi-CHU0Z1Ux.js";var o=e();function s(e,t){let n=[],r=/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g,a=0,c=0,l;for(;l=r.exec(e);){l.index>a&&n.push(e.slice(a,l.index));let r=l[0],u=`${t}-${c++}`;if(r.startsWith(`**`))n.push((0,o.jsx)(`strong`,{className:`font-semibold text-neutral-900`,children:s(r.slice(2,-2),u)},u));else if(r.startsWith("`"))n.push((0,o.jsx)(`code`,{className:`rounded bg-black/[0.06] px-1 py-0.5 text-[0.9em]`,children:r.slice(1,-1)},u));else if(r.startsWith(`*`))n.push((0,o.jsx)(`em`,{children:r.slice(1,-1)},u));else{let[,e,t]=/^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(r)??[];t&&/^https?:\/\//i.test(t)?n.push((0,o.jsx)(`a`,{href:t,target:`_blank`,rel:`noopener noreferrer`,className:`font-medium text-neutral-900 underline underline-offset-2`,children:e},u)):t&&/^\/(?!\/)/.test(t)?n.push((0,o.jsx)(i,{to:t,className:`font-medium text-neutral-900 underline underline-offset-2`,children:e},u)):n.push(r)}a=l.index+r.length}return a<e.length&&n.push(e.slice(a)),n}function c({text:e}){let t=e.replace(/\r\n/g,`
`).split(`
`),n=[],r=[],i=null,a=0,c=()=>{if(r.length){let e=`p${a++}`;n.push((0,o.jsx)(`p`,{className:`mt-4`,children:s(r.join(` `),e)},e)),r=[]}},l=()=>{if(!i)return;let e=`l${a++}`,t=i.ordered?`ol`:`ul`;n.push((0,o.jsx)(t,{className:`mt-4 space-y-2 pl-6 marker:text-neutral-400 ${i.ordered?`list-decimal`:`list-disc`}`,children:i.items.map((t,n)=>(0,o.jsx)(`li`,{children:s(t,`${e}-${n}`)},n))},e)),i=null};for(let e of t){let t=e.trim(),u;if(!t){c(),l();continue}if(/^(-{3,}|\*{3,}|_{3,})$/.test(t)){c(),l(),n.push((0,o.jsx)(`hr`,{className:`my-8 border-neutral-200`},`h${a++}`));continue}if(u=/^(#{1,6})\s+(.*)$/.exec(t)){c(),l();let e=`hd${a++}`;n.push(u[1].length<=2?(0,o.jsx)(`h2`,{className:`mt-12 text-2xl font-bold tracking-tight text-neutral-900`,children:s(u[2],e)},e):(0,o.jsx)(`h3`,{className:`mt-7 text-[18px] font-semibold text-neutral-900`,children:s(u[2],e)},e));continue}if(u=/^[-*•]\s+(.*)$/.exec(t)){c(),(!i||i.ordered)&&(l(),i={ordered:!1,items:[]}),i.items.push(u[1]);continue}if(u=/^\d+[.)]\s+(.*)$/.exec(t)){c(),(!i||!i.ordered)&&(l(),i={ordered:!0,items:[]}),i.items.push(u[1]);continue}l(),r.push(t)}return c(),l(),(0,o.jsx)(o.Fragment,{children:n})}var l={metaTitle:`About UnifinderAi — Study Abroad for Bangladeshi Students`,metaDescription:`UnifinderAi helps Bangladeshi students study abroad: an AI voice assistant guides every step, plus 27,000+ courses, scholarships and expert counsellors.`,heading:`About UnifinderAi`,subheading:`Study abroad from Bangladesh, made simple`,body:`**UnifinderAi** (unifinderai.com) is a study abroad platform built for **Bangladeshi students**, with a personal **AI voice assistant** that guides you through every step of your application. Just talk to it: it finds the right universities, helps you **submit your application to the university portal**, tracks what's pending and tells you exactly what to do next. Behind it is a team of expert counsellors, so you are never on your own.

Find the right university, compare courses, discover **scholarships for Bangladeshi students** and apply, all in one place.

Search **27,000+ courses** at universities in the **United Kingdom, Malaysia, South Korea** and other study destinations. Every course page shows tuition fees, intakes, entry requirements and English test scores, so you can make your decision with real information instead of guesswork.

## Why we built UnifinderAi

Every Bangladeshi family has had this conversation: *"Which country? Which university? Can we afford it? Is there a scholarship?"*

Too often the answers depend on whichever agent you happen to visit. Students in Dhaka, Chattogram, Sylhet and across Bangladesh deserve clear, honest information **before** they spend money on applications.

We built UnifinderAi to give every student:

- **Clear facts:** fees, intakes, IELTS/PTE/Duolingo requirements and deadlines for each course
- **A personal AI voice assistant:** a guide that knows where you are in your application and tells you the next step, any time of day
- **Smart matching:** universities and scholarships that fit your **CGPA, IELTS score and budget**
- **Real people:** qualified counsellors who guide you through applications, your **student visa**, and pre-departure preparation

## Meet your AI voice assistant: your study abroad guide, step by step

Applying to universities abroad involves dozens of steps: shortlisting, documents, SOPs, portal forms, deposits, CAS and visa. It's easy to miss one. The UnifinderAi **AI voice assistant** keeps you on track from your first search to your visa.

### Talk, don't type

Ask questions in plain English by voice: *"Which UK universities accept IELTS 6.0 with a September intake?"* or *"What should I do next?"* You get a clear spoken answer.

### Helps you submit applications to university portals

The assistant walks you through each university's application portal: what to enter, which documents to upload and when to submit. You don't have to struggle with confusing forms alone.

### Creates and manages your tasks

"Upload passport", "Book IELTS", "Pay deposit", "Prepare bank statement": the assistant adds tasks to your checklist automatically, with deadlines.

### Summarises your pending work

Ask *"What's pending?"* to get an instant summary of incomplete documents, waiting offers and upcoming deadlines across all your applications.

### Tells you the next step

After every action, the assistant tells you what comes next, from offer letter to CAS to visa appointment, so you always know where you stand.

### Guides you step by step

From choosing a course to preparing for your **student visa interview**, the assistant explains each stage in simple language and connects you with a human counsellor whenever you need one.

## What else you can do on UnifinderAi

### Find universities and courses abroad

Compare undergraduate, postgraduate (Masters, MBA) and foundation courses side by side. Filter by country, subject, fee and intake (January, May, September).

### Discover scholarships for Bangladeshi students

See merit scholarships, tuition fee discounts and early-payment offers that universities give to international students from Bangladesh.

### Get matched by AI

Tell the assistant your SSC/HSC or bachelor's results, IELTS score and budget. It shortlists universities where you have a realistic chance of getting in.

### Apply with expert counsellors

Our counsellors help with your university application, Statement of Purpose (SOP), document checks, CAS / offer letters and **student visa** preparation.

### Stay updated with study abroad guides

Read our up-to-date guides on student visa interviews, UK visa bank balance requirements, cost of living and more in our [News & Updates](/news) section.

## Popular study destinations for Bangladeshi students

### Study in UK from Bangladesh

World-ranked universities, 1-year Masters degrees and the Graduate Route work visa. [Explore universities →](/universities)

### Study in Malaysia from Bangladesh

Affordable tuition, English-taught degrees, a Muslim-friendly culture and a short flight from Dhaka. [Explore universities →](/universities)

### Study in South Korea from Bangladesh

Modern universities, strong tech and engineering programmes, and generous scholarships for international students. [Explore universities →](/universities)

## How it works

1. **Talk or search:** ask the AI voice assistant, or browse 27,000+ courses.
2. **Compare:** check fees, entry requirements, intakes and scholarships.
3. **Apply step by step:** the assistant builds your task list and guides you through each university portal, with counsellors to back you up.
4. **Stay on track:** ask "What's pending?" anytime, and the assistant summarises your progress and tells you the next step, right up to your visa.

[Start your search →](/courses)

## UnifinderAi is an independent company

**Please note:** UnifinderAi (**unifinderai.com**) is an independent study abroad platform. We are **not affiliated** with *Unifinder* (unifinder.ai), *myunifinder.com*, *unifinder.org*, or *Charlie Group*. These are separate businesses with similar names.

Our only official website is **https://unifinderai.com**, and our official Instagram is **@unifinderai.official**.`,faqs:[{q:`What does the UnifinderAi AI voice assistant do?`,a:`It is your personal study abroad guide. You can talk to it to find universities, get help submitting applications on university portals, add and manage tasks, hear a summary of your pending work, and find out the next step in your application, from shortlisting to student visa.`},{q:`Is UnifinderAi free for students?`,a:`Searching courses, comparing universities and reading entry requirements is free and needs no account. Applying needs a free account.`},{q:`Will the AI assistant submit my university application for me?`,a:`It guides you through each university's application portal step by step and helps you get everything ready to submit, so nothing is missed. Our counsellors review your application whenever you need a human check.`},{q:`Can Bangladeshi students get scholarships to study abroad?`,a:`Yes. Many universities in the UK, Malaysia and South Korea offer merit scholarships and tuition discounts to Bangladeshi students, often based on your CGPA and IELTS score. UnifinderAi shows the scholarships available on each course page.`},{q:`What IELTS score do I need to study abroad from Bangladesh?`,a:`Most undergraduate courses ask for IELTS 6.0, and most postgraduate courses ask for 6.5, but requirements vary by university. Many universities also accept PTE, TOEFL or Duolingo. Check each course page on UnifinderAi for the exact score.`},{q:`Is UnifinderAi the same as unifinder.ai or myunifinder.com?`,a:`No. UnifinderAi (unifinderai.com) is a separate, independent company. We are not connected to unifinder.ai, myunifinder.com or Charlie Group.`},{q:`Does UnifinderAi help with student visas?`,a:`Yes. Our counsellors help you prepare your documents, bank statements and visa interview for the UK, Malaysia, South Korea and other destinations.`}],company:{legalName:``,foundedYear:``,founders:``,address:``,email:``,phone:``},social:{instagram:`https://www.instagram.com/unifinderai.official/`,facebook:``,linkedin:``,youtube:``}},u=e=>a(`/api/public/about`,e),d=()=>r(`/api/about`),f=e=>t(`/api/about`,e),p=()=>n(`/api/about`);function m(e){return[[`Registered company`,e.legalName],[`Founded`,e.foundedYear],[`Founders`,e.founders],[`Office`,e.address],[`Email`,e.email],[`Phone / WhatsApp`,e.phone]].filter(([,e])=>e)}export{p as a,d as i,m as n,f as o,u as r,c as s,l as t};