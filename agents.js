"use strict";
// La vie de l'immeuble : toi, les agents maison, les collègues, les visiteurs, le livreur, le chat.
// Chacun suit un petit plan (aller, s'asseoir, parler, attendre) et se déplace par un vrai chemin.
(function (racine) {
  const Monde = racine.Monde;
  const Personnages = racine.Personnages;
  const Meubles = racine.Meubles;
  const Palette = racine.Palette;

  const VITESSE = 30; // pixels par seconde
  const VITESSE_ASC = 44;
  const liste = [];
  let scene = null;
  let nav = { ouverts: ["studio"], achats: {} };
  let horloge = 0;
  const alea = Palette.hasard(20261116);
  const asc = { y: Monde.yNiveau(0), niveau: 0, cible: null, file: [], pause: 0, passagers: 0 };
  const colis = []; // { id, x, niveau, pose }
  let surEvenement = function () {};
  let prochaineBulle = 1;

  function hasard(a, b) {
    return a + alea() * (b - a);
  }
  function choisir(t) {
    return t[Math.floor(alea() * t.length)];
  }

  // ------------------------------------------------------------ création
  function creer(o) {
    const a = {
      id: o.id,
      type: o.type,
      nom: o.nom || "",
      look: o.look,
      jeu: Personnages.fabriquer(o.look),
      x: o.x,
      y: Monde.yNiveau(o.niveau),
      niveau: o.niveau,
      dir: o.dir || 1,
      mode: "debout", // debout, marche, assis, escalier, ascenseur, passage
      anim: "debout",
      siege: null,
      siegeVoulu: null,
      plan: [],
      tache: null,
      segments: null,
      attente: 0,
      bulle: null,
      routine: horloge + hasard(8, 40),
      actif: true,
      action: "",
      phase: alea() * 10,
      porte: false,
      cache: false,
      quete: null,
      renforts: 0,
      part: false,
    };
    liste.push(a);
    return a;
  }

  function trouver(id) {
    return liste.find((a) => a.id === id) || null;
  }

  function dire(a, texte, duree) {
    if (!a || !texte) return;
    a.bulle = { texte, fin: horloge + (duree || 3.5) };
  }

  // ------------------------------------------------------------ sièges
  function siegeLibre(s, pour) {
    return !liste.some((a) => a !== pour && (a.siege === s.id || a.siegeVoulu === s.id));
  }
  function siegeParId(id) {
    return scene ? scene.sieges.find((s) => s.id === id) || null : null;
  }
  function choisirSiege(a, filtres) {
    if (!scene) return null;
    const toi = scene.toi;
    for (const filtre of filtres) {
      const candidats = scene.sieges.filter((s) => filtre(s) && siegeLibre(s, a));
      if (!candidats.length) continue;
      candidats.sort((s1, s2) => distance(s1, toi) - distance(s2, toi));
      return candidats[0];
    }
    return null;
  }
  function distance(s, t) {
    if (!t) return 0;
    return Math.abs(s.x - t.x) + Math.abs(s.niveau - t.niveau) * 200 + (s.lieu === t.lieu ? 0 : 400);
  }

  // ------------------------------------------------------------ plans
  function allerSasseoir(a, s) {
    if (!s) return;
    a.siegeVoulu = s.id;
    a.plan.push({ t: "aller", x: s.x, niveau: s.niveau }, { t: "asseoir", siege: s.id });
  }

  function retourAuPoste(a) {
    const s = siegeParId(a.siegeVoulu) || siegeParId(a.poste);
    if (s) allerSasseoir(a, s);
  }

  function seLever(a) {
    if (a.mode === "assis") {
      a.mode = "debout";
      a.siege = null;
      a.y = Monde.yNiveau(a.niveau);
    }
  }

  // Remplace le plan en cours (sans téléporter : l'agent repart d'où il est).
  function nouveauPlan(a, taches) {
    if (a.mode === "ascenseur" || a.mode === "escalier" || a.mode === "passage") {
      // on termine le changement d'étage en cours avant de changer d'idée
      a.plan = a.plan.slice(0, 0).concat(taches);
      return;
    }
    a.tache = null;
    a.segments = null;
    a.plan = taches;
  }

  // ------------------------------------------------------------ synchronisation avec l'état du jeu
  // donnees : { scene, nav, toi: avatar, agents: [...], collegues: [...], premier: bool }
  function synchroniser(d) {
    scene = d.scene;
    nav = d.nav;
    const direct = d.premier === true; // au chargement, chacun est déjà à sa place

    // toi
    let toi = trouver("toi");
    const lookToi = Personnages.lookToi(d.avatar);
    if (!toi) {
      const s = scene.toi;
      toi = creer({ id: "toi", type: "toi", nom: "Toi", look: lookToi, x: s.x, niveau: s.niveau });
      asseoirDirect(toi, s);
    } else {
      if (JSON.stringify(toi.look) !== JSON.stringify(lookToi)) {
        toi.look = lookToi;
        toi.jeu = Personnages.fabriquer(lookToi);
      }
      if (toi.poste !== scene.toi.id) {
        toi.poste = scene.toi.id;
        seLever(toi);
        nouveauPlan(toi, []);
        allerSasseoir(toi, scene.toi);
      }
    }
    toi.poste = scene.toi.id;

    // agents maison
    for (const ag of d.agents) {
      const s = scene.sieges.find((x) => x.role === "agent:" + ag.id);
      if (!s) continue;
      let a = trouver(ag.id);
      if (!a) {
        a = creer({ id: ag.id, type: "maison", nom: ag.nom, look: Personnages.LOOKS_AGENTS[ag.id] || Personnages.lookVisiteur(ag.id), x: s.x, niveau: s.niveau });
        if (direct) asseoirDirect(a, s);
        else arriver(a, s);
      } else if (a.poste !== s.id && !a.part) {
        seLever(a);
        nouveauPlan(a, []);
        allerSasseoir(a, s);
      }
      a.poste = s.id;
      a.nom = ag.nom;
      a.role = ag.role;
      a.nom_specialite = ag.nom_specialite || "";
      if (a.quete !== ag.quete) {
        a.quete = ag.quete;
        a.texteQuete = ag.texteQuete || "";
      }
      a.actif = Boolean(ag.quete);
    }
    for (const a of liste) {
      if (a.type === "maison" && !d.agents.some((x) => x.id === a.id) && !a.part) partir(a);
    }

    // collègues (sessions de travail)
    const presents = new Set(d.collegues.map((c) => "c-" + c.cle));
    for (const c of d.collegues) {
      const id = "c-" + c.cle;
      let a = trouver(id);
      if (!a) {
        a = creer({ id, type: "collegue", nom: c.nom, look: Personnages.lookCollegue(c.cle), x: -12, niveau: Monde.RUE });
        const s = choisirSiege(a, [(x) => x.role === "libre" && !x.detente, (x) => x.role === "libre" || x.role === "detente"]);
        if (s) {
          a.poste = s.id;
          if (direct) asseoirDirect(a, s);
          else arriver(a, s);
        } else {
          a.x = scene.toi.x + hasard(-40, 40);
          a.niveau = scene.toi.niveau;
          a.y = Monde.yNiveau(a.niveau);
        }
      } else if (a.part) {
        a.part = false;
        nouveauPlan(a, []);
        retourAuPoste(a);
      }
      a.nom = c.nom;
      a.renforts = c.renforts;
      const actif = c.statut === "actif";
      a.action = c.action;
      if (a.actif !== actif) {
        a.actif = actif;
        if (!actif) a.routine = horloge + hasard(1, 6); // en pause : il va vite se détendre
        else if (a.mode !== "assis" && !a.plan.length) retourAuPoste(a);
      }
      // siège disparu (rangement, déménagement) : en trouver un autre
      if (a.poste && !siegeParId(a.poste)) {
        const s = choisirSiege(a, [(x) => x.role === "libre" && !x.detente, (x) => x.role === "libre" || x.role === "detente"]);
        if (s) {
          a.poste = s.id;
          seLever(a);
          nouveauPlan(a, []);
          allerSasseoir(a, s);
        }
      }
    }
    for (const a of liste) {
      if (a.type === "collegue" && !presents.has(a.id) && !a.part) partir(a);
    }
    // sièges disparus pour toi et les agents maison
    for (const a of liste) {
      if (a.siege && !siegeParId(a.siege)) {
        seLever(a);
        if (a.poste && siegeParId(a.poste)) allerSasseoir(a, siegeParId(a.poste));
      } else if (a.siege) {
        const s = siegeParId(a.siege);
        a.x = s.x;
        a.niveau = s.niveau;
        a.y = Monde.yNiveau(s.niveau) + s.dy;
        a.dir = s.dir;
      }
    }
    // colis en attente : posés près de ton poste
    const attendus = d.colis || [];
    for (let i = colis.length - 1; i >= 0; i--) if (!attendus.some((c) => c.id === colis[i].id)) colis.splice(i, 1);
    for (const c of attendus) {
      if (colis.some((x) => x.id === c.id) || liste.some((a) => a.livre === c.id)) continue;
      if (direct) poserColis(c.id);
      else livraison(c.id);
    }
  }

  function asseoirDirect(a, s) {
    a.x = s.x;
    a.niveau = s.niveau;
    a.y = Monde.yNiveau(s.niveau) + s.dy;
    a.dir = s.dir;
    a.mode = "assis";
    a.siege = s.id;
    a.siegeVoulu = s.id;
    a.poste = a.poste || s.id;
    a.plan = [];
    a.tache = null;
  }

  // Arrive par la rue, traverse le passage, monte à son poste.
  function arriver(a, s) {
    a.x = alea() < 0.5 ? -14 : Monde.L + 14;
    a.niveau = Monde.RUE;
    a.y = Monde.Y_RUE;
    a.mode = "debout";
    a.plan = [];
    allerSasseoir(a, s);
  }

  function partir(a) {
    a.part = true;
    seLever(a);
    nouveauPlan(a, [{ t: "aller", x: alea() < 0.5 ? -16 : Monde.L + 16, niveau: Monde.RUE }, { t: "disparaitre" }]);
  }

  // ------------------------------------------------------------ événements
  // Tu viens de finir une quête : tu lèves les bras, un agent vient te féliciter.
  function feliciter(agentId) {
    const toi = trouver("toi");
    if (!toi) return;
    const ancien = siegeParId(toi.poste);
    if (toi.mode === "assis" || toi.mode === "debout") {
      seLever(toi);
      nouveauPlan(toi, [{ t: "attendre", s: 1.8, anim: "bravo" }]);
      if (ancien) allerSasseoir(toi, ancien);
    }
    let ami = agentId ? trouver(agentId) : null;
    if (!ami) {
      const proches = liste.filter((a) => (a.type === "maison" || a.type === "collegue") && !a.part && a.mode === "assis" && a.niveau !== Monde.RUE);
      proches.sort((p, q) => Math.abs(p.niveau - toi.niveau) * 300 + Math.abs(p.x - toi.x) - (Math.abs(q.niveau - toi.niveau) * 300 + Math.abs(q.x - toi.x)));
      ami = proches[0] || null;
    }
    if (ami) {
      seLever(ami);
      const cote = ami.x < toi.x ? -1 : 1;
      nouveauPlan(ami, [
        { t: "aller", x: toi.x + cote * 15, niveau: toi.niveau },
        { t: "face", dir: -cote },
        { t: "dire", texte: choisir(["Bravo !", "Bien joué !", "Une de plus !", "Ça avance !", "Beau travail !"]), s: 2.6, anim: "bravo" },
      ]);
      retourAuPoste(ami);
    }
  }

  // Un grand moment : tout le monde se lève et applaudit, puis chacun retourne à sa place.
  function tousBravo(duree) {
    const s = duree || 3;
    for (const a of liste) {
      if (a.part || a.type === "livreur" || a.type === "visiteur" || a.niveau === Monde.RUE) continue;
      if (a.mode !== "assis" && a.mode !== "debout") continue;
      const poste = siegeParId(a.siege) || siegeParId(a.poste);
      seLever(a);
      nouveauPlan(a, [{ t: "attendre", s: s + hasard(0, 0.6), anim: "bravo" }]);
      if (poste) allerSasseoir(a, poste);
    }
  }

  // Un cran du but d'équipe : deux agents se retrouvent et se félicitent.
  function seFeliciter(crans, total) {
    const dispo = liste.filter((a) => (a.type === "maison" || a.type === "collegue") && !a.part && a.mode === "assis" && !a.plan.length && a.niveau !== Monde.RUE);
    if (!dispo.length) return;
    const a = choisir(dispo);
    const autres = dispo.filter((b) => b !== a).sort((p, q) => Math.abs(p.niveau - a.niveau) * 300 + Math.abs(p.x - a.x) - (Math.abs(q.niveau - a.niveau) * 300 + Math.abs(q.x - a.x)));
    const b = autres[0] || trouver("toi");
    if (!b) return dire(a, crans + " sur " + total + " !", 3);
    seLever(a);
    const cote = a.x < b.x ? -1 : 1;
    const premier = crans >= total ? "On l'a fait !" : choisir(["Un cran de plus !", crans + " sur " + total + " !", "Bien joué, " + (b.type === "toi" ? "à nous tous" : b.nom) + " !", "Ça avance, l'équipe."]);
    const reponse = crans >= total ? "Tous ensemble." : choisir(["Bien joué à toi aussi.", "On continue.", "Belle équipe.", "Encore " + (total - crans) + "."]);
    nouveauPlan(a, [
      { t: "aller", x: b.x + cote * 14, niveau: b.niveau },
      { t: "face", dir: -cote },
      { t: "dire", texte: premier, s: 2.6, anim: "bravo" },
      { t: "fn", f: () => dire(b, reponse, 2.6) },
      { t: "attendre", s: 2.6, anim: "debout" },
    ]);
    retourAuPoste(a);
  }

  // Tu arroses : tu te lèves, tu vas jusqu'à la plante, tu reviens.
  function arroser(x, niveau) {
    const toi = trouver("toi");
    if (!toi || (toi.mode !== "assis" && toi.mode !== "debout")) return;
    const poste = siegeParId(toi.siege) || siegeParId(toi.poste);
    seLever(toi);
    nouveauPlan(toi, [
      { t: "aller", x: x - 9, niveau },
      { t: "face", dir: 1 },
      { t: "attendre", s: 1.8, anim: "boit" },
    ]);
    if (poste) allerSasseoir(toi, poste);
  }

  // Tu confies une quête à un agent : il vient te voir, vous vous parlez, il se met au travail.
  function confier(agentId, texte) {
    const toi = trouver("toi");
    const a = trouver(agentId);
    if (!toi || !a) return;
    seLever(a);
    const cote = a.x < toi.x ? -1 : 1;
    nouveauPlan(a, [
      { t: "aller", x: toi.x + cote * 15, niveau: toi.niveau },
      { t: "face", dir: -cote },
      { t: "dire", texte: choisir(["On s'y met ?", "Je suis avec toi.", "C'est parti ?"]), s: 2.2, anim: "parle" },
      { t: "fn", f: () => dire(toi, choisir(["C'est parti.", "Allez, on y va.", "On s'y met."]), 2.2) },
      { t: "attendre", s: 2.2, anim: "debout" },
    ]);
    retourAuPoste(a);
    a.texteQuete = texte || "";
  }

  // Des lecteurs passent te voir : ils entrent, regardent, repartent.
  let nbVisiteurs = 0;
  function visiteurs(n) {
    const toi = trouver("toi");
    if (!toi) return;
    for (let i = 0; i < Math.min(n, 5); i++) {
      nbVisiteurs++;
      const v = creer({ id: "v-" + nbVisiteurs, type: "visiteur", nom: "Lecteur", look: Personnages.lookVisiteur(nbVisiteurs), x: -14 - i * 22, niveau: Monde.RUE });
      v.y = Monde.Y_RUE;
      const cote = i % 2 ? 1 : -1;
      v.plan = [
        { t: "attendre", s: i * 1.4, anim: "debout" },
        { t: "aller", x: toi.x + cote * (18 + i * 9), niveau: toi.niveau },
        { t: "face", dir: -cote },
        { t: "dire", texte: choisir(["J'ai lu ton édition !", "Merci pour l'édition.", "Belle édition.", "Je me suis abonné.", "Vivement la suite."]), s: 3, anim: "parle" },
        { t: "attendre", s: 1.5, anim: "debout" },
        { t: "aller", x: Monde.L + 16 + i * 10, niveau: Monde.RUE },
        { t: "disparaitre" },
      ];
    }
  }

  // Le livreur dépose un colis surprise près de ton poste.
  function livraison(id) {
    const toi = trouver("toi");
    if (!toi) return poserColis(id);
    const l = creer({ id: "livreur-" + id, type: "livreur", nom: "Livreur", look: Personnages.LOOK_LIVREUR, x: Monde.L + 14, niveau: Monde.RUE });
    l.y = Monde.Y_RUE;
    l.livre = id;
    l.porte = true;
    l.plan = [
      { t: "aller", x: toi.x + 22, niveau: toi.niveau },
      { t: "face", dir: -1 },
      { t: "dire", texte: "Un colis pour toi !", s: 2.2, anim: "debout" },
      { t: "fn", f: () => { l.porte = false; l.livre = null; poserColis(id); surEvenement("colis-pose", id); } },
      { t: "aller", x: Monde.L + 16, niveau: Monde.RUE },
      { t: "disparaitre" },
    ];
  }

  function poserColis(id) {
    if (colis.some((c) => c.id === id) || !scene) return;
    const toi = scene.toi;
    colis.push({ id, x: toi.x + 20 + colis.length * 13, niveau: toi.niveau, pose: horloge });
  }

  // Déménagement : des cartons voyagent de l'ancien poste au nouveau.
  function demenagement(ancien, nouveau, fini) {
    const porteurs = liste.filter((a) => (a.type === "maison" || a.type === "collegue") && !a.part).slice(0, 4);
    let restants = porteurs.length;
    if (!restants) return fini && fini();
    porteurs.forEach((a, i) => {
      seLever(a);
      a.porte = false;
      nouveauPlan(a, [
        { t: "attendre", s: i * 0.7, anim: "debout" },
        { t: "aller", x: ancien.x + 10 + i * 8, niveau: ancien.niveau },
        { t: "fn", f: () => (a.porte = true) },
        { t: "aller", x: nouveau.x + 14 + i * 9, niveau: nouveau.niveau },
        { t: "fn", f: () => { a.porte = false; if (--restants === 0 && fini) fini(); } },
      ]);
      retourAuPoste(a);
    });
  }

  // ------------------------------------------------------------ routines (café, papotage)
  function routine(a) {
    a.routine = horloge + hasard(35, 90);
    if (!scene || a.mode !== "assis" || a.plan.length || a.part) return;
    if (a.type === "toi") {
      a.routine = horloge + hasard(80, 160);
      if (alea() < 0.5) return;
    }
    if (a.type === "collegue" && a.actif && alea() < 0.6) return; // un collègue actif reste concentré
    if (a.type === "maison" && a.quete && alea() < 0.7) return;
    const cafes = scene.cafes.filter((c) => Monde.itineraire(nav, { x: a.x, niveau: a.niveau }, c));
    const autres = liste.filter((b) => b !== a && b.mode === "assis" && !b.plan.length && b.type !== "visiteur" && Math.abs(b.niveau - a.niveau) <= 1);
    const poste = siegeParId(a.siege);
    seLever(a);
    if (cafes.length && (alea() < 0.6 || !autres.length)) {
      cafes.sort((c1, c2) => Math.abs(c1.niveau - a.niveau) * 300 + Math.abs(c1.x - a.x) - (Math.abs(c2.niveau - a.niveau) * 300 + Math.abs(c2.x - a.x)));
      const c = cafes[0];
      a.plan = [{ t: "aller", x: c.x - 4 + Math.floor(hasard(-6, 6)), niveau: c.niveau }, { t: "face", dir: 1 }, { t: "attendre", s: hasard(4, 7), anim: "boit" }];
    } else if (autres.length) {
      const b = choisir(autres);
      const cote = a.x < b.x ? -1 : 1;
      a.plan = [
        { t: "aller", x: b.x + cote * 14, niveau: b.niveau },
        { t: "face", dir: -cote },
        { t: "dire", texte: choisir(["Tu as vu ça ?", "Une idée pour la suite.", "Ça avance bien.", "On relit ensemble ?", "Petit point rapide.", "Un café après ?"]), s: 2.6, anim: "parleCote" },
        { t: "fn", f: () => dire(b, choisir(["Bonne idée.", "Oui, vas-y.", "Bien vu.", "Je regarde.", "Dans cinq minutes."]), 2.4) },
        { t: "attendre", s: 2.4, anim: "debout" },
      ];
    } else {
      a.plan = [{ t: "attendre", s: 2, anim: "debout" }];
    }
    if (a.type === "collegue" && !a.actif) {
      // en pause : il préfère un canapé s'il y en a un
      const detente = choisirSiege(a, [(s) => s.detente && s.role !== "toi"]);
      if (detente && alea() < 0.7) return allerSasseoir(a, detente);
    }
    if (poste) allerSasseoir(a, poste);
  }

  // ------------------------------------------------------------ déplacements
  function avancer(a, dt) {
    if (!a.tache) {
      a.tache = a.plan.shift() || null;
      if (!a.tache) return;
      const t = a.tache;
      if (t.t === "aller") {
        seLever(a);
        const depart = { x: a.x, niveau: a.niveau };
        a.segments = Monde.itineraire(nav, depart, { x: t.x, niveau: t.niveau });
        if (!a.segments) {
          // pas de chemin (pièce fermée entre-temps) : on arrive sans passer par les murs visibles
          a.x = t.x;
          a.niveau = t.niveau;
          a.y = Monde.yNiveau(t.niveau);
          a.tache = null;
          return;
        }
      } else if (t.t === "attendre" || t.t === "dire") {
        a.attente = t.s;
        a.anim = t.anim || "debout";
        if (t.t === "dire") dire(a, t.texte, t.s);
      } else if (t.t === "asseoir") {
        const s = siegeParId(t.siege);
        if (s && siegeLibre(s, a)) {
          a.x = s.x;
          a.y = Monde.yNiveau(s.niveau) + s.dy;
          a.dir = s.dir;
          a.mode = "assis";
          a.siege = s.id;
        }
        a.tache = null;
        return;
      } else if (t.t === "face") {
        a.dir = t.dir;
        a.tache = null;
        return;
      } else if (t.t === "fn") {
        a.tache = null;
        t.f();
        return;
      } else if (t.t === "disparaitre") {
        a.mort = true;
        a.tache = null;
        return;
      }
    }
    const t = a.tache;
    if (t.t === "attendre" || t.t === "dire") {
      a.attente -= dt;
      if (a.attente <= 0) {
        a.tache = null;
        a.anim = "debout";
      }
      return;
    }
    if (t.t !== "aller") return;
    const seg = a.segments[0];
    if (!seg) {
      a.tache = null;
      a.mode = "debout";
      a.anim = "debout";
      return;
    }
    if (seg.type === "marche") {
      a.mode = "marche";
      const d = seg.x - a.x;
      const pas = VITESSE * dt;
      if (Math.abs(d) <= pas) {
        a.x = seg.x;
        a.segments.shift();
        if (!a.segments.length) a.mode = "debout";
      } else {
        a.dir = d > 0 ? 1 : -1;
        a.x += a.dir * pas;
      }
      a.y = Monde.yNiveau(a.niveau);
    } else if (seg.type === "escalier") {
      a.mode = "escalier";
      if (!seg.points) {
        seg.points = Monde.pointsEscalier(seg.de, seg.vers);
        seg.i = 1;
      }
      const p = seg.points[seg.i];
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      const dist = Math.hypot(dx, dy);
      const pas = VITESSE * 0.85 * dt;
      if (dist <= pas) {
        a.x = p.x;
        a.y = p.y;
        seg.i++;
        if (seg.i >= seg.points.length) {
          a.niveau = seg.vers;
          a.segments.shift();
        }
      } else {
        a.x += (dx / dist) * pas;
        a.y += (dy / dist) * pas;
        if (Math.abs(dx) > 0.1) a.dir = dx > 0 ? 1 : -1;
      }
    } else if (seg.type === "ascenseur") {
      if (a.mode !== "ascenseur") {
        // attend la cabine à son étage
        a.mode = "debout";
        a.anim = "debout";
        a.dir = 1;
        if (asc.cible === null && asc.niveau === seg.de && asc.passagers === 0 && asc.pause <= 0) {
          a.mode = "ascenseur";
          asc.passagers = 1;
          asc.cible = seg.vers;
          asc.reserve = a.id;
        } else if (!asc.file.includes(seg.de)) asc.file.push(seg.de);
      } else {
        a.x = Monde.X_ASCENSEUR;
        a.y = asc.y;
        if (asc.cible === null && asc.niveau === seg.vers) {
          a.niveau = seg.vers;
          a.y = Monde.yNiveau(seg.vers);
          a.mode = "debout";
          asc.passagers = 0;
          asc.pause = 0.5;
          a.segments.shift();
        }
      }
    } else if (seg.type === "passage") {
      a.mode = "passage";
      const cible = Monde.yNiveau(seg.vers);
      const pas = VITESSE * 0.7 * dt;
      a.versFond = cible < a.y;
      if (Math.abs(cible - a.y) <= pas) {
        a.y = cible;
        a.niveau = seg.vers;
        a.segments.shift();
        a.mode = "debout";
      } else a.y += cible > a.y ? pas : -pas;
    }
  }

  function majAscenseur(dt) {
    if (asc.pause > 0) asc.pause -= dt;
    if (asc.cible !== null) {
      const cible = Monde.yNiveau(asc.cible);
      const pas = VITESSE_ASC * dt;
      if (Math.abs(cible - asc.y) <= pas) {
        asc.y = cible;
        asc.niveau = asc.cible;
        asc.cible = null;
        asc.pause = Math.max(asc.pause, 0.35);
      } else asc.y += cible > asc.y ? pas : -pas;
    } else if (asc.pause <= 0 && asc.passagers === 0 && asc.file.length) {
      const n = asc.file.shift();
      if (n !== asc.niveau) asc.cible = n;
    }
  }

  // ------------------------------------------------------------ le chat de l'immeuble
  const chat = { x: 0, y: 0, etat: "absent", fin: 0, dir: 1, prochain: 6, sol: 0 };
  function majChat(dt) {
    if (chat.etat === "absent") {
      if (horloge < chat.prochain) return;
      // tantôt sur le toit du voisin, tantôt sur le trottoir
      const toit = alea() < 0.6;
      chat.dir = alea() < 0.5 ? 1 : -1;
      chat.y = toit ? Monde.yNiveau(4) + 3 - 26 : Monde.Y_RUE + 2;
      chat.x0 = toit ? Monde.X.voisin0 + 8 : -20;
      chat.x1 = toit ? Monde.X.voisin1 - 24 : Monde.L + 20;
      chat.x = chat.dir > 0 ? chat.x0 : chat.x1;
      chat.pause = toit ? chat.x0 + hasard(40, 120) : hasard(150, 550);
      chat.pauseFaite = false;
      chat.etat = "marche";
      return;
    }
    if (chat.etat === "marche") {
      chat.x += chat.dir * 16 * dt;
      if (!chat.pauseFaite && Math.abs(chat.x - chat.pause) < 2) {
        chat.etat = "assis";
        chat.fin = horloge + hasard(5, 10);
        chat.pauseFaite = true;
      }
      if (chat.x < chat.x0 - 2 || chat.x > chat.x1 + 2) {
        chat.etat = "absent";
        chat.prochain = horloge + hasard(18, 50);
      }
    } else if (chat.etat === "assis" && horloge > chat.fin) chat.etat = "marche";
  }

  // ------------------------------------------------------------ boucle
  function maj(dt, t) {
    horloge = t;
    majAscenseur(dt);
    majChat(dt);
    for (const a of liste) {
      if (a.plan.length || a.tache) avancer(a, dt);
      else if (horloge > a.routine) routine(a);
      if (a.bulle && horloge > a.bulle.fin) a.bulle = null;
      // un agent sans plan ni siège retourne s'asseoir
      if (!a.plan.length && !a.tache && a.mode !== "assis" && !a.part && a.poste && a.type !== "visiteur" && a.type !== "livreur") {
        const s = siegeParId(a.poste);
        if (s && siegeLibre(s, a)) allerSasseoir(a, s);
      }
      // bulles d'ambiance des agents au travail : une à la fois dans un même coin, deux au plus dans l'immeuble
      if (!a.bulle && a.mode === "assis" && horloge > prochaineBulle && (a.type === "collegue" || (a.type === "maison" && a.quete))) {
        const voisins = liste.filter((b) => b.bulle && b.niveau === a.niveau && Math.abs(b.x - a.x) < 90).length;
        const total = liste.filter((b) => b.bulle).length;
        if (!voisins && total < 2 && horloge > (a.derniereBulle || 0) + 9) {
          if (a.type === "collegue") dire(a, a.actif ? a.action || "travaille" : "en pause", 3.4);
          else dire(a, "Avec toi sur : " + (a.texteQuete || "ta quête"), 3.6);
          a.derniereBulle = horloge;
          prochaineBulle = horloge + 1.6;
        }
      }
    }
    for (let i = liste.length - 1; i >= 0; i--) if (liste[i].mort) liste.splice(i, 1);
  }

  // Image à dessiner pour un agent : { image, x, y } (coin haut gauche).
  function image(a, t) {
    const cote = a.dir > 0 ? a.jeu.droite : a.jeu.gauche;
    let img;
    const tt = t + a.phase;
    if (a.mode === "marche" || a.mode === "escalier") {
      img = (a.porte ? cote.porte : cote.marche)[Math.floor(tt * 8) % 4];
    } else if (a.mode === "passage") {
      img = a.versFond ? a.jeu.dos.marche[Math.floor(tt * 6) % 2] : a.jeu.face.debout[Math.floor(tt * 6) % 2];
    } else if (a.mode === "ascenseur") {
      img = a.jeu.face.debout[Math.floor(tt * 2) % 4];
    } else if (a.mode === "assis") {
      const s = siegeParId(a.siege);
      if (s && s.pose === "debout") img = a.actif ? cote.parleCote[0] : cote.debout[Math.floor(tt * 1.5) % 2];
      else if (a.actif || a.type === "toi") img = cote.assis[Math.floor(tt * 6) % 2];
      else if (Math.floor(tt / 5) % 3 === 0) img = cote.assisLeve[Math.floor(tt * 0.9) % 2];
      else img = cote.assisCalme[Math.floor(tt * 1.2) % 2];
    } else if (a.anim === "bravo") img = a.jeu.face.bravo[Math.floor(tt * 6) % 2];
    else if (a.anim === "parle") img = a.jeu.face.parle[Math.floor(tt * 5) % 4];
    else if (a.anim === "parleCote") img = cote.parleCote[Math.floor(tt * 5) % 2];
    else if (a.anim === "boit") img = cote.boit[Math.floor(tt * 0.8) % 2];
    else if (a.porte) img = cote.porte[0];
    else img = a.type === "visiteur" || a.type === "livreur" ? cote.debout[Math.floor(tt * 2) % 2] : a.jeu.face.debout[Math.floor(tt * 2) % 4];
    const saut = a.anim === "bravo" && a.mode === "debout" ? -Math.abs(Math.round(Math.sin(tt * 9) * 2)) : 0;
    return { image: img, x: Math.round(a.x) - Personnages.ANCRE.x, y: Math.round(a.y) - Personnages.ANCRE.y + saut };
  }

  function reinitialiser() {
    liste.length = 0;
    colis.length = 0;
    asc.y = Monde.yNiveau(0);
    asc.niveau = 0;
    asc.cible = null;
    asc.file = [];
    asc.passagers = 0;
  }

  racine.Agents = {
    liste,
    asc,
    colis,
    chat,
    synchroniser,
    maj,
    image,
    trouver,
    dire,
    feliciter,
    tousBravo,
    seFeliciter,
    arroser,
    confier,
    visiteurs,
    livraison,
    demenagement,
    siegeParId,
    reinitialiser,
    ecouter(f) {
      surEvenement = f;
    },
  };
})(window);
