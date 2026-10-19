#!/bin/bash
# Prépare le dossier public/ puis déploie sur Firebase Hosting.
# Le site déployé utilise une structure différente du repo :
#   public/index.html  <- landing.html (page d'accueil)
#   public/app.html    <- index.html   (l'application)
#   public/app-version.json <- app-version.json
set -e
cd "$(dirname "$0")"

rm -rf public
mkdir -p public
cp landing.html public/index.html
cp index.html public/app.html
cp app-version.json public/app-version.json

echo "public/ prêt :"
ls -la public

if [ "$1" = "--build-only" ]; then exit 0; fi
exec npx -y firebase-tools@latest deploy --only hosting --project forge-e1f5b "$@"
