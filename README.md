# 🌪️ Visualisation des Vents - France

Une application web interactive pour visualiser les données de vent en France en temps réel, utilisant l'API Open-Meteo et Leaflet pour l'affichage cartographique.

## 🚀 Fonctionnalités

- **Carte interactive** : Visualisation des vents sur une carte de France
- **Données en temps réel** : Récupération des données météo via l'API Open-Meteo
- **Cache intelligent** : Sauvegarde automatique dans le localStorage pour optimiser les performances
- **Contrôles interactifs** : Ajustement de la densité des particules et de l'épaisseur des lignes
- **Indicateur de source** : Affichage de la provenance des données (cache local ou API)
- **Rechargement manuel** : Possibilité de forcer le rechargement depuis l'API

## 🛠️ Technologies utilisées

- **React 19** - Framework frontend
- **TypeScript** - Typage statique
- **Leaflet** - Bibliothèque de cartographie
- **Leaflet-Velocity** - Visualisation des vecteurs de vent
- **Vite** - Build tool et serveur de développement
- **Open-Meteo API** - Données météorologiques

## 📦 Installation

1. **Cloner le repository**
   ```bash
   git clone <url-du-repo>
   cd vent
   ```

2. **Installer les dépendances**
   ```bash
   cd app
   npm install
   ```

3. **Lancer le serveur de développement**
   ```bash
   npm run dev
   ```

4. **Ouvrir dans le navigateur**
   ```
   http://localhost:5173
   ```

## 🎯 Utilisation

### Interface principale
- **Carte** : Affiche la visualisation des vents sur la France
- **Densité** : Contrôle le nombre de particules affichées (1-5000)
- **Épaisseur** : Ajuste l'épaisseur des lignes de vent (0.5-5)
- **Indicateur de source** : Affiche si les données proviennent du cache local ou de l'API
- **Bouton Recharger** : Force le rechargement des données depuis l'API

### Système de cache
- Les données sont automatiquement sauvegardées dans le localStorage
- Priorité donnée aux données en cache pour optimiser les performances
- Possibilité de nettoyer le cache et recharger depuis l'API

## 🔧 Scripts disponibles

```bash
npm run dev      # Lance le serveur de développement
npm run build    # Compile l'application pour la production
npm run preview  # Prévisualise la version de production
npm run lint     # Vérifie le code avec ESLint
```

## 📊 Configuration

### Zone géographique
L'application est configurée pour la France entière :
- **BBox** : `{ top: 51.1, bottom: 41.3, left: -5.5, right: 9.8 }`
- **Centre** : `[46.6, 2.2]`
- **Résolution** : Grille 8x8 par défaut

### API Open-Meteo
- **Endpoint** : `https://api.open-meteo.com/v1/forecast`
- **Variables** : `wind_speed_10m`, `wind_direction_10m`
- **Gestion d'erreurs** : Réduction automatique de la grille en cas de limitation

## 🏗️ Architecture

### Structure des fichiers
```
app/
├── src/
│   ├── App.tsx          # Composant principal
│   ├── App.css          # Styles de l'application
│   └── main.tsx         # Point d'entrée
├── public/              # Assets statiques
├── package.json         # Dépendances et scripts
└── vite.config.ts       # Configuration Vite
```

### Fonctionnalités clés
- **`fetchWindData()`** : Récupération et traitement des données météo
- **`MapWithVelocity()`** : Composant principal de la carte
- **Système de cache** : Gestion intelligente du localStorage
- **Gestion d'erreurs** : Adaptation automatique en cas de limitation API

## 🔍 Fonctionnalités avancées

### Gestion intelligente des erreurs
- Réduction automatique de la résolution en cas d'erreur 429/414
- Retry automatique avec délai
- Fallback vers des grilles plus petites

### Optimisation des performances
- Cache localStorage avec métadonnées complètes
- Chargement prioritaire depuis le cache
- Indicateurs visuels de la source des données

### Interface utilisateur
- Contrôles intuitifs pour la densité et l'épaisseur
- Indicateurs visuels de l'état de chargement
- Design responsive et moderne

## 🚀 Déploiement

### Build de production
```bash
npm run build
```

### Prévisualisation
```bash
npm run preview
```

Les fichiers de production seront générés dans le dossier `dist/`.

## 📝 Notes de développement

### Gestion du cache
- Clé de cache : `wind:${bbox}:nx${nx}:ny${ny}:t${hourKey}`
- Métadonnées sauvegardées : timestamp, bbox, résolution, données
- Nettoyage manuel possible via le bouton "Recharger"

### Limitations API
- L'API Open-Meteo a des limites de requêtes
- L'application s'adapte automatiquement en réduisant la résolution
- Système de retry avec délai de 700ms

## 🤝 Contribution

1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT.

## 🔗 Liens utiles

- [Open-Meteo API](https://open-meteo.com/)
- [Leaflet Documentation](https://leafletjs.com/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)

---

**Développé avec ❤️ pour la visualisation météorologique**
