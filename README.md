<div align="center">

# Sakina · سكينة

**Écran de prière premium et open source pour mosquées, foyers et Smart TV.**
Horaires précis · iqama · adhan · versets · adhkar — fonctionne hors-ligne, même sur une TV d’entrée de gamme.

`Web / PWA` · `Android TV / Google TV` · `Navigateur de Smart TV` · `Mobile & tablette`

</div>

---

## ✨ Fonctionnalités

**Tableau de bord**
- Horloge géante, date grégorienne et hégirienne (Umm al-Qura, correction ±jours, changement de jour au Maghrib)
- Compte à rebours vers la prochaine prière avec barre de progression
- 6 cartes : Fajr, Chourouq, Dhohr (Joumou‘a le vendredi), Asr, Maghrib, Icha — avec heure d’iqama
- Versets du Coran (texte Uthmani + traduction Hamidullah / Saheeh International) et adhkar de *Hisn al-Muslim*, en rotation
- Annonces de la mosquée + bandeau défilant
- Météo locale, mode Ramadan automatique (Imsak / Iftar)
- Paysage **et** portrait (écrans verticaux d’entrée de mosquée)

**Écrans automatiques (mode mosquée)**
1. **Adhan** — « حان الآن موعد أذان … » + invocation après l’adhan, voix d’adhan au choix
2. **Compte à rebours iqama** plein écran (anneau de progression, rappel « éteignez vos téléphones », puis « استووا واعتدلوا » la dernière minute)
3. **Prière en cours** — écran noir et discret (durée réglable, spéciale Joumou‘a)
4. **Adhkar après la prière**

**Configuration (télécommande, clavier, souris ou tactile)**
- Nom (arabe/latin), photo de la mosquée (en fond d’écran), logo, annonces
- Recherche de ville, GPS, ou coordonnées exactes ; fuseau IANA indépendant de l’horloge de la TV
- 20 conventions de calcul (Algérie, Maroc, Tunisie, MWL, Umm al-Qura, Égypte, France 12°/15°/18°, ISNA, Diyanet, JAKIM/MUIS, …) + angles personnalisés
- Ajustements manuels par prière (ihtiyat), Asr Hanafi, hautes latitudes
- Iqama par prière : délai après l’adhan **ou** heure fixe
- 20 voix d’adhan (Mishary Alafasy, La Mecque, Médine, Égypte…) + **import du MP3 de votre muezzin** ; adhan de Fajr séparé ; téléchargement hors-ligne
- 4 thèmes (Émeraude, Nuit, Sable, Royal), 15 photos de mosquées sous licence libre, motif géométrique
- Code PIN, export/import de la configuration (pour cloner plusieurs écrans)
- Interface en français, anglais et arabe (RTL)

## 🎯 Précision des horaires

La précision est **la priorité absolue** du projet. Trois sources au choix :

| Source | Comment | Hors-ligne |
|---|---|---|
| **Calcul astronomique** (défaut) | [adhan-js](https://github.com/batoulapps/adhan-js) — algorithmes de Jean Meeus, *Astronomical Algorithms* | ✅ toujours |
| **API Aladhan** | calendrier mensuel de [aladhan.com](https://aladhan.com), mis en cache (mois courant + suivant) | ✅ après 1ʳᵉ synchro |
| **Calendrier officiel (CSV)** | le calendrier publié par votre ministère / fédération / mosquée | ✅ toujours |

**Vérifié par des tests automatisés** : `npm test` compare le calcul hors-ligne à 143 journées de référence Aladhan (Alger, Constantine, Tamanrasset, Tunis, Le Caire, La Mecque, Paris, Londres, Istanbul, Montréal, Kuala Lumpur — été et hiver). Résultat : **±1 minute** (écart d’arrondi entre deux modèles solaires), ±3 min pour l’Asr en hiver au-delà de 45° de latitude.

> **Important — soyons honnêtes :** aucun calcul ne peut garantir de coller « à la seconde » au calendrier d’une mosquée donnée, car chaque autorité choisit ses propres angles, arrondis et marges de précaution (ihtiyat). Pour être **exactement** aligné sur votre mosquée :
> 1. choisissez la convention de votre pays (proposée automatiquement d’après la ville),
> 2. comparez avec le calendrier affiché à la mosquée et corrigez à la minute près avec les **ajustements manuels**,
> 3. ou importez directement le **calendrier officiel en CSV**.
>
> Le bouton **« Comparer avec l’API Aladhan »** (Réglages → Horaires) affiche l’écart prière par prière.

Le fuseau horaire est géré avec les données IANA du système (heure d’été comprise) : l’écran affiche l’heure de la mosquée même si la TV est mal réglée.

## 📺 Installation

### Navigateur / PWA (n’importe quel écran)
Ouvrez la version web, puis *Installer l’application* / *Ajouter à l’écran d’accueil*. Après le premier chargement, tout fonctionne sans internet.

> Les navigateurs bloquent le son tant que personne n’a touché l’écran : touchez-le (ou appuyez sur une touche) **une fois** après chaque démarrage. L’APK Android TV n’a pas cette limite.

### Android TV / Google TV / box Android (recommandé pour les mosquées)
1. Téléchargez `sakina-vX.Y.Z.apk` depuis les [Releases](https://github.com/filinodz/sakina/releases).
2. Installez-le (clé USB + gestionnaire de fichiers, ou *Downloader*, ou `adb install sakina.apk`).
3. L’app apparaît sur l’écran d’accueil de la TV. Elle :
   - garde l’écran allumé, en plein écran,
   - joue l’adhan **sans interaction**,
   - **redémarre seule après une coupure de courant** (sur Android 10+, autorisez « Afficher par-dessus les autres applis » si votre box l’exige),
   - se règle entièrement à la télécommande : **OK** ouvre les réglages, **← →** font défiler les versets, **Retour** ferme les réglages.

### Smart TV (Tizen, webOS…) sans Android
Ouvrez l’URL de la version web dans le navigateur de la TV et mettez-la en favori/plein écran. Le **mode léger** s’active automatiquement sur les appareils peu puissants (pas de flou, animations réduites, images 720p).

## 🎮 Raccourcis

| Touche | Action |
|---|---|
| OK / Entrée / `S` / Menu | Réglages (code PIN si défini) |
| ← → | Verset / dhikr précédent / suivant |
| Retour / Échap | Fermer les réglages |
| `F` | Plein écran |
| `?at=12:29` dans l’URL | Simule une heure (pour tester les écrans d’adhan / iqama) |

## 🛠 Développement

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # tests de précision + logique (vitest)
npm run build        # dist/ (PWA)
```

Android :

```bash
npm run android:sync   # build web + copie dans android/
npm run android:open   # ouvre Android Studio
cd android && ./gradlew assembleDebug
```

Régénérer les contenus (tout vient de sources vérifiées, rien n’est saisi à la main) :

```bash
npm run content        # versets (alquran.cloud / Tanzil) + adhkar (hisnmuslim.com)
npm run backgrounds    # photos Wikimedia Commons → 1080p + 720p
npm run fixtures       # journées de référence Aladhan pour les tests
npm run android:assets # icônes, bannière Android TV, splash
```

### Architecture

```
src/
  core/      prayer.ts (3 sources + iqama), schedule.ts (machine à états des écrans),
             time.ts (fuseaux IANA), hijri.ts, audio.ts, settings.ts, geo.ts, idb.ts
  ui/        display.ts (tableau de bord), settings-panel.ts, spatial-nav.ts (télécommande)
  data/      methods.ts, athans.ts, ayat.json, adhkar.json, backgrounds.json
android/     projet Capacitor (Leanback, BootReceiver, écran toujours allumé)
```

Choix de performance pour les TV modestes : **aucun framework** (≈ 65 Ko gzip de JS), un seul `transform: scale()` pour adapter une scène 1920×1080 à n’importe quel écran, animations limitées à `opacity`/`transform`, mise à jour du DOM uniquement quand un texte change, `Intl` appelé une fois par minute.

## 🤝 Contribuer

Les contributions sont les bienvenues : nouvelles conventions nationales, traductions, voix d’adhan libres de droits, calendriers officiels… Ouvrez une *issue* ou une *pull request*.

## 📜 Licence & crédits

Code sous licence **MIT**. Photos, textes, polices et enregistrements : voir [CREDITS.md](CREDITS.md).

<div align="center">

*Réalisé fi sabilillah — n’oubliez pas l’auteur et les contributeurs dans vos du‘a.*

</div>
