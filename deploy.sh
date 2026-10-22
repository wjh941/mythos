#!/usr/bin/env bash
# ============================================================
# MYTHOS 一键部署脚本：刷新 dist → 部署 Cloudflare Pages
# 用法：bash deploy.sh
# （GitHub Pages 由 git push 自动触发；Vercel 用 vercel deploy --prod）
# ============================================================
set -e
cd "$(dirname "$0")"

# 1. 刷新 dist（防止旧快照）
rm -rf dist
mkdir dist
cp index.html README.md dist/
cp -r css js dist/

# 2. 部署 Cloudflare Pages（需要 .env.local 里的 CLOUDFLARE_API_TOKEN）
export CLOUDFLARE_API_TOKEN=$(grep "^CLOUDFLARE_API_TOKEN=" .env.local | tail -1 | cut -d= -f2- | tr -d '\r\n')
export CLOUDFLARE_ACCOUNT_ID=64356a243e068d004b4f4693b4c6cf06
npx --yes wrangler pages deploy dist --project-name=mythos-meow --branch=main --commit-dirty=true

echo "✓ pages.dev 已更新（CDN 传播约需 30 秒）"
