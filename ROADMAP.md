# Roadmap & Backlog — Projet **Edge‑OG (Générateur d’images Open Graph à l’edge)**

## 🗺️ Roadmap produit (vue haute)

| Phase | Périmètre fonctionnel | Objectif business | Durée cible | Jalons clés |
|-------|----------------------|-------------------|-------------|-------------|
| **0. Discovery & Kick‑off** | Validation techno (Worker + Satori), cadrage UX | POC fonctionnelle partagée à 3 bêta‑testeurs | Semaine 1 | – Architecture validée<br>– Story map & backlog initial prêts |
| **1. MVP « Developer Preview »** | Image OG synchrone + cache, free tier sans authentification | Premiers retours dev, traction GitHub | Semaines 2‑5 (4 sem.) | – Endpoint `/og` live<br>– 10 templates<br>– README + badge CI |
| **2. Beta publique** | Auth API‑key, dashboard statique, plugin Next.js | 200 comptes gratuits actifs, lancement Product Hunt | Semaines 6‑10 (5 sem.) | – Auth + quotas KV<br>– Stripe plan Starter<br>– Landing SEO & PH launch |
| **3. Go‑to‑Market** | Statistiques, billing Pro, observabilité | 20 clients payants (MRR ≥ 200 €) | Semaines 11‑16 (6 sem.) | – Dashboard analytics<br>– Pay‑as‑you‑go<br>– Zapier & WordPress |
| **4. Scale & Delight** | A/B testing, éditeur visuel, SLA Pro | Churn < 5 % / mois, marge brute > 75 % | À partir de S17 | – Editor v1<br>– Routage multi‑région<br>– Support premium |

---

## 🧩 Découpage **Epics** → User stories

### 1. Core Image Generation

| ID | User Story | Critères d’acceptation | Priorité |
|----|-----------|------------------------|----------|
| **CG‑1** | En tant que *crawler* je reçois une image PNG 1200×630 <150 ms | `Content‑Type: image/png`, TTFB ≤ 150 ms | **Must** |
| CG‑2 | En tant que dev je paramètre couleur, police | Champs `theme`, `font` avec valeurs de repli | Must |
| CG‑3 | En tant que PM je dispose de 10 templates JSX prêts | 10 fichiers prêts dans `templates/` + doc de rendu | Should |
| CG‑4 | En tant qu’utilisateur avancé je charge une police custom via URL | `fontUrl` accepte TTF/OTF public, mise en cache | Could |
| CG-5 | En tant que PM je dispose d'emoji ou de characteres particuliers dans mes templates pour les rendres plus attractif || Should |

### 2. Edge Caching & Performance

| ID | User Story | Critères d’acceptation | Priorité |
|----|-----------|------------------------|----------|
| **EC‑1** | Les images sont cachées 1 an pour réduire latence & coût | `Cache‑Control: public, immutable, max‑age=31536000`; hit ratio ≥ 90 % | **Must** |
| EC‑2 | Je peux invalider le cache quand le hash change | Nouveau hash ⇒ cache‑miss, guide d’usage fourni | Should |
| EC‑3 | Les requêtes sont servies depuis le PoP le plus proche | TTFB < 200 ms mesuré sur 3 régions | Could |

### 3. Authentication & Quotas

| ID | User Story | Critères d’acceptation | Priorité |
|----|-----------|------------------------|----------|
| **AQ‑1** | L’utilisateur obtient une clé API unique après signup | Endpoint `/dashboard/api‑keys` ; clé stockée chiffrée | **Must** |
| AQ‑2 | Free tier : 1 000 images/mois, blocage soft au‑delà | Compteur KV + HTTP 429 après dépassement | **Must** |
| AQ‑3 | Admin peut réinitialiser un quota manuellement | Commande CLI documentée | Should |

### 4. Billing & Plans

| ID | User Story | Critères d’acceptation | Priorité |
|----|-----------|------------------------|----------|
| **BI‑1** | Upgrade au plan Starter via Stripe Checkout | Webhook `invoice.paid` → rôle `starter`, quota 2 M | **Must** |
| BI‑2 | Pay‑as‑you‑go 0,30 €/100 k après dépassement | Metered usage reporté à J+1 | Should |
| BI‑3 | L’utilisateur peut annuler son abonnement | Stripe Portal + statut `canceled` en temps réel | Could |

### 5. Developer Tooling

| ID | User Story | Critères d’acceptation | Priorité |
|----|-----------|------------------------|----------|
| **DT‑1** | SDK npm `@edge‑og/sdk` : génération en une ligne | Support Node 18+, tests unitaires ≥ 90 % | **Must** |
| DT‑2 | Plugin Next.js auto‑generate pour pages MDX | Ajout `withOG()` dans `next.config.js` | Should |
| DT‑3 | CLI `edge‑og preview` sans compte | Ouvre un PNG local en < 2 s | Could |

### 6. Dashboard & Self‑Service Admin

| ID | User Story | Critères d’acceptation | Priorité |
|----|-----------|------------------------|----------|
| **DB‑1** | L’utilisateur visualise quota consommé + reset date | Graph barre + refresh < 1 min | **Must** |
| DB‑2 | CRUD templates depuis l’UI | Opérations via API Worker, persistance KV | Should |
| DB‑3 | A/B test entre 2 templates | Flag `exp=a|b` + stats CTR visibles | Could |

### 7. Observability & Alerting

| ID | User Story | Critères d’acceptation | Priorité |
|----|-----------|------------------------|----------|
| **OB‑1** | Alerte Slack quand taux d’erreur ≥ 1 % 5 min | Logpush → Grafana, webhook détaillé | **Must** |
| OB‑2 | Tableau latence P95 par région | Dashboard public‑read | Should |

### 8. Growth Integrations & Launch

| ID | User Story | Critères d’acceptation | Priorité |
|----|-----------|------------------------|----------|
| **GR‑1** | Action Zapier “Create OG Image” | Auth OAuth OK, action publique | Should |
| GR‑2 | Plugin WordPress remplace balises OG | Installable en 3 clics, repo officiel WP | Could |
| GR‑3 | Lancement Product Hunt | Listing programmé, 50 upvotes, recap feedback | Should |

### 9. Security & Compliance

| ID | User Story | Critères d’acceptation | Priorité |
|----|-----------|------------------------|----------|
| **SC‑1** | Trafic forcé HTTPS | HSTS 1 an, redirection 301 | **Must** |
| SC‑2 | Registre de traitements RGPD | Fichier `gdpr-data-map.md` complété | Should |
| SC‑3 | DPA disponible pour les clients Pro | Template auto‑signé via HelloSign | Could |

---

## 📅 Sprint 0 — backlog prêt

| Story | Pts | Notes |
|-------|-----|-------|
| CG‑1 | 5 | Worker + Satori |
| CG‑2 | 3 | Parsing params |
| EC‑1 | 2 | Headers cache |
| DT‑1 | 3 | SDK initial |
| AQ‑1 | 2 | Signup clé API |
| OB‑1 | 3 | Logpush Slack |
| **Total** | **18 pts** | Capacité sprint ≈ 20 pts |

---

### 🔑 KPI de suivi

| Indicateur | Cible MVP |
|------------|-----------|
| **Time‑to‑first‑image** (nouvel utilisateur) | < 5 minutes |
| **Latency TTFB p95** | < 150 ms |
| **Hit ratio cache** | ≥ 90 % |
| **Taux conversion Beta → Starter** | ≥ 10 % |


### Unitests
Please make sure to unitest all the methods you implemented in the 
