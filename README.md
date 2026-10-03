# FrancoRoute — Git → Netlify

Version blanche et bleue pour **francoroute.com**. Le site comprend le programme BDE, les valeurs, un agenda de premiers appels de 15 minutes et l’application privée **G1, G2 et G Full**, proposée à **28 $ CA + taxes pour 21 jours**. Aucun renouvellement automatique.

## Commencer

Lire d’abord **DEMARRER-ICI.txt** pour l’activation depuis GitHub. **ACTIVER-OUTLOOK.txt** détaille la connexion Microsoft. La base se prépare automatiquement au déploiement de production lorsque DATABASE_URL est configurée.

1. Le code est disponible dans [la proposition GitHub #1](https://github.com/nellyfolefack6-afk/Francoroute/pull/1). Après vérification, fusionnez-la dans `main` pour déclencher le déploiement Netlify associé à cette branche. Pour une installation manuelle, conservez les dossiers et placez `app` directement à côté de `package.json` ; ne déposez pas le ZIP lui-même dans Git.
2. Suivez **INSTALLATION-NETLIFY.txt** pour connecter Supabase, Resend et Stripe, puis votre dépôt à Netlify.
3. Après le déploiement, ouvrez `/gestion`, connectez-vous avec votre adresse administratrice et ajoutez vos disponibilités.

La configuration Git/Netlify est incluse. Les identifiants privés des services ne sont pas fournis : ils doivent être renseignés dans Netlify. Sans configuration, aucun paiement n’est encaissé et aucune fausse réservation n’est confirmée. Ce ZIP ne modifie pas le site public déjà en ligne et n’importe pas ses utilisateurs ou ses réservations. Après validation, retirez ou protégez l’ancienne application publique `francoroute-prepa.netlify.app` pour ne pas laisser son contenu accessible gratuitement à une autre adresse.

## Fonctionnement

- **Réservations** : créneaux ouverts par FrancoRoute, heure de l’Est, préavis de 2 heures, durée de 15 minutes, protection contre les doubles réservations. Le visiteur obtient une confirmation à l’écran, un ajout au calendrier et un lien d’annulation.
- **Courriels** : Resend notifie `francoroute@outlook.com` avec les coordonnées et le téléphone du client. FrancoRoute appelle à l’heure réservée. En cas d’échec du courriel, le rendez-vous reste dans `/gestion`, où une nouvelle tentative est possible. « Transmis » signifie accepté par le fournisseur, sans garantie de classement en boîte principale.
- **Comptes** : connexion par code courriel Supabase, sessions vérifiées côté serveur. L’adresse inscrite dans `ADMIN_EMAILS` accède à la gestion après vérification de son courriel.
- **Paiement** : Stripe Checkout, paiement unique de 28 CAD + taxes, activation de 21 jours après confirmation serveur. Les remboursements complets notifiés par Stripe retirent l’accès.
- **Application** : questions et explications G1, situations G2/G Full, astuces, exercices et progression personnelle. Le contenu pédagogique est servi par une route protégée, après connexion et vérification de l’accès. Le programme BDE reste présenté séparément sur le site.
- **Données** : PostgreSQL Supabase, protégées du navigateur par RLS et par les autorisations des API. Aucune clé de base de données ou de paiement n’est exposée au navigateur.

## Développement

Node.js 22, npm. Copiez `.env.example` vers `.env.local` et renseignez les valeurs pour un projet de développement distinct.

```sh
npm ci
npm run dev
npm run check
npm run verify
npm run build
npm start
```

`npm run verify` exécute les requêtes PostgreSQL dans PGlite, avec les services courriel/authentification/paiement simulés localement. Aucun courriel et aucun paiement réels ne sont déclenchés. Ces tests ne remplacent pas une vérification des comptes de production une fois vos clés configurées.

## Structure

- `app/` et `components/` : pages, connexion, réservation, gestion, API.
- `private/application.html` : application complète, jamais placée dans `public/`.
- `supabase/schema.sql` et `supabase/outlook-pratique.sql` : tables de la base, appliquées automatiquement par `scripts/prepare-database.mjs` en production uniquement.
- `scripts/verify-database-setup.mjs` : vérification locale de la préparation répétable, de la conservation des données et des erreurs.
- `lib/booking-mail.ts` : notification de premier appel.
- `netlify.toml` : configuration de construction Next.js.
- `.env.example` : liste des variables à définir. Ne mettez jamais de secrets dans Git.

Netlify utilise son adaptateur Next.js automatiquement. Le projet n’utilise pas une exportation HTML statique ni Netlify Forms. Après la configuration et le consentement Microsoft, les nouvelles réservations se synchronisent avec Outlook. Google Calendar n’est pas connecté. Les crédits de pratique sont validés par FrancoRoute dans /gestion ; l’achat de l’application ne donne pas d’heures de conduite. Aucun rappel, SMS ou courriel d’annulation n’est envoyé automatiquement ; consultez `/gestion` avant chaque appel.

## Références des services

- https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/auth/auth-smtp
- https://resend.com/docs/dashboard/domains/introduction
- https://docs.stripe.com/webhooks
