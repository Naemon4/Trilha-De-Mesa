#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "O Node.js não foi encontrado."
  echo "Instale a versão LTS em https://nodejs.org e abra este arquivo de novo."
  read -n 1 -s -r -p "Aperte qualquer tecla para fechar..."
  exit 1
fi
node server.js --open
