# se-LARAS: jalan pintas. Butuh Node >= 22 (diuji 22.23; hanya Linux x64), Python 3.13, ffmpeg.
.PHONY: setup test test-js test-py check-ui e2e run seed eval data docker fetch-data verify-models media package
setup:        ## pasang dependensi Node + Python
	npm ci
	python3 -m pip install --break-system-packages -r analyzer/requirements.txt
test: check-ui test-js test-py   ## semua tes (tanpa e2e)
check-ui:     ## sintaks semua modul frontend sebagai ES module
	npm run check:ui
test-js:
	npm test
test-py:
	npm run test:py
e2e:          ## uji ujung-ke-ujung dengan peramban (butuh: pip install -r analyzer/requirements-dev.txt && playwright install chromium)
	python3 e2e/run_all.py
run:          ## server lokal (isi SESSION_SECRET di lingkungan atau .env)
	node src/server.js
seed:         ## unit contoh uji (klip sintetis, BUKAN Ludruk) + 3 akun contoh
	node src/seed.js
eval:         ## ulangi evaluasi analyzer pada data uji publik (butuh jaringan sekali untuk fetch_data)
	npm run eval
data:         ## ekspor korpus riset (hanya unit sah + data_use=riset + bukan contoh)
	npm run export-dataset
docker:
	docker compose up --build
fetch-data:   ## unduh data uji publik (sha256 diperiksa); tanpa ini 10 tes Python dilewati
	python3 analyzer/evaluation/fetch_data.py
verify-models: ## cocokkan sha256 ketiga model dengan analyzer/models/MODELS.json
	python3 -I analyzer/verify_models.py
media:        ## tangkapan layar (docs/img) dan video penelusuran (docs/media) dari aplikasi yang berjalan; data contoh sintetis
	python3 e2e/capture_media.py
package:      ## zip rilis ../dist/se-LARAS-v<versi>.zip, lalu diuji dari ekstrak baru (npm ci, check:ui, npm test, model)
	python3 scripts/package.py --verify
