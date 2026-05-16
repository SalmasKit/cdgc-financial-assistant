# 🏛️ CDG Capital — Financial Intelligence Terminal

[![Tech Stack](https://img.shields.io/badge/Stack-FastAPI_%7C_React_%7C_Claude_3.5-emerald)](https://cdgcapital.ma)
[![License](https://img.shields.io/badge/License-Proprietary-slate)](https://cdgcapital.ma)

Le **Terminal d'Intelligence Financière CDG Capital** est une plateforme de pointe conçue pour automatiser l'analyse des états financiers (comptes sociaux et consolidés) selon les normes marocaines (PCGE). Grâce à l'intégration de l'IA générative (Claude 3.5), il transforme des rapports PDF complexes en insights stratégiques actionnables.

---

## 🚀 Fonctionnalités Clés

- **📄 Ingestion de PDF Intelligente** : Extraction automatisée des données comptables à partir de rapports annuels et d'états financiers.
- **🔔 Système de Gestion des Alertes** : Nettoyage et suppression individuelle (au survol) ou globale ("Effacer tout") des alertes de rentabilité et d'endettement.
- **📊 Dashboard Financier Premium** : Visualisation en temps réel du Chiffre d'Affaires, EBITDA, Résultat Net et Ratios de rentabilité/solvabilité.
- **🤖 Assistant de Chat Financier** : Posez des questions complexes ("Analyse la solvabilité", "Explique la baisse de la marge") directement à une IA experte.
- **📈 Comparaison Sectorielle** : Classement automatique des entreprises par performance (ROE, Marge Nette).
- **🔒 Sécurité & Localisation** : Interface 100% en français, gestion des devises (MAD/MDH) et normalisation bancaire (PNB, Total Bilan).

---

## 🛠️ Installation & Configuration

### 1. Backend (FastAPI)
Le backend gère l'extraction PDF via `pdfplumber` et l'orchestration de l'IA avec Anthropic.

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Configuration de l'environnement :**
Créez un fichier `.env` dans le dossier `backend/` :
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 2. Frontend (React + Vite)
Interface moderne construite avec Tailwind CSS v4 pour une esthétique "Senior SaaS".

```bash
cd frontend
npm install
npm run dev
```

---

## 🔔 Gestion des Alertes & Notifications

La plateforme génère des alertes automatisées basées sur les anomalies financières et ratios (levier élevé, rentabilité faible, etc.). Un système de nettoyage complet a été ajouté pour éviter l'accumulation des notifications :

- **Points d'accès API (Backend)** :
  - `DELETE /api/alerts/{id}` : Supprime définitivement une notification individuelle.
  - `DELETE /api/alerts?only_read=true` : Nettoie les alertes déjà lues de la base de données.
  - `DELETE /api/alerts` : Vide entièrement l'historique des notifications.
- **Interface Utilisateur (Frontend)** :
  - **Bouton "Effacer tout"** : Supprime globalement toutes les notifications en un clic dans l'en-tête du menu déroulant.
  - **Suppression unitaire** : Une icône Corbeille apparait au survol de chaque alerte pour la supprimer individuellement.
  - **Timestamps améliorés** : Affichage enrichi avec la date et l'heure au format complet (ex : `21 mai, 14:15` au lieu de l'heure uniquement).

---

## 🌐 Collecte Automatique de Rapports (Web Scraping)

Le module `scraper.py` est un moteur de collecte asynchrone intégré au cœur du backend. Il permet de découvrir, filtrer et ingérer automatiquement des rapports financiers publics au format PDF depuis des sources institutionnelles comme l'**AMMC** (Autorité Marocaine du Marché des Capitaux).

### ⚙️ Fonctionnement

1. **Découverte des liens PDF** : Le scraper récupère le HTML des sources configurées et extrait tous les liens se terminant en `.pdf`.
2. **Navigation multi-niveaux** : Pour les sites comme l'AMMC, si aucun PDF n'est trouvé sur la page principale, le scraper suit automatiquement les pages de détail (`/espace-emetteurs/etats-financiers/...`) pour y extraire les liens secondaires.
3. **Filtrage intelligent** : Seuls les rapports pertinents (RFA, bilans, états financiers) sont retenus grâce à deux listes de termes :
   - **Exclus** : `avis`, `communiqué`, `instruction`, `décision`, `prospectus`, etc.
   - **Requis** : `rfa`, `rapport`, `comptes`, `bilan`, `etats_financiers`, `annual_report`.
4. **Déduplication** : Si un PDF a déjà été ingéré (vérification via `source_url` en base de données), il est ignoré.
5. **Pipeline d'ingestion complet** : Pour chaque nouveau PDF découvert, le scraper télécharge le fichier, extrait le texte, appelle Claude pour structurer les données financières, calcule les ratios, génère une synthèse IA et enregistre tout en base de données.
6. **Alertes automatiques** : Des alertes sont générées à chaque collecte réussie, et des avertissements spécifiques sont levés si des seuils critiques (ROE négatif, levier excessif) sont détectés.

### 📅 Planification

Le scraper est lancé automatiquement **10 secondes après le démarrage du serveur** via la fonction `lifespan` de FastAPI, puis s'exécute **toutes les 6 heures** en arrière-plan.

### 🔌 Gestion des Sources via l'API

Les sources de collecte sont entièrement configurables depuis l'interface ou via l'API :

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/sources` | Liste toutes les sources configurées |
| `POST` | `/api/sources` | Ajoute une nouvelle source (nom + URL) |
| `DELETE` | `/api/sources/{id}` | Supprime une source |
| `POST` | `/api/sources/trigger` | Déclenche une collecte manuelle immédiate |

> **Source par défaut** : `https://www.ammc.ma/fr/liste-etats-financiers-emetteurs`

---

## 🏗️ Architecture Technique

- **Backend** : FastAPI (Python 3.10+), SQLAlchemy, SQLite, Pydantic v2.
- **IA/LLM** : Claude 3.5 Sonnet / Opus (via Anthropic SDK).
- **Frontend** : React 18, Vite, Tailwind CSS v4, Lucide Icons, Recharts.
- **Logic** : Moteur de calcul de ratios normalisé PCGE et détection automatique des secteurs bancaires.

### 🗂️ Structure du Projet & Description des Fichiers

#### 🖥️ Backend (FastAPI, SQLAlchemy & IA)
Le dossier `backend/` héberge l'API REST qui orchestre l'extraction des données, le calcul des ratios et l'interaction avec Claude.

- **[main.py](file:///c:/Users/Dell/Downloads/CDGCapital/backend/main.py)** : Point d'entrée principal de l'application FastAPI. Il configure CORS, lance le planificateur du scraper en arrière-plan (via la l'évènement `lifespan`) et définit tous les points d'accès (endpoints) de l'API (analyse PDF, chat interactif, gestion des alertes, authentification et administration des sources).
- **[database.py](file:///c:/Users/Dell/Downloads/CDGCapital/backend/database.py)** : Initialise la connexion SQLAlchemy à la base de données SQLite locale (`cdg_capital.db`) et expose le gestionnaire de session de base de données `get_db()`.
- **[models.py](file:///c:/Users/Dell/Downloads/CDGCapital/backend/models.py)** : Définit les modèles ORM SQLAlchemy constituant le schéma de base de données : `Company`, `Ratio`, `Analysis`, `User`, `Alert`, `Document` et `ScrapeSource`.
- **[schemas.py](file:///c:/Users/Dell/Downloads/CDGCapital/backend/schemas.py)** : Définit les schémas Pydantic v2 pour la validation et la sérialisation des données entrantes et sortantes des routes de l'API.
- **[financial_logic.py](file:///c:/Users/Dell/Downloads/CDGCapital/backend/financial_logic.py)** : Moteur de calcul financier. Contient les schémas Pydantic représentant la structure de l'état financier normalisé PCGE marocain (`ActifPassif`, `CPC`, `FinancialData`) et calcule les ratios de performance (`compute_ratios`). Inclut également un extracteur Regex léger comme alternative de secours (fallback).
- **[claude_client.py](file:///c:/Users/Dell/Downloads/CDGCapital/backend/claude_client.py)** : Gère la communication asynchrone avec l'API Anthropic (Claude 3.5 Sonnet / Opus / Haiku avec système de repli). Contient le prompt système d'extraction des données à partir du PDF brut, la génération de la synthèse exécutive, et le chat interactif.
- **[scraper.py](file:///c:/Users/Dell/Downloads/CDGCapital/backend/scraper.py)** : Module de collecte asynchrone en arrière-plan. Il extrait périodiquement ou sur commande les rapports financiers au format PDF depuis des sources cibles (AMMC, Bourse de Casablanca) et automatise leur traitement complet.
- **[extractor.py](file:///c:/Users/Dell/Downloads/CDGCapital/backend/extractor.py)** : Script d'extraction synchrone indépendant conçu pour tester rapidement le parsing de liasses PDF avec Claude.
- **[index.html](file:///c:/Users/Dell/Downloads/CDGCapital/backend/index.html)** : Une interface frontend historique et minimaliste hébergée par le serveur FastAPI pour effectuer des analyses PDF directes sans démarrer le frontend principal.
- **[response.json](file:///c:/Users/Dell/Downloads/CDGCapital/backend/response.json)** : Exemple concret de réponse JSON retournée par l'endpoint `/analyze` (données d'Atlas Industrie Maroc S.A.), servant de modèle de test.

#### 🌐 Frontend (React, Vite & Tailwind CSS v4)
Le dossier `frontend/` contient l'interface moderne "Senior SaaS" développée pour les analystes.

- **[index.html](file:///c:/Users/Dell/Downloads/CDGCapital/frontend/index.html)** : Fichier HTML principal hébergeant l'application React.
- **[src/main.jsx](file:///c:/Users/Dell/Downloads/CDGCapital/frontend/src/main.jsx)** : Script d'entrée JavaScript qui monte l'application React dans le nœud DOM racine.
- **[src/App.jsx](file:///c:/Users/Dell/Downloads/CDGCapital/frontend/src/App.jsx)** : Cœur de l'interface utilisateur. Regroupe l'ensemble des écrans du terminal (Dashboard graphique avec Recharts, grille d'états financiers, calculateur interactif de ratios, interface de chat avec l'assistant IA, gestion des documents de collecte, système d'authentification et panneau de notifications/alertes).
- **[src/index.css](file:///c:/Users/Dell/Downloads/CDGCapital/frontend/src/index.css)** : Configuration globale de Tailwind CSS v4 avec les définitions de thèmes graphiques personnalisés (effet de flou transparent, animations fluides, gradients premium).
- **[src/App.css](file:///c:/Users/Dell/Downloads/CDGCapital/frontend/src/App.css)** : Règles de style CSS additionnelles pour l'application.
- **[vite.config.js](file:///c:/Users/Dell/Downloads/CDGCapital/frontend/vite.config.js)** : Configuration du serveur de développement et de build Vite.

---

## 📖 Utilisation

1. **Importation** : Cliquez sur "Importer PDF" dans la barre latérale.
2. **Analyse** : L'IA extrait les données (environ 15-20s). Les indicateurs se mettent à jour automatiquement.
3. **Exploration** : Naviguez entre les onglets "Dashboard", "Ratios", "États" et "Analyse IA".
4. **Interaction** : Utilisez le chat en bas de l'onglet "Analyse" pour approfondir un point spécifique.

---

## 🔒 Confidentialité
Les données extraites sont stockées localement dans `cdg_capital.db`. Aucune donnée n'est partagée en dehors des appels chiffrés à l'API Anthropic pour l'analyse.

---
© 2026 CDG Capital — Intelligence Platform.
