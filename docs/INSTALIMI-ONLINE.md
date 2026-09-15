# Instalimi online — lista e hapave

Sistemi xhiron në tri pjesë:

| Pjesa | Ku | Plani |
| --- | --- | --- |
| Faqja (frontend) | Netlify | falas |
| Serveri (backend/API) | Render | falas gjatë provës, `$7/muaj` kur bari varet prej tij |
| Databaza | Aiven MySQL | falas (1 GB) |

Kjo faqe është për atë që e instalon dhe e mirëmban. Për stafin e barit
(kamarierë/menaxher) shërben manuali i veçantë.

---

## 1. Databaza (Aiven)

Databaza është krijuar dhe adresa e lidhjes ndodhet si `DATABASE_URL` në
Environment të Render-it. Nga ajo adresë varen edhe backup-et më poshtë.

Kufizimet e planit falas që duhen mbajtur mend:

- **1 GB** hapësirë. Për një bar mbulon vite. Tabela që rritet më shpejt është
  `AuditLog` (regjistri i veprimeve, me JSON brenda) — shihe pas ndonjë muaji.
- **76 lidhje** njëkohësisht. Normale nuk afrohet.
- Aiven-i **fik shërbimin nëse qëndron pa aktivitet** (dërgon email para se ta
  fikë). Nëse bari pushon një javë, kontrollo panelin e Aiven-it para hapjes.

## 2. Serveri (Render)

Repo-ja përmban `render.yaml`, pra shërbimi ngrihet nga Blueprint. Render-i
xhiron vetë `npm install && npm run build && npm run db:push` — pra **kolonat
dhe tabelat e reja aplikohen automatikisht në çdo deploy**, nuk duhet punë
manuale për skemën.

### Variablat që duhen vendosur me dorë

`render.yaml` i cakton vetë `NODE_ENV`, `TZ`, `BUSINESS_TIMEZONE`, `PORT`,
`HOST`, `JWT_SECRET` (gjenerohet) dhe `API_DOCS_ENABLED=false`. Tri të tjerat
varen nga adresat e tua dhe vendosen në panelin e Render-it:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE?ssl-mode=REQUIRED"
CORS_ORIGINS="https://EMRI-I-SITE-IT.netlify.app"
GUEST_ORDER_PUBLIC_BASE_URL="https://EMRI-I-SITE-IT.netlify.app"
```

`CORS_ORIGINS` duhet të jetë **saktësisht** adresa e faqes, pa `/` në fund.
Mos e lë `*` — kjo do t'i lejonte çdo faqe në internet t'i thërrasë API-t e
barit me sesionin e një punonjësi të kyçur.

### Dremitja e planit falas

Shërbimi falas **fiket pas 15 minutash pa trafik**, dhe kërkesa e parë pastaj
zgjat 30–50 sekonda — e papranueshme kur kamarieri pret te tavolina.

Zgjidhja gjatë provës: një ping i jashtëm çdo 10 minuta.

1. Hap [cron-job.org](https://cron-job.org) (falas) dhe regjistrohu.
2. Create cronjob → URL: `https://SHERBIMI.onrender.com/api/health`
3. Execution schedule: **every 10 minutes**.
4. Ruaj. Statusi duhet të kthejë `200`.

**Kufiri që duhet respektuar:** plani falas ka **750 orë instance në muaj për
workspace**, dhe një muaj ka **744 orë**. Pra një shërbim i mbajtur zgjuar hyn
brenda me ~6 orë margjinë. Nëse hap edhe një shërbim të dytë falas në të
njëjtin workspace (p.sh. një kopje testimi), kufiri kalohet dhe **shërbimi
ndalon deri në muajin tjetër**, pa paralajmërim, në mes të punës.

Ditën që bari varet vërtet prej sistemit, kalo në planin **Starter $7/muaj**:
nuk dremit, pa kufi orësh, pa ping. Render-i faturon në sekondë, pra kalimi
është një klik dhe pa angazhim. Kjo është kosto operative e hotelit, si
interneti — shkruaje në dorëzim.

## 3. Faqja (Netlify)

Repo-ja përmban `netlify.toml`. Cilësimet:

```text
Base directory:    frontend
Build command:     npm run build
Publish directory: dist
```

Një variabël environment:

```env
VITE_API_URL="https://SHERBIMI.onrender.com/api"
```

Pas ndryshimit të kësaj variable duhet **redeploy** — adresa e API-t futet
brenda faqes gjatë build-it, nuk lexohet në kohë reale.

## 4. Backup i databazës online

Databaza tash jeton në serverin e tjetrit. Plani falas nuk është rrjet
siguresë — backup-i bëhet nga një kompjuter që ndizet çdo natë.

Krijo `backend/.env.remote` (git-i e injoron) me adresën e databazës online,
të njëjtën si `DATABASE_URL` në Render:

```env
TARGET_DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE?ssl-mode=REQUIRED"
```

Pastaj:

```powershell
cd backend
npm run backup:db -- --remote
```

Fajlli ruhet si `db-online-...sql` në `backend/backups`, dhe kopjohet edhe në
dosjen e dytë nëse `BACKUP_SYNC_DIR` është vendosur në `.env` (dosje OneDrive
ose disk i jashtëm — backup-i që qëndron vetëm në një kompjuter nuk e mbijeton
atë kompjuter). Dump-et më të vjetra se 30 ditë fshihen vetë.

Për ta bërë automatik, Task Scheduler:

```text
Program/script:  cmd.exe
Add arguments:   /c "C:\...\backend\nightly-backup.bat --remote"
Start in:        C:\...\backend
Trigger:         daily, 04:00
```

**Provo restaurimin njëherë** në një databazë të zbrazët para se t'i besosh:

```powershell
mysql -u root coffee_test < backups\db-online-....sql
```

Backup-i i paprovuar nuk është backup.

## 5. Kalimi i të dhënave lokale online

Kur databaza lokale ka produktet/tavolinat/stafin e duhur dhe do t'i çosh
online:

```powershell
cd backend
npm run copy:db                      # vetëm krahason, nuk shkruan
npm run copy:db -- --apply --replace # zëvendëson të dhënat online
```

`--replace` fshin çdo rresht online para kopjimit. Skripti kopjon me id-të
origjinale, pra lidhjet mbeten të sakta, dhe në fund numëron rreshtat në të dyja
anët për verifikim.

## 6. Para dorëzimit

```powershell
cd backend
npm run handover:prepare              # tregon çka fshihet e çka krijohet
npm run handover:prepare -- --apply   # e bën
```

Fshin të dhënat e testimit dhe llogaritë demo (PIN `1111` etc. janë publike në
kodin burimor), dhe krijon stafin, tavolinat e menynë e vërtetë nga
`handover-setup.json`. Emrat e seksioneve duhen saktësisht `Main Hall`,
`Terrace 1`, `Terrace 2` — skripti e kontrollon, se ekrani i kamarierëve nuk
njeh seksione të tjera.

Pas setup-it, fshije `handover-setup.json` ose ruaje privatisht: ka PIN-at në
tekst të hapur.

## Rreziqet operative që duhet t'i dijë hoteli

**Interneti është pika e vdekjes.** Nëse bie interneti i hotelit, bie POS-i —
kamarierët mbeten pa mundësi të marrin porosi. Zgjidhja e lirë: një telefon me
hotspot si rezervë, dhe stafi t'i dijë dy hapat për t'i lidhur tabletat me të.
Mësoja menaxherit para dorëzimit, jo ditën kur ndodh.

**Hyrja mbrohet me PIN 4-shifror.** Mbrojtja: 12 tentativa për 10 minuta sipas
IP-së dhe përdoruesit, bllokim 15 minuta pas 5 tentativave të gabuara (për
përdorues, pa marrë parasysh IP-në), dhe 3 sekonda vonesë në çdo tentativë.
Praktikisht ~480 tentativa në ditë — provimi i të 10.000 kombinimeve do kërkonte
~21 ditë pa ndërprerje, me llogarinë e bllokuar dukshëm gjatë gjithë kohës.
Kushdo që e ka adresën mund t'i bllokojë qëllimisht 15 minuta një kamarier duke
gabuar 5 herë; bezdi, jo shkelje.

**Kuponi fiskal.** Ajo që lëshon aplikacioni është dokument i brendshëm, jo
kupon fiskal i certifikuar nga ATK. Si bashkëjeton me arkën fiskale duhet
konfirmuar me kontabilistin e hotelit — para dorëzimit, jo pas.

## Kostot mujore

| Zëri | Kostoja |
| --- | --- |
| Netlify (faqja) | 0 |
| Render (serveri) | 0 gjatë provës → `$7/muaj` kur është live |
| Aiven (databaza) | 0 (deri 1 GB) |
| **Gjithsej** | **~$7/muaj** (~6.5 €) |
