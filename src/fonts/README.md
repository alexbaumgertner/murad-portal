# Local fonts

These WOFF2 files replace build-time Google Fonts requests. Next serves them from
the site's own static assets through `next/font/local`. Planner faces keep
`preload: false`; site and tracker faces keep their preloads and CSS variables.

Source: [google/fonts at `954e256c4277`](https://github.com/google/fonts/tree/954e256c4277419b5e48bffa51be069b2bd01bde).
Each family's original license and copyright notice is in `licenses/<id>.txt`.

Converted from the upstream TrueType files with FontTools 4.67.0 and Brotli 1.2.0.
For variable fonts, non-weight axes are pinned to their upstream defaults, matching
the former Google loader's default axis selection; the weight axis is preserved.
No character subsetting is applied. The shipped files were reopened and checked for
Latin and Cyrillic glyphs, including Ё/ё (Newsreader is Latin-only, as before).

| Family             | Upstream file(s), relative to the pinned repository                         |
| ------------------ | --------------------------------------------------------------------------- |
| Inter              | `ofl/inter/Inter[opsz,wght].ttf`                                            |
| Manrope            | `ofl/manrope/Manrope[wght].ttf`                                             |
| Montserrat         | `ofl/montserrat/Montserrat[wght].ttf`                                       |
| Unbounded          | `ofl/unbounded/Unbounded[wght].ttf`                                         |
| Roboto             | `ofl/roboto/Roboto[wdth,wght].ttf`                                          |
| Open Sans          | `ofl/opensans/OpenSans[wdth,wght].ttf`                                      |
| PT Sans            | `ofl/ptsans/PT_Sans-Web-Regular.ttf`, `ofl/ptsans/PT_Sans-Web-Bold.ttf`     |
| Rubik              | `ofl/rubik/Rubik[wght].ttf`                                                 |
| Raleway            | `ofl/raleway/Raleway[wght].ttf`                                             |
| IBM Plex Sans      | `ofl/ibmplexsans/IBMPlexSans[wdth,wght].ttf`                                |
| Jost               | `ofl/jost/Jost[wght].ttf`                                                   |
| Nunito Sans        | `ofl/nunitosans/NunitoSans[YTLC,opsz,wdth,wght].ttf`                        |
| Ubuntu             | `ufl/ubuntu/Ubuntu-Regular.ttf`, `ufl/ubuntu/Ubuntu-Bold.ttf`               |
| Onest              | `ofl/onest/Onest[wght].ttf`                                                 |
| Golos Text         | `ofl/golostext/GolosText[wght].ttf`                                         |
| Fira Sans          | `ofl/firasans/FiraSans-Regular.ttf`, `ofl/firasans/FiraSans-Bold.ttf`       |
| Cormorant Garamond | `ofl/cormorantgaramond/CormorantGaramond[wght].ttf`                         |
| Playfair Display   | `ofl/playfairdisplay/PlayfairDisplay[wght].ttf`                             |
| PT Serif           | `ofl/ptserif/PT_Serif-Web-Regular.ttf`, `ofl/ptserif/PT_Serif-Web-Bold.ttf` |
| Noto Serif         | `ofl/notoserif/NotoSerif[wdth,wght].ttf`                                    |
| Literata           | `ofl/literata/Literata[opsz,wght].ttf`                                      |
| Vollkorn           | `ofl/vollkorn/Vollkorn[wght].ttf`                                           |
| Prata              | `ofl/prata/Prata-Regular.ttf`                                               |
| Yeseva One         | `ofl/yesevaone/YesevaOne-Regular.ttf`                                       |
| Lora               | `ofl/lora/Lora[wght].ttf`                                                   |
| Merriweather       | `ofl/merriweather/Merriweather[opsz,wdth,wght].ttf`                         |
| Caveat             | `ofl/caveat/Caveat[wght].ttf`                                               |
| Marck Script       | `ofl/marckscript/MarckScript-Regular.ttf`                                   |
| Bad Script         | `ofl/badscript/BadScript-Regular.ttf`                                       |
| Pacifico           | `ofl/pacifico/Pacifico-Regular.ttf`                                         |
| Lobster            | `ofl/lobster/Lobster-Regular.ttf`                                           |
| Neucha             | `ofl/neucha/Neucha.ttf`                                                     |
| Comfortaa          | `ofl/comfortaa/Comfortaa[wght].ttf`                                         |
| Poiret One         | `ofl/poiretone/PoiretOne-Regular.ttf`                                       |
| Geist              | `ofl/geist/Geist[wght].ttf`                                                 |
| Geist Mono         | `ofl/geistmono/GeistMono[wght].ttf`                                         |
| Newsreader         | `ofl/newsreader/Newsreader[opsz,wght].ttf`                                  |
