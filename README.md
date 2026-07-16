# RTV Shadap

RTV Shadap je Manifest V3 razširitev za Chrome in Brave, ki na vseh straneh `https://www.rtvslo.si/*` ročno posivi novice, ki jih želiš označiti kot že pregledane. V popupu pritisneš velik gumb, vse novice na trenutni strani postanejo sive, isti članki pa ostanejo sivi tudi drugje na RTV SLO.

Razširitev ne uporablja strežnika, zunanjih API-jev, analitike ali telemetrije. Vsa zgodovina je shranjena lokalno v `chrome.storage.local` posameznega brskalnika.

## Projektni kontekst za agente

Ta projekt je bil razvit skozi iterativno delo z LLM agentom. Za prihodnje vzdrževanje naj agenti najprej preberejo:

- `AGENTS.md`: kratka pravila in invarianti za coding agente.
- `docs/LLM_HANDOFF.md`: podroben projektni spomin, arhitektura, UX odločitve, release playbook in debugging navodila.

## Kako deluje

- Content script deluje na vseh straneh `www.rtvslo.si` in na vsaki strani poišče RTV članke ter medijske kartice.
- Extractor pregleda semantične elemente, preveri samo verjetne RTV članke in uporabi stabilen ključ iz številčnega ID-ja na koncu URL-ja, na primer `rtv:704321`.
- Service worker je edini pisec v `chrome.storage.local`.
- Nalaganje, zapiranje, osveževanje in zapuščanje strani ne spreminjajo zgodovine. Tudi kliki na članke se ne beležijo.
- Samo popup gumb `Do the magic` doda trenutno najdene članke v trajno lokalno zgodovino.
- Stabilni ključ pomeni, da ista ročno označena novica ostane siva na naslovnici, kategorijah in drugih RTV straneh.
- Novice z močnim signalom `V živo`, `v zivo` ali `LIVE` ostanejo vizualno polno poudarjene tudi, če so v zgodovini.
- Izbrani moteči promocijski bloki se še naprej skrivajo samo na natančni RTV naslovnici.

## DOM audit

Žive strani iz razvojnega okolja ni bilo mogoče avtomatsko pregledati, zato je bil 2026-06-30 uporabljen ročno shranjen vzorec `tests/fixtures/rtvslo-homepage.html`.

Ugotovitve iz vzorca:

- URL člankov ima številčni ID na koncu poti, npr. `/gospodarstvo/medletna-inflacija-junija-ostaja-pri-3-6-odstotka/786788`.
- Glavni ovoji kartic so `xl-news`, `md-news`, `sm-news` in `article-container`.
- Naslovi so v heading elementih z razredi, kot so `title-cut-4-rows`, `title-cut-5-rows` in `list-title`.
- Slike so povezane prek `image-link`, `image-container`, `container-16-9`, znotraj pa so `img.image-original` ali `img.img-fluid`.
- V vzorcu ni bilo prave novice z oznako `V živo`; pojavile so se samo navigacijske povezave za TV/365 v živo. Live detection zato ostaja omejen na kratke badge/label signale v isti kartici in naslov.

Izolirana mesta za nadaljnji ročni pregled:

- `src/content/extractor.ts`: `CARD_SELECTOR`, `TITLE_SELECTOR`, `CONTENT_ROOT_SELECTOR`
- `src/content/live-detection.ts`: atributi in kratke oznake za live signal

## Najlazja namestitev na novi napravi

Chrome in Brave unpacked extensiona ne namestita direktno iz zipa. Zip je samo prirocen paket za prenos; na novi napravi ga odzipas in v brskalniku izberes odzipano mapo.

1. Odpri GitHub repo `matejbolta/rtv-shadap`.
2. Pojdi na Releases.
3. Prenesi zadnji `rtv-shadap-vX.Y.Z.zip`.
4. Odzipaj ga, na primer v `~/Extensions/rtv-shadap-vX.Y.Z/`.
5. V Chrome ali Brave nalozi odzipano mapo kot unpacked extension.

Direktni link: <https://github.com/matejbolta/rtv-shadap/releases>

V Releases sta lahko dva zipa za isto verzijo:

- `rtv-shadap-vX.Y.Z.zip`: uporabi tega za rocno namestitev na svojem racunalniku.
- `rtv-shadap-vX.Y.Z-webstore.zip`: tega ne uporabljaj za rocno namestitev; namenjen je samo za upload v Chrome Web Store.

Ce release se ni narejen, lahko uporabis tudi zadnji successful GitHub Actions run:

1. Odpri Actions.
2. Izberi zadnji zeleni CI run.
3. Prenesi artifact `rtv-shadap-extension`.
4. Odzipaj artifact.
5. V brskalniku kot unpacked extension izberi odzipano mapo.

Direktni link: <https://github.com/matejbolta/rtv-shadap/actions>

### Brave na Pop!_OS

1. Odpri `brave://extensions`.
2. Vklopi Developer mode.
3. Izberi Load unpacked.
4. Izberi odzipano mapo `rtv-shadap-vX.Y.Z`.
5. Odpri `https://www.rtvslo.si/`.

### Chrome

1. Odpri `chrome://extensions`.
2. Vklopi Developer mode.
3. Izberi Load unpacked.
4. Izberi odzipano mapo `rtv-shadap-vX.Y.Z`.
5. Odpri `https://www.rtvslo.si/`.

### Posodobitev na novi napravi

Unpacked extension se ne posodobi samodejno iz GitHuba. Za posodobitev prenesi novi zip, ga odzipaj cez staro mapo ali v novo mapo, potem v `chrome://extensions` ali `brave://extensions` klikni reload ikono pri RTV Shadap.

## Ustvarjanje release zipa

Lokalno:

```sh
pnpm install
node scripts/package.mjs
```

To ustvari dva zipa:

- `release/rtv-shadap-vX.Y.Z.zip`: za rocno unpacked namestitev. V zipu je ena mapa `rtv-shadap-vX.Y.Z/`, da ga lahko normalno odzipas in izberes kot unpacked extension.
- `release/rtv-shadap-vX.Y.Z-webstore.zip`: za upload v Chrome Web Store. V zipu je `manifest.json` direktno v korenu, ker Google zahteva tak format.

Na GitHubu:

```sh
git tag vX.Y.Z
git push origin vX.Y.Z
```

Push taga zazene Release workflow, ki naredi GitHub Release in pripne zip.

Za Chrome Web Store obrazce uporabi `STORE_SUBMISSION.md`.

## Developer namestitev

Ce hoces na novi napravi buildati iz source kode:

```sh
git clone git@github.com:matejbolta/rtv-shadap.git
cd rtv-shadap
corepack enable
pnpm install
pnpm build
```

Nato v Chrome ali Brave nalozi mapo `dist/` kot unpacked extension.

## Skripte

```sh
pnpm typecheck
pnpm test
pnpm build
node scripts/package.mjs
pnpm watch
```

`dist/` in `release/` sta generiran output in nista commitana v repo.

## Ročni testni scenariji

1. Pritisni `Reset` in odpri `https://www.rtvslo.si/`; novice morajo ostati polno vidne tudi po reloadu ali ponovnem odprtju taba.
2. Klikni navadno novico in se vrni; klik sam je ne sme posiviti.
3. V popupu pritisni `Do the magic`; vse najdene navadne novice morajo takoj postati sive.
4. Odpri kategorijo, na primer `/slovenija`; prej označeni isti članki morajo ostati sivi, nove kartice pa polno vidne.
5. Pritisni gumb tudi na kategorijski strani; njene novice morajo ostati sive po reloadu in na drugih RTV straneh.
6. Če je ista novica v veliki kartici in stranskem stolpcu, mora imeti povsod enako stanje.
7. Kartica z izrecnim `V živo` ali `LIVE` signalom ne sme biti zatemnjena.
8. Izklopi razširitev; vsi custom markerji in zatemnitve morajo izginiti, gumb za ročno označevanje pa mora biti onemogočen.
9. Pritisni `Reset`; vse ročno označene novice morajo ponovno postati polno vidne.

## Projektna drevesna struktura

```text
public/manifest.json
scripts/build.mjs
src/background/
src/content/
src/popup/
src/shared/
tests/
```

## Preostala ročna negotovost

Po namestitvi je treba na živi naslovnici in glavnih kategorijah potrditi najprimernejše selektorje za najmanjši varen container kartice in morebitne native live badge class/attribute signale. Logika je pripravljena tako, da se ti selectorji lahko dopolnijo na enem mestu.
