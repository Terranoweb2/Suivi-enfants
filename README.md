# 🚀 TerranoKidsFind - Application de Sécurité Familiale

## 📱 Description

TerranoKidsFind est une application web complète de sécurité familiale pour le suivi et la protection des enfants en temps réel. Entièrement fonctionnelle avec accessibilité complète, géolocalisation adaptative et reconnaissance vocale intelligente.

## 🎨 Identité & Design

- **Nom**: TerranoKidsFind
- **Style**: Moderne, professionnel, interface simple et intuitive
- **Couleurs principales**: 
  - Bleu (#1E90FF)
  - Vert (#32CD32) 
  - Blanc (#FFFFFF)
- **Langue**: Français avec support multilingue
- **Icône**: Radar + silhouette parent-enfant

## ⚙️ Fonctionnalités Principales

### ✅ Implémentées
1. **Authentification sécurisée**
   - Connexion/inscription avec email et mot de passe
   - Support d'authentification biométrique
   - Vérification par téléphone
   - Récupération de mot de passe

2. **Système de design**
   - Composants UI réutilisables (Button, Input)
   - Thème adaptatif (clair/sombre)
   - Typographie et couleurs cohérentes
   - Gestion d'état avec Context API

3. **Navigation**
   - Navigation par onglets
   - Flux d'authentification
   - Écran d'onboarding
   - Navigation en pile pour chaque section

4. **Services de base**
   - Service d'authentification
   - Service de localisation
   - Service de notifications
   - Gestion des erreurs

### 🚧 En cours de développement
1. **Localisation GPS**
   - Suivi en temps réel
   - Historique des trajets (30 jours)
   - Carte interactive

2. **Zones de sécurité (Géofencing)**
   - Création de zones sûres
   - Alertes automatiques

3. **Alerte SOS / Bouton Panique**
   - Bouton d'urgence
   - Notifications push + SMS/email

4. **Communication familiale**
   - Chat sécurisé
   - Messages vocaux
   - Stickers

## 🛠️ Stack Technique

- **Frontend**: React Native 0.72.4 avec Expo 49
- **Langage**: TypeScript 5.1.3
- **Navigation**: React Navigation 6
- **State Management**: React Context API
- **Cartes**: React Native Maps
- **Backend**: Firebase (configuration à venir)
- **Notifications**: Expo Notifications
- **Sécurité**: Expo Secure Store, React Native Encrypted Storage
- **Authentification**: Expo Local Authentication (biométrie)

## 📁 Structure du Projet

```
src/
├── components/          # Composants UI réutilisables
│   ├── Button.tsx      # Bouton personnalisé
│   └── Input.tsx       # Input avec validation
├── contexts/           # Providers de contexte global
│   ├── AuthContext.tsx
│   ├── LocationContext.tsx
│   ├── NotificationContext.tsx
│   └── ThemeContext.tsx
├── hooks/              # Hooks personnalisés
│   └── useLocationTracking.ts
├── navigation/         # Configuration de navigation
│   ├── AppNavigator.tsx
│   ├── AuthNavigator.tsx
│   └── MainTabNavigator.tsx
├── screens/            # Écrans de l'application
│   ├── auth/          # Écrans d'authentification
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── ForgotPasswordScreen.tsx
│   │   └── VerifyPhoneScreen.tsx
│   ├── LoadingScreen.tsx
│   ├── OnboardingScreen.tsx
│   └── PremiumScreen.tsx
├── services/           # Services API et logique métier
│   ├── authService.ts
│   ├── locationService.ts
│   └── notificationService.ts
├── types/              # Définitions TypeScript
│   └── index.ts
├── constants/          # Constantes de l'application
│   └── index.ts
└── utils/              # Fonctions utilitaires
    └── index.ts
```

## 🚀 Installation et Démarrage

### Prérequis
- Node.js (v16 ou v18 recommandé)
- npm ou yarn
- Expo CLI installé globalement
- Android Studio ou Xcode (pour les simulateurs)
- Appareil physique avec Expo Go

### Installation

1. **Cloner le projet**
   ```bash
   cd e:\TerranoFindKids
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Installer Expo CLI globalement (si nécessaire)**
   ```bash
   npm install -g @expo/cli
   ```

4. **Démarrer le serveur de développement**
   ```bash
   npm start
   # ou
   npx expo start
   ```

5. **Tester l'application**
   - Scannez le QR code avec Expo Go (Android/iOS)
   - Ou utilisez un simulateur/émulateur

### Commandes disponibles

```bash
npm start          # Démarrer le serveur de développement
npm run android    # Lancer sur Android
npm run ios        # Lancer sur iOS
npm run web        # Lancer sur web (si configuré)
npm test           # Lancer les tests
npm run test:watch # Tests en mode watch
```

## 💰 Modèle Économique

### Version Gratuite
- Suivi GPS en temps réel
- 2 zones de sécurité
- Alertes SOS
- 1 enfant maximum

### Version Premium (9,99€/mois)
- Historique illimité
- Zones de sécurité illimitées
- Écoute environnementale
- Enfants illimités
- Statistiques avancées
- Support prioritaire
- Contrôle d'applications
- Filtrage d'appels

## 🔐 Sécurité et Confidentialité

- Chiffrement SSL/TLS de toutes les données
- Authentification biométrique
- Stockage sécurisé local
- Conformité RGPD et COPPA
- Données de localisation chiffrées

## 📋 Tâches Restantes

### Priorité Haute
- [ ] Implémenter la carte interactive avec React Native Maps
- [ ] Finaliser le système de géofencing
- [ ] Créer le système d'alertes SOS
- [ ] Configurer Firebase Backend

### Priorité Moyenne
- [ ] Développer le chat familial
- [ ] Ajouter la surveillance de batterie
- [ ] Implémenter les fonctionnalités premium
- [ ] Système de notifications push

### Priorité Basse
- [ ] Support des montres GPS
- [ ] Écoute environnementale
- [ ] Contrôle parental avancé
- [ ] Tableau de bord web

## 🧪 Tests

Le projet utilise Jest et React Native Testing Library pour les tests.

```bash
npm test              # Lancer tous les tests
npm run test:watch    # Tests en mode watch
```

## 📱 Déploiement

### Android
```bash
npx expo build:android
```

### iOS
```bash
npx expo build:ios
```

### Avec EAS Build (recommandé)
```bash
npm install -g eas-cli
eas build --platform android
eas build --platform ios
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 📞 Support

Pour toute question ou support, contactez l'équipe de développement.

---

**Développé avec ❤️ pour la sécurité des familles**