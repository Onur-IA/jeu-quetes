"use strict";
// L'immeuble parisien en coupe : structure, murs et sols de chaque pièce, escalier, cage d'ascenseur,
// passage, voisins en façade, toits de zinc, rue. Deux couches fixes : derrière et devant les meubles.
(function (racine) {
  const Palette = racine.Palette;
  const Monde = racine.Monde;
  const Meubles = racine.Meubles;
  const Police = racine.Police;
  const C = Palette.C;
  const X = Monde.X;
  const L = Monde.L;
  const HAUT = 60; // marge au-dessus de y = 0 (toits, enseigne)
  const MARGE = 260; // la rue continue de chaque côté du monde
  const H = Monde.YS + 52 + HAUT;
  const Y = Monde.yNiveau;
  const P = Monde.plafond;
  const J = Monde.jonction;

  function canevas() {
    const c = document.createElement("canvas");
    c.width = L + 2 * MARGE;
    c.height = H;
    const ctx = c.getContext("2d");
    ctx.translate(MARGE, HAUT);
    return { c, ctx, g: Meubles.crayon(ctx) };
  }

  // ------------------------------------------------------------ styles de murs et de sols
  function mur(g, style, x0, x1, y0, y1, graine) {
    const w = x1 - x0;
    const h = y1 - y0;
    const alea = Palette.hasard(graine);
    switch (style) {
      case "studio":
        g.r(x0, y0, w, h, "5");
        for (let x = x0 + 3; x < x1; x += 6) g.r(x, y0, 1, h, "4");
        g.r(x0, y1 - 3, w, 3, "h").r(x0, y1 - 3, w, 1, "i");
        break;
      case "brique":
        g.r(x0, y0, w, h, "b");
        for (let y = y0; y < y1; y += 3) {
          g.r(x0, y + 2, w, 1, "a");
          for (let x = x0 + ((y - y0) / 3) % 2 * 4; x < x1; x += 8) g.r(Math.floor(x), y, 1, 2, "a");
        }
        for (let i = 0; i < w * 0.5; i++) g.p(x0 + Math.floor(alea() * w), y0 + Math.floor(alea() * (h / 3)) * 3 + (alea() < 0.5 ? 0 : 1), alea() < 0.6 ? "c" : "d");
        g.r(x0, y0, w, 5, "5").r(x0, y0 + 5, w, 1, "3");
        g.r(x0, y1 - 2, w, 2, "1");
        break;
      case "atelier":
        g.r(x0, y0, w, h, "4");
        g.r(x0, y1 - 13, w, 13, "h").r(x0, y1 - 13, w, 1, "i").r(x0, y1 - 14, w, 1, "g");
        for (let x = x0 + 5; x < x1; x += 6) g.r(x, y1 - 12, 1, 12, "g");
        g.r(x0, y0 + 6, w, 1, "3");
        break;
      case "mousse":
        g.r(x0, y0, w, h, "o");
        for (let y = y0 + 1; y < y1 - 2; y += 4) for (let x = x0 + 1; x < x1 - 2; x += 4) g.r(x, y, 2, 2, "n").p(x, y, "p");
        g.r(x0, y1 - 2, w, 2, "n");
        break;
      case "video":
        g.r(x0, y0, w, h, "2");
        for (let x = x0; x < x1; x += 12) g.r(x, y0, 1, h, "1");
        g.r(x0, y0, w, 3, "1").r(x0, y1 - 2, w, 2, "1");
        for (let x = x0 + 6; x < x1; x += 12) g.r(x - 1, y0 + 3, 3, 2, "0");
        break;
      case "bureaux":
        g.r(x0, y0, w, h, "6");
        g.r(x0, y0 + 9, w, 2, "c").r(x0, y0 + 11, w, 1, "d");
        g.r(x0, y1 - 3, w, 3, "4").r(x0, y1 - 3, w, 1, "3");
        break;
      case "reunion":
        g.r(x0, y0, w, h, "i");
        for (let x = x0 + 2; x < x1; x += 3) g.r(x, y0, 1, h, "h");
        g.r(x0, y1 - 3, w, 3, "g").r(x0, y0, w, 2, "g");
        break;
      case "cafe":
        g.r(x0, y0, w, h, "d");
        g.r(x0, y0 + 2, w, 1, "e");
        g.r(x0, y1 - 14, w, 14, "6");
        for (let x = x0; x < x1; x += 4) g.r(x, y1 - 14, 1, 14, "4");
        for (let y = y1 - 14; y < y1; y += 4) g.r(x0, y, w, 1, "4");
        g.r(x0, y1 - 15, w, 1, "c");
        break;
      case "presse":
        g.r(x0, y0, w, h, "3");
        for (let i = 0; i < w; i++) g.p(x0 + Math.floor(alea() * w), y0 + Math.floor(alea() * h), alea() < 0.5 ? "4" : "2");
        g.r(x0, y0 + 4, w, 2, "2").r(x0, y0 + 4, w, 1, "3").r(x0 + 14, y0 + 6, 2, h - 6, "2").r(x0 + 15, y0 + 6, 1, h - 6, "3");
        g.r(x0, y1 - 8, w, 8, "2").r(x0, y1 - 8, w, 1, "1");
        break;
      case "lecture":
      case "librairie":
        g.r(x0, y0, w, h, "j");
        for (let y = y0 + 3; y < y1 - 12; y += 5) for (let x = x0 + 2 + (((y - y0) / 5) % 2) * 3; x < x1 - 1; x += 6) g.p(Math.floor(x), y, "k");
        g.r(x0, y1 - 12, w, 12, "g").r(x0, y1 - 12, w, 1, "h").r(x0, y1 - 13, w, 1, "f");
        for (let x = x0 + 4; x < x1 - 8; x += 12) g.cadre(x, y1 - 9, 9, 7, "g", "f");
        if (style === "lecture") {
          // un mur de livres au-dessus des tables
          g.r(x0 + 26, y0 + 3, w - 30, 17, "f");
          g.livres(x0 + 27, y0 + 4, w - 32, 7, graine + 3).livres(x0 + 27, y0 + 12, w - 32, 7, graine + 9);
          g.r(x0 + 27, y0 + 11, w - 32, 1, "g");
        }
        break;
      case "palier":
        g.r(x0, y0, w, h, "4");
        g.r(x0, y1 - 11, w, 11, "3").r(x0, y1 - 11, w, 1, "5").r(x0, y1 - 2, w, 2, "2");
        break;
      default:
        g.r(x0, y0, w, h, "5");
    }
    // ombre douce sous le plafond
    g.ctx.fillStyle = "rgba(43,43,43,0.16)";
    g.ctx.fillRect(x0, y0, w, 1);
    g.ctx.fillStyle = "rgba(43,43,43,0.07)";
    g.ctx.fillRect(x0, y0 + 1, w, 2);
  }

  function sol(g, style, x0, x1, y0, graine) {
    const w = x1 - x0;
    const h = Monde.BANDE;
    const alea = Palette.hasard(graine + 7);
    switch (style) {
      case "parquet":
      case "parquet-fonce": {
        const [a, b, c] = style === "parquet" ? ["h", "g", "i"] : ["g", "f", "h"];
        g.r(x0, y0, w, h, a);
        for (let l = 0; l < 3; l++) {
          g.r(x0, y0 + l * 3 + 2, w, 1, b);
          for (let x = x0 + Math.floor(alea() * 12); x < x1; x += 10 + Math.floor(alea() * 10)) g.r(x, y0 + l * 3, 1, 2, b);
        }
        g.r(x0, y0, w, 1, c);
        break;
      }
      case "moquette":
      case "moquette-sombre": {
        const [a, b, c] = style === "moquette" ? ["p", "o", "q"] : ["o", "n", "p"];
        g.r(x0, y0, w, h, a);
        for (let i = 0; i < w * 1.2; i++) g.p(x0 + Math.floor(alea() * w), y0 + 1 + Math.floor(alea() * (h - 1)), alea() < 0.5 ? b : c);
        g.r(x0, y0, w, 1, b);
        break;
      }
      case "carrelage":
        g.r(x0, y0, w, h, "5");
        for (let l = 0; l < 3; l++) for (let x = x0; x < x1; x += 6) if ((Math.floor((x - x0) / 6) + l) % 2 === 0) g.r(x, y0 + l * 3, Math.min(6, x1 - x), 3, "2");
        g.r(x0, y0, w, 1, "1");
        break;
      case "pave":
        g.r(x0, y0, w, h, "3");
        for (let l = 0; l < 3; l++) for (let x = x0 + (l % 2) * 3; x < x1; x += 6) g.r(x, y0 + l * 3, 1, 3, "2");
        g.r(x0, y0 + 3, w, 1, "2").r(x0, y0 + 6, w, 1, "2").r(x0, y0, w, 1, "4");
        break;
      default:
        g.r(x0, y0, w, h, "3");
        for (let i = 0; i < w * 0.6; i++) g.p(x0 + Math.floor(alea() * w), y0 + 1 + Math.floor(alea() * (h - 1)), alea() < 0.5 ? "2" : "4");
        g.r(x0, y0, w, 1, "2");
    }
  }

  // ------------------------------------------------------------ façades et toits
  // Façade en pierre de taille : fenêtres hautes, volets, balcons filants, corniches.
  function facade(g, x0, x1, yBas, niveaux, o, fenetres) {
    const w = x1 - x0;
    const pierre = o.pierre || "5";
    const ombre = o.ombre || "4";
    const yHaut = yBas - niveaux * Monde.PAS;
    g.r(x0, yHaut, w, yBas - yHaut, pierre);
    g.r(x1 - 2, yHaut, 2, yBas - yHaut, ombre);
    const alea = Palette.hasard(o.graine || 1);
    const nb = Math.max(1, Math.floor((w - 8) / 26));
    const pas = (w - 8) / nb;
    for (let n = 0; n < niveaux; n++) {
      const yb = yBas - n * Monde.PAS;
      const yh = yb - Monde.PAS;
      // refends (joints horizontaux) et corniche
      for (let y = yh + 6; y < yb - 2; y += 8) g.r(x0, y, w - 2, 1, ombre);
      g.r(x0 - 1, yh, w + 2, 2, "6").r(x0 - 1, yh + 2, w + 2, 1, "3");
      const balcon = o.balcons && o.balcons.includes(n);
      for (let k = 0; k < nb; k++) {
        const fx = Math.round(x0 + 4 + pas * k + (pas - 12) / 2);
        const fy = yh + 12;
        const fh = 26;
        const ferme = o.volets === "fermes" || alea() < (o.tauxFermes || 0.12);
        g.r(fx - 2, fy - 2, 16, fh + 3, "3").r(fx - 1, fy - 3, 14, 1, "6");
        if (ferme) {
          g.r(fx, fy, 12, fh, "o");
          for (let y = fy + 1; y < fy + fh; y += 2) g.r(fx, y, 12, 1, "p");
          g.r(fx + 5, fy, 2, fh, "n");
        } else {
          g.r(fx, fy, 12, fh, "o").r(fx + 5, fy, 2, fh, "5").r(fx, fy + 8, 12, 1, "5").r(fx, fy + 17, 12, 1, "5");
          g.p(fx + 1, fy + 1, "p").p(fx + 2, fy + 2, "p").p(fx + 8, fy + 10, "p");
          if (o.persiennes && alea() < 0.7) {
            g.r(fx - 5, fy, 4, fh, "p").r(fx + 13, fy, 4, fh, "p");
            for (let y = fy + 1; y < fy + fh; y += 2) g.r(fx - 5, y, 4, 1, "o").r(fx + 13, y, 4, 1, "o");
          }
          if (alea() < 0.35) g.r(fx, fy, 3, fh, "d").r(fx + 9, fy, 3, fh, "d"); // rideaux
          if (fenetres) fenetres.push({ x: fx, y: fy, l: 12, h: fh, k: alea(), rideau: alea() < 0.5 });
        }
        // garde-corps en fer forgé
        g.r(fx - 2, fy + fh - 7, 16, 1, "0");
        for (let i = 0; i < 16; i += 2) g.r(fx - 2 + i, fy + fh - 6, 1, 6, "0");
        g.r(fx - 2, fy + fh - 1, 16, 1, "0").p(fx + 5, fy + fh - 4, "0").p(fx + 7, fy + fh - 4, "0");
        if (alea() < 0.25 && !ferme) g.feuilles(fx + 3 + Math.floor(alea() * 6), fy + fh - 8, 3, 2, 500 + k + n * 7, false).p(fx + 4, fy + fh - 9, alea() < 0.5 ? "v" : "c");
      }
      if (balcon) {
        g.r(x0 - 2, yb - 9, w + 4, 2, "3").r(x0 - 2, yb - 9, w + 4, 1, "6");
        g.r(x0 - 2, yb - 17, w + 4, 1, "0");
        for (let x = x0 - 2; x < x1 + 2; x += 2) g.r(x, yb - 16, 1, 7, "0");
      }
    }
  }

  // Toit à la Mansart en zinc, avec lucarnes et cheminées.
  function toit(g, x0, x1, yBase, h, o) {
    const w = x1 - x0;
    for (let y = 0; y < h; y++) {
      const retrait = y < h - 6 ? Math.round(y * 0.3) : Math.round((h - 6) * 0.3) + (y - (h - 6)) * 3;
      g.r(x0 + retrait, yBase - y - 1, w - retrait * 2, 1, y >= h - 6 ? "q" : "p");
    }
    for (let x = x0 + 6; x < x1 - 4; x += 7) g.r(x, yBase - h + 6, 1, h - 6, "o");
    g.r(x0, yBase - 1, w, 1, "o").r(x0 + 2, yBase - h + 5, w - 4, 1, "o");
    const nb = Math.max(1, Math.floor(w / 34));
    for (let k = 0; k < nb; k++) {
      const lx = Math.round(x0 + (w / nb) * (k + 0.5)) - 6;
      g.r(lx, yBase - 17, 12, 15, "5").r(lx - 1, yBase - 19, 14, 2, "o").r(lx + 2, yBase - 21, 8, 2, "p");
      g.r(lx + 2, yBase - 15, 8, 11, "o").r(lx + 5, yBase - 15, 2, 11, "5").p(lx + 3, yBase - 14, "p");
      if (o && o.fenetres) o.fenetres.push({ x: lx + 2, y: yBase - 15, l: 8, h: 11, k: (k * 0.37 + 0.2) % 1, rideau: false });
    }
    for (const cx of (o && o.cheminees) || []) cheminee(g, cx, yBase - h + 2);
  }

  function cheminee(g, x, y) {
    g.r(x, y - 12, 12, 14, "4").r(x + 10, y - 12, 2, 14, "3").r(x - 1, y - 13, 14, 2, "3");
    for (let i = 0; i < 3; i++) g.r(x + 1 + i * 4, y - 18, 3, 5, "c").r(x + 3 + i * 4, y - 18, 1, 5, "b").r(x + 1 + i * 4, y - 19, 3, 1, "b");
  }

  // Arbre de la rue, selon la saison.
  function arbre(g, x, ySol, saison) {
    g.r(x - 2, ySol - 30, 4, 30, "f").r(x - 2, ySol - 30, 1, 30, "g");
    g.m(["f....f", ".f..f.", "..ff.."], x - 3, ySol - 36);
    g.r(x - 5, ySol - 1, 10, 2, "1");
    if (saison === "hiver") {
      g.m(["..f.....f...f..", "...f...f...f...", "f...f.f...f....", ".f...f...f...f.", "..f..f..f...f..", "...f.ff.f..f...", "....ffffff.f...", "......ffff....."], x - 8, ySol - 44);
      return;
    }
    const alea = Palette.hasard(31);
    const tons = saison === "automne" ? ["x", "t", "b", "x", "c"] : saison === "printemps" ? ["l", "l", "k", "v", "l"] : ["k", "k", "l", "j", "k"];
    for (const [cx, cy, rx, ry] of [[x - 9, ySol - 44, 9, 8], [x + 8, ySol - 46, 10, 9], [x, ySol - 56, 12, 10], [x - 2, ySol - 40, 13, 7]]) {
      for (let yy = -ry; yy <= ry; yy++) {
        for (let xx = -rx; xx <= rx; xx++) {
          const d = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry);
          if (d > 1 || (d > 0.75 && alea() < 0.4)) continue;
          let c = tons[Math.floor(alea() * tons.length)];
          if (yy > ry * 0.4 && alea() < 0.6) c = saison === "automne" ? "b" : "j";
          g.p(cx + xx, cy + yy, c);
        }
      }
    }
  }

  // ------------------------------------------------------------ escalier et cage d'ascenseur
  function escalier(g, n) {
    const y = Y(n) - 6; // niveau du sol de l'étage
    const x0 = X.escalier0;
    // volée du fond (elle redescend vers la gauche, vue par-dessous) puis volée de devant
    for (let i = 0; i < 6; i++) {
      const xx = X.escalier1 - 2 - i * 4;
      const yy = y - 24 - i * 4;
      g.r(xx - 3, yy - 4, 5, 1, "g").r(xx - 3, yy - 3, 5, 3, "f");
    }
    g.r(X.escalier1 - 2, y - 26, 6, 2, "g").r(X.escalier1 - 2, y - 24, 6, 1, "f"); // demi-palier
    for (let i = 0; i < 6; i++) {
      const xx = x0 - 2 + i * 4;
      const yy = y - i * 4;
      g.r(xx, yy - 4, 5, 1, "i").r(xx, yy - 3, 5, 3 + i * 0, "h").r(xx, yy - 1, 5, 1, "g");
      if (i > 0) g.r(xx, yy, 5, i * 4, "g");
      g.r(xx + 2, yy - 13, 1, 9, "0"); // barreau
    }
    // rampe
    for (let i = 0; i < 24; i++) g.p(x0 + i, y - 14 - i, "0");
    for (let i = 0; i < 24; i++) g.p(x0 + i, y - 13 - i, "a");
  }

  // ------------------------------------------------------------ construction des deux couches
  // scene : résultat de Decor.scene(). vue : { saison, enseigne, caps... }
  function construire(scene, vue) {
    const arriere = canevas();
    const avant = canevas();
    const g = arriere.g;
    const a = avant.g;
    const fenetresFacade = [];
    const etat = scene.etats;
    const ys = Monde.YS;

    // ---- voisins en façade (décor) : à gauche un café, à droite un immeuble plus haut
    // au fond de la rue, à gauche, un immeuble ; puis la placette et le pavillon bas du café
    facade(g, -MARGE, -96, ys + 3, 5, { pierre: "4", ombre: "3", graine: 11, balcons: [1, 4], persiennes: true }, fenetresFacade);
    toit(g, -MARGE - 2, -94, ys + 3 - 5 * Monde.PAS, 26, { cheminees: [-200, -130], fenetres: fenetresFacade });
    g.r(-MARGE, ys - 44, MARGE - 96, 47, "j").r(-MARGE, ys - 46, MARGE - 96, 3, "t");
    for (let x = -MARGE + 10; x < -110; x += 44) g.r(x, ys - 38, 32, 34, "n").r(x, ys - 4, 32, 1, "t");
    g.r(12, ys - 62, 100, 4, "o").r(14, ys - 66, 96, 4, "p").r(18, ys - 68, 88, 2, "q").r(12, ys - 58, 100, 1, "0");
    g.r(14, ys - 57, 96, 13, "5").r(14, ys - 57, 96, 1, "3");
    g.r(40, ys - 78, 10, 12, "4").r(39, ys - 79, 12, 2, "3").r(41, ys - 84, 3, 5, "c").r(45, ys - 84, 3, 5, "c");
    // le café du coin : store rayé, vitrine
    g.r(14, ys - 44, 96, 47, "a").r(18, ys - 38, 52, 34, "n").r(74, ys - 38, 20, 41, "f").r(77, ys - 35, 14, 22, "o");
    g.r(18, ys - 4, 52, 1, "t").r(20, ys - 36, 48, 1, "o").p(92, ys - 16, "t");
    for (let x = 12; x < 112; x += 6) g.r(x, ys - 50, 3, 8, "c").r(x + 3, ys - 50, 3, 8, "6");
    g.r(12, ys - 42, 100, 1, "b");
    for (let x = 12; x < 112; x += 6) g.r(x + 1, ys - 41, 4, 2, x % 12 ? "6" : "c");
    fenetresFacade.push({ x: 18, y: ys - 38, l: 52, h: 34, k: 0.02, cafe: true }, { x: 77, y: ys - 35, l: 14, h: 22, k: 0.05, cafe: true });
    facade(g, 642, 716, ys + 3, 5, { pierre: "4", ombre: "3", graine: 23, balcons: [1, 4], persiennes: true, tauxFermes: 0.2 }, fenetresFacade);
    toit(g, 640, 718, ys + 3 - 5 * Monde.PAS, 24, { cheminees: [660], fenetres: fenetresFacade });
    facade(g, 722, L + MARGE, ys + 3, 4, { pierre: "5", ombre: "4", graine: 37, balcons: [1], persiennes: true }, fenetresFacade);
    toit(g, 720, L + MARGE + 2, ys + 3 - 4 * Monde.PAS, 26, { cheminees: [760, 880], fenetres: fenetresFacade });
    g.r(722, ys - 44, MARGE - 2, 47, "b").r(722, ys - 46, MARGE - 2, 3, "5");
    for (let x = 734; x < L + MARGE - 30; x += 50) g.r(x, ys - 38, 36, 34, "n").r(x, ys - 4, 36, 1, "5");
    g.r(642, ys - 44, 74, 47, "o").r(648, ys - 38, 30, 34, "n").r(686, ys - 38, 22, 41, "j").r(642, ys - 46, 74, 3, "t");

    // ---- le voisin : rez-de-chaussée en coupe (coworking), étages en façade
    facade(g, X.voisin0, X.voisin1, Y(1) + 3, 3, { pierre: "5", ombre: "4", graine: 5, balcons: [0], persiennes: true }, fenetresFacade);
    toit(g, X.voisin0 - 2, X.voisin1 + 2, Y(4) + 3, 26, { cheminees: [X.voisin0 + 24, X.voisin1 - 44], fenetres: fenetresFacade });
    g.r(X.voisin0, P(0) - 6, X.voisin1 - X.voisin0, 6, "1").r(X.voisin0, P(0) - 6, X.voisin1 - X.voisin0, 1, "0");
    g.r(X.voisin0, P(0), 5, 45, "1").r(X.voisin1 - 5, P(0), 5, 45, "1");

    // ---- le passage entre les deux immeubles : mur du fond, grande porte verte, lanterne
    const px0 = X.passage0;
    const px1 = X.passage1;
    g.r(px0, P(0) - 8, px1 - px0, 47, "4");
    for (let y = P(0) - 2; y < J(0); y += 7) g.r(px0, y, px1 - px0, 1, "3");
    g.r(px0, P(0) - 10, px1 - px0, 3, "5").r(px0, P(0) - 7, px1 - px0, 1, "3");
    g.m([
      ".......00000000.......",
      ".....00jjjjjjjj00.....",
      "...00jjjjjjjjjjjj00...",
      "..0jjjjjjjjjjjjjjjj0..",
      ".0jjjjjjjjjjjjjjjjjj0.",
      ".0jjjjjjjjjjjjjjjjjj0.",
    ], px0 + 5, J(0) - 36);
    g.r(px0 + 6, J(0) - 30, 20, 30, "0").r(px0 + 7, J(0) - 30, 18, 30, "j").r(px0 + 15, J(0) - 34, 2, 34, "0");
    g.cadre(px0 + 8, J(0) - 28, 6, 11, "k", "j").cadre(px0 + 18, J(0) - 28, 6, 11, "k", "j").cadre(px0 + 8, J(0) - 14, 6, 12, "k", "j").cadre(px0 + 18, J(0) - 14, 6, 12, "k", "j");
    g.p(px0 + 14, J(0) - 15, "t").p(px0 + 17, J(0) - 15, "t");
    g.r(px0 + 27, J(0) - 24, 4, 3, "o").p(px0 + 28, J(0) - 23, "6"); // numéro
    sol(g, "pave", px0, px1, J(0), 77);
    // lierre qui passe par-dessus le mur
    g.feuilles(px0 + 4, P(0) - 9, 5, 3, 91, false).feuilles(px1 - 6, P(0) - 8, 6, 4, 93, false).feuilles(px1 - 3, P(0) - 1, 3, 5, 95, false);

    // ---- immeuble principal : dalles, murs coupés
    const bx0 = X.murG;
    const bx1 = X.murD;
    for (let n = 0; n <= 4; n++) {
      g.r(bx0, Y(n) + 3, bx1 - bx0, 6, "1").r(bx0, Y(n) + 3, bx1 - bx0, 1, "0").r(bx0, Y(n) + 8, bx1 - bx0, 1, "2");
    }
    g.r(bx0, P(3) - 6, 6, Y(0) + 3 - P(3) + 6, "1").r(bx1 - 6, P(3) - 6, 6, Y(0) + 3 - P(3) + 6, "1");
    g.r(bx0, P(3) - 6, 1, Y(0) + 3 - P(3) + 6, "0").r(bx1 - 1, P(3) - 6, 1, Y(0) + 3 - P(3) + 6, "0");

    // ---- pièces : murs, sols, cloisons
    for (const p of Monde.PIECES) {
      const z = Monde.ZONES[p.zone];
      const n = z.niveau;
      const e = etat[p.id];
      if (e === "fermee") continue;
      const brut = e === "a-acheter";
      mur(g, brut ? "presse" : p.mur, p.x0, p.x1, P(n), J(n), Palette.graineDe(p.id));
      sol(g, brut ? "beton" : p.sol, p.x0, p.x1, J(n), Palette.graineDe(p.id));
      // cloison à droite de la pièce si une autre pièce suit (porte basse laissée libre)
      if (p.x1 < X.pieces1) g.r(p.x1 - 1, P(n), 2, 6, "1").r(p.x1 - 1, P(n), 2, 39, brut ? "1" : "2").r(p.x1 - 1, P(n) + 6, 2, 2, "1");
    }
    // sous les toits : rampants de la mansarde
    for (let i = 0; i < 39; i++) {
      const d = Math.round(((39 - i) / 39) * 12);
      g.r(X.pieces0, P(4) + i, 12 - d + 0, 1, "1");
    }
    for (let i = 0; i < 39; i++) {
      const d = Math.round((i / 39) * 14);
      g.r(X.pieces0, P(4) + i, Math.max(0, 14 - d), 1, "4");
      g.p(X.pieces0 + Math.max(0, 14 - d), P(4) + i, "3");
    }

    // ---- cage d'escalier, palier, ascenseur
    for (let n = 0; n <= 4; n++) {
      mur(g, "palier", X.pieces1, n === 4 ? X.ascenseur1 : X.ascenseur0, P(n), J(n), 40 + n);
      sol(g, n === 0 ? "carrelage" : "parquet-fonce", X.pieces1, n === 4 ? X.ascenseur1 : X.ascenseur0, J(n), 60 + n);
      g.r(X.pieces1 - 1, P(n), 2, 7, "1"); // linteau au-dessus de la porte du palier
      if (n < 4) {
        // numéro d'étage sur le mur du palier
        const num = Police.image(n === 0 ? "RC" : String(n), C["2"]);
        g.ctx.drawImage(num, X.pieces1 + 4, P(n) + 2);
      }
    }
    for (let n = 0; n < 4; n++) escalier(g, n);
    // cage d'ascenseur : fond sombre, rails, câbles
    g.r(X.ascenseur0, P(3) - 2, 18, Y(0) + 3 - P(3) + 2, "n");
    for (let y = P(3); y < Y(0); y += 6) g.r(X.ascenseur0 + 1, y, 16, 1, "o");
    g.r(X.ascenseur0, P(3) - 2, 1, Y(0) + 3 - P(3) + 2, "0").r(X.ascenseur1 - 1, P(3) - 2, 1, Y(0) + 3 - P(3) + 2, "0");
    g.r(X.ascenseur0 + 2, P(3) - 2, 1, Y(0) - P(3), "1").r(X.ascenseur1 - 3, P(3) - 2, 1, Y(0) - P(3), "1");
    // machinerie sous les toits
    g.cadre(X.ascenseur0, P(4) + 16, 18, 23, "2", "0").r(X.ascenseur0 + 2, P(4) + 18, 14, 1, "3");
    g.m([".0000.", "0.00.0", "000000", "0.00.0", ".0000."], X.ascenseur0 + 6, P(4) + 24).p(X.ascenseur0 + 3, P(4) + 34, "c").p(X.ascenseur0 + 5, P(4) + 34, "k");
    // porte du rez-de-chaussée vers le passage, et porte du voisin
    g.r(bx1 - 6, J(0) - 30, 6, 30, "4").r(bx1 - 6, J(0) - 31, 6, 1, "0");
    sol(g, "carrelage", bx1 - 6, bx1, J(0), 9);
    g.r(X.voisin0, J(0) - 30, 5, 30, etat.coworking === "fermee" ? "1" : "b").r(X.voisin0, J(0) - 31, 5, 1, "0");
    if (etat.coworking !== "fermee") sol(g, "carrelage", X.voisin0, X.cowork0, J(0), 13);

    // ---- le toit du grand immeuble : rampants coupés, zinc, cheminées
    const yt = P(4);
    for (let i = 0; i < 42; i++) {
      const d = Math.round((i / 42) * 14);
      g.r(bx0 - 2 + d, Y(4) + 3 - i, 5, 1, "1").p(bx0 - 2 + d, Y(4) + 3 - i, "p").p(bx0 - 1 + d, Y(4) + 3 - i, "o");
      g.r(bx1 - 3 - d, Y(4) + 3 - i, 5, 1, "1").p(bx1 + 1 - d, Y(4) + 3 - i, "p").p(bx1 - d, Y(4) + 3 - i, "o");
    }
    // côté droit de la mansarde, à l'intérieur
    for (let i = 0; i < 39; i++) {
      const d = Math.round(((39 - i) / 39) * 12);
      g.r(X.ascenseur1 - d, P(4) + i, d + 2, 1, "1");
    }
    const faitage = 12;
    for (let x = bx0 + 12; x < bx1 - 12; x++) {
      const t = Math.abs((x - (bx0 + bx1) / 2) / ((bx1 - bx0) / 2 - 12));
      const hh = Math.round(faitage * (1 - t * t)) + 3;
      g.r(x, yt - hh, 1, hh, "p").p(x, yt - hh, "q");
      if ((x - bx0) % 7 === 0) g.r(x, yt - hh + 1, 1, hh - 1, "o");
    }
    g.r(bx0 + 10, yt - 1, bx1 - bx0 - 20, 1, "0");
    cheminee(g, bx0 + 34, yt - 9);
    cheminee(g, bx1 - 70, yt - 10);

    // ---- la rue : trottoir, bordure, chaussée pavée
    const rx = -MARGE;
    const rl = L + 2 * MARGE;
    g.r(rx, ys + 3, rl, 4, "2").r(rx, ys + 3, rl, 1, "0");
    g.r(bx0, ys + 3, bx1 - bx0, 4, "0").r(X.voisin0, ys + 3, X.voisin1 - X.voisin0, 4, "0");
    g.r(rx, ys + 7, rl, 14, "3").r(rx, ys + 7, rl, 1, "4");
    for (let x = rx; x < rx + rl; x += 14) g.r(x, ys + 8, 1, 13, "2");
    g.r(rx, ys + 14, rl, 1, "2");
    g.r(rx, ys + 21, rl, 2, "2").r(rx, ys + 21, rl, 1, "4");
    g.r(rx, ys + 23, rl, 30, "1");
    const alea = Palette.hasard(808);
    for (let i = 0; i < 900; i++) g.p(rx + Math.floor(alea() * rl), ys + 24 + Math.floor(alea() * 28), alea() < 0.5 ? "0" : "2");
    for (let x = rx + 6; x < rx + rl; x += 30) g.r(x, ys + 37, 14, 1, "3");
    // devant le passage : le trottoir rejoint la cour
    g.r(px0, ys + 3, px1 - px0, 4, "3").r(px0, ys + 3, px1 - px0, 1, "2");
    arbre(g, 62, ys + 16, vue.saison || "ete");

    // ---- couche de devant : lieux fermés (volets clos), aperçus (voile tramé), vitres
    const niveauxFermes = [];
    for (const lieu of Monde.ORDRE) {
      if (lieu === "coworking") continue;
      const pieces = Monde.PIECES.filter((p) => Monde.ZONES[p.zone].lieu === lieu);
      if (!pieces.length || etat[pieces[0].id] !== "fermee") continue;
      const niveaux = [...new Set(pieces.map((p) => Monde.ZONES[p.zone].niveau))];
      for (const n of niveaux) {
        niveauxFermes.push(n);
        if (n === 0) {
          // la boutique fermée : devanture de bois, rideaux tirés
          a.r(X.pieces0, P(0), X.pieces1 - X.pieces0, 45, "j").r(X.pieces0, P(0), X.pieces1 - X.pieces0, 7, "f").r(X.pieces0, P(0) + 7, X.pieces1 - X.pieces0, 1, "t");
          for (let x = X.pieces0 + 8; x < X.pieces1 - 30; x += 58) {
            a.r(x, P(0) + 11, 50, 26, "0").r(x + 1, P(0) + 12, 48, 24, "o");
            for (let y = P(0) + 13; y < P(0) + 36; y += 3) a.r(x + 1, y, 48, 1, "n");
            a.r(x, P(0) + 37, 50, 6, "f").cadre(x + 4, P(0) + 38, 42, 4, "j", "f");
          }
        } else {
          facade(a, X.pieces0, X.pieces1, Y(n) + 3, 1, { pierre: "4", ombre: "3", graine: 70 + n, volets: "fermes", balcons: n === 2 ? [0] : [] });
          a.r(X.pieces0, Y(n) + 3, X.pieces1 - X.pieces0, 0, "1");
        }
        a.ctx.fillStyle = "rgba(29,42,68,0.30)";
        a.ctx.fillRect(X.pieces0, P(n) - 6, X.pieces1 - X.pieces0, 51);
      }
    }
    if (etat.coworking === "fermee") {
      // rideau de fer baissé
      a.r(X.cowork0, P(0), X.cowork1 - X.cowork0, 45, "2").r(X.cowork0, P(0), X.cowork1 - X.cowork0, 7, "1");
      for (let y = P(0) + 8; y < Y(0) + 3; y += 3) a.r(X.cowork0, y, X.cowork1 - X.cowork0, 1, "3").r(X.cowork0, y + 1, X.cowork1 - X.cowork0, 1, "1");
      a.r(X.cowork0 + 84, Y(0) - 8, 8, 4, "0");
      a.ctx.fillStyle = "rgba(29,42,68,0.30)";
      a.ctx.fillRect(X.cowork0, P(0), X.cowork1 - X.cowork0, 45);
    }
    // aperçu du lieu suivant et pièces à acheter : voile tramé
    for (const p of Monde.PIECES) {
      const e = etat[p.id];
      if (e !== "apercu" && e !== "a-acheter") continue;
      const n = Monde.ZONES[p.zone].niveau;
      const ctx = a.ctx;
      ctx.fillStyle = e === "apercu" ? "rgba(29,42,68,0.50)" : "rgba(43,43,43,0.30)";
      ctx.fillRect(p.x0, P(n), p.x1 - p.x0, 45);
      ctx.fillStyle = e === "apercu" ? "rgba(29,42,68,0.55)" : "rgba(43,43,43,0.35)";
      for (let y = P(n); y < Y(n) + 3; y++) for (let x = p.x0 + ((y & 1) ? 1 : 0); x < p.x1; x += 2) ctx.fillRect(x, y, 1, 1);
      if (e === "a-acheter") {
        // planches en croix sur la porte
        const dx = p.x1 - 8;
        a.r(dx - 6, J(n) - 24, 12, 2, "h").r(dx - 6, J(n) - 14, 12, 2, "h").p(dx - 5, J(n) - 23, "0").p(dx + 4, J(n) - 13, "0");
      }
    }
    // pièces vitrées : reflet et montants
    for (const p of Monde.PIECES) {
      if (!p.vitree || etat[p.id] !== "ouverte") continue;
      const n = Monde.ZONES[p.zone].niveau;
      const ctx = a.ctx;
      ctx.fillStyle = "rgba(196,224,236,0.10)";
      ctx.fillRect(p.x0, P(n), p.x1 - p.x0, 42);
      ctx.fillStyle = "rgba(253,251,247,0.16)";
      for (let i = 0; i < 30; i++) {
        ctx.fillRect(p.x0 + 14 + i, P(n) + 32 - i, 5, 1);
        ctx.fillRect(p.x0 + 26 + i, P(n) + 32 - i, 2, 1);
        ctx.fillRect(p.x1 - 60 + i, P(n) + 32 - i, 3, 1);
      }
      ctx.fillStyle = "rgba(69,64,60,0.55)";
      ctx.fillRect(p.x0, P(n), p.x1 - p.x0, 1);
      for (let x = p.x0 + 42; x < p.x1 - 10; x += 42) ctx.fillRect(x, P(n), 1, 42);
    }

    return { arriere: arriere.c, avant: avant.c, fenetresFacade, haut: HAUT, marge: MARGE, niveauxFermes };
  }

  racine.Immeuble = { construire, HAUT, MARGE, H, L };
})(window);
