"use strict";
// Le ciel de Paris : dégradé tramé qui suit l'heure, soleil, lune, étoiles, nuages,
// toits et tour en fond avec parallaxe, pluie. Tout est dessiné par le code.
(function (racine) {
  const Palette = racine.Palette;
  const C = Palette.C;

  // Lever et coucher du soleil à Paris, en heure locale, par mois (approximation).
  const SOLEIL = [[8.6, 17.3], [8.0, 18.1], [7.2, 19.0], [7.0, 20.6], [6.2, 21.3], [5.8, 21.9], [6.1, 21.8], [6.8, 21.0], [7.5, 20.0], [8.2, 18.9], [8.0, 17.2], [8.6, 16.9]];

  // Cinq bandes de haut en bas, par moment de la journée.
  const BANDES = {
    nuit: ["n", "n", "n", "o", "o"],
    aube: ["o", "w", "v", "d", "u"],
    matin: ["p", "q", "q", "r", "6"],
    jour: ["p", "p", "q", "q", "r"],
    soir: ["p", "q", "r", "e", "u"],
    coucher: ["o", "w", "v", "x", "t"],
    crepuscule: ["n", "o", "w", "v", "b"],
  };
  // Voile posé sur les bâtiments : [couleur, opacité].
  const VOILES = {
    nuit: [[18, 24, 56], 0.6],
    aube: [[90, 70, 120], 0.26],
    matin: [[255, 230, 190], 0.04],
    jour: [[255, 255, 255], 0],
    soir: [[240, 150, 80], 0.1],
    coucher: [[190, 80, 70], 0.22],
    crepuscule: [[50, 40, 95], 0.42],
  };

  function melange(a, b, k) {
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }
  function css(c) {
    return "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")";
  }

  // État du ciel pour une heure (0 à 24, décimale) et un mois (1 à 12).
  function etat(heure, mois) {
    const [L, S] = SOLEIL[(mois - 1 + 12) % 12];
    const etapes = [
      [0, "nuit"], [L - 1.2, "nuit"], [L - 0.3, "aube"], [L + 0.8, "matin"], [L + 2.2, "jour"],
      [S - 1.7, "jour"], [S - 0.5, "soir"], [S + 0.25, "coucher"], [S + 0.9, "crepuscule"], [S + 1.7, "nuit"], [24, "nuit"],
    ];
    let i = 0;
    while (i < etapes.length - 2 && heure >= etapes[i + 1][0]) i++;
    const [h0, a] = etapes[i];
    const [h1, b] = etapes[i + 1];
    const k = h1 > h0 ? Math.max(0, Math.min(1, (heure - h0) / (h1 - h0))) : 0;
    const bandes = BANDES[a].map((cle, j) => melange(Palette.rvb(cle), Palette.rvb(BANDES[b][j]), k));
    const voile = melange(VOILES[a][0], VOILES[b][0], k);
    const opacite = VOILES[a][1] + (VOILES[b][1] - VOILES[a][1]) * k;
    const jour = heure > L && heure < S;
    const avance = jour ? (heure - L) / (S - L) : heure >= S ? (heure - S) / (24 - S + L) : (heure + 24 - S) / (24 - S + L);
    const nuit = Math.max(0, Math.min(1, (opacite - 0.2) / 0.4));
    return { heure, bandes, voile, opacite, jour, avance, nuit, lever: L, coucher: S, phase: k < 0.5 ? a : b };
  }

  // ------------------------------------------------------------ dégradé tramé
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  let bande = null;
  let cleBande = "";
  function degrade(ctx, l, h, e) {
    const cle = h + "|" + e.bandes.map((c) => css(c)).join("");
    if (cle !== cleBande) {
      bande = document.createElement("canvas");
      bande.width = 4;
      bande.height = h;
      const b = bande.getContext("2d");
      const n = e.bandes.length - 1;
      for (let y = 0; y < h; y++) {
        const t = Math.pow(y / Math.max(1, h - 1), 0.85) * n;
        const i = Math.min(n - 1, Math.floor(t));
        // aplat sur la moitié de la bande, puis transition tramée
        const f = Math.max(0, (t - i - 0.64) / 0.36);
        for (let x = 0; x < 4; x++) {
          b.fillStyle = css((BAYER[y & 3][x] + 0.5) / 16 < f ? e.bandes[i + 1] : e.bandes[i]);
          b.fillRect(x, y, 1, 1);
        }
      }
      cleBande = cle;
    }
    ctx.fillStyle = ctx.createPattern(bande, "repeat-x");
    ctx.fillRect(0, 0, l, h);
  }

  // ------------------------------------------------------------ silhouettes de Paris
  // Profil de toits : pour chaque colonne, la hauteur du toit. Semé une fois.
  function profilToits(largeur, graine, hmin, hmax, cheminees) {
    const alea = Palette.hasard(graine);
    const h = new Array(largeur).fill(0);
    let x = 0;
    while (x < largeur) {
      const l = 18 + Math.floor(alea() * 34);
      const base = hmin + Math.floor(alea() * (hmax - hmin));
      const mansarde = alea() < 0.6;
      for (let i = 0; i < l && x + i < largeur; i++) {
        let y = base;
        if (mansarde) y += Math.min(4, i, l - 1 - i);
        h[x + i] = y;
      }
      if (cheminees) {
        const n = 1 + Math.floor(alea() * 3);
        for (let k = 0; k < n; k++) {
          const cx = x + 3 + Math.floor(alea() * Math.max(1, l - 8));
          const ch = 3 + Math.floor(alea() * 4);
          for (let i = 0; i < 3 && cx + i < largeur; i++) h[cx + i] = Math.max(h[cx + i], base + (mansarde ? 4 : 0) + ch);
          if (cx + 1 < largeur) h[cx + 1] += 1;
        }
      }
      if (alea() < 0.18) {
        // un dôme
        const r = 7 + Math.floor(alea() * 5);
        const cx = x + Math.floor(l / 2);
        for (let i = -r; i <= r; i++) {
          if (cx + i >= 0 && cx + i < largeur) h[cx + i] = Math.max(h[cx + i], base + Math.round(Math.sqrt(r * r - i * i) * 1.1));
        }
        if (cx >= 0 && cx < largeur) h[cx] += 4;
      }
      x += l + (alea() < 0.3 ? 2 : 0);
    }
    return h;
  }
  const LOIN = profilToits(1100, 77, 14, 30, false);
  const PROCHE = profilToits(1100, 1234, 22, 46, true);
  const FENETRES_PROCHES = (function () {
    const alea = Palette.hasard(99);
    const liste = [];
    for (let i = 0; i < 150; i++) liste.push([Math.floor(alea() * 1100), 4 + Math.floor(alea() * 34), alea()]);
    return liste;
  })();

  // La grande tour en fer, au loin : demi-largeur pour chaque ligne, du sommet à la base.
  const TOUR_H = 104;
  function demiLargeurTour(y) {
    if (y < 8) return 0;
    if (y < 14) return 1;
    if (y < 40) return 1 + Math.floor((y - 14) / 13);
    if (y < 44) return 5;
    if (y < 70) return 4 + Math.floor((y - 44) / 5);
    if (y < 74) return 12;
    return 10 + Math.floor((y - 74) / 2.5);
  }
  function tour(ctx, cx, ySol, couleur, e, t) {
    ctx.fillStyle = couleur;
    for (let y = 0; y < TOUR_H; y++) {
      const d = demiLargeurTour(y);
      const yy = ySol - TOUR_H + y;
      if (y >= 80) {
        // l'arche entre les piliers
        const vide = Math.max(0, Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((y - 104) / 24, 2))) * (d - 3)));
        ctx.fillRect(cx - d, yy, d - vide, 1);
        ctx.fillRect(cx + vide + 1, yy, d - vide, 1);
      } else if (y >= 46 && y < 70 && (y % 3 === 0) && d > 5) {
        ctx.fillRect(cx - d, yy, 2, 1);
        ctx.fillRect(cx + d - 1, yy, 2, 1);
        ctx.fillRect(cx - 1, yy, 3, 1);
      } else ctx.fillRect(cx - d, yy, 2 * d + 1, 1);
    }
    if (e.nuit > 0.3) {
      // lumières dorées, et le scintillement au début de chaque heure
      const scintille = e.heure % 1 < 5 / 60;
      const alea = Palette.hasard(5 + (scintille ? Math.floor(t * 8) : 0));
      for (let y = 10; y < TOUR_H; y += 3) {
        const d = demiLargeurTour(y);
        const yy = ySol - TOUR_H + y;
        ctx.fillStyle = Palette.alpha("t", 0.55 * e.nuit);
        ctx.fillRect(cx - d, yy, 1, 1);
        ctx.fillRect(cx + d, yy, 1, 1);
        if (scintille && alea() < 0.5) {
          ctx.fillStyle = C["6"];
          ctx.fillRect(cx - d + Math.floor(alea() * (2 * d + 1)), yy, 1, 1);
        }
      }
      ctx.fillStyle = Palette.alpha("u", 0.9 * e.nuit);
      ctx.fillRect(cx, ySol - TOUR_H + 6, 1, 2);
    }
  }

  function silhouette(ctx, profil, decalage, ySol, l, couleur) {
    ctx.fillStyle = couleur;
    const n = profil.length;
    for (let x = 0; x < l; x++) {
      const h = profil[(((x + decalage) % n) + n) % n];
      ctx.fillRect(x, ySol - h, 1, h + 60);
    }
  }

  // ------------------------------------------------------------ nuages
  const formes = [];
  function formeNuage(i) {
    if (formes[i]) return formes[i];
    const alea = Palette.hasard(300 + i * 17);
    const l = 34 + Math.floor(alea() * 30);
    const h = 12 + Math.floor(alea() * 5);
    const c = document.createElement("canvas");
    c.width = l;
    c.height = h;
    const g = c.getContext("2d");
    const bosses = [];
    const nb = 3 + Math.floor(alea() * 3);
    for (let k = 0; k < nb; k++) bosses.push([6 + alea() * (l - 12), h - 4 - alea() * 3, 4 + alea() * 5]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < l; x++) {
        let dedans = y >= h - 4 && x > 2 && x < l - 3;
        for (const [bx, by, r] of bosses) if ((x - bx) * (x - bx) + (y - by) * (y - by) * 1.4 < r * r) dedans = true;
        if (!dedans) continue;
        g.fillStyle = y >= h - 3 ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,1)";
        g.fillRect(x, y, 1, 1);
        if (y >= h - 3) {
          g.fillStyle = "rgba(255,255,255,0.84)";
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    formes[i] = c;
    return c;
  }

  // Météo du moment, sans rien demander au réseau : tirée de la date et de la tranche de trois heures.
  function meteo(dateISO, heure, forcee) {
    if (forcee === "pluie" || forcee === "soleil" || forcee === "nuages") return forcee;
    const alea = Palette.hasard(Palette.graineDe(dateISO + "|" + Math.floor(heure / 3)));
    const v = alea();
    return v < 0.2 ? "pluie" : v < 0.5 ? "nuages" : "soleil";
  }

  // Saison pour les arbres de la rue.
  function saison(mois) {
    return mois <= 2 || mois === 12 ? "hiver" : mois <= 5 ? "printemps" : mois <= 8 ? "ete" : "automne";
  }

  const ETOILES = (function () {
    const alea = Palette.hasard(4242);
    const liste = [];
    for (let i = 0; i < 90; i++) liste.push([alea(), alea() * 0.75, alea(), alea() < 0.15]);
    return liste;
  })();

  // Dessine tout le fond. cam : { x, y } coin haut gauche de la vue dans le monde. horizon : y du sol dans le monde.
  function dessiner(ctx, l, h, e, t, cam, horizon, temps) {
    degrade(ctx, l, h, e);
    // étoiles
    if (e.nuit > 0.15) {
      for (const [ex, ey, phase, grosse] of ETOILES) {
        const scint = 0.5 + 0.5 * Math.sin(t * (0.6 + phase * 1.8) + phase * 40);
        ctx.fillStyle = "rgba(253,251,247," + (e.nuit * (0.35 + 0.65 * scint)).toFixed(2) + ")";
        const x = Math.floor(ex * l);
        const y = Math.floor(ey * h * 0.8);
        ctx.fillRect(x, y, 1, 1);
        if (grosse && scint > 0.6) {
          ctx.fillRect(x - 1, y, 3, 1);
          ctx.fillRect(x, y - 1, 1, 3);
        }
      }
    }
    // soleil ou lune : un arc d'est en ouest
    const arc = Math.sin(e.avance * Math.PI);
    const ax = Math.round(l * (0.12 + 0.76 * e.avance));
    const ay = Math.round(h * 0.62 - arc * h * 0.5);
    if (e.jour) {
      const chaud = arc < 0.45;
      ctx.fillStyle = Palette.alpha(chaud ? "x" : "u", 0.16);
      disque(ctx, ax, ay, 15);
      ctx.fillStyle = Palette.alpha(chaud ? "t" : "u", 0.3);
      disque(ctx, ax, ay, 11);
      ctx.fillStyle = chaud ? C.t : C.u;
      disque(ctx, ax, ay, 7);
      ctx.fillStyle = chaud ? C.u : C["6"];
      disque(ctx, ax - 1, ay - 1, 4);
    } else {
      ctx.fillStyle = "rgba(253,251,247,0.10)";
      disque(ctx, ax, ay, 13);
      ctx.fillStyle = C["5"];
      disque(ctx, ax, ay, 7);
      ctx.fillStyle = C["6"];
      disque(ctx, ax - 1, ay - 1, 5);
      ctx.fillStyle = css(e.bandes[1]);
      disque(ctx, ax + 4, ay - 3, 6); // croissant
      ctx.fillStyle = C["3"];
      ctx.fillRect(ax - 3, ay + 1, 2, 1);
      ctx.fillRect(ax - 1, ay + 4, 1, 1);
    }
    // nuages
    const couvert = temps === "pluie" ? 9 : temps === "nuages" ? 7 : 3;
    const teinte = melange(melange([255, 255, 255], e.bandes[3], 0.35 + e.nuit * 0.45), [70, 80, 110], temps === "pluie" ? 0.45 : 0);
    for (let i = 0; i < couvert; i++) {
      const f = formeNuage(i);
      const vitesse = 1.2 + (i % 3) * 0.7;
      const etendue = l + 160;
      const x = ((((i * 137 + t * vitesse - cam.x * 0.08) % etendue) + etendue) % etendue) - 80;
      const y = Math.round(h * (0.06 + ((i * 53) % 37) / 100)) - Math.round(cam.y * 0.05);
      nuage(ctx, f, Math.round(x), y, teinte, e.nuit > 0.5 ? 0.5 : 0.92);
    }
    // toits au loin, la tour, puis les toits proches
    const sol = Math.round(horizon - cam.y);
    const loin = melange(e.bandes[3], e.bandes[1], 0.55);
    const yLoin = sol - 62 + Math.round(cam.y * 0.08);
    tour(ctx, Math.round(58 - cam.x * 0.88), yLoin - 6, css(melange(loin, e.bandes[4], 0.25)), e, t);
    silhouette(ctx, LOIN, Math.round(cam.x * 0.15), yLoin, l, css(loin));
    const proche = melange(melange(e.bandes[2], [60, 75, 110], 0.5), [20, 26, 50], e.nuit * 0.55);
    const yProche = sol - 30 + Math.round(cam.y * 0.04);
    const dx = Math.round(cam.x * 0.3);
    silhouette(ctx, PROCHE, dx, yProche, l, css(proche));
    if (e.nuit > 0.25) {
      const n = PROCHE.length;
      for (const [fx, fy, k] of FENETRES_PROCHES) {
        if (k > 0.35 + e.nuit * 0.3) continue;
        const x = (((fx - dx) % n) + n) % n;
        if (x >= l) continue;
        const hauteur = PROCHE[fx % n];
        if (fy > hauteur - 3) continue;
        ctx.fillStyle = Palette.alpha(k < 0.12 ? "t" : "u", 0.75 * e.nuit);
        ctx.fillRect(x, yProche - hauteur + 4 + fy, 1, 2);
      }
    }
  }

  function disque(ctx, cx, cy, r) {
    for (let y = -r; y <= r; y++) {
      const d = Math.floor(Math.sqrt(r * r - y * y));
      ctx.fillRect(cx - d, cy + y, 2 * d + 1, 1);
    }
  }

  // Nuage teinté : une copie par forme, refaite seulement quand la teinte change.
  const teintes = new Map();
  function nuage(ctx, forme, x, y, teinte, opacite) {
    const cle = Math.round(teinte[0] / 4) + "," + Math.round(teinte[1] / 4) + "," + Math.round(teinte[2] / 4);
    let t = teintes.get(forme);
    if (!t || t.cle !== cle) {
      const c = t ? t.c : document.createElement("canvas");
      c.width = forme.width;
      c.height = forme.height;
      const g = c.getContext("2d");
      g.drawImage(forme, 0, 0);
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "rgba(" + Math.round(teinte[0]) + "," + Math.round(teinte[1]) + "," + Math.round(teinte[2]) + ",0.9)";
      g.fillRect(0, 0, forme.width, forme.height - 3);
      g.fillStyle = "rgba(" + Math.round(teinte[0] * 0.82) + "," + Math.round(teinte[1] * 0.84) + "," + Math.round(teinte[2] * 0.9) + ",0.95)";
      g.fillRect(0, forme.height - 3, forme.width, 3);
      g.globalCompositeOperation = "source-over";
      t = { cle, c };
      teintes.set(forme, t);
    }
    ctx.globalAlpha = opacite;
    ctx.drawImage(t.c, x, y);
    ctx.globalAlpha = 1;
  }

  // Pluie : traits obliques. zones : rectangles de la vue où il pleut (dehors).
  function pluie(ctx, l, h, t, force) {
    ctx.fillStyle = "rgba(196,224,236,0.55)";
    const n = Math.floor((l * h) / 900 * force);
    for (let i = 0; i < n; i++) {
      const graine = i * 7919;
      const x = (graine * 13 + Math.floor(t * 60) * 2) % (l + 40);
      const y = (graine * 29 + Math.floor(t * 260) + i * 17) % h;
      ctx.fillRect(x - 20 - Math.floor(y / 8), y, 1, 3);
    }
  }

  racine.Ciel = { etat, dessiner, pluie, meteo, saison, css, melange, SOLEIL };
})(window);
