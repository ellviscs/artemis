# U4 · Local fire campaigns: research for approval

Checked 14 Nov 2026 against each organization's own website (and the campaign page for platform campaigns). Nothing below is invented. Social accounts are the ones the organization's own site links to. Coordinates are approximate work-area centres (for distance ranking), not office addresses.

## Proposed "Verified" badge rule

A campaign gets the badge only when **both** are true:

1. **Fire work is documented here.** The organization's own site (or the campaign page) documents fire prevention, firefighting or fire response in that province.
2. **The money goes to a known recipient.** The donate link goes to the organization's own donate page, or to a platform campaign whose organizer identity the platform has verified (Kitabisa "Identitas terverifikasi") or a registered national zakat body (Rumah Zakat).

The tooltip will say exactly this. Entries that are sourced but fail one condition are listed without the badge, with the reason shown.

## Organizations working in a specific province

| # | Organization | Province · work area | Fire work, per own site | Donate link | Socials (from own site) | Badge |
|---|---|---|---|---|---|---|
| 1 | **Borneo Nature Foundation** (Indonesian reg. AHU-000405.AH.01.05) | Central Kalimantan · Sebangau peat-swamp forest, near Palangka Raya (≈ −2.32, 113.90) | Supports 11 community firefighting and patrol teams; "Emergency firefighting & prevention" campaign | borneonaturefoundation.org/donate/ and /campaigns/emergency-firefighting-prevention/ | Facebook BorneoNatureFoundation · Instagram borneo.nature · YouTube OrangutanTrop · LinkedIn | ✅ |
| 2 | **BOS Foundation** (Borneo Orangutan Survival Foundation) | Central Kalimantan · Nyaru Menteng, Palangka Raya (≈ −2.03, 113.75) | Fire appeal page (orangutan.or.id/fightfires); sprinkler and smoke-protection work at Nyaru Menteng | orangutan.or.id/donate | Facebook BOSFoundation · Instagram bosfoundation · X bornean_ou · YouTube · TikTok bos_foundation | ✅ |
| 3 | **YIARI** (Yayasan Inisiasi Alam Rehabilitasi Indonesia, IAR Indonesia) | West Kalimantan · Ketapang and Kayong Utara (≈ −1.85, 110.00) | Fire-period wildlife rescue update, 16 Sep 2026 (yiari.or.id/update-situasi-kebakaran) | yiari.or.id/donasi/ | Facebook IARIndonesia · Instagram iar_indonesia · X IAR_Indonesia · YouTube @IARIndonesia | ✅ |
| 4 | **Yayasan Palung** (Gunung Palung Orangutan Conservation Program) | West Kalimantan · six villages in Kayong Utara and village forests near Gunung Palung NP (≈ −1.25, 110.10) | Joint post-fire patrols in six Kayong Utara villages, 30 Oct 2026 | **No donate page on its own site.** A third-party appeal (Orangutan Republik "Emergency Fire Appeal") names it | Facebook (Gunung Palung Orangutan Conservation Program) · TikTok yayasan_palung | ❌ No own donate link. Listed with "Contact / follow" instead |
| 5 | **KKI Warsi** (Komunitas Konservasi Indonesia WARSI) | Jambi-based; its site cites karhutla prevention in **West Sumatra** (≈ −0.95, 100.35) | Karhutla prevention mentioned for West Sumatra | Not on its site | YouTube kkiwarsi · X KKIWarsi · Facebook warsi.kki · Instagram kki_warsi | ❌ No donate link. Listed as "follow" only, or dropped (your call) |

## Platform campaigns covering several provinces (fallback when no local org matches)

| # | Campaign | Organizer | Provinces named on the page | Status | Badge |
|---|---|---|---|---|---|
| 6 | Kitabisa "Urgent! Bantu Warga Terdampak Karhutla" (kitabisa.com/campaign/urgentkarhutla) | Simpul Setara (identity verified on Kitabisa) | West, Central and South Kalimantan · Jambi · South Sumatra · Papua | Live, about 16 days left | ✅ |
| 7 | Kitabisa "Patungan untuk Hutan" (kitabisa.com/campaign/patunganuntukhutan) | Patungan Untuk Hutan (verified) | Sumatra · Kalimantan · Papua | Live | ✅ |
| 8 | Rumah Zakat "Indonesia Darurat Karhutla" (old link now redirects to rumahzakat.org/donasi/Indonesia-Darurat-Karhutla) | Rumah Zakat | Kalimantan, Sumatra, southern Papua (Central, West and South Kalimantan highest) | Live | ✅ |

## Corrections to the current app

- **Riau label is wrong.** The app shows #6 as "Riau Fire Response & Community Relief". The page does not list Riau. It will be relabelled with its real title and provinces.
- **Rumah Zakat link moved.** #8's old URL redirects. It will use the current URL.

## Gaps (no verified local organization found)

- **Riau** and **South Sumatra**: no local organization with its own donate page and documented fire work turned up in this pass. Jikalahari (Riau) is a forest watchdog network with no fire program or donation page on its site.
  - **For now:** South Sumatra falls back to #6 and #7; Riau falls back to #7.
  - **Later:** MPA groups (Masyarakat Peduli Api) are village fire brigades under KLHK and have no public donation channels, so the app will name them as the local first responders without a link.
- **Save Our Borneo** (Central Kalimantan) was checked and left out: its site states no fire program.

## How the app will use it

- **Ranking:** campaigns are ranked by the distance from the selected hotspot to each work-area centre, with a same-province bonus. Each card shows "Nearest work area: X km".
- **Platform campaigns:** they count as "in province" only for the provinces their own page names.
- **Data file:** records go in `src/data/fireCampaigns.ts`, each with its source URL and the date it was checked.

## Outside Indonesia (added 14 Nov 2026)

These were checked against each organization's own site the same way. All meet the badge rule, so they show **Verified by Artemis**.

| Organization | Country · area | Fire work, per own site | Donate |
|---|---|---|---|
| NSW Rural Fire Service brigades | Australia · New South Wales | Lead agency for bush and grass fires across NSW, 70,000+ volunteers | rfs.nsw.gov.au/volunteer/support-your-local-brigade |
| CFA (Country Fire Authority) | Australia · Victoria | Fire service for regional Victoria (fire danger periods, permits, community fire safety) | cfa.vic.gov.au/about-us/supporting-cfa/donate-to-cfa |
| Canadian Red Cross | Canada · British Columbia | 2026 British Columbia Wildfires Appeal; wildfire recovery guide (charity 119219814RR0001) | give.redcross.ca/page/26BCF |
| IPAM Amazônia | Brazil · Mato Grosso, Pará | Fire research and integrated fire management; smoke monitoring for Indigenous brigades in the Xingu | ipam.org.br/doe/ |
| Fundación Bomberos de Argentina | Argentina · Río Negro, Chubut, Neuquén, La Pampa (also Córdoba, Corrientes) | Equipped 200+ volunteer firefighters for the 2026 Patagonia forest fires | donaronline.org (linked from its own /dona page) |
| Global Environment Centre | Malaysia · Selangor, Pahang, Johor, Sabah | Community peat-fire prevention patrols; fire-danger warning boards | gec.org.my/donation/ |
| TEMA Foundation | Türkiye · nationwide | Post-fire reforestation with the General Directorate of Forestry | tema.org.tr/bagislar |

**Not added:**
- **CAL FIRE Foundation:** its site returned a certificate error and could not be checked.
- **Everywhere else:** the other covered countries (USA, Mexico, South Africa, Europe, Asia) have no checked group yet.

**What the hub shows outside Indonesia:**
- **Checked groups:** the groups above, matched by country, then by state or province, then distance.
- **Every.org:** wildfire nonprofits whose own name or description names the state or country. They have no badge and are labelled "not checked by Artemis".
- **Indonesian campaigns:** never shown for a fire abroad.
