# 📜 AUDIHOME : LA DOCUMENTATION ULTIME (ANALYSE À 360°)

Ce document récapitule l'intégralité du projet AudiHome. Il a été conçu pour servir de base à une soutenance d'une heure, couvrant chaque variable, chaque choix technique et la logique chronologique de création.

---

## 1. ⏳ CHRONOLOGIE DE CONCEPTION (LOGIQUE DE DÉVELOPPEMENT)

Bien que le projet semble monolithique, il a été construit suivant ces 5 étapes logiques :

1.  **Fondations SvelteKit & UI Glassmorphism** : Mise en place du layout global, du fond d'écran fixe et des variables CSS (`theme.css`). Création des premières "Glass Cards".
2.  **Moteur Audio (Web Audio API)** : Implémentation du lecteur dans `+page.svelte`. Connexion au flux radio et création du premier nœud de gain pour le volume.
3.  **Visualisation Temps Réel (Canvas)** : Ajout de l'analyseur de spectre. Développement de la boucle `requestAnimationFrame` pour dessiner les barres de fréquences sur un Canvas HTML5.
4.  **Gestion Multi-Zones & Logique dB** : Extraction de la logique mathématique dans `src/lib/logic`. Création des algorithmes de conversion dB -> Linéaire pour piloter précisément le volume des différentes pièces.
5.  **Dataviz & Optimisation (ECharts)** : Intégration du graphique historique. Ajout de l' `IntersectionObserver` pour ne charger le graphique que lorsqu'il est visible, et du `ResizeObserver` pour la fluidité.

---

## 2. 🏗 ARCHITECTURE TECHNIQUE

### La Stack
- **Framework** : SvelteKit (Svelte 5).
- **Audio** : Web Audio API native (pas de bibliothèque externe type Howler.js).
- **Graphiques** : Apache ECharts (robuste, performant).
- **Rendu Temps Réel** : HTML5 Canvas 2D.
- **Style** : CSS3 natif avec variables (Tokens).

---

## 3. 🧠 LE CERVEAU : `src/routes/+page.svelte`

C'est l'orchestrateur. Il gère l'état synchrone de toute l'application.

### A. Variables d'État (Réactivité Svelte)
- `lang` (`Lang`) : Langue active. Déclenche la traduction automatique de l'UI via l'objet `translations`.
- `current` : Objet contenant les métadonnées de la radio en cours (URL, nom, logo).
- `volume` (`number`) : Valeur entre 0 et 1. C'est le multiplicateur maître.
- `isPlaying` (`boolean`) : État de lecture. Pilote les icônes UI et le démarrage/arrêt de la boucle de rendu.
- `zones` (`Zone[]`) : Tableau d'objets. Chaque objet a un `id` et un état `selected`.
- `collapsed` : Record gérant l'ouverture/fermeture des cartes sur mobile.

### B. L'Infrastructure Web Audio (Les Nœuds)
- `audio` : Instance de `HTMLAudioElement`. C'est le décodeur de flux.
- `audioCtx` : `AudioContext`. Le moteur de traitement.
- `analyser` : `AnalyserNode`. Transforme le signal sonore en données numériques (FFT).
- `gainNode` : `GainNode`. Applique le volume calculé (Volume Global * Atténuation Zone).
- `source` : Le point d'entrée qui lie l'élément audio au contexte.

### C. Le Cycle de Vie
- **`onMount`** : Initialise les observateurs (Resize/Intersection), configure le graphique et dessine l'état "Idle" (repos) du visualiseur.
- **`ensureAudio`** : Fonction critique. Elle instancie le contexte audio lors de la première interaction utilisateur. C'est indispensable car les navigateurs bloquent l'audio automatique.
- **`onDestroy`** : Ferme proprement toutes les ressources pour éviter les fuites de mémoire (Memory Leaks).

---

## 4. 🧪 LA COUCHE LOGIQUE (`src/lib/logic/`)

Isolée de l'UI pour être pure et testable.

### `audioMath.ts`
- **`getDbFromAnalyser`** : Utilise la formule de l'énergie (Root Mean Square) sur les échantillons binaires. Convertit le résultat en décibels : $dB = 20 \times \log_{10}(RMS)$.
- **`dbToLevel`** : Mappe une plage de -80dB à 0dB sur une échelle de 0 à 80. Utilise un exposant 0.6 pour "dilater" les basses intensités et rendre le mouvement plus dynamique à l'œil.

### `zoneAudio.ts`
- **`computeGainValue`** : Calcule le gain cumulé. Si une zone a -12dB d'atténuation, le gain est $10^{(-12/20)} \approx 0.25$.
- **`buildKpis`** : Transforme les états complexes en objets simples pour le composant `InfoBar`.

### `chartOptions.ts`
- Configure le rendu de ECharts (couleurs, gradients, axes). Note l'utilisation de `graphic.LinearGradient` pour l'effet de profondeur sous la courbe.

---

## 5. 🧱 ANATOMIE DES COMPOSANTS (`src/lib/components/`)

### `PlayerCard.svelte`
- Gère le **Carousel**. Utilise le scroll natif du navigateur pour une fluidité maximale sur mobile.
- Héberge le **Canvas**. Le rendu est fait par le parent via une référence (`bind:this`).

### `ZonesCard.svelte`
- Grille de sélection des pièces. Chaque clic appelle `toggleZone` dans le parent, ce qui déclenche immédiatement un recalcul du `gainNode`.

### `ControlsCard.svelte`
- Contient la logique des **Menus d'Atténuation**. Utilise un état `openAttenuationId` pour s'assurer qu'un seul menu est ouvert à la fois.

### `ChartCard.svelte`
- Simple réceptacle pour ECharts. Il expose un `div` via un `bind:this` pour que la page principale puisse injecter le graphique.

---

## 6. 🎨 DESIGN & UX (`theme.css`)

- **Fixed Background** : Utilisation de `body::before` avec une image fixe. Cela permet d'avoir un fond d'écran de haute qualité sans impacter les performances de scroll.
- **Glassmorphism** : Combinaison de `backdrop-filter`, de bordures semi-transparentes et de `box-shadow` pour créer un effet de profondeur et de modernité.
- **Responsive Grid** : Utilise `grid-template-columns: repeat(2, ...)` sur desktop et passe à une seule colonne sur mobile, avec un système de "collapsing" (accordéon) pour économiser de l'espace.

---

## 7. 🚀 OPTIMISATIONS & PERFORMANCE

- **ECharts Lazy Loading** : Le code de ECharts n'est chargé que si l'utilisateur arrive au niveau de la carte graphique.
- **Canvas vs SVG** : Le visualiseur audio utilise le Canvas car dessiner 24 barres à 60 FPS en SVG saturerait le DOM.
- **WebP** : Toutes les images sont au format WebP, environ 30% plus léger que le JPEG/PNG à qualité égale.
- **Manual Chunking** : Dans `vite.config.ts`, ECharts est mis dans un "chunk" séparé pour ne pas alourdir le fichier JS principal.

---

## 8. 💡 RÉPONSES AUX "POURQUOI ?" (Soutenance)

- **Pourquoi Svelte ?** "Pour sa réactivité sans Virtual DOM, ce qui est crucial pour une application qui met à jour son interface à chaque milliseconde (audio)."
- **Pourquoi le multi-zones ?** "C'est une simulation. Dans un environnement réel, chaque zone correspondrait à une adresse IP d'enceinte. Ici, on simule l'impact sonore via des atténuateurs logiciels."
- **Pourquoi pas de bibliothèque audio ?** "Pour démontrer ma maîtrise de la Web Audio API et garder un contrôle total sur la chaîne de traitement (Gain -> Analyser)."

---
*Documentation générée pour la session de révision AudiHome.*
