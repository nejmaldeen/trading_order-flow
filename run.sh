#!/usr/bin/env bash
# Trading Lab & Order Flow - Server Runner for Linux / macOS

echo "======================================================"
echo "      Trading Lab & Order Flow Platform"
echo "======================================================"
echo ""

cd "$(dirname "$0")"

echo "1. Launching Development Server on http://localhost:5173..."
npm run dev
