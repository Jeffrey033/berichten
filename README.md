# Prikbord — mededelingenbord met RSS-feed

Simpele webapp waarop collega's met één gedeeld wachtwoord kunnen inloggen om
korte mededelingen te plaatsen en verwijderen (bijv. "Vergadering raadzaal
19:30, trap op rechtsaf"). De app publiceert een RSS-feed op `/feed.xml` die
je kunt inladen in de applicatie die het scherm in de hal aanstuurt.

## Hoe het werkt

- **Inloggen**: één gedeeld wachtwoord voor alle collega's (in te stellen via
  de omgevingsvariabele `APP_PASSWORD`).
- **Berichten**: alleen ingelogde gebruikers kunnen plaatsen/verwijderen.
- **RSS-feed**: `https://jouw-app-url/feed.xml` is publiek en vereist geen
  login, zodat het scherm in de hal 'm gewoon kan ophalen. Toont de laatste
  30 berichten, nieuwste eerst.
- **Opslag**: berichten staan in `data/messages.json`. Zie hieronder — dit
  moet op een persistent volume staan, anders raak je berichten kwijt bij
  elke nieuwe deploy.

## Lokaal testen

```bash
npm install
cp .env.example .env
# open .env en vul een echt wachtwoord in
npm start
```

App draait dan op http://localhost:3000, feed op http://localhost:3000/feed.xml

## Deployen naar Render

1. Zet deze map in een git-repository (bv. op GitHub).
2. Ga naar [render.com](https://render.com) → **New +** → **Web Service** →
   koppel je repository.
3. Instellingen:
   - **Build command**: `npm install`
   - **Start command**: `npm start`
4. Onder **Environment**, voeg de variabelen uit `.env.example` toe (met een
   echt wachtwoord en `SITE_URL` = de URL die Render je geeft, bv.
   `https://prikbord.onrender.com`).
5. **Belangrijk voor bewaren van berichten**: voeg onder **Disks** een
   persistent disk toe, gekoppeld aan pad `/opt/render/project/src/data`
   (1 GB is ruim genoeg). Zonder disk worden berichten gewist bij elke
   nieuwe deploy.
6. Deploy. De feed-URL is dan `https://<jouw-service>.onrender.com/feed.xml`.

## Deployen naar Railway

1. Zet deze map in een git-repository en importeer 'm op
   [railway.app](https://railway.app) als nieuw project.
2. Railway herkent Node.js automatisch (`npm install` + `npm start`).
3. Voeg onder **Variables** dezelfde omgevingsvariabelen toe als in
   `.env.example`, met `SITE_URL` = de domeinnaam die Railway toewijst.
4. **Belangrijk voor bewaren van berichten**: voeg een **Volume** toe en
   koppel deze aan `/app/data`, zodat `messages.json` blijft bestaan tussen
   deploys.
5. Zet in **Settings** een publieke domeinnaam aan. De feed-URL wordt dan
   `https://<jouw-domein>.up.railway.app/feed.xml`.

## De feed inladen op het scherm in de hal

Geef de andere applicatie de URL `https://.../feed.xml` als RSS-bron. De
meeste schermweergave-apps (bv. een RSS-widget in een digital signage tool)
vragen om precies zo'n URL en ververst 'm vanzelf periodiek — een nieuw
bericht op het prikbord verschijnt dus vanzelf op het scherm.

## Wachtwoord wijzigen

Pas de omgevingsvariabele `APP_PASSWORD` aan bij je hosting-provider en
herstart de service. Collega's die al ingelogd zijn, blijven dat (sessie van
30 dagen) totdat ze uitloggen of hun cookies wissen.
