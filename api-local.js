"use strict";
// Version 7 : le jeu tourne dans le navigateur, sans serveur.
// Les appels /api/ sont traités ici, par le moteur local. La partie vit dans
// localStorage et IndexedDB, sur cet appareil. Rien n'est envoyé ailleurs.
(function (racine) {
  const M = racine.JeuMoteur;
  if (!M) return;

  const REFUS = new Set([
    "INCONNU", "DEJA_PAYE", "JOUR_FUTUR", "NON_ANNULABLE", "REQUETE_INVALIDE",
    "PAR_EFFORT", "SOLDE", "REGLAGE_INVALIDE", "PLAFOND",
  ]);

  const ROUTES_POST = [
    [/^\/api\/quetes\/ajouter$/, "ajouterQuete", (m, corps) => ({ texte: corps.texte, type: corps.type, degres: corps.degres, cout_energie: corps.cout_energie })],
    [/^\/api\/energie$/, "choisirEnergie", (m, corps) => ({ niveau: corps.niveau || corps.id })],
    [/^\/api\/quetes\/([^/]+)\/energie$/, "definirCoutEnergie", (m, corps) => ({ id: m[1], cout: corps.cout })],
    [/^\/api\/horloge$/, "poserHorloge", (m, corps) => ({ date: Object.prototype.hasOwnProperty.call(corps || {}, "date") ? corps.date : null })],
    [/^\/api\/boss$/, "definirBossSemaine", (m, corps) => ({ nom: corps.nom, pv_max: corps.pv_max })],
    [/^\/api\/semaine\/coller$/, "importerNoteSemaine", (m, corps) => ({ texte: corps.texte })],
    [/^\/api\/quetes\/([^/]+)\/valider$/, "validerQuete", (m, corps) => ({ id: m[1], degre: corps.degre })],
    [/^\/api\/priorites\/([^/]+)\/valider$/, "validerPriorite", (m, corps) => ({ id: m[1], degre: corps.degre })],
    [/^\/api\/quetes\/([^/]+)\/type$/, "changerType", (m, corps) => ({ id: m[1], type: corps.type })],
    [/^\/api\/quetes\/([^/]+)\/degres$/, "definirDegres", (m, corps) => ({ id: m[1], degres: corps.degres })],
    [/^\/api\/quetes\/([^/]+)\/reporter$/, "reporter", (m) => ({ id: m[1] })],
    [/^\/api\/quetes\/([^/]+)\/retirer$/, "retirerQuete", (m) => ({ id: m[1] })],
    [/^\/api\/contrat$/, "signerContrat", (m, corps) => ({ choix: corps.choix, heure: corps.heure })],
    [/^\/api\/arroser$/, "arroser", () => ({})],
    [/^\/api\/equipe\/but$/, "definirBut", (m, corps) => ({ libelle: corps.libelle })],
    [/^\/api\/semaine\/cloturer$/, "cloturerSemaine", (m, corps) => ({ mot: corps.mot })],
    [/^\/api\/reglages$/, "reglage", (m, corps) => ({ chemin: corps.chemin, valeur: corps.valeur })],
    [/^\/api\/reglages\/defaut$/, "reglageDefaut", (m, corps) => ({ chemin: corps.chemin })],
    [/^\/api\/reglages\/tout-defaut$/, "reglagesDefaut", () => ({})],
    [/^\/api\/deblocages\/tout$/, "ouvrirTout", (m, corps) => ({ oui: corps.oui !== false })],
    [/^\/api\/assistant$/, "assistant", (m, corps) => ({ joueur: corps.joueur, enseigne: corps.enseigne, monnaie: corps.monnaie, objectif_mensuel: corps.objectif_mensuel, but: corps.but, rythme: corps.rythme })],
    [/^\/api\/paiements\/([^/]+)\/annuler$/, "annuler", (m) => ({ id: m[1] })],
    [/^\/api\/quetes\/([^/]+)\/vente$/, "forcerVente", (m, corps) => ({ id: m[1], vente: corps.vente })],
    [/^\/api\/etats$/, "noterEtat", (m, corps) => ({ titre: typeof corps.titre === "string" ? corps.titre.normalize("NFC") : corps.titre })],
    [/^\/api\/gestes\/([^/]+)\/cocher$/, "cocherGeste", (m) => ({ id: m[1] })],
    [/^\/api\/ameliorations\/acheter$/, "acheter", (m, corps) => ({ lieu: corps.lieu, id: corps.id })],
    [/^\/api\/objets\/acheter$/, "acheterDeco", (m, corps) => ({ id: corps.id })],
    [/^\/api\/placements$/, "placer", (m, corps) => ({ cle: corps.cle, zone: String(corps.zone || ""), x: corps.x, defaut: corps.defaut === true })],
    [/^\/api\/avatar$/, "changerAvatar", (m, corps) => ({ peau: corps.peau, cheveux: corps.cheveux, pull: corps.pull, barbe: corps.barbe, lunettes: corps.lunettes })],
    [/^\/api\/quetes\/([^/]+)\/confier$/, "confier", (m, corps) => ({ id: m[1], agent: corps.agent || null })],
    [/^\/api\/encaissements$/, "declarerEncaissement", (m, corps) => ({ montant: corps.montant, date: corps.date, source: corps.source, note: corps.note })],
    [/^\/api\/encaissements\/([^/]+)\/modifier$/, "modifierEncaissement", (m, corps) => ({ id: m[1], montant: corps.montant, date: corps.date, source: corps.source, note: corps.note })],
    [/^\/api\/encaissements\/([^/]+)\/supprimer$/, "supprimerEncaissement", (m) => ({ id: m[1] })],
    [/^\/api\/colis\/([^/]+)\/ouvrir$/, "ouvrirColis", (m) => ({ id: m[1] })],
    [/^\/api\/caps\/([^/]+)\/cocher$/, "cocherCap", (m, corps) => ({ id: m[1], date: corps.date })],
    [/^\/api\/caps\/([^/]+)\/decocher$/, "decocherCap", (m) => ({ id: m[1] })],
    [/^\/api\/accueil\/vu$/, "accueilVu", () => ({})],
    [/^\/api\/systeme\/(.+)$/, "systeme", (m, corps) => ({ chemin: m[1], corps })],
  ];

  const QUETES_DEMO = [
    "# Quêtes du jeu",
    "",
    "Quelques exemples pour jouer tout de suite. Tu peux les retirer, les changer, et écrire les tiennes.",
    "Le chiffre après le tilde est le coût d'énergie (1 : tout petit, 5 : une grosse session).",
    "",
    "## Exemples",
    "",
    "- [ ] Boire un verre d'eau @sante ~1",
    "- [ ] Faire une courte promenade @sante ~2",
    "- [ ] Avancer une tâche importante une demi-heure @creation ~3",
    "- [ ] Faire le gros dossier du jour @admin ~4",
    "- [ ] Tenir une session profonde de 90 minutes @creation ~5",
    "",
  ].join("\n");

  function dateValide(d) {
    return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  }

  function jsonReponse(statut, objet, extra) {
    const corps = JSON.stringify(objet);
    const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(extra || {}) };
    return new Response(corps, { status: statut, headers });
  }

  function erreur(err, doux) {
    const code = err && err.code ? err.code : "ERREUR";
    const message = err && err.message ? err.message : "Une erreur inattendue est survenue.";
    const statut = doux && REFUS.has(code) ? 200 : ({ REQUETE_INVALIDE: 400, INCONNU: 404, INTERDIT: 403, METHODE: 405, DATE_INVALIDE: 400 }[code] || (REFUS.has(code) ? 400 : 500));
    return jsonReponse(statut, { erreur: { code, message } });
  }

  function cheminApi(input) {
    try {
      const u = new URL(typeof input === "string" ? input : (input && input.url) || "", racine.location.href);
      const i = u.pathname.indexOf("/api/");
      if (i === -1) return null;
      return { chemin: u.pathname.slice(i), url: u };
    } catch (e) {
      return null;
    }
  }

  function contexteDe(url, config) {
    const date = url.searchParams.get("date");
    if (date !== null && date !== "" && !dateValide(date)) {
      const e = new Error("La date doit être au format AAAA-MM-JJ.");
      e.code = "DATE_INVALIDE";
      throw e;
    }
    return { config, date: date || null, demo: url.searchParams.get("demo") === "1" };
  }

  function amorcer() {
    if (!M.lireFichier("/jeu/config.json")) {
      const brut = M.require("/jeu/config.json-brut");
      M.ecrireFichier("/jeu/config.json", JSON.stringify(brut, null, 2) + "\n");
    }
    M.require("node:fs").mkdirSync("/jeu/data", { recursive: true });
    const sav = M.lireFichier("/jeu/data/partie.json");
    const quetes = M.lireFichier("/jeu/data/quetes.md");
    if (!sav && (quetes === null || String(quetes).trim() === "")) {
      M.ecrireFichier("/jeu/data/quetes.md", QUETES_DEMO);
    }
  }

  function traiter(methode, chemin, url, corps, enTetes) {
    const configuration = M.configuration();
    const config = configuration.charger();
    const contexte = contexteDe(url, config);
    const partie = M.partie();
    const sauvegarde = M.sauvegarde();
    const doux = enTetes.get("x-jeu-refus") === "200";

    if (methode !== "POST") {
      if (chemin === "/api/ping") return jsonReponse(200, { jeu: "jeu-quetes", version: configuration.VERSION, local: true });
      if (chemin === "/api/appareil") {
        return jsonReponse(200, {
          reseau_local: false,
          https: true,
          certificat: null,
          adresses: [],
          local: true,
        });
      }
      if (chemin === "/api/sauvegarde") {
        if (contexte.date || contexte.demo) {
          const e = new Error("La sauvegarde ne concerne que ta vraie partie.");
          e.code = "REQUETE_INVALIDE";
          return erreur(e, doux);
        }
        const objet = sauvegarde.exporter();
        const corpsSav = JSON.stringify(objet, null, 2);
        const nom = "jeu-de-quetes-" + String(objet.cree_le || "").slice(0, 10) + ".json";
        return new Response(corpsSav, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": 'attachment; filename="' + nom + '"',
            "Cache-Control": "no-store",
            "X-Jeu-Nom-Fichier": nom,
          },
        });
      }
      if (chemin === "/api/etat") return jsonReponse(200, partie.etat(contexte));
      if (chemin === "/api/reglages") return jsonReponse(200, partie.vueReglages(contexte));
      if (chemin === "/api/collegues") return jsonReponse(200, { collegues: [], sessions: 0 });
      const e = new Error("Cette adresse n'existe pas.");
      e.code = "INCONNU";
      return erreur(e, doux);
    }

    if (chemin === "/api/sauvegarde/importer") {
      if (contexte.date || contexte.demo) {
        const e = new Error("La sauvegarde ne concerne que ta vraie partie.");
        e.code = "REQUETE_INVALIDE";
        return erreur(e, doux);
      }
      const bilan = sauvegarde.importer(corps && corps.sauvegarde);
      const etat = partie.etat(contexte);
      return jsonReponse(200, { ok: true, gains: [], import: bilan, partie: etat.partie, etat });
    }
    if (chemin === "/api/test/reinitialiser") {
      if (!contexte.date && !contexte.demo) {
        M.vider();
        amorcer();
        const etat = partie.etat({ config, date: null, demo: false });
        return jsonReponse(200, { ok: true, gains: [], partie: etat.partie, etat, vide: true });
      }
      const etat = partie.reinitialiserTest(contexte);
      return jsonReponse(200, { ok: true, gains: [], partie: etat.partie, etat });
    }
    for (const [motif, action, parametres] of ROUTES_POST) {
      const m = motif.exec(chemin);
      if (!m) continue;
      const etat = partie.jouer(contexte, action, parametres(m, corps || {}));
      return jsonReponse(200, { ok: true, gains: etat.gains, partie: etat.partie, etat });
    }
    const e = new Error("Cette adresse n'existe pas.");
    e.code = "INCONNU";
    return erreur(e, doux);
  }

  const pret = M.restaurer().then(function () {
    amorcer();
  });

  async function fetchLocal(input, init) {
    await pret;
    const info = cheminApi(input);
    if (!info) throw new Error("Pas une adresse d'API.");
    const methode = String((init && init.method) || (typeof input !== "string" && input.method) || "GET").toUpperCase();
    const headers = new Headers((init && init.headers) || (typeof input !== "string" && input.headers) || {});
    let corps = null;
    if (methode === "POST") {
      const brut = init && init.body != null ? String(init.body) : "";
      try {
        corps = brut ? JSON.parse(brut) : {};
      } catch (e) {
        const err = new Error("Le corps de la requête n'est pas un JSON valide.");
        err.code = "REQUETE_INVALIDE";
        return erreur(err, headers.get("x-jeu-refus") === "200");
      }
    }
    try {
      return traiter(methode, info.chemin, info.url, corps, headers);
    } catch (err) {
      return erreur(err, headers.get("x-jeu-refus") === "200");
    }
  }

  const vraiFetch = racine.fetch.bind(racine);
  racine.fetch = function (input, init) {
    if (cheminApi(input)) return fetchLocal(input, init);
    return vraiFetch(input, init);
  };

  racine.JeuLocal = {
    pret: pret,
    fetch: fetchLocal,
    vraiFetch: vraiFetch,
    amorcer: amorcer,
    quetesDemo: QUETES_DEMO,
  };
})(window);
