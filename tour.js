"use strict";
// Visite guidée du mode démo (?demo=1) : une journée entière dans l'immeuble, en une minute environ.
// Elle joue une vraie partie d'exemple, gardée en mémoire par le serveur : rien n'est enregistré.
// ?demo=1&tour=0 ouvre la démo sans la visite.
(function (racine) {
  const App = racine.App;
  if (!App) return;
  const P = racine.Panneaux;
  const attendre = (s) => new Promise((ok) => setTimeout(ok, s * 1000));
  let jeton = 0;

  function barre(i, total, texte, fini) {
    const el = document.getElementById("demo-tour");
    el.hidden = false;
    el.innerHTML =
      '<span class="etape">' + (fini ? "Démo" : "Démo " + (i + 1) + " sur " + total) + '</span><span class="texte">' + P.e(texte) + "</span>" +
      (fini
        ? '<button type="button" class="bouton mini" data-tour="rejouer">Rejouer la visite</button><button type="button" class="bouton second mini" data-tour="fermer">Jouer librement</button>'
        : '<button type="button" class="bouton second mini" data-tour="passer">Passer</button>') +
      '<span class="avance" style="width:' + (fini ? 100 : Math.round((i / total) * 100)) + '%"></span>';
  }

  const ouvertes = () => {
    const e = App.etat();
    return [...e.jours.flatMap((j) => j.priorites), ...e.quetes].filter((q) => !q.payee && !q.avant_jeu);
  };
  const valider = (q, degre) => App.agir((q.genre === "priorite" ? "/api/priorites/" : "/api/quetes/") + q.id + "/valider", { degre });

  // Chaque étape : un texte, une action, une durée en secondes.
  const ETAPES = [
    {
      texte: "Voici ton immeuble. Il grandit quand tu avances pour de vrai.",
      duree: 3,
      f: () => {
        App.fermerFenetre();
        App.fermerPanneau();
        App.vue("immeuble");
      },
    },
    {
      texte: "Le matin : deux contrats. Un sûr, un ambitieux avec une mise. Aucun n'est le bon choix d'office.",
      duree: 5,
      f: () => {
        if (App.etat().contrat.a_choisir) App.fenetreContrat();
      },
    },
    {
      texte: "On signe l'ambitieux : 20 points sur la table. On peut perdre la mise, jamais un acquis.",
      duree: 3,
      f: async () => {
        const c = App.etat().contrat;
        App.fermerFenetre();
        App.vue("lieu");
        if (c.a_choisir) {
          const heures = c.propositions.ambitieux.heures;
          await App.agir("/api/contrat", { choix: "ambitieux", heure: heures[heures.length - 1].valeur });
        }
        App.ouvrirPanneau("quetes");
      },
    },
    {
      texte: "Chaque quête a trois degrés de réussite, fixés à l'avance.",
      duree: 3.5,
      f: () => {
        const k = App.etat().contrat.du_jour;
        if (k && k.vedette && !k.vedette.faite) App.ouvrirDegres(k.vedette.id);
      },
    },
    {
      texte: "Une action de vente, trois étoiles : elle paie double.",
      duree: 3.5,
      f: async () => {
        const k = App.etat().contrat.du_jour;
        const q = k && k.vedette ? ouvertes().find((x) => x.id === k.vedette.id) : ouvertes().find((x) => x.type_quete === "vente");
        if (q) await valider(q, 3);
      },
    },
    {
      texte: "Une quête de création ne se paie pas : elle se raconte dans le journal de l'immeuble.",
      duree: 4.5,
      f: async () => {
        const q = ouvertes().find((x) => x.mode === "racontee");
        if (q) await valider(q, 2);
        await attendre(1.2);
        App.ouvrirPanneau("journal");
      },
    },
    {
      texte: "Confie une quête à un agent dans son élément : le but d'équipe avance d'un coup de pouce.",
      duree: 4.5,
      f: async () => {
        App.ouvrirPanneau("quetes");
        const k = App.etat().contrat.du_jour;
        const ids = k ? k.quetes.filter((x) => !x.faite).map((x) => x.id) : [];
        const q = ouvertes().find((x) => ids.includes(x.id)) || ouvertes().find((x) => x.mode === "payee");
        if (!q) return;
        const agent = App.etat().agents.find((a) => a.specialite === q.type_quete);
        if (agent) await App.agir("/api/quetes/" + q.id + "/confier", { agent: agent.id });
        await attendre(1.3);
        await valider(q, 2);
      },
    },
    {
      texte: "Dernière quête du contrat, avant l'heure : contrat tenu. Les points tombent, un colis arrive.",
      duree: 5,
      f: async () => {
        const k = App.etat().contrat.du_jour;
        if (!k || k.statut !== "en_cours") return;
        const restantes = [...(k.vedette ? [k.vedette] : []), ...k.quetes].filter((x) => !x.faite).map((x) => x.id);
        for (const id of restantes) {
          const q = ouvertes().find((x) => x.id === id);
          if (q) await valider(q, 2);
        }
      },
    },
    {
      texte: "Le colis : sa collection se voit à l'avance. Tout ce qui peut en sortir fait envie.",
      duree: 5.5,
      f: async () => {
        const colis = App.etat().colis;
        if (colis.length) await App.agir("/api/colis/" + colis[colis.length - 1].id + "/ouvrir");
      },
    },
    {
      texte: "Les plantes ne fanent jamais. Les arroser donne un bonus, pour quelques heures.",
      duree: 4,
      f: async () => {
        App.fermerFenetre();
        App.vue("lieu");
        if (!App.etat().arrosage.fait_aujourdhui) await App.agir("/api/arroser");
      },
    },
    {
      texte: "Tu déclares ce que tu encaisses : la barre du mois avance, jusqu'à ton objectif à toi.",
      duree: 4.5,
      f: async () => {
        App.ouvrirPanneau("encaissements");
        const e = App.etat();
        const reste = Math.max(100, e.mois.objectif - e.mois.total);
        await App.agir("/api/encaissements", { montant: reste, source: e.config.sources_encaissement[0], note: "Démo" });
      },
    },
    {
      texte: "Le but d'équipe de la semaine : rempli par tes quêtes et par le travail de tes agents.",
      duree: 4,
      f: () => App.ouvrirPanneau("equipe"),
    },
    {
      texte: "Deux sortes de caps : les étages par un résultat, les pièces par un effort.",
      duree: 3.5,
      f: () => {
        App.ouvrirPanneau("carte");
        App.vue("immeuble");
      },
    },
    {
      texte: "Le dimanche : trois chiffres, et ce que la semaine t'apprend.",
      duree: 6.5,
      f: () => {
        if (App.etat().dimanche.disponible) App.fenetreDimanche();
      },
    },
    {
      texte: "Semaine bouclée : la récompense était connue d'avance. Un fanion de plus sur le toit.",
      duree: 5,
      f: async () => {
        const dispo = App.etat().dimanche.disponible;
        App.fermerFenetre();
        App.fermerPanneau();
        if (dispo) await App.agir("/api/semaine/cloturer", { mot: "Vendre le matin, créer l'après-midi." });
      },
    },
    {
      texte: "Version 4 : le Système. Chaque quête donne de l'expérience et de l'or. Tu montes du rang E au rang S.",
      duree: 5,
      f: () => {
        App.fermerFenetre();
        if (racine.Systeme) racine.Systeme.ouvrir("fiche");
        App.ouvrirPanneau("systeme");
        App.majPanneau();
      },
    },
    {
      texte: "Tes rituels : quotidiennes et habitudes. Une absence ne coûte jamais rien.",
      duree: 4,
      f: async () => {
        if (racine.Systeme) racine.Systeme.ouvrir("jour");
        App.majPanneau();
        const q = ((App.etat().systeme || {}).quotidiennes || []).find((x) => !x.faite);
        if (q) await App.agir("/api/systeme/quotidiennes/" + q.id + "/cocher", {});
      },
    },
    {
      texte: "Un gros projet devient un donjon. Chaque quête et chaque étape frappent son boss.",
      duree: 5,
      f: async () => {
        if (racine.Systeme) racine.Systeme.ouvrir("donjons");
        App.majPanneau();
        const d = ((App.etat().systeme || {}).donjons || []).find((x) => x.actif);
        const etape = d && d.etapes.find((x) => !x.faite);
        if (etape) await App.agir("/api/systeme/donjons/" + d.id + "/etapes/" + etape.id + "/cocher", {});
      },
    },
    {
      texte: "Ombres, butin, familiers, équipe, recherche, saisons : ton studio grandit avec toi.",
      duree: 4,
      f: () => {
        if (racine.Systeme) racine.Systeme.ouvrir("studio");
        App.majPanneau();
      },
    },
    {
      texte: "Et tout se règle : objectifs, montants, monnaie, caps, points, mise, plafond, noms, agents.",
      duree: 4,
      f: () => App.fenetreReglages("objectif"),
    },
  ];

  const Tour = {
    actif: false,
    termine: false,
    async lancer() {
      const moi = ++jeton;
      Tour.actif = true;
      for (let i = 0; i < ETAPES.length; i++) {
        if (moi !== jeton) return;
        barre(i, ETAPES.length, ETAPES[i].texte, false);
        try {
          await ETAPES[i].f();
        } catch (err) {
          // une étape qui échoue ne doit pas arrêter la visite
        }
        await attendre(ETAPES[i].duree);
      }
      if (moi !== jeton) return;
      Tour.finir("C'était une journée. Cette partie d'exemple est à toi : rien n'est enregistré.");
    },
    finir(texte) {
      jeton++;
      Tour.actif = false;
      Tour.termine = true;
      App.fermerFenetre();
      App.vue("lieu");
      App.ouvrirPanneau("quetes");
      barre(0, 1, texte, true);
    },
  };

  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-tour]");
    if (!b) return;
    if (b.dataset.tour === "passer") Tour.finir("Visite passée. La partie d'exemple est à toi : rien n'est enregistré.");
    else if (b.dataset.tour === "fermer") document.getElementById("demo-tour").hidden = true;
    else if (b.dataset.tour === "rejouer") {
      await App.agir("/api/test/reinitialiser");
      location.reload();
    }
  });

  racine.Tour = Tour;
})(window);
