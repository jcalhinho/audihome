# AudiHome

https://audihome.vercel.app/

## Contexte du projet

Ce dépôt contient une interface autour de la musique, avec une navigation fluide (sliding) et une visualisation de données. Un dashboard domotique moderne, propre et maintenable.

## Présentation rapide

AudiHome, c’est un tableau de bord pour piloter la diffusion audio dans plusieurs pièces. Sur navigateur ou mobile.
Pour le style, j'ai essayé de faire un truc simple et moderne a la fois,les gouts et les couleurs comme on dit... :) je prefere l'UX à l'UI bien que l'un ne va pas sans l'autre.

### Fonctionnalités actuelles

- **Lecteur audio centralisé** : choix de flux radio (FIP, Radio France, SomaFM) via un carousel tactile.
- **Visualisation temps réel** : analyse spectrale Web Audio + rendu Canvas fluide.
- **Gestion multi-zones** : 6 zones avec volume + atténuation par zone.
- **Monitoring sonore** : line chart ECharts comparant stream vs micro.
- **Internationalisation** : FR/EN sans dépendance.

## Architecture

Le cœur reste dans `+page.svelte` (state global + orchestration). Les cartes UI sont découpées en composants, et la logique métier testable est extraite dans `src/lib/logic`.

```
src/routes/+page.svelte
├─ UI components (src/lib/components)
│  ├─ TopBar / InfoBar
│  ├─ PlayerCard
│  ├─ ZonesCard
│  ├─ ControlsCard
│  └─ ChartCard
├─ Logic helpers (src/lib/logic)
│  ├─ audioMath.ts        (dB / normalisation)
│  ├─ chartOptions.ts     (config ECharts)
│  ├─ zoneAudio.ts        (atténuation / gain / KPIs)
│  └─ i18n.ts             (FR/EN)
└─ Assets
   └─ static/*.webp
```

## Déroulé du dev (version synthèse)

J’ai avancé par étapes claires, en itérant beaucoup :

1. **UI/UX & layout**
   - Construction d’une grille responsive.
   - Ajustements fins sur les espacements, les ombres et la hiérarchie visuelle.

2. **Audio & visualisations**
   - Mise en place du lecteur via Web Audio API.
   - Ajout du visualiseur fréquentiel Canvas.
   - Intégration du graph ECharts pour les dB (flux + micro).

3. **Multi-zones**
   - 6 zones définies + toggles.
   - Atténuation et volume par zone.
   - Volume global synchronisé avec les sliders de zones.

4. **Mobile & interactions**
   - Carousel tactile (swipe, scroll) + corrections de gestures.
   - Ajustements pour éviter les scrolls involontaires sur mobile.

5. **Perf & maintenabilité**
   - Optimisation assets (WebP, preload).
   - ECharts en import modulaire.
   - Découpage des gros fichiers en composants.
   - Ajout de tests unitaires (Vitest).

## Problèmes rencontrés (et fixes)

- **Scroll mobile cassé** pendant le swipe → correction des touch events.
- **Dropdowns natifs mal placés sur mobile** → menus custom.
- **Audio/graph/visualizer désync** → logique centralisée + états propres.
- **Volume global qui n’agissait plus** → correction de la chaîne gain/audio.
- **LCP trop élevé** → WebP + preload + optimisation assets.
- **+page.svelte trop gros** → split en composants + helpers testables.

## Limitations (démo navigateur)

1. **Multi‑zones simulées** : dans une vraie install, chaque zone envoie une commande réseau à une enceinte dédiée. Ici, l’atténuation reste globale.
2. **Flux unique** : un seul flux est diffusé, les volumes par zone sont visuels ou impactent le mix global.

## Perspectives possibles

- **Follow Me Audio (présence / localisation)**  
  L’idée : un flux qui suit l’utilisateur de pièce en pièce. On pourrait intégrer des capteurs de présence, ou des technologies de localisation indoor. Le dashboard devient alors une “orchestration” temps réel : activation auto des zones, coupure des zones vides, logique de priorité.

- **Multi‑sources par zone**  
  Aujourd’hui : 1 flux global. Demain : une source par zone (jazz salon, comptines chambre bébé…). Ça implique une vraie gestion de sorties multiples côté backend/hub audio, plus un routing logique côté UI.

- **Auto‑volume intelligent**  
  Utiliser le micro d’ambiance pour ajuster le volume selon le bruit (conversation, aspirateur, etc.). Le but : garder une perception stable sans que l’utilisateur ajuste tout le temps.

## Choix techniques

- **SvelteKit + Svelte 5** : perf, simplicité, pas de Virtual DOM.
- **TypeScript** : cohérence stricte des états audio/graph.
- **Web Audio + Canvas** : visualiseur temps réel rapide.
- **ECharts** : courbes temporelles robustes.
- **CSS natif** : UI responsive légère sans framework.

## Pourquoi Svelte / SvelteKit (et pas React)

Suite a notre entretien ou nous avions parler de svelte, faire une SPA en react aurait ete un peu trop "simple" pour moi (sans pretention): j'ai donc voulu me challenger un peu et me lancé dans sveltekit.

### Svelte vs SvelteKit (différences rapides)

- **Svelte** = framework UI pur. Tu compiles tes composants en JS très léger.
- **SvelteKit** = le “meta‑framework” autour de Svelte (routing, SSR/SSG, tooling, conventions).

J’ai choisi **SvelteKit** car je voulais :

-un routing propre si je dois faire évoluer l’app
-un build out‑of‑the‑box solide pour déployer vite

- garder la possibilité SSR/SSG.

(oui, je sais ce n'est qu'une démo mais c'est toujours cool de penser evolution)
J’ai aussi pris SvelteKit pour retrouver quelques parallèles avec React (routing, organisation, conventions) afin d’être plus à l’aise tout en sortant de ma stack habituelle. Et en vrai, pour un projet aussi petit, Svelte seul aurait suffi, mais SvelteKit donne un cadre plus évolutif.

### React vs SvelteKit (avantages / inconvénients)

**React (mon point de référence)**  
+Écosystème ultra large

- Standard du marché / employabilité  
  -Plus de boilerplate  
  -Performances très dépendantes des patterns et libs choisies

**Svelte / SvelteKit**  
 +Bundle léger + perf très directe  
 +DX simple, peu de code “plomberie”  
 +Très fluide pour des UI temps réel (comme le visualizer)

- Écosystème plus jeune
- Moins de “standards” industry que React

En bref : React = robuste et universel, SvelteKit = rapide, léger et ultra efficace pour ce type de dashboard.

## Le constat

Côté UX/UI, si j'ai bien constaté une difficulté, c'est réussir à rendre une app de type dashboard/controller/metric reader lisible et sympa à utiliser sur téléphone. Le plus gros problème étant l'affichage de graphiques sur petit écran. Durant mes années en R&D dataviz, on me disait : « Le responsive ? On s'arrête au format tablette, personne ne regarde des graphes sur téléphone... » sauf que beaucoup trop de gens utilisent leurs téléphones aujourd'hui, on ne peut pas faire l'impasse sur ce format même en dataviz.

## Installation

Pré‑requis : Node.js v18+

```bash
# Cloner le dépôt
git clone https://github.com/votre-user/audi-home.git

# Accéder au répertoire
cd audi-home

# Installer les dépendances
npm install

# Lancer le serveur de dev
npm run dev
```

L’app tourne sur `http://localhost:5173`.

## Tests

Tests unitaires Vitest sur la logique métier :

```bash
npm run test
```
