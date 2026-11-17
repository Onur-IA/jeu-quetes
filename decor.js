"use strict";
// Aménagement de l'immeuble : mobilier fixe de chaque lieu, places par défaut des améliorations,
// sièges, coins café. Construit la « scène » à dessiner à partir de l'état du jeu.
(function (racine) {
  const Monde = racine.Monde;
  const Meubles = racine.Meubles;

  // Mobilier fixe. p : pièce. s : sprite. x : bord gauche. n : niveau.
  // pose : sol (défaut), mur, plafond, plat. role : à qui sert le siège.
  const FIXES = [
    // ---- le studio de la chambre (sous les toits)
    { p: "studio", s: "lit", x: 140, n: 4, role: "libre", detente: true },
    { p: "studio", s: "bureau-toi", x: 220, n: 4, role: "toi" },
    { p: "studio", s: "tabouret", x: 298, n: 4, role: "agent:plume", dir: -1 },
    { p: "studio", s: "coussin", x: 310, n: 4, pose: "plat", role: "libre", dir: -1 },
    { p: "studio", s: "coussin-bleu", x: 326, n: 4, pose: "plat", role: "libre" },
    { p: "studio", s: "coin-the", x: 341, n: 4, cafe: 337 },
    { p: "studio", s: "cadre-soleil", x: 326, n: 4, pose: "mur", my: 8 },
    { p: "studio", s: "suspension", x: 234, n: 4, pose: "plafond" },
    { p: "studio", s: "porte", x: 357, n: 4 },
    { p: "palier4", s: "tabouret", x: 372, n: 4, role: "libre" },
    { p: "palier4", s: "tabouret", x: 382, n: 4, role: "libre", dir: -1 },
    // ---- le poste en coworking (rez-de-chaussée voisin)
    { p: "coworking", s: "bureau-double", x: 512, n: 0, roles: ["agent:boussole", "agent:archive"] },
    { p: "coworking", s: "bureau", x: 556, n: 0, role: "toi" },
    { p: "coworking", s: "comptoir-cafe-petit", x: 607, n: 0, cafe: 602 },
    { p: "coworking", s: "suspension-osier", x: 526, n: 0, pose: "plafond" },
    { p: "coworking", s: "suspension-osier", x: 566, n: 0, pose: "plafond" },
    // ---- l'atelier (troisième étage)
    { p: "atelier", s: "bureau", x: 188, n: 3, role: "agent:croquis" },
    { p: "atelier", s: "bureau-toi", x: 320, n: 3, role: "toi" },
    { p: "atelier", s: "suspension", x: 230, n: 3, pose: "plafond" },
    { p: "atelier", s: "suspension", x: 300, n: 3, pose: "plafond" },
    { p: "atelier", s: "porte", x: 357, n: 3 },
    { p: "studio-son", s: "console-son", x: 126, n: 3, role: "libre" },
    { p: "studio-son", s: "micro-studio", x: 154, n: 3 },
    { p: "studio-son", s: "porte", x: 177, n: 3 },
    // ---- les bureaux, étage du haut
    { p: "plateau", s: "bureau-double", x: 200, n: 2, roles: ["agent:timbre", "agent:relais"] },
    { p: "plateau", s: "bureau-toi", x: 286, n: 2, role: "toi" },
    { p: "plateau", s: "pupitre", x: 330, n: 2, role: "libre" },
    { p: "plateau", s: "suspension", x: 262, n: 2, pose: "plafond" },
    { p: "plateau", s: "suspension", x: 336, n: 2, pose: "plafond" },
    { p: "plateau", s: "porte-vitree", x: 357, n: 2 },
    { p: "studio-video", s: "fond-studio", x: 126, n: 2 },
    { p: "studio-video", s: "tabouret", x: 138, n: 2, role: "libre" },
    { p: "studio-video", s: "projecteur", x: 160, n: 2 },
    { p: "studio-video", s: "camera", x: 176, n: 2, miroir: true },
    { p: "studio-video", s: "porte-vitree", x: 189, n: 2 },
    // ---- les bureaux, étage du bas
    { p: "salle-reunion", s: "table-reunion", x: 140, n: 1, role: "libre" },
    { p: "salle-reunion", s: "ecran-mural", x: 152, n: 1, pose: "mur", my: 2 },
    { p: "salle-reunion", s: "suspension", x: 161, n: 1, pose: "plafond" },
    { p: "salle-reunion", s: "porte-vitree", x: 209, n: 1 },
    { p: "cafe", s: "comptoir-cafe", x: 218, n: 1, cafe: 246 },
    { p: "cafe", s: "bureau-double", x: 296, n: 1, role: "libre" },
    { p: "cafe", s: "plante", x: 342, n: 1, plante: true },
    { p: "cafe", s: "suspension-verte", x: 268, n: 1, pose: "plafond" },
    { p: "cafe", s: "suspension-verte", x: 312, n: 1, pose: "plafond" },
    { p: "cafe", s: "porte-vitree", x: 357, n: 1 },
    // ---- la maison d'édition (rez-de-chaussée)
    { p: "librairie", s: "grande-bibliotheque", x: 248, n: 0, si: "grande-bibliotheque", fond: true },
    { p: "librairie", s: "table-livres", x: 266, n: 0 },
    { p: "librairie", s: "comptoir-librairie", x: 324, n: 0 },
    { p: "librairie", s: "suspension-verte", x: 276, n: 0, pose: "plafond" },
    { p: "librairie", s: "suspension-verte", x: 330, n: 0, pose: "plafond" },
    { p: "librairie", s: "porte", x: 357, n: 0 },
    { p: "salle-lecture", s: "table-lecture", x: 198, n: 0, roles: ["agent:marge", "libre"] },
    { p: "salle-lecture", s: "porte", x: 241, n: 0 },
    { p: "presse", s: "presse-machine", x: 134, n: 0 },
    { p: "presse", s: "cartons", x: 124, n: 0, pose: "plat" },
    { p: "presse", s: "porte", x: 185, n: 0 },
  ];

  // Postes debout (pas de meuble) : agents de la maison d'édition.
  const DEBOUT = [
    { p: "librairie", x: 318, n: 0, dir: 1, role: "agent:reliure" },
    { p: "librairie", x: 300, n: 0, dir: -1, role: "agent:marge", secours: true },
  ];

  // Le poste du joueur : l'affiche de la mission et l'étagère à trophées le suivent de lieu en lieu.
  const POSTES = {
    studio: { mission: 258, trophees: 282, n: 4, zone: "studio" },
    coworking: { mission: 590, trophees: 0, n: 0, zone: "coworking" },
    atelier: { mission: 320, trophees: 284, n: 3, zone: "atelier" },
    bureaux: { mission: 286, trophees: 322, n: 2, zone: "bureaux-haut" },
  };

  // Fenêtres du mur du fond : elles montrent le ciel.
  const FENETRES = [
    { p: "studio", x: 152, n: 4, l: 16, h: 20, my: 5, forme: "lucarne" },
    { p: "studio", x: 202, n: 4, l: 16, h: 20, my: 5, forme: "lucarne" },
    { p: "coworking", x: 484, n: 0, l: 18, h: 25, my: 3, forme: "arche" },
    { p: "coworking", x: 540, n: 0, l: 18, h: 25, my: 3, forme: "arche" },
    { p: "atelier", x: 222, n: 3, l: 16, h: 22, my: 4 },
    { p: "atelier", x: 262, n: 3, l: 16, h: 22, my: 4 },
    { p: "plateau", x: 246, n: 2, l: 16, h: 22, my: 4 },
    { p: "plateau", x: 266, n: 2, l: 16, h: 22, my: 4 },
    { p: "cafe", x: 298, n: 1, l: 16, h: 22, my: 4 },
    { p: "cafe", x: 318, n: 1, l: 16, h: 22, my: 4 },
    { p: "salle-reunion", x: 126, n: 1, l: 12, h: 22, my: 4 },
    { p: "librairie", x: 300, n: 0, l: 20, h: 20, my: 4 },
    { p: "salle-lecture", x: 206, n: 0, l: 16, h: 18, my: 4, forme: "arche" },
  ];

  // Place par défaut de chaque amélioration (zone, x). Tu peux tout déplacer en mode rangement.
  const DEFAUTS = {
    "studio/lampadaire": ["studio", 207],
    "studio/plante": ["studio", 192],
    "studio/tapis": ["studio", 216],
    "studio/etagere": ["studio", 174],
    "studio/micro": ["studio", 259],
    "studio/fauteuil": ["studio", 274],
    "coworking/cabine": ["coworking", 455],
    "coworking/fontaine": ["coworking", 481],
    "coworking/ficus": ["coworking", 494],
    "coworking/objectifs": ["coworking", 514],
    "coworking/velo": ["coworking", 562],
    "coworking/casier": ["coworking", 588],
    "atelier/tableau-blanc": ["atelier", 186],
    "atelier/table-dessin": ["atelier", 222],
    "atelier/horloge": ["atelier", 240],
    "atelier/bibliotheque": ["atelier", 252],
    "atelier/canape": ["atelier", 282],
    "bureaux/neon": ["bureaux-haut", 204],
    "bureaux/jardiniere": ["bureaux-haut", 246],
    "bureaux/banquette": ["bureaux-bas", 256],
    "bureaux/mur-abonnes": ["bureaux-bas", 250],
    "maison-edition/lampe-lecture": ["maison", 250],
    "maison-edition/collection": ["maison", 294],
  };

  const PIECE = {};
  for (const p of Monde.PIECES) PIECE[p.id] = p;
  PIECE.palier4 = { id: "palier4", zone: "studio", x0: 362, x1: 392 };

  function def(nom) {
    return Meubles.CATALOGUE[nom];
  }

  function yDe(pose, n, h, my) {
    if (pose === "mur") return Monde.plafond(n) + (my === undefined ? 6 : my);
    if (pose === "plafond") return Monde.plafond(n);
    if (pose === "plat") return Monde.yNiveau(n) + 1 - h;
    return Monde.yNiveau(n) - 4 - h;
  }

  function poseDe(nom, declaree) {
    const d = def(nom);
    if (declaree) return declaree;
    if (d.plafond) return "plafond";
    if (d.plat) return "plat";
    return d.pose || "sol";
  }

  // vue : { ouverts, prochain, lieuCourant, achats, ameliorations (catalogue par lieu), objets, placements, fleuri (plantes arrosées) }
  function scene(vue) {
    const ouvert = (lieu) => vue.ouverts.includes(lieu);
    const achete = (lieu, id) => Array.isArray(vue.achats[lieu]) && vue.achats[lieu].includes(id);
    const lieuDe = (piece) => Monde.ZONES[PIECE[piece].zone].lieu;
    // état de chaque pièce : ouverte, à acheter (lieu ouvert, pièce fermée), aperçu (lieu suivant), fermée
    const etats = {};
    for (const p of Monde.PIECES) {
      const lieu = lieuDe(p.id);
      if (ouvert(lieu)) etats[p.id] = !p.amelioration || achete(lieu, p.amelioration) ? "ouverte" : "a-acheter";
      else etats[p.id] = lieu === vue.prochain ? "apercu" : "fermee";
    }
    etats.palier4 = "ouverte";
    const visible = (piece) => etats[piece] === "ouverte" || etats[piece] === "apercu";

    const elements = [];
    const sieges = [];
    const cafes = [];
    const pris = {}; // zone -> { sol: [[x0, x1]], mur: [[x0, x1]] }
    for (const z of Object.keys(Monde.ZONES)) pris[z] = { sol: [], mur: [] };
    const occuper = (zone, couche, x0, x1) => {
      if (pris[zone]) pris[zone][couche].push([x0, x1]);
    };
    const lieuPoste = Monde.lieuDuPoste(vue.lieuCourant);
    // on ne pose rien dans une pièce encore fermée
    for (const p of Monde.PIECES) {
      if (etats[p.id] === "ouverte") continue;
      occuper(p.zone, "sol", p.x0, p.x1);
      occuper(p.zone, "mur", p.x0, p.x1);
    }

    function ajouter(e, f) {
      const d = def(e.s);
      const pose = poseDe(e.s, e.pose);
      const el = {
        sprite: e.s,
        x: e.x,
        y: yDe(pose, e.n, d.h, e.my !== undefined ? e.my : d.my),
        l: d.l,
        h: d.h,
        n: e.n,
        pose,
        piece: e.p,
        zone: e.zone || PIECE[e.p].zone,
        cle: e.cle || null,
        frames: d.frames,
        lumiere: d.lumiere || null,
        miroir: e.miroir === true,
        fond: e.fond === true,
        etat: e.etat || "",
        def: d,
        attenue: f === true,
      };
      elements.push(el);
      return el;
    }

    function ajouterSieges(e, el, actif) {
      const d = def(e.s);
      if (!d.sieges) return;
      d.sieges.forEach((s, i) => {
        const role = e.roles ? e.roles[i] : e.role || (e.detente || s.pose === "lit" ? "detente" : null);
        if (!role) return;
        let attribue = role;
        if (role === "toi" && lieuDe(e.p) !== lieuPoste) attribue = "libre"; // ancien poste du joueur : libre pour un collègue
        sieges.push({
          id: e.s + "@" + e.x + ":" + i,
          x: e.x + s.dx,
          niveau: e.n,
          dir: e.dir || s.dir,
          dy: s.dy || 0,
          pose: s.pose || (d.nom.startsWith("bureau") || d.nom === "pupitre" || d.nom === "console-son" || d.nom === "table-dessin" ? "poste" : "assis"),
          lieu: lieuDe(e.p),
          piece: e.p,
          role: attribue,
          detente: e.detente === true || s.pose === "lit",
          actif,
          chaise: d.nom.startsWith("bureau") || d.nom === "pupitre" || d.nom === "console-son" || d.nom === "table-reunion" || d.nom === "table-lecture" || d.nom === "table-dessin",
        });
      });
    }

    // 1. mobilier fixe
    for (const e of FIXES) {
      if (!visible(e.p)) continue;
      const lieu = lieuDe(e.p);
      if (e.si && !achete(lieu, e.si)) continue;
      const apercu = etats[e.p] === "apercu";
      const d = def(e.s);
      const el = ajouter({ ...e, etat: e.plante && vue.fleuri ? "fleuri" : "" }, apercu);
      const pose = el.pose;
      if (pose === "sol") {
        occuper(el.zone, "sol", e.x, e.x + d.l);
        if (d.h >= 24) occuper(el.zone, "mur", e.x, e.x + d.l);
      } else if (pose === "mur") occuper(el.zone, "mur", e.x, e.x + d.l);
      if (!apercu) {
        ajouterSieges(e, el, true);
        if (e.cafe) cafes.push({ x: e.cafe, niveau: e.n, lieu });
      }
    }
    for (const s of DEBOUT) {
      if (etats[s.p] !== "ouverte") continue;
      if (s.secours && etats["salle-lecture"] === "ouverte") continue;
      if (!s.secours || true) sieges.push({ id: "debout@" + s.x, x: s.x, niveau: s.n, dir: s.dir, dy: 0, pose: "debout", lieu: lieuDe(s.p), piece: s.p, role: s.role, detente: false, actif: true, chaise: false });
    }
    // Marge s'assoit à la table de lecture seulement si la salle existe : sinon son poste debout sert.
    if (etats["salle-lecture"] !== "ouverte") {
      for (const s of sieges) if (s.role === "agent:marge" && s.pose !== "debout") s.role = "libre";
    }

    // 2. fenêtres
    const fenetres = FENETRES.filter((f) => visible(f.p)).map((f) => ({ ...f, y: Monde.plafond(f.n) + f.my, apercu: etats[f.p] === "apercu" }));
    for (const f of FENETRES) occuper(PIECE[f.p].zone, "mur", f.x - 1, f.x + f.l + 1);

    // 3. affiche de la mission et étagère à trophées, au poste du joueur
    const poste = POSTES[lieuPoste];
    let mission = null;
    let etagere = null;
    if (poste) {
      mission = ajouter({ s: "mission", x: poste.mission, n: poste.n, p: lieuPoste === "bureaux" ? "plateau" : lieuPoste, pose: "mur" });
      occuper(poste.zone, "mur", poste.mission, poste.mission + 18);
      if (poste.trophees) {
        etagere = ajouter({ s: "etagere-trophees", x: poste.trophees, n: poste.n, p: lieuPoste === "bureaux" ? "plateau" : lieuPoste, pose: "mur" });
        occuper(poste.zone, "mur", poste.trophees, poste.trophees + 36);
      }
    }

    // 4. améliorations (objets) : posées, ou en silhouette si pas encore achetées
    const fantomes = [];
    const rangeables = [];
    const aPlacer = [];
    for (const lieu of Monde.ORDRE) {
      if (!ouvert(lieu)) continue;
      for (const a of (vue.ameliorations && vue.ameliorations[lieu]) || []) {
        if (a.type !== "objet" || !def(a.id)) continue;
        const cle = lieu + "/" + a.id;
        if (achete(lieu, a.id)) aPlacer.push({ cle, id: a.id, nom: a.nom, defaut: DEFAUTS[cle] });
        else if (DEFAUTS[cle]) fantomes.push({ cle, lieu, id: a.id, nom: a.nom, prix: a.prix, zone: DEFAUTS[cle][0], x: DEFAUTS[cle][1] });
      }
    }
    for (const o of vue.objets || []) {
      if (def(o.id)) aPlacer.push({ cle: "deco/" + o.id, id: o.id, nom: o.nom, defaut: null });
    }
    // d'abord les objets que tu as placés toi-même, puis les autres à leur place par défaut
    const explicites = aPlacer.filter((o) => vue.placements[o.cle] && Monde.ZONES[vue.placements[o.cle].zone] && ouvert(Monde.ZONES[vue.placements[o.cle].zone].lieu));
    const autres = aPlacer.filter((o) => !explicites.includes(o));
    function poserObjet(o, zone, x, force) {
      const d = def(o.id);
      const pose = poseDe(o.id);
      const couche = pose === "mur" ? "mur" : "sol";
      const z = Monde.ZONES[zone];
      let xf = x;
      if (pose !== "plat") {
        if (force) xf = Math.max(z.x0, Math.min(z.x1 - d.l, x));
        else {
          const libre = Monde.placeLibre(zone, d.l, x, pris[zone][couche]);
          xf = libre === null ? Math.max(z.x0, Math.min(z.x1 - d.l, x)) : libre;
        }
        occuper(zone, couche, xf, xf + d.l);
        if (pose === "sol" && d.h >= 24) occuper(zone, "mur", xf, xf + d.l);
      }
      const plante = o.id === "plante" || o.id === "ficus" || o.id === "jardiniere";
      const el = ajouter({ s: o.id, x: xf, n: z.niveau, zone, p: null, cle: o.cle, etat: plante && vue.fleuri ? "fleuri" : "" });
      el.zone = zone;
      el.nom = o.nom;
      rangeables.push(el);
      const piece = Monde.PIECES.find((p) => p.zone === zone && xf + d.l / 2 >= p.x0 && xf + d.l / 2 < p.x1);
      el.piece = piece ? piece.id : null;
      if (d.sieges) {
        d.sieges.forEach((s, i) =>
          sieges.push({ id: o.cle + ":" + i, x: xf + s.dx, niveau: z.niveau, dir: s.dir, dy: s.dy || 0, pose: s.pose || "poste", lieu: z.lieu, piece: el.piece, role: s.pose === "lit" ? "detente" : "libre", detente: s.pose === "lit", actif: true, chaise: o.id === "table-dessin" })
        );
      }
      return el;
    }
    for (const o of explicites) poserObjet(o, vue.placements[o.cle].zone, vue.placements[o.cle].x, true);
    const zonePoste = poste ? poste.zone : "studio";
    for (const o of autres) {
      if (o.defaut) poserObjet(o, o.defaut[0], o.defaut[1], false);
      else {
        // objet décoratif sans place : près du poste du joueur, là où il reste de la place
        const z = Monde.ZONES[zonePoste];
        poserObjet(o, zonePoste, Math.round((z.x0 + z.x1) / 2), false);
      }
    }
    const fantomesVisibles = fantomes
      .map((f) => {
        const d = def(f.id);
        const pose = poseDe(f.id);
        const z = Monde.ZONES[f.zone];
        return { ...f, sprite: f.id, n: z.niveau, y: yDe(pose, z.niveau, d.h, d.my), l: d.l, h: d.h, pose };
      })
      .filter((f) => f.pose === "plat" || !pris[f.zone][f.pose === "mur" ? "mur" : "sol"].some((p) => f.x < p[1] && f.x + f.l > p[0]));

    // ordre de dessin : mur, fond, sol (les plus hauts derrière), plat
    const rang = { plafond: 0, mur: 1, sol: 3, plat: 4 };
    elements.sort((a, b) => (a.fond ? 2 : rang[a.pose]) - (b.fond ? 2 : rang[b.pose]) || b.h - a.h || a.x - b.x);

    const toi = sieges.find((s) => s.role === "toi") || sieges[0];
    return { etats, elements, sieges, cafes, fenetres, fantomes: fantomesVisibles, rangeables, pris, mission, etagere, toi, lieuPoste };
  }

  // Le rectangle d'un lieu (pour cadrer la caméra).
  function cadreLieu(lieu) {
    const zones = Object.values(Monde.ZONES).filter((z) => z.lieu === lieu);
    const niveaux = zones.map((z) => z.niveau);
    const haut = Math.max(...niveaux);
    const bas = Math.min(...niveaux);
    const coworking = lieu === "coworking";
    return {
      x0: coworking ? Monde.X.passage0 : Monde.X.murG,
      x1: coworking ? Monde.X.voisin1 : Monde.X.murD,
      y0: Monde.plafond(haut) - (lieu === "studio" ? 26 : 8),
      y1: Monde.yNiveau(bas) + 12,
    };
  }
  function cadreImmeuble() {
    return { x0: Monde.X.murG - 14, x1: Monde.X.voisin1 + 8, y0: Monde.plafond(4) - 30, y1: Monde.Y_RUE + 12 };
  }

  racine.Decor = { FIXES, FENETRES, DEFAUTS, POSTES, PIECE, scene, cadreLieu, cadreImmeuble, yDe, poseDe };
})(window);
