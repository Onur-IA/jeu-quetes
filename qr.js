"use strict";
// Version 5 : un petit fabricant de QR codes, sans dépendance, pour ouvrir le jeu sur l'iPhone
// en visant l'écran du Mac avec l'appareil photo. Mode octets (UTF-8), correction M, versions 1 à 10
// (jusqu'à 213 octets : bien assez pour une adresse). Rendu en canvas, pixels nets.
(function (racine) {
  // [total de mots, mots de correction par bloc, blocs du groupe 1, mots par bloc 1, blocs du groupe 2, mots par bloc 2]
  const M = [null,
    [26, 10, 1, 16, 0, 0], [44, 16, 1, 28, 0, 0], [70, 26, 1, 44, 0, 0], [100, 18, 2, 32, 0, 0], [134, 24, 2, 43, 0, 0],
    [172, 16, 4, 27, 0, 0], [196, 18, 4, 31, 0, 0], [242, 22, 2, 38, 2, 39], [292, 22, 3, 36, 2, 37], [346, 26, 4, 43, 1, 44]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  // ------------------------------------------------------------ corps de Galois GF(256)
  const EXP = new Array(512);
  const LOG = new Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

  function generateur(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const suivant = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        suivant[j] ^= g[j];
        suivant[j + 1] ^= mul(g[j], EXP[i]);
      }
      g = suivant;
    }
    return g;
  }
  function correction(donnees, n) {
    const g = generateur(n);
    const reste = donnees.concat(new Array(n).fill(0));
    for (let i = 0; i < donnees.length; i++) {
      const c = reste[i];
      if (c !== 0) for (let j = 0; j < g.length; j++) reste[i + j] ^= mul(g[j], c);
    }
    return reste.slice(donnees.length);
  }

  // ------------------------------------------------------------ données
  function octetsUtf8(texte) {
    if (typeof TextEncoder !== "undefined") return Array.from(new TextEncoder().encode(texte));
    return Array.from(unescape(encodeURIComponent(texte)), (c) => c.charCodeAt(0));
  }
  function capacite(v) {
    const t = M[v];
    return t[2] * t[3] + t[4] * t[5];
  }
  function motsDeDonnees(octets, v) {
    const bits = [];
    const pousser = (valeur, n) => {
      for (let i = n - 1; i >= 0; i--) bits.push((valeur >> i) & 1);
    };
    pousser(4, 4);
    pousser(octets.length, v < 10 ? 8 : 16);
    for (const o of octets) pousser(o, 8);
    const max = capacite(v) * 8;
    for (let i = 0; i < 4 && bits.length < max; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const mots = [];
    for (let i = 0; i < bits.length; i += 8) mots.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    for (let p = 0; mots.length < capacite(v); p++) mots.push(p % 2 ? 0x11 : 0xec);
    return mots;
  }
  function entrelacer(mots, v) {
    const [, ec, b1, n1, b2, n2] = M[v];
    const blocs = [];
    let k = 0;
    for (let i = 0; i < b1 + b2; i++) {
      const n = i < b1 ? n1 : n2;
      const d = mots.slice(k, k + n);
      k += n;
      blocs.push({ d, c: correction(d, ec) });
    }
    const sortie = [];
    for (let i = 0; i < Math.max(n1, n2); i++) for (const b of blocs) if (i < b.d.length) sortie.push(b.d[i]);
    for (let i = 0; i < ec; i++) for (const b of blocs) sortie.push(b.c[i]);
    return sortie;
  }

  // ------------------------------------------------------------ matrice
  function bch(valeur, poly, bitsPoly) {
    let v = valeur << (bitsPoly - 1);
    for (let i = 31; i >= bitsPoly - 1; i--) if ((v >> i) & 1) v ^= poly << (i - (bitsPoly - 1));
    return (valeur << (bitsPoly - 1)) | v;
  }
  const MASQUES = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  function construire(v, flux, masque) {
    const n = 17 + 4 * v;
    const m = Array.from({ length: n }, () => new Array(n).fill(null));
    const fixe = Array.from({ length: n }, () => new Array(n).fill(false));
    const poser = (r, c, val) => {
      if (r < 0 || c < 0 || r >= n || c >= n) return;
      m[r][c] = val;
      fixe[r][c] = true;
    };
    const reperes = (r0, c0) => {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const dedans = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const val = dedans && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        poser(r0 + r, c0 + c, Boolean(val));
      }
    };
    reperes(0, 0);
    reperes(0, n - 7);
    reperes(n - 7, 0);
    for (let i = 8; i < n - 8; i++) {
      poser(6, i, i % 2 === 0);
      poser(i, 6, i % 2 === 0);
    }
    const a = ALIGN[v];
    const dernier = a[a.length - 1];
    for (const r of a) for (const c of a) {
      // pas sur les trois repères de coin ; sur les lignes de synchronisation, si (version 7 et plus)
      if ((r === 6 && c === 6) || (r === 6 && c === dernier) || (r === dernier && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) poser(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
    poser(n - 8, 8, true); // module sombre
    // zones de format (réservées, écrites plus bas)
    for (let i = 0; i < 9; i++) {
      if (!fixe[8][i]) poser(8, i, false);
      if (!fixe[i][8]) poser(i, 8, false);
    }
    for (let i = 0; i < 8; i++) {
      poser(8, n - 1 - i, false);
      poser(n - 1 - i, 8, false);
    }
    if (v >= 7) {
      const info = bch(v, 0x1f25, 13);
      for (let i = 0; i < 18; i++) {
        const bit = Boolean((info >> i) & 1);
        poser(Math.floor(i / 3), n - 11 + (i % 3), bit);
        poser(n - 11 + (i % 3), Math.floor(i / 3), bit);
      }
    }
    // données, en zigzag de deux colonnes, de bas en haut puis de haut en bas
    const bits = [];
    for (const o of flux) for (let i = 7; i >= 0; i--) bits.push((o >> i) & 1);
    let k = 0;
    let monte = true;
    for (let c = n - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      for (let i = 0; i < n; i++) {
        const r = monte ? n - 1 - i : i;
        for (const cc of [c, c - 1]) {
          if (fixe[r][cc]) continue;
          const bit = k < bits.length ? bits[k++] === 1 : false;
          m[r][cc] = MASQUES[masque](r, cc) ? !bit : bit;
        }
      }
      monte = !monte;
    }
    // format : correction M (bits 00), masque ; deux copies (norme ISO 18004, 7.9)
    const format = bch((0 << 3) | masque, 0x537, 11) ^ 0x5412;
    const bit = (i) => Boolean((format >> i) & 1);
    for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
    m[7][8] = bit(6);
    m[8][8] = bit(7);
    m[8][7] = bit(8);
    for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
    for (let i = 0; i < 8; i++) m[8][n - 1 - i] = bit(i);
    for (let i = 8; i < 15; i++) m[n - 15 + i][8] = bit(i);
    m[n - 8][8] = true;
    return m;
  }

  function penalite(m) {
    const n = m.length;
    let p = 0;
    for (let r = 0; r < n; r++) for (const ligne of [true, false]) {
      let suite = 1;
      for (let i = 1; i < n; i++) {
        const a = ligne ? m[r][i] : m[i][r];
        const b = ligne ? m[r][i - 1] : m[i - 1][r];
        if (a === b) {
          suite++;
          if (suite === 5) p += 3;
          else if (suite > 5) p++;
        } else suite = 1;
      }
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r + 1][c] && m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c + 1]) p += 3;
    // motifs qui ressemblent à un repère (1011101 bordé de 0000) : ils trompent les lecteurs
    const motifA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const motifB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let r = 0; r < n; r++) for (let i = 0; i + 11 <= n; i++) for (const ligne of [true, false]) {
      let a = true;
      let b = true;
      for (let k = 0; k < 11 && (a || b); k++) {
        const x = (ligne ? m[r][i + k] : m[i + k][r]) ? 1 : 0;
        if (x !== motifA[k]) a = false;
        if (x !== motifB[k]) b = false;
      }
      if (a) p += 40;
      if (b) p += 40;
    }
    let sombres = 0;
    for (const ligne of m) for (const x of ligne) if (x) sombres++;
    p += Math.floor(Math.abs((sombres * 100) / (n * n) - 50) / 5) * 10;
    return p;
  }

  // La matrice (tableau de lignes de booléens, true = sombre) pour un texte.
  function matrice(texte, masqueImpose) {
    const octets = octetsUtf8(String(texte));
    let v = 1;
    while (v <= 10 && capacite(v) < octets.length + (v < 10 ? 2 : 3)) v++;
    if (v > 10) throw new Error("Texte trop long pour un QR code de version 10.");
    const flux = entrelacer(motsDeDonnees(octets, v), v);
    let meilleure = null;
    let score = Infinity;
    for (let k = 0; k < 8; k++) {
      if (Number.isInteger(masqueImpose) && k !== masqueImpose) continue;
      const m = construire(v, flux, k);
      const s = penalite(m);
      if (s < score) {
        score = s;
        meilleure = m;
      }
    }
    return meilleure;
  }

  // Dessine dans un canvas, avec la marge blanche de quatre modules exigée par les lecteurs.
  function canvas(texte, options) {
    const m = matrice(texte);
    const o = options || {};
    const taille = o.module || 6;
    const marge = 4;
    const c = racine.document.createElement("canvas");
    c.width = c.height = (m.length + marge * 2) * taille;
    const ctx = c.getContext("2d");
    ctx.fillStyle = o.clair || "#FDFBF7";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = o.sombre || "#2B2B2B";
    m.forEach((ligne, r) => ligne.forEach((x, cc) => x && ctx.fillRect((cc + marge) * taille, (r + marge) * taille, taille, taille)));
    return c;
  }

  const QR = { matrice, canvas };
  if (typeof module !== "undefined" && module.exports) module.exports = QR;
  else racine.QR = QR;
})(typeof window !== "undefined" ? window : globalThis);
