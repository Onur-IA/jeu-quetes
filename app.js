"use strict";
// Fil du jeu : état, appels au serveur local, panneaux, clics dans l'immeuble, rangement, célébrations.
(function () {
  const { Palette, Police, Monde, Meubles, Decor, Immeuble, Ciel, Agents, Rendu, Personnages, Panneaux, Son, V3 } = window;
  const C = Palette.C;
  const params = new URLSearchParams(location.search);
  const DATE = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? params.get("date") : null;
  const DEMO = params.get("demo") === "1";
  const HEURE_FIXE = params.get("heure") !== null && params.get("heure") !== "" && Number.isFinite(Number(params.get("heure"))) ? Number(params.get("heure")) : null;
  const METEO = params.get("meteo");
  const $ = (id) => document.getElementById(id);

  const ui = {
    panneau: params.get("panneau") === "0" ? null : "quetes",
    vue: params.get("cadre") === "immeuble" ? "immeuble" : "lieu",
    plis: {},
    choixAgent: null,
    lieuBoutique: null,
    surligne: null,
    etatOuvert: -1,
    editer: null,
    supprimer: null,
    formulaire: null,
    degreOuvert: null,
    degresEdition: null,
    typeOuvert: null,
    ajout: null,
    butEdition: false,
    reglageSection: "toi",
    premiereId: null,
  };
  const VUES = { quetes: "quetes", semaine: "quetes", journal: "journal", equipe: "equipe", encaissements: "encaissements", argent: "encaissements", boutique: "boutique", ranger: "ranger", carte: "carte", etat: "etat", trophees: "trophees", collection: "trophees", systeme: "systeme" };
  const PLANTES = ["plante", "ficus", "jardiniere", "cactus", "bonsai"];
  if (VUES[params.get("vue")]) ui.panneau = VUES[params.get("vue")];
  if (params.get("vue") === "immeuble") ui.vue = "immeuble";
  if (params.get("etat") !== null && params.get("etat") !== "") {
    ui.panneau = "etat";
    ui.etatOuvert = Number(params.get("etat"));
  }
  if (params.get("jours") === "1") ui.plis.jours = true;

  let etat = null;
  let scene = null;
  let cleFond = "";
  let premier = true;
  let pointsAffiches = null;
  let prise = null; // objet tenu en mode rangement
  let enDemenagement = false;
  const vehicules = [];
  let temps = 0;
  let prochainLecteur = 60 + Math.random() * 60;
  let prochainMot = 25 + Math.random() * 20;
  let contratPropose = null; // jour où l'écran du matin a déjà été montré
  let assistantPropose = false;
  let sonRegle = false;
  let vueReglages = null;
  const deblocagesEnAttente = [];
  const TOUR = DEMO && params.get("tour") !== "0" && !params.get("vue") && !params.get("scene");

  // ------------------------------------------------------------ serveur local
  function racineApp() {
    return new URL(".", location.href).href;
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

  async function api(methode, chemin, corps) {
    const options = { method: methode, headers: {}, cache: "no-store" };
    if (methode === "POST") {
      // « X-Jeu-Refus » : un refus de jeu (solde insuffisant, valeur hors bornes) revient en réponse 200 avec son message
      options.headers = { "Content-Type": "application/json", "X-Jeu-Quetes": "1", "X-Jeu-Refus": "200" };
      options.body = JSON.stringify(corps || {});
    }
    const reponse = await fetch(adresse(chemin), options);
    let json = null;
    try {
      json = await reponse.json();
    } catch (err) {
      json = null;
    }
    if (!reponse.ok || !json || json.erreur) {
      const message = json && json.erreur ? json.erreur.message : "Le serveur du jeu ne répond pas. Relance-le.";
      throw Object.assign(new Error(message), { code: json && json.erreur ? json.erreur.code : "RESEAU" });
    }
    return json;
  }

  async function charger() {
    try {
      appliquer(await api("GET", "/api/etat"));
      $("heure-maj").textContent = etat.heure.replace(":", " h ");
    } catch (err) {
      annoncer(err.message, "", "erreur");
    }
  }

  // Envoie un geste du joueur au serveur, puis applique l'état reçu.
  async function agir(chemin, corps) {
    try {
      const reponse = await api("POST", chemin, corps);
      appliquer(reponse.etat);
      return reponse;
    } catch (err) {
      annoncer(err.message, "", "erreur");
      Son.jouer("erreur");
      return null;
    }
  }

  // ------------------------------------------------------------ état reçu
  function heureDeParis() {
    if (HEURE_FIXE !== null) return HEURE_FIXE;
    try {
      const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: (etat && etat.config.fuseau) || "Europe/Paris", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      const v = {};
      for (const p of parts) v[p.type] = Number(p.value);
      return v.hour + v.minute / 60 + v.second / 3600;
    } catch (err) {
      const d = new Date();
      return d.getHours() + d.getMinutes() / 60;
    }
  }

  function vueDuMonde() {
    const lieux = etat.lieux;
    const ouverts = lieux.filter((l) => l.ouvert).map((l) => l.id);
    const prochain = lieux.find((l) => !l.ouvert);
    const ameliorations = {};
    for (const l of lieux) ameliorations[l.id] = l.ameliorations;
    return {
      ouverts,
      prochain: prochain ? prochain.id : null,
      lieuCourant: etat.partie.lieu_courant,
      achats: etat.partie.ameliorations,
      ameliorations,
      objets: etat.objets,
      placements: etat.partie.placements,
      fleuri: etat.arrosage.actif,
    };
  }

  function construireScene() {
    const vue = vueDuMonde();
    scene = Decor.scene(vue);
    const mois = Number(etat.date.slice(5, 7));
    const cle = JSON.stringify([scene.etats, mois]);
    if (cle !== cleFond) {
      cleFond = cle;
      Rendu.definirScene(scene, Immeuble.construire(scene, { saison: Ciel.saison(mois) }));
    } else Rendu.definirScene(scene, Rendu.fond);
    const prix = {};
    for (const p of Monde.PIECES) {
      if (!p.amelioration) continue;
      const lieu = etat.lieux.find((l) => l.id === Monde.ZONES[p.zone].lieu);
      const a = lieu && lieu.ameliorations.find((x) => x.id === p.amelioration);
      const effort = a ? etat.efforts.find((x) => x.cle === lieu.id + "/" + a.id) : null;
      if (a) prix[p.id] = effort ? effort.valeur + " sur " + effort.seuil : a.prix;
    }
    const prochain = etat.lieux.find((l) => !l.ouvert);
    const maison = etat.partie.ameliorations["maison-edition"] || [];
    Rendu.definirInfos({
      lieux: etat.lieux.map((l) => ({ id: l.id, nom: l.nom, ouvert: l.ouvert, prochain: prochain && prochain.id === l.id, cap: l.cap })),
      prix,
      abonnes: etat.newsletter.lecteurs,
      trophees: etat.trophees,
      enseigne: vue.ouverts.includes("maison-edition") && maison.includes("enseigne") ? etat.config.enseigne : "",
      enseigneAllumee: true,
      fanions: etat.dimanche.semaines_bouclees,
      etoile: Boolean(etat.etoile && etat.etoile.vente),
      compagnons: window.Systeme ? window.Systeme.compagnons(etat) : null,
      zonesOuvertes: Object.keys(Monde.ZONES).filter((z) => vue.ouverts.includes(Monde.ZONES[z].lieu)),
    });
    const texteDe = (id) => {
      const q = etat.quetes.find((x) => x.id === id) || etat.jours.flatMap((j) => j.priorites).find((x) => x.id === id);
      return q ? Police.abreger(q.texte, 150) : "";
    };
    Agents.synchroniser({
      scene,
      nav: { ouverts: vue.ouverts, achats: vue.achats },
      avatar: etat.partie.avatar,
      agents: etat.agents.map((a) => ({ ...a, texteQuete: a.quete ? texteDe(a.quete) : "" })),
      collegues: etat.collegues.collegues,
      colis: enDemenagement ? [] : etat.colis,
      premier,
    });
  }

  function appliquer(nouvel) {
    const ancien = etat;
    etat = nouvel;
    Panneaux.definirMonnaie(etat.config.monnaie);
    if (!sonRegle) {
      // le son suit ton réglage ; le navigateur ne le lance qu'après ton premier clic
      sonRegle = true;
      Son.activer(etat.config.son);
      majBoutonSon();
    }
    if (ui.panneau && !panneauOuvert(ui.panneau)) ui.panneau = "quetes";
    majHeure();
    const lieuAvant = ancien ? ancien.partie.lieu_courant : null;
    const posteAvant = scene ? scene.toi : null;
    construireScene();
    majBarre(ancien);
    majBandeaux();
    majPanneau(false);
    majPremiere();
    if (premier) cadrer(true);
    celebrer(ancien, lieuAvant, posteAvant);
    if (window.Systeme) window.Systeme.apresEtat(etat); // version 4 : bandeau et fenêtres du Système
    apresEtat();
    if (lieuAvant && lieuAvant !== etat.partie.lieu_courant && !enDemenagement) cadrer(false);
    premier = false;
    if (window.Mobile) window.Mobile.rendre(etat); // la feuille « Jour » du téléphone (public/mobile.js)
  }

  function majHeure() {
    if (!etat) return;
    const heure = heureDeParis();
    Rendu.definirEtat({ heure, mois: Number(etat.date.slice(5, 7)), date: etat.date, meteo: Ciel.meteo(etat.date, heure, METEO) });
  }

  // ------------------------------------------------------------ petits dessins dans la page
  function hydrater(racine) {
    for (const el of racine.querySelectorAll("[data-sprite]")) {
      const z = Number(el.dataset.z || 2);
      const ombre = el.dataset.etat === "ombre";
      const s = ombre && Meubles.CATALOGUE[el.dataset.sprite] ? Meubles.silhouette(el.dataset.sprite, C["2"]) : Meubles.sprite(el.dataset.sprite, { etat: el.dataset.etat || "" });
      if (!s) continue;
      const c = document.createElement("canvas");
      c.width = s.width;
      c.height = s.height;
      c.getContext("2d").drawImage(s, 0, 0);
      c.style.width = s.width * z + "px";
      c.style.height = s.height * z + "px";
      el.replaceChildren(c);
    }
    for (const el of racine.querySelectorAll("[data-pixel]")) {
      el.replaceChildren(Police.element(el.dataset.pixel, Number(el.dataset.z || 2), C[el.dataset.c || "0"]));
    }
    for (const el of racine.querySelectorAll("[data-avatar]")) {
      const z = Number(el.dataset.z || 4);
      const img = Personnages.fabriquer(Personnages.lookToi(etat.partie.avatar)).face.debout[0];
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      c.style.width = img.width * z + "px";
      c.style.height = img.height * z + "px";
      el.replaceChildren(c);
    }
    for (const el of racine.querySelectorAll("[data-agent]")) {
      const z = Number(el.dataset.z || 3);
      const look = Personnages.LOOKS_AGENTS && Personnages.LOOKS_AGENTS[el.dataset.agent];
      if (!look) continue;
      const img = Personnages.fabriquer(look).face.debout[0];
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      c.style.width = img.width * z + "px";
      c.style.height = img.height * z + "px";
      el.replaceChildren(c);
    }
    for (const el of racine.querySelectorAll("[data-trophee]")) {
      const z = Number(el.dataset.z || 4);
      const c = document.createElement("canvas");
      c.width = 5;
      c.height = 6;
      Meubles.trophee(c.getContext("2d"), el.dataset.trophee, 0, 0);
      c.style.width = 5 * z + "px";
      c.style.height = 6 * z + "px";
      el.replaceChildren(c);
    }
  }

  function pixelDans(el, texte, z, couleur) {
    if (el.dataset.texte === texte + "|" + couleur) return;
    el.dataset.texte = texte + "|" + couleur;
    el.replaceChildren(Police.element(texte, z, C[couleur]));
  }

  // ------------------------------------------------------------ barre du haut
  function panneauOuvert(nom) {
    const f = Panneaux.FONCTION_DE[nom];
    return !f || !etat || Panneaux.ouvert(etat, f);
  }

  function majBoutonSon() {
    const b = $("bouton-son");
    b.title = Son.actif ? "Son activé. Clique pour le couper." : "Son coupé. Clique pour l'activer.";
    b.querySelector(".pix").dataset.sprite = Son.actif ? "icone-son" : "icone-muet";
    hydrater(b);
  }

  function joursJoues() {
    const n = etat.partie.jours_joues;
    return n ? Panneaux.pluriel(n, "jour joué", "jours joués") : "premier jour";
  }

  function majBarre(ancien) {
    const lieu = etat.lieux.find((l) => l.id === etat.partie.lieu_courant);
    const f = etat.fonctions;
    $("jeu").classList.toggle("premiere-minute", f.premiere_minute);
    pixelDans($("nom-lieu"), lieu.nom, 2, "0");
    $("sous-lieu").textContent = (etat.config.joueur ? etat.config.joueur + " · " : "") + lieu.sous_titre;
    const m = etat.mois;
    const argentOuvert = Panneaux.ouvert(etat, "argent");
    $("bloc-argent").classList.toggle("verrou", !argentOuvert);
    const jauge = $("jauge");
    const pleine = $("jauge-pleine");
    if (argentOuvert) {
      $("argent-titre").textContent = m.periode === "30_jours" ? "30 derniers jours" : m.libelle.charAt(0).toUpperCase() + m.libelle.slice(1);
      pixelDans($("argent-total"), Panneaux.euros(m.total) + " sur " + Panneaux.euros(m.objectif), 2, "0");
      $("argent-reste").textContent = m.total >= m.objectif ? "Objectif atteint" : m.prochain_jalon ? "Jalon : " + Panneaux.euros(m.prochain_jalon) : "";
      $("bloc-argent").title = (m.rappel ? m.rappel + " " : "") + "Clique pour déclarer un encaissement.";
      jauge.setAttribute("aria-valuemax", m.objectif);
      jauge.setAttribute("aria-valuenow", m.total);
      jauge.setAttribute("aria-label", "Encaissé ce mois : " + Panneaux.euros(m.total) + " sur " + Panneaux.euros(m.objectif));
      pleine.style.width = Math.min(100, (m.total / m.objectif) * 100) + "%";
      pleine.classList.toggle("atteint", m.total >= m.objectif);
      $("jauge-jalons").innerHTML = m.jalons
        .map((j) => '<span class="jalon' + (j.atteint ? " atteint" : "") + (j.montant === m.objectif ? " dernier" : "") + '" style="left:' + (j.montant / m.objectif) * 100 + '%"><i></i><b>' + Panneaux.euros(j.montant) + "</b></span>")
        .join("");
    } else {
      // la serrure avant la clé : le bloc se voit déjà, avec sa condition
      $("argent-titre").textContent = "La barre du mois";
      pixelDans($("argent-total"), "S'ouvre au jour " + f.fonctions.argent.jour, 2, "2");
      $("argent-reste").textContent = "Aujourd'hui : jour " + f.jour_de_jeu;
      jauge.setAttribute("aria-label", "La barre du mois s'ouvre au jour " + f.fonctions.argent.jour);
      pleine.style.width = "0%";
      $("jauge-jalons").innerHTML = "";
    }
    // le but d'équipe de la semaine
    const eq = etat.equipe;
    const equipeOuverte = Panneaux.ouvert(etat, "equipe");
    $("bloc-equipe").hidden = !equipeOuverte;
    if (equipeOuverte) {
      $("equipe-titre").textContent = eq.libelle.length > 30 ? eq.libelle.slice(0, 29) + "…" : eq.libelle;
      $("bloc-equipe").title = "But d'équipe : " + eq.libelle + ". " + eq.crans + " sur " + eq.total + " crans.";
      const html = Panneaux.barreEquipe(eq) + '<span class="petit chiffres"> ' + eq.crans + " sur " + eq.total + "</span>";
      if ($("equipe-crans").__html !== html) {
        $("equipe-crans").innerHTML = html;
        $("equipe-crans").__html = html;
      }
    }
    // niveau et compteur de jours joués : ils ne redescendent jamais
    const n = etat.niveau;
    // Version 4 : le niveau, c'est celui du Système (dans son bandeau). Ici, le titre gagné avec tes points.
    const systemeEveille = Boolean(etat.systeme && etat.systeme.actif && etat.systeme.eveille);
    $("niveau").textContent = (systemeEveille ? "Titre : " : "Niveau " + n.rang + " · ") + n.nom + " · " + joursJoues();
    $("niveau-jauge").firstElementChild.style.width = n.progression + "%";
    $("bloc-points").title = n.dernier ? "Dernier niveau atteint." : "Encore " + (n.suivant - etat.partie.total_gagne) + " points gagnés pour devenir « " + n.nom_suivant + " ».";
    if (pointsAffiches === null || !ancien) {
      pointsAffiches = etat.partie.points;
      pixelDans($("points"), pointsAffiches + " points", 2, "b");
    }
    const source = etat.coffre.chemin && etat.semaine ? "Semaine " + etat.semaine.id + " · coffre en lecture seule" : "Tes quêtes : data/quetes.md";
    $("pied").textContent = (etat.phase ? "Phase : " + etat.phase.nom + " · " : "") + source + " · " + joursJoues();
    // onglets : pastilles, et serrures pour ce qui s'ouvrira plus tard
    for (const onglet of document.querySelectorAll(".onglet")) {
      // « Comment je me sens ? » lit les stratégies de ta note d'intention : sans elles, l'onglet n'a rien à montrer
      if (onglet.dataset.panneau === "etat") onglet.hidden = etat.strategies.etats.length === 0;
      const fonction = Panneaux.FONCTION_DE[onglet.dataset.panneau];
      const ferme = Boolean(fonction) && !Panneaux.ouvert(etat, fonction);
      onglet.classList.toggle("verrou", ferme);
      let cle = onglet.querySelector(".jour-verrou");
      if (ferme) {
        if (!cle) {
          cle = document.createElement("span");
          cle.className = "jour-verrou";
          onglet.appendChild(cle);
        }
        cle.textContent = "jour " + f.fonctions[fonction].jour;
        onglet.title = f.fonctions[fonction].nom + " : s'ouvre à ton jour de jeu " + f.fonctions[fonction].jour + ".";
      } else if (cle) {
        cle.remove();
        onglet.title = Panneaux.TITRES[onglet.dataset.panneau];
      }
    }
    pastilleOnglet("quetes", etat.du_jour.visibles.length);
    pastilleOnglet("carte", Panneaux.ouvert(etat, "carte") && etat.lieux.some((l) => !l.ouvert && l.cap && l.cap.suggere) ? "!" : 0);
    pastilleOnglet("journal", etat.dimanche.disponible ? "!" : 0);
    document.title = "Jeu de quêtes · " + etat.partie.points + " points" + (argentOuvert ? " · " + Panneaux.euros(m.total) + " sur " + Panneaux.euros(m.objectif) : "");
  }

  function pastilleOnglet(nom, n) {
    const onglet = document.querySelector('.onglet[data-panneau="' + nom + '"]');
    let p = onglet.querySelector(".pastille-nombre");
    if (!n) {
      if (p) p.remove();
      return;
    }
    if (!p) {
      p = document.createElement("span");
      p.className = "pastille-nombre";
      onglet.appendChild(p);
    }
    p.textContent = n;
  }

  // Le compteur de points défile jusqu'à la nouvelle valeur.
  function majCompteur() {
    if (!etat || pointsAffiches === null || pointsAffiches === etat.partie.points) return;
    const ecart = etat.partie.points - pointsAffiches;
    pointsAffiches += Math.sign(ecart) * Math.max(1, Math.round(Math.abs(ecart) / 6));
    if (Math.sign(etat.partie.points - pointsAffiches) !== Math.sign(ecart)) pointsAffiches = etat.partie.points;
    pixelDans($("points"), pointsAffiches + " points", 2, "b");
  }

  function majBandeaux() {
    let h = "";
    if (etat.demo) h += '<div class="bandeau">Mode démo : partie d\'exemple. Rien n\'est enregistré. <button type="button" class="bouton second" data-action="remise-a-zero">Rejouer</button></div>';
    else if (etat.simulation) h += '<div class="bandeau">Date simulée : ' + Panneaux.e(Panneaux.dateLongue(etat.date)) + " " + etat.date.slice(0, 4) + '. Partie de test. <button type="button" class="bouton second" data-action="remise-a-zero">Remettre à zéro</button></div>';
    for (const a of etat.avertissements) h += '<div class="bandeau doux">' + Panneaux.e(a) + "</div>";
    $("bandeaux").innerHTML = h;
  }

  // ------------------------------------------------------------ panneau
  function majPanneau(force) {
    const p = $("panneau");
    document.querySelectorAll(".onglet").forEach((o) => o.classList.toggle("actif", o.dataset.panneau === ui.panneau));
    $("jeu").classList.toggle("sans-panneau", !ui.panneau);
    p.classList.toggle("ferme", !ui.panneau);
    Rendu.definirRangement(ui.panneau === "ranger" ? { actif: true, prise } : null);
    if (!ui.panneau || !etat) return;
    const contenu = $("contenu");
    // pas de redessin pendant que le joueur tape dans un champ
    const champ = document.activeElement;
    if (!force && champ && contenu.contains(champ) && /^(INPUT|SELECT)$/.test(champ.tagName)) return;
    // on garde ce qui est en train d'être écrit dans le champ « Écrire une quête »
    const saisie = contenu.querySelector('form[data-formulaire="quete"]');
    if (saisie && ui.panneau === "quetes") ui.ajout = { texte: saisie.texte.value, type: saisie.type.value };
    const html = Panneaux.rendre(ui.panneau, etat, ui, scene);
    if (contenu.dataset.panneau === ui.panneau && contenu.__html === html) return;
    const defilement = contenu.dataset.panneau === ui.panneau ? contenu.scrollTop : 0;
    pixelDans($("titre-panneau"), Panneaux.TITRES[ui.panneau], 2, "6");
    contenu.innerHTML = html;
    contenu.__html = html;
    contenu.dataset.panneau = ui.panneau;
    hydrater(contenu);
    contenu.scrollTop = defilement;
    if (ui.surligne) {
      const cible = contenu.querySelector('[data-article="' + ui.surligne + '"]');
      if (cible) cible.scrollIntoView({ block: "center" });
    }
    if (ui.panneau === "quetes" && params.get("vue") === "semaine" && premier) {
      const titres = contenu.querySelectorAll("h2");
      if (titres.length) titres[titres.length - 1].scrollIntoView();
    }
  }

  function ouvrirPanneau(nom, options) {
    const o = options || {};
    if (etat && nom && !panneauOuvert(nom)) {
      const fct = etat.fonctions.fonctions[Panneaux.FONCTION_DE[nom]];
      annoncer(fct.nom + " : au jour " + fct.jour, "Tu en es au jour " + etat.fonctions.jour_de_jeu + ". Une nouveauté par jour de jeu. Pour tout ouvrir : Réglages.", "cadenas");
      Son.jouer("clic");
      return;
    }
    if (prise) lacher();
    const meme = ui.panneau === nom && !o.garder;
    ui.panneau = meme ? null : nom;
    if (o.lieu) ui.lieuBoutique = o.lieu;
    ui.surligne = o.surligne || null;
    ui.choixAgent = null;
    ui.degreOuvert = null;
    ui.typeOuvert = null;
    ui.degresEdition = null;
    majPanneau(true);
    cadrer(false);
  }

  // ------------------------------------------------------------ caméra
  function zoneUtile() {
    // téléphone : l'immeuble occupe le haut de l'écran, sans barre ni panneau autour (voir public/mobile.js)
    if (window.Mobile && window.Mobile.estMobile()) return { x0: 6, y0: 6, x1: $("cadre").clientWidth - 6, y1: $("cadre").clientHeight - 6 };
    const panneau = ui.panneau ? $("panneau").offsetWidth + 16 : 8;
    return { x0: 74, y0: 92, x1: Math.max(400, innerWidth - panneau), y1: innerHeight - 30 };
  }
  function cadrer(direct) {
    if (!etat) return;
    Rendu.definirZone(zoneUtile());
    Rendu.redimensionner();
    const rect = ui.vue === "immeuble" ? Decor.cadreImmeuble() : Decor.cadreLieu(ui.lieuVu || Monde.lieuDuPoste(etat.partie.lieu_courant));
    Rendu.cadrer(rect, { direct, max: ui.vue === "immeuble" ? 4 : 5, min: innerWidth >= 1100 && innerHeight >= 640 ? 2 : 1 });
  }

  // ------------------------------------------------------------ annonces et fenêtres
  // Trois annonces à l'écran au plus : les suivantes attendent leur tour, pour laisser voir l'immeuble.
  const fileAnnonces = [];
  function annoncer(titre, detail, genre) {
    fileAnnonces.push({ titre, detail, genre });
    if (fileAnnonces.length > 12) fileAnnonces.splice(0, fileAnnonces.length - 12);
    viderAnnonces();
  }
  function viderAnnonces() {
    const zone = $("annonces");
    while (fileAnnonces.length && zone.children.length < 3) {
      const { titre, detail, genre } = fileAnnonces.shift();
      const el = document.createElement("div");
      el.className = "annonce" + (genre === "erreur" ? " erreur" : "");
      el.innerHTML = (genre && genre !== "erreur" ? Panneaux.sprite("icone-" + genre, 2) : "") + "<span>" + Panneaux.e(titre) + (detail ? "<small>" + Panneaux.e(detail) + "</small>" : "") + "</span>";
      hydrater(el);
      zone.appendChild(el);
      setTimeout(() => {
        el.remove();
        viderAnnonces();
      }, 4700);
    }
  }

  function ouvrirFenetre(titre, corps, actions, classe) {
    const m = $("modale");
    m.innerHTML = '<div class="fenetre cadre-pixel' + (classe ? " " + classe : "") + '" role="dialog" aria-modal="true"><div class="tete">' + Panneaux.pixel(titre, 2, "6") + '<button type="button" class="bouton-icone" data-action="fermer-fenetre" title="Fermer"><span class="croix">x</span></button></div><div class="corps">' + corps + '<div class="actions">' + actions + "</div></div></div>";
    hydrater(m);
    m.hidden = false;
    const premierBouton = m.querySelector(".actions .bouton:last-child") || m.querySelector(".actions button");
    if (premierBouton && !m.querySelector("[autofocus]")) premierBouton.focus();
  }
  function fermerFenetre() {
    $("modale").hidden = true;
    $("modale").innerHTML = "";
    vueReglages = null;
    if (etat) setTimeout(apresEtat, 400);
  }

  // Un ruban au-dessus de l'immeuble, pour les grands moments. Il ne bloque rien.
  let minuteurRuban = null;
  function ruban(titre, sous, duree) {
    const t = $("titre-evenement");
    t.innerHTML = '<div class="ruban">' + Panneaux.pixel(titre, 3, "6") + "</div>" + (sous ? '<div class="sous">' + Panneaux.e(sous) + "</div>" : "");
    hydrater(t);
    t.classList.remove("visible");
    void t.offsetWidth;
    t.classList.add("visible");
    clearTimeout(minuteurRuban);
    minuteurRuban = setTimeout(() => t.classList.remove("visible"), (duree || 4.2) * 1000);
  }

  function bienvenue() {
    ouvrirFenetre(
      "Bienvenue",
      "<p>Ici, ton immeuble se remplit quand tu avances pour de vrai. Tu commences sous les toits.</p><ul><li>Chaque matin, un contrat à choisir : un sûr, un ambitieux.</li><li>Tes quêtes d'administratif et de vente rapportent des points. Création, relations et santé se racontent dans le journal de l'immeuble.</li><li>On ne perd jamais rien en s'absentant.</li></ul><p>Tout se règle : bouton Réglages, en haut à droite.</p>",
      '<button type="button" class="bouton" data-action="commencer">Commencer</button>'
    );
  }

  // ------------------------------------------------------------ première minute, assistant, contrat, revue, réglages
  function majPremiere() {
    const el = $("premiere");
    if (!etat.fonctions.premiere_minute) {
      if (!el.hidden) {
        // la première quête est faite : le panneau des quêtes s'ouvre
        el.hidden = true;
        el.innerHTML = "";
        el.__html = "";
        if (params.get("panneau") !== "0") ui.panneau = "quetes";
        majPanneau(true);
        cadrer(false);
      }
      return;
    }
    ui.panneau = null;
    const champ = document.activeElement;
    if (champ && el.contains(champ) && champ.tagName === "INPUT" && champ.value) return;
    const tous = [...etat.jours.filter((j) => j.statut === "aujourdhui").flatMap((j) => j.priorites), ...etat.quetes].filter((q) => !q.payee && !q.avant_jeu);
    let memoire = null;
    try {
      memoire = localStorage.getItem("jq-premiere");
    } catch (err) {
      memoire = null;
    }
    const voulue = ui.premiereId || memoire;
    let quete = voulue ? tous.find((q) => q.id === voulue) || null : null;
    if (!quete && voulue !== "aucune") {
      const locales = tous.filter((q) => q.origine === "locale");
      quete = locales.length ? locales[0] : null;
    }
    const suggestions = tous.filter((q) => q.origine !== "locale").slice(0, 3);
    const html = V3.premiere(etat, quete, suggestions);
    if (el.__html !== html) {
      el.innerHTML = html;
      el.__html = html;
      hydrater(el);
    }
    el.hidden = false;
  }

  function choisirPremiere(id) {
    ui.premiereId = id;
    try {
      localStorage.setItem("jq-premiere", id);
    } catch (err) {
      // pas de mémoire locale : le choix tient le temps de la page
    }
    majPremiere();
    majPanneau(true);
  }

  function fenetreAssistant() {
    ouvrirFenetre("Ton immeuble, tes règles", V3.assistant(etat), "", "large");
  }

  function fenetreContrat() {
    if (!etat.contrat.propositions) return;
    ouvrirFenetre(
      "Le contrat du jour",
      V3.contratMatin(etat),
      '<button type="button" class="lien" data-action="signer" data-choix="aucun">Pas de contrat aujourd\'hui</button><button type="button" class="bouton second" data-action="fermer-fenetre">Plus tard</button>',
      "large"
    );
    Son.jouer("contrat");
  }

  function fenetreDimanche() {
    if (!etat.dimanche.disponible) {
      annoncer("La revue s'ouvre " + etat.dimanche.nom_jour, etat.dimanche.faite ? "Celle de cette semaine est faite." : "", "fanion");
      return;
    }
    ouvrirFenetre(
      "La revue de la semaine",
      V3.dimanche(etat),
      '<button type="button" class="bouton second" data-action="fermer-fenetre">Plus tard</button><button type="button" class="bouton vert" data-action="cloturer">Boucler la semaine</button>',
      "large"
    );
    // les trois chiffres montent l'un après l'autre
    const m = $("modale");
    m.querySelectorAll("[data-compte]").forEach((el, i) => {
      const cible = Number(el.dataset.compte);
      const debut = performance.now() + 300 + i * 800;
      const monter = (maintenant) => {
        if (!el.isConnected) return;
        const k = Math.max(0, Math.min(1, (maintenant - debut) / 700));
        el.textContent = Math.round(cible * k);
        if (k < 1) requestAnimationFrame(monter);
      };
      setTimeout(() => {
        if (el.isConnected) Son.jouer("piece");
      }, 300 + i * 800);
      requestAnimationFrame(monter);
    });
  }

  async function fenetreReglages(section) {
    if (section) ui.reglageSection = section;
    try {
      vueReglages = await api("GET", "/api/reglages");
    } catch (err) {
      annoncer(err.message, "", "erreur");
      return;
    }
    const ouverte = !$("modale").hidden && $("modale").querySelector(".ecran-reglages");
    const defilement = ouverte ? $("modale").querySelector(".champs").scrollTop : 0;
    ouvrirFenetre("Réglages", V3.reglages(vueReglages, ui.reglageSection, etat), '<button type="button" class="bouton" data-action="fermer-fenetre">Fermer</button>', "tres-large");
    const champs = $("modale").querySelector(".champs");
    if (champs) champs.scrollTop = defilement;
  }

  async function changerReglage(chemin, valeur) {
    const r = await agir("/api/reglages", { chemin, valeur });
    if (r) Son.jouer("pose");
    cleFond = "";
    if (r && etat) construireScene();
    if (!$("modale").hidden && $("modale").querySelector(".ecran-reglages")) fenetreReglages();
  }

  // Les fonctions qui viennent de s'ouvrir : une carte en bas de l'écran, jusqu'à ce que tu l'aies lue.
  function majDeblocage() {
    const el = $("deblocage");
    if (!deblocagesEnAttente.length) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    if (!el.hidden) return;
    el.innerHTML = V3.deblocage(deblocagesEnAttente.slice());
    hydrater(el);
    el.hidden = false;
    Son.jouer("debloque");
  }

  // Après chaque état reçu : ce que le jeu propose de lui-même, une chose à la fois.
  function apresEtat() {
    if (!etat || !$("modale").hidden || enDemenagement || (racineTour() && racineTour().actif)) return;
    if (TOUR && (!racineTour() || !racineTour().termine)) return; // la visite guidée de la démo mène la danse
    if (etat.fonctions.premiere_minute) return;
    if (params.get("auto") === "0") return majDeblocage();
    if (etat.assistant.a_proposer && !assistantPropose) {
      assistantPropose = true;
      setTimeout(() => {
        if ($("modale").hidden) fenetreAssistant();
      }, 2600);
      return;
    }
    if (etat.assistant.a_proposer) return majDeblocage();
    if (!etat.partie.accueil_vu && !etat.partie.quetes_faites) return bienvenue();
    if (etat.contrat.a_choisir && contratPropose !== etat.date) {
      contratPropose = etat.date;
      // des annonces à l'écran (bonus de retour, contrat de la veille) : on les laisse lire avant le contrat du matin
      const attente = fileAnnonces.length || $("annonces").children.length ? 3600 : 0;
      if (!attente) return fenetreContrat();
      setTimeout(() => {
        if ($("modale").hidden && etat.contrat.a_choisir) fenetreContrat();
      }, attente);
      return;
    }
    majDeblocage();
  }

  function racineTour() {
    return window.Tour || null;
  }

  function fenetreMission() {
    const m = etat.mission;
    ouvrirFenetre(
      "Ta mission",
      (m.texte ? "<blockquote>" + Panneaux.e(m.texte) + "</blockquote>" : '<p class="vide">Je ne trouve pas la section « Mon intention » dans ta note.</p>') +
        (m.objectifs.length ? "<p><b>Tes objectifs principaux</b></p><ul>" + m.objectifs.map((o) => "<li>" + Panneaux.e(o) + "</li>").join("") + "</ul>" : "") +
        '<p class="petit">Lu dans l\'intention de ta phase' + (etat.phase ? " « " + Panneaux.e(etat.phase.nom) + " »" : "") + ". Pour la changer, modifie ta note.</p>",
      '<button type="button" class="bouton" data-action="fermer-fenetre">Au travail</button>'
    );
  }

  function fenetreCap(capId) {
    const cap = [...etat.lieux.map((l) => l.cap).filter(Boolean), ...etat.jalons].find((c) => c.id === capId);
    if (!cap) return;
    ouvrirFenetre(
      "Un cap passé ?",
      "<p>Tu confirmes : <b>" + Panneaux.e(cap.libelle) + '</b> ?</p><p class="petit">C\'est toi qui le dis. Le jeu ne vérifie rien et ne coche jamais à ta place.</p><div class="formulaire"><label>Date du cap<input type="date" id="date-cap" max="' + etat.date + '" value="' + etat.date + '"></label></div>',
      '<button type="button" class="bouton second" data-action="fermer-fenetre">Pas encore</button><button type="button" class="bouton vert" data-action="cap-oui" data-cap="' + cap.id + '">Oui, c\'est fait</button>'
    );
  }

  function fenetreColis(gain) {
    ouvrirFenetre(
      "Un colis pour toi",
      V3.colis(etat, gain),
      (gain.objet ? '<button type="button" class="bouton second" data-action="ranger-objet">Le ranger moi-même</button>' : "") + '<button type="button" class="bouton" data-action="fermer-fenetre">Parfait</button>'
    );
    const sceneColis = $("modale").querySelector(".scene-colis");
    if (sceneColis) {
      setTimeout(() => {
        if (!sceneColis.isConnected) return;
        sceneColis.classList.add("ouvert");
        sceneColis.parentElement.classList.add("colis-ouvert");
        Son.jouer("colis");
      }, 1300);
    }
  }

  // ------------------------------------------------------------ célébrations
  function positionToi() {
    const toi = Agents.trouver("toi");
    return toi ? { x: toi.x, y: toi.y - 12 } : { x: 240, y: 60 };
  }
  function cibleEcran(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function plantesVisibles() {
    return scene ? scene.elements.filter((el) => PLANTES.includes(el.sprite)) : [];
  }

  function montrerElement(cle, lieuId) {
    const el = scene.elements.find((x) => x.cle === cle);
    if (el) {
      Rendu.etincelles(el.x + el.l / 2, el.y + el.h / 2, 18);
      Rendu.poussiere(el.x, el.x + el.l, el.y + el.h - 4, el.y + el.h);
      return;
    }
    const piece = Monde.PIECES.find((x) => cle.endsWith("/" + x.amelioration) && Monde.ZONES[x.zone].lieu === lieuId);
    if (piece) {
      const n = Monde.ZONES[piece.zone].niveau;
      Rendu.poussiere(piece.x0, piece.x1, Monde.plafond(n), Monde.yNiveau(n));
      Rendu.confettis((piece.x0 + piece.x1) / 2, Monde.yNiveau(n) - 10, 36);
    }
  }

  function feux(n, depart) {
    for (let i = 0; i < n; i++) setTimeout(() => Rendu.feu(Monde.X.murG + 20 + Math.random() * 300, -20 - Math.random() * 50), (depart || 300) + i * 300);
  }

  function celebrer(ancien, lieuAvant, posteAvant) {
    const gains = etat.gains || [];
    const evenements = etat.evenements || [];
    const leger = !ancien; // au chargement : on annonce, sans feu d'artifice
    if (leger) {
      const total = gains.filter((g) => (g.type === "ligne" || g.type === "priorite") && g.points > 0).reduce((s, g) => s + g.points, 0);
      if (total) annoncer("+" + total + " points", "Des cases cochées depuis ta dernière visite.", "points");
    }
    const p = positionToi();
    let felicite = false;
    for (const g of gains) {
      if (g.type === "ligne" || g.type === "priorite" || g.type === "bonus" || g.type === "geste") {
        if (leger) continue;
        if (g.recit) {
          // quête racontée : pas de pièces, une ligne au journal
          Rendu.etincelles(p.x, p.y - 8, 18);
          Rendu.texteFlottant(p.x, p.y, g.mode === "racontee" ? "au journal" : "plafond", "r");
          annoncer(g.recit, g.mode === "racontee" ? "Une ligne de plus au journal de l'immeuble." : "Elle compte, sans points.", "journal");
          Son.jouer("journal");
        } else {
          Rendu.pieces(p.x, p.y, Math.max(3, Math.min(12, Math.round(g.points / 4))), cibleEcran($("piece-compteur")));
          Rendu.texteFlottant(p.x, p.y, "+" + g.points, g.vente ? "c" : "t");
          if (g.vente) Rendu.confettis(p.x, p.y, 28);
          if (g.degre === 3) Rendu.confettis(p.x, p.y, 22);
          if (g.type === "bonus") {
            Rendu.confettis(p.x, p.y, 40);
            annoncer("Journée complète", "+" + g.points + " points", "points");
          }
          if (g.taux !== undefined && g.taux < 100 && g.taux > 0) annoncer("Rendement réduit : " + g.taux + " %", "Tu approches du plafond du jour. Demain, le compteur repart plein.", "points");
          Son.jouer(g.vente ? "vente" : g.type === "geste" ? "piece" : "quete");
        }
        if (!felicite && g.type !== "geste") {
          Agents.feliciter(g.agent || null);
          felicite = true;
        }
      } else if (g.type === "cadeau") {
        if (leger) continue;
        ui.vue = "lieu";
        cadrer(false);
        setTimeout(() => {
          montrerElement(g.id, "studio");
          Son.jouer("achat");
        }, 700);
        ruban("Première quête", "Une plante verte arrive dans ton studio.", 4.5);
      } else if (g.type === "quete-ajoutee") {
        if (!leger) Son.jouer("pose");
      } else if (g.type === "contrat-signe") {
        annoncer(g.libelle, g.mise ? "Tu poses " + g.mise + " points sur la table. À toi de jouer." : "Rien à perdre. À toi de jouer.", "contrat");
        Son.jouer("contrat");
        const voisin = Agents.liste.find((x) => x.type === "maison");
        if (voisin) Agents.dire(voisin, g.choix === "ambitieux" ? "On le tient, ce contrat." : "Un contrat sûr, bien vu.", 3.5);
      } else if (g.type === "contrat") {
        if (leger) {
          annoncer(g.libelle, "+" + g.points + " points" + (g.colis ? ", et un colis." : "."), "contrat");
          continue;
        }
        ruban("Contrat tenu", "+" + g.points + " points" + (g.colis ? " · un colis arrive" : ""), 5);
        Rendu.confettis(p.x, p.y, 80);
        Rendu.pieces(p.x, p.y, 14, cibleEcran($("piece-compteur")));
        Rendu.texteFlottant(p.x, p.y - 10, "+" + g.points, "u");
        Rendu.secouer(0.4);
        feux(g.choix === "ambitieux" ? 7 : 3, 350);
        Agents.tousBravo(3.2);
        setTimeout(() => Son.jouer("tenu"), 250);
      } else if (g.type === "contrat-rate") {
        annoncer("Contrat non tenu cette fois", "La mise de " + g.mise + " points reste sur la table. Rien d'autre ne bouge. " + (g.hier ? "Aujourd'hui, nouveau choix." : "Tes quêtes paient toujours."), "contrat");
        if (!leger) Son.jouer("doux");
      } else if (g.type === "arrosage") {
        if (leger) continue;
        const plantes = plantesVisibles();
        for (const el of plantes) Rendu.gouttes(el.x + el.l / 2, el.y - 4);
        if (plantes.length) Agents.arroser(plantes[0].x + plantes[0].l / 2, plantes[0].n);
        annoncer("Plantes arrosées", "+" + g.bonus_pourcent + " % sur tes quêtes payées jusqu'à " + g.jusqua.replace(":", " h ") + ".", "goutte");
        Son.jouer("eau");
      } else if (g.type === "effort") {
        if (leger) {
          annoncer(g.libelle + " : c'est ouvert", g.condition, "cadenas");
          continue;
        }
        ruban(g.piece ? "Une pièce s'ouvre" : "Gagné par l'effort", g.libelle + " · " + g.condition, 5);
        ui.vue = "lieu";
        ui.lieuVu = g.cle.split("/")[0];
        cadrer(false);
        setTimeout(() => montrerElement(g.cle, g.cle.split("/")[0]), 900);
        Agents.tousBravo(2.4);
        setTimeout(() => Son.jouer("lieu"), 300);
      } else if ((g.type === "cran" || g.type === "specialite" || g.type === "trait") && !Panneaux.ouvert(etat, "equipe")) {
        continue; // l'équipe n'est pas encore présentée au joueur : la barre avance en silence
      } else if (g.type === "cran") {
        annoncer("But d'équipe : " + g.crans + " sur " + g.total, g.libelle, "equipe");
        if (!leger) {
          Agents.seFeliciter(g.crans, g.total);
          Son.jouer("cran");
          const bloc = $("bloc-equipe");
          bloc.classList.remove("pulse");
          void bloc.offsetWidth;
          bloc.classList.add("pulse");
        }
      } else if (g.type === "specialite") {
        if (!leger) annoncer(g.nom_agent + " est dans son élément", "Un coup de pouce de plus pour le but d'équipe.", "equipe");
      } else if (g.type === "trait") {
        // le même trait pour plusieurs agents d'un coup : une seule annonce, avec tous les noms
        const memes = gains.filter((x) => x.type === "trait" && x.libelle === g.libelle);
        if (memes.length > 1 && memes[0] !== g) continue;
        if (memes.length > 1) annoncer(memes.map((x) => x.nom_agent).join(", ").replace(/, ([^,]*)$/, " et $1") + " gagnent un trait : " + g.libelle, g.description, "equipe");
        else annoncer(g.nom_agent + " gagne un trait : " + g.libelle, g.description, "equipe");
        if (!leger) {
          const a = Agents.trouver(g.agent);
          if (a) {
            Agents.dire(a, "Nouveau trait : " + g.libelle + " !", 4);
            Rendu.etincelles(a.x, a.y - 14, 20);
          }
          Son.jouer("trait");
        }
      } else if (g.type === "but-atteint") {
        ruban("But d'équipe atteint", g.libelle + " · +" + g.points + " points", 6);
        if (!leger) {
          Rendu.confettis(p.x, p.y, 90);
          feux(8, 400);
          Agents.tousBravo(4);
          setTimeout(() => Son.jouer("jalon"), 300);
        }
      } else if (g.type === "retour") {
        annoncer("Content de te revoir", "Rien n'a bougé pendant ton absence. +" + g.points + " points pour ton retour.", "etat");
        setTimeout(() => {
          const q = positionToi();
          Rendu.pieces(q.x, q.y, 8, cibleEcran($("piece-compteur")));
          Agents.tousBravo(2.5);
          Son.jouer("quete");
        }, 900);
      } else if (g.type === "dimanche") {
        ruban("Semaine bouclée", "+" + g.points + " points · un fanion de plus sur le toit", 6);
        ui.vue = "immeuble";
        cadrer(false);
        feux(9, 500);
        Agents.tousBravo(4.5);
        setTimeout(() => Son.jouer("dimanche"), 200);
        setTimeout(() => {
          if (ui.vue === "immeuble" && !enDemenagement) {
            ui.vue = "lieu";
            cadrer(false);
          }
        }, 7000);
      } else if (g.type === "encaissement") {
        if (leger) continue;
        Rendu.confettis(p.x, p.y, 70);
        Rendu.pieces(p.x, p.y, 12, cibleEcran($("jauge")));
        Rendu.texteFlottant(p.x, p.y - 6, "+" + Panneaux.euros(g.montant), "u");
        Rendu.secouer(0.5);
        Agents.feliciter(null);
        for (let i = 0; i < 4; i++) setTimeout(() => Rendu.feu(Monde.X.murG + 40 + Math.random() * 260, -30 - Math.random() * 40), 250 + i * 380);
        annoncer("Encaissé : " + g.libelle, "Un trophée sur ton étagère. Un colis arrive.", "argent");
        Son.jouer("vente");
      } else if (g.type === "achat") {
        if (leger) continue;
        montrerElement(g.id, g.id.split("/")[0]);
        annoncer(g.libelle, "Installé. Tu peux le déplacer en mode rangement.", "boutique");
        Son.jouer("achat");
      } else if (g.type === "colis") {
        if (leger) continue;
        Rendu.etincelles(p.x + 20, p.y, 24);
        Son.jouer("pose");
        fenetreColis(g);
      } else if (g.type === "cap" && lieuAvant && lieuAvant !== etat.partie.lieu_courant) {
        ruban("Cap passé", g.libelle, 3.5);
        feux(5, 200);
        setTimeout(() => demenager(posteAvant, etat.lieux.find((l) => l.id === g.lieu)), 2600);
      }
    }
    for (const ev of evenements) {
      if (ev.type === "jalon") {
        if (leger) continue;
        annoncer(ev.objectif ? "Objectif du mois atteint : " + Panneaux.euros(ev.montant) : "Jalon passé : " + Panneaux.euros(ev.montant), ev.objectif ? "Tu l'as fait." : "La barre avance.", "etoile");
        feux(ev.objectif ? 8 : 3, 600);
        setTimeout(() => Son.jouer("jalon"), 500);
      } else if (ev.type === "badge") annoncer("Badge : " + ev.nom, "", "trophees");
      else if (ev.type === "lecteurs") {
        if (leger) continue;
        Agents.visiteurs(Math.min(ev.nombre, 4));
        annoncer(Panneaux.pluriel(ev.nombre, "lecteur passe", "lecteurs passent") + " te voir", "Tes quêtes d'édition attirent du monde.", "lettre");
      } else if (ev.type === "niveau") {
        if (etat.systeme && etat.systeme.actif && etat.systeme.eveille) annoncer("Nouveau titre : " + ev.nom, "Ton titre suit les points gagnés. Il ne redescend jamais.", "niveau");
        else annoncer("Niveau " + ev.rang + " : " + ev.nom, "Ton niveau suit ce que tu as gagné. Il ne redescend jamais.", "niveau");
        if (!leger) {
          Rendu.etincelles(p.x, p.y - 16, 30);
          setTimeout(() => Son.jouer("niveau"), 700);
        }
      } else if (ev.type === "deblocage" && !(ev.fonction === "etat" && etat.strategies.etats.length === 0)) deblocagesEnAttente.push(ev);
    }
  }

  // Déménagement : le camion arrive, les cartons montent, le nouveau lieu s'ouvre.
  function demenager(ancienPoste, lieu) {
    if (!lieu) return;
    enDemenagement = true;
    clearTimeout(minuteurRuban);
    const t = $("titre-evenement");
    t.innerHTML = '<div class="ruban">' + Panneaux.pixel("Déménagement", 3, "6") + '</div><div class="sous">Direction : ' + Panneaux.e(lieu.nom) + "</div>";
    hydrater(t);
    t.classList.add("visible");
    // le panneau se replie le temps du déménagement : on regarde l'immeuble entier
    const panneauAvant = ui.panneau;
    ui.panneau = null;
    majPanneau(true);
    ui.vue = "immeuble";
    cadrer(false);
    Son.jouer("lieu");
    const camion = { sprite: "camion", x: Monde.L + 120, y: Monde.YS + 44, cible: 250, miroir: true };
    vehicules.push(camion);
    const rect = Decor.cadreLieu(lieu.id);
    Rendu.poussiere(rect.x0, rect.x1, rect.y0 + 10, rect.y1 - 10);
    Rendu.confettis((rect.x0 + rect.x1) / 2, rect.y0 + 20, 60);
    let fini = false;
    const terminer = () => {
      if (fini) return;
      fini = true;
      camion.cible = -160;
      t.classList.remove("visible");
      enDemenagement = false;
      ui.vue = "lieu";
      ui.lieuVu = null;
      if (panneauAvant && !ui.panneau) {
        ui.panneau = panneauAvant;
        majPanneau(true);
      }
      cadrer(false);
      annoncer("Bienvenue : " + lieu.nom, lieu.sous_titre, "immeuble");
      Rendu.confettis(scene.toi.x, Monde.yNiveau(scene.toi.niveau) - 20, 50);
      setTimeout(() => {
        const i = vehicules.indexOf(camion);
        if (i !== -1) vehicules.splice(i, 1);
        if (etat) construireScene();
      }, 9000);
    };
    if (ancienPoste) Agents.demenagement(ancienPoste, scene.toi, terminer);
    setTimeout(terminer, 16000);
  }

  // ------------------------------------------------------------ gestes du joueur
  const ACTIONS = {
    panneau: (d) => ouvrirPanneau(d.panneau),
    "fermer-panneau": () => ouvrirPanneau(ui.panneau),
    "fermer-fenetre": fermerFenetre,
    commencer: () => {
      fermerFenetre();
      agir("/api/accueil/vu");
    },
    son: () => {
      Son.activer(!Son.actif);
      majBoutonSon();
      Son.jouer("piece");
      if (etat && etat.config.son !== Son.actif) agir("/api/reglages", { chemin: "son", valeur: Son.actif });
    },
    rafraichir: charger,
    zoom: (d) => Rendu.zoomer(Number(d.sens), innerWidth / 2, innerHeight / 2),
    vue: (d) => {
      ui.vue = d.vue;
      ui.lieuVu = null;
      cadrer(false);
    },
    valider: (d) => {
      ui.degreOuvert = null;
      return agir((d.type === "priorite" ? "/api/priorites/" : "/api/quetes/") + d.id + "/valider", d.degre ? { degre: Number(d.degre) } : {});
    },
    "ouvrir-degres": (d) => {
      ui.degreOuvert = ui.degreOuvert === d.id ? null : d.id;
      ui.typeOuvert = null;
      ui.choixAgent = null;
      ui.degresEdition = null;
      Son.jouer("clic");
      majPanneau(true);
    },
    "editer-degres": (d) => {
      ui.degresEdition = ui.degresEdition === d.id || !d.id ? null : d.id;
      ui.degreOuvert = null;
      majPanneau(true);
    },
    "ouvrir-type": (d) => {
      ui.typeOuvert = ui.typeOuvert === d.id ? null : d.id;
      ui.choixAgent = null;
      ui.degreOuvert = null;
      majPanneau(true);
    },
    "changer-type": (d) => {
      ui.typeOuvert = null;
      return agir("/api/quetes/" + d.id + "/type", { type: d.type });
    },
    reporter: (d) => agir("/api/quetes/" + d.id + "/reporter"),
    "retirer-quete": (d) => agir("/api/quetes/" + d.id + "/retirer"),
    arroser: () => agir("/api/arroser"),
    "contrat-matin": fenetreContrat,
    signer: (d) => {
      const heure = $("heure-contrat") ? $("heure-contrat").value : undefined;
      contratPropose = etat.date;
      fermerFenetre();
      return agir("/api/contrat", { choix: d.choix, heure });
    },
    dimanche: fenetreDimanche,
    cloturer: () => {
      const mot = $("mot-semaine") ? $("mot-semaine").value : "";
      fermerFenetre();
      return agir("/api/semaine/cloturer", { mot });
    },
    "editer-but": () => {
      ui.butEdition = !ui.butEdition;
      majPanneau(true);
    },
    reglages: (d) => fenetreReglages(d.section || null),
    "reglages-section": (d) => {
      ui.reglageSection = d.section;
      fenetreReglages();
    },
    "reglage-bascule": (d) => changerReglage(d.chemin, d.valeur === "oui"),
    "reglage-defaut": async (d) => {
      await agir("/api/reglages/defaut", { chemin: d.chemin });
      cleFond = "";
      if (etat) construireScene();
      fenetreReglages();
    },
    "reglages-tout-defaut": async () => {
      await agir("/api/reglages/tout-defaut");
      cleFond = "";
      if (etat) construireScene();
      fenetreReglages();
    },
    "tout-ouvrir": async (d) => {
      await agir("/api/deblocages/tout", { oui: d.oui === "oui" });
      fenetreReglages();
    },
    assistant: fenetreAssistant,
    "assistant-plus-tard": () => {
      fermerFenetre();
      return agir("/api/assistant", {});
    },
    "deblocage-vu": () => {
      deblocagesEnAttente.length = 0;
      majDeblocage();
      Son.jouer("clic");
    },
    "premiere-choisir": (d) => choisirPremiere(d.id),
    "premiere-changer": () => choisirPremiere("aucune"),
    "premiere-fait": (d) => agir((d.type === "priorite" ? "/api/priorites/" : "/api/quetes/") + d.id + "/valider", {}),
    annuler: (d) => agir("/api/paiements/" + d.id + "/annuler"),
    vente: (d) => agir("/api/quetes/" + d.id + "/vente", { vente: d.vente === "oui" }),
    "choisir-agent": (d) => {
      ui.choixAgent = ui.choixAgent === d.id ? null : d.id;
      ui.typeOuvert = null;
      ui.degreOuvert = null;
      majPanneau(true);
    },
    confier: async (d) => {
      ui.choixAgent = null;
      const r = await agir("/api/quetes/" + d.id + "/confier", { agent: d.agent || null });
      if (r && d.agent) {
        const q = etat.quetes.find((x) => x.id === d.id) || etat.jours.flatMap((j) => j.priorites).find((x) => x.id === d.id);
        Agents.confier(d.agent, q ? Police.abreger(q.texte, 150) : "");
        Son.jouer("clic");
      }
    },
    source: (d, el) => {
      const form = el.closest("form");
      form.querySelector('[name="source"]').value = d.source;
      form.querySelectorAll(".sources button").forEach((b) => b.classList.toggle("choisie", b === el));
    },
    editer: (d) => {
      ui.editer = d.id || null;
      ui.supprimer = null;
      majPanneau(true);
    },
    supprimer: (d) => {
      ui.supprimer = d.id || null;
      majPanneau(true);
    },
    "supprimer-oui": (d) => {
      ui.supprimer = null;
      agir("/api/encaissements/" + d.id + "/supprimer");
    },
    acheter: (d) => agir("/api/ameliorations/acheter", { lieu: d.lieu, id: d.id }),
    "acheter-deco": (d) => agir("/api/objets/acheter", { id: d.id }),
    "lieu-boutique": (d) => {
      ui.lieuBoutique = d.lieu;
      ui.surligne = null;
      majPanneau(true);
    },
    replacer: (d) => agir("/api/placements", { cle: d.cle, defaut: true }),
    montrer: (d) => {
      const el = scene.rangeables.find((x) => x.cle === d.cle);
      if (!el) return;
      ui.vue = "lieu";
      ui.lieuVu = Monde.ZONES[el.zone].lieu;
      cadrer(false);
      Rendu.etincelles(el.x + el.l / 2, el.y + el.h / 2, 14);
    },
    avatar: (d) => {
      const corps = {};
      corps[d.champ] = d.champ === "barbe" || d.champ === "lunettes" ? d.valeur === "oui" : Number(d.valeur);
      agir("/api/avatar", corps);
    },
    mission: fenetreMission,
    "voir-lieu": (d) => {
      ui.vue = "lieu";
      ui.lieuVu = d.lieu;
      cadrer(false);
    },
    cap: (d) => fenetreCap(d.cap),
    "cap-oui": (d) => {
      const date = $("date-cap") ? $("date-cap").value : "";
      fermerFenetre();
      agir("/api/caps/" + d.cap + "/cocher", { date });
    },
    "corriger-cap": (d) => agir("/api/caps/" + d.cap + "/decocher"),
    etat: (d) => {
      const rang = Number(d.rang);
      ui.etatOuvert = rang;
      if (rang >= 0 && etat.strategies.etats[rang]) agir("/api/etats", { titre: etat.strategies.etats[rang].titre });
      else majPanneau(true);
    },
    geste: (d) => agir("/api/gestes/" + d.id + "/cocher"),
    "remise-a-zero": async () => {
      try {
        Agents.reinitialiser();
        premier = true;
        pointsAffiches = null;
        cleFond = "";
        const r = await api("POST", "/api/test/reinitialiser");
        etat = null;
        appliquer(r.etat);
      } catch (err) {
        annoncer(err.message, "", "erreur");
      }
    },
    "ranger-objet": () => {
      fermerFenetre();
      if (ui.panneau !== "ranger") ouvrirPanneau("ranger");
    },
  };

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-action]");
    if (!el) {
      if (ev.target === $("modale")) fermerFenetre();
      return;
    }
    const action = ACTIONS[el.dataset.action];
    if (action) {
      ev.preventDefault();
      action(el.dataset, el);
    }
  });

  document.addEventListener("submit", async (ev) => {
    const form = ev.target.closest("[data-formulaire]");
    if (!form) return;
    ev.preventDefault();
    const genre = form.dataset.formulaire;
    if (genre === "quete" || genre === "premiere") {
      const texte = form.texte.value.trim();
      if (!texte) return;
      const type = form.type ? form.type.value : "";
      document.activeElement.blur();
      ui.ajout = null;
      const r = await agir("/api/quetes/ajouter", { texte, type: type || undefined });
      if (r && genre === "premiere") {
        const ajoutee = (r.gains || []).find((g) => g.type === "quete-ajoutee");
        if (ajoutee) choisirPremiere(ajoutee.id);
      } else if (!r) ui.ajout = { texte, type };
      majPanneau(true);
      return;
    }
    if (genre === "degres") {
      document.activeElement.blur();
      const r = await agir("/api/quetes/" + form.dataset.id + "/degres", { degres: [form.d0.value, form.d1.value, form.d2.value] });
      if (r) {
        ui.degresEdition = null;
        majPanneau(true);
      }
      return;
    }
    if (genre === "but") {
      document.activeElement.blur();
      const r = await agir("/api/equipe/but", { libelle: form.libelle.value });
      if (r) {
        ui.butEdition = false;
        majPanneau(true);
      }
      return;
    }
    if (genre === "assistant") {
      const corps = { joueur: form.joueur.value, enseigne: form.enseigne.value, monnaie: form.monnaie.value, objectif_mensuel: form.objectif_mensuel.value, but: form.but.value, rythme: form.rythme.value };
      const r = await agir("/api/assistant", corps);
      if (r) {
        fermerFenetre();
        cleFond = "";
        construireScene();
        annoncer("C'est noté" + (etat.config.joueur ? ", " + etat.config.joueur : ""), "Tout se change dans Réglages, en haut à droite.", "etoile");
        Son.jouer("tenu");
      }
      return;
    }
    const corps = { montant: form.montant.value, date: form.date.value, source: form.source.value, note: form.note.value };
    if (genre === "declarer") {
      ui.formulaire = corps;
      document.activeElement.blur();
      const r = await agir("/api/encaissements", corps);
      if (r) {
        ui.formulaire = null;
        majPanneau(true);
      }
    } else {
      document.activeElement.blur();
      const r = await agir("/api/encaissements/" + form.dataset.id + "/modifier", corps);
      if (r) {
        ui.editer = null;
        majPanneau(true);
      }
    }
  });

  // Réglages : chaque champ s'enregistre dès qu'il change.
  document.addEventListener("change", (ev) => {
    const champ = ev.target.closest("[data-reglage]");
    if (champ) changerReglage(champ.dataset.reglage, champ.value);
  });

  document.addEventListener("toggle", (ev) => {
    if (ev.target.dataset && ev.target.dataset.pli) ui.plis[ev.target.dataset.pli] = ev.target.open;
  }, true);

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && ev.target.matches && ev.target.matches("[data-reglage]")) ev.target.blur();
    if (ev.key !== "Escape") return;
    if (!$("modale").hidden) fermerFenetre();
    else if (prise) lacher();
    else if (ui.panneau) ouvrirPanneau(ui.panneau);
  });

  // ------------------------------------------------------------ souris dans l'immeuble
  const cadre = $("cadre");
  let appui = null;
  let glisse = false;

  function lacher() {
    prise = null;
    Rendu.definirRangement(ui.panneau === "ranger" ? { actif: true, prise: null } : null);
  }

  function infobulle(texte, x, y) {
    const b = $("infobulle");
    if (!texte) {
      b.style.display = "none";
      return;
    }
    b.innerHTML = texte;
    b.style.display = "block";
    b.style.left = Math.min(innerWidth - 270, x + 14) + "px";
    b.style.top = Math.max(94, y - 34) + "px";
  }

  function texteSurvol(c) {
    const e = Panneaux.e;
    if (!c) return "";
    if (c.type === "agent") {
      const a = c.agent;
      if (a.type === "toi") return "<b>Toi</b>" + (etat.partie.etat_du_jour ? " · " + e(etat.partie.etat_du_jour.titre) : "");
      if (a.type === "maison") return "<b>" + e(a.nom) + "</b> · agent, " + e(a.role || "") + (a.quete ? "<br>Avec toi sur : " + e(a.texteQuete) : "<br>Libre pour t'accompagner sur une quête") + (a.nom_specialite ? "<br>Dans son élément : " + e(a.nom_specialite.toLowerCase()) : "");
      if (a.type === "collegue") return "<b>" + e(a.nom) + "</b><br>" + e(a.actif ? a.action || "travaille" : "en pause") + (a.renforts ? " · " + Panneaux.pluriel(a.renforts, "renfort", "renforts") : "");
      if (a.type === "visiteur") return "Un lecteur de ta newsletter";
      return "Le livreur";
    }
    if (c.type === "colis") return "<b>Colis surprise</b><br>Clique pour l'ouvrir";
    if (c.type === "fantome") {
      const effort = etat.efforts.find((x) => x.cle === c.cle);
      return "<b>" + e(c.nom) + "</b>" + (effort ? "<br>Par l'effort : " + e(effort.libelle) + " (" + effort.valeur + " sur " + effort.seuil + ")" : " · " + c.prix + " points<br>Clique pour voir en boutique");
    }
    if (c.type === "piece") {
      const p = Monde.PIECES.find((x) => x.id === c.id);
      const effort = etat.efforts.find((x) => x.cle === c.lieu + "/" + c.amelioration);
      return "<b>" + e(p.nom) + "</b><br>" + (effort ? "Pièce fermée. Elle s'ouvre par l'effort : " + e(effort.libelle) + " (" + effort.valeur + " sur " + effort.seuil + ")" : "Pièce fermée. Clique pour l'ouvrir en boutique");
    }
    if (c.type === "lieu") {
      const l = etat.lieux.find((x) => x.id === c.id);
      return "<b>" + e(l.nom) + "</b><br>" + (l.cap ? "Cap : " + e(l.cap.libelle) : "");
    }
    if (c.type === "mission") return "<b>Ta mission</b><br>" + e(etat.mission.phrase || "Clique pour la lire");
    if (c.type === "trophees") return "<b>Étagère à trophées</b><br>" + Panneaux.pluriel(etat.trophees.length, "vente", "ventes");
    if (c.type === "objet") {
      const plante = PLANTES.includes(c.el.sprite) && Panneaux.ouvert(etat, "arrosage") && ui.panneau !== "ranger";
      return "<b>" + e(c.el.nom || c.el.sprite) + "</b>" + (ui.panneau === "ranger" ? "<br>Clique pour le déplacer" : plante ? (etat.arrosage.fait_aujourdhui ? "<br>Arrosée aujourd'hui" : "<br>Clique pour arroser : +" + etat.arrosage.bonus_pourcent + " % pendant " + etat.arrosage.duree_h + " h") : "");
    }
    return "";
  }

  cadre.addEventListener("pointerdown", (ev) => {
    appui = { x: ev.clientX, y: ev.clientY };
    glisse = false;
  });
  addEventListener("pointerup", () => {
    appui = null;
    cadre.classList.remove("saisie");
  });
  cadre.addEventListener("pointermove", (ev) => {
    if (appui && (glisse || Math.hypot(ev.clientX - appui.x, ev.clientY - appui.y) > 5)) {
      if (!glisse) {
        glisse = true;
        cadre.classList.add("saisie");
        infobulle("");
      }
      Rendu.deplacer(ev.clientX - appui.x, ev.clientY - appui.y);
      appui = { x: ev.clientX, y: ev.clientY };
      return;
    }
    if (!etat) return;
    if (prise) {
      const pos = Rendu.positionRangement(ev.clientX, ev.clientY, prise.el);
      if (pos) {
        prise = { ...prise, ...pos };
        Rendu.definirRangement({ actif: true, prise });
      }
      infobulle(prise.valide ? "Clique pour poser" : "Pas de place ici", ev.clientX, ev.clientY);
      return;
    }
    const c = Rendu.cible(ev.clientX, ev.clientY);
    Rendu.definirSurvol(c);
    cadre.classList.toggle("vise", Boolean(c));
    infobulle(texteSurvol(c), ev.clientX, ev.clientY);
  });
  cadre.addEventListener("pointerleave", () => {
    infobulle("");
    Rendu.definirSurvol(null);
  });

  cadre.addEventListener("click", async (ev) => {
    if (glisse || !etat) return;
    if (prise) {
      if (!prise.valide) return Son.jouer("erreur");
      const p = prise;
      lacher();
      Son.jouer("pose");
      const r = await agir("/api/placements", { cle: p.cle, zone: p.zone, x: p.x });
      if (r) Rendu.poussiere(p.x, p.x + p.l, p.y + p.h - 3, p.y + p.h);
      return;
    }
    const c = Rendu.cible(ev.clientX, ev.clientY);
    if (!c) return;
    Son.jouer("clic");
    if (c.type === "colis") agir("/api/colis/" + c.id + "/ouvrir");
    else if (c.type === "fantome" || c.type === "piece") {
      const cle = c.type === "piece" ? c.lieu + "/" + c.amelioration : c.cle;
      const effort = etat.efforts.find((x) => x.cle === cle);
      if (effort) annoncer(effort.nom + " : par l'effort", effort.libelle + ". Tu en es à " + effort.valeur + " sur " + effort.seuil + ".", "cadenas");
      else if (panneauOuvert("boutique")) ouvrirPanneau("boutique", { lieu: c.lieu, surligne: cle, garder: true });
      else ouvrirPanneau("boutique");
    }
    else if (c.type === "lieu") ouvrirPanneau("carte", { garder: true });
    else if (c.type === "mission") fenetreMission();
    else if (c.type === "trophees") ouvrirPanneau("trophees", { garder: true });
    else if (c.type === "objet" && ui.panneau === "ranger") {
      const pos = Rendu.positionRangement(ev.clientX, ev.clientY, c.el);
      prise = { el: c.el, ...pos };
      Rendu.definirRangement({ actif: true, prise });
    } else if (c.type === "objet" && PLANTES.includes(c.el.sprite) && Panneaux.ouvert(etat, "arrosage")) {
      if (etat.arrosage.fait_aujourdhui) Agents.dire(Agents.trouver("toi"), "Déjà arrosées aujourd'hui.", 2.5);
      else agir("/api/arroser");
    } else if (c.type === "agent") {
      const a = c.agent;
      if (a.type === "toi") Agents.dire(a, phraseDeToi(), 3.5);
      else if (a.type === "maison") Agents.dire(a, a.quete ? "Je suis avec toi sur : " + a.texteQuete : phraseAgent(a), 3.5);
      else if (a.type === "collegue") Agents.dire(a, a.actif ? a.action || "travaille" : "en pause", 3);
    }
  });

  function phraseDeToi() {
    const k = etat.contrat.du_jour;
    if (k && k.statut === "en_cours") return k.choix === "ambitieux" ? "Contrat ambitieux en cours. Avant " + k.heure_limite_libelle + "." : "Contrat sûr en cours.";
    if (etat.du_jour.visibles.length) return Panneaux.pluriel(etat.du_jour.visibles.length, "quête m'attend", "quêtes m'attendent") + ".";
    return "Rien d'ouvert. Belle journée.";
  }
  function phraseAgent(a) {
    const eq = etat.equipe;
    const choix = ["Confie-moi une quête : bouton « avec qui ? »"];
    if (Panneaux.ouvert(etat, "equipe")) {
      choix.push(eq.atteint ? "But d'équipe atteint. Beau travail, tous." : "But d'équipe : " + eq.crans + " sur " + eq.total + ".");
      if (a.nom_specialite) choix.push("Mon élément : " + a.nom_specialite.toLowerCase() + ".");
    }
    return choix[Math.floor(Math.random() * choix.length)];
  }
  // De temps en temps, un agent commente le but commun ou le contrat du jour.
  function motDAmbiance() {
    if (!etat || etat.fonctions.premiere_minute || enDemenagement) return;
    const maison = Agents.liste.filter((a) => a.type === "maison" && !a.bulle && a.mode === "assis");
    if (!maison.length) return;
    const a = maison[Math.floor(Math.random() * maison.length)];
    const eq = etat.equipe;
    const k = etat.contrat.du_jour;
    const phrases = [];
    if (Panneaux.ouvert(etat, "equipe")) {
      if (eq.atteint) phrases.push("On l'a fait ensemble.", "Semaine réussie, l'équipe.");
      else {
        phrases.push("Encore " + eq.reste_cran + " pour le prochain cran.", eq.crans + " sur " + eq.total + ", on avance.", "Le but : " + Police.abreger(eq.libelle, 110));
        if (eq.crans >= eq.total - 2) phrases.push("On y est presque !");
      }
    }
    if (k && k.statut === "en_cours") phrases.push(k.choix === "ambitieux" ? "Avant " + k.heure_limite_libelle + ", hein ?" : "Le contrat tient toujours.");
    if (etat.arrosage.actif) phrases.push("Les plantes sont en fleurs.");
    if (!phrases.length) return;
    Agents.dire(a, phrases[Math.floor(Math.random() * phrases.length)], 3.6);
  }

  let derniereMolette = 0;
  cadre.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const maintenant = performance.now();
    if (maintenant - derniereMolette < 140) return;
    derniereMolette = maintenant;
    Rendu.zoomer(ev.deltaY < 0 ? 1 : -1, ev.clientX, ev.clientY);
  }, { passive: false });

  addEventListener("resize", () => cadrer(true));

  // ------------------------------------------------------------ boucle
  Agents.ecouter((type) => {
    if (type === "colis-pose") {
      Son.jouer("pose");
      annoncer("Un colis t'attend", "Clique dessus pour l'ouvrir.", "boutique");
    }
  });

  Rendu.initialiser($("scene"));
  hydrater(document);

  let avant = performance.now();
  let derniereSeconde = 0;
  function boucle(maintenant) {
    const dt = Math.min(0.1, (maintenant - avant) / 1000);
    avant = maintenant;
    temps += dt;
    if (etat) {
      if (temps - derniereSeconde > 1) {
        derniereSeconde = temps;
        majHeure();
      }
      for (const v of vehicules) {
        const d = v.cible - v.x;
        if (Math.abs(d) > 1) v.x += Math.sign(d) * Math.min(Math.abs(d), 90 * dt);
      }
      Rendu.definirVehicules(vehicules, Agents.liste.some((a) => a.type === "livreur"));
      // de temps en temps, un lecteur passe voir où naît la newsletter
      if (temps > prochainLecteur) {
        prochainLecteur = temps + 150 + Math.random() * 180;
        if (etat.newsletter.lecteurs > 0 && !enDemenagement && !Agents.liste.some((a) => a.type === "visiteur")) Agents.visiteurs(1);
      }
      if (temps > prochainMot) {
        prochainMot = temps + 38 + Math.random() * 40;
        motDAmbiance();
      }
      Agents.maj(dt, temps);
      Rendu.dessiner(temps, dt);
      majCompteur();
    }
    requestAnimationFrame(boucle);
  }
  requestAnimationFrame(boucle);

  // Relecture du coffre et des collègues, en pause quand l'onglet est caché.
  let minuteurEtat = null;
  let minuteurCollegues = null;
  function programmer() {
    clearInterval(minuteurEtat);
    clearInterval(minuteurCollegues);
    if (document.hidden) return;
    const periode = ((etat && etat.config.rafraichissement_s) || 30) * 1000;
    minuteurEtat = setInterval(() => {
      if ($("modale").hidden && !prise && !enDemenagement && !(racineTour() && racineTour().actif)) charger();
    }, periode);
    minuteurCollegues = setInterval(async () => {
      if (!etat || prise) return;
      try {
        etat.collegues = await api("GET", "/api/collegues");
        construireScene();
      } catch (err) {
        // le prochain passage réessaiera
      }
    }, 10000);
  }
  document.addEventListener("visibilitychange", () => {
    programmer();
    if (!document.hidden) charger();
  });

  charger().then(() => {
    programmer();
    // scènes de démonstration, pour les captures : ?scene=demenagement ou ?scene=fete
    const sc = params.get("scene");
    if (sc === "demenagement" && etat) {
      const lieux = etat.lieux.filter((l) => l.ouvert);
      const avantDernier = lieux[lieux.length - 2];
      const poste = avantDernier ? { x: (Decor.cadreLieu(avantDernier.id).x0 + Decor.cadreLieu(avantDernier.id).x1) / 2, niveau: Math.max(...Object.values(Monde.ZONES).filter((z) => z.lieu === avantDernier.id).map((z) => z.niveau)) } : scene.toi;
      demenager(poste, lieux[lieux.length - 1]);
    } else if (sc === "fete" && etat) {
      const p = positionToi();
      Rendu.confettis(p.x, p.y, 70);
      Rendu.pieces(p.x, p.y, 10, cibleEcran($("piece-compteur")));
      Rendu.texteFlottant(p.x, p.y, "+30", "c");
      Agents.feliciter(null);
      Agents.visiteurs(3);
      for (let i = 0; i < 5; i++) setTimeout(() => Rendu.feu(Monde.X.murG + 40 + Math.random() * 260, -30 - Math.random() * 40), 200 + i * 300);
    }
    document.documentElement.dataset.pret = "1";
    if (TOUR && window.Tour) window.Tour.lancer();
  });

  // Ce que la visite guidée de la démo a le droit d'appeler.
  window.App = {
    agir,
    etat: () => etat,
    ouvrirPanneau: (nom) => {
      if (ui.panneau !== nom) ouvrirPanneau(nom);
    },
    fermerPanneau: () => {
      if (ui.panneau) ouvrirPanneau(ui.panneau);
    },
    fermerFenetre,
    fenetreContrat,
    fenetreDimanche,
    fenetreReglages,
    annoncer,
    ruban,
    majPanneau: () => majPanneau(true),
    hydrater,
    // une petite fête autour de toi, pour les grands moments du Système
    fete: (n) => {
      const p = positionToi();
      Rendu.confettis(p.x, p.y, n || 30);
      Agents.feliciter(null);
    },
    vue: (nom, lieu) => {
      ui.vue = nom;
      ui.lieuVu = lieu || null;
      cadrer(false);
    },
    ouvrirDegres: (id) => {
      ui.degreOuvert = id;
      majPanneau(true);
    },
    demo: DEMO,
  };
})();
