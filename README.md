# RTV Shadap

RTV Shadap je Manifest V3 razširitev za Chrome in Brave, ki deluje samo na naslovnici `https://www.rtvslo.si/`. Utiša že videne RTV novice, odstrani moteče promocijske bloke in pusti novim naslovom, da izstopijo.

Razširitev ne uporablja strežnika, zunanjih API-jev, analitike ali telemetrije. Vsa zgodovina je shranjena lokalno v `chrome.storage.local` posameznega brskalnika.

## Kako deluje

- Content script se takoj ustavi, če stran ni natančno RTV SLO naslovnica.
- Extractor pregleda semantične elemente, preveri samo verjetne RTV članke in uporabi stabilen ključ iz številčnega ID-ja na koncu URL-ja, na primer `rtv:704321`.
- Service worker je edini pisec v `chrome.storage.local`. Vodi zgodovino, odprte novice in pending obiske za več tabov.
- Novica postane `Že videno` šele ob zaključku obiska, ne ob samem renderju.
- Klik, Cmd/Ctrl klik, middle click in Enter na povezavi takoj označijo novico kot `Odprto`.
- Novice z močnim signalom `V živo`, `v zivo` ali `LIVE` ostanejo vizualno polno poudarjene, tudi če so že videne ali odprte.

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

## Namestitev na novi napravi

```sh
git clone <repo-url>
cd rtv-shadap
corepack enable
pnpm install
pnpm build
```

Nato v Chrome ali Brave naloži mapo `dist/` kot unpacked extension.

## Chrome

1. Odpri `chrome://extensions`.
2. Vklopi Developer mode.
3. Izberi Load unpacked.
4. Izberi mapo `dist/`.
5. Odpri `https://www.rtvslo.si/`.

## Brave

1. Odpri `brave://extensions`.
2. Vklopi Developer mode.
3. Izberi Load unpacked.
4. Izberi mapo `dist/`.
5. Odpri `https://www.rtvslo.si/`.

## Skripte

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm watch
```

`dist/` je generiran build output in ni commitan v repo.

## Ročni testni scenariji

1. Ponastavi zgodovino v popupu in odpri `https://www.rtvslo.si/`; navadne novice morajo ostati polno vidne.
2. Zapri naslovnico in jo odpri znova; prej najdene novice morajo biti `Že videno`.
3. Odpri novico z navadnim klikom, Ctrl/Cmd klikom, middle clickom in Enter; vse podvojene predstavitve iste novice morajo postati `Odprto`.
4. Če je ista novica v veliki kartici in stranskem stolpcu, mora imeti povsod enako stanje.
5. Kartica z izrecnim `V živo` ali `LIVE` signalom ne sme biti zatemnjena.
6. V DevTools dodaj mock kartico z veljavnim RTV URL-jem; observer jo mora zaznati brez reloada.
7. Izklopi razširitev v popupu; vsi custom markerji in zatemnitve morajo izginiti.

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

Po namestitvi je treba na živi RTV naslovnici potrditi najprimernejše selektorje za najmanjši varen container kartice in morebitne native live badge class/attribute signale. Logika je pripravljena tako, da se ti selectorji lahko dopolnijo na enem mestu.
