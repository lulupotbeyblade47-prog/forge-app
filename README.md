# CaliMova

Application de suivi de musculation (timer, EMOM, tracker de séances, records, progression).

## Structure

- `index.html` — application complète (HTML + CSS + JS inline)
- `landing.html` — page d'accueil (installation Android / accès web)
- `app-version.json` — version courante et URL de l'APK
- `firestore.rules` — règles de sécurité Firestore
- `hosting-firebase.json` — configuration Firebase Hosting
- `android-update/` — code natif Android (Capacitor : plugins, MainActivity, gradle)
- `forge-qr/` — scripts de génération du QR code et de l'affiche

Les APK ne sont pas versionnés ici : ils sont publiés dans
[forge-android-releases](https://github.com/lulupotbeyblade47-prog/forge-android-releases).

## Lancer en local

```bash
python3 -m http.server 8080
```

Puis ouvrir http://localhost:8080/index.html

## Firebase

Projet : `forge-e1f5b` — Auth Google + Firestore + Hosting.
