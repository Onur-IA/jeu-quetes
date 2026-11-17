"use strict";
// Téléphone : la feuille « Jour » sous l'immeuble, et la barre d'onglets du bas (Jour, Système, Quêtes, Plus).
// Tout se fait au pouce, sans survol. Sur ordinateur (760 px de large et plus), ce module ne dessine rien.
// Chargé avant app.js : les petites icônes de la barre sont dessinées avec le reste de la page.
// app.js appelle Mobile.rendre(etat) à chaque nouvel état du jeu.
(function (racine) {
  const conteneur = document.getElementById("mobile");
  if (!conteneur) {
    racine.Mobile = { rendre() {}, estMobile: () => false };
    return;
  }
  const ETROIT = racine.matchMedia ? racine.matchMedia("(max-width: 759.98px)") : { matches: false };
  const APPUI_LONG_MS = 500;

  // Les autres panneaux, rangés dans « Plus ».
  const AUTRES = [
    ["journal", "Journal", "icone-journal"],
    ["equipe", "Équipe", "icone-equipe"],
    ["encaissements", "Argent", "icone-argent"],
    ["boutique", "Boutique", "icone-boutique"],
    ["carte", "Carte", "icone-carte"],
    ["trophees", "Collection", "icone-trophees"],
    ["etat", "Comment je me sens ?", "icone-etat"],
  ];

  let etat = null;
  let degreOuvert = null; // quête dont les trois degrés sont dépliés
  let plusOuvert = false;
  let occupe = false; // un geste est en route vers le serveur
  let premierRendu = true;
  let appuiLong = null;
  let appuiLongFait = 0;
  const dernier = { hud: null, feuille: null, plus: null };

  function e(texte) {
    return String(texte == null ? "" : texte).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function nombre(v, defaut) {
    return typeof v === "number" && Number.isFinite(v) ? v : defaut;
  }
  function liste(v) {
    return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
  }
  function pluriel(n, un, plusieurs) {
    return n + " " + (n > 1 ? plusieurs : un);
  }
  function sprite(nom, z) {
    return '<span class="pix" data-sprite="' + e(nom) + '" data-z="' + (z || 2) + '"></span>';
  }
  function estMobile() {
    return Boolean(ETROIT.matches);
  }

  // Dessine les petites icônes (même catalogue que le reste du jeu).
  function hydrater(zone) {
    const Meubles = racine.Meubles;
    if (!Meubles || !Meubles.sprite) return;
    for (const el of zone.querySelectorAll("[data-sprite]")) {
      const s = Meubles.sprite(el.dataset.sprite, {});
      if (!s) continue;
      const z = Number(el.dataset.z || 2);
      const c = document.createElement("canvas");
      c.width = s.width;
      c.height = s.height;
      c.getContext("2d").drawImage(s, 0, 0);
      c.style.width = s.width * z + "px";
      c.style.height = s.height * z + "px";
      el.replaceChildren(c);
    }
  }

  // ------------------------------------------------------------ squelette (une fois)
  conteneur.innerHTML =
    '<div id="mobile-etat" aria-live="polite"></div>' +
    '<div id="mobile-feuille" tabindex="-1" aria-label="La boucle du jour"></div>' +
    '<div id="mobile-plus" hidden aria-label="Plus"></div>' +
    '<nav id="mobile-barre" aria-label="Navigation">' +
    '<button type="button" class="m-onglet actif" data-m="onglet" data-onglet="jour">' + sprite("icone-etoile", 2) + "<span>Jour</span></button>" +
    '<button type="button" class="m-onglet" data-m="onglet" data-onglet="systeme">' + sprite("icone-systeme", 2) + "<span>Système</span></button>" +
    '<button type="button" class="m-onglet" data-m="onglet" data-onglet="quetes">' + sprite("icone-quetes", 2) + "<span>Quêtes</span></button>" +
    '<button type="button" class="m-onglet" data-m="onglet" data-onglet="plus">' + sprite("icone-plus", 2) + "<span>Plus</span></button>" +
    "</nav>";
  const zoneEtat = document.getElementById("mobile-etat");
  const feuille = document.getElementById("mobile-feuille");
  const zonePlus = document.getElementById("mobile-plus");

  // ------------------------------------------------------------ 1. bandeau d'état
  function jauge(classe, libelle, valeur, maximum) {
    const max = Math.max(1, nombre(maximum, 1));
    const v = Math.max(0, Math.min(max, nombre(valeur, 0)));
    return '<div class="m-jauge ' + classe + '" role="progressbar" aria-label="' + e(libelle) + '" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + v + '"><i style="width:' + Math.round((v / max) * 100) + '%"></i><span class="chiffres">' + e(libelle) + " " + v + " sur " + max + "</span></div>";
  }

  function htmlEtat() {
    if (!etat) return '<div class="m-ligne"><b class="m-niveau">Jeu de quêtes</b></div>';
    const points = etat.partie ? nombre(etat.partie.points, 0) : 0;
    const hud = etat.systeme && typeof etat.systeme === "object" && etat.systeme.hud && typeof etat.systeme.hud === "object" ? etat.systeme.hud : null;
    if (hud) {
      const rang = hud.rang && typeof hud.rang === "object" ? hud.rang.nom || hud.rang.id || "" : hud.rang;
      let h = '<div class="m-ligne"><b class="m-niveau">Niveau ' + e(nombre(hud.niveau, 1)) + (rang !== undefined && rang !== null && rang !== "" ? ' <span class="m-rang">Rang ' + e(rang) + "</span>" : "") + "</b>";
      h += '<span class="m-bourse chiffres">';
      if (hud.or !== undefined && hud.or !== null) h += '<span class="m-or" title="Or">' + e(nombre(hud.or, 0)) + " or</span>";
      h += '<span class="m-points">' + points + " points</span></span></div>";
      h += '<div class="m-jauges">' + jauge("xp", "XP", hud.xp_niveau, hud.xp_suivant) + jauge("pv", "PV", hud.pv, hud.pv_max) + "</div>";
      return h;
    }
    // Sans le Système : les points et le niveau de l'immeuble.
    const n = etat.niveau && typeof etat.niveau === "object" ? etat.niveau : null;
    let h = '<div class="m-ligne"><b class="m-niveau">' + (n ? "Niveau " + e(n.rang) + ' <span class="m-rang">' + e(n.nom) + "</span>" : "Jeu de quêtes") + '</b><span class="m-bourse chiffres"><span class="m-points">' + points + " points</span></span></div>";
    if (n) h += '<div class="m-jauges seule"><div class="m-jauge xp" role="progressbar" aria-label="Progression du niveau" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + nombre(n.progression, 0) + '"><i style="width:' + Math.max(0, Math.min(100, nombre(n.progression, 0))) + '%"></i></div></div>';
    return h;
  }

  // ------------------------------------------------------------ 2 à 5. la feuille du jour
  function htmlNotifications(systeme) {
    return liste(systeme.notifications).slice(0, 2) // les deux dernières : la suite est dans le fil du panneau Système
      .map((n) => '<div class="fenetre-systeme fixe genre-' + e(String(n.genre || "info").replace(/[^a-z0-9-]/gi, "")) + '" data-notification="' + e(n.id) + '"><b>' + e(n.titre || "Système") + "</b>" + (n.texte ? "<p>" + e(n.texte) + "</p>" : "") + "</div>")
      .join("");
  }

  function gain(q) {
    if (q.mode === "racontee") return '<span class="puce journal">au journal</span>';
    const g = Array.isArray(q.gains) ? q.gains : [];
    if (!g.length) return "";
    if (g.every((x) => x === 0)) return '<span class="puce journal">plafond : au journal</span>';
    const defaut = etat.config && etat.config.points ? nombre(etat.config.points.degre_defaut, 2) : 2;
    const v = g[Math.max(0, Math.min(g.length - 1, defaut - 1))];
    return '<span class="puce points chiffres">+' + e(v) + "</span>";
  }

  function htmlQuete(q) {
    const genre = q.genre === "priorite" ? "priorite" : "ligne";
    const ouvert = degreOuvert === q.id;
    let h = '<div class="m-quete' + (ouvert ? " ouverte" : "") + '" data-quete="' + e(q.id) + '">';
    h += '<button type="button" class="m-case" data-m="valider" data-long="1" data-genre="' + genre + '" data-id="' + e(q.id) + '" aria-label="C\'est fait : ' + e(q.texte) + '"></button>';
    h += '<div class="m-texte"><span>' + e(q.texte) + '</span><span class="m-infos">' + (q.nom_type ? '<span class="puce type-' + e(q.type_quete) + '">' + e(q.nom_type) + "</span>" : "") + gain(q) + "</span></div>";
    h += '<button type="button" class="m-degres' + (ouvert ? " actif" : "") + '" data-m="degres" data-id="' + e(q.id) + '" aria-expanded="' + (ouvert ? "true" : "false") + '" aria-label="Choisir le degré atteint">' + sprite("icone-etoile", 2) + "</button>";
    if (ouvert) {
      const degres = Array.isArray(q.degres) ? q.degres : ["Commencé pour de bon", "Fait, comme prévu", "Fait, et mieux que prévu"];
      h += '<div class="m-choix"><span class="petit">Quel degré as-tu atteint ?</span>';
      for (let i = 0; i < 3; i++) {
        const g = Array.isArray(q.gains) ? q.gains[i] : 0;
        const paye = q.mode === "payee" && g > 0;
        h += '<button type="button" class="m-degre" data-m="valider" data-genre="' + genre + '" data-id="' + e(q.id) + '" data-degre="' + (i + 1) + '"><b>' + (i + 1) + '</b><span class="m-libelle">' + e(degres[i] || "") + '</span><span class="puce ' + (paye ? "points" : "journal") + ' chiffres">' + (paye ? "+" + g : "au journal") + "</span></button>";
      }
      h += "</div>";
    }
    return h + "</div>";
  }

  function htmlQuetes() {
    const jours = liste(etat.jours);
    const tous = [...jours.flatMap((j) => liste(j.priorites)), ...liste(etat.quetes)];
    const parId = new Map(tous.map((q) => [q.id, q]));
    const duJour = etat.du_jour && typeof etat.du_jour === "object" ? etat.du_jour : {};
    const visibles = (Array.isArray(duJour.visibles) ? duJour.visibles : []).map((id) => parId.get(id)).filter(Boolean);
    const faites = (Array.isArray(duJour.faites) ? duJour.faites : []).map((id) => parId.get(id)).filter(Boolean);
    let h = "";
    const k = etat.contrat;
    if (k && k.ouvert && k.a_choisir) {
      h += '<div class="carte sombre m-appel"><div><b>Ton contrat du jour</b><span>Un sûr, un ambitieux. À toi de choisir.</span></div><button type="button" class="bouton" data-action="contrat-matin">Choisir</button></div>';
    } else if (k && k.ouvert && k.du_jour && k.du_jour.statut === "en_cours") {
      const lignes = [...(k.du_jour.vedette ? [k.du_jour.vedette] : []), ...liste(k.du_jour.quetes)];
      h += '<p class="m-contrat"><span class="puce points chiffres">' + lignes.filter((q) => q.faite).length + " sur " + lignes.length + "</span> " + (k.du_jour.choix === "ambitieux" ? "Contrat ambitieux en cours" + (k.du_jour.heure_limite_libelle ? ", avant " + e(k.du_jour.heure_limite_libelle) : "") : "Contrat sûr en cours") + ".</p>";
    }
    if (etat.dimanche && etat.dimanche.disponible) {
      h += '<div class="carte sombre m-appel"><div><b>La revue de la semaine</b><span>Trois chiffres, une leçon.</span></div><button type="button" class="bouton" data-action="dimanche">Ouvrir</button></div>';
    }
    h += "<h2>Quêtes du jour <small>" + (faites.length ? pluriel(faites.length, "faite", "faites") : "à toi de jouer") + "</small></h2>";
    if (visibles.length) h += visibles.map(htmlQuete).join("");
    else h += '<p class="vide">' + (faites.length ? "Plus rien d'ouvert pour aujourd'hui. Belle journée." : "Aucune quête pour l'instant. Écris-en une ci-dessous.") + "</p>";
    if (nombre(duJour.reserve, 0) > 0) h += '<p class="petit">' + pluriel(duJour.reserve, "autre quête attend", "autres quêtes attendent") + " en réserve. Une de faite, une de plus à l'écran.</p>";
    h += '<form class="m-ajout" data-formulaire="quete"><input type="text" name="texte" maxlength="160" autocomplete="off" enterkeyhint="done" placeholder="Écrire une quête..." aria-label="Écrire une quête"><button type="submit" class="bouton">Ajouter</button></form>';
    if (faites.length) {
      h += '<ul class="m-faites">' + faites.map((q) => "<li>" + e(q.texte) + "</li>").join("") + "</ul>";
    }
    return h;
  }

  function htmlQuotidiennes(systeme) {
    const quotidiennes = liste(systeme.quotidiennes);
    if (!quotidiennes.length) return "";
    const faites = quotidiennes.filter((q) => q.faite).length;
    let h = "<h2>Quotidiennes <small>" + faites + " sur " + quotidiennes.length + "</small></h2>";
    for (const q of quotidiennes) {
      h += '<div class="m-quete m-quotidienne' + (q.faite ? " faite" : "") + '">';
      h += q.faite
        ? '<span class="m-case cochee" aria-label="Fait"></span>'
        : '<button type="button" class="m-case" data-m="quotidienne" data-id="' + e(q.id) + '" aria-label="C\'est fait : ' + e(q.texte) + '"></button>';
      h += '<div class="m-texte"><span>' + e(q.texte) + "</span>" + (nombre(q.serie, 0) > 0 ? '<span class="m-infos"><span class="puce effort chiffres">série de ' + pluriel(q.serie, "jour", "jours") + "</span></span>" : "") + "</div></div>";
    }
    return h;
  }

  function htmlHabitudes(systeme) {
    const habitudes = liste(systeme.habitudes);
    if (!habitudes.length) return "";
    let h = "<h2>Habitudes <small>au fil de la journée</small></h2>";
    for (const x of habitudes) {
      const sens = typeof x.sens === "string" ? x.sens : "+";
      h += '<div class="m-habitude"><div class="m-texte"><span>' + e(x.texte) + '</span><span class="m-infos chiffres">';
      if (sens.includes("+")) h += '<span class="puce effort">+' + nombre(x.plus, 0) + "</span>";
      if (sens.includes("-")) h += '<span class="puce">-' + nombre(x.moins, 0) + "</span>";
      h += '</span></div><div class="m-boutons">';
      if (sens.includes("-")) h += '<button type="button" class="m-note moins" data-m="habitude" data-sens="-" data-id="' + e(x.id) + '" aria-label="Noter un moins : ' + e(x.texte) + '">-</button>';
      if (sens.includes("+")) h += '<button type="button" class="m-note plus" data-m="habitude" data-sens="+" data-id="' + e(x.id) + '" aria-label="Noter un plus : ' + e(x.texte) + '">+</button>';
      h += "</div></div>";
    }
    return h;
  }

  function htmlPenalite(systeme) {
    const p = systeme.penalite;
    if (!p || typeof p !== "object") return "";
    let h = '<div class="m-penalite"><b>Zone de rattrapage</b><span>Rien de grave. Un petit défi pour repartir du bon pied, à ton rythme.</span>';
    if (p.texte) h += "<p>" + e(p.texte) + "</p>";
    const fait = nombre(p.fait, null);
    const aFaire = nombre(p.a_faire, null);
    if (fait !== null && aFaire !== null && aFaire > 0) {
      h += '<span class="mini-jauge"><span style="width:' + Math.round((Math.max(0, Math.min(aFaire, fait)) / aFaire) * 100) + '%"></span></span><span class="petit chiffres">' + Math.min(fait, aFaire) + " sur " + aFaire + (fait >= aFaire ? ". C'est fait, bravo." : "") + "</span>";
    } else if (typeof p.a_faire === "string" && p.a_faire) {
      h += '<span class="petit">' + e(p.a_faire) + "</span>";
    }
    return h + "</div>";
  }

  // L'événement du jour quand il laisse le choix : deux grands boutons.
  function htmlEvenement(systeme) {
    const ev = systeme.studio && systeme.studio.evenement;
    if (!ev || !Array.isArray(ev.choix) || ev.choisi !== null) return "";
    let h = '<div class="m-defi"><b>' + e(ev.titre) + "</b><span>" + e(ev.texte) + '</span><div class="sys-choix">';
    ev.choix.forEach((c, i) => {
      h += '<button type="button" class="bouton second" data-sys="evenement/choisir" data-corps=\'{"choix":' + i + "}'><b>" + e(c.libelle) + "</b><small>" + e(c.effet) + "</small></button>";
    });
    return h + "</div></div>";
  }

  // Le défi du jour du Système : quelques quêtes, une récompense connue d'avance.
  function htmlDefi(systeme) {
    const d = systeme.defi;
    if (!d || typeof d !== "object" || !(nombre(d.objectif, 0) > 0)) return "";
    const fait = Math.max(0, Math.min(d.objectif, nombre(d.fait, 0)));
    return '<div class="m-defi' + (d.reussi ? " reussi" : "") + '"><b>Défi du jour' + (d.reussi ? " : réussi" : "") + '</b><span class="mini-jauge"><span style="width:' + Math.round((fait / d.objectif) * 100) + '%"></span></span><span class="petit chiffres">' + fait + " sur " + d.objectif + (d.reussi ? ". Récompense reçue." : " quêtes. À la clé : " + nombre(d.or, 0) + " or" + (d.butin ? " et un butin." : ".")) + "</span></div>";
  }

  function htmlFeuille() {
    if (!etat) {
      return document.documentElement.dataset.reseau === "hors-ligne"
        ? '<div class="m-penalite"><b>Hors ligne</b><span>Le serveur du jeu n\'est pas joignable. Vérifie que ton Mac est allumé, que le jeu tourne et que tu es sur le même Wi-Fi.</span></div>'
        : '<p class="vide">Le jeu se prépare...</p>';
    }
    const systeme = etat.systeme && typeof etat.systeme === "object" ? etat.systeme : {};
    let h = "";
    try {
      const aRepartir = systeme.hud && typeof systeme.hud === "object" ? nombre(systeme.hud.points_stats, 0) : 0;
      if (aRepartir > 0) h += '<button type="button" class="m-a-repartir" data-m="onglet" data-onglet="systeme">' + pluriel(aRepartir, "point à répartir", "points à répartir") + " dans le Système</button>";
      h += htmlNotifications(systeme);
      h += htmlPenalite(systeme);
      h += htmlEvenement(systeme);
      h += htmlDefi(systeme);
      h += htmlQuetes();
      h += htmlQuotidiennes(systeme);
      h += htmlHabitudes(systeme);
    } catch (err) {
      h += '<p class="vide">Cette feuille n\'a pas pu s\'afficher en entier. Ouvre l\'onglet Quêtes.</p>';
    }
    return h;
  }

  // ------------------------------------------------------------ « Plus » : les autres panneaux
  function htmlPlus() {
    const P = racine.Panneaux;
    let h = "<h2>Plus</h2><div class=\"m-menu\">";
    // Version 5 : le mode express, pour cocher en deux secondes (et hors ligne).
    h += '<a class="m-entree" href="express.html">' + sprite("icone-quetes", 2) + "<span>Mode express<small>cocher en deux secondes</small></span></a>";
    for (const [panneau, nom, icone] of AUTRES) {
      if (panneau === "etat" && !(etat && etat.strategies && Array.isArray(etat.strategies.etats) && etat.strategies.etats.length)) continue;
      const fonction = P && P.FONCTION_DE ? P.FONCTION_DE[panneau] : null;
      const ferme = Boolean(etat && fonction && P.ouvert && !P.ouvert(etat, fonction));
      const jour = ferme && etat.fonctions && etat.fonctions.fonctions[fonction] ? etat.fonctions.fonctions[fonction].jour : null;
      h += '<button type="button" class="m-entree' + (ferme ? " verrou" : "") + '" data-action="panneau" data-panneau="' + panneau + '">' + sprite(icone, 2) + "<span>" + e(nom) + (jour ? "<small>au jour " + e(jour) + "</small>" : "") + "</span></button>";
    }
    h += '<button type="button" class="m-entree" data-action="reglages">' + sprite("icone-reglages", 2) + "<span>Réglages</span></button>";
    h += "</div><h2>L'immeuble</h2><div class=\"m-menu\">";
    h += '<button type="button" class="m-entree" data-action="vue" data-vue="lieu">' + sprite("icone-immeuble", 2) + "<span>Mon bureau</span></button>";
    h += '<button type="button" class="m-entree" data-action="vue" data-vue="immeuble">' + sprite("icone-immeuble", 2) + "<span>Tout l'immeuble</span></button>";
    h += '<button type="button" class="m-entree" data-action="son">' + sprite("icone-son", 2) + "<span>Son : activer ou couper</span></button>";
    h += '<button type="button" class="m-entree" data-action="mixage">' + sprite("icone-musique", 2) + "<span>Musique et volumes</span></button>";
    h += '<button type="button" class="m-entree" data-action="rafraichir">' + sprite("icone-rafraichir", 2) + "<span>Relire mes quêtes</span></button>";
    return h + "</div>";
  }

  // ------------------------------------------------------------ dessin
  function panneauCourant() {
    const p = document.getElementById("panneau");
    const c = document.getElementById("contenu");
    if (!p || p.classList.contains("ferme") || !c) return null;
    return c.dataset.panneau || null;
  }

  function majOnglets() {
    const panneau = estMobile() ? panneauCourant() : null;
    const actif = plusOuvert ? "plus" : !panneau ? "jour" : panneau === "systeme" || panneau === "quetes" ? panneau : "plus";
    for (const b of conteneur.querySelectorAll(".m-onglet")) {
      const oui = b.dataset.onglet === actif;
      b.classList.toggle("actif", oui);
      if (oui) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    }
    zonePlus.hidden = !plusOuvert;
  }

  function dessiner() {
    if (!estMobile()) return;
    const hud = htmlEtat();
    if (hud !== dernier.hud) {
      zoneEtat.innerHTML = hud;
      dernier.hud = hud;
    }
    // pas de redessin pendant que tu écris une quête
    const champ = document.activeElement;
    const saisie = champ && feuille.contains(champ) && champ.tagName === "INPUT";
    if (!saisie) {
      const html = htmlFeuille();
      if (html !== dernier.feuille) {
        const brouillon = feuille.querySelector(".m-ajout input");
        const texte = brouillon ? brouillon.value : "";
        const defilement = feuille.scrollTop;
        feuille.innerHTML = html;
        dernier.feuille = html;
        hydrater(feuille);
        const nouveau = feuille.querySelector(".m-ajout input");
        if (nouveau && texte) nouveau.value = texte;
        feuille.scrollTop = defilement;
      }
    }
    if (plusOuvert) {
      const html = htmlPlus();
      if (html !== dernier.plus) {
        zonePlus.innerHTML = html;
        dernier.plus = html;
        hydrater(zonePlus);
      }
    }
    majOnglets();
  }

  function rendre(nouvel) {
    if (nouvel) etat = nouvel;
    if (degreOuvert && etat && !(etat.du_jour && Array.isArray(etat.du_jour.visibles) && etat.du_jour.visibles.includes(degreOuvert))) degreOuvert = null;
    if (!estMobile()) return;
    if (premierRendu && etat) {
      // Sur téléphone, la journée d'abord : le panneau Quêtes ne s'ouvre pas tout seul.
      premierRendu = false;
      if (racine.App && racine.App.fermerPanneau && !new URLSearchParams(location.search).get("vue")) racine.App.fermerPanneau();
      document.documentElement.dataset.mobilePret = "1";
    }
    dessiner();
  }

  // ------------------------------------------------------------ gestes
  async function agir(chemin, corps) {
    if (occupe || !racine.App || !racine.App.agir) return;
    occupe = true;
    conteneur.classList.add("occupe");
    try {
      await racine.App.agir(chemin, corps);
    } finally {
      occupe = false;
      conteneur.classList.remove("occupe");
    }
  }

  function ouvrirOnglet(nom) {
    const App = racine.App;
    if (!App) return;
    if (nom === "plus") {
      plusOuvert = !plusOuvert;
      if (plusOuvert) App.fermerPanneau();
      dessiner();
      return;
    }
    plusOuvert = false;
    if (nom === "jour") {
      App.fermerPanneau();
      feuille.scrollTop = 0;
    } else if (nom === "quetes") {
      App.ouvrirPanneau("quetes");
    } else if (nom === "systeme") {
      if (racine.Panneaux && racine.Panneaux.TITRES && racine.Panneaux.TITRES.systeme) App.ouvrirPanneau("systeme");
      else if (App.annoncer) App.annoncer("Le Système n'est pas encore ouvert", "Ce panneau arrive avec la suite du jeu.", "cadenas");
    }
    dessiner();
  }

  conteneur.addEventListener("click", (ev) => {
    // un appui long vient d'ouvrir les degrés : le clic qui suit ne valide rien
    if (appuiLongFait && Date.now() - appuiLongFait < 700) {
      appuiLongFait = 0;
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    const el = ev.target.closest("[data-m]");
    if (!el) {
      // une entrée du menu « Plus » (data-action, traitée par app.js) : le menu se referme
      if (plusOuvert && ev.target.closest("#mobile-plus [data-action]")) {
        plusOuvert = false;
        setTimeout(dessiner, 0);
      }
      return;
    }
    const d = el.dataset;
    if (d.m === "onglet") return ouvrirOnglet(d.onglet);
    if (d.m === "degres") {
      degreOuvert = degreOuvert === d.id ? null : d.id;
      return dessiner();
    }
    if (d.m === "valider") {
      degreOuvert = null;
      if (racine.Haptique) racine.Haptique.toc("coche");
      return agir((d.genre === "priorite" ? "/api/priorites/" : "/api/quetes/") + encodeURIComponent(d.id) + "/valider", d.degre ? { degre: Number(d.degre) } : {});
    }
    if (d.m === "quotidienne" && racine.Haptique) racine.Haptique.toc("coche");
    if (d.m === "quotidienne") return agir("/api/systeme/quotidiennes/" + encodeURIComponent(d.id) + "/cocher", {});
    if (d.m === "habitude") return agir("/api/systeme/habitudes/" + encodeURIComponent(d.id) + "/noter", { sens: d.sens === "-" ? "-" : "+" });
  });

  // La quête écrite part au serveur (app.js s'en charge) : le champ se vide pour la suivante.
  conteneur.addEventListener("submit", (ev) => {
    const champ = ev.target && ev.target.querySelector ? ev.target.querySelector('input[name="texte"]') : null;
    if (champ && champ.value.trim()) setTimeout(() => (champ.value = ""), 0);
  });

  // Appui long sur la case d'une quête : ouvre le choix des trois degrés.
  function annulerAppui() {
    if (appuiLong) clearTimeout(appuiLong.minuteur);
    appuiLong = null;
  }
  conteneur.addEventListener("pointerdown", (ev) => {
    annulerAppui();
    const el = ev.target.closest('[data-long="1"]');
    if (!el) return;
    const id = el.dataset.id;
    appuiLong = {
      x: ev.clientX,
      y: ev.clientY,
      minuteur: setTimeout(() => {
        appuiLong = null;
        appuiLongFait = Date.now();
        degreOuvert = id;
        dessiner();
      }, APPUI_LONG_MS),
    };
  });
  conteneur.addEventListener("pointermove", (ev) => {
    if (appuiLong && Math.hypot(ev.clientX - appuiLong.x, ev.clientY - appuiLong.y) > 10) annulerAppui();
  });
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) conteneur.addEventListener(type, annulerAppui);
  conteneur.addEventListener("contextmenu", (ev) => {
    if (ev.target.closest('[data-long="1"]')) ev.preventDefault();
  });

  // Le panneau s'ouvre ou se ferme ailleurs (app.js) : les onglets suivent.
  if (racine.MutationObserver) {
    const guetteur = new MutationObserver(() => {
      if (!estMobile()) return;
      if (panneauCourant()) plusOuvert = false;
      majOnglets();
    });
    for (const id of ["panneau", "contenu"]) {
      const el = document.getElementById(id);
      if (el) guetteur.observe(el, { attributes: true, attributeFilter: ["class", "data-panneau"] });
    }
  }

  const surChangement = () => {
    dernier.hud = dernier.feuille = dernier.plus = null;
    rendre(null);
    // l'immeuble se recadre dans sa nouvelle place
    racine.dispatchEvent(new Event("resize"));
  };
  if (ETROIT.addEventListener) ETROIT.addEventListener("change", surChangement);
  racine.addEventListener("jeu-reseau", () => {
    if (!etat) {
      dernier.feuille = null;
      dessiner();
    }
  });

  if (estMobile()) dessiner();

  racine.Mobile = { rendre, estMobile };
})(window);
