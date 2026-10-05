#!/bin/bash

set -e

echo "======================================"
echo "      AGRILINK - BUILD APK"
echo "======================================"

echo ""
echo "[1/6] Verificando projeto..."
if [ ! -f "package.json" ]; then
  echo "ERRO: package.json não encontrado."
  exit 1
fi

echo ""
echo "[2/6] Instalando dependências..."
npm install

echo ""
echo "[3/6] Verificando login do Expo..."
eas whoami || {
  echo ""
  echo "Você ainda não está autenticado no EAS."
  echo "Execute: eas login"
  exit 1
}

echo ""
echo "[4/6] Configurando EAS..."
if [ ! -f "eas.json" ]; then
  eas build:configure
fi

echo ""
echo "[5/6] Criando APK..."
eas build --platform android --profile preview

echo ""
echo "======================================"
echo "        BUILD CONCLUÍDO By: CH"
echo "======================================"
echo ""
echo "O EAS exibirá o link para baixar o APK."
echo ""