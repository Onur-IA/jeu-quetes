"use strict";
// Contenu des panneaux latéraux : quêtes, journal, équipe, encaissements, boutique, rangement, carte, état, collection.
// Chaque fonction renvoie du HTML. Les clics passent par data-action (voir app.js).
(function (racine) {
  const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const TITRES = {
    quetes: "Quêtes",
    journal: "Journal de l'immeuble",
    equipe: "L'équipe",
    encaissements: "Encaissements",
    boutique: "Boutique",
    ranger: "Ranger mon bureau",
    carte: "Carte des caps",
    etat: "Comment je me sens ?",
    trophees: "Collection",
    systeme: "Le Système",
  };
  // Fonction du jeu qui ouvre chaque panneau (voir « fonctions » dans l'état).
  const FONCTION_DE = { equipe: "equipe", encaissements: "argent", boutique: "boutique", ranger: "boutique", carte: "carte", etat: "etat", trophees: "trophees" };
  let monnaie = "€";

  function e(texte) {
    return String(texte == null ? "" : texte).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function euros(n) {
    const entier = Math.floor(Math.abs(n));
    const cents = Math.round((Math.abs(n) - entier) * 100);
    return (n < 0 ? "-" : "") + String(entier).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (cents ? "," + String(cents).padStart(2, "0") : "") + " €";
  }
  function dateLongue(iso) {
    const d = new Date(iso + "T12:00:00Z");
    return JOURS[d.getUTCDay()] + " " + d.getUTCDate() + (d.getUTCDate() === 1 ? "er" : "") + " " + MOIS[d.getUTCMonth()];
  }
  function dateCourte(iso) {
    return Number(iso.slice(8, 10)) + "/" + iso.slice(5, 7);
  }
  function pixel(texte, z, couleur) {
    return '<span class="pix" data-pixel="' + e(texte) + '" data-z="' + (z || 2) + '" data-c="' + (couleur || "0") + '"></span>';
  }
  function sprite(nom, z, etat) {
    return '<span class="pix" data-sprite="' + e(nom) + '" data-z="' + (z || 2) + '"' + (etat ? ' data-etat="' + e(etat) + '"' : "") + "></span>";
  }
  function pluriel(n, un, plusieurs) {
    return n + " " + (n > 1 ? plusieurs : un);
  }

  // ------------------------------------------------------------ quêtes
  function etoiles(n, z) {
    let h = '<span class="etoiles">';
    for (let i = 1; i <= 3; i++) h += sprite(i <= n ? "icone-etoile" : "icone-etoile-vide", z || 1);
    return h + "</span>";
  }

  function ouvert(etat, fonction) {
    return !etat.fonctions || !etat.fonctions.fonctions[fonction] || etat.fonctions.fonctions[fonction].ouvert;
  }

  // Version 4 : ce que la quête rapporte au Système (expérience), quel que soit son type.
  function puceSysteme(etat) {
    const s = etat.systeme;
    if (!s || !s.actif || !s.eveille || !s.par_etoile || !s.par_etoile.xp) return "";
    const x = s.par_etoile;
    return '<span class="puce exp chiffres" title="Le Système : ' + x.xp + " points d\'expérience et " + x.or + " or par étoile" + (x.taux < 100 ? ". Rendement réduit à " + x.taux + " % : tu as déjà beaucoup fait aujourd\'hui." : "") + '">+' + x.xp + " exp</span>";
  }

  function puceGain(q, etat) {
    return puceGainV3(q, etat) + puceSysteme(etat);
  }

  function puceGainV3(q, etat) {
    if (q.mode === "racontee") return '<span class="puce journal" title="Cette quête ne rapporte pas de points : elle laisse une ligne au journal de l\'immeuble.">au journal</span>';
    if (q.gains.every((g) => g === 0)) return '<span class="puce journal" title="Plafond du jour atteint : la quête compte, sans points.">plafond : au journal</span>';
    const unique = q.gains[0] === q.gains[1] && q.gains[1] === q.gains[2];
    return '<span class="puce points chiffres" title="Points selon le degré atteint' + (etat.arrosage && etat.arrosage.actif ? ", bonus d\'arrosage compris" : "") + '">' + (unique ? q.gains[0] : q.gains.join(" · ")) + "</span>";
  }

  // Une quête. options : { futur, visible (dans la liste du jour), simple (pas de réglages) }
  function ligneQuete(q, type, etat, ui, options) {
    const o = options || {};
    const brille = etat.etoile && etat.etoile.id === q.id && !q.payee && etat.etoile.vente;
    const agent = q.agent ? etat.agents.find((a) => a.id === q.agent) : null;
    const equipeOuverte = ouvert(etat, "equipe");
    let infos = "";
    if (q.avant_jeu) {
      return '<div class="quete payee" data-quete="' + q.id + '"><span class="case cochee fait" aria-label="Fait"></span><div class="texte">' + e(q.texte) + '</div><div class="infos"><span>cochée avant le jeu : elle fait partie du décor</span></div></div>';
    }
    if (q.payee) {
      infos += etoiles(q.degre || 2, 1);
      infos += q.mode === "racontee" ? '<span class="puce journal">au journal</span>' : '<span class="puce points chiffres">+' + q.points + "</span>";
      infos += '<span class="puce type-' + q.type_quete + '">' + e(q.nom_type) + "</span>";
      if (agent) infos += '<span class="puce agent">avec ' + e(agent.nom) + "</span>";
      if (q.annulable) infos += '<button type="button" class="lien" data-action="annuler" data-id="' + q.id + '">Annuler</button>';
    } else {
      infos += '<button type="button" class="puce type-' + q.type_quete + '" data-action="ouvrir-type" data-id="' + q.id + '" title="Type de la quête. Clique pour le corriger.">' + e(q.nom_type) + "</button>";
      infos += puceGain(q, etat);
      if (q.newsletter) infos += '<span class="puce lettre">newsletter</span>';
      if (!o.futur && equipeOuverte && etat.agents.length) {
        infos += agent
          ? '<button type="button" class="puce agent" data-action="choisir-agent" data-id="' + q.id + '" title="Changer d\'agent">avec ' + e(agent.nom) + "</button>"
          : '<button type="button" class="puce fantome" data-action="choisir-agent" data-id="' + q.id + '" title="Choisis l\'agent qui t\'accompagne sur cette quête">avec qui ?</button>';
      }
      if (!o.futur) infos += '<button type="button" class="lien" data-action="editer-degres" data-id="' + q.id + '" title="Fixe à l\'avance les trois degrés de réussite">' + (q.degres_perso ? "mes degrés" : "degrés") + "</button>";
      if (o.visible && !o.contrat) infos += '<button type="button" class="lien" data-action="reporter" data-id="' + q.id + '" title="Elle passe au bout de la liste du jour. Rien n\'est perdu.">pas aujourd\'hui</button>';
      if (q.origine === "locale" && !o.contrat) infos += '<button type="button" class="lien" data-action="retirer-quete" data-id="' + q.id + '" title="La retirer du fichier des quêtes">retirer</button>';
    }
    let sous = "";
    if (!q.payee && ui.typeOuvert === q.id) {
      sous += '<div class="choix-agent">' + etat.config.types.map((t) => '<button type="button" class="puce type-' + t.id + (t.id === q.type_quete ? " choisi" : "") + '" data-action="changer-type" data-id="' + q.id + '" data-type="' + t.id + '" title="' + (t.mode === "payee" ? "Payée en points" : "Racontée au journal, sans points") + '">' + e(t.nom) + "</button>").join("") + "</div>";
    }
    if (!q.payee && ui.choixAgent === q.id) {
      sous += '<div class="choix-agent">' + etat.agents.map((a) => '<button type="button" class="puce' + (a.id === q.agent ? " agent" : "") + '" data-action="confier" data-id="' + q.id + '" data-agent="' + a.id + '" title="' + e(a.role) + (a.specialite === q.type_quete ? ". Dans son élément : un coup de pouce de plus pour le but d\'équipe." : "") + '">' + e(a.nom) + (a.specialite === q.type_quete ? " +1" : "") + "</button>").join("") + (q.agent ? '<button type="button" class="puce fantome" data-action="confier" data-id="' + q.id + '" data-agent="">seul</button>' : "") + '<span class="petit large">+1 : l\'agent est dans son élément, il fait avancer le but d\'équipe.</span></div>';
    }
    if (!q.payee && ui.degresEdition === q.id) {
      sous += '<form class="degres-edition" data-formulaire="degres" data-id="' + q.id + '"><span class="petit">Fixe tes trois degrés avant de commencer. Vide : les degrés par défaut.</span>' + [0, 1, 2].map((i) => "<label>" + etoiles(i + 1, 1) + '<input type="text" name="d' + i + '" maxlength="120" autocomplete="off" value="' + e(q.degres_perso ? q.degres[i] : "") + '" placeholder="' + e(q.degres[i]) + '"></label>').join("") + '<div class="rangee"><button type="button" class="bouton second mini" data-action="editer-degres" data-id="">Fermer</button><button type="submit" class="bouton mini">Fixer</button></div></form>';
    }
    if (!q.payee && ui.degreOuvert === q.id) {
      sous += '<div class="degres"><span class="petit">Quel degré as-tu atteint ?</span>' + [0, 1, 2].map((i) => '<button type="button" class="degre" data-action="valider" data-type="' + type + '" data-id="' + q.id + '" data-degre="' + (i + 1) + '">' + etoiles(i + 1, 2) + '<span class="texte-degre">' + e(q.degres[i]) + '</span><span class="puce ' + (q.mode === "payee" && q.gains[i] > 0 ? "points" : "journal") + ' chiffres">' + (q.mode === "payee" && q.gains[i] > 0 ? "+" + q.gains[i] : "au journal") + "</span></button>").join("") + "</div>";
    }
    const bouton = q.payee
      ? '<span class="case cochee fait" aria-label="Fait"></span>'
      : '<button type="button" class="case fait' + (ui.degreOuvert === q.id ? " ouverte" : "") + '" data-action="ouvrir-degres" data-id="' + q.id + '"' + (o.futur ? " disabled" : "") + ' title="' + (o.futur ? "Ce jour n\'est pas encore arrivé" : "C\'est fait : choisis ton degré") + '" aria-label="Marquer comme fait : ' + e(q.texte) + '"></button>';
    return '<div class="quete' + (q.payee ? " payee" : "") + (brille ? " brille" : "") + (o.contrat ? " du-contrat" : "") + '" data-quete="' + q.id + '">' + bouton + '<div class="texte">' + (o.vedette ? '<span class="puce vente">avant ' + e(o.vedette) + "</span> " : "") + e(q.texte) + '</div><div class="infos">' + infos + "</div>" + sous + "</div>";
  }

  function tousLesElements(etat) {
    return [...etat.jours.flatMap((j) => j.priorites), ...etat.quetes];
  }

  function carteContrat(etat) {
    const k = etat.contrat;
    if (!k || !k.ouvert) return "";
    if (k.a_choisir) {
      return '<div class="carte sombre contrat-appel">' + sprite("icone-contrat", 3) + '<div class="texte"><b>Ton contrat du jour</b>Un sûr, un ambitieux. À toi de choisir.</div><button type="button" class="bouton" data-action="contrat-matin">Choisir</button></div>';
    }
    const c = k.du_jour;
    if (!c || c.choix === "aucun") return c ? '<p class="petit">Pas de contrat aujourd\'hui : c\'est ton choix. Demain, deux nouveaux contrats.</p>' : "";
    const lignes = [...(c.vedette ? [c.vedette] : []), ...c.quetes];
    const faites = lignes.filter((q) => q.faite).length;
    const titre = c.choix === "ambitieux" ? "Contrat ambitieux" : "Contrat sûr";
    let h = '<div class="carte sombre contrat ' + c.statut + '"><div class="tete-contrat">' + sprite("icone-contrat", 2) + "<b>" + titre + '</b><span class="puce points chiffres">' + faites + " sur " + lignes.length + "</span></div>";
    if (c.statut === "tenu") h += "<p><b>Tenu.</b> +" + c.gain + " points" + (c.colis ? ", et un colis." : ".") + "</p>";
    else if (c.statut === "rate") h += "<p>Non tenu cette fois. La mise de " + c.mise + " points reste sur la table. Rien d'autre ne bouge, et tes quêtes paient toujours.</p>";
    else if (c.statut === "passe") h += "<p>Pas bouclé hier. Rien de perdu.</p>";
    else {
      h += "<p>" + (c.choix === "ambitieux" ? "Mise : " + c.mise + " points. Tenu : +" + c.gain + " points" + (c.colis ? " et un colis" : "") + "." : "Sans mise. Tenu : +" + c.gain + " points.") + "</p>";
      h += '<ul class="liste-contrat">' + lignes.map((q, i) => '<li class="' + (q.faite ? "faite" : "") + '">' + (c.vedette && i === 0 ? '<span class="puce vente">avant ' + e(c.heure_limite_libelle) + "</span> " : "") + e(q.texte) + "</li>").join("") + "</ul>";
    }
    return h + "</div>";
  }

  function quetes(etat, ui) {
    let h = "";
    for (const err of etat.erreurs) {
      h += '<div class="carte alerte"><b>' + e(err.message) + "</b>";
      if (err.fichiers) h += "<ul>" + err.fichiers.map((f) => "<li>" + e(f) + "</li>").join("") + "</ul>";
      h += "</div>";
    }
    if (etat.semaine && etat.semaine.statut === "ancienne") h += '<div class="carte alerte">Note de semaine ancienne : ' + e(etat.semaine.id) + ". Fais ta weekly review.</div>";
    if (etat.dimanche && etat.dimanche.disponible) {
      h += '<div class="carte sombre contrat-appel">' + sprite("icone-fanion", 3) + '<div class="texte"><b>La revue de la semaine</b>' + (etat.dimanche.en_retard ? "Celle de la semaine passée t'attend. " : "") + "Trois chiffres, une leçon, +" + etat.dimanche.recompense + ' points.</div><button type="button" class="bouton" data-action="dimanche">Ouvrir</button></div>';
    }
    h += carteContrat(etat);

    const tous = tousLesElements(etat);
    const parId = new Map(tous.map((q) => [q.id, q]));
    const contrat = etat.contrat && etat.contrat.du_jour && etat.contrat.du_jour.statut === "en_cours" ? etat.contrat.du_jour : null;
    const idsContrat = contrat ? [...(contrat.vedette ? [contrat.vedette.id] : []), ...contrat.quetes.map((q) => q.id)] : [];
    const visibles = etat.du_jour.visibles.map((id) => parId.get(id)).filter(Boolean);
    const faites = etat.du_jour.faites.map((id) => parId.get(id)).filter(Boolean);

    // aujourd'hui : trois à cinq quêtes, pas davantage
    h += "<h2>Aujourd'hui <small>" + (faites.length ? pluriel(faites.length, "faite", "faites") : "à toi de jouer") + "</small></h2>";
    const pl = etat.plafond;
    let ligne = "";
    if (pl.par_jour) {
      ligne += '<span class="plafond" title="Au-delà du plafond, une quête compte toujours, mais sans points : elle entre au journal.">' + Array.from({ length: pl.par_jour }, (x, i) => '<i class="' + (i < pl.payees ? "prise" : i < pl.plein ? "" : "reduite") + '"></i>').join("") + "</span><span>" + (pl.restantes === 0 ? "Plafond du jour atteint : la suite entre au journal." : "Quêtes payées : " + pl.payees + " sur " + pl.par_jour + (pl.taux_prochaine < 100 ? ". La prochaine : " + pl.taux_prochaine + " %." : ".")) + "</span>";
    }
    if (ligne) h += '<div class="ligne-jour petit">' + ligne + "</div>";
    if (ouvert(etat, "arrosage")) {
      const a = etat.arrosage;
      h += a.actif
        ? '<div class="ligne-jour petit arrose">' + sprite("icone-goutte", 1) + "<span>Plantes arrosées : +" + a.bonus_pourcent + " % sur tes quêtes payées jusqu'à " + e(a.jusqua.replace(":", " h ")) + ".</span></div>"
        : a.fait_aujourdhui
          ? ""
          : '<div class="ligne-jour petit">' + sprite("icone-arrosoir", 1) + '<button type="button" class="lien" data-action="arroser">Arroser les plantes</button><span>+' + a.bonus_pourcent + " % sur tes quêtes payées pendant " + a.duree_h + " h.</span></div>";
    }
    if (visibles.length) {
      h += visibles.map((q) => ligneQuete(q, q.genre, etat, ui, { visible: true, contrat: idsContrat.includes(q.id), vedette: contrat && contrat.vedette && contrat.vedette.id === q.id ? contrat.heure_limite_libelle : "" })).join("");
    } else {
      h += '<p class="vide">' + (faites.length ? "Plus rien d'ouvert pour aujourd'hui. Belle journée." : "Aucune quête pour l'instant. Écris-en une ci-dessous, ou lance /quetes dans Claude Code.") + "</p>";
    }
    if (etat.du_jour.reserve > 0) h += '<p class="petit">' + pluriel(etat.du_jour.reserve, "autre quête attend", "autres quêtes attendent") + " en réserve. Une de faite, une de plus à l'écran.</p>";

    // écrire une quête
    const ajout = ui.ajout || {};
    h += '<form class="ajout" data-formulaire="quete"><input type="text" name="texte" maxlength="160" autocomplete="off" placeholder="Écrire une quête..." value="' + e(ajout.texte || "") + '" aria-label="Écrire une quête"><select name="type" aria-label="Type de la quête"><option value="">Type : deviné</option>' + etat.config.types.map((t) => '<option value="' + t.id + '"' + (ajout.type === t.id ? " selected" : "") + ">" + e(t.nom) + "</option>").join("") + '</select><button type="submit" class="bouton mini">Ajouter</button></form>';

    if (faites.length) {
      h += "<h2>Fait aujourd'hui <small>" + faites.length + "</small></h2>";
      h += faites.map((q) => ligneQuete(q, q.genre, etat, ui)).join("");
      const jour = etat.jours.find((j) => j.date === etat.jour_courant);
      if (jour && jour.bonus_paye) h += '<p><span class="puce points">+' + etat.config.points.bonus_jour + "</span> Toutes les priorités du jour sont faites.</p>";
    }

    // le reste : replié, pour garder l'écran léger
    const vus = new Set([...etat.du_jour.visibles, ...etat.du_jour.faites]);
    const reste = tous.filter((q) => !vus.has(q.id));
    const ouvertesReste = reste.filter((q) => !q.payee && !q.avant_jeu);
    if (reste.length) {
      h += '<details data-pli="reste"' + (ui.plis.reste ? " open" : "") + "><summary><span>Tout le reste</span><span>" + (ouvertesReste.length ? pluriel(ouvertesReste.length, "quête ouverte", "quêtes ouvertes") : "tout est fait") + '</span></summary><div class="dedans">';
      const passes = etat.jours.filter((j) => j.statut === "passe" && j.priorites.some((p) => !vus.has(p.id)));
      for (const j of passes) h += "<h3>" + e(j.libelle) + (j.bonus_paye ? " : journée complète" : "") + "</h3>" + j.priorites.filter((p) => !vus.has(p.id)).map((p) => ligneQuete(p, "priorite", etat, ui)).join("");
      const futurs = etat.jours.filter((j) => j.statut === "futur");
      if (futurs.length) h += "<h3>À venir : " + e(futurs[0].libelle) + "</h3>" + futurs[0].priorites.map((p) => ligneQuete(p, "priorite", etat, ui, { futur: true })).join("");
      const lignes = etat.quetes.filter((q) => !vus.has(q.id));
      let groupe = null;
      for (const q of lignes) {
        const titre = (q.categorie && q.categorie !== "Jeu" ? q.categorie + (q.groupe ? " · " : "") : "") + (q.groupe || "");
        if (titre !== groupe) {
          groupe = titre;
          if (titre) h += "<h3>" + e(titre) + "</h3>";
        }
        h += ligneQuete(q, "ligne", etat, ui);
      }
      h += "</div></details>";
    }
    if (etat.newsletter.lecteurs) h += '<p class="petit">' + pluriel(etat.newsletter.lecteurs, "lecteur est passé", "lecteurs sont passés") + " te voir, grâce à tes quêtes d'édition.</p>";
    h += '<p class="petit">Les quêtes payées (' + etat.config.types.filter((t) => t.mode === "payee").map((t) => e(t.nom.toLowerCase())).join(", ") + ") donnent des points. Les autres se racontent dans le journal de l'immeuble. Le jeu ne coche jamais rien à ta place.</p>";
    return h;
  }

  // ------------------------------------------------------------ journal de l'immeuble
  const ICONES_JOURNAL = { recit: "icone-journal", plafond: "icone-journal", contrat: "icone-contrat", "contrat-tenu": "icone-contrat", "contrat-rate": "icone-contrat", trait: "icone-equipe", agent: "icone-equipe", equipe: "icone-equipe", effort: "icone-cadenas", cap: "icone-immeuble", colis: "icone-colis", encaissement: "icone-argent", arrosage: "icone-goutte", retour: "icone-etat", dimanche: "icone-fanion", niveau: "icone-niveau", debut: "icone-etoile", systeme: "icone-systeme" };
  function journal(etat) {
    let h = '<p class="petit">Ce qui ne se compte pas se raconte ici : tes créations, tes liens, ta santé, et la vie de l\'immeuble. Rien ne s\'efface.</p>';
    const d = etat.dimanche;
    if (d) {
      h += '<div class="carte">' + sprite("icone-fanion", 2) + " <b>Revue de la semaine</b> : " + (d.disponible ? '<button type="button" class="bouton mini" data-action="dimanche">L\'ouvrir</button>' : d.faite ? "faite pour cette semaine." : "elle s'ouvre " + e(d.nom_jour) + (d.dans_jours ? ", dans " + pluriel(d.dans_jours, "jour", "jours") : "") + ". Récompense connue : +" + d.recompense + " points et un fanion sur le toit.") + (d.semaines_bouclees ? '<br><span class="petit">' + pluriel(d.semaines_bouclees, "semaine bouclée", "semaines bouclées") + ".</span>" : "") + "</div>";
    }
    if (!etat.journal.length) return h + '<p class="vide">Le journal est encore vide. Ta première quête écrira la première ligne.</p>';
    let jour = null;
    for (const x of etat.journal) {
      const date = String(x.quand).slice(0, 10);
      if (date !== jour) {
        jour = date;
        h += "<h2>" + e(date === etat.date ? "Aujourd'hui" : dateLongue(date)) + "</h2>";
      }
      h += '<div class="ligne-journal genre-' + e(x.type) + '">' + sprite(ICONES_JOURNAL[x.type] || "icone-journal", 2) + "<span><span class=\"petit\">" + e(String(x.quand).slice(11, 16).replace(":", " h ")) + "</span><br>" + e(x.texte) + "</span></div>";
    }
    if (d && d.dernieres.length) {
      h += "<h2>Tes revues</h2>";
      for (const s of d.dernieres) h += '<div class="carte"><b>Semaine ' + e(s.semaine.slice(6)) + "</b> : " + pluriel(s.chiffres.quetes, "quête", "quêtes") + ", " + s.chiffres.points + " points, " + s.chiffres.crans + " crans." + (s.mot ? "<br><i>« " + e(s.mot) + " »</i>" : "") + "</div>";
    }
    return h;
  }

  // ------------------------------------------------------------ l'équipe et son but
  function barreEquipe(eq, grand) {
    return '<span class="crans' + (grand ? " grand" : "") + '">' + Array.from({ length: eq.total }, (x, i) => '<i class="' + (i < eq.crans ? "plein" : "") + '"></i>').join("") + "</span>";
  }
  function equipe(etat, ui) {
    const eq = etat.equipe;
    let h = '<div class="carte sombre"><span class="petit">But d\'équipe de la semaine</span>';
    if (ui.butEdition) {
      h += '<form class="ajout" data-formulaire="but"><input type="text" name="libelle" maxlength="80" autocomplete="off" value="' + e(eq.libelle_ecrit ? eq.libelle : "") + '" placeholder="Par exemple : la page de vente en ligne vendredi" aria-label="But d\'équipe"><button type="submit" class="bouton mini">Fixer</button></form>';
    } else {
      h += "<p><b>" + e(eq.libelle) + '</b> <button type="button" class="lien clair" data-action="editer-but">' + (eq.libelle_ecrit ? "changer" : "écrire le but") + "</button></p>";
    }
    h += barreEquipe(eq, true) + "<p>" + (eq.atteint ? "Atteint. Toute l'équipe l'a fait ensemble." : eq.crans + " sur " + pluriel(eq.total, "cran", "crans") + ". Encore " + eq.reste_cran + " pour le prochain cran.") + ' <span class="petit">Récompense connue : +' + eq.recompense + " points, et un trait pour les agents qui ont aidé.</span></p></div>";
    h += '<p class="petit">La barre est commune. Ce qui la remplit cette semaine : tes quêtes (' + eq.par.quetes + "), un agent dans son élément (" + eq.par.specialite + "), le vrai travail de tes sessions (" + eq.par.sessions + "). Elle ne redescend jamais.</p>";
    h += "<h2>Tes agents <small>" + eq.agents.length + "</small></h2>";
    for (const a of eq.agents) {
      const occupe = etat.agents.find((x) => x.id === a.id);
      const quete = occupe && occupe.quete ? tousLesElements(etat).find((q) => q.id === occupe.quete) : null;
      h += '<div class="fiche-agent"><div class="portrait"><span class="pix" data-agent="' + e(a.id) + '" data-z="3"></span></div><div><b>' + e(a.nom) + '</b> <span class="petit">' + e(a.role) + '</span><br><span class="puce type-' + a.specialite + '">' + e(a.nom_specialite) + '</span> <span class="petit">' + pluriel(a.quetes, "quête faite", "quêtes faites") + " avec toi" + (a.cette_semaine ? ", " + a.cette_semaine + " cette semaine" : "") + ".</span>";
      if (quete) h += '<br><span class="petit">Avec toi sur : ' + e(quete.texte) + "</span>";
      h += '<div class="traits">' + (a.traits.length ? a.traits.map((t) => '<span class="puce trait" title="' + e(t.description) + '">' + e(t.nom) + "</span>").join("") : '<span class="petit">Pas encore de trait. Confie-lui une quête.</span>') + "</div></div></div>";
    }
    const lieux = etat.lieux.filter((l) => !l.ouvert && l.agents && l.agents.length);
    if (lieux.length) h += '<p class="petit">Ils arriveront avec les prochains étages : ' + lieux.map((l) => e(l.agents.join(" et "))).join(", ") + ".</p>";
    const cols = etat.collegues.collegues;
    h += "<h2>Tes sessions de travail <small>" + cols.length + "</small></h2>";
    if (cols.length) h += cols.map((c) => '<div class="encaissement"><span><b>' + e(c.nom) + '</b></span><span class="puce' + (c.statut === "actif" ? " points" : "") + '">' + e(c.statut === "actif" ? c.action || "travaille" : "en pause") + "</span></div>").join("");
    else h += '<p class="vide">Aucune session en ce moment. Quand Claude Code travaille pour toi, il apparaît ici et fait avancer la barre.</p>';
    h += "<h2>Les traits à gagner</h2>" + eq.traits_possibles.map((t) => '<div class="geste"><span class="puce trait">' + e(t.nom) + "</span><span>" + e(t.description) + "</span></div>").join("");
    h += '<p class="petit">Le but de la semaine est aussi écrit dans data/but-equipe.md. Le guide explique comment le faire lire à tes sessions.</p>';
    return h;
  }

  // ------------------------------------------------------------ encaissements
  function formulaireEncaissement(etat, valeurs, action, id) {
    const sources = etat.config.sources_encaissement;
    return (
      '<form class="formulaire" data-formulaire="' + action + '"' + (id ? ' data-id="' + id + '"' : "") + ">" +
      "<label>Montant (" + e(monnaie) + ')<input type="text" name="montant" inputmode="decimal" autocomplete="off" placeholder="39" value="' + e(valeurs.montant || "") + '" required></label>' +
      '<label>Date<input type="date" name="date" max="' + etat.date + '" value="' + e(valeurs.date || etat.date) + '" required></label>' +
      '<label class="large">Source<span class="sources">' + sources.map((s) => '<button type="button" data-action="source" data-source="' + e(s) + '" class="' + ((valeurs.source || sources[0]) === s ? "choisie" : "") + '">' + e(s) + "</button>").join("") + '</span><input type="hidden" name="source" value="' + e(valeurs.source || sources[0]) + '"></label>' +
      '<label class="large">Note (facultatif)<input type="text" name="note" maxlength="80" autocomplete="off" placeholder="Douze abonnés, un atelier..." value="' + e(valeurs.note || "") + '"></label>' +
      '<div class="large" style="display:flex;gap:8px;justify-content:flex-end">' + (id ? '<button type="button" class="bouton second" data-action="editer" data-id="">Annuler</button>' : "") + '<button type="submit" class="bouton vert">' + (id ? "Enregistrer" : "Encaisser") + "</button></div></form>"
    );
  }

  function ligneEncaissement(x, etat, ui) {
    if (ui.editer === x.id) return '<div class="carte">' + formulaireEncaissement(etat, { montant: String(x.montant).replace(".", ","), date: x.date, source: x.source, note: x.note }, "modifier", x.id) + "</div>";
    const confirme = ui.supprimer === x.id;
    return (
      '<div class="encaissement"><span><span class="montant chiffres">' + euros(x.montant) + '</span> <span class="puce">' + e(x.source) + '</span></span><span class="actions">' +
      (confirme
        ? '<button type="button" class="bouton mini" data-action="supprimer-oui" data-id="' + x.id + '">Supprimer</button><button type="button" class="lien" data-action="supprimer" data-id="">Garder</button>'
        : '<button type="button" class="lien" data-action="editer" data-id="' + x.id + '">Modifier</button><button type="button" class="lien" data-action="supprimer" data-id="' + x.id + '">Supprimer</button>') +
      '</span><span class="petit">' + e(dateLongue(x.date)) + (x.note ? " · " + e(x.note) : "") + "</span></div>"
    );
  }

  function encaissements(etat, ui) {
    const m = etat.mois;
    let h = '<div class="carte sombre"><span class="petit">' + (m.periode === "30_jours" ? "Sur les 30 derniers jours" : "En " + e(m.libelle)) + "</span><br>" + pixel(euros(m.total), 3, "u") + ' <span class="petit">sur ' + euros(m.objectif) + "</span>";
    if (m.rappel) h += "<p>" + e(m.rappel) + "</p>";
    else if (m.prochain_jalon) h += "<p>Prochain jalon : " + euros(m.prochain_jalon) + ". Il manque " + euros(m.prochain_jalon - m.total) + ".</p>";
    if (m.par_source.length) h += "<p>" + m.par_source.map((s) => '<span class="puce">' + e(s.source) + " " + euros(s.total) + "</span>").join(" ") + "</p>";
    h += "</div>";
    h += "<h2>Déclarer un encaissement</h2>" + formulaireEncaissement(etat, ui.formulaire || {}, "declarer");
    h += '<p class="petit">Le jeu ne lit aucun compte : c\'est toi qui déclares, une fois l\'argent reçu. Chaque encaissement pose un trophée sur ton étagère et t\'apporte un colis surprise.</p>';
    const duMois = etat.encaissements.filter((x) => x.date >= m.debut && x.date <= m.fin);
    const anciens = etat.encaissements.filter((x) => x.date < m.debut || x.date > m.fin);
    h += "<h2>" + (m.periode === "30_jours" ? "Trente derniers jours" : "Ce mois-ci") + " <small>" + pluriel(duMois.length, "encaissement", "encaissements") + "</small></h2>";
    h += duMois.length ? duMois.map((x) => ligneEncaissement(x, etat, ui)).join("") : '<p class="vide">Rien encore ce mois-ci. Le premier arrive.</p>';
    h += "<h2>Six derniers mois</h2>";
    const max = Math.max(m.objectif, ...m.historique.map((x) => x.total));
    h += '<div class="histo">' + m.historique.map((x) => '<div title="' + e(x.libelle) + " : " + euros(x.total) + '"><span class="chiffres">' + (x.total ? Math.round(x.total) : "") + '</span><i class="' + (x.id === m.id ? "courant" : "") + '" style="height:' + Math.round((x.total / max) * 44) + 'px"></i>' + e(MOIS[Number(x.id.slice(5, 7)) - 1].slice(0, 4)) + "</div>").join("") + "</div>";
    if (anciens.length) {
      h += '<details data-pli="anciens"' + (ui.plis.anciens ? " open" : "") + "><summary><span>Encaissements plus anciens</span><span>" + anciens.length + '</span></summary><div class="dedans">' + anciens.map((x) => ligneEncaissement(x, etat, ui)).join("") + "</div></details>";
    }
    return h;
  }

  // ------------------------------------------------------------ boutique
  function article(a, cle, etat, ui, options) {
    const o = options || {};
    const points = etat.partie.points;
    let bas = '<span class="puce points chiffres">' + a.prix + " points</span>";
    const effort = a.effort ? etat.efforts.find((x) => x.id === a.effort) : null;
    if (o.possede) bas = '<span class="puce">' + (o.piece ? "Pièce ouverte" : "Installé") + "</span>";
    else if (effort) bas = '<span class="puce effort">par l\'effort</span><span class="petit">' + e(effort.libelle) + " : " + effort.valeur + " sur " + effort.seuil + '</span><span class="mini-jauge large"><span style="width:' + Math.round((effort.valeur / effort.seuil) * 100) + '%"></span></span>';
    else if (points >= a.prix) bas += '<button type="button" class="bouton mini" data-action="' + (o.deco ? "acheter-deco" : "acheter") + '" data-lieu="' + e(o.lieu || "") + '" data-id="' + e(a.id) + '">Acheter</button>';
    else bas += '<span class="petit">Il te manque ' + (a.prix - points) + " points</span>";
    const vignette = o.piece ? sprite("icone-cadenas", 3) : sprite(a.id, a.id === "tapis" || a.id === "guirlande" || a.id === "fanions" ? 1 : 2);
    return '<div class="article' + (o.deco ? " rare" : "") + (ui.surligne === cle ? " surligne" : "") + '" data-article="' + e(cle) + '"><div class="vignette">' + vignette + "</div><b>" + e(a.nom) + (o.piece ? ' <span class="puce">pièce</span>' : "") + '</b><span class="petit">' + e(a.phrase) + '</span><div class="bas">' + bas + "</div></div>";
  }

  function boutique(etat, ui) {
    let h = '<p><span class="puce points chiffres">' + etat.partie.points + ' points</span> à dépenser. Les meubles achetés restent pour toujours.</p>';
    h += "<h2>Objets du jour <small>jusqu'à minuit</small></h2>";
    h += etat.boutique.du_jour.map((d) => article(d, "deco/" + d.id, etat, ui, { deco: true, possede: d.possede })).join("");
    h += "<h2>Améliorations</h2>";
    const ouverts = etat.lieux.filter((l) => l.ouvert);
    const lieu = ouverts.find((l) => l.id === ui.lieuBoutique) || ouverts[ouverts.length - 1];
    h += '<div class="onglets-lieux">' + ouverts.map((l) => '<button type="button" data-action="lieu-boutique" data-lieu="' + l.id + '" class="' + (l.id === lieu.id ? "actif" : "") + '">' + e(l.nom) + "</button>").join("") + "</div>";
    h += lieu.ameliorations.map((a) => article(a, lieu.id + "/" + a.id, etat, ui, { lieu: lieu.id, possede: a.achetee, piece: a.type === "piece" })).join("");
    const fermes = etat.lieux.filter((l) => !l.ouvert);
    if (fermes.length) h += '<p class="petit">Encore ' + pluriel(fermes.length, "lieu fermé", "lieux fermés") + ". Le prochain : " + e(fermes[0].nom) + ".</p>";
    return h;
  }

  // ------------------------------------------------------------ rangement et avatar
  function ranger(etat, ui, scene) {
    let h = '<div class="carte"><b>Mode rangement.</b> Clique un objet dans l\'immeuble pour le prendre. Déplace-le, puis clique pour le poser. Coins verts : la place est libre.</div>';
    const objets = scene ? scene.rangeables : [];
    h += "<h2>Tes objets <small>" + objets.length + "</small></h2>";
    if (!objets.length) h += '<p class="vide">Achète une amélioration dans la boutique : tu pourras la poser où tu veux.</p>';
    for (const el of objets) {
      const place = Boolean(etat.partie.placements[el.cle]);
      h += '<div class="article" data-article="' + e(el.cle) + '"><div class="vignette">' + sprite(el.sprite, el.l > 30 ? 1 : 2) + "</div><b>" + e(el.nom || el.sprite) + '</b><span class="petit">' + (place ? "Placé par toi" : "À sa place d'origine") + '</span><div class="bas"><button type="button" class="lien" data-action="montrer" data-cle="' + e(el.cle) + '">Le montrer</button>' + (place ? '<button type="button" class="lien" data-action="replacer" data-cle="' + e(el.cle) + '">Remettre à sa place</button>' : "") + "</div></div>";
    }
    const a = etat.partie.avatar;
    const P = racine.Personnages;
    const C = racine.Palette.C;
    h += '<h2>Ton avatar</h2><div class="apercu-avatar"><div class="cadre-avatar"><span class="pix" data-avatar="1" data-z="4"></span></div><div class="reglages">';
    h += '<span class="petit">Peau</span><div class="nuancier">' + P.PEAUX.map((c, i) => '<button type="button" data-action="avatar" data-champ="peau" data-valeur="' + i + '" class="' + (a.peau === i ? "choisie" : "") + '" style="background:' + C[c[0]] + '" aria-label="Peau ' + (i + 1) + '"></button>').join("") + "</div>";
    h += '<span class="petit">Cheveux</span><div class="nuancier">' + P.CHEVEUX.map((c, i) => '<button type="button" data-action="avatar" data-champ="cheveux" data-valeur="' + i + '" class="' + (a.cheveux === i ? "choisie" : "") + '" style="background:' + C[c[0]] + '" aria-label="Cheveux ' + (i + 1) + '"></button>').join("") + "</div>";
    h += '<span class="petit">Pull</span><div class="nuancier">' + P.PULLS_AVATAR.map((n, i) => '<button type="button" data-action="avatar" data-champ="pull" data-valeur="' + i + '" class="' + (a.pull === i ? "choisie" : "") + '" style="background:' + C[P.HAUTS[n][0]] + '" aria-label="Pull ' + (i + 1) + '"></button>').join("") + "</div>";
    h += '<span class="petit">Visage</span><div class="options"><button type="button" class="bouton second mini" data-action="avatar" data-champ="barbe" data-valeur="' + (a.barbe ? "non" : "oui") + '">' + (a.barbe ? "Barbe : oui" : "Barbe : non") + '</button><button type="button" class="bouton second mini" data-action="avatar" data-champ="lunettes" data-valeur="' + (a.lunettes ? "non" : "oui") + '">' + (a.lunettes ? "Lunettes : oui" : "Lunettes : non") + "</button></div>";
    h += "</div></div>";
    return h;
  }

  // ------------------------------------------------------------ carte
  function carte(etat, ui) {
    let h = "";
    if (etat.mission.phrase) {
      h += '<div class="carte sombre"><span class="petit">Ta mission, lue dans ton intention</span><p><b>' + e(etat.mission.phrase) + '</b></p><button type="button" class="lien" style="color:#F2C14E" data-action="mission">Lire la suite</button></div>';
    }
    h += '<p class="petit">Deux sortes de caps. Les étages s\'ouvrent avec un résultat : c\'est toi qui le confirmes. Les pièces et certains meubles s\'ouvrent avec un effort, que le jeu compte. Chaque récompense est connue à l\'avance.</p>';
    const prochain = etat.lieux.find((l) => !l.ouvert);
    for (const l of etat.lieux) {
      const courant = l.id === etat.partie.lieu_courant;
      h += '<div class="lieu' + (l.ouvert ? "" : " ferme") + (courant ? " courant" : "") + '"><span class="rang">' + (l.index + 1) + "</span><b>" + e(l.nom) + '</b><span class="petit">' + e(l.etage) + " · " + e(l.sous_titre) + "</span><span>";
      if (courant) h += '<span class="puce vente">Tu es ici</span> ';
      if (l.ouvert) {
        const faites = l.ameliorations.filter((a) => a.achetee).length;
        h += '<span class="puce">' + faites + " sur " + l.ameliorations.length + ' améliorations</span> <button type="button" class="lien" data-action="voir-lieu" data-lieu="' + l.id + '">Voir</button>';
        const effortsLieu = etat.efforts.filter((x) => x.lieu === l.id && !x.ouvert);
        for (const x of effortsLieu) h += '<br><span class="puce effort">effort</span> <span class="petit">' + e(x.nom) + " : " + e(x.libelle) + " (" + x.valeur + " sur " + x.seuil + ')</span><span class="mini-jauge"><span style="width:' + Math.round((x.valeur / x.seuil) * 100) + '%"></span></span>';
        if (l.cap && l.cap.atteint) h += '<br><span class="petit">Cap atteint le ' + dateCourte(l.cap.date) + "/" + l.cap.date.slice(0, 4) + ' : ' + e(l.cap.libelle) + '. </span><button type="button" class="lien" data-action="corriger-cap" data-cap="' + l.cap.id + '">Corriger</button>';
      } else if (l.cap) {
        h += '<span class="puce">résultat</span> <span class="petit">Cap : ' + e(l.cap.libelle) + ".</span>";
        h += '<br><span class="petit">Ce qui t\'y attend : ' + pluriel(l.ameliorations.length, "amélioration", "améliorations") + (l.agents && l.agents.length ? ", et " + e(l.agents.join(" et ")) + " dans l'équipe" : "") + ".</span>";
        if (l.cap.seuil_mois) h += '<br><span class="petit">Ton meilleur mois : ' + euros(l.cap.meilleur_mois || 0) + " sur " + euros(l.cap.seuil_mois) + ".</span>";
        if (prochain && prochain.id === l.id) {
          if (l.cap.suggere) h += '<br><span class="puce points">Tu y es. À toi de le cocher.</span>';
          h += '<br><button type="button" class="bouton mini" style="margin-top:6px" data-action="cap" data-cap="' + l.cap.id + '">J\'ai atteint ce cap</button>';
        }
      }
      h += "</span></div>";
    }
    if (etat.jalons.length) {
      h += "<h2>Jalons</h2>";
      for (const j of etat.jalons) {
        h += '<div class="geste"><span class="case' + (j.atteint ? " cochee" : "") + '"></span><span>' + e(j.libelle) + (j.atteint ? ' <button type="button" class="lien" data-action="corriger-cap" data-cap="' + j.id + '">Corriger</button>' : ' <button type="button" class="lien" data-action="cap" data-cap="' + j.id + '">C\'est fait</button>') + "</span></div>";
      }
    }
    h += '<p class="petit">Tous les seuils se changent dans <button type="button" class="lien" data-action="reglages" data-section="caps">Réglages</button>.</p>';
    return h;
  }

  // ------------------------------------------------------------ comment je me sens ?
  function etatDuJour(etat, ui) {
    const etats = etat.strategies.etats;
    if (!etats.length) return '<p class="vide">Je ne trouve pas la section « Stratégies par état » dans ton intention.</p>';
    const ouvert = etats[ui.etatOuvert] || null;
    if (!ouvert) {
      let h = "<p>Choisis ton état du moment. Je te rappelle les gestes que tu as écrits dans ton intention.</p>";
      if (etat.partie.etat_du_jour) h += '<p class="petit">Dernier état noté aujourd\'hui : ' + e(etat.partie.etat_du_jour.titre) + ", à " + e(etat.partie.etat_du_jour.heure.replace(":", " h ")) + ".</p>";
      h += '<div class="etats">' + etats.map((x, i) => '<button type="button" class="bouton" data-action="etat" data-rang="' + i + '">' + e(x.libelle) + "</button>").join("") + "</div>";
      return h;
    }
    let h = "<h2>" + e(ouvert.titre) + "</h2>";
    if (ouvert.signal) h += "<p><i>Signal : " + e(ouvert.signal) + "</i></p>";
    for (const g of ouvert.gestes) {
      h += '<div class="geste">' + (g.fait_aujourdhui ? '<span class="case cochee"></span>' : '<button type="button" class="case" data-action="geste" data-id="' + g.id + '" aria-label="Geste fait : ' + e(g.nom) + '"></button>') + "<span><b>" + e(g.nom) + '</b> <span class="puce points">+' + g.points + "</span><br>" + e(g.description) + "</span></div>";
    }
    if (etat.strategies.regle_commune) h += '<div class="carte">' + e(etat.strategies.regle_commune) + "</div>";
    h += '<button type="button" class="lien" data-action="etat" data-rang="-1">Changer d\'état</button>';
    return h;
  }

  // ------------------------------------------------------------ trophées, badges, historique
  function trophees(etat) {
    const col = etat.collection;
    const eus = col.filter((o) => o.possede).length;
    let h = "<h2>La collection <small>" + eus + " sur " + col.length + "</small></h2>";
    h += '<p class="petit">Chaque colis contient un de ces objets, parmi ceux que tu n\'as pas encore. Tu sais d\'avance ce qui peut arriver : tout est désirable. Un colis vient avec un contrat ambitieux tenu, ou un encaissement.</p>';
    h += '<div class="grille collection">' + col.map((o) => '<div class="objet' + (o.possede ? " eu" : "") + '" title="' + e(o.phrase) + '"><span class="pix" data-sprite="' + e(o.id) + '" data-z="' + (o.id === "guirlande" || o.id === "fanions" ? 1 : 2) + '"' + (o.possede ? "" : ' data-etat="ombre"') + "></span><b>" + e(o.nom) + "</b></div>").join("") + "</div>";
    h += "<h2>Étagère à trophées <small>" + pluriel(etat.trophees.length, "vente", "ventes") + "</small></h2>";
    if (!etat.trophees.length) h += '<p class="vide">Chaque encaissement déclaré pose un trophée ici, et sur l\'étagère de ton bureau.</p>';
    else h += '<div class="grille">' + etat.trophees.slice().reverse().map((t) => '<div class="trophee"><span class="pix" data-trophee="' + e(sourceTrophee(etat, t.source)) + '" data-z="4"></span><b class="chiffres">' + euros(t.montant) + "</b>" + e(t.source) + " · " + dateCourte(t.date) + "</div>").join("") + "</div>";
    const obtenus = etat.badges.filter((b) => b.obtenu);
    h += "<h2>Badges <small>" + obtenus.length + " sur " + etat.badges.length + "</small></h2>";
    for (const b of [...obtenus, ...etat.badges.filter((x) => !x.obtenu)]) {
      h += '<div class="badge' + (b.obtenu ? "" : " manque") + '"><span class="medaille"></span><span><b>' + e(b.nom) + '</b><br><span class="petit">' + e(b.description) + (b.date ? " Obtenu le " + dateCourte(b.date) + "." : "") + "</span></span></div>";
    }
    h += "<h2>Ton compteur</h2><p>" + pluriel(etat.partie.jours_joues, "jour joué", "jours joués") + ", " + pluriel(etat.partie.quetes_faites, "quête faite", "quêtes faites") + ". Ce compteur ne redescend jamais : une pause ne retire rien.</p>";
    if (etat.temoignages.length) {
      h += "<h2>Mur des témoignages</h2>";
      h += etat.temoignages.map((t) => '<div class="carte">« ' + e(t.texte) + " »" + (t.auteur ? '<br><span class="petit">' + e(t.auteur) + "</span>" : "") + "</div>").join("");
    }
    h += "<h2>Derniers gestes</h2>";
    if (!etat.partie.historique.length) h += '<p class="vide">Rien encore.</p>';
    for (const x of etat.partie.historique.slice(0, 14)) {
      h += '<div class="encaissement"><span>' + e(x.libelle) + '</span><span class="puce' + (x.points > 0 ? " points" : "") + ' chiffres">' + (x.points > 0 ? "+" : "") + (x.points || "") + '</span><span class="petit">' + e(String(x.quand).slice(0, 10) === etat.date ? "aujourd'hui" : dateLongue(String(x.quand).slice(0, 10))) + "</span></div>";
    }
    return h;
  }

  // Le dessin du trophée dépend du rang de la source dans tes réglages.
  const DESSINS_TROPHEES = ["Pro", "Coaching", "Ateliers", "Livre"];
  function sourceTrophee(etat, source) {
    const i = etat.config.sources_encaissement.indexOf(source);
    return DESSINS_TROPHEES[i] || "Autre";
  }

  function rendre(nom, etat, ui, scene) {
    switch (nom) {
      case "quetes":
        return quetes(etat, ui);
      case "journal":
        return journal(etat);
      case "equipe":
        return equipe(etat, ui);
      case "encaissements":
        return encaissements(etat, ui);
      case "boutique":
        return boutique(etat, ui);
      case "ranger":
        return ranger(etat, ui, scene);
      case "carte":
        return carte(etat, ui);
      case "etat":
        return etatDuJour(etat, ui);
      case "trophees":
        return trophees(etat);
      case "systeme":
        return racine.Systeme ? racine.Systeme.panneau(etat) : "";
      default:
        return "";
    }
  }

  racine.Panneaux = {
    TITRES,
    FONCTION_DE,
    rendre,
    e,
    euros,
    dateLongue,
    dateCourte,
    pixel,
    sprite,
    pluriel,
    etoiles,
    barreEquipe,
    ouvert,
    sourceTrophee,
    definirMonnaie(m) {
      monnaie = m || "€";
    },
  };
})(window);
