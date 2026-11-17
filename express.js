"use strict";
// Version 5 : le mode express. Les quêtes du jour, cochées en deux secondes, au pouce ou à la souris.
// - Toucher une carte : c'est fait (degré par défaut). Appui long : choisir le degré.
// - Glisser vers la droite : fait. Vers la gauche : à demain.
// - Hors ligne : le dernier état connu s'affiche, les gestes attendent dans une file (localStorage)
//   et partent tout seuls dès que le serveur répond. Rien n'est jamais perdu, rien n'est payé deux fois
//   (le serveur refuse un doublon, la file le retire).
// - Retours : son (son.js), vibration (haptique.js), gains qui s'envolent, combo, série, fête de fin de journée.
// Aucune requête ne sort de la machine : rien que des chemins relatifs vers le serveur du jeu.
(function (racine) {
  const doc = racine.document;
  const $ = (id) => doc.getElementById(id);
  const params = new URLSearchParams(racine.location.search);
  const DATE = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? params.get("date") : null;
  const DEMO = params.get("demo") === "1";
  const SUFFIXE = DATE ? "-" + DATE : DEMO ? "-demo" : "";
  const CLE_ETAT = "jq-express-etat" + SUFFIXE;
  const CLE_FILE = "jq-express-file" + SUFFIXE;
  const CLE_FETE = "jq-express-fete" + SUFFIXE;
  const CLE_SON = "jq-express-son";
  const ATTENTE_MS = 4500;
  const APPUI_LONG_MS = 450;
  const SEUIL_GLISSE = 84;
  const COMBO_MS = 120000;
  const REFUS = new Set(["INCONNU", "DEJA_PAYE", "JOUR_FUTUR", "NON_ANNULABLE", "REQUETE_INVALIDE", "PAR_EFFORT"]);
  const Son = racine.Son || { jouer() {}, activer() {}, musique() {}, ambiance() {}, reglages: () => ({}) };
  const Musique = racine.Musique || { intensite() {} };
  const Haptique = racine.Haptique || { toc() {}, actif: () => false, activer() {} };

  let etat = null;
  let enLigne = true;
  let envoiEnCours = false;
  let combo = { n: 0, t: 0 };
  const locales = new Set(); // clés cochées ici, pas encore confirmées par le serveur
  let toastMinuteur = null;

  // ------------------------------------------------------------ petits outils
  const e = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const nombre = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const liste = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
  const pluriel = (n, un, plusieurs) => n + " " + (n > 1 ? plusieurs : un);
  function lireLocal(cle, defaut) {
    try {
      const t = racine.localStorage.getItem(cle);
      return t === null ? defaut : JSON.parse(t);
    } catch (err) {
      return defaut;
    }
  }
  function ecrireLocal(cle, valeur) {
    try {
      racine.localStorage.setItem(cle, JSON.stringify(valeur));
    } catch (err) {
      // stockage plein ou refusé : l'appli marche quand même, sans mémoire hors ligne
    }
  }
  function aujourdhui() {
    if (DATE) return DATE;
    if (etat && etat.date && enLigne) return etat.date;
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function racineApp() {
    return new URL(".", racine.location.href).href;
  }
  function adresse(chemin) {
    const q = [];
    if (DATE) q.push("date=" + DATE);
    if (DEMO) q.push("demo=1");
    const rel = String(chemin || "").replace(/^\//, "");
    const u = new URL(rel, racineApp());
    if (q.length) u.search += (u.search ? "&" : "") + q.join("&");
    return u.href;
  }
  function local() {
    return Boolean(racine.JeuLocal);
  }

  // ------------------------------------------------------------ serveur
  async function api(methode, chemin, corps) {
    const controle = typeof AbortController === "function" ? new AbortController() : null;
    const minuteur = controle ? racine.setTimeout(() => controle.abort(), ATTENTE_MS) : null;
    const options = { method: methode, headers: {}, cache: "no-store", signal: controle ? controle.signal : undefined };
    if (methode === "POST") {
      options.headers = { "Content-Type": "application/json", "X-Jeu-Quetes": "1", "X-Jeu-Refus": "200" };
      options.body = JSON.stringify(corps || {});
    }
    let reponse;
    try {
      reponse = await racine.fetch(adresse(chemin), options);
    } catch (err) {
      throw Object.assign(new Error("Le serveur du jeu n'est pas joignable."), { code: "RESEAU" });
    } finally {
      if (minuteur) racine.clearTimeout(minuteur);
    }
    let json = null;
    try {
      json = await reponse.json();
    } catch (err) {
      json = null;
    }
    if (reponse.status === 503 && reponse.headers.get("X-Jeu-Hors-Ligne") === "1") {
      throw Object.assign(new Error("Le serveur du jeu n'est pas joignable."), { code: "RESEAU" });
    }
    if (!json) throw Object.assign(new Error("Réponse illisible du serveur."), { code: "RESEAU" });
    if (json.erreur) throw Object.assign(new Error(json.erreur.message), { code: json.erreur.code || "ERREUR" });
    return json;
  }

  function marquerLigne(oui) {
    enLigne = oui;
    const pastille = $("x-pastille");
    const file = lireLocal(CLE_FILE, []);
    pastille.className = !oui ? "coupe" : file.length ? "attente" : "";
    pastille.title = !oui ? "Hors ligne" : file.length ? "Gestes en attente" : "À jour";
    doc.documentElement.dataset.ligne = oui ? "oui" : "non";
  }

  async function charger() {
    try {
      const nouvel = await api("GET", "/api/etat");
      marquerLigne(true);
      appliquer(nouvel);
      if (lireLocal(CLE_FILE, []).length) vider();
    } catch (err) {
      marquerLigne(false);
      if (!etat) {
        const garde = lireLocal(CLE_ETAT, null);
        if (garde && garde.etat) appliquer(garde.etat, { horsLigne: true });
        else rendreVide();
      } else {
        dessiner();
      }
    }
    $("x").setAttribute("aria-busy", "false");
  }

  function appliquer(nouvel, options) {
    if (!nouvel || typeof nouvel !== "object") return;
    const avant = etat && etat.systeme && etat.systeme.hud ? etat.systeme.hud : null;
    etat = nouvel;
    if (!(options && options.horsLigne)) {
      locales.clear();
      ecrireLocal(CLE_ETAT, { garde_le: new Date().toISOString(), etat: nouvel });
    }
    // Le son suit le réglage du jeu, et le choix fait ici.
    const voulu = lireLocal(CLE_SON, true) !== false && !(etat.config && etat.config.son === false);
    if (Son.actif !== voulu) Son.activer(voulu);
    $("x-son").setAttribute("aria-pressed", voulu ? "true" : "false");
    $("x-son").textContent = voulu ? "Son" : "Muet";
    dessiner();
    const apres = etat.systeme && etat.systeme.hud ? etat.systeme.hud : null;
    if (avant && apres && (nombre(apres.niveau, 1) > nombre(avant.niveau, 1))) {
      Son.jouer("niveau_systeme");
      Haptique.toc("journee");
      afficherToast("Niveau " + apres.niveau + " ! " + (apres.rang !== avant.rang ? "Nouveau rang : " + apres.rang + "." : "Continue comme ça."));
    }
    verifierFete();
    if (nouvel && nouvel.energie && nouvel.energie.a_choisir && !(options && options.horsLigne) && !ouvrirEnergie.deja) {
      ouvrirEnergie.deja = true;
      racine.setTimeout(ouvrirEnergie, 250);
    }
  }

  // ------------------------------------------------------------ ce qu'il y a à cocher
  function contenu() {
    if (!etat) return { quetes: [], faites: [], quotidiennes: [], habitudes: [] };
    const jours = liste(etat.jours);
    const tous = [...jours.flatMap((j) => liste(j.priorites)), ...liste(etat.quetes)];
    const parId = new Map(tous.map((q) => [q.id, q]));
    const duJour = etat.du_jour && typeof etat.du_jour === "object" ? etat.du_jour : {};
    const visibles = (Array.isArray(duJour.visibles) ? duJour.visibles : []).map((id) => parId.get(id)).filter(Boolean);
    const faites = (Array.isArray(duJour.faites) ? duJour.faites : []).map((id) => parId.get(id)).filter(Boolean);
    const systeme = etat.systeme && typeof etat.systeme === "object" && etat.systeme.actif !== false ? etat.systeme : {};
    const energie = etat.energie && typeof etat.energie === "object" ? etat.energie : null;
    const ordre = energie && energie.suggestions && Array.isArray(energie.suggestions.ordre) ? energie.suggestions.ordre : [];
    const parOrdre = ordre.length ? ordre.map((id) => parId.get(id)).filter((q) => q && visibles.some((v) => v.id === q.id)) : visibles;
    const manquantes = visibles.filter((q) => !parOrdre.some((x) => x.id === q.id));
    return { quetes: parOrdre.concat(manquantes), faites, quotidiennes: liste(systeme.quotidiennes), habitudes: liste(systeme.habitudes), reserve: nombre(duJour.reserve, 0), energie };
  }

  function bilan() {
    const c = contenu();
    const enAttente = new Set(lireLocal(CLE_FILE, []).map((g) => g.cle));
    const fait = (cle) => locales.has(cle) || enAttente.has(cle);
    const quetesFaites = c.faites.length + c.quetes.filter((q) => fait("q:" + q.id)).length;
    const total = c.faites.length + c.quetes.length + c.quotidiennes.length;
    const faites = quetesFaites + c.quotidiennes.filter((q) => q.faite || fait("d:" + q.id)).length;
    return { total, faites, c, fait };
  }

  // ------------------------------------------------------------ dessin
  function htmlHud() {
    if (!etat) return '<span class="x-niveau">Jeu de quêtes</span>';
    const hud = etat.systeme && etat.systeme.actif !== false && etat.systeme.hud ? etat.systeme.hud : null;
    const serie = etat.partie && etat.partie.serie ? nombre(etat.partie.serie.courante, 0) : 0;
    const points = etat.partie ? nombre(etat.partie.points, 0) : 0;
    const flamme = '<span class="x-serie' + (serie >= 3 ? " chaude" : "") + '" title="Série de jours joués"><i class="x-flamme"></i>' + pluriel(serie, "jour", "jours") + "</span>";
    if (!hud) {
      const n = etat.niveau || {};
      return '<span class="x-rang">' + e(nombre(n.rang, 1)) + '</span><span class="x-niveau">' + e(n.nom || "Niveau") + '</span><span class="x-bourse chiffres"><span class="x-or">' + points + " points</span>" + flamme + '</span><span class="x-xp"><i style="width:' + Math.max(0, Math.min(100, nombre(n.progression, 0))) + '%"></i></span>';
    }
    const pct = Math.round((Math.max(0, nombre(hud.xp_niveau, 0)) / Math.max(1, nombre(hud.xp_suivant, 100))) * 100);
    return (
      '<span class="x-rang" title="Rang">' + e(hud.rang || "E") + "</span>" +
      '<span class="x-niveau">Niveau ' + e(nombre(hud.niveau, 1)) + "<small>" + e(nombre(hud.xp_niveau, 0)) + " / " + e(nombre(hud.xp_suivant, 100)) + " XP</small></span>" +
      '<span class="x-bourse chiffres"><span class="x-or">' + e(nombre(hud.or, 0)) + " or</span>" + flamme + "</span>" +
      '<span class="x-xp" role="progressbar" aria-label="Expérience" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></span>'
    );
  }

  function htmlAnneau() {
    const b = bilan();
    const pct = b.total ? Math.round((b.faites / b.total) * 100) : 0;
    const plein = b.total > 0 && b.faites >= b.total;
    let phrase;
    if (!b.total) phrase = "<b>Rien à cocher</b><span>Écris une quête en bas, elle compte tout de suite.</span>";
    else if (plein) phrase = "<b>Journée bouclée</b><span>Tout est fait. Le reste est du bonus.</span>";
    else phrase = "<b>" + b.faites + " sur " + b.total + "</b><span>" + (b.faites ? "Encore " + pluriel(b.total - b.faites, "quête", "quêtes") + ", tu tiens le rythme." : "Une première, et la journée démarre.") + "</span>";
    const comboActif = combo.n >= 2 && Date.now() - combo.t < COMBO_MS;
    if (comboActif) phrase += '<span class="x-combo">Combo x' + combo.n + "</span>";
    return '<div class="x-cercle' + (plein ? " plein" : "") + '" style="--p:' + pct + '"><b class="chiffres">' + pct + '%</b></div><div class="x-phrase">' + phrase + "</div>";
  }

  function pips(n) {
    const c = Math.max(1, Math.min(5, nombre(n, 2)));
    return '<span class="x-pips" title="Coût d\'énergie : ' + c + '" aria-label="Coût d\'énergie ' + c + '">' + "●".repeat(c) + "<i>" + "○".repeat(5 - c) + "</i></span>";
  }

  function gainDe(q) {
    if (q.mode === "racontee") return '<span class="x-gain recit">au journal</span>';
    const g = Array.isArray(q.gains) ? q.gains : [];
    const defaut = etat.config && etat.config.points ? nombre(etat.config.points.degre_defaut, 2) : 2;
    const v = g.length ? g[Math.max(0, Math.min(g.length - 1, defaut - 1))] : nombre(q.points, 0);
    return v > 0 ? '<span class="x-gain chiffres">+' + e(v) + "</span>" : '<span class="x-gain recit">au journal</span>';
  }

  function ligne(cle, classe, interieur, attente, glissable) {
    return (
      '<div class="x-ligne ' + classe + (attente ? " attente" : "") + '" data-cle="' + e(cle) + '">' +
      (glissable ? '<div class="x-dessous" aria-hidden="true"><span class="fait">Fait</span><span class="demain">Demain</span></div>' : "") +
      interieur + "</div>"
    );
  }

  function dessiner() {
    $("x-hud").innerHTML = htmlHud();
    $("x-anneau").innerHTML = htmlAnneau();
    const b = bilan();
    const c = b.c;
    const enAttente = new Set(lireLocal(CLE_FILE, []).map((g) => g.cle));
    let h = "";
    const eg = c.energie;
    if (eg && eg.actif) {
      if (eg.choisi) {
        h += '<div class="x-energie-bandeau"><b>' + e(eg.choisi.titre) + "</b> aujourd'hui. <button type=\"button\" class=\"x-lien\" data-x=\"energie\">Changer</button></div>";
        if (eg.suggestions && eg.suggestions.message) h += '<p class="x-energie-msg">' + e(eg.suggestions.message) + "</p>";
      } else {
        h += '<div class="x-energie-bandeau"><button type="button" class="x-btn" data-x="energie">Comment tu te sens aujourd\'hui ?</button></div>';
      }
    }
    const adaptees = new Set(eg && eg.suggestions && Array.isArray(eg.suggestions.adaptees) ? eg.suggestions.adaptees : []);
    const lourdes = new Set(eg && eg.suggestions && Array.isArray(eg.suggestions.plus_lourdes) ? eg.suggestions.plus_lourdes : []);
    function carteQuete(q, extraClasse) {
      const cle = "q:" + q.id;
      const fait = b.fait(cle);
      return ligne(
        cle,
        "x-quete" + (fait ? " faite" : "") + (extraClasse ? " " + extraClasse : ""),
        '<button type="button" class="x-carte" data-geste="quete" data-id="' + e(q.id) + '" data-genre="' + (q.genre === "priorite" ? "priorite" : "ligne") + '" aria-label="' + (fait ? "Fait : " : "C'est fait : ") + e(q.texte) + '"' + (fait ? " disabled" : "") + ">" +
          '<span class="x-case"></span><span class="x-texte"><span>' + e(q.texte) + "</span>" + "<small>" + pips(q.cout_energie) + (q.nom_type ? " " + e(q.nom_type) : "") + (q.vente ? ", vente" : "") + "</small></span>" + gainDe(q) + "</button>",
        enAttente.has(cle),
        !fait
      );
    }
    const listeAdaptees = c.quetes.filter((q) => !lourdes.has(q.id));
    const listeLourdes = c.quetes.filter((q) => lourdes.has(q.id));
    h += "<h2>" + (eg && eg.choisi && listeAdaptees.length && listeLourdes.length ? "Pour cette énergie" : "Quêtes du jour") + " <small>" + (c.quetes.length ? "touche : fait, appui long : le degré ou le coût" : "") + "</small></h2>";
    if (listeAdaptees.length) {
      for (const q of listeAdaptees) h += carteQuete(q, adaptees.has(q.id) ? "adaptee" : "");
    } else if (!listeLourdes.length) {
      h += '<p class="x-vide">' + (c.faites.length ? "Plus rien d'ouvert. Belle journée." : "Aucune quête pour l'instant.") + "</p>";
    }
    if (listeLourdes.length) {
      h += "<h2>Un peu plus lourd aujourd'hui <small>si tu veux, ou à reporter</small></h2>";
      for (const q of listeLourdes) h += carteQuete(q, "lourde");
    }

    if (c.reserve > 0) h += '<p class="x-vide">' + pluriel(c.reserve, "autre quête attend", "autres quêtes attendent") + " en réserve. Une de faite, une de plus ici.</p>";
    if (c.quotidiennes.length) {
      const faites = c.quotidiennes.filter((q) => q.faite || b.fait("d:" + q.id)).length;
      h += "<h2>Quotidiennes <small>" + faites + " sur " + c.quotidiennes.length + "</small></h2>";
      for (const q of c.quotidiennes) {
        const cle = "d:" + q.id;
        const fait = q.faite || b.fait(cle);
        const serie = nombre(q.serie, 0);
        h += ligne(
          cle,
          "x-quotidienne" + (fait ? " faite" : ""),
          '<button type="button" class="x-carte" data-geste="quotidienne" data-id="' + e(q.id) + '" aria-label="' + (fait ? "Fait : " : "C'est fait : ") + e(q.texte) + '"' + (fait ? " disabled" : "") + ">" +
            '<span class="x-case"></span><span class="x-texte"><span>' + e(q.texte) + "</span>" + (serie > 0 ? "<small>série de " + pluriel(serie, "jour", "jours") + (q.ombre ? ", ombre alliée" : "") + "</small>" : "") + "</span></button>",
          enAttente.has(cle) && !q.faite,
          false
        );
      }
    }
    if (c.habitudes.length) {
      h += "<h2>Habitudes <small>au fil de la journée</small></h2>";
      for (const x of c.habitudes) {
        const sens = typeof x.sens === "string" ? x.sens : "+";
        let boutons = "";
        if (sens.includes("-")) boutons += '<button type="button" class="moins" data-geste="habitude" data-sens="-" data-id="' + e(x.id) + '" aria-label="Un moins : ' + e(x.texte) + '">-</button>';
        if (sens.includes("+")) boutons += '<button type="button" class="plus" data-geste="habitude" data-sens="+" data-id="' + e(x.id) + '" aria-label="Un plus : ' + e(x.texte) + '">+</button>';
        h += ligne("h:" + x.id, "x-habitude", '<div class="x-carte"><span class="x-texte"><span>' + e(x.texte) + "</span><small class=\"chiffres\">+" + nombre(x.plus, 0) + (sens.includes("-") ? " / -" + nombre(x.moins, 0) : "") + '</small></span><span class="x-boutons">' + boutons + "</span></div>", false, false);
      }
    }
    if (c.faites.length) {
      h += "<h2>Faites aujourd'hui <small>" + c.faites.length + "</small></h2>";
      for (const q of c.faites) h += ligne("f:" + q.id, "faite", '<div class="x-carte"><span class="x-case"></span><span class="x-texte"><span>' + e(q.texte) + "</span></span></div>", false, false);
    }
    $("x-liste").innerHTML = h;
    dessinerBandeau();
    Musique.intensite(b.total ? b.faites / b.total : 0);
  }

  function rendreVide() {
    $("x-hud").innerHTML = htmlHud();
    $("x-anneau").innerHTML = "";
    $("x-liste").innerHTML = local()
      ? '<p class="x-vide">La partie n\'a pas encore été chargée. Réessaie dans un instant, ou importe une sauvegarde depuis Sauvegarde.</p>'
      : '<p class="x-vide">Le serveur du jeu n\'est pas joignable, et ce téléphone n\'a encore rien gardé. Vérifie que ton Mac est allumé, que le jeu tourne, et que tu es sur le même Wi-Fi.</p>';
    dessinerBandeau();
  }

  function dessinerBandeau() {
    const zone = $("x-bandeau");
    const file = lireLocal(CLE_FILE, []);
    const vieux = file.filter((g) => g.jour !== aujourdhui());
    let h = "";
    if (!enLigne) {
      h += "<b>Hors ligne.</b> " + (etat ? "Tu vois ton dernier état connu. " : "") + (file.length ? pluriel(file.length, "geste attend", "gestes attendent") + " et partira dès que le jeu répond." : "Tes coches attendront ici, puis partiront toutes seules.");
    } else if (vieux.length) {
      h += "<b>" + pluriel(vieux.length, "geste d'un autre jour n'est pas parti", "gestes d'un autre jour ne sont pas partis") + ".</b> Ils compteront pour aujourd'hui si tu les envoies.";
      h += '<div><button type="button" data-x="file-envoyer">Envoyer quand même</button><button type="button" data-x="file-oublier">Les oublier</button></div>';
    }
    zone.innerHTML = h;
    zone.hidden = !h;
  }

  // ------------------------------------------------------------ retours : gains, combo, fête
  function envol(el, texte, classe) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = doc.createElement("span");
    s.className = "x-vol" + (classe ? " " + classe : "");
    s.textContent = texte;
    s.style.left = Math.max(8, Math.min(racine.innerWidth - 110, r.right - 100)) + "px";
    s.style.top = r.top - 6 + "px";
    doc.body.appendChild(s);
    racine.setTimeout(() => s.remove(), 1200);
  }

  function compterCombo() {
    const t = Date.now();
    combo = t - combo.t < COMBO_MS ? { n: combo.n + 1, t } : { n: 1, t };
    return combo.n;
  }

  function feterGeste(el, n) {
    // La coche monte d'un ton à chaque quête enchaînée (jusqu'à une octave).
    Son.jouer("coche", { ton: Math.min(12, (n - 1) * 2) });
    if (n >= 3 && n % 3 === 0) {
      racine.setTimeout(() => Son.jouer("combo"), 160);
      Haptique.toc("combo");
    } else {
      Haptique.toc("coche");
    }
    const lig = el && el.closest(".x-ligne");
    if (lig) {
      lig.classList.add("faite", "pop");
      const carte = lig.querySelector(".x-carte");
      if (carte) carte.disabled = true;
    }
  }

  function gainsAffiches(el, avant, apres, reponse) {
    if (avant && apres) {
      const xp = nombre(apres.xp, 0) - nombre(avant.xp, 0);
      const or = nombre(apres.or, 0) - nombre(avant.or, 0);
      if (xp > 0) envol(el, "+" + xp + " XP", "xp");
      if (or > 0) racine.setTimeout(() => envol(el, "+" + or + " or"), 220);
      if (xp > 0) racine.setTimeout(() => Son.jouer("xp"), 120);
      if (or > 0) racine.setTimeout(() => Son.jouer("or"), 300);
    } else if (reponse && Array.isArray(reponse.gains)) {
      const pts = reponse.gains.reduce((s, g) => s + nombre(g.points, 0), 0);
      if (pts > 0) envol(el, "+" + pts);
    }
  }

  function verifierFete() {
    const b = bilan();
    if (!b.total || b.faites < b.total || b.c.faites.length + b.c.quotidiennes.length === 0) return;
    const jour = aujourdhui();
    if (lireLocal(CLE_FETE, null) === jour) return;
    ecrireLocal(CLE_FETE, jour);
    feter();
  }

  function feter() {
    Son.jouer("journee");
    Son.ambiance("fete");
    Haptique.toc("journee");
    confettis();
    const serie = etat && etat.partie && etat.partie.serie ? nombre(etat.partie.serie.courante, 0) : 0;
    const voile = doc.createElement("div");
    voile.className = "x-fete";
    voile.setAttribute("role", "dialog");
    voile.setAttribute("aria-label", "Journée bouclée");
    voile.innerHTML = "<div><b>Journée bouclée</b><p>Toutes tes quêtes du jour sont faites." + (serie > 1 ? " Série de " + serie + " jours, garde la flamme." : "") + '</p><button type="button" class="x-btn">Merci, Système</button></div>';
    voile.addEventListener("click", () => {
      voile.remove();
      racine.setTimeout(() => Son.ambiance("elan"), 4000);
    });
    doc.body.appendChild(voile);
  }

  function confettis() {
    const toile = $("x-confettis");
    if (!toile || !toile.getContext || (racine.matchMedia && racine.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    const ctx = toile.getContext("2d");
    const l = (toile.width = racine.innerWidth);
    const h = (toile.height = racine.innerHeight);
    const couleurs = ["#F2C14E", "#D96A4E", "#8DBB6A", "#6FD6C8", "#FBE7A1", "#C55A7B", "#8FB8D6"];
    const bouts = Array.from({ length: 120 }, () => ({ x: l / 2 + (Math.random() - 0.5) * 80, y: h * 0.45, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 14 - 4, t: 4 + Math.random() * 6, c: couleurs[Math.floor(Math.random() * couleurs.length)], r: Math.random() * 6 }));
    const debut = Date.now();
    (function tour() {
      ctx.clearRect(0, 0, l, h);
      for (const b of bouts) {
        b.vy += 0.38;
        b.vx *= 0.99;
        b.x += b.vx;
        b.y += b.vy;
        b.r += 0.2;
        ctx.fillStyle = b.c;
        ctx.fillRect(Math.round(b.x), Math.round(b.y), b.t, Math.max(2, b.t * Math.abs(Math.cos(b.r))));
      }
      if (Date.now() - debut < 2600) racine.requestAnimationFrame(tour);
      else ctx.clearRect(0, 0, l, h);
    })();
  }

  function masquerToast() {
    const t = $("x-toast");
    t.hidden = true;
    t._action = null;
  }

  function afficherToast(texte, action) {
    const t = $("x-toast");
    t.innerHTML = "<span>" + e(texte) + "</span>" + (action ? '<button type="button" data-x="toast">' + e(action.libelle) + "</button>" : "");
    t.hidden = false;
    t._action = action || null;
    if (toastMinuteur) racine.clearTimeout(toastMinuteur);
    toastMinuteur = racine.setTimeout(() => {
      t.hidden = true;
      t._action = null;
    }, action ? 5000 : 3200);
  }

  // ------------------------------------------------------------ gestes
  function ajouterALaFile(geste) {
    const file = lireLocal(CLE_FILE, []);
    if (geste.cle && !geste.cle.startsWith("h:") && file.some((g) => g.cle === geste.cle)) return;
    file.push({ ...geste, jour: aujourdhui(), quand: new Date().toISOString() });
    ecrireLocal(CLE_FILE, file);
    marquerLigne(enLigne);
  }

  // Envoie un geste. Hors ligne : il part dans la file, et l'écran le montre comme fait.
  async function envoyer(geste, el) {
    const avant = etat && etat.systeme ? etat.systeme.hud : null;
    try {
      const reponse = await api("POST", geste.chemin, geste.corps);
      marquerLigne(true);
      const apres = reponse.etat && reponse.etat.systeme ? reponse.etat.systeme.hud : null;
      gainsAffiches(el, avant, apres, reponse);
      racine.setTimeout(() => appliquer(reponse.etat), 650);
      return reponse;
    } catch (err) {
      if (err.code === "RESEAU") {
        marquerLigne(false);
        ajouterALaFile(geste);
        if (geste.cle) locales.add(geste.cle);
        afficherToast("Gardé sur ce téléphone. Il partira au retour du Wi-Fi.");
        dessinerBandeau();
        return null;
      }
      if (geste.cle) locales.delete(geste.cle);
      Son.jouer("erreur");
      Haptique.toc("erreur");
      afficherToast(err.message);
      charger();
      return null;
    }
  }

  async function valider(id, genre, degre, el) {
    const cle = "q:" + id;
    if (locales.has(cle)) return;
    locales.add(cle);
    const n = compterCombo();
    feterGeste(el, n);
    $("x-anneau").innerHTML = htmlAnneau();
    const chemin = (genre === "priorite" ? "/api/priorites/" : "/api/quetes/") + encodeURIComponent(id) + "/valider";
    const reponse = await envoyer({ cle, chemin, corps: degre ? { degre } : {} }, el);
    if (reponse) {
      const q = liste(reponse.etat && reponse.etat.quetes).find((x) => x.id === id) || liste(reponse.etat && reponse.etat.jours).flatMap((j) => liste(j.priorites)).find((x) => x.id === id);
      if (q && q.annulable) {
        afficherToast("Fait.", { libelle: "Annuler", faire: () => annuler(id) });
      }
    }
  }

  async function annuler(id) {
    Son.jouer("doux");
    Haptique.toc("leger");
    combo = { n: Math.max(0, combo.n - 1), t: combo.t };
    await envoyer({ cle: null, chemin: "/api/paiements/" + encodeURIComponent(id) + "/annuler", corps: {} }, null);
  }

  async function reporter(id, el) {
    Son.jouer("doux");
    Haptique.toc("leger");
    const lig = el && el.closest(".x-ligne");
    if (lig) lig.classList.add("part");
    const reponse = await envoyer({ cle: "r:" + id, chemin: "/api/quetes/" + encodeURIComponent(id) + "/reporter", corps: {} }, el);
    if (reponse) afficherToast("À demain.");
  }

  async function cocherQuotidienne(id, el) {
    const cle = "d:" + id;
    if (locales.has(cle)) return;
    locales.add(cle);
    const n = compterCombo();
    feterGeste(el, n);
    racine.setTimeout(() => Son.jouer("quotidienne"), 140);
    $("x-anneau").innerHTML = htmlAnneau();
    await envoyer({ cle, chemin: "/api/systeme/quotidiennes/" + encodeURIComponent(id) + "/cocher", corps: {} }, el);
  }

  async function noterHabitude(id, sens, el) {
    Son.jouer(sens === "-" ? "habitude_moins" : "habitude_plus");
    Haptique.toc(sens === "-" ? "leger" : "coche");
    if (el) {
      el.classList.remove("pop");
      void el.offsetWidth;
      el.closest(".x-ligne").classList.add("pop");
      racine.setTimeout(() => el.closest(".x-ligne") && el.closest(".x-ligne").classList.remove("pop"), 500);
    }
    await envoyer({ cle: "h:" + id + ":" + Date.now(), chemin: "/api/systeme/habitudes/" + encodeURIComponent(id) + "/noter", corps: { sens: sens === "-" ? "-" : "+" } }, el);
  }

  async function ajouter(texte) {
    const propre = String(texte || "").normalize("NFC").trim().slice(0, 160);
    if (!propre) return;
    Son.jouer("clic");
    Haptique.toc("leger");
    const coutEl = $("x-cout");
    const cout = coutEl ? Number(coutEl.value) : undefined;
    await envoyer({ cle: "a:" + propre, chemin: "/api/quetes/ajouter", corps: { texte: propre, cout_energie: cout } }, null);
  }

  // Rejoue la file, dans l'ordre. Un refus du jeu (déjà payé...) retire le geste : il est déjà compté.
  async function vider(memeVieux) {
    if (envoiEnCours) return;
    envoiEnCours = true;
    let envoyes = 0;
    try {
      let file = lireLocal(CLE_FILE, []);
      const jour = aujourdhui();
      for (const geste of file.slice()) {
        if (geste.jour !== jour && !memeVieux) continue;
        try {
          await api("POST", geste.chemin, geste.corps);
          envoyes++;
        } catch (err) {
          if (err.code === "RESEAU") {
            marquerLigne(false);
            break;
          }
          if (!REFUS.has(err.code)) envoyes++;
        }
        file = lireLocal(CLE_FILE, []).filter((g) => !(g.quand === geste.quand && g.chemin === geste.chemin));
        ecrireLocal(CLE_FILE, file);
      }
    } finally {
      envoiEnCours = false;
    }
    if (envoyes) {
      afficherToast(pluriel(envoyes, "geste gardé hors ligne est arrivé", "gestes gardés hors ligne sont arrivés") + " au jeu.");
      Son.jouer("cran");
      try {
        const nouvel = await api("GET", "/api/etat");
        marquerLigne(true);
        appliquer(nouvel);
      } catch (err) {
        marquerLigne(false);
      }
    } else {
      marquerLigne(enLigne);
      dessinerBandeau();
    }
  }

  // ------------------------------------------------------------ degrés (appui long)
  function ouvrirDegres(id) {
    const tous = [...liste(etat && etat.quetes), ...liste(etat && etat.jours).flatMap((j) => liste(j.priorites))];
    const q = tous.find((x) => x.id === id);
    if (!q) return;
    Haptique.toc("leger");
    Son.jouer("clic");
    const degres = Array.isArray(q.degres) && q.degres.length === 3 ? q.degres : ["Commencé pour de bon", "Fait, comme prévu", "Fait, et mieux que prévu"];
    let h = '<div><h3 id="x-degres-titre">' + e(q.texte) + "</h3><p>Quel degré as-tu atteint ?</p>";
    degres.forEach((d, i) => {
      const g = Array.isArray(q.gains) ? q.gains[i] : 0;
      h += '<button type="button" class="x-degre" data-x="degre" data-id="' + e(q.id) + '" data-genre="' + (q.genre === "priorite" ? "priorite" : "ligne") + '" data-degre="' + (i + 1) + '"><b>' + (i + 1) + "</b><span>" + e(d) + '</span><span class="x-gain' + (q.mode === "payee" && g > 0 ? "" : " recit") + '">' + (q.mode === "payee" && g > 0 ? "+" + e(g) : "au journal") + "</span></button>";
    });
    h += '<p class="x-cout-ligne">Coût d\'énergie</p><div class="x-couts">';
    for (let i = 1; i <= 5; i++) {
      h += '<button type="button" class="x-cout' + (nombre(q.cout_energie, 2) === i ? " actif" : "") + '" data-x="cout" data-id="' + e(q.id) + '" data-cout="' + i + '" aria-label="Coût ' + i + '">' + i + "</button>";
    }
    h += "</div>";
    h += '<button type="button" class="x-btn second" data-x="reporter" data-id="' + e(q.id) + '">À demain</button> <button type="button" class="x-btn fermer" data-x="fermer">Fermer</button></div>';
    const f = $("x-degres");
    f.innerHTML = h;
    f.hidden = false;
    masquerToast();
    const premier = f.querySelector(".x-degre");
    if (premier) premier.focus();
  }

  // ------------------------------------------------------------ synchro et téléphone
  async function ouvrirSynchro() {
    Son.jouer("fenetre");
    const f = $("x-panneau");
    const file = lireLocal(CLE_FILE, []);
    const installe = racine.navigator.standalone === true || (racine.matchMedia && racine.matchMedia("(display-mode: standalone)").matches);
    const sw = "serviceWorker" in racine.navigator && racine.isSecureContext;
    const pret = sw && racine.navigator.serviceWorker.controller;
    let appareil = null;
    try {
      appareil = await api("GET", "/api/appareil");
    } catch (err) {
      appareil = null;
    }
    const garde = lireLocal(CLE_ETAT, null);
    const surAppareil = local() || (appareil && appareil.local);
    let h = '<div><h3 id="x-panneau-titre">' + (surAppareil ? "Sauvegarde" : "Synchro et téléphone") + "</h3><dl class=\"x-etat\">";
    if (surAppareil) {
      h += "<dt>Où vit ta partie</dt><dd>Sur cet appareil, dans le navigateur. Rien n'est envoyé ailleurs.</dd>";
      h += "<dt>Hors ligne</dt><dd>" + (pret ? "prêt : l'appli s'ouvre sans réseau" : sw ? "presque prêt : ferme l'appli et rouvre-la une fois" : "l'appli marche, le hors ligne complet vient après l'ajout à l'écran d'accueil") + "</dd>";
    } else {
      h += "<dt>Le jeu</dt><dd>" + (enLigne ? "joignable, tout est à jour" + (file.length ? " (envoi en cours)" : "") : "pas joignable pour l'instant") + "</dd>";
      h += "<dt>En attente</dt><dd>" + (file.length ? pluriel(file.length, "geste", "gestes") : "rien") + "</dd>";
      h += "<dt>Hors ligne</dt><dd>" + (pret ? "prêt : l'appli s'ouvre sans Wi-Fi" : sw ? "presque prêt : rouvre l'appli une fois" : racine.isSecureContext ? "indisponible dans ce navigateur" : "seulement en https (voir IPHONE.md), sinon il faut le Mac allumé") + "</dd>";
    }
    h += "<dt>Installée</dt><dd>" + (installe ? "oui, sur l'écran d'accueil" : "non : dans Safari, Partager, puis « Sur l'écran d'accueil »") + "</dd>";
    if (garde && garde.garde_le) h += "<dt>Dernier état</dt><dd>" + e(new Date(garde.garde_le).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })) + "</dd>";
    h += "</dl>";
    if (!surAppareil && appareil && appareil.adresses && appareil.adresses.length) {
      h += "<p><b>Ouvrir sur un autre appareil du même Wi-Fi :</b></p><p>" + appareil.adresses.slice(0, 3).map((a) => "<code>" + e(a) + "/express.html</code>").join("<br>") + "</p>";
      if (racine.QR) h += '<p class="x-qr" data-qr="' + e(appareil.adresses[0] + "/express.html") + '"></p>';
    } else if (!surAppareil && appareil) {
      h += "<p>Le réseau local est fermé : seul ce Mac voit le jeu. Pour le téléphone, relance avec <code>./lancer.sh --https</code> (voir IPHONE.md).</p>";
    }
    if (appareil && appareil.certificat) h += '<p><a class="x-btn second" href="' + e(appareil.certificat) + '">Installer l\'autorité du jeu (iPhone, une fois)</a></p>';
    h += "<h3>Un fichier, sans compte</h3><p>Exporte ta partie, range le fichier où tu veux (Drive, coffre, un autre téléphone). L'import remplace la partie de cet appareil : l'ancienne est mise de côté, tu pourras la reprendre.</p>";
    if (!DATE && !DEMO) {
      h += '<button type="button" class="x-btn" data-x="exporter">Exporter ma partie</button>';
      h += '<label class="x-btn second">Importer un fichier<input type="file" accept="application/json,.json" data-x="importer" hidden></label>';
    } else {
      h += "<p>(Pas de sauvegarde en mode démo ou date simulée.)</p>";
    }

    h += "<h3>Retours</h3>";
    h += '<button type="button" class="x-btn second" data-x="musique">' + (Son.reglages().musique_active ? "Couper la musique" : "Lancer la musique") + "</button>";
    h += '<button type="button" class="x-btn second" data-x="vibrer">' + (Haptique.actif() ? "Couper les vibrations" : "Activer les vibrations") + "</button>";
    if (file.length) h += '<button type="button" class="x-btn second" data-x="file-envoyer">Envoyer les gestes en attente</button>';
    h += '<p><button type="button" class="x-btn fermer" data-x="fermer">Fermer</button></p></div>';
    f.innerHTML = h;
    f.hidden = false;
    masquerToast();
    for (const zone of f.querySelectorAll("[data-qr]")) {
      try {
        const toile = racine.QR.canvas(zone.dataset.qr, { module: 5 });
        toile.setAttribute("role", "img");
        toile.setAttribute("aria-label", "QR code : " + zone.dataset.qr);
        zone.appendChild(toile);
      } catch (err) {
        zone.remove();
      }
    }
  }

  async function importer(fichier) {
    if (!fichier) return;
    let objet;
    try {
      objet = JSON.parse(await fichier.text());
    } catch (err) {
      afficherToast("Ce fichier n'est pas une sauvegarde lisible.");
      return;
    }
    const quand = objet && objet.cree_le ? new Date(objet.cree_le).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "date inconnue";
    if (!racine.confirm("Remplacer ta partie par la sauvegarde du " + quand + " ? Ta partie actuelle sera mise de côté sur cet appareil.")) return;
    try {
      const r = await api("POST", "/api/sauvegarde/importer", { sauvegarde: objet });
      Son.jouer("jalon");
      afficherToast("Sauvegarde importée. L'ancienne partie a été mise de côté.");
      fermerFeuilles();
      appliquer(r.etat);
    } catch (err) {
      Son.jouer("erreur");
      afficherToast(err.code === "RESEAU" ? "Il faut que le jeu soit joignable pour importer." : err.message);
    }
  }

  async function exporter() {
    try {
      const reponse = await racine.fetch(adresse("/api/sauvegarde"), { method: "GET", cache: "no-store" });
      if (!reponse.ok) throw new Error("Export impossible pour le moment.");
      const blob = await reponse.blob();
      const nom = (reponse.headers.get("X-Jeu-Nom-Fichier") || "jeu-de-quetes.json").replace(/[^a-zA-Z0-9._-]/g, "-");
      const url = URL.createObjectURL(blob);
      const a = doc.createElement("a");
      a.href = url;
      a.download = nom;
      doc.body.appendChild(a);
      a.click();
      a.remove();
      racine.setTimeout(() => URL.revokeObjectURL(url), 2000);
      Son.jouer("jalon");
      afficherToast("Fichier prêt. Range-le où tu veux, par exemple sur Drive.");
    } catch (err) {
      Son.jouer("erreur");
      afficherToast(err.message || "Export impossible.");
    }
  }

  function ouvrirEnergie() {
    const eg = etat && etat.energie;
    if (!eg || !eg.actif || !Array.isArray(eg.niveaux) || !eg.niveaux.length) return;
    Son.jouer("fenetre");
    const f = $("x-panneau");
    let h = '<div><h3 id="x-panneau-titre">Comment tu te sens aujourd\'hui ?</h3>';
    h += "<p>Le jeu te proposera les quêtes qui collent. Tu pourras changer d'avis plus tard, et régler le coût de chaque quête.</p>";
    for (const n of eg.niveaux) {
      const on = eg.choisi && eg.choisi.id === n.id;
      h += '<button type="button" class="x-energie-choix' + (on ? " actif" : "") + '" data-x="choix-energie" data-niveau="' + e(n.id) + '"><b>' + e(n.titre) + "</b><span>jusqu'au coût " + e(n.cout_max) + (n.aide ? " · " + e(n.aide) : "") + "</span></button>";
    }
    h += '<p><button type="button" class="x-btn fermer" data-x="fermer">Plus tard</button></p></div>';
    f.innerHTML = h;
    f.hidden = false;
    masquerToast();
    const premier = f.querySelector(".x-energie-choix");
    if (premier) premier.focus();
  }

  async function choisirEnergie(niveau) {
    fermerFeuilles();
    Son.jouer("clic");
    Haptique.toc("reussite");
    try {
      const r = await api("POST", "/api/energie", { niveau: niveau });
      appliquer(r.etat);
    } catch (err) {
      Son.jouer("erreur");
      afficherToast(err.message);
    }
  }

  async function definirCout(id, cout) {
    fermerFeuilles();
    try {
      const r = await api("POST", "/api/quetes/" + encodeURIComponent(id) + "/energie", { cout: Number(cout) });
      Son.jouer("cran");
      appliquer(r.etat);
    } catch (err) {
      Son.jouer("erreur");
      afficherToast(err.message);
    }
  }

  function fermerFeuilles() {
    $("x-degres").hidden = true;
    $("x-panneau").hidden = true;
  }

  // ------------------------------------------------------------ toucher : appui, appui long, glisser
  let suivi = null;
  let ignorerClicJusqua = 0;

  doc.addEventListener("pointerdown", (ev) => {
    const carte = ev.target.closest('.x-carte[data-geste="quete"], .x-carte[data-geste="quotidienne"]');
    if (!carte || carte.disabled || ev.button > 0) return;
    suivi = { carte, x: ev.clientX, y: ev.clientY, dx: 0, glisse: false, long: false, id: ev.pointerId };
    if (carte.dataset.geste === "quete") {
      suivi.minuteur = racine.setTimeout(() => {
        if (!suivi || suivi.glisse) return;
        suivi.long = true;
        ignorerClicJusqua = Date.now() + 5000; // jusqu'au lever du doigt (voir finSuivi)
        ouvrirDegres(carte.dataset.id);
      }, APPUI_LONG_MS);
    }
  });
  doc.addEventListener("pointermove", (ev) => {
    if (!suivi || ev.pointerId !== suivi.id) return;
    const dx = ev.clientX - suivi.x;
    const dy = ev.clientY - suivi.y;
    if (!suivi.glisse && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      suivi.glisse = true;
      racine.clearTimeout(suivi.minuteur);
      suivi.carte.classList.add("glisse");
      try {
        suivi.carte.setPointerCapture(ev.pointerId);
      } catch (err) {
        // pas de capture : le glisser marche quand même tant que le doigt reste sur la carte
      }
    } else if (!suivi.glisse && Math.abs(dy) > 12) {
      racine.clearTimeout(suivi.minuteur); // on fait défiler la liste
    }
    if (suivi.glisse) {
      const limite = suivi.carte.dataset.geste === "quete" ? -160 : 0;
      suivi.dx = Math.max(limite, Math.min(160, dx));
      suivi.carte.style.transform = "translateX(" + suivi.dx + "px)";
      if (!suivi.passe && Math.abs(suivi.dx) >= SEUIL_GLISSE) {
        suivi.passe = true;
        Haptique.toc("leger");
      } else if (suivi.passe && Math.abs(suivi.dx) < SEUIL_GLISSE) suivi.passe = false;
    }
  });
  function finSuivi(ev, annule) {
    if (!suivi || (ev && ev.pointerId !== suivi.id)) return;
    const s = suivi;
    suivi = null;
    racine.clearTimeout(s.minuteur);
    if (s.long) ignorerClicJusqua = Date.now() + 400; // seul le clic du lever du doigt est ignoré (voir « click »)
    if (!s.glisse) return;
    ignorerClicJusqua = Date.now() + 400;
    s.carte.classList.remove("glisse");
    s.carte.style.transform = "";
    if (annule) return;
    const d = s.carte.dataset;
    if (s.dx >= SEUIL_GLISSE) {
      if (d.geste === "quete") valider(d.id, d.genre, null, s.carte);
      else cocherQuotidienne(d.id, s.carte);
    } else if (s.dx <= -SEUIL_GLISSE && d.geste === "quete") {
      reporter(d.id, s.carte);
    }
  }
  doc.addEventListener("pointerup", (ev) => finSuivi(ev, false));
  doc.addEventListener("pointercancel", (ev) => finSuivi(ev, true));
  doc.addEventListener("contextmenu", (ev) => {
    if (ev.target.closest(".x-carte")) ev.preventDefault();
  });

  doc.addEventListener("click", (ev) => {
    // Juste après un appui long ou un glisser, le clic qui suit (sous le doigt) ne compte pas :
    // il fermerait la feuille des degrés qui vient de s'ouvrir, ou cocherait une seconde fois.
    if (Date.now() < ignorerClicJusqua) {
      ignorerClicJusqua = 0; // un seul clic avalé : le suivant (choisir un degré) compte
      ev.preventDefault();
      return;
    }
    const el = ev.target.closest("[data-geste], [data-x]");
    if (!el) {
      if (ev.target.classList && ev.target.classList.contains("x-feuille")) fermerFeuilles();
      return;
    }
    const d = el.dataset;
    if (d.geste === "quete") return valider(d.id, d.genre, null, el);
    if (d.geste === "quotidienne") return cocherQuotidienne(d.id, el);
    if (d.geste === "habitude") return noterHabitude(d.id, d.sens, el);
    switch (d.x) {
      case "degre":
        fermerFeuilles();
        return valider(d.id, d.genre, Number(d.degre), doc.querySelector('.x-carte[data-id="' + CSS.escape(d.id) + '"]'));
      case "reporter":
        fermerFeuilles();
        return reporter(d.id, doc.querySelector('.x-carte[data-id="' + CSS.escape(d.id) + '"]'));
      case "fermer":
        return fermerFeuilles();
      case "synchro":
        return ouvrirSynchro();
      case "exporter":
        return exporter();
      case "energie":
        return ouvrirEnergie();
      case "choix-energie":
        return choisirEnergie(d.niveau);
      case "cout":
        return definirCout(d.id, d.cout);
      case "son": {
        const oui = !Son.actif;
        ecrireLocal(CLE_SON, oui);
        Son.activer(oui);
        if (oui) {
          Son.ambiance("elan");
          Son.jouer("clic");
        }
        el.setAttribute("aria-pressed", oui ? "true" : "false");
        el.textContent = oui ? "Son" : "Muet";
        return;
      }
      case "musique":
        Son.musique(!Son.reglages().musique_active);
        return ouvrirSynchro();
      case "vibrer":
        Haptique.activer(!Haptique.actif());
        Haptique.toc("reussite");
        return ouvrirSynchro();
      case "file-envoyer":
        fermerFeuilles();
        return vider(true);
      case "file-oublier": {
        const jour = aujourdhui();
        ecrireLocal(CLE_FILE, lireLocal(CLE_FILE, []).filter((g) => g.jour === jour));
        marquerLigne(enLigne);
        return dessiner();
      }
      case "toast": {
        const t = $("x-toast");
        const a = t._action;
        t.hidden = true;
        t._action = null;
        if (a && a.faire) a.faire();
        return;
      }
      default:
        return;
    }
  });
  doc.addEventListener("change", (ev) => {
    if (ev.target && ev.target.dataset && ev.target.dataset.x === "importer") importer(ev.target.files && ev.target.files[0]);
  });
  doc.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") fermerFeuilles();
  });
  $("x-ajout").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const champ = ev.target.querySelector("input");
    const texte = champ.value;
    champ.value = "";
    champ.blur();
    ajouter(texte);
  });

  // ------------------------------------------------------------ cycle de vie
  racine.addEventListener("online", () => charger());
  racine.addEventListener("offline", () => {
    marquerLigne(false);
    dessinerBandeau();
  });
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "visible") charger();
  });
  racine.setInterval(() => {
    if (doc.visibilityState !== "hidden") charger();
  }, 30000);

  // L'ambiance du mode express, dès que le son est permis (premier toucher).
  Son.ambiance("elan");

  if ("serviceWorker" in racine.navigator && racine.isSecureContext && params.get("sw") !== "0") {
    racine.navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  // Le dernier état connu s'affiche tout de suite, puis le serveur prend la main.
  const garde = lireLocal(CLE_ETAT, null);
  if (garde && garde.etat) {
    etat = garde.etat;
    dessiner();
  }
  charger();

  racine.Express = { charger, vider, _etat: () => etat, _file: () => lireLocal(CLE_FILE, []) };
})(window);
