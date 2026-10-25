# Alanas Game Arcade

Hobby browser-game site for **Alanas** (age 10). Choose **Dragon Play** or **Toxic Zone**, then browse Games, About Me, and Ideas.

## Stack

- Angular 22 (signals + signal forms)
- Firebase Hosting (`pixel-quest-89fc6`)
- Games live in `apps/web/src/games/` and ship with the site

## Develop

```bash
npm install --prefix apps/web
npm start
```

## Add a game

1. Create `apps/web/src/games/<slug>/` with `game.json`, cover image, and `index.html`
2. Run `npm run games:sync`
3. Commit and push (CI deploys) or run `npm run deploy` locally

## Ideas board (Firestore)

- Collection: `ideas` — fields `nickname`, `title`, `genre`, `body`, `status` (`pending` | `published`), `date`, `submittedAt`
- Submit creates a **pending** document
- Public board shows only **published** ideas
- To publish: Firebase Console → Firestore → idea doc → set `status` to `published`

## Daily team battle (Firestore)

- One team choice per visitor per calendar day (`DailyTeamBattleService`)
- Live scores in the header; at **21:00** local time the side with more votes wins
- Collections: `dailyBattles/{yyyy-MM-dd}`, `ballots/{date}_{visitorId}`
- Deploy rules: `npx firebase deploy --only firestore:rules`

## Deploy

Root files: `firebase.json`, `.firebaserc`, web config in `apps/web/src/environments/`.

```bash
npm run deploy
```

### GitHub Actions

Add repository secret `FIREBASE_TOKEN` (from `firebase login:ci`), then pushes to `main` deploy Hosting.
