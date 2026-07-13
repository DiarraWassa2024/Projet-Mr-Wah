#!/bin/sh
# Redirige les données persistantes (uploads) vers le disque monté /data,
# qui survit aux redéploiements — contrairement au reste du système de fichiers du conteneur.
set -e

mkdir -p /data/uploads

if [ ! -L /app/public/uploads ]; then
  rm -rf /app/public/uploads
  ln -s /data/uploads /app/public/uploads
fi

exec npm run start
