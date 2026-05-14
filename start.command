#!/usr/bin/env bash
# Doppio-click su questo file per avviare la dashboard Viaggi.
# Funziona su macOS senza alcuna installazione (Python è incluso di serie).

cd "$(dirname "$0")"

PORT=8765

# Trova una porta libera se 8765 è occupata
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://localhost:$PORT"

echo ""
echo "  🌍 Viaggi di Davide — server locale"
echo "  -----------------------------------"
echo "  URL: $URL"
echo "  Cartella: $(pwd)"
echo ""
echo "  Premi Ctrl+C in questa finestra per spegnere il server."
echo ""

# Apri il browser dopo 1 secondo
( sleep 1 && open "$URL" ) &

# Avvia il server
python3 -m http.server $PORT
