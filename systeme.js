"use strict";
// Le Système (version 4) côté écran : le panneau à onglets, le bandeau (niveau, rang, points de vie, or)
// et les fenêtres bleues qui annoncent ce qui t'arrive. Les gestes partent vers /api/systeme/...
// Tout le calcul est fait par le serveur (serveur/systeme.js) : ici, on affiche.
(function (racine) {
  const P = racine.Panneaux;
  const e = P.e;
  const sprite = P.sprite;
  const pluriel = P.pluriel;
  const $ = (id) => document.getElementById(id);

  const ONGLETS = [
    ["fiche", "Fiche"],
    ["jour", "Rituels"],
    ["donjons", "Donjons"],
    ["ombres", "Ombres"],
    ["sac", "Sac"],
    ["studio", "Studio"],
  ];
  const ui = { onglet: "fiche", formulaire: null };
  const ICONE_STAT = { force: "icone-coeur", endurance: "icone-cadenas", intelligence: "icone-loupe", charisme: "icone-equipe", creativite: "icone-etoile" };
  const ICONE_GENRE = { outil: "icone-contrat", tenue: "icone-avatar", talisman: "icone-etoile", potion: "icone-fiole", nourriture: "icone-colis", oeuf: "icone-oeuf" };

  function sys(etat) {
    return etat && etat.systeme && etat.systeme.actif ? etat.systeme : null;
  }

  function barre(valeur, max, classe, texte) {
    const p = max > 0 ? Math.max(0, Math.min(100, Math.round((valeur / max) * 100))) : 0;
    return '<span class="sys-barre ' + classe + '" role="progressbar" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + valeur + '"><i style="width:' + p + '%"></i><b>' + e(texte) + "</b></span>";
  }

  function bouton(chemin, libelle, options) {
    const o = options || {};
    return '<button type="button" class="bouton ' + (o.classe || "second mini") + '" data-sys="' + e(chemin) + '"' + (o.corps ? " data-corps='" + e(JSON.stringify(o.corps)) + "'" : "") + (o.inactif ? " disabled" : "") + (o.titre ? ' title="' + e(o.titre) + '"' : "") + ">" + e(libelle) + "</button>";
  }

  function choixStat(s, nom, valeur) {
    return '<select name="' + nom + '" aria-label="Statistique entraînée">' + s.stats.map((x) => '<option value="' + x.id + '"' + (x.id === valeur ? " selected" : "") + ">" + e(x.nom) + "</option>").join("") + "</select>";
  }

  function nomStat(s, id) {
    const x = s.stats.find((y) => y.id === id);
    return x ? x.nom : "";
  }

  // ------------------------------------------------------------ onglets du panneau

  function fiche(s) {
    const h = s.hud;
    let t = '<div class="sys-carte sys-fiche"><div class="sys-rang rang-' + h.rang + '"><span>' + e(h.rang) + "</span><small>rang</small></div><div class=\"sys-fiche-droite\">";
    t += "<p><b>Niveau " + h.niveau + "</b>" + (h.prestige ? " · prestige " + h.prestige : "") + (h.rang_suivant ? ' <small>rang ' + e(h.rang_suivant.id) + " au niveau " + h.rang_suivant.niveau + "</small>" : " <small>rang le plus haut</small>") + "</p>";
    t += barre(h.xp_niveau, h.xp_suivant, "xp", "Expérience " + h.xp_niveau + " sur " + h.xp_suivant);
    t += barre(h.pv, h.pv_max, "pv", "Points de vie " + h.pv + " sur " + h.pv_max);
    t += '<p class="sys-ligne">' + sprite("icone-points", 2) + " <b>" + h.or + "</b> or" + (h.repos ? " · mode repos" : "") + "</p></div></div>";
    if (s.penalite) t += '<div class="sys-carte sys-penalite"><b>Zone de pénalité</b><p>' + e(s.penalite.texte) + "</p>" + barre(s.penalite.fait, s.penalite.a_faire, "penalite", s.penalite.fait + " sur " + s.penalite.a_faire) + "</div>";
    if (s.studio.evenement && s.studio.evenement.choix && s.studio.evenement.choisi === null) t += evenement(s);
    t += defi(s);
    t += "<h2>Statistiques" + (h.points_stats ? ' <span class="sys-pastille">' + pluriel(h.points_stats, "point à poser", "points à poser") + "</span>" : "") + "</h2>";
    t += '<div class="sys-stats">';
    for (const x of s.stats) {
      t += '<div class="sys-stat">' + sprite(ICONE_STAT[x.id], 2) + '<span class="sys-stat-nom"><b>' + e(x.nom) + "</b><small>" + e(x.effet) + "</small><small>Pratique : " + x.pratique + " sur " + x.pratique_seuil + " avant le prochain point</small></span>";
      t += '<span class="sys-stat-valeur">' + x.total + (x.bonus ? "<small>dont +" + x.bonus + "</small>" : "") + "</span>";
      t += bouton("stats/" + x.id + "/augmenter", "+1", { classe: "mini" + (h.points_stats ? "" : " second"), inactif: !h.points_stats, titre: h.points_stats ? "Poser un point" : "Les points arrivent à chaque niveau" }) + "</div>";
    }
    t += "</div>";
    t += '<p class="petit">Bonus en cours : +' + s.bonus.xp + " % d'expérience, +" + s.bonus.or + " % d'or, " + s.bonus.butin + " % de chance de butin par quête, " + s.bonus.reduc + " % de dégâts en moins, +" + s.bonus.boss + " dégâts sur les boss.</p>";
    t += "<h2>Équipement</h2><div class=\"sys-liste\">";
    for (const [cle, nom] of [["outil", "Outil"], ["tenue", "Tenue"], ["talisman", "Talisman"]]) {
      const o = s.equipement[cle];
      t += '<div class="sys-ligne-objet">' + sprite(ICONE_GENRE[cle], 2) + "<span><b>" + nom + " : " + (o ? e(o.nom) : "rien") + "</b><small>" + (o ? e(o.description) : "Le butin des quêtes en apporte. Il s'équipe depuis le Sac.") + "</small></span></div>";
    }
    t += "</div><h2>Familiers</h2><div class=\"sys-liste\">";
    for (const f of s.familiers) {
      t += '<div class="sys-ligne-objet' + (f.present ? "" : " absent") + '">' + sprite("icone-oeuf", 2) + "<span><b>" + (f.present ? e(f.nom) : "???") + "</b><small>" + (f.present ? e(f.effet) + (f.actif ? " · il t'accompagne" : "") : "Un œuf à trouver en butin, et trois miettes de brioche.") + "</small></span>" + (f.present ? bouton("familiers/" + f.id + "/choisir", f.actif ? "Laisser au nid" : "Emmener") : "") + "</div>";
    }
    t += "</div>";
    t += '<details class="sys-aide"' + (ui.aide ? " open" : "") + '><summary>Comment marche le Système ?</summary><p>Chaque quête faite, payée ou racontée, te donne de l\'expérience et de l\'or. L\'expérience fait monter ton niveau, et ton niveau ton rang, de E à S.</p><p>Chaque niveau donne des points de statistiques à poser. La pratique en donne aussi : les quêtes d\'un même type font grandir leur statistique.</p><p>Tes points de vie baissent quand tu laisses une quotidienne un jour où tu joues, ou quand tu notes une habitude à lâcher. Un jour de grâce par semaine protège tes séries. À zéro, tu entres en zone de pénalité : quelques quêtes, et tu en sors. Tu ne perds jamais d\'expérience, d\'or ni d\'objet, et une absence ne coûte rien.</p><p>L\'or paie tes récompenses, le marchand et les équipiers. Tout se règle dans Réglages, section « Le Système ».</p></details>';
    return t;
  }

  // L'événement du jour. Certains laissent choisir entre deux suites : les deux sont bonnes à prendre.
  function evenement(s) {
    const ev = s.studio && s.studio.evenement;
    if (!ev) return "";
    let t = '<div class="sys-carte sys-evenement"><b>' + e(ev.titre) + "</b><p>" + e(ev.texte) + (ev.suite ? " " + e(ev.suite) : "") + "</p>";
    if (ev.choix && ev.choisi === null) {
      t += '<div class="sys-choix">';
      ev.choix.forEach((c, i) => {
        t += '<button type="button" class="bouton second" data-sys="evenement/choisir" data-corps=\'{"choix":' + i + "}'><b>" + e(c.libelle) + "</b><small>" + e(c.effet) + "</small></button>";
      });
      t += "</div>";
    } else if (ev.choix) t += '<p class="petit">Ton choix : ' + e(ev.choix[ev.choisi].libelle) + " (" + e(ev.choix[ev.choisi].effet) + ").</p>";
    return t + "</div>";
  }

  // Le défi du jour : quelques quêtes, une récompense connue d'avance.
  function defi(s) {
    const d = s.defi;
    if (!d) return "";
    return '<div class="sys-carte sys-defi' + (d.reussi ? " reussi" : "") + '"><b>Défi du jour' + (d.reussi ? " : réussi" : "") + "</b>" + barre(d.fait, d.objectif, "xp", pluriel(d.fait, "quête", "quêtes") + " sur " + d.objectif) + '<p class="petit">' + (d.reussi ? "Récompense reçue. Un nouveau défi demain." : "À la clé : " + d.or + " or" + (d.butin ? " et un butin" : "") + ". Le manquer ne coûte rien.") + "</p></div>";
  }

  function rituels(s) {
    let t = defi(s);
    if (s.penalite) t += '<div class="sys-carte sys-penalite"><b>Zone de pénalité</b><p>' + e(s.penalite.texte) + "</p></div>";
    t += "<h2>Quotidiennes</h2>";
    t += '<p class="petit">À faire chaque jour où tu joues. Une quotidienne laissée te coûte quelques points de vie. Les jours où tu n\'ouvres pas le jeu ne comptent pas.</p>';
    t += '<div class="sys-liste">';
    for (const q of s.quotidiennes) {
      t += '<div class="sys-ligne-objet' + (q.faite ? " fait" : "") + '">';
      t += '<button type="button" class="sys-case' + (q.faite ? " cochee" : "") + '" data-sys="quotidiennes/' + e(q.id) + '/cocher"' + (q.faite ? " disabled" : "") + ' aria-label="' + (q.faite ? "Faite aujourd\'hui" : "Cocher : " + e(q.texte)) + '"></button>';
      t += "<span><b>" + e(q.texte) + "</b><small>" + e(nomStat(s, q.stat)) + " · série de " + pluriel(q.serie, "jour", "jours") + (q.record > q.serie ? " (record " + q.record + ")" : "") + (q.ombre ? " · devenue une ombre" : "") + "</small></span>";
      if (q.recrutable) t += bouton("quotidiennes/" + q.id + "/recruter", "Lever l'ombre", { classe: "mini sys-violet" });
      t += '<button type="button" class="sys-retirer" data-sys="quotidiennes/' + e(q.id) + '/retirer" title="Retirer cette quotidienne" aria-label="Retirer">x</button></div>';
    }
    if (!s.quotidiennes.length) t += '<p class="petit">Aucune quotidienne. Commence par une seule, toute petite.</p>';
    t += "</div>";
    t += '<form class="sys-form" data-sys-form="quotidiennes/ajouter"><input name="texte" maxlength="80" placeholder="Une quotidienne (dix minutes de marche...)" aria-label="Nouvelle quotidienne" required>' + choixStat(s, "stat", "endurance") + '<button type="submit" class="bouton mini">Ajouter</button></form>';
    t += '<p class="sys-ligne">' + bouton("repos", s.repos ? "Finir le repos" : "Mode repos", { corps: { oui: !s.repos } }) + ' <small class="petit">' + (s.repos ? "Tes quotidiennes sont en pause." : "Vacances, maladie, coup de mou : mets tes quotidiennes en pause.") + "</small></p>";
    t += "<h2>Habitudes</h2>";
    t += '<p class="petit">Un plus quand tu la tiens, un moins quand tu cèdes.' + (s.plafonds && s.plafonds.habitude_par_jour ? " Chaque habitude compte " + s.plafonds.habitude_par_jour + " fois par jour dans chaque sens. Ensuite elle est notée, sans effet." : " Autant de fois que tu veux dans la journée.") + '</p><div class="sys-liste">';
    for (const h of s.habitudes) {
      t += '<div class="sys-ligne-objet">';
      if (h.sens.includes("+")) t += '<button type="button" class="sys-pm plus" data-sys="habitudes/' + e(h.id) + '/noter" data-corps=\'{"sens":"+"}\' aria-label="Noter un plus">+</button>';
      t += "<span><b>" + e(h.texte) + "</b><small>" + e(nomStat(s, h.stat)) + " · " + h.plus + " en plus, " + h.moins + " en moins</small></span>";
      if (h.sens.includes("-")) t += '<button type="button" class="sys-pm moins" data-sys="habitudes/' + e(h.id) + '/noter" data-corps=\'{"sens":"-"}\' aria-label="Noter un moins">-</button>';
      t += '<button type="button" class="sys-retirer" data-sys="habitudes/' + e(h.id) + '/retirer" title="Retirer cette habitude" aria-label="Retirer">x</button></div>';
    }
    if (!s.habitudes.length) t += '<p class="petit">Aucune habitude pour l\'instant.</p>';
    t += "</div>";
    t += '<form class="sys-form" data-sys-form="habitudes/ajouter"><input name="texte" maxlength="80" placeholder="Une habitude (boire un verre d\'eau...)" aria-label="Nouvelle habitude" required><select name="sens" aria-label="Sens"><option value="+">à tenir (+)</option><option value="-">à lâcher (-)</option><option value="+-">les deux</option></select>' + choixStat(s, "stat", "endurance") + '<button type="submit" class="bouton mini">Ajouter</button></form>';
    t += "<h2>Fil du Système</h2>" + fil(s.fil);
    return t;
  }

  function fil(liste) {
    if (!liste || !liste.length) return '<p class="petit">Rien encore. Le fil se remplit quand tu joues.</p>';
    let t = '<div class="sys-fil">';
    for (const f of liste.slice(0, 14)) t += "<p><b>" + e(f.titre) + "</b>" + (f.texte ? "<br><small>" + e(f.texte) + "</small>" : "") + "</p>";
    return t + "</div>";
  }

  function donjons(s) {
    let t = '<p class="petit">Un gros projet devient un donjon, avec son boss. Chaque quête faite frappe le boss du donjon actif. Chaque étape du projet le frappe fort : il en faut cinq pour un petit boss, huit pour un moyen, douze pour un grand.' + (s.plafonds && s.plafonds.etapes_par_jour ? " " + pluriel(s.plafonds.etapes_par_jour, "étape", "étapes") + " par jour au plus (" + s.plafonds.etapes_du_jour + " aujourd\'hui) : un donjon se gagne dans la durée." : "") + "</p>";
    const ouverts = s.donjons.filter((d) => !d.vaincu_le);
    const finis = s.donjons.filter((d) => d.vaincu_le);
    for (const d of ouverts) {
      t += '<div class="sys-carte sys-donjon' + (d.actif ? " actif" : "") + '"><div class="sys-donjon-tete">' + sprite("icone-boss", 3) + "<span><b>" + e(d.nom) + "</b><small>" + e(d.boss) + (d.actif ? " · donjon actif" : "") + "</small></span></div>";
      t += barre(d.pv, d.pv_max, "boss", "Boss : " + d.pv + " sur " + d.pv_max);
      t += '<p class="petit">À la clé : ' + d.recompense.xp + " points d'expérience, " + d.recompense.or + " or et un butin rare. Une étape : " + d.coup_etape + " de dégâts.</p>";
      for (const x of d.etapes) {
        t += '<div class="sys-ligne-objet' + (x.faite ? " fait" : "") + '"><button type="button" class="sys-case' + (x.faite ? " cochee" : "") + '" data-sys="donjons/' + e(d.id) + "/etapes/" + e(x.id) + '/cocher"' + (x.faite ? " disabled" : "") + ' aria-label="Étape faite"></button><span><b>' + e(x.texte) + "</b></span></div>";
      }
      t += '<form class="sys-form" data-sys-form="donjons/' + e(d.id) + '/etapes"><input name="texte" maxlength="80" placeholder="Une étape du projet" aria-label="Nouvelle étape" required><button type="submit" class="bouton second mini">Ajouter l\'étape</button></form>';
      t += '<p class="sys-ligne">' + (d.actif ? "" : bouton("donjons/" + d.id + "/activer", "Y entrer")) + bouton("donjons/" + d.id + "/retirer", "Abandonner") + "</p></div>";
    }
    if (!ouverts.length) t += '<p class="petit">Aucun donjon ouvert. Quel est ton gros projet du moment ?</p>';
    t += '<h2>Ouvrir un donjon</h2><form class="sys-form" data-sys-form="donjons/ajouter"><input name="nom" maxlength="60" placeholder="Le nom de ton projet" aria-label="Nom du projet" required><select name="taille" aria-label="Taille du projet"><option value="petit">petit projet</option><option value="moyen">projet moyen</option><option value="grand">grand projet</option></select><button type="submit" class="bouton mini">Ouvrir</button></form>';
    if (finis.length) {
      t += "<h2>Boss vaincus</h2><div class=\"sys-liste\">";
      for (const d of finis) t += '<div class="sys-ligne-objet fait">' + sprite("icone-trophees", 2) + "<span><b>" + e(d.boss) + "</b><small>" + e(d.nom) + " · " + e(P.dateLongue(d.vaincu_le)) + "</small></span></div>";
      t += "</div>";
    }
    return t;
  }

  function ombres(s) {
    let t = '<p class="petit">Une quotidienne tenue ' + s.ombres_seuil + " jours de suite peut devenir une ombre : une alliée qui renforce une statistique, pour toujours, même si tu arrêtes la quotidienne.</p>";
    t += '<div class="sys-ombres">';
    for (const o of s.ombres) t += '<div class="sys-ombre">' + sprite("icone-ombre", 4) + "<b>" + e(o.nom) + "</b><small>née de « " + e(o.origine) + " »</small><small>+" + o.bonus + " " + e(o.nom_stat) + "</small></div>";
    t += "</div>";
    if (!s.ombres.length) t += '<p class="petit">Aucune ombre encore. Elles viendront.</p>';
    const pretes = s.quotidiennes.filter((q) => q.recrutable);
    const enRoute = s.quotidiennes.filter((q) => !q.ombre && !q.recrutable);
    if (pretes.length) {
      t += "<h2>Prêtes à se lever</h2><div class=\"sys-liste\">";
      for (const q of pretes) t += '<div class="sys-ligne-objet">' + sprite("icone-ombre", 2) + "<span><b>" + e(q.texte) + "</b><small>record de " + q.record + " jours</small></span>" + bouton("quotidiennes/" + q.id + "/recruter", "Lever l'ombre", { classe: "mini sys-violet" }) + "</div>";
      t += "</div>";
    }
    if (enRoute.length) {
      t += "<h2>En chemin</h2>";
      for (const q of enRoute) t += '<div class="sys-chemin"><span>' + e(q.texte) + "</span>" + barre(Math.min(q.record, s.ombres_seuil), s.ombres_seuil, "ombre", q.record + " sur " + s.ombres_seuil + " jours") + "</div>";
    }
    return t;
  }

  function sac(s) {
    let t = '<p class="sys-ligne">' + sprite("icone-points", 2) + " <b>" + s.hud.or + "</b> or</p>";
    t += "<h2>Mes récompenses</h2><p class=\"petit\">C'est toi qui écris tes récompenses et qui fixes leur prix. Tu les paies avec l'or gagné.</p><div class=\"sys-liste\">";
    for (const r of s.recompenses) {
      t += '<div class="sys-ligne-objet">' + sprite("icone-colis", 2) + "<span><b>" + e(r.texte) + "</b><small>" + r.prix + " or" + (r.achats ? " · offerte " + pluriel(r.achats, "fois", "fois") : "") + "</small></span>" + bouton("recompenses/" + r.id + "/acheter", "M'offrir", { classe: "mini", inactif: s.hud.or < r.prix, titre: s.hud.or < r.prix ? "Il te manque " + (r.prix - s.hud.or) + " or" : "" }) + '<button type="button" class="sys-retirer" data-sys="recompenses/' + e(r.id) + '/retirer" title="Retirer cette récompense" aria-label="Retirer">x</button></div>';
    }
    t += '</div><form class="sys-form" data-sys-form="recompenses/ajouter"><input name="texte" maxlength="80" placeholder="Une récompense (un café en terrasse...)" aria-label="Nouvelle récompense" required><input name="prix" type="number" min="0" max="1000000" step="1" placeholder="Prix en or" aria-label="Prix en or" required><button type="submit" class="bouton mini">Ajouter</button></form>';
    t += "<h2>Butin</h2><div class=\"sys-liste\">";
    for (const o of s.inventaire) {
      t += '<div class="sys-ligne-objet rarete-' + o.rarete + '">' + sprite(ICONE_GENRE[o.genre] || "icone-colis", 2) + "<span><b>" + e(o.nom) + (o.n > 1 ? " x " + o.n : "") + "</b><small>" + e(o.nom_rarete) + " · " + e(o.nom_genre) + " · " + e(o.description) + "</small></span>";
      if (o.action === "equiper") t += bouton("objets/" + o.id + "/equiper", o.equipe ? "Retirer" : "Équiper");
      if (o.action === "utiliser") t += bouton("objets/" + o.id + "/utiliser", o.genre === "oeuf" ? "Apprivoiser" : "Boire");
      t += "</div>";
    }
    if (!s.inventaire.length) t += '<p class="petit">Ton sac est vide. Chaque quête a ' + s.bonus.butin + " % de chance de laisser un butin.</p>";
    t += "</div><h2>Le marchand</h2><div class=\"sys-liste\">";
    for (const o of s.marchand) t += '<div class="sys-ligne-objet">' + sprite(ICONE_GENRE[o.genre] || "icone-colis", 2) + "<span><b>" + e(o.nom) + "</b><small>" + o.prix + " or · " + (o.semaine ? e(o.nom_rarete) + ", cette semaine seulement · " : "") + e(o.description) + "</small></span>" + bouton("marchand/" + o.id + "/acheter", "Acheter", { inactif: s.hud.or < o.prix }) + "</div>";
    t += "</div><h2>Collection de butin</h2><div class=\"sys-collection\">";
    const possedes = new Set(s.inventaire.map((o) => o.id));
    for (const o of s.collection) t += '<span class="' + (possedes.has(o.id) ? "eu" : "") + ' rarete-' + o.rarete + '" title="' + e(o.nom_genre) + '">' + e(possedes.has(o.id) ? o.nom : "???") + "</span>";
    t += "</div>";
    return t;
  }

  function studio(s) {
    const st = s.studio;
    let t = "";
    t += evenement(s);
    t += "<h2>Équipe du studio <small>(" + st.equipiers.length + " sur " + st.places + ")</small></h2><div class=\"sys-liste\">";
    for (const x of st.equipiers) t += '<div class="sys-ligne-objet">' + sprite("icone-avatar", 2) + "<span><b>" + e(x.nom) + " · niveau " + x.niveau + "</b><small>" + e(x.nom_metier) + " · talent " + x.talent + " sur 3 · " + String(x.production).replace(".", ",") + " or par heure, +" + 2 * x.niveau + " % d'expérience sur son métier</small></span></div>";
    if (!st.equipiers.length) t += '<p class="petit">Personne encore. Un équipier produit de l\'or pendant ton absence (' + st.heures_max + " h comptées au plus) et t'aide sur les quêtes de son métier.</p>";
    t += "</div><h2>Candidats de la semaine</h2><div class=\"sys-liste\">";
    for (const c of st.candidats) t += '<div class="sys-ligne-objet">' + sprite("icone-avatar", 2) + "<span><b>" + e(c.nom) + "</b><small>" + e(c.nom_metier) + " · talent " + c.talent + " sur 3 · " + c.prix + " or</small></span>" + bouton("studio/embaucher", "Embaucher", { corps: { id: c.id }, inactif: s.hud.or < c.prix || st.equipiers.length >= st.places, titre: st.equipiers.length >= st.places ? "Plus de place" : s.hud.or < c.prix ? "Il te manque " + (c.prix - s.hud.or) + " or" : "" }) + "</div>";
    if (!st.candidats.length) t += '<p class="petit">Tous les candidats de la semaine sont embauchés. D\'autres viendront lundi.</p>';
    t += "</div><h2>Recherche <small>(" + pluriel(st.recherche.points, "point", "points") + ")</small></h2><p class=\"petit\">Chaque quête donne des points de recherche, la création un peu plus. Chaque niveau se cumule.</p><div class=\"sys-arbre\">";
    for (const n of st.recherche.noeuds) {
      const plein = n.niveau >= n.max;
      t += '<div class="sys-noeud' + (n.ouvert ? "" : " ferme") + (plein ? " plein" : "") + '"><b>' + e(n.nom) + "</b><small>" + e(n.effet) + "</small><span class=\"sys-crans\">" + "<i class=\"on\"></i>".repeat(n.niveau) + "<i></i>".repeat(n.max - n.niveau) + "</span>";
      t += n.ouvert ? (plein ? "<small>Au maximum</small>" : bouton("studio/recherche/" + n.id, n.cout + " points", { inactif: st.recherche.points < n.cout, classe: "mini" })) : "<small>Après : " + e(n.prerequis) + "</small>";
      t += "</div>";
    }
    t += "</div><h2>Voisinages</h2><p class=\"petit\">Deux aménagements du même lieu qui se renforcent. Ils s'achètent en boutique ou se gagnent par l'effort.</p><div class=\"sys-liste\">";
    for (const v of st.voisinages) t += '<div class="sys-ligne-objet' + (v.actif ? " fait" : " absent") + '">' + sprite("icone-immeuble", 2) + "<span><b>" + e(v.nom) + " · " + e(v.effet) + "</b><small>" + e(v.lieu) + " : " + e(v.pieces) + (v.actif ? " · actif" : "") + "</small></span></div>";
    t += "</div><h2>Combos découverts</h2><div class=\"sys-liste\">";
    for (const c of st.combos) t += '<div class="sys-ligne-objet' + (c.decouvert ? "" : " absent") + '">' + sprite("icone-etoile" + (c.decouvert ? "" : "-vide"), 2) + "<span><b>" + e(c.nom) + "</b><small>" + e(c.recette) + (c.fois ? " · " + pluriel(c.fois, "fois", "fois") : "") + "</small></span></div>";
    t += "</div><h2>Classement des studios</h2><ol class=\"sys-classement\">";
    for (const x of st.classement) t += "<li" + (x.toi ? ' class="toi"' : "") + "><span>" + e(x.nom) + "</span><b>" + x.score + "</b></li>";
    t += "</ol><h2>Saison " + st.saison.numero + "</h2>" + barre(st.saison.jour, st.saison.jours, "saison", "Jour " + st.saison.jour + " sur " + st.saison.jours);
    t += '<p class="petit">À la fin d\'une saison, tu reçois de l\'or selon ton niveau et tu gardes tout. Le prestige est un choix : ton niveau repart à 1, tout le reste est gardé, et tu gagnes pour toujours +' + st.saison.bonus_prestige + " % d'expérience et d'or.</p>";
    if (ui.prestige && st.saison.prestige_possible) {
      t += '<div class="sys-carte sys-penalite"><b>Confirmer le prestige ?</b><p>Ton niveau ' + s.hud.niveau + " repart à 1, et ton rang " + e(s.hud.rang) + " repart à E. Tu gardes tes statistiques, ton or, tes objets, tes ombres et ton studio. Ce choix ne s'annule pas.</p><p class=\"sys-ligne\">" + bouton("saison/prestige", "Oui, prestige", { classe: "mini sys-violet" }) + '<button type="button" class="bouton second mini" data-sys-prestige="non">Pas maintenant</button></p></div>';
    } else {
      t += '<p class="sys-ligne"><button type="button" class="bouton mini sys-violet" data-sys-prestige="oui"' + (st.saison.prestige_possible ? "" : " disabled") + ' title="' + (st.saison.prestige_possible ? "Ton niveau repart à 1, tu gardes tout le reste" : "À partir du niveau " + st.saison.niveau_prestige) + '">Prestige</button> <small class="petit">' + (st.saison.prestige_possible ? "Disponible. Une confirmation te sera demandée." : "Disponible au niveau " + st.saison.niveau_prestige + ".") + (st.saison.prestige ? " Prestige actuel : " + st.saison.prestige + "." : "") + "</small></p>";
    }
    t += "<h2>Palmarès de l'année " + st.palmares.annee + "</h2>";
    if (st.palmares.prix.length) {
      t += '<div class="sys-liste">';
      for (const x of st.palmares.prix) t += '<div class="sys-ligne-objet">' + sprite("icone-trophees", 2) + "<span><b>" + e(x.titre) + "</b><small>" + e(x.texte) + "</small></span></div>";
      t += '</div><p class="petit">La cérémonie a lieu à ta première visite de la nouvelle année.</p>';
    } else t += '<p class="petit">Le palmarès se remplit avec tes quêtes. La cérémonie a lieu à ta première visite de la nouvelle année.</p>';
    return t;
  }

  function panneau(etat) {
    const s = sys(etat);
    // un serveur lancé avant la mise à jour ne connaît pas encore le Système
    if (etat && !etat.systeme) return '<div class="fenetre-systeme fixe"><b>Relance le jeu pour réveiller le Système</b><p>Le serveur du jeu tourne encore dans sa version précédente. Arrête-le (Ctrl+C dans son terminal, ou ferme sa fenêtre), puis relance-le. Ta partie est gardée.</p></div>';
    if (!s) return '<p class="petit">Le Système est coupé. Il se rallume dans Réglages, section « Le Système ».</p>';
    if (!s.eveille) {
      return '<div class="fenetre-systeme fixe"><b>Le Système dort encore</b><p>Il s\'éveillera à ta première quête. Ensuite, chaque quête te donnera de l\'expérience et de l\'or, et tu monteras du rang E au rang S.</p></div>';
    }
    let t = '<div class="sys-onglets" role="tablist">';
    for (const [id, nom] of ONGLETS) {
      const pastille = id === "fiche" && s.hud.points_stats ? s.hud.points_stats : id === "jour" ? s.quotidiennes.filter((q) => !q.faite).length : id === "ombres" ? s.quotidiennes.filter((q) => q.recrutable).length : 0;
      t += '<button type="button" role="tab" aria-selected="' + (ui.onglet === id) + '" class="' + (ui.onglet === id ? "actif" : "") + '" data-sys-onglet="' + id + '">' + nom + (pastille ? "<i>" + pastille + "</i>" : "") + "</button>";
    }
    t += "</div>";
    const choixEnAttente = s.studio.evenement && s.studio.evenement.choix && s.studio.evenement.choisi === null;
    if (s.notifications.length && ui.onglet === "fiche" && !choixEnAttente) {
      const n = s.notifications[0];
      t += '<div class="fenetre-systeme fixe"><b>' + e(n.titre) + "</b><p>" + e(n.texte) + "</p></div>";
    }
    const rendu = { fiche, jour: rituels, donjons, ombres, sac, studio }[ui.onglet] || fiche;
    return t + '<div class="sys-corps">' + rendu(s) + "</div>";
  }

  // ------------------------------------------------------------ bandeau du haut

  function majBandeau(etat) {
    const bloc = $("bloc-systeme");
    if (!bloc) return;
    const s = sys(etat);
    const visible = Boolean(s && s.eveille);
    bloc.hidden = !visible;
    if (!visible) return;
    const h = s.hud;
    const html = '<span class="sys-rang petit-rang rang-' + h.rang + '"><span>' + e(h.rang) + "</span></span>" +
      '<span class="colonne"><span class="sys-hud-ligne"><b>Niv. ' + h.niveau + "</b>" + (h.points_stats ? '<i class="sys-point" title="Points de statistiques à poser">+' + h.points_stats + "</i>" : "") + '<span class="sys-hud-or" title="Or">' + h.or + " or</span></span>" +
      barre(h.xp_niveau, h.xp_suivant, "xp mini", "") + barre(h.pv, h.pv_max, "pv mini" + (h.penalite ? " alerte" : ""), "") + "</span>";
    if (bloc.__html !== html) {
      bloc.innerHTML = html;
      bloc.__html = html;
    }
    bloc.title = "Le Système : niveau " + h.niveau + ", rang " + h.rang + ". Expérience " + h.xp_niveau + " sur " + h.xp_suivant + ". Points de vie " + h.pv + " sur " + h.pv_max + ". " + h.or + " or." + (h.penalite ? " Zone de pénalité en cours." : "");
    bloc.classList.toggle("penalite", Boolean(h.penalite));
  }

  // La pastille de l'onglet Système : des points à poser, ou une ombre prête à se lever.
  function majPastille(etat) {
    const onglet = document.querySelector('.onglet[data-panneau="systeme"]');
    if (!onglet) return;
    const s = sys(etat);
    const n = s && s.eveille ? s.hud.points_stats || (s.quotidiennes.some((q) => q.recrutable) ? "!" : 0) : 0;
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

  // Le boss du donjon actif reste en vue, sous la barre du haut.
  function majDonjon(etat) {
    let el = $("sys-donjon");
    const s = sys(etat);
    const d = s && s.eveille ? s.donjons.find((x) => x.actif) : null;
    if (!d) {
      if (el) el.hidden = true;
      return;
    }
    if (!el) {
      el = document.createElement("button");
      el.type = "button";
      el.id = "sys-donjon";
      el.dataset.sysAller = "donjons";
      ($("jeu") || document.body).appendChild(el);
    }
    const html = sprite("icone-boss", 2) + '<span class="sys-donjon-nom"><b>' + e(d.boss) + "</b><small>" + e(d.nom) + "</small></span>" + barre(d.pv, d.pv_max, "boss", d.pv + " sur " + d.pv_max);
    if (el.__html !== html) {
      const baisse = el.__pv !== undefined && d.pv < el.__pv && el.__id === d.id;
      el.innerHTML = html;
      el.__html = html;
      if (racine.App && racine.App.hydrater) racine.App.hydrater(el);
      if (baisse) {
        el.classList.remove("touche");
        void el.offsetWidth;
        el.classList.add("touche");
      }
    }
    el.__pv = d.pv;
    el.__id = d.id;
    el.title = "Donjon actif : " + d.nom + ". Chaque quête frappe " + d.boss + ".";
    el.hidden = false;
  }

  // ------------------------------------------------------------ fenêtres du Système

  const SONS = { niveau: "niveau_systeme", rang: "rang", butin: "butin", penalite: "penalite", penalite_fin: "tenu", boss: "boss", coup: "coup", ombre: "ombre", ombre_prete: "fenetre", stat: "stat", eveil: "fenetre", combo: "combo", evenement: "evenement", evenement_choix: "evenement", embauche: "embauche", equipier: "embauche", recherche: "recherche", prestige: "saison", saison: "saison", ceremonie: "saison", habitude_plus: "habitude_plus", habitude_moins: "habitude_moins", habitude_notee: "clic", quotidienne: "quotidienne", xp: "xp", hors_ligne: "or", production: "or", familier: "butin", recompense: "or", donjon: "fenetre", jour: "fenetre", defi: "tenu", bilan: "doux", soin: "eau", achat: "achat", repos: "doux" };
  const GRANDS = { niveau: 40, rang: 60, boss: 70, prestige: 80, ombre: 30, ceremonie: 60 };
  const ALLER = { niveau: "fiche", rang: "fiche", stat: "fiche", eveil: "fiche", ombre_prete: "ombres", ombre: "ombres", boss: "donjons", coup: "donjons", donjon: "donjons", butin: "sac", familier: "sac", evenement: "fiche", embauche: "studio", equipier: "studio", recherche: "studio", combo: "studio", hors_ligne: "studio", saison: "studio", ceremonie: "studio", penalite: "jour", bilan: "jour", jour: "jour", defi: "fiche" };
  const file = [];
  const MAX_VISIBLES = 3;

  function zone() {
    let z = $("systeme-fenetres");
    if (!z) {
      z = document.createElement("div");
      z.id = "systeme-fenetres";
      z.setAttribute("aria-live", "polite");
      ($("jeu") || document.body).appendChild(z);
    }
    return z;
  }

  function vider() {
    const z = zone();
    while (file.length && z.children.length < MAX_VISIBLES) {
      const ev = file.shift();
      const el = document.createElement("div");
      el.className = "fenetre-systeme genre-" + ev.genre + (ev.discret ? " discret" : "") + (ev.rarete ? " rarete-" + ev.rarete : "");
      el.innerHTML = '<span class="sys-coin"></span><b>' + e(ev.titre) + "</b>" + (ev.texte ? "<p>" + e(ev.texte) + "</p>" : "");
      el.addEventListener("click", () => {
        el.remove();
        vider();
        // une fenêtre mène à son onglet : les points à poser, l'ombre à lever, le choix du jour...
        const cible = ALLER[ev.genre];
        if (cible && racine.App) {
          ui.onglet = cible;
          racine.App.ouvrirPanneau("systeme");
          racine.App.majPanneau();
          majAmbiance();
        }
      });
      z.appendChild(el);
      setTimeout(() => {
        el.classList.add("sort");
        setTimeout(() => {
          el.remove();
          vider();
        }, 320);
      }, ev.discret ? 1800 : file.length > 2 ? 3200 : 5200);
    }
  }

  // Annonce ce que le Système vient de dire : fenêtres bleues, sons, et une petite fête pour les grands moments.
  function celebrer(etat, premierChargement) {
    const s = sys(etat);
    if (!s) return;
    const Son = racine.Son;
    const App = racine.App;
    let delai = 0;
    for (const ev of s.evenements || []) {
      if (premierChargement && ev.discret) continue;
      file.push(ev);
      // trop d'annonces en attente : les petites laissent la place aux grandes
      if (file.length > 4) for (let i = file.length - 2; i >= 0 && file.length > 4; i--) if (file[i].discret) file.splice(i, 1);
      if (file.length > 8) file.splice(0, file.length - 8);
      if (!premierChargement && Son && SONS[ev.genre]) {
        const nom = SONS[ev.genre];
        setTimeout(() => Son.jouer(nom), delai);
        delai += ev.discret ? 90 : 320;
      }
      if (!premierChargement && GRANDS[ev.genre] && App) {
        if (App.fete) App.fete(GRANDS[ev.genre]);
        if ((ev.genre === "boss" || ev.genre === "rang" || ev.genre === "prestige" || ev.genre === "ceremonie") && Son && typeof Son.ambiance === "function") {
          // un air de fête, puis la musique revient à ce qu'elle était
          Son.ambiance("fete");
          clearTimeout(retourAmbiance);
          enFete = true;
          retourAmbiance = setTimeout(() => {
            enFete = false;
            majAmbiance();
          }, 16000);
        }
        if (App.ruban && (ev.genre === "niveau" || ev.genre === "rang" || ev.genre === "boss" || ev.genre === "prestige")) App.ruban(ev.titre, ev.genre === "boss" ? "Donjon terminé" : ev.genre === "niveau" ? "Le Système te fait monter" : "", 3.6);
      }
    }
    // des annonces attendent et l'écran est plein : la plus ancienne laisse sa place
    const z = zone();
    if (file.length && z.children.length >= MAX_VISIBLES) {
      const ancienne = z.firstElementChild;
      ancienne.classList.add("sort");
      setTimeout(() => {
        ancienne.remove();
        vider();
      }, 300);
    }
    vider();
    majAmbiance();
  }

  // La musique suit l'endroit où tu es : tendue dans les donjons, feutrée la nuit.
  let enFete = false;
  let retourAmbiance = null;
  function majAmbiance() {
    const Son = racine.Son;
    if (!Son || typeof Son.ambiance !== "function" || enFete) return;
    const panneauOuvert = $("panneau") && !$("panneau").classList.contains("ferme") && $("contenu") && $("contenu").dataset.panneau === "systeme";
    const heure = new Date().getHours();
    Son.ambiance(panneauOuvert && ui.onglet === "donjons" ? "donjon" : heure >= 21 || heure < 7 ? "nuit" : "jour");
  }

  // Appelé par app.js à chaque état reçu.
  let dejaVu = false;
  function apresEtat(etat) {
    majBandeau(etat);
    majPastille(etat);
    majDonjon(etat);
    celebrer(etat, !dejaVu);
    dejaVu = true;
  }

  // ------------------------------------------------------------ gestes

  async function agir(chemin, corps) {
    const App = racine.App;
    if (!App) return null;
    return App.agir("/api/systeme/" + chemin, corps || {});
  }

  document.addEventListener("click", (ev) => {
    const onglet = ev.target.closest("[data-sys-onglet]");
    if (onglet) {
      ui.onglet = onglet.dataset.sysOnglet;
      if (racine.Son) racine.Son.jouer("clic");
      if (racine.App && racine.App.majPanneau) racine.App.majPanneau();
      const contenu = $("contenu");
      if (contenu) contenu.scrollTop = 0;
      majAmbiance();
      return;
    }
    const prestige = ev.target.closest("[data-sys-prestige]");
    if (prestige && !prestige.disabled) {
      ui.prestige = prestige.dataset.sysPrestige === "oui";
      if (racine.Son) racine.Son.jouer("clic");
      if (racine.App && racine.App.majPanneau) racine.App.majPanneau();
      return;
    }
    const aller = ev.target.closest("[data-sys-aller]");
    if (aller) {
      ui.onglet = aller.dataset.sysAller;
      if (racine.App) {
        racine.App.ouvrirPanneau("systeme");
        racine.App.majPanneau();
      }
      majAmbiance();
      return;
    }
    const el = ev.target.closest("[data-sys]");
    if (!el || el.disabled) return;
    ev.preventDefault();
    let corps = {};
    try {
      corps = el.dataset.corps ? JSON.parse(el.dataset.corps) : {};
    } catch (err) {
      corps = {};
    }
    if (el.dataset.sys === "saison/prestige") ui.prestige = false;
    agir(el.dataset.sys, corps);
  });

  // l'aide reste ouverte ou fermée comme tu l'as laissée, même quand le panneau se redessine
  document.addEventListener("toggle", (ev) => {
    if (ev.target.classList && ev.target.classList.contains("sys-aide")) ui.aide = ev.target.open;
  }, true);

  document.addEventListener("submit", async (ev) => {
    const form = ev.target.closest("[data-sys-form]");
    if (!form) return;
    ev.preventDefault();
    const corps = {};
    for (const champ of form.elements) {
      if (!champ.name) continue;
      corps[champ.name] = champ.type === "number" ? Number(champ.value) : champ.value;
    }
    if (document.activeElement && form.contains(document.activeElement)) document.activeElement.blur();
    const r = await agir(form.dataset.sysForm, corps);
    if (r && racine.App && racine.App.majPanneau) racine.App.majPanneau();
  });

  // Ce que l'immeuble montre près de toi : ton familier du moment et le nombre de tes ombres.
  function compagnons(etat) {
    const s = sys(etat);
    if (!s || !s.eveille) return null;
    const f = (s.familiers || []).find((x) => x.actif && x.present);
    return { familier: f ? f.id : null, ombres: (s.ombres || []).length };
  }

  racine.Systeme = {
    compagnons,
    panneau,
    apresEtat,
    majBandeau,
    majAmbiance,
    ouvrir(onglet) {
      if (ONGLETS.some((o) => o[0] === onglet)) ui.onglet = onglet;
    },
    onglet: () => ui.onglet,
  };
})(window);
