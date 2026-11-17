"use strict";
// Palette du jeu : 31 couleurs, une lettre par couleur pour les cartes de pixels.
// Autour du terracotta, du crème et de l'anthracite, avec des bois chauds,
// des verts de plantes, des bleus de vitre et d'écran.
(function (racine) {
  const COULEURS = {
    0: "#2B2B2B", // anthracite
    1: "#45403C", // gris sombre
    2: "#8A8580", // gris chaud
    3: "#C9C1B4", // pierre à l'ombre
    4: "#E6DCCB", // sable
    5: "#F3EDE2", // crème foncé
    6: "#FDFBF7", // crème
    a: "#8F3D2E", // brique sombre
    b: "#B5523A", // terracotta foncé
    c: "#D96A4E", // terracotta
    d: "#EBA88F", // terracotta clair
    e: "#F6D2B8", // pêche
    f: "#5A3B2A", // bois sombre
    g: "#8B5A3C", // bois moyen
    h: "#B98455", // bois clair
    i: "#DDB07A", // bois blond
    j: "#2F5D45", // vert sombre
    k: "#4E8B5C", // vert
    l: "#8DBB6A", // vert clair
    m: "#B9B27A", // vert fané
    n: "#1D2A44", // nuit
    o: "#33466E", // ardoise sombre
    p: "#5B7FA6", // ardoise
    q: "#8FB8D6", // bleu ciel
    r: "#C4E0EC", // bleu vitre
    s: "#6FD6C8", // lueur d'écran
    t: "#F2C14E", // or
    u: "#FBE7A1", // lumière chaude
    v: "#C55A7B", // rose
    w: "#7A5C9E", // violet
    x: "#E08A3C", // orange
  };

  function rvb(cle) {
    const h = COULEURS[cle];
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }

  // Couleur avec transparence, pour les lumières et les ombres douces.
  function alpha(cle, a) {
    const [r, v, b] = rvb(cle);
    return "rgba(" + r + "," + v + "," + b + "," + a + ")";
  }

  // Générateur pseudo-aléatoire à graine : mêmes détails à chaque rendu.
  function hasard(graine) {
    let s = graine >>> 0 || 1;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function graineDe(texte) {
    let g = 2166136261;
    for (let i = 0; i < texte.length; i++) g = Math.imul(g ^ texte.charCodeAt(i), 16777619) >>> 0;
    return g;
  }

  const Palette = { C: COULEURS, rvb, alpha, hasard, graineDe };
  if (typeof module !== "undefined" && module.exports) module.exports = Palette;
  else racine.Palette = Palette;
})(typeof window !== "undefined" ? window : globalThis);
