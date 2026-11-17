"use strict";
// Application installable : enregistre le service worker (quand le navigateur le permet) et prévient
// clairement quand le serveur du jeu n'est pas joignable. Chargé en dernier.
// Le jeu ne marche pas hors ligne : la page s'ouvre, et dit pourquoi elle est vide.
(function () {
  const params = new URLSearchParams(location.search);
  const MESSAGE = "Hors ligne : le serveur du jeu n'est pas joignable";
  const AIDE = "Vérifie que ton Mac est allumé, que le jeu tourne et que tu es sur le même Wi-Fi.";
  const SONDE_MS = 5000;
  const LOCAL = Boolean(window.JeuLocal);

  // ------------------------------------------------------------ service worker
  // Seulement en contexte sûr (https, ou localhost). Sur le téléphone, en http par le Wi-Fi, le navigateur
  // le refuse : le jeu marche quand même, sans la coquille hors ligne. « ?sw=0 » coupe l'enregistrement.
  function enregistrer() {
    try {
      if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
      if (params.get("sw") === "0") {
        navigator.serviceWorker
          .getRegistrations()
          .then((liste) => Promise.all(liste.map((r) => r.unregister())))
          .catch(() => {});
        return;
      }
      navigator.serviceWorker.register("sw.js").catch(() => {});
    } catch (e) {
      // pas de service worker ici : rien à faire, et rien à signaler
    }
  }

  // ------------------------------------------------------------ bandeau « hors ligne »
  let bandeau = null;
  let horsLigne = false;
  let minuteur = null;
  let sondeEnCours = false;

  function construire() {
    if (bandeau) return bandeau;
    bandeau = document.createElement("div");
    bandeau.id = "hors-ligne";
    bandeau.setAttribute("role", "alert");
    bandeau.hidden = true;
    const texte = document.createElement("div");
    texte.className = "texte";
    const titre = document.createElement("b");
    titre.textContent = MESSAGE;
    const aide = document.createElement("span");
    aide.textContent = AIDE;
    texte.append(titre, aide);
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "bouton second";
    bouton.id = "hors-ligne-reessayer";
    bouton.textContent = "Réessayer";
    bouton.addEventListener("click", () => {
      bouton.disabled = true;
      bouton.textContent = "Je réessaie...";
      sonder().then(() => {
        bouton.disabled = false;
        bouton.textContent = "Réessayer";
      });
    });
    bandeau.append(texte, bouton);
    document.body.appendChild(bandeau);
    return bandeau;
  }

  function prevenir() {
    document.documentElement.dataset.reseau = horsLigne ? "hors-ligne" : "en-ligne";
    try {
      window.dispatchEvent(new CustomEvent("jeu-reseau", { detail: { horsLigne } }));
    } catch (e) {
      // vieux navigateur : le bandeau suffit
    }
  }

  function signalerPanne() {
    if (horsLigne) return;
    horsLigne = true;
    construire().hidden = false;
    prevenir();
    clearInterval(minuteur);
    minuteur = setInterval(() => {
      if (!document.hidden) sonder();
    }, SONDE_MS);
  }

  function signalerRetour() {
    if (!horsLigne) return;
    horsLigne = false;
    clearInterval(minuteur);
    minuteur = null;
    if (bandeau) bandeau.hidden = true;
    prevenir();
    // le jeu relit son état, comme avec le bouton « Relire tes quêtes »
    const relire = document.getElementById("bouton-rafraichir");
    if (relire) relire.click();
  }

  // Le serveur du jeu répond-il ? Une réponse fabriquée par le service worker (hors ligne) ne compte pas.
  const fetchNatif = typeof window.fetch === "function" ? window.fetch.bind(window) : null;

  async function sonder() {
    if (LOCAL) return;
    if (!fetchNatif || sondeEnCours) return;
    sondeEnCours = true;
    let joignable = false;
    try {
      const reponse = await fetchNatif(new URL("api/ping", new URL(".", location.href)).href, { cache: "no-store" });
      joignable = reponse.ok && !reponse.headers.get("X-Jeu-Hors-Ligne");
    } catch (e) {
      joignable = false;
    }
    sondeEnCours = false;
    if (joignable) signalerRetour();
    else signalerPanne();
  }

  // Chaque appel du jeu à /api/ est observé : un échec réseau montre le bandeau (et son message devient lisible),
  // une réponse du serveur le retire. Les réponses elles-mêmes ne sont pas touchées.
  if (fetchNatif && !LOCAL) {
    window.fetch = function (ressource, options) {
      const promesse = fetchNatif(ressource, options);
      let chemin = "";
      try {
        chemin = new URL(typeof ressource === "string" ? ressource : ressource.url, location.href).pathname;
      } catch (e) {
        chemin = "";
      }
      if (chemin.indexOf("/api/") === -1) return promesse;
      return promesse.then(
        (reponse) => {
          if (reponse.headers.get("X-Jeu-Hors-Ligne")) signalerPanne();
          else signalerRetour();
          return reponse;
        },
        (erreur) => {
          if (erreur && erreur.name === "AbortError") throw erreur;
          signalerPanne();
          // le message du navigateur est en anglais : le jeu dit la même chose, en clair
          throw new TypeError("Le serveur du jeu n'est pas joignable. " + AIDE);
        }
      );
    };
  }

  if (!LOCAL) {
    window.addEventListener("offline", sonder);
    window.addEventListener("online", sonder);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && horsLigne) sonder();
    });
  }

  enregistrer();
  if (LOCAL) {
    // Version 6 : le moteur tourne dans la page. Pas de bandeau « Mac éteint ».
    window.Pwa = { sonder: async function () {}, horsLigne: () => false };
    return;
  }
  // Le premier appel du jeu est parti avant ce script : une sonde pour savoir où on en est.
  sonder();

  window.Pwa = { sonder, horsLigne: () => horsLigne };
})();
