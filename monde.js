"use strict";
// Géométrie de l'immeuble en coupe et grille de déplacement des agents.
// Module partagé : chargé par le navigateur et par les tests Node (aucun dessin ici).
(function (racine) {
  const Chemin = typeof module !== "undefined" && module.exports ? require("./chemin.js") : racine.Chemin;

  const L = 720; // largeur du monde
  const YS = 262; // ligne de marche du rez-de-chaussée
  const PAS = 48; // hauteur d'un étage
  const MUR = 33; // hauteur du mur du fond
  const BANDE = 9; // bande de sol visible
  const RUE = -1; // rang du trottoir, devant l'immeuble
  const Y_RUE = YS + 15;
  const CASE = 4; // largeur d'une case de la grille

  // Abscisses de l'immeuble principal.
  const X = {
    murG: 116, // mur extérieur gauche (6 px)
    pieces0: 122, // début des pièces
    pieces1: 362, // fin des pièces, début du palier
    escalier0: 366, // pied et tête de chaque volée
    escalier1: 388, // demi-palier
    ascenseur0: 392,
    ascenseur1: 410,
    murD: 416, // bord extérieur droit
    passage0: 416,
    passage1: 448,
    voisin0: 448, // mur gauche du voisin (5 px)
    cowork0: 453,
    cowork1: 629,
    voisin1: 634,
  };
  const X_ASCENSEUR = 401;
  const X_PASSAGE = 432;

  function yNiveau(n) {
    return n === RUE ? Y_RUE : YS - PAS * n;
  }
  function plafond(n) {
    return yNiveau(n) - 6 - MUR;
  }
  function jonction(n) {
    return yNiveau(n) - 6;
  }

  // Lieux, du haut de l'immeuble au rez-de-chaussée du voisin.
  const ORDRE = ["studio", "coworking", "atelier", "bureaux", "maison-edition"];

  // Plateaux où l'on marche et où l'on pose des objets.
  const ZONES = {
    studio: { lieu: "studio", niveau: 4, x0: 136, x1: 360 },
    atelier: { lieu: "atelier", niveau: 3, x0: 124, x1: 360 },
    "bureaux-haut": { lieu: "bureaux", niveau: 2, x0: 124, x1: 360 },
    "bureaux-bas": { lieu: "bureaux", niveau: 1, x0: 124, x1: 360 },
    maison: { lieu: "maison-edition", niveau: 0, x0: 124, x1: 360 },
    coworking: { lieu: "coworking", niveau: 0, x0: 455, x1: 627 },
  };

  // Pièces. `amelioration` : la pièce reste fermée tant qu'elle n'est pas achetée.
  const PIECES = [
    { id: "studio", zone: "studio", x0: 122, x1: 362, mur: "studio", sol: "parquet" },
    { id: "studio-son", zone: "atelier", x0: 122, x1: 182, mur: "mousse", sol: "moquette-sombre", amelioration: "studio-son", nom: "Salle d'enregistrement" },
    { id: "atelier", zone: "atelier", x0: 182, x1: 362, mur: "atelier", sol: "parquet-fonce" },
    { id: "studio-video", zone: "bureaux-haut", x0: 122, x1: 194, mur: "video", sol: "beton", amelioration: "studio-video", nom: "Studio vidéo" },
    { id: "plateau", zone: "bureaux-haut", x0: 194, x1: 362, mur: "bureaux", sol: "moquette", vitree: true },
    { id: "salle-reunion", zone: "bureaux-bas", x0: 122, x1: 214, mur: "reunion", sol: "moquette", amelioration: "salle-reunion", vitree: true, nom: "Salle de réunion" },
    { id: "cafe", zone: "bureaux-bas", x0: 214, x1: 362, mur: "cafe", sol: "carrelage" },
    { id: "presse", zone: "maison", x0: 122, x1: 190, mur: "presse", sol: "beton", amelioration: "presse", nom: "Presse à imprimer" },
    { id: "salle-lecture", zone: "maison", x0: 190, x1: 246, mur: "lecture", sol: "parquet-fonce", amelioration: "salle-lecture", nom: "Salle de lecture" },
    { id: "librairie", zone: "maison", x0: 246, x1: 362, mur: "librairie", sol: "parquet-fonce" },
    { id: "coworking", zone: "coworking", x0: 453, x1: 629, mur: "brique", sol: "carrelage" },
  ];

  function lieuDeZone(zone) {
    return ZONES[zone] ? ZONES[zone].lieu : null;
  }

  // Le poste du joueur suit le lieu courant. À la maison d'édition, il garde son poste des bureaux.
  function lieuDuPoste(lieuCourant) {
    return lieuCourant === "maison-edition" ? "bureaux" : lieuCourant;
  }

  // ------------------------------------------------------------ grille de déplacement
  // vue : { ouverts: [ids de lieux], achats: { lieu: [ids] } }
  function pieceOuverte(piece, vue) {
    const lieu = ZONES[piece.zone].lieu;
    if (!vue.ouverts.includes(lieu)) return false;
    if (!piece.amelioration) return true;
    return Array.isArray(vue.achats[lieu]) && vue.achats[lieu].includes(piece.amelioration);
  }

  // Renvoie une fonction praticable(niveau, x) pour l'état donné.
  function praticable(vue) {
    const ouvertes = PIECES.filter((p) => pieceOuverte(p, vue));
    const cowork = vue.ouverts.includes("coworking");
    return function (niveau, x) {
      if (x < 0 || x >= L) return false;
      if (niveau === RUE) return true;
      if (niveau < 0 || niveau > 4) return false;
      // cage d'escalier, palier, ascenseur (sauf sous les toits) et passage vers la rue
      if (x >= X.pieces1 && x < X.ascenseur0) return true;
      if (x >= X.ascenseur0 && x < X.ascenseur1) return niveau <= 3;
      if (niveau === 0 && x >= X.ascenseur1 && x < X.voisin0) return true;
      if (niveau === 0 && x >= X.voisin0 && x < X.cowork0) return cowork;
      for (const p of ouvertes) {
        const z = ZONES[p.zone];
        if (z.niveau !== niveau) continue;
        const debut = p.zone === "studio" ? z.x0 : p.x0;
        const fin = p.x1;
        if (x >= debut && x < fin) return true;
      }
      return false;
    };
  }

  const COUT_ESCALIER = 14;
  const COUT_ASCENSEUR = 9;
  const COUT_PAR_ETAGE = 2;
  const COUT_PASSAGE = 4;

  function colonne(x) {
    return Math.floor(x / CASE);
  }
  function centre(col) {
    return col * CASE + CASE / 2;
  }

  // Chemin de (x, niveau) à (x, niveau). Renvoie des segments, ou null.
  // Segments : { type: "marche", niveau, x } | { type: "escalier", de, vers } |
  //            { type: "ascenseur", de, vers } | { type: "passage", de, vers }
  function itineraire(vue, depart, arrivee) {
    const ok = praticable(vue);
    const colEscalier = colonne(X.escalier0);
    const colAscenseur = colonne(X_ASCENSEUR);
    const colPassage = colonne(X_PASSAGE);
    const d = { c: colonne(depart.x), n: depart.niveau };
    const a = { c: colonne(arrivee.x), n: arrivee.niveau };
    if (!ok(d.n, centre(d.c)) || !ok(a.n, centre(a.c))) return null;
    const etapes = Chemin.aEtoile({
      depart: d,
      arrivee: a,
      cle: (p) => p.n * 1000 + p.c,
      heuristique: (p) => Math.abs(p.c - a.c),
      voisins(p) {
        const v = [];
        for (const dc of [-1, 1]) {
          if (ok(p.n, centre(p.c + dc))) v.push({ noeud: { c: p.c + dc, n: p.n }, cout: 1, lien: "marche" });
        }
        if (p.c === colEscalier && p.n >= 0) {
          if (p.n < 4) v.push({ noeud: { c: p.c, n: p.n + 1 }, cout: COUT_ESCALIER, lien: "escalier" });
          if (p.n > 0) v.push({ noeud: { c: p.c, n: p.n - 1 }, cout: COUT_ESCALIER, lien: "escalier" });
        }
        if (p.c === colAscenseur && p.n >= 0 && p.n <= 3) {
          for (let n = 0; n <= 3; n++) {
            if (n !== p.n) v.push({ noeud: { c: p.c, n }, cout: COUT_ASCENSEUR + COUT_PAR_ETAGE * Math.abs(n - p.n), lien: "ascenseur" });
          }
        }
        if (p.c === colPassage && p.n === 0) v.push({ noeud: { c: p.c, n: RUE }, cout: COUT_PASSAGE, lien: "passage" });
        if (p.c === colPassage && p.n === RUE) v.push({ noeud: { c: p.c, n: 0 }, cout: COUT_PASSAGE, lien: "passage" });
        return v;
      },
    });
    if (!etapes) return null;
    // Compression : une marche par tronçon droit, un segment par changement d'étage.
    const segments = [];
    for (let i = 1; i < etapes.length; i++) {
      const avant = etapes[i - 1];
      const ici = etapes[i];
      const lien = ici.lien;
      if (lien === "marche") {
        const dernier = segments[segments.length - 1];
        if (dernier && dernier.type === "marche") dernier.x = centre(ici.noeud.c);
        else segments.push({ type: "marche", niveau: ici.noeud.n, x: centre(ici.noeud.c) });
      } else {
        const dernier = segments[segments.length - 1];
        // deux volées d'escalier de suite restent deux segments : l'agent monte étage par étage
        segments.push({ type: lien, de: avant.noeud.n, vers: ici.noeud.n });
        if (dernier && dernier.type === "marche" && lien !== "marche") {
          dernier.x = lien === "escalier" ? X.escalier0 : lien === "ascenseur" ? X_ASCENSEUR : X_PASSAGE;
        }
      }
    }
    const fin = segments[segments.length - 1];
    if (fin && fin.type === "marche") fin.x = arrivee.x;
    else if (etapes.length > 1 || depart.x !== arrivee.x) segments.push({ type: "marche", niveau: arrivee.niveau, x: arrivee.x });
    return segments;
  }

  // Points d'une volée d'escalier entre deux étages voisins (pour l'animation).
  function pointsEscalier(de, vers) {
    const bas = Math.min(de, vers);
    const y = yNiveau(bas);
    const pts = [
      { x: X.escalier0, y },
      { x: X.escalier1, y: y - PAS / 2 },
      { x: X.escalier0, y: y - PAS },
    ];
    return vers > de ? pts : pts.reverse();
  }

  // ------------------------------------------------------------ rangement
  // Intervalle libre le plus proche pour un objet de largeur l, dans une zone, hors des intervalles pris.
  function placeLibre(zone, l, x, pris) {
    const z = ZONES[zone];
    if (!z) return null;
    const libre = (x0) => x0 >= z.x0 && x0 + l <= z.x1 && !pris.some((p) => x0 < p[1] && x0 + l > p[0]);
    const depart = Math.max(z.x0, Math.min(z.x1 - l, Math.round(x / 2) * 2));
    for (let ecart = 0; ecart <= z.x1 - z.x0; ecart += 2) {
      if (libre(depart - ecart)) return depart - ecart;
      if (libre(depart + ecart)) return depart + ecart;
    }
    return null;
  }

  const Monde = {
    L,
    YS,
    PAS,
    MUR,
    BANDE,
    RUE,
    Y_RUE,
    CASE,
    X,
    X_ASCENSEUR,
    X_PASSAGE,
    ORDRE,
    ZONES,
    PIECES,
    yNiveau,
    plafond,
    jonction,
    lieuDeZone,
    lieuDuPoste,
    pieceOuverte,
    praticable,
    itineraire,
    pointsEscalier,
    placeLibre,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Monde;
  else racine.Monde = Monde;
})(typeof window !== "undefined" ? window : globalThis);
