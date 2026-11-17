"use strict";
// Rendu : un seul canevas en basse résolution, agrandi d'un facteur entier, sans flou.
// Ordre : ciel, immeuble, fenêtres, meubles, ascenseur, agents, façades fermées, lumière, étiquettes, effets.
(function (racine) {
  const { Palette, Police, Monde, Meubles, Decor, Immeuble, Ciel, Agents, Personnages } = racine;
  const C = Palette.C;
  const X = Monde.X;
  const Y = Monde.yNiveau;
  const P = Monde.plafond;
  const J = Monde.jonction;

  let canevas = null;
  let ctx = null;
  const couche = document.createElement("canvas");
  const cctx = couche.getContext("2d");
  const ombre = document.createElement("canvas");
  const octx = ombre.getContext("2d");
  let echelle = 3;
  let vl = 480;
  let vh = 270;
  const cam = { x: 100, y: 0, cx: 100, cy: 0 };
  let zoneUtile = { x0: 0, y0: 0, x1: 1440, y1: 810 };
  let scene = null;
  let fond = null;
  let etat = { heure: 12, mois: 11, date: "2026-11-16", meteo: "soleil" };
  let ciel = Ciel.etat(12, 11);
  let infos = { lieux: [], prix: {}, abonnes: 0, trophees: [], enseigne: "", colisAttente: false, etoile: false };
  let rangement = null; // { actif, prise: { cle, x, zone, valide }, survol }
  let survol = null;
  const effets = [];
  let secousse = 0;
  let vehicules = [];
  let veloCargo = false;

  // ------------------------------------------------------------ caméra
  function redimensionner() {
    if (!canevas) return;
    const l = canevas.parentElement.clientWidth;
    const h = canevas.parentElement.clientHeight;
    vl = Math.ceil(l / echelle);
    vh = Math.ceil(h / echelle);
    for (const c of [canevas, couche, ombre]) {
      c.width = vl;
      c.height = vh;
    }
    canevas.style.width = vl * echelle + "px";
    canevas.style.height = vh * echelle + "px";
    ctx.imageSmoothingEnabled = false;
  }

  // Cadre un rectangle du monde dans la zone utile de l'écran, au plus grand facteur entier possible.
  function cadrer(rect, options) {
    const o = options || {};
    const zl = zoneUtile.x1 - zoneUtile.x0;
    const zh = zoneUtile.y1 - zoneUtile.y0;
    const e = Math.max(o.min || 1, Math.min(o.max || 6, Math.floor(zl / (rect.x1 - rect.x0)), Math.floor(zh / (rect.y1 - rect.y0))));
    if (e !== echelle) {
      echelle = e;
      redimensionner();
    }
    cam.cx = (rect.x0 + rect.x1) / 2 - (zoneUtile.x0 + zl / 2) / echelle;
    cam.cy = (rect.y0 + rect.y1) / 2 - (zoneUtile.y0 + zh / 2) / echelle;
    // trop large pour la zone : on cale le bord gauche, le reste se découvre en glissant la vue
    if ((rect.x1 - rect.x0) * echelle > zl) cam.cx = rect.x0 - (zoneUtile.x0 + 8) / echelle;
    if ((rect.y1 - rect.y0) * echelle > zh) cam.cy = rect.y1 - (zoneUtile.y1 - 4) / echelle;
    // jamais de vide sous la chaussée : la rue reste en bas de l'écran
    cam.cy = Math.min(cam.cy, Monde.YS + 48 - vh);
    if (o.direct) {
      cam.x = cam.cx;
      cam.y = cam.cy;
    }
  }

  function zoomer(delta, px, py) {
    const e = Math.max(1, Math.min(8, echelle + delta));
    if (e === echelle) return;
    // garde sous le curseur le même point du monde
    const mx = cam.x + px / echelle;
    const my = cam.y + py / echelle;
    echelle = e;
    redimensionner();
    cam.x = cam.cx = mx - px / echelle;
    cam.y = cam.cy = my - py / echelle;
    borner();
  }

  function deplacer(dx, dy) {
    cam.cx = cam.x = cam.x - dx / echelle;
    cam.cy = cam.y = cam.y - dy / echelle;
    borner();
  }

  function borner() {
    const m = Immeuble.MARGE;
    cam.cx = Math.max(-m, Math.min(Monde.L + m - vl, cam.cx));
    cam.cy = Math.max(-Immeuble.HAUT - 200, Math.min(Monde.YS + 52 - vh, cam.cy));
    if (vl > Monde.L + 2 * m) cam.cx = (Monde.L - vl) / 2;
    cam.x = cam.cx;
    cam.y = cam.cy;
  }

  // Coordonnées du monde pour un point de l'écran (pixels CSS dans le canevas).
  function versMonde(px, py) {
    return { x: cam.x + px / echelle, y: cam.y + py / echelle };
  }
  function versEcran(x, y) {
    return { x: (x - Math.round(cam.x)) * echelle, y: (y - Math.round(cam.y)) * echelle };
  }

  // ------------------------------------------------------------ fenêtres du mur du fond
  function fenetre(g, f, t) {
    const b = ciel.bandes;
    const haut = Ciel.css(b[1]);
    const bas = Ciel.css(b[3]);
    const x = f.x;
    const y = f.y;
    g.fillStyle = C[f.apercu ? "2" : "5"];
    g.fillRect(x - 1, y - 1, f.l + 2, f.h + 2);
    g.fillStyle = haut;
    g.fillRect(x, y, f.l, Math.floor(f.h / 2));
    g.fillStyle = bas;
    g.fillRect(x, y + Math.floor(f.h / 2), f.l, Math.ceil(f.h / 2));
    // toits au loin, vus par la fenêtre
    g.fillStyle = Ciel.css(Ciel.melange(b[2], [50, 60, 95], 0.45 + ciel.nuit * 0.3));
    const alea = Palette.hasard(f.x * 7 + f.n);
    for (let i = 0; i < f.l; i += 4) {
      const hh = 3 + Math.floor(alea() * 4);
      g.fillRect(x + i, y + f.h - hh, 4, hh);
    }
    if (ciel.nuit > 0.4) {
      g.fillStyle = Palette.alpha("u", 0.8);
      for (let i = 1; i < f.l; i += 5) if (alea() < 0.5) g.fillRect(x + i, y + f.h - 2, 1, 1);
      g.fillStyle = "rgba(253,251,247,0.8)";
      g.fillRect(x + 3 + Math.floor(alea() * (f.l - 6)), y + 2 + Math.floor(alea() * 5), 1, 1);
    }
    // reflet et croisillons
    g.fillStyle = "rgba(253,251,247,0.28)";
    for (let i = 0; i < 5; i++) g.fillRect(x + 2 + i, y + 6 - i, 2, 1);
    g.fillStyle = C[f.apercu ? "2" : "6"];
    g.fillRect(x + Math.floor(f.l / 2) - 1, y, 2, f.h);
    g.fillRect(x, y + Math.floor(f.h * 0.45), f.l, 1);
    if (f.forme === "arche") {
      g.fillStyle = C.b;
      g.fillRect(x - 1, y - 1, 3, 3);
      g.fillRect(x + f.l - 2, y - 1, 3, 3);
      g.fillRect(x - 1, y - 1, 5, 1);
      g.fillRect(x + f.l - 4, y - 1, 5, 1);
      g.fillStyle = C.a;
      g.fillRect(x - 1, y + f.h, f.l + 2, 2);
    } else if (f.forme === "lucarne") {
      g.fillStyle = C["4"];
      g.fillRect(x - 2, y - 2, f.l + 4, 2);
      g.fillStyle = C["3"];
      g.fillRect(x - 2, y + f.h + 1, f.l + 4, 2);
    } else {
      g.fillStyle = C["3"];
      g.fillRect(x - 2, y + f.h + 1, f.l + 4, 2);
      // rideaux
      g.fillStyle = C.d;
      g.fillRect(x, y, 2, f.h);
      g.fillRect(x + f.l - 2, y, 2, f.h);
    }
    // rayon de lumière et poussière qui danse, en journée
    if (ciel.nuit < 0.2 && ciel.jour && !f.apercu && etat.meteo !== "pluie") {
      const base = J(f.n) + 6;
      g.fillStyle = "rgba(251,231,161,0.13)";
      for (let i = 0; i < base - (y + f.h); i++) g.fillRect(x + 2 + Math.floor(i * 0.5), y + f.h + i, f.l - 1, 1);
      g.fillStyle = "rgba(253,251,247,0.75)";
      for (let k = 0; k < 4; k++) {
        const ph = k * 1.7 + f.x;
        const px = x + 4 + ((k * 5 + Math.sin(t * 0.5 + ph) * 3 + 20) % (f.l + 6));
        const py = y + f.h + 2 + ((t * (2 + k * 0.6) + k * 7) % Math.max(4, base - y - f.h - 4));
        g.fillRect(Math.round(px), Math.round(py), 1, 1);
      }
    }
  }

  // ------------------------------------------------------------ détails vivants de certains meubles
  function details(g, el, t) {
    if (el.def.horloge) {
      const cx = el.x + 5;
      const cy = el.y + 5;
      const h = ((etat.heure % 12) / 12) * Math.PI * 2 - Math.PI / 2;
      const m = (etat.heure % 1) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle = C["0"];
      for (let i = 0; i < 3; i++) g.fillRect(Math.round(cx + Math.cos(h) * i), Math.round(cy + Math.sin(h) * i), 1, 1);
      g.fillStyle = C.c;
      for (let i = 0; i < 4; i++) g.fillRect(Math.round(cx + Math.cos(m) * i), Math.round(cy + Math.sin(m) * i), 1, 1);
    } else if (el.def.abonnes) {
      // un carré par lecteur passé te voir
      const n = Math.min(infos.abonnes, 13 * 5);
      const tons = ["c", "d", "t", "p", "k", "v", "x", "q"];
      for (let i = 0; i < 13 * 5; i++) {
        g.fillStyle = i < n ? C[tons[(i * 7) % tons.length]] : C["4"];
        g.fillRect(el.x + 3 + (i % 13) * 3, el.y + 7 + Math.floor(i / 13) * 3, 2, 2);
      }
    } else if (el.sprite === "etagere-trophees") {
      const tr = infos.trophees.slice(-10);
      tr.forEach((tro, i) => Meubles.trophee(g, tro.source, el.x + 2 + (i % 5) * 7, el.y + (i < 5 ? 3 : 14)));
    } else if (el.def.note && Math.floor(t * 1.5 + el.x) % 4 === 0) {
      // une note de musique s'échappe
      const k = (t * 1.5 + el.x) % 1;
      g.fillStyle = C["0"];
      g.fillRect(el.x + 6 + Math.round(k * 4), el.y - 3 - Math.round(k * 6), 1, 3);
      g.fillRect(el.x + 5 + Math.round(k * 4), el.y - 1 - Math.round(k * 6), 2, 1);
    }
  }

  function dessinerSprite(g, s, x, y, miroir) {
    if (!miroir) return g.drawImage(s, x, y);
    g.save();
    g.translate(x + s.width, y);
    g.scale(-1, 1);
    g.drawImage(s, 0, 0);
    g.restore();
  }

  // ------------------------------------------------------------ ascenseur
  function ascenseur(g) {
    const a = Agents.asc;
    const y = Math.round(a.y);
    const x = X.ascenseur0 + 1;
    g.fillStyle = C["0"];
    g.fillRect(x + 7, P(3) - 2, 1, y - 38 - P(3) + 2); // câble
    g.fillStyle = C["1"];
    g.fillRect(x, y - 38, 16, 3);
    g.fillRect(x, y + 1, 16, 2);
    g.fillStyle = ciel.nuit > 0.3 ? C.u : C["5"];
    g.fillRect(x + 1, y - 35, 14, 36);
    g.fillStyle = C["4"];
    g.fillRect(x + 1, y - 12, 14, 13);
    g.fillStyle = C.h;
    g.fillRect(x + 1, y - 13, 14, 1);
    g.fillStyle = C.t;
    g.fillRect(x + 7, y - 34, 2, 1);
  }
  function grilleAscenseur(g) {
    const a = Agents.asc;
    const y = Math.round(a.y);
    const x = X.ascenseur0 + 1;
    g.fillStyle = "rgba(43,43,43,0.55)";
    for (let i = 0; i < 16; i += 3) g.fillRect(x + i, y - 35, 1, 36);
    g.fillRect(x, y - 24, 16, 1);
  }

  // ------------------------------------------------------------ étiquettes et bulles
  function pastille(g, texte, cx, y, fondC, texteC) {
    const img = Police.image(texte, texteC);
    const l = img.width + 2;
    const x = Math.round(cx - l / 2);
    g.fillStyle = fondC;
    g.fillRect(x, y, l, 9);
    g.fillRect(x - 1, y + 1, l + 2, 7);
    g.drawImage(img, x + 1, y - 2);
    return { x: x - 1, y, l: l + 2, h: 9 };
  }

  const bullesPosees = [];
  function bulle(g, texte, cx, bas, entete) {
    const lignes = Police.couper(texte, 88).slice(0, 3);
    if (entete) lignes.unshift(Police.abreger(entete, 96));
    const l = Math.max(...lignes.map((s) => Police.largeur(s))) + 8;
    const h = lignes.length * 9 + 5;
    let x = Math.round(cx - l / 2);
    let y = bas - h - 4;
    x = Math.max(Math.round(cam.x) + 2, Math.min(Math.round(cam.x) + vl - l - 2, x));
    // évite les bulles déjà posées
    for (let essai = 0; essai < 4; essai++) {
      const gene = bullesPosees.find((b) => x < b.x + b.l + 1 && x + l + 1 > b.x && y < b.y + b.h + 1 && y + h + 5 > b.y);
      if (!gene) break;
      y = gene.y - h - 6;
    }
    bullesPosees.push({ x, y, l, h: h + 4 });
    g.fillStyle = C["0"];
    g.fillRect(x + 1, y - 1, l - 2, h + 2);
    g.fillRect(x - 1, y + 1, l + 2, h - 2);
    g.fillRect(x, y, l, h);
    g.fillStyle = C["6"];
    g.fillRect(x + 1, y, l - 2, h);
    g.fillRect(x, y + 1, l, h - 2);
    // la pointe
    const qx = Math.max(x + 4, Math.min(x + l - 6, Math.round(cx) - 1));
    g.fillStyle = C["0"];
    g.fillRect(qx - 1, y + h, 5, 1);
    g.fillRect(qx, y + h + 1, 3, 1);
    g.fillRect(qx + 1, y + h + 2, 1, 1);
    g.fillStyle = C["6"];
    g.fillRect(qx, y + h - 1, 3, 2);
    g.fillRect(qx + 1, y + h + 1, 1, 1);
    lignes.forEach((s, i) => Police.dessiner(g, s, x + 4, y + i * 9, entete && i === 0 ? C.b : C["0"]));
  }

  // Plaque d'un lieu fermé : cadenas, nom, cap à passer.
  function plaque(g, lieu, t) {
    const zones = Object.values(Monde.ZONES).filter((z) => z.lieu === lieu.id);
    if (!zones.length) return;
    const haut = Math.max(...zones.map((z) => z.niveau));
    const bas = Math.min(...zones.map((z) => z.niveau));
    const cowork = lieu.id === "coworking";
    const cx = cowork ? (X.cowork0 + X.cowork1) / 2 : (X.pieces0 + X.pieces1) / 2;
    const cy = (P(haut) + Y(bas) + 3) / 2;
    const lignes = [lieu.nom, ...Police.couper(lieu.cap ? lieu.cap.libelle : "", cowork ? 150 : 200)];
    const l = Math.max(...lignes.map((s) => Police.largeur(s))) + 26;
    const h = lignes.length * 10 + 6;
    const x = Math.round(cx - l / 2);
    const y = Math.round(cy - h / 2);
    const prochain = lieu.prochain;
    g.fillStyle = C[prochain ? "t" : "2"];
    g.fillRect(x - 1, y - 1, l + 2, h + 2);
    g.fillStyle = C.n;
    g.fillRect(x, y, l, h);
    g.fillStyle = C.o;
    g.fillRect(x + 1, y + 1, l - 2, 1);
    g.drawImage(Meubles.sprite("icone-cadenas"), x + 4, y + Math.round(h / 2) - 6);
    lignes.forEach((s, i) => Police.dessiner(g, s, x + 20, y + 2 + i * 10, i === 0 ? C[prochain ? "u" : "5"] : C[prochain ? "6" : "3"]));
    if (lieu.cap && lieu.cap.suggere && Math.floor(t * 2) % 2 === 0) {
      g.fillStyle = C.t;
      g.fillRect(x - 3, y - 3, l + 6, 1);
      g.fillRect(x - 3, y + h + 2, l + 6, 1);
      g.fillRect(x - 3, y - 3, 1, h + 6);
      g.fillRect(x + l + 2, y - 3, 1, h + 6);
    }
    lieu.zoneClic = { x, y, l, h };
  }

  // Étiquette de prix sur une pièce à acheter.
  function prixPiece(g, piece) {
    const n = Monde.ZONES[piece.zone].niveau;
    const cx = Math.round((piece.x0 + piece.x1) / 2);
    const cy = P(n) + 18;
    g.drawImage(Meubles.sprite("icone-cadenas"), cx - 6, cy - 12);
    const prix = infos.prix[piece.id];
    // un prix en points, ou l'avancement d'un cap d'effort (« 7 sur 10 »)
    if (prix) pastille(g, typeof prix === "number" ? prix + " pts" : prix, cx, cy + 2, C.n, C.u);
  }

  // ------------------------------------------------------------ effets (pièces, confettis, textes)
  function ajouterEffet(e) {
    effets.push({ age: 0, ...e });
  }
  // Pièces qui sautent d'un point du monde vers une cible à l'écran (compteur de points).
  function pieces(x, y, n, cible) {
    for (let i = 0; i < n; i++) {
      ajouterEffet({ type: "piece", x, y: y - 14, vx: (Math.random() - 0.5) * 60, vy: -70 - Math.random() * 50, duree: 1.1 + i * 0.05, retard: i * 0.04, cible });
    }
  }
  function confettis(x, y, n) {
    const tons = ["c", "t", "s", "v", "k", "6", "x", "q", "d"];
    for (let i = 0; i < n; i++) {
      ajouterEffet({ type: "confetti", x: x + (Math.random() - 0.5) * 30, y: y - 20, vx: (Math.random() - 0.5) * 90, vy: -60 - Math.random() * 80, duree: 2 + Math.random(), c: tons[i % tons.length], k: Math.random() * 6 });
    }
  }
  function texteFlottant(x, y, texte, couleur) {
    ajouterEffet({ type: "texte", x, y, texte, c: couleur || "t", duree: 1.6 });
  }
  function etincelles(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      ajouterEffet({ type: "etincelle", x, y, vx: Math.cos(a) * (20 + Math.random() * 30), vy: Math.sin(a) * (20 + Math.random() * 30), duree: 0.7 + Math.random() * 0.4 });
    }
  }
  function feu(x, y) {
    // feu d'artifice : une gerbe de couleurs
    const tons = ["t", "c", "s", "v", "u"];
    const c = tons[Math.floor(Math.random() * tons.length)];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const v = 30 + Math.random() * 25;
      ajouterEffet({ type: "feu", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, duree: 1.1 + Math.random() * 0.4, c });
    }
  }
  // Arrosage : des gouttes tombent sur la plante, puis de petites étincelles.
  function gouttes(x, y) {
    for (let i = 0; i < 14; i++) ajouterEffet({ type: "goutte", x: x - 6 + Math.random() * 12, y: y - 12 - Math.random() * 8, vy: 26 + Math.random() * 18, duree: 0.7 + Math.random() * 0.4, retard: 0.9 + i * 0.09 });
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * Math.random();
      ajouterEffet({ type: "etincelle", x, y: y + 6, vx: Math.cos(a) * 16, vy: Math.sin(a) * 22, duree: 0.8, retard: 2 + Math.random() * 0.5, c: "l" });
    }
  }
  function poussiere(x0, x1, y0, y1) {
    for (let i = 0; i < 60; i++) ajouterEffet({ type: "poussiere", x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0), vx: (Math.random() - 0.5) * 20, vy: -8 - Math.random() * 14, duree: 1.2 + Math.random(), retard: Math.random() * 0.8 });
  }

  function dessinerEffets(g, dt) {
    for (let i = effets.length - 1; i >= 0; i--) {
      const e = effets[i];
      if (e.retard > 0) {
        e.retard -= dt;
        continue;
      }
      e.age += dt;
      const k = e.age / e.duree;
      if (k >= 1) {
        effets.splice(i, 1);
        if (e.fin) e.fin();
        continue;
      }
      if (e.type === "piece") {
        let px;
        let py;
        if (k < 0.45 || !e.cible) {
          e.vy += 260 * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          px = e.x;
          py = e.y;
        } else {
          // la pièce file vers le compteur
          const c = versMonde(e.cible.x, e.cible.y);
          const q = (k - 0.45) / 0.55;
          const qq = q * q;
          px = e.x + (c.x - e.x) * qq;
          py = e.y + (c.y - e.y) * qq;
        }
        const large = Math.floor(e.age * 12) % 2 === 0;
        g.fillStyle = C.x;
        g.fillRect(Math.round(px) - (large ? 2 : 1), Math.round(py) - 2, large ? 5 : 3, 5);
        g.fillStyle = C.t;
        g.fillRect(Math.round(px) - (large ? 1 : 0), Math.round(py) - 2, large ? 3 : 1, 4);
        g.fillStyle = C.u;
        g.fillRect(Math.round(px) - (large ? 1 : 0), Math.round(py) - 1, 1, 2);
      } else if (e.type === "confetti") {
        e.vy += 120 * dt;
        e.vx *= 0.985;
        e.x += e.vx * dt + Math.sin(e.age * 8 + e.k) * 0.3;
        e.y += Math.min(e.vy, 46) * dt;
        g.fillStyle = C[e.c];
        const w = Math.floor(e.age * 10 + e.k) % 2 ? 2 : 1;
        g.fillRect(Math.round(e.x), Math.round(e.y), w, 3 - w);
      } else if (e.type === "texte") {
        const img = Police.image(e.texte, C[e.c], C["0"]);
        g.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
        g.drawImage(img, Math.round(e.x - img.width / 2), Math.round(e.y - 24 - k * 16));
        g.globalAlpha = 1;
      } else if (e.type === "etincelle" || e.type === "feu") {
        e.vy += (e.type === "feu" ? 22 : 40) * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        g.fillStyle = k < 0.5 ? C[e.c || "u"] : C[e.type === "feu" ? e.c : "t"];
        g.globalAlpha = 1 - k * k;
        g.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
        if (k < 0.3) g.fillRect(Math.round(e.x) - 1, Math.round(e.y), 3, 1);
        g.globalAlpha = 1;
      } else if (e.type === "goutte") {
        e.y += e.vy * dt;
        g.fillStyle = C.q;
        g.fillRect(Math.round(e.x), Math.round(e.y), 1, 2);
        g.fillStyle = C.r;
        g.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
      } else if (e.type === "poussiere") {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        g.fillStyle = "rgba(230,220,203," + (0.8 * (1 - k)).toFixed(2) + ")";
        g.fillRect(Math.round(e.x), Math.round(e.y), 2, 2);
      }
    }
  }

  // ------------------------------------------------------------ lumière de nuit
  function halo(g, x, y, r, couleur) {
    const d = g.createRadialGradient(x, y, 0, x, y, r);
    d.addColorStop(0, couleur);
    d.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = d;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function lumiere(t) {
    const ox = -Math.round(cam.x);
    const oy = -Math.round(cam.y);
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.globalCompositeOperation = "source-over";
    octx.clearRect(0, 0, vl, vh);
    const v = ciel.voile;
    octx.fillStyle = "rgba(" + Math.round(v[0]) + "," + Math.round(v[1]) + "," + Math.round(v[2]) + "," + ciel.opacite.toFixed(3) + ")";
    octx.fillRect(0, 0, vl, vh);
    if (ciel.nuit > 0.05) {
      octx.globalCompositeOperation = "destination-out";
      octx.translate(ox, oy);
      const f = ciel.nuit;
      // les pièces ouvertes sont éclairées
      for (const p of Monde.PIECES) {
        if (scene.etats[p.id] !== "ouverte") continue;
        const n = Monde.ZONES[p.zone].niveau;
        octx.fillStyle = "rgba(0,0,0," + (0.62 * f).toFixed(2) + ")";
        octx.fillRect(p.x0, P(n), p.x1 - p.x0, 45);
      }
      for (let n = 0; n <= 4; n++) {
        octx.fillStyle = "rgba(0,0,0," + (0.42 * f).toFixed(2) + ")";
        octx.fillRect(X.pieces1, P(n), (n === 4 ? X.ascenseur1 : X.ascenseur0) - X.pieces1, 45);
      }
      for (const el of scene.elements) {
        if (!el.lumiere || el.attenue) continue;
        const [dx, dy, r] = el.lumiere;
        halo(octx, el.x + (el.miroir ? el.l - dx : dx), el.y + dy, r * 1.25, "rgba(0,0,0," + (0.85 * f).toFixed(2) + ")");
      }
      halo(octx, 102, Monde.Y_RUE - 36, 40, "rgba(0,0,0," + (0.9 * f).toFixed(2) + ")"); // réverbère
      halo(octx, Monde.X_PASSAGE, J(0) - 40, 26, "rgba(0,0,0," + (0.85 * f).toFixed(2) + ")"); // lanterne du passage
      const cab = Agents.asc;
      halo(octx, Monde.X_ASCENSEUR, cab.y - 18, 22, "rgba(0,0,0," + (0.7 * f).toFixed(2) + ")");
      // fenêtres allumées des voisins
      for (const w of fond.fenetresFacade) {
        if (!allumee(w)) continue;
        octx.fillStyle = "rgba(0,0,0,1)";
        octx.fillRect(w.x, w.y, w.l, w.h);
        halo(octx, w.x + w.l / 2, w.y + w.h / 2, w.l + 6, "rgba(0,0,0," + (0.35 * f).toFixed(2) + ")");
      }
      if (infos.enseigneAllumee) halo(octx, (X.murG + X.murD) / 2, P(4) - 24, 70, "rgba(0,0,0," + (0.8 * f).toFixed(2) + ")");
      octx.setTransform(1, 0, 0, 1, 0, 0);
    }
    cctx.setTransform(1, 0, 0, 1, 0, 0); // le masque est en coordonnées d'écran
    cctx.globalCompositeOperation = "source-atop";
    cctx.drawImage(ombre, 0, 0);
    cctx.globalCompositeOperation = "source-over";
  }

  function allumee(w) {
    if (ciel.nuit < 0.3) return false;
    // les gens se couchent : moins de fenêtres après minuit
    const tard = etat.heure < 6 ? 0.18 : etat.heure > 23 ? 0.35 : 0.62;
    return w.k < (w.cafe ? (etat.heure > 6 && etat.heure < 23.5 ? 1 : 0) : tard);
  }

  // Ce qui brille : vitres allumées, halos chauds.
  function emissifs(g, t) {
    const f = ciel.nuit;
    if (f < 0.05) return;
    for (const w of fond.fenetresFacade) {
      if (!allumee(w)) continue;
      g.fillStyle = C[w.k * 100 % 3 < 1 ? "t" : "u"];
      g.fillRect(w.x, w.y, w.l, w.h);
      g.fillStyle = C.x;
      if (w.cafe) {
        g.fillStyle = C.t;
        g.fillRect(w.x, w.y, w.l, w.h);
        g.fillStyle = C.a;
        for (let i = 4; i < w.l - 4; i += 9) g.fillRect(w.x + i, w.y + w.h - 12, 4, 12);
      } else {
        if (w.rideau) g.fillRect(w.x, w.y, 3, w.h);
        g.fillStyle = C["5"];
        g.fillRect(w.x + Math.floor(w.l / 2) - 1, w.y, 2, w.h);
        g.fillRect(w.x, w.y + Math.floor(w.h / 3), w.l, 1);
      }
    }
    g.globalCompositeOperation = "lighter";
    // les pièces éclairées prennent une teinte chaude
    g.fillStyle = Palette.alpha("t", 0.05 * f);
    for (const p of Monde.PIECES) {
      if (scene.etats[p.id] === "ouverte") g.fillRect(p.x0, P(Monde.ZONES[p.zone].niveau), p.x1 - p.x0, 45);
    }
    for (const el of scene.elements) {
      if (!el.lumiere || el.attenue) continue;
      const [dx, dy, r, c] = el.lumiere;
      halo(g, el.x + (el.miroir ? el.l - dx : dx), el.y + dy, r, Palette.alpha(c, 0.22 * f));
    }
    halo(g, 102, Monde.Y_RUE - 36, 34, Palette.alpha("u", 0.3 * f));
    halo(g, Monde.X_PASSAGE, J(0) - 40, 20, Palette.alpha("t", 0.3 * f));
    g.globalCompositeOperation = "source-over";
  }

  // ------------------------------------------------------------ le grand dessin
  function fumee(g, x, y, t, k0) {
    for (let k = 0; k < 5; k++) {
      const age = (t * 0.22 + k / 5 + k0) % 1;
      const px = x + Math.sin(age * 5 + k) * 3 + age * 10;
      const py = y - age * 26;
      g.fillStyle = "rgba(243,237,226," + (0.5 * (1 - age)).toFixed(2) + ")";
      const r = 1 + Math.floor(age * 3);
      g.fillRect(Math.round(px) - r, Math.round(py) - r, r * 2, r * 2 - 1);
    }
  }

  function enseigneToit(g, t) {
    if (!infos.enseigne) return;
    const texte = infos.enseigne.toUpperCase();
    const l = Police.largeur(texte);
    const cx = Math.round((X.murG + X.murD) / 2);
    const y = P(4) - 31;
    g.fillStyle = C["0"];
    g.fillRect(cx - l / 2 - 6, y + 13, 1, 6);
    g.fillRect(cx + l / 2 + 5, y + 13, 1, 6);
    g.fillRect(cx - 20, y + 13, 1, 5);
    g.fillRect(cx + 20, y + 13, 1, 5);
    g.fillRect(cx - l / 2 - 8, y + 12, l + 16, 1);
    g.fillStyle = C.n;
    g.fillRect(cx - l / 2 - 5, y - 1, l + 10, 13);
    g.fillStyle = C.b;
    g.fillRect(cx - l / 2 - 5, y - 1, l + 10, 1);
    g.fillRect(cx - l / 2 - 5, y + 11, l + 10, 1);
    const clignote = infos.enseigneAllumee && Math.floor(t * 0.7) % 9 === 4 && Math.floor(t * 9) % 2 === 0;
    Police.dessiner(g, texte, Math.round(cx - l / 2), y - 1, infos.enseigneAllumee && !clignote ? C.u : C.d);
  }

  // Un fanion par semaine bouclée, sur le faîte du toit. Ils flottent au vent.
  function fanionsToit(g, t) {
    const n = Math.min(infos.fanions || 0, 14);
    if (!n) return;
    const tons = ["c", "t", "k", "p", "v", "x", "s"];
    const x0 = X.murG + 132;
    const y = P(4) - 20;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 9;
      g.fillStyle = C["0"];
      g.fillRect(x, y - 9, 1, 9);
      const vent = Math.floor(t * 3 + i * 1.7) % 3;
      g.fillStyle = C[tons[i % tons.length]];
      g.fillRect(x + 1, y - 9, 4, 1);
      g.fillRect(x + 1, y - 8 + (vent === 1 ? 1 : 0), vent === 2 ? 5 : 4, 1);
      g.fillRect(x + 1, y - 7 + (vent === 1 ? 1 : 0), vent === 0 ? 3 : 2, 1);
    }
  }

  function dessiner(t, dt) {
    if (!ctx || !scene || !fond) return;
    cam.x += (cam.cx - cam.x) * Math.min(1, dt * 6);
    cam.y += (cam.cy - cam.y) * Math.min(1, dt * 6);
    if (Math.abs(cam.cx - cam.x) < 0.3) cam.x = cam.cx;
    if (Math.abs(cam.cy - cam.y) < 0.3) cam.y = cam.cy;
    const sx = secousse > 0 ? Math.round((Math.random() - 0.5) * secousse * 4) : 0;
    secousse = Math.max(0, secousse - dt * 2);
    const ox = -Math.round(cam.x) + sx;
    const oy = -Math.round(cam.y);
    bullesPosees.length = 0;

    // 1. ciel, nuages, toits de Paris
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    Ciel.dessiner(ctx, vl, vh, ciel, t, cam, Monde.YS + 4, etat.meteo);
    if (etat.meteo === "pluie") Ciel.pluie(ctx, vl, vh, t, 1);

    // 2. le monde, dans sa couche
    const g = cctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, vl, vh);
    g.translate(ox, oy);
    g.fillStyle = C["1"]; // la chaussée continue jusqu'au bas de l'écran
    g.fillRect(-ox, Monde.YS + 40, vl, vh);
    g.drawImage(fond.arriere, -fond.marge, -fond.haut);
    fumee(g, X.murG + 40, P(4) - 28, t, 0);
    if (ciel.nuit > 0.2 || etat.mois >= 10 || etat.mois <= 3) fumee(g, X.voisin0 + 30, Y(4) - 44, t, 0.4);
    enseigneToit(g, t);
    fanionsToit(g, t);
    for (const f of scene.fenetres) fenetre(g, f, t);

    // meubles
    for (const el of scene.elements) {
      if (rangement && rangement.prise && rangement.prise.cle === el.cle) continue;
      const img = Meubles.sprite(el.sprite, { f: el.frames > 1 ? Math.floor(t * (el.sprite.startsWith("presse") ? 5 : 2.2) + el.x) : 0, etat: el.etat });
      if (el.attenue) g.globalAlpha = 0.75;
      if (el.pose === "sol") {
        g.fillStyle = "rgba(43,43,43,0.16)";
        g.fillRect(el.x + 1, Y(el.n) - 4, el.l - 1, 1);
        g.fillRect(el.x + 2, Y(el.n) - 3, el.l - 2, 1);
      }
      dessinerSprite(g, img, el.x, el.y, el.miroir);
      g.globalAlpha = 1;
      details(g, el, t);
    }
    // silhouettes des améliorations pas encore achetées
    for (const f of scene.fantomes) {
      const img = Meubles.silhouette(f.sprite, "rgba(43,43,43,1)");
      const vif = survol && survol.type === "fantome" && survol.cle === f.cle;
      g.globalAlpha = vif ? 0.55 : 0.2 + 0.06 * Math.sin(t * 2 + f.x);
      g.drawImage(img, f.x, f.y);
      g.globalAlpha = 1;
    }
    // réverbère, banc, pigeons sur le toit
    g.drawImage(Meubles.sprite("banc"), 24, Monde.Y_RUE - 13);
    g.drawImage(Meubles.sprite("reverbere", { etat: ciel.nuit > 0.3 ? "nuit" : "" }), 96, Monde.Y_RUE - 44);
    g.drawImage(Meubles.sprite("pigeon", { f: Math.floor(t * 0.7) }), X.murG + 96, P(4) - 22);
    g.drawImage(Meubles.sprite("pigeon", { f: Math.floor(t * 0.5 + 1) }), X.murG + 108, P(4) - 22);
    // lanterne du passage
    g.fillStyle = C["0"];
    g.fillRect(Monde.X_PASSAGE - 2, J(0) - 46, 5, 1);
    g.fillRect(Monde.X_PASSAGE - 2, J(0) - 39, 5, 1);
    g.fillStyle = ciel.nuit > 0.3 ? C.u : C.r;
    g.fillRect(Monde.X_PASSAGE - 1, J(0) - 45, 3, 6);

    ascenseur(g);

    // colis en attente : ils sautillent pour qu'on les ouvre
    for (const c of Agents.colis) {
      const saut = Math.abs(Math.sin(t * 4 + c.x)) * 3;
      g.fillStyle = "rgba(43,43,43,0.2)";
      g.fillRect(c.x - 5, Y(c.niveau) + 1, 10, 1);
      g.drawImage(Meubles.sprite("colis"), c.x - 6, Math.round(Y(c.niveau) - 10 - saut));
      if (Math.floor(t * 3) % 3 === 0) {
        g.fillStyle = C.u;
        g.fillRect(c.x - 8 + Math.floor((t * 7) % 16), Math.round(Y(c.niveau) - 14 - saut), 1, 1);
      }
    }

    // agents, triés par profondeur
    const ordre = Agents.liste.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    for (const a of ordre) {
      if (a.cache) continue;
      const s = a.mode === "assis" ? Agents.siegeParId(a.siege) : null;
      if (s && s.chaise) {
        const chaise = Meubles.sprite("chaise");
        dessinerSprite(g, chaise, a.dir > 0 ? Math.round(a.x) - 8 : Math.round(a.x) - 2, Y(a.niveau) - 13, a.dir < 0);
      }
      if (!s && a.mode !== "ascenseur") {
        g.fillStyle = "rgba(43,43,43,0.22)";
        g.fillRect(Math.round(a.x) - 4, Math.round(a.y), 9, 1);
        g.fillRect(Math.round(a.x) - 3, Math.round(a.y) + 1, 7, 1);
      }
      const im = Agents.image(a, t);
      g.drawImage(im.image, im.x, im.y);
      if (s && s.pose === "lit" && (a.actif || a.type === "toi")) {
        // portable sur les genoux
        g.fillStyle = C["1"];
        g.fillRect(Math.round(a.x) + (a.dir > 0 ? 3 : -7), im.y + 17, 5, 1);
        g.fillStyle = Math.floor(t * 3 + a.phase) % 2 ? C.s : C.r;
        g.fillRect(Math.round(a.x) + (a.dir > 0 ? 6 : -7), im.y + 13, 2, 4);
      }
      if (a.anim === "boit" && a.mode === "debout" && Math.floor((t + a.phase) * 0.8) % 2 === 1) {
        g.fillStyle = C["6"];
        g.fillRect(Math.round(a.x) + (a.dir > 0 ? 3 : -5), im.y + 12, 2, 2);
      }
    }
    grilleAscenseur(g);

    // le chat
    const chat = Agents.chat;
    if (chat.etat !== "absent") {
      const nom = chat.etat === "marche" ? "chat-marche" : "chat-assis";
      const img = Meubles.sprite(nom, { f: Math.floor(t * (chat.etat === "marche" ? 7 : 1)) });
      dessinerSprite(g, img, Math.round(chat.x) - 8, Math.round(chat.y) - img.height, chat.dir < 0);
    }
    const panier = scene.elements.find((e) => e.sprite === "panier-chat");
    if (panier && chat.etat === "absent") g.drawImage(Meubles.sprite("chat-dort", { f: Math.floor(t * 0.6) }), panier.x + 2, panier.y - 3);

    // façades fermées, voiles, vitres
    g.drawImage(fond.avant, -fond.marge, -fond.haut);
    // dans la rue : le vélo du livreur, le camion du déménagement
    if (veloCargo) g.drawImage(Meubles.sprite("velo-cargo"), X.passage1 + 8, Monde.Y_RUE - 9);
    for (const v of vehicules) {
      const img = Meubles.sprite(v.sprite);
      dessinerSprite(g, img, Math.round(v.x), v.y - img.height, v.miroir);
    }

    // 3. lumière : voile de l'heure, puis ce qui brille
    lumiere(t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(ox, oy);
    emissifs(g, t);

    // 4. par-dessus : plaques, prix, étiquettes, bulles
    for (const lieu of infos.lieux) if (!lieu.ouvert) plaque(g, lieu, t);
    for (const p of Monde.PIECES) if (scene.etats[p.id] === "a-acheter") prixPiece(g, p);

    if (rangement && rangement.actif) dessinerRangement(g, t);

    for (const a of ordre) {
      if (a.cache || a.mode === "ascenseur") continue;
      const haut = Math.round(a.y) - 25;
      const vise = survol && survol.type === "agent" && survol.id === a.id;
      // Toi : toujours. Agents maison : de près. Collègues : au survol (leur nom est dans leur bulle).
      const montre = a.type === "toi" || vise || (a.type === "maison" && echelle >= 3 && !a.bulle);
      if (!montre || a.type === "livreur" || a.type === "visiteur") continue;
      const nom = a.type === "toi" ? "Toi" : Police.abreger(a.nom, vise ? 200 : 64);
      const r = pastille(g, nom, a.x, haut - 9, a.type === "toi" ? C.c : a.type === "maison" ? C.o : C["0"], C["6"]);
      if (a.renforts > 0) pastille(g, "+" + a.renforts, r.x + r.l + 6, haut - 9, C.b, C["6"]);
    }
    // l'étoile du berger brille au-dessus de toi quand une action de vente t'attend
    const toi = Agents.trouver("toi");
    if (toi && infos.etoile && !toi.bulle) {
      const yy = Math.round(toi.y) - 49 + Math.round(Math.sin(t * 2.4) * 2);
      g.drawImage(Meubles.sprite("icone-etoile"), Math.round(toi.x) - 6, yy);
      if (Math.floor(t * 4) % 3 === 0) {
        g.fillStyle = C["6"];
        g.fillRect(Math.round(toi.x) + 6, yy + 1, 1, 1);
        g.fillRect(Math.round(toi.x) - 8, yy + 8, 1, 1);
      }
    }
    // version 4 : ton familier te suit, et tes ombres veillent derrière toi
    if (toi && infos.compagnons && !toi.cache) {
      const pied = Math.round(toi.y);
      const nbOmbres = Math.min(3, infos.compagnons.ombres || 0);
      const silhouette = Meubles.sprite("icone-ombre");
      for (let i = 0; i < nbOmbres && silhouette; i++) {
        g.globalAlpha = 0.7;
        g.drawImage(silhouette, Math.round(toi.x) - 24 - i * 11, pied - 12 + Math.round(Math.sin(t * 1.6 + i) * 1.5));
        g.globalAlpha = 1;
      }
      const nomFamilier = { moineau: "fam-moineau", chat: "chat-assis", herisson: "fam-herisson", salamandre: "fam-salamandre" }[infos.compagnons.familier];
      const familier = nomFamilier ? Meubles.sprite(nomFamilier, { f: Math.floor(t * 2) }) : null;
      if (familier) g.drawImage(familier, Math.round(toi.x) + 9, pied - familier.height);
    }
    for (const a of ordre) {
      if (!a.bulle || a.cache) continue;
      const nomme = a.type === "collegue" || (a.type === "maison" && echelle < 3);
      bulle(g, a.bulle.texte, a.x, Math.round(a.y) - (a.type === "toi" ? 35 : 24), nomme ? a.nom : null);
    }
    if (survol && survol.type === "colis") pastille(g, "Ouvre-moi", survol.x, Y(survol.niveau) - 26, C.c, C["6"]);

    // 5. composition finale
    ctx.drawImage(couche, 0, 0);
    if (etat.meteo === "pluie") {
      // la pluie passe devant les façades, pas dans les pièces en coupe
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, X.murG - 4 + ox, vh);
      ctx.rect(X.voisin0 + ox, 0, vl, P(0) - 6 + oy);
      ctx.rect(X.voisin1 + ox, 0, vl, vh);
      ctx.rect(0, Y(0) + 6 + oy, vl, vh);
      ctx.clip();
      Ciel.pluie(ctx, vl, vh, t + 3, 0.6);
      ctx.restore();
    }
    ctx.translate(ox, oy);
    dessinerEffets(ctx, dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ------------------------------------------------------------ mode rangement
  function dessinerRangement(g, t) {
    // la grille des emplacements possibles
    for (const [id, z] of Object.entries(Monde.ZONES)) {
      if (!infos.zonesOuvertes.includes(id)) continue;
      g.fillStyle = "rgba(253,251,247,0.5)";
      for (let x = z.x0; x < z.x1; x += 8) g.fillRect(x, Y(z.niveau) + 2, 1, 1);
      g.fillStyle = "rgba(217,106,78,0.6)";
      g.fillRect(z.x0, Y(z.niveau) + 3, z.x1 - z.x0, 1);
    }
    for (const el of scene.rangeables) {
      if (rangement.prise && rangement.prise.cle === el.cle) continue;
      const vif = survol && survol.type === "objet" && survol.cle === el.cle;
      g.fillStyle = vif ? C.t : "rgba(253,251,247,0.9)";
      coins(g, el.x - 1, el.y - 1, el.l + 2, el.h + 2);
    }
    const p = rangement.prise;
    if (p) {
      const img = Meubles.sprite(p.sprite, {});
      g.globalAlpha = 0.9;
      g.drawImage(img, p.x, p.y - 2);
      g.globalAlpha = 1;
      g.fillStyle = p.valide ? C.l : C.c;
      coins(g, p.x - 1, p.y - 3, p.l + 2, p.h + 2);
      g.fillRect(p.x, Y(p.niveau) + 2, p.l, 1);
    }
  }
  function coins(g, x, y, l, h) {
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + l - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + l - 1, y + h - 1, -1, -1]]) {
      g.fillRect(cx, cy, 1, 1);
      g.fillRect(cx + dx, cy, 1, 1);
      g.fillRect(cx + dx * 2, cy, 1, 1);
      g.fillRect(cx, cy + dy, 1, 1);
      g.fillRect(cx, cy + dy * 2, 1, 1);
    }
  }

  // ------------------------------------------------------------ ce qu'il y a sous le curseur
  function cible(px, py) {
    if (!scene) return null;
    const m = versMonde(px, py);
    for (const c of Agents.colis) {
      if (Math.abs(m.x - c.x) < 8 && m.y > Y(c.niveau) - 16 && m.y < Y(c.niveau) + 3) return { type: "colis", id: c.id, x: c.x, niveau: c.niveau };
    }
    if (rangement && rangement.actif) {
      for (let i = scene.rangeables.length - 1; i >= 0; i--) {
        const el = scene.rangeables[i];
        if (m.x >= el.x - 1 && m.x < el.x + el.l + 1 && m.y >= el.y - 1 && m.y < el.y + el.h + 2) return { type: "objet", cle: el.cle, el };
      }
      return null;
    }
    for (const a of Agents.liste) {
      if (Math.abs(m.x - a.x) < 7 && m.y > a.y - 24 && m.y < a.y + 2) return { type: "agent", id: a.id, agent: a };
    }
    for (const lieu of infos.lieux) {
      const z = lieu.zoneClic;
      if (!lieu.ouvert && z && m.x >= z.x && m.x < z.x + z.l && m.y >= z.y && m.y < z.y + z.h) return { type: "lieu", id: lieu.id };
    }
    for (const p of Monde.PIECES) {
      if (scene.etats[p.id] !== "a-acheter") continue;
      const n = Monde.ZONES[p.zone].niveau;
      if (m.x >= p.x0 && m.x < p.x1 && m.y >= P(n) && m.y < Y(n) + 3) return { type: "piece", id: p.id, lieu: Monde.ZONES[p.zone].lieu, amelioration: p.amelioration };
    }
    if (scene.mission && dans(m, scene.mission)) return { type: "mission" };
    if (scene.etagere && dans(m, scene.etagere)) return { type: "trophees" };
    for (const f of scene.fantomes) if (m.x >= f.x && m.x < f.x + f.l && m.y >= f.y && m.y < f.y + f.h) return { type: "fantome", cle: f.cle, lieu: f.lieu, id: f.id, nom: f.nom, prix: f.prix };
    for (const el of scene.rangeables) if (dans(m, el)) return { type: "objet", cle: el.cle, el };
    return null;
  }
  function dans(m, el) {
    return m.x >= el.x && m.x < el.x + el.l && m.y >= el.y && m.y < el.y + el.h;
  }

  // Position d'un objet pris en main : zone sous le curseur, x aligné sur la grille, validité.
  function positionRangement(px, py, el) {
    const m = versMonde(px, py);
    let meilleure = null;
    for (const [id, z] of Object.entries(Monde.ZONES)) {
      if (!infos.zonesOuvertes.includes(id)) continue;
      const d = Math.abs(m.y - (Y(z.niveau) - 18)) + (m.x < z.x0 - 20 || m.x > z.x1 + 20 ? 1000 : 0);
      if (!meilleure || d < meilleure.d) meilleure = { id, z, d };
    }
    if (!meilleure) return null;
    const z = meilleure.z;
    const d = el.def;
    const pose = Decor.poseDe(el.sprite);
    const x = Math.max(z.x0, Math.min(z.x1 - d.l, Math.round((m.x - d.l / 2) / 2) * 2));
    const couche = pose === "mur" ? "mur" : "sol";
    const pris = scene.pris[meilleure.id][couche].filter((p) => !(meilleure.id === el.zone && p[0] === el.x && p[1] === el.x + el.l));
    const piece = Monde.PIECES.find((p) => p.zone === meilleure.id && x + d.l / 2 >= p.x0 && x + d.l / 2 < p.x1);
    const ouverte = piece && scene.etats[piece.id] === "ouverte";
    const libre = pose === "plat" || !pris.some((p) => x < p[1] && x + d.l > p[0]);
    return { cle: el.cle, sprite: el.sprite, zone: meilleure.id, niveau: z.niveau, x, y: Decor.yDe(pose, z.niveau, d.h, d.my), l: d.l, h: d.h, valide: Boolean(ouverte && libre) };
  }

  racine.Rendu = {
    initialiser(c) {
      canevas = c;
      ctx = c.getContext("2d");
      redimensionner();
    },
    redimensionner,
    cadrer,
    zoomer,
    deplacer,
    versMonde,
    versEcran,
    cible,
    positionRangement,
    dessiner,
    pieces,
    confettis,
    texteFlottant,
    etincelles,
    feu,
    poussiere,
    gouttes,
    secouer(v) {
      secousse = v;
    },
    definirScene(s, f) {
      scene = s;
      fond = f;
    },
    definirEtat(e) {
      etat = { ...etat, ...e };
      ciel = Ciel.etat(etat.heure, etat.mois);
    },
    definirInfos(i) {
      infos = { ...infos, ...i };
    },
    definirZone(z) {
      zoneUtile = z;
    },
    definirRangement(r) {
      rangement = r;
    },
    definirSurvol(s) {
      survol = s;
    },
    definirVehicules(v, velo) {
      vehicules = v;
      veloCargo = velo;
    },
    get fond() {
      return fond;
    },
    _debug() {
      return { ombre, couche, cam, scene };
    },
    get echelle() {
      return echelle;
    },
    get ciel() {
      return ciel;
    },
    get camera() {
      return cam;
    },
  };
})(window);
