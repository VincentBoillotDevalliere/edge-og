# AQ‑4.1 — Journalisation des refus quota/auth

Cette story implémente des logs JSON structurés pour toute requête refusée côté Worker:
- Authentification API‑key échouée (HTTP 401)
- Dépassement de quota (HTTP 429)

## Format des logs
Toutes les entrées sont JSON sérialisées via `console.log`, alignées avec la convention globale (timestamp ajouté automatiquement par l’utilitaire logger):

Champs communs:
- event: string
- request_id?: string
- timestamp: string (ajouté automatiquement)

Spécifiques refus auth:
- event = "auth_failed"
- kid?: string (préfixe parsé si fourni: `Bearer eog_<kid>_...`)
- ip?: string (CF-Connecting-IP ou x-forwarded-for)
- status = 401

Spécifiques quota dépassé:
- event = "quota_exceeded"
- kid: string
- ip?: string
- plan: string (free|starter|pro)
- current: number (usage courant)
- limit: number (limite du plan)
- request_id?: string

Spécifiques refus (réponse 429):
- event = "quota_refused"
- kid: string
- ip?: string
- plan: string
- current: number
- limit: number
- request_id?: string

## Exemples

Auth échouée:
```json
{"timestamp":"2025-08-09T10:12:00.000Z","event":"auth_failed","kid":"FAKEKID","ip":"203.0.113.42","status":401,"request_id":"req-123"}
```

Quota dépassé:
```json
{"timestamp":"2025-08-09T10:12:10.000Z","event":"quota_exceeded","kid":"b7G4H2","ip":"198.51.100.7","plan":"free","current":2,"limit":1,"request_id":"req-456"}
```

Refus 429:
```json
{"timestamp":"2025-08-09T10:12:10.010Z","event":"quota_refused","kid":"b7G4H2","ip":"198.51.100.7","plan":"free","current":2,"limit":1,"request_id":"req-456"}
```

## Détails d’implémentation
- IP extraite via `CF-Connecting-IP` ou `x-forwarded-for`.
- `kid` déduit du header Bearer si présent; aucune donnée sensible loggée.
- Emission dans:
  - `src/handlers/og.ts` (auth_failed, quota_refused)
  - `src/utils/quota.ts` (quota_exceeded, quota_check_failed)

## Tests
- Fichier: `packages/worker/test/logging-refusals.spec.ts`
- Vérifie que les logs attendus sont bien émis avec `kid` et `ip`.

## Observabilité
- Ces logs sont compatibles Logpush → Grafana/Alerting (AQ‑4.2 pourra agréger `auth_failed` > 20/min).
