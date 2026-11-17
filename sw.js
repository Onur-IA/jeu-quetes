"use strict";
// Service worker du Jeu de quêtes.
// Il garde en cache la coquille (page, style, scripts, icônes) pour que l'application s'ouvre même
// hors ligne. Il ne garde JAMAIS les réponses de /api/ : en version 6, l'API est traitée dans la page
// par le moteur local (localStorage et IndexedDB).
// Aucune requête ne part vers l'extérieur.

const VERSION = "v7-1";
const CACHE = "jeu-quetes-coquille-" + VERSION;
const PREFIXE = "jeu-quetes-coquille-";

// La coquille connue d'avance. Les scripts et styles cités dans index.html s'y ajoutent à l'installation
// (voir « citesDans »), pour qu'un script ajouté plus tard à la page ne soit pas oublié.
const COQUILLE = [
  "./",
  "index.html",
  "style.css",
  "palette.js",
  "police.js",
  "personnages.js",
  "meubles.js",
  "objets.js",
  "chemin.js",
  "monde.js",
  "decor.js",
  "ciel.js",
  "immeuble.js",
  "agents.js",
  "rendu.js",
  "son.js",
  "panneaux.js",
  "v3.js",
  "mobile.js",
  "app.js",
  "tour.js",
  "pwa.js",
  "musique.js",
  "mixage.js",
  "systeme.js",
  // Version 6 : le mode express, plus le moteur local.
  "express.html",
  "express.css",
  "express.js",
  "haptique.js",
  "qr.js",
  "moteur.js",
  "api-local.js",
  "favicon.png",
  "manifest.webmanifest",
  "icones/icone-180.png",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "icones/icone-512-maskable.png",
  "icones/apple-touch-icon.png",
];

const HORS_LIGNE = {
  erreur: {
    code: "HORS_LIGNE",
    message: "Le serveur du jeu n'est pas joignable. Vérifie que ton Mac est allumé, que le jeu tourne et que tu es sur le même Wi-Fi.",
  },
};

function reponseHorsLigne() {
  return new Response(JSON.stringify(HORS_LIGNE), {
    status: 503,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Jeu-Hors-Ligne": "1" },
  });
}

// Adresses des scripts, styles et icônes cités dans la page : même origine seulement.
function citesDans(html) {
  const trouves = [];
  const motif = /<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = motif.exec(html))) {
    let url;
    try {
      url = new URL(m[1], self.registration.scope);
    } catch (e) {
      continue;
    }
    if (url.origin === self.location.origin && !url.pathname.startsWith("/api/")) trouves.push(url.href);
  }
  return trouves;
}

async function garder(cache, adresse) {
  try {
    const reponse = await fetch(adresse, { cache: "no-store" });
    if (reponse.ok) await cache.put(adresse, reponse);
  } catch (e) {
    // un fichier manquant n'empêche pas l'installation : il sera gardé à sa première lecture
  }
}

async function installer() {
  const cache = await caches.open(CACHE);
  const adresses = new Set(COQUILLE.map((chemin) => new URL(chemin, self.registration.scope).href));
  for (const nom of ["index.html", "express.html"]) {
    try {
      const page = await fetch(new URL(nom, self.registration.scope).href, { cache: "no-store" });
      if (page.ok) for (const adresse of citesDans(await page.text())) adresses.add(adresse);
    } catch (e) {
      // pas de page : la liste connue d'avance suffit
    }
  }
  await Promise.all([...adresses].map((adresse) => garder(cache, adresse)));
}

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(installer().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((nom) => nom.startsWith(PREFIXE) && nom !== CACHE).map((nom) => caches.delete(nom))))
      .then(() => self.clients.claim())
  );
});

// Attente maximale du réseau. Hors du Wi-Fi de la maison, l'adresse du serveur ne répond pas du tout :
// sans cette limite, la page resterait blanche de longues secondes avant le repli.
const ATTENTE_COQUILLE_MS = 3500;
const ATTENTE_API_MS = 10000;

function delai(ms) {
  return new Promise((ok) => setTimeout(ok, ms));
}

// Coquille : le réseau d'abord (le code à jour arrive toujours), le cache en repli.
async function coquille(requete) {
  const cache = await caches.open(CACHE);
  let gardee = (await cache.match(requete)) || (await cache.match(requete, { ignoreSearch: true }));
  if (!gardee && requete.mode === "navigate") {
    gardee = (await cache.match(new URL("index.html", self.registration.scope).href)) || (await cache.match(self.registration.scope));
  }
  const reseau = fetch(requete).then((reponse) => {
    if (reponse.ok && reponse.type === "basic") cache.put(requete, reponse.clone()).catch(() => {});
    return reponse;
  });
  if (!gardee) {
    return reseau.catch(() => new Response("Le serveur du jeu n'est pas joignable.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }));
  }
  reseau.catch(() => {});
  return Promise.race([reseau, delai(ATTENTE_COQUILLE_MS).then(() => Promise.reject(new Error("attente")))]).catch(() => gardee);
}

// API : le réseau, sinon un refus clair. Rien n'est gardé.
function api(requete) {
  const reseau = fetch(requete);
  reseau.catch(() => {});
  return Promise.race([reseau, delai(ATTENTE_API_MS).then(() => Promise.reject(new Error("attente")))]).catch(() => reponseHorsLigne());
}

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  let url;
  try {
    url = new URL(requete.url);
  } catch (e) {
    return;
  }
  // Rien d'autre que ce site : le navigateur s'en occupe sans nous.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) {
    // L'API : toujours le réseau, jamais le cache. Les envois (POST) ne passent même pas par ici.
    if (requete.method !== "GET") return;
    evenement.respondWith(api(requete));
    return;
  }
  if (requete.method !== "GET") return;
  evenement.respondWith(coquille(requete));
});
