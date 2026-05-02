Game \& Tech News

A full-stack news aggregator for Gaming and Tech news.



Setup

1\. Get a free GNews API key

Sign up at gnews.io — free tier gives 100 requests/day.



2\. Configure the server

cd servercp .env.example .env# Edit .env and paste your API key



3\. Install dependencies \& start

cd server

npm install

npm start



4\. Open the client

Open client/index.html in your browser, or serve it:



bash



npx serve ../client



Server runs on http://localhost:3000



text





\---



\## `server/.env.example`



```env

PORT=3000

GNEWS\_API\_KEY=your\_gnews\_api\_key\_here

CACHE\_TTL=55000

