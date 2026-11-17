"use strict";
// Mobilier en pixel art, dessiné par le code : rectangles, cartes de pixels, détails semés.
// Chaque meuble : largeur, hauteur, fonction de dessin. Le bas du sprite pose sur le sol.
(function (racine) {
  const Palette = racine.Palette;
  const C = Palette.C;
  const CATALOGUE = {};
  const cache = new Map();

  // Crayon : petites primitives sur un contexte 2D.
  function crayon(ctx) {
    const g = {
      ctx,
      r(x, y, w, h, c) {
        ctx.fillStyle = C[c];
        ctx.fillRect(x, y, w, h);
        return g;
      },
      p(x, y, c) {
        ctx.fillStyle = C[c];
        ctx.fillRect(x, y, 1, 1);
        return g;
      },
      // Carte de pixels : une lettre de la palette par pixel, "." transparent.
      m(lignes, x, y) {
        for (let j = 0; j < lignes.length; j++) {
          const l = lignes[j];
          for (let i = 0; i < l.length; i++) {
            const k = l[i];
            if (k === "." || k === " ") continue;
            ctx.fillStyle = C[k];
            ctx.fillRect(x + i, y + j, 1, 1);
          }
        }
        return g;
      },
      // Rectangle avec bord d'un pixel.
      cadre(x, y, w, h, fond, bord) {
        g.r(x, y, w, h, bord);
        g.r(x + 1, y + 1, w - 2, h - 2, fond);
        return g;
      },
      // Rangée de livres : dos de couleurs variées, quelques-uns penchés.
      livres(x, y, w, h, graine) {
        const alea = Palette.hasard(graine);
        const teintes = ["c", "b", "p", "o", "k", "j", "t", "v", "w", "5", "x", "a", "q", "d"];
        let cx = x;
        while (cx < x + w) {
          const l = alea() < 0.25 ? 2 : 1;
          const hh = h - Math.floor(alea() * 3);
          const c = teintes[Math.floor(alea() * teintes.length)];
          if (alea() < 0.08) {
            cx += 1;
            continue;
          }
          g.r(cx, y + h - hh, Math.min(l, x + w - cx), hh, c);
          if (hh > 3 && alea() < 0.5) g.p(cx, y + h - hh + 1, "6");
          cx += l;
        }
        return g;
      },
      // Feuillage : amas de pixels en trois verts, dans une ellipse.
      feuilles(cx, cy, rx, ry, graine, fane) {
        const alea = Palette.hasard(graine);
        const tons = fane ? ["m", "m", "h", "k"] : ["k", "k", "l", "j"];
        for (let y = -ry; y <= ry; y++) {
          for (let x = -rx; x <= rx; x++) {
            const d = (x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5);
            if (d > 1.05) continue;
            if (d > 0.7 && alea() < 0.35) continue;
            let c = tons[Math.floor(alea() * tons.length)];
            if (y > ry * 0.3 && alea() < 0.5) c = fane ? "h" : "j";
            if (y < -ry * 0.3 && x < 0 && alea() < 0.4) c = fane ? "m" : "l";
            g.p(cx + x, cy + y, c);
          }
        }
        return g;
      },
      // Pot en terre cuite.
      pot(x, y, w, h, c1, c2) {
        g.r(x, y, w, 2, c1 || "c");
        g.r(x + 1, y + 2, w - 2, h - 2, c2 || "b");
        g.r(x + 1, y + 2, 1, h - 2, c1 || "c");
        return g;
      },
    };
    return g;
  }

  function def(nom, l, h, dessin, options) {
    CATALOGUE[nom] = { nom, l, h, dessin, frames: 1, ...(options || {}) };
  }

  // Renvoie le canevas d'un meuble (image `f`, état facultatif : "fane", "ferme"...).
  function sprite(nom, options) {
    const d = CATALOGUE[nom];
    if (!d) return null;
    const o = options || {};
    const f = d.frames > 1 ? Math.floor(o.f || 0) % d.frames : 0;
    const cle = nom + "|" + f + "|" + (o.etat || "");
    let c = cache.get(cle);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = d.l;
    c.height = d.h;
    d.dessin(crayon(c.getContext("2d")), f, o.etat || "");
    cache.set(cle, c);
    return c;
  }

  // Silhouette d'un meuble (pour l'emplacement d'un objet pas encore acheté).
  function silhouette(nom, couleur) {
    const cle = nom + "|sil|" + couleur;
    let c = cache.get(cle);
    if (c) return c;
    const s = sprite(nom, {});
    c = document.createElement("canvas");
    c.width = s.width;
    c.height = s.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(s, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = couleur;
    ctx.fillRect(0, 0, c.width, c.height);
    cache.set(cle, c);
    return c;
  }

  // ------------------------------------------------------------ postes de travail
  function plateau(g, x, y, w) {
    g.r(x, y, w, 1, "i").r(x, y + 1, w, 1, "h").r(x + 1, y + 2, w - 2, 1, "g");
  }
  function portable(g, x, y, f, versGauche) {
    // écran vu de trois quarts : il brille, les lignes défilent
    g.r(x, y, 9, 7, "1").r(x + 1, y + 1, 7, 5, f % 2 ? "r" : "s");
    g.r(x + 2, y + 2, 3 + (f % 3), 1, "6").r(x + 2, y + 4, 5 - (f % 2), 1, f % 2 ? "s" : "r");
    g.r(versGauche ? x - 3 : x + 1, y + 7, 11, 1, "2");
  }
  function moniteur(g, x, y, f) {
    g.r(x, y, 13, 9, "0").r(x + 1, y + 1, 11, 7, f % 2 ? "o" : "n");
    g.r(x + 2, y + 2, 5 + (f % 3), 1, "s").r(x + 2, y + 4, 8 - (f % 2) * 2, 1, "q").r(x + 2, y + 6, 4 + (f % 2) * 3, 1, "6");
    g.r(x + 5, y + 9, 3, 2, "1").r(x + 3, y + 11, 7, 1, "1");
  }

  def("bureau", 30, 17, (g, f) => {
    plateau(g, 0, 7, 30);
    g.r(1, 10, 2, 7, "g").r(27, 10, 2, 7, "g");
    g.cadre(17, 10, 10, 6, "h", "g").r(20, 12, 4, 1, "f");
    portable(g, 15, 0, f, true);
    g.m(["6d", "66"], 6, 5).p(8, 5, "c"); // tasse
  }, { frames: 4, sieges: [{ dx: 5, dir: 1 }], lumiere: [19, 3, 13, "s"] });

  def("bureau-toi", 36, 20, (g, f) => {
    plateau(g, 0, 10, 36);
    g.r(1, 13, 2, 7, "g").r(33, 13, 2, 7, "g");
    g.cadre(21, 13, 12, 6, "h", "g").r(25, 15, 4, 1, "f");
    moniteur(g, 18, -1, f);
    g.r(13, 9, 5, 1, "2"); // clavier
    g.m([".6", "66"], 8, 8).p(8, 7, "3"); // tasse fumante
    g.m(["cc", "bb", "55"], 30, 7); // carnets empilés
  }, { frames: 4, sieges: [{ dx: 5, dir: 1 }], lumiere: [24, 4, 15, "s"] });

  def("bureau-double", 42, 17, (g, f) => {
    plateau(g, 0, 7, 42);
    g.r(2, 10, 2, 7, "g").r(38, 10, 2, 7, "g").r(4, 14, 34, 1, "g");
    portable(g, 11, 0, f, true);
    portable(g, 22, 0, f + 1, false);
    g.r(20, 3, 2, 4, "2");
  }, { frames: 4, sieges: [{ dx: 3, dir: 1 }, { dx: 39, dir: -1 }], lumiere: [21, 3, 14, "s"] });

  def("pupitre", 20, 15, (g, f) => {
    plateau(g, 0, 6, 20);
    g.r(1, 9, 2, 6, "g").r(17, 9, 2, 6, "g").r(3, 12, 14, 1, "g");
    portable(g, 8, -1, f, true);
  }, { frames: 4, sieges: [{ dx: 2, dir: 1 }], lumiere: [12, 3, 12, "s"] });

  def("chaise", 10, 13, (g) => {
    g.m([
      ".00.......",
      ".0c0......",
      ".0c0......",
      ".0c0......",
      ".0c0......",
      ".0b0......",
      ".00000000.",
      "..bbbbbb0.",
      "..000000..",
      "....00....",
      "....00....",
      ".0000000..",
      ".0.....0..",
    ], 0, 0);
  });

  def("tabouret", 9, 7, (g) => {
    g.r(0, 0, 9, 2, "i").r(0, 2, 9, 1, "g").r(1, 3, 1, 4, "g").r(7, 3, 1, 4, "g").r(2, 5, 5, 1, "f");
  }, { sieges: [{ dx: 4, dir: 1, dy: -1 }] });

  def("coussin", 13, 5, (g) => {
    g.m([".ddddddddddd.", "dccccccccccbb", "dcccdcccccbbb", "bbbbbbbbbbbbb", ".00000000000."], 0, 0);
  }, { sieges: [{ dx: 6, dir: 1, dy: 2 }] });

  def("coussin-bleu", 13, 5, (g) => {
    g.m([".qqqqqqqqqqq.", "qpppppppppoo", "qpppqpppppooo", "ooooooooooooo", ".00000000000."], 0, 0);
  }, { sieges: [{ dx: 6, dir: -1, dy: 2 }] });

  // ------------------------------------------------------------ studio de la chambre
  def("lit", 48, 19, (g) => {
    g.r(0, 0, 3, 19, "g").r(1, 1, 1, 17, "h").r(45, 7, 3, 12, "g"); // tête et pied de lit
    g.r(3, 10, 42, 5, "5").r(3, 15, 42, 2, "3"); // matelas
    g.r(4, 6, 10, 4, "6").r(4, 9, 10, 1, "3").r(5, 7, 2, 1, "5"); // oreiller
    g.r(15, 8, 30, 6, "d").r(15, 8, 30, 1, "e").r(15, 13, 30, 2, "c"); // couverture
    g.r(24, 9, 1, 5, "c").r(34, 9, 1, 5, "c").r(15, 8, 2, 7, "6"); // plis, drap replié
    g.r(4, 17, 2, 2, "f").r(43, 17, 2, 2, "f");
  }, { sieges: [{ dx: 22, dir: 1, dy: -5 }, { dx: 36, dir: -1, dy: -5 }] });

  def("coin-the", 14, 18, (g, f) => {
    plateau(g, 0, 9, 14);
    g.r(1, 12, 1, 6, "g").r(12, 12, 1, 6, "g").r(2, 15, 10, 1, "f");
    g.m([".222.", "22222", "22022", "22222", ".111."], 2, 4).p(7, 6, "2").p(8, 5, "2"); // bouilloire
    g.m(["6c", "66"], 10, 7);
    const v = [[4, 2], [5, 1], [4, 0]][f % 3];
    g.p(v[0], v[1], "6").p(11, 5 - (f % 2), "6");
  }, { frames: 3 });

  def("table-chevet", 10, 10, (g) => {
    g.cadre(0, 2, 10, 8, "h", "g").r(2, 5, 6, 1, "g").p(5, 7, "t");
    g.m(["cc.", "bb5", "555"], 1, -1 + 0).r(6, 0, 3, 2, "p");
  });

  // ------------------------------------------------------------ portes, murs, lampes
  def("porte", 6, 31, (g) => {
    // porte entrouverte, vue par la tranche
    g.r(0, 0, 2, 31, "f").r(2, 1, 4, 30, "g").r(3, 2, 2, 12, "h").r(3, 16, 2, 13, "h").p(4, 15, "t");
  });
  def("porte-vitree", 6, 31, (g) => {
    g.r(0, 0, 2, 31, "1").r(2, 1, 4, 30, "2").r(3, 2, 2, 27, "r").p(3, 4, "6").p(4, 5, "6").p(4, 15, "0");
  });
  def("porte-fermee", 6, 31, (g) => {
    g.r(0, 0, 6, 31, "1").r(1, 1, 4, 29, "2").r(2, 3, 2, 10, "1").r(2, 16, 2, 12, "1").p(4, 15, "0");
  });

  def("suspension", 9, 10, (g) => {
    g.r(4, 0, 1, 4, "0");
    g.m(["...ccc...", "..ccccc..", ".bbbbbbb.", "bbbbbbbbb", "...uuu..."], 0, 4).p(4, 9, "t");
  }, { lumiere: [4, 12, 26, "u"], plafond: true });

  def("suspension-verte", 9, 10, (g) => {
    g.r(4, 0, 1, 4, "0");
    g.m(["...kkk...", "..kkkkk..", ".jjjjjjj.", "jjjjjjjjj", "...uuu..."], 0, 4).p(4, 9, "t");
  }, { lumiere: [4, 12, 26, "u"], plafond: true });

  def("suspension-osier", 11, 11, (g) => {
    g.r(5, 0, 1, 3, "0");
    g.m(["...iiiii...", "..ihihihi..", ".ihihihihi.", "ihihihihihi", "hhhhhhhhhhh", "....uuu...."], 0, 3).p(5, 9, "t");
  }, { lumiere: [5, 13, 28, "u"], plafond: true });

  def("radiateur", 16, 10, (g) => {
    for (let i = 0; i < 7; i++) g.r(1 + i * 2, 1, 1, 8, i % 2 ? "3" : "5");
    g.r(0, 0, 16, 1, "3").r(0, 8, 16, 1, "2").r(1, 9, 1, 1, "2").r(14, 9, 1, 1, "2");
  });

  def("cadre-soleil", 11, 10, (g) => {
    g.cadre(0, 0, 11, 10, "5", "g");
    g.m(["..ccc..", ".ccccc.", ".ccccc.", "..ccc..", "ddddddd", "eeeeeee"], 2, 2);
  }, { pose: "mur" });
  def("cadre-montagne", 13, 10, (g) => {
    g.cadre(0, 0, 13, 10, "r", "f");
    g.m([".....6.....", "....666..p.", "...pppp.ppp", "..pppppppoo", ".kkkkkkkkkk", "kkkjjkkkjjk"], 1, 2).p(9, 2, "u");
  }, { pose: "mur" });
  def("cadre-portrait", 9, 12, (g) => {
    g.cadre(0, 0, 9, 12, "4", "t");
    g.m(["..000..", ".0eee0.", ".0e0e0.", "..eee..", ".ccccc.", "ccccccc"], 1, 3);
  }, { pose: "mur" });

  // Affiche « Mission » : le texte vient de ton intention, lu au clic.
  def("mission", 18, 20, (g) => {
    g.cadre(0, 0, 18, 20, "6", "f").r(1, 1, 16, 1, "5");
    g.m(["....c....", "....c....", ".ccccccc.", "..ccccc..", "..cc.cc..", ".cc...cc."], 4, 3); // étoile du berger
    g.r(3, 11, 12, 1, "1").r(3, 13, 10, 1, "2").r(3, 15, 11, 1, "2").r(3, 17, 6, 1, "c");
  }, { pose: "mur", my: 4 });

  def("etagere-trophees", 36, 22, (g) => {
    g.r(0, 9, 36, 2, "g").r(0, 9, 36, 1, "h").r(0, 20, 36, 2, "g").r(0, 20, 36, 1, "h");
    g.r(2, 11, 1, 2, "f").r(33, 11, 1, 2, "f");
  }, { pose: "mur", my: 4 });

  // Trophées posés sur l'étagère, un par encaissement.
  const TROPHEES = {
    Pro: ["..t..", ".ttt.", "ttttt", ".ttt.", "..x..", ".xxx."],
    Coaching: ["t...t", "ttttt", ".ttt.", "..t..", "..x..", ".xxx."],
    Ateliers: [".c...", ".ccc.", ".cc..", ".0...", ".0...", "000.."],
    Livre: [".....", "bcccc", "bc66c", "bcccc", "bcccc", "b5555"],
    Autre: [".....", ".ttt.", "tutxt", "ttxxt", ".ttt.", "....."],
  };
  function trophee(ctx, source, x, y) {
    crayon(ctx).m(TROPHEES[source] || TROPHEES.Autre, x, y);
  }

  // ------------------------------------------------------------ coworking
  def("comptoir-cafe", 34, 36, (g, f) => {
    // étagère murale et tasses
    g.r(2, 6, 30, 1, "h").r(2, 7, 30, 1, "g");
    g.m(["6.c.6.d", "6.c.6.d"], 4, 4).r(20, 2, 3, 4, "k").r(21, 1, 1, 1, "l").r(26, 3, 4, 3, "t").r(27, 2, 2, 1, "x");
    // comptoir
    g.r(0, 22, 34, 2, "i").r(0, 24, 34, 1, "h").r(1, 25, 32, 11, "g").r(2, 26, 9, 9, "h").r(12, 26, 9, 9, "h").r(22, 26, 10, 9, "h");
    g.p(10, 30, "f").p(13, 30, "f").p(23, 30, "f");
    // machine à café
    g.r(4, 11, 12, 11, "1").r(5, 12, 10, 3, "0").r(6, 13, 2, 1, "c").r(9, 13, 2, 1, f % 2 ? "t" : "x");
    g.r(7, 16, 6, 1, "2").r(9, 17, 2, 1, "2").m(["666", "666"], 8, 19).r(5, 21, 10, 1, "2");
    const v = [[9, 17], [10, 16], [9, 15]][f % 3];
    g.p(v[0] + 4, v[1] - 6, "6").p(v[0] + 5, v[1] - 8, "5");
    // bocal, tasses, corbeille
    g.r(19, 17, 4, 5, "r").r(19, 16, 4, 1, "2").r(20, 19, 2, 2, "f");
    g.m(["6.d", "6.d"], 25, 20).r(29, 19, 3, 3, "x").p(30, 18, "k");
  }, { frames: 3, lumiere: [9, 14, 8, "x"] });

  def("comptoir-cafe-petit", 22, 36, (g, f) => {
    g.r(1, 6, 20, 1, "h").r(1, 7, 20, 1, "g").m(["6.c.6", "6.c.6"], 3, 4).r(13, 2, 3, 4, "k");
    g.r(0, 22, 22, 2, "i").r(0, 24, 22, 1, "h").r(1, 25, 20, 11, "g").r(2, 26, 8, 9, "h").r(11, 26, 9, 9, "h");
    g.r(3, 12, 10, 10, "1").r(4, 13, 8, 3, "0").r(5, 14, 2, 1, "c").r(8, 14, 2, 1, f % 2 ? "t" : "x").m(["666", "666"], 6, 19);
    const v = [[7, 17], [8, 16], [7, 15]][f % 3];
    g.p(v[0], v[1] - 6, "6").p(v[0] + 1, v[1] - 8, "5");
    g.m(["6.d", "6.d"], 15, 20);
  }, { frames: 3, lumiere: [8, 15, 8, "x"] });

  // ------------------------------------------------------------ atelier, bureaux
  def("table-reunion", 52, 14, (g) => {
    plateau(g, 2, 5, 48);
    g.r(8, 8, 3, 6, "g").r(41, 8, 3, 6, "g").r(8, 12, 36, 1, "f");
    g.m(["555", "555"], 14, 3).m(["cc", "bb"], 24, 3).m(["6", "6"], 30, 3).m(["rrr", "rrr"], 36, 3);
  }, { sieges: [{ dx: 1, dir: 1 }, { dx: 51, dir: -1 }] });

  def("ecran-mural", 28, 17, (g, f) => {
    g.cadre(0, 0, 28, 17, "n", "0");
    const h = [4, 6, 5, 8, 7, 10, 9 + (f % 3)];
    h.forEach((v, i) => g.r(3 + i * 3, 14 - v, 2, v, i === 6 ? "c" : "s"));
    g.r(2, 14, 24, 1, "p").r(18, 2, 7, 1, "6");
  }, { frames: 3, pose: "mur", my: 6, lumiere: [14, 8, 16, "s"] });

  def("camera", 14, 25, (g, f) => {
    g.r(2, 0, 9, 7, "0").r(3, 1, 7, 5, "1").r(11, 2, 3, 3, "0").p(13, 3, "r").p(4, 2, f % 2 ? "c" : "a");
    g.r(5, -1 + 1, 3, 1, "2");
    g.r(6, 7, 1, 6, "2");
    g.m(["...2...", "..2.2..", "..2.2..", ".2...2.", ".2...2.", "2.....2", "2.....2", "2.....2", "0.....0", "0.....0", "0.....0", "0.....0"], 3, 13);
  }, { frames: 2 });

  def("projecteur", 14, 30, (g) => {
    g.cadre(0, 0, 12, 12, "u", "0").r(2, 2, 8, 8, "6").r(3, 3, 3, 3, "u");
    g.r(12, 4, 2, 4, "1").r(6, 12, 1, 12, "2");
    g.m(["...2...", "..2.2..", ".2...2.", ".2...2.", "0.....0", "0.....0"], 3, 24);
  }, { lumiere: [6, 6, 22, "u"] });

  def("fond-studio", 32, 37, (g) => {
    g.r(0, 0, 32, 2, "1").r(2, 2, 28, 31, "q").r(2, 2, 2, 31, "r").r(26, 2, 4, 31, "p");
    g.r(0, 33, 32, 4, "q").r(0, 36, 32, 1, "p").r(0, 2, 1, 35, "1").r(31, 2, 1, 35, "1");
  });

  def("micro-studio", 12, 28, (g) => {
    g.r(10, 6, 1, 22, "1").r(7, 27, 5, 1, "0");
    g.m(["....0000000", "...0.......", "..0........"], 0, 4);
    g.r(1, 7, 4, 7, "2").r(1, 7, 4, 1, "3").r(2, 9, 2, 1, "1").r(2, 11, 2, 1, "1").r(2, 14, 2, 2, "1");
    g.m([".0.", "0.0", "0.0", "0.0", ".0."], 5, 8); // filtre anti-pop
  });

  def("console-son", 24, 15, (g, f) => {
    plateau(g, 0, 6, 24);
    g.r(1, 9, 2, 6, "g").r(21, 9, 2, 6, "g");
    g.r(3, 3, 18, 3, "1").r(3, 2, 18, 1, "2");
    for (let i = 0; i < 8; i++) g.p(4 + i * 2, 4, (i + f) % 3 === 0 ? "c" : (i + f) % 3 === 1 ? "t" : "l");
    g.m(["0...0", "00000", "0...0"], 16, -1 + 1); // casque posé
  }, { frames: 3, sieges: [{ dx: 3, dir: 1 }] });

  // ------------------------------------------------------------ maison d'édition
  def("comptoir-librairie", 32, 17, (g) => {
    g.r(0, 4, 32, 2, "i").r(0, 6, 32, 1, "g").r(1, 7, 30, 10, "j").r(2, 8, 28, 8, "k").r(3, 9, 26, 6, "j");
    g.r(6, 10, 20, 1, "t").r(10, 12, 12, 1, "t");
    g.r(20, -1 + 1, 8, 4, "1").r(21, 1, 6, 1, "s").r(22, 3, 4, 1, "t"); // caisse
    g.m(["cc", "bb", "pp", "55"], 4, 0).m(["vv", "tt"], 8, 2);
  });

  def("table-livres", 24, 13, (g) => {
    plateau(g, 0, 5, 24);
    g.r(2, 8, 2, 5, "g").r(20, 8, 2, 5, "g").r(4, 10, 16, 1, "f");
    g.m(["cccc", "5555", "bbbb", "5555"], 2, 1).m(["pppp", "6666", "oooo"], 8, 2).m(["tttt", "5555", "kkkk", "5555", "vvvv"], 14, 0).r(19, 3, 4, 2, "w");
  });

  def("vitrine", 26, 22, (g) => {
    g.cadre(0, 0, 26, 22, "r", "f").r(1, 10, 24, 1, "g").r(1, 20, 24, 1, "g");
    g.m(["cc.pp.tt.kk", "cc.pp.tt.kk", "c6.p6.t6.k6", "cc.pp.tt.kk", "cc.pp.tt.kk"], 3, 4);
    g.m(["vv.55.bb.ww", "vv.55.bb.ww", "v6.5c.b6.w6", "vv.55.bb.ww", "vv.55.bb.ww"], 12, 14).m(["oo", "oo", "o6", "oo", "oo"], 4, 14);
    g.p(2, 2, "6").p(3, 3, "6").p(22, 12, "6");
  });

  function rayonnage(g, l, h, graine, bois) {
    g.r(0, 0, l, h, bois || "f").r(1, 1, l - 2, h - 2, "1");
    const etages = Math.floor((h - 2) / 8);
    const pas = (h - 2) / etages;
    for (let i = 0; i < etages; i++) {
      const y = 1 + Math.round(i * pas);
      const hh = Math.round(pas) - 1;
      g.livres(1, y, l - 2, hh, graine + i * 31);
      g.r(1, y + hh, l - 2, 1, bois === "g" ? "h" : "g");
    }
  }

  def("rayonnage", 30, 36, (g) => rayonnage(g, 30, 36, 11, "f"));
  def("rayonnage-b", 24, 36, (g) => rayonnage(g, 24, 36, 57, "f"));

  def("presse-machine", 44, 28, (g, f) => {
    // bâti en fonte, grande roue, cylindre et feuille qui sort
    g.r(2, 24, 40, 4, "0").r(4, 10, 30, 14, "1").r(5, 11, 28, 1, "2").r(6, 14, 26, 8, "0");
    g.r(8, 15, 22, 2, "2").r(8, 18, 22, 1, "3").r(10, 4, 3, 7, "1").r(26, 4, 3, 7, "1").r(8, 2, 23, 3, "1").r(9, 3, 21, 1, "t");
    const a = f % 4;
    g.m([".0000.", "0....0", "0....0", "0....0", "0....0", ".0000."], 35, 12);
    const rayons = [[[38, 13], [38, 16]], [[36, 13], [39, 16]], [[36, 15], [39, 15]], [[36, 16], [39, 13]]][a];
    for (const [x, y] of rayons) g.p(x, y, "t");
    g.r(37, 14, 2, 2, "c");
    g.r(12 + a * 3, 20, 8, 1, "6").r(0, 21, 5, 1, "6").r(0, 22, 6, 1, "5").r(0, 23, 6, 1, "6");
    g.p(7, 12, a % 2 ? "c" : "t");
  }, { frames: 4 });

  def("table-lecture", 34, 15, (g) => {
    plateau(g, 0, 7, 34);
    g.r(3, 10, 2, 5, "f").r(29, 10, 2, 5, "f").r(5, 12, 24, 1, "f");
    g.m([".kkkkk.", "kkkkkkk", "..ttt..", "...t...", "...t...", "..ttt.."], 13, 1); // lampe verte
    g.m(["55.55", "55555"], 4, 5).m(["cc66", "cccc"], 24, 5);
  }, { sieges: [{ dx: 1, dir: 1 }, { dx: 33, dir: -1 }], lumiere: [16, 6, 14, "u"] });

  // ------------------------------------------------------------ améliorations du studio
  def("lampadaire", 9, 31, (g) => {
    g.m(["..ddd..", ".ddddd.", ".ccccc.", "ccccccc", "ccccccc", "..uuu.."], 1, 0);
    g.r(4, 6, 1, 23, "0").r(2, 29, 5, 1, "0").r(1, 30, 7, 1, "1");
  }, { lumiere: [4, 8, 28, "u"] });

  function plante(g, etat) {
    const fane = etat === "fane";
    g.pot(2, 14, 8, 7);
    g.r(5, 9, 1, 5, fane ? "h" : "j").r(6, 11, 1, 3, fane ? "h" : "j");
    if (fane) {
      g.feuilles(5, 9, 4, 3, 7, true);
      g.m(["m..", "mm.", ".m."], 0, 11).m(["..m", ".mm", ".m."], 9, 10);
    } else {
      g.feuilles(6, 6, 5, 6, 7, false);
      g.p(2, 3, "l").p(10, 2, "l").p(11, 6, "k").p(0, 7, "k");
      // arrosée : elle fleurit le temps du bonus
      if (etat === "fleuri") g.p(3, 2, "v").p(9, 1, "t").p(6, 0, "v").p(10, 5, "6").p(1, 6, "t").p(7, 4, "6");
    }
  }
  def("plante", 12, 21, (g, f, etat) => plante(g, etat));

  def("tapis", 44, 5, (g) => {
    g.m([
      "..cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd..",
      ".bccccc5ccccccc5ccccccc5ccccccc5ccccccc5ccb.",
      "bcc5ccc5c5ccc5c5c5ccc5c5c5ccc5c5c5ccc5c5cccb",
      ".bccccc5ccccccc5ccccccc5ccccccc5ccccccc5ccb.",
      "..bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb..",
    ], 0, 0);
  }, { plat: true });

  def("etagere", 26, 13, (g) => {
    g.livres(1, 2, 17, 8, 23);
    g.r(19, 5, 3, 5, "k").p(20, 4, "l").r(23, 7, 2, 3, "c");
    g.r(0, 10, 26, 1, "h").r(0, 11, 26, 1, "g").r(2, 12, 1, 1, "f").r(23, 12, 1, 1, "f");
  }, { pose: "mur", my: 6 });

  def("micro", 10, 25, (g) => {
    g.m([".222.", "22222", "20202", "22222", "20202", ".222.", ".111.", "..1.."], 3, 0);
    g.m(["0...", ".0..", "..0.", "...0"], 0, 4);
    g.r(5, 8, 1, 15, "0").r(2, 23, 7, 1, "0").r(1, 24, 9, 1, "1").p(5, 12, "2");
  });

  def("fauteuil", 18, 17, (g) => {
    g.m([
      ".bbbbb............",
      "bcccccb...........",
      "bcdccccb..........",
      "bcdccccb..........",
      "bcccccccb.........",
      "bccccccccbbbbb....",
      "bccccccccccccdb...",
      "bcccccccccccccb...",
      "bbbbbbbbbbbbbbbbb.",
      "bcccccccccccccccb.",
      "bcccccccccccccccb.",
      "abbbbbbbbbbbbbbba.",
      ".aaaaaaaaaaaaaaa..",
      ".f.............f..",
      ".f.............f..",
    ], 0, 2);
  }, { sieges: [{ dx: 9, dir: 1, dy: -3, pose: "lit" }] });

  // ------------------------------------------------------------ améliorations du coworking
  def("ficus", 16, 34, (g, f, etat) => {
    const fane = etat === "fane";
    g.pot(4, 26, 9, 8, "5", "3");
    g.r(8, 12, 1, 14, fane ? "h" : "f").p(7, 18, "f").p(9, 15, "f");
    g.feuilles(8, 8, 7, 8, 41, fane);
    if (!fane) g.feuilles(4, 14, 3, 3, 43, false).feuilles(12, 13, 3, 3, 47, false);
    if (etat === "fleuri") g.p(5, 4, "v").p(11, 3, "t").p(8, 1, "v").p(3, 9, "6").p(13, 8, "t").p(9, 11, "v");
  });

  def("casier", 18, 30, (g) => {
    g.r(0, 0, 18, 30, "1");
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++) {
        const toi = i === 1 && j === 1;
        g.r(1 + i * 8, 1 + j * 9, 8, 9, toi ? "b" : "o").r(2 + i * 8, 2 + j * 9, 6, 7, toi ? "c" : "p");
        g.r(3 + i * 8, 3 + j * 9, 4, 1, toi ? "b" : "o").p(7 + i * 8, 6 + j * 9, toi ? "t" : "3");
      }
    }
    g.r(11, 14, 4, 1, "6").r(1, 28, 16, 2, "0");
  });

  def("fontaine", 11, 26, (g, f) => {
    g.m([".rrrrr.", "rr6rrrr", "r6rrrrr", "rrrrrrr", "rrrrrqr", "qqqqqqq", ".qqqqq."], 2, 0);
    g.p(4 + (f % 3), 3 - (f % 2), "6");
    g.r(1, 7, 9, 2, "2").cadre(1, 9, 9, 16, "5", "3").r(3, 12, 2, 1, "c").r(6, 12, 2, 1, "p").r(3, 15, 5, 4, "3").r(2, 25, 7, 1, "2");
  }, { frames: 3 });

  def("objectifs", 24, 17, (g) => {
    g.cadre(0, 0, 24, 17, "i", "g").r(1, 1, 22, 15, "h");
    g.r(3, 3, 8, 5, "6").r(13, 2, 8, 6, "u").r(4, 10, 7, 5, "d").r(14, 10, 7, 4, "6");
    g.p(7, 3, "c").p(17, 2, "c").p(7, 10, "p").p(17, 10, "k");
    g.r(4, 5, 5, 1, "2").r(14, 4, 6, 1, "2").r(14, 6, 4, 1, "2").r(15, 12, 5, 1, "2");
  }, { pose: "mur", my: 7 });

  def("velo", 30, 18, (g) => {
    g.m([
      "...........00.................",
      "..........0...................",
      "....0000..0.........00000.....",
      "...00..000000000000000........",
      "..0....0.c.........c..0.......",
      ".000000..c.........c.000000...",
      "0.....0...c.......c.0......0..",
      "0.....0....c.....c..0......0..",
      "0..2..0.....ccccc...0...2..0..",
      "0.....0......c......0......0..",
      "0.....0.............0......0..",
      ".00000...............000000...",
    ], 0, 3);
    g.r(6, 0, 1, 3, "2").r(22, 0, 1, 3, "2");
  }, { pose: "mur", my: 4 });

  def("cabine", 24, 38, (g, f) => {
    g.r(0, 0, 24, 38, "1").r(1, 1, 22, 3, "c").r(1, 4, 22, 33, "o");
    g.r(3, 6, 18, 24, "r").r(3, 6, 18, 1, "6").r(4, 8, 1, 6, "6").r(6, 7, 1, 3, "6");
    g.r(3, 30, 18, 7, "p").r(11, 6, 1, 31, "1");
    g.r(8, 2, 8, 1, f % 2 ? "u" : "t");
    g.p(19, 20, "t").r(14, 16, 5, 6, "q");
  }, { frames: 2, lumiere: [12, 14, 14, "u"] });

  // ------------------------------------------------------------ améliorations de l'atelier
  def("horloge", 11, 11, (g) => {
    g.m(["...00000...", "..0666660..", ".066666660.", "06666666660", "06666666660", "06666666660", "06666666660", "06666666660", ".066666660.", "..0666660..", "...00000..."], 0, 0);
    g.p(5, 1, "2").p(5, 9, "2").p(1, 5, "2").p(9, 5, "2");
  }, { pose: "mur", my: 5, horloge: true });

  def("tableau-blanc", 34, 21, (g) => {
    g.cadre(0, 0, 34, 19, "6", "2").r(1, 17, 32, 1, "3");
    // une courbe qui monte
    const pts = [[4, 14], [7, 13], [10, 13], [13, 11], [16, 10], [19, 8], [22, 7], [25, 5], [28, 3]];
    for (const [x, y] of pts) g.r(x, y, 3, 1, "c");
    g.r(3, 3, 1, 12, "2").r(3, 15, 27, 1, "2").m(["..c", ".cc", "ccc"], 28, 1 + 0).r(6, 4, 6, 1, "p").r(6, 6, 4, 1, "p");
    g.r(4, 19, 4, 1, "c").r(10, 19, 4, 1, "p").r(24, 19, 6, 2, "5");
  }, { pose: "mur", my: 6 });

  def("table-dessin", 26, 21, (g) => {
    g.m(["......................55", "...................55555", "................5555555i", ".............5555c555ii.", "..........5555555c5ii...", ".......5555c555555ii....", "....5555555cc55ii.......", ".5555555555555i.........", "iiiiiiiiiiiii..........."], 1, 2);
    g.r(8, 11, 2, 10, "g").r(18, 8, 2, 13, "g").r(6, 20, 16, 1, "f").r(10, 15, 8, 1, "f");
    g.r(22, 0, 1, 4, "0").r(20, 0, 3, 1, "0");
  }, { sieges: [{ dx: 1, dir: 1 }] });

  def("canape", 38, 16, (g) => {
    g.m([
      "..pppppppppppppppppppppppppppppppp....",
      ".pqqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqp...",
      ".pqqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqp...",
      ".pqqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqp...",
      "oopqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqpoo..",
      "opppppppppppppppppppppppppppppppppppo.",
      "opqqqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqpo.",
      "opqqqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqpo.",
      "oppppppppppppppppppppppppppppppppppo..",
      "ooooooooooooooooooooooooooooooooooooo.",
      ".nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn..",
      ".f.................................f..",
      ".f.................................f..",
    ], 0, 3);
    g.m(["cccc", "cddc", "cccc", "bbbb"], 4, 4).m(["tttt", "tutt", "xxxx"], 28, 5);
  }, { sieges: [{ dx: 13, dir: 1, dy: -3, pose: "lit" }, { dx: 26, dir: -1, dy: -3, pose: "lit" }] });

  def("bibliotheque", 28, 36, (g) => rayonnage(g, 28, 36, 5, "g"));

  // ------------------------------------------------------------ améliorations des bureaux
  def("jardiniere", 34, 18, (g, f, etat) => {
    const fane = etat === "fane";
    g.r(0, 10, 34, 2, "5").r(1, 12, 32, 5, "4").r(1, 12, 32, 1, "3").r(3, 17, 2, 1, "2").r(29, 17, 2, 1, "2");
    g.feuilles(6, 6, 5, 5, 3, fane).feuilles(17, 5, 5, 6, 9, fane).feuilles(28, 6, 5, 5, 15, fane);
    if (!fane) g.p(16, 1, "v").p(19, 3, "v").p(7, 3, "t");
    if (etat === "fleuri") g.p(4, 2, "v").p(9, 5, "6").p(14, 3, "t").p(21, 2, "6").p(26, 3, "v").p(30, 5, "t").p(28, 1, "t");
  });

  def("banquette", 32, 14, (g) => {
    g.m([
      "cccccccccccccccccccccccccccccccc",
      "cddddddddddddddcdddddddddddddddc",
      "cddddddddddddddcdddddddddddddddc",
      "cddddddddddddddcdddddddddddddddc",
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "bccccccccccccccccccccccccccccccb",
      "bccccccccccccccccccccccccccccccb",
      "abbbbbbbbbbbbbbbbbbbbbbbbbbbbbba",
      ".gggggggggggggggggggggggggggggg.",
      ".g............................g.",
      ".g............................g.",
    ], 0, 3);
  }, { sieges: [{ dx: 10, dir: 1, dy: -3, pose: "lit" }, { dx: 23, dir: -1, dy: -3, pose: "lit" }] });

  def("neon", 32, 12, (g, f) => {
    g.r(0, 0, 32, 12, "n").r(1, 1, 30, 10, "o");
    const c = f % 7 === 3 ? "d" : "c";
    // « IA » en tubes
    g.m(["cc.cccc.", "cc.c..c.", "cc.c..c.", "cc.cccc.", "cc.c..c.", "cc.c..c."], 12, 3);
    if (c === "d") g.r(12, 3, 2, 6, "d");
    g.r(3, 5, 6, 1, "t").r(3, 7, 4, 1, "t").r(23, 5, 6, 1, "t").r(25, 7, 4, 1, "t");
  }, { frames: 7, pose: "mur", my: 5, lumiere: [16, 6, 24, "c"] });

  def("mur-abonnes", 44, 24, (g) => {
    g.cadre(0, 0, 44, 24, "5", "g");
    g.r(2, 2, 16, 1, "1").r(2, 4, 10, 1, "2");
  }, { pose: "mur", my: 5, abonnes: true });

  // ------------------------------------------------------------ améliorations de la maison d'édition
  def("lampe-lecture", 12, 22, (g) => {
    g.m(["..kkkkk..", ".kkkkkkk.", "kkkkkkkkk", "...ttt...", "....t....", "....t....", "...ttt..."], 1, 0);
    g.r(0, 7, 12, 2, "g").r(0, 7, 12, 1, "h").r(1, 9, 1, 13, "f").r(10, 9, 1, 13, "f").r(2, 14, 8, 1, "f").m(["cc5", "bb5"], 3, 12);
  }, { lumiere: [5, 5, 18, "u"] });

  def("collection", 28, 28, (g) => {
    g.r(0, 0, 28, 28, "f").r(1, 1, 26, 26, "g");
    for (let j = 0; j < 3; j++) {
      g.r(1, 8 + j * 9, 26, 1, "f");
      for (let i = 0; i < 4; i++) {
        const c = ["c", "p", "k", "t", "v", "w", "b", "o", "x", "5", "j", "d"][(j * 4 + i) % 12];
        g.r(2 + i * 6 + (i > 1 ? 1 : 0), 2 + j * 9, 5, 6, c).r(3 + i * 6 + (i > 1 ? 1 : 0), 3 + j * 9, 3, 1, "6").p(4 + i * 6 + (i > 1 ? 1 : 0), 6 + j * 9, "6");
      }
    }
  });

  def("grande-bibliotheque", 48, 38, (g) => {
    rayonnage(g, 48, 38, 77, "f");
    // échelle qui roule
    g.r(30, 2, 1, 36, "i").r(36, 6, 1, 32, "i").r(29, 1, 9, 1, "2");
    for (let y = 8; y < 36; y += 5) g.r(31, y, 5, 1, "h");
    g.p(30, 37, "0").p(36, 37, "0");
  });

  // ------------------------------------------------------------ cartons et colis
  def("carton", 10, 9, (g) => {
    g.r(0, 1, 10, 8, "h").r(0, 1, 10, 2, "i").r(4, 1, 2, 3, "5").r(0, 8, 10, 1, "g").r(9, 3, 1, 6, "g").r(2, 5, 3, 1, "g");
  });
  def("cartons", 18, 17, (g) => {
    g.r(0, 8, 10, 9, "h").r(0, 8, 10, 2, "i").r(4, 8, 2, 3, "5").r(0, 16, 10, 1, "g");
    g.r(9, 9, 9, 8, "i").r(9, 9, 9, 2, "h").r(13, 9, 2, 3, "5").r(9, 16, 9, 1, "g");
    g.r(4, 0, 10, 8, "h").r(4, 0, 10, 2, "i").r(8, 0, 2, 3, "5").r(4, 7, 10, 1, "g").r(6, 4, 4, 1, "g");
  });
  def("colis", 12, 11, (g) => {
    g.r(0, 2, 12, 9, "i").r(0, 2, 12, 1, "u").r(0, 10, 12, 1, "h").r(11, 3, 1, 8, "h");
    g.r(5, 2, 2, 9, "c").r(0, 5, 12, 2, "c").r(5, 5, 2, 2, "b");
    g.m([".c..c.", "c.cc.c", ".c..c."], 3, 0);
  });

  const Meubles = { CATALOGUE, def, sprite, silhouette, crayon, trophee, rayonnage };
  racine.Meubles = Meubles;
})(window);
