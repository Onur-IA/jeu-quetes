"use strict";
// Petite police bitmap dessinée à la main, pour les étiquettes, les bulles et les chiffres.
// Hauteur d'une capitale : 7 pixels. Les accents montent de 2 pixels, les jambages descendent de 2.
(function (racine) {
  // Chaque glyphe : lignes de haut en bas. "#" = pixel plein.
  // Les 7 premières lignes forment le corps. Les lignes 8 et 9 sont les jambages.
  const G = {
    " ": ["..", "..", "..", "..", "..", "..", ".."],
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
    D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    E: ["####", "#...", "#...", "###.", "#...", "#...", "####"],
    F: ["####", "#...", "#...", "###.", "#...", "#...", "#..."],
    G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
    H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
    J: ["..##", "...#", "...#", "...#", "...#", "#..#", ".##."],
    K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    L: ["#...", "#...", "#...", "#...", "#...", "#...", "####"],
    M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
    R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    0: [".##.", "#..#", "#..#", "#..#", "#..#", "#..#", ".##."],
    1: [".#.", "##.", ".#.", ".#.", ".#.", ".#.", "###"],
    2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    3: ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    6: [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
    7: ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
    8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    9: [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
    a: ["....", "....", ".##.", "...#", ".###", "#..#", ".###"],
    b: ["#...", "#...", "###.", "#..#", "#..#", "#..#", "###."],
    c: ["...", "...", ".##", "#..", "#..", "#..", ".##"],
    d: ["...#", "...#", ".###", "#..#", "#..#", "#..#", ".###"],
    e: ["....", "....", ".##.", "#..#", "####", "#...", ".###"],
    f: [".##", "#..", "###", "#..", "#..", "#..", "#.."],
    g: ["....", "....", ".###", "#..#", "#..#", "#..#", ".###", "...#", ".##."],
    h: ["#...", "#...", "###.", "#..#", "#..#", "#..#", "#..#"],
    i: ["#", ".", "#", "#", "#", "#", "#"],
    j: [".#", "..", ".#", ".#", ".#", ".#", ".#", ".#", "#."],
    k: ["#...", "#...", "#..#", "#.#.", "##..", "#.#.", "#..#"],
    l: ["#", "#", "#", "#", "#", "#", "#"],
    m: [".....", ".....", "####.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
    n: ["....", "....", "###.", "#..#", "#..#", "#..#", "#..#"],
    o: ["....", "....", ".##.", "#..#", "#..#", "#..#", ".##."],
    p: ["....", "....", "###.", "#..#", "#..#", "#..#", "###.", "#...", "#..."],
    q: ["....", "....", ".###", "#..#", "#..#", "#..#", ".###", "...#", "...#"],
    r: ["...", "...", "#.#", "##.", "#..", "#..", "#.."],
    s: ["....", "....", ".###", "#...", ".##.", "...#", "###."],
    t: [".#.", ".#.", "###", ".#.", ".#.", ".#.", "..#"],
    u: ["....", "....", "#..#", "#..#", "#..#", "#..#", ".###"],
    v: ["...", "...", "#.#", "#.#", "#.#", "#.#", ".#."],
    w: [".....", ".....", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
    x: ["...", "...", "#.#", "#.#", ".#.", "#.#", "#.#"],
    y: ["....", "....", "#..#", "#..#", "#..#", "#..#", ".###", "...#", ".##."],
    z: ["....", "....", "####", "..#.", ".#..", "#...", "####"],
    ".": [".", ".", ".", ".", ".", ".", "#"],
    ",": ["..", "..", "..", "..", "..", "..", ".#", "#."],
    ":": [".", ".", "#", ".", ".", ".", "#"],
    ";": ["..", "..", ".#", "..", "..", "..", ".#", "#."],
    "!": ["#", "#", "#", "#", "#", ".", "#"],
    "?": [".##.", "#..#", "...#", "..#.", ".#..", "....", ".#.."],
    "'": ["#", "#", ".", ".", ".", ".", "."],
    '"': ["#.#", "#.#", "...", "...", "...", "...", "..."],
    "-": ["...", "...", "...", "###", "...", "...", "..."],
    "+": ["...", "...", ".#.", "###", ".#.", "...", "..."],
    "=": ["...", "...", "###", "...", "###", "...", "..."],
    "/": ["...#", "...#", "..#.", "..#.", ".#..", ".#..", "#..."],
    "(": [".#", "#.", "#.", "#.", "#.", "#.", ".#"],
    ")": ["#.", ".#", ".#", ".#", ".#", ".#", "#."],
    "%": ["#...#", "#..#.", "...#.", "..#..", ".#...", ".#..#", "#...#"],
    "*": ["...", "#.#", ".#.", "#.#", "...", "...", "..."],
    "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
    "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
    ">": ["...", "#..", ".#.", "..#", ".#.", "#..", "..."],
    "<": ["...", "..#", ".#.", "#..", ".#.", "..#", "..."],
    "€": ["..###", ".#...", "####.", ".#...", "####.", ".#...", "..###"],
    "«": [".....", ".....", ".#.#.", "#.#..", ".#.#.", ".....", "....."],
    "»": [".....", ".....", ".#.#.", "..#.#", ".#.#.", ".....", "....."],
    "…": [".....", ".....", ".....", ".....", ".....", ".....", "#.#.#"],
    "·": [".", ".", ".", "#", ".", ".", "."],
    "°": [".#.", "#.#", ".#.", "...", "...", "...", "..."],
    "œ": [".......", ".......", ".##.##.", "#..#..#", "#..####", "#..#...", ".##.###"],
    "Œ": [".######", "#..#...", "#..#...", "#..###.", "#..#...", "#..#...", ".######"],
    "★": ["..#..", "..#..", "#####", ".###.", ".###.", "#...#", "....."],
  };
  G["’"] = G["'"];
  G[" "] = G[" "];
  G[" "] = [".", ".", ".", ".", ".", ".", "."];

  // Accents : deux lignes posées au-dessus de la lettre. La cédille se pose dessous.
  const ACCENTS = {
    aigu: ["..#", ".#."],
    grave: ["#..", ".#."],
    circonflexe: [".#.", "#.#"],
    trema: ["#.#", "..."],
  };
  const COMPOSES = {
    é: ["e", "aigu"], è: ["e", "grave"], ê: ["e", "circonflexe"], ë: ["e", "trema"],
    à: ["a", "grave"], â: ["a", "circonflexe"], ä: ["a", "trema"],
    î: ["i", "circonflexe"], ï: ["i", "trema"],
    ô: ["o", "circonflexe"], ö: ["o", "trema"],
    ù: ["u", "grave"], û: ["u", "circonflexe"], ü: ["u", "trema"],
    ç: ["c", "cedille"],
    É: ["E", "aigu"], È: ["E", "grave"], Ê: ["E", "circonflexe"], Ë: ["E", "trema"],
    À: ["A", "grave"], Â: ["A", "circonflexe"],
    Î: ["I", "circonflexe"], Ï: ["I", "trema"],
    Ô: ["O", "circonflexe"], Ù: ["U", "grave"], Û: ["U", "circonflexe"],
    Ç: ["C", "cedille"],
  };

  const HAUT = 2; // lignes réservées aux accents des capitales
  const CORPS = 7;
  const BAS = 2;
  const HAUTEUR = HAUT + CORPS + BAS;

  // Renvoie { l: largeur, points: [[x, y], ...] } pour un caractère (y = 0 en haut de la ligne).
  const cacheGlyphes = new Map();
  function glyphe(car) {
    if (cacheGlyphes.has(car)) return cacheGlyphes.get(car);
    let base = G[car];
    let accent = null;
    let minuscule = false;
    if (!base && COMPOSES[car]) {
      base = G[COMPOSES[car][0]];
      accent = COMPOSES[car][1];
      minuscule = COMPOSES[car][0] === COMPOSES[car][0].toLowerCase();
      if (COMPOSES[car][0] === "i") base = [".", ".", "#", "#", "#", "#", "#"]; // i sans point sous l'accent
    }
    if (!base) base = G["?"];
    let l = base[0].length;
    const points = [];
    let decalage = 0;
    if (accent && accent !== "cedille" && l < 3) {
      decalage = 1;
      l = 3;
    }
    base.forEach((ligne, y) => {
      for (let x = 0; x < ligne.length; x++) if (ligne[x] === "#") points.push([x + decalage, y + HAUT]);
    });
    if (accent === "cedille") {
      const cx = Math.floor(l / 2);
      points.push([cx, HAUT + 7], [cx - 1, HAUT + 8]);
    } else if (accent) {
      const dessin = ACCENTS[accent];
      const ox = Math.max(0, Math.floor((l - 3) / 2));
      const oy = minuscule ? HAUT : 0; // au-dessus de la hauteur d'x, ou au-dessus de la capitale
      dessin.forEach((ligne, y) => {
        for (let x = 0; x < 3; x++) if (ligne[x] === "#") points.push([ox + x, oy + y - (minuscule ? 0 : 0)]);
      });
    }
    const g = { l, points };
    cacheGlyphes.set(car, g);
    return g;
  }

  function largeur(texte) {
    let l = 0;
    for (const car of String(texte)) l += glyphe(car).l + 1;
    return Math.max(0, l - 1);
  }

  // Coupe un texte en lignes d'au plus `max` pixels de large.
  function couper(texte, max) {
    const lignes = [];
    let courante = "";
    for (const mot of String(texte).split(/\s+/)) {
      const essai = courante ? courante + " " + mot : mot;
      if (courante && largeur(essai) > max) {
        lignes.push(courante);
        courante = mot;
      } else courante = essai;
    }
    if (courante) lignes.push(courante);
    return lignes;
  }

  // Raccourcit avec des points de suspension pour tenir dans `max` pixels.
  function abreger(texte, max) {
    let t = String(texte);
    if (largeur(t) <= max) return t;
    while (t.length > 1 && largeur(t + "…") > max) t = t.slice(0, -1);
    return t.trimEnd() + "…";
  }

  // Dessine dans un contexte 2D. (x, y) = coin haut gauche de la ligne (accents compris).
  function dessiner(ctx, texte, x, y, couleur) {
    ctx.fillStyle = couleur;
    let cx = x;
    for (const car of String(texte)) {
      const g = glyphe(car);
      for (const [px, py] of g.points) ctx.fillRect(cx + px, y + py, 1, 1);
      cx += g.l + 1;
    }
    return cx - 1 - x;
  }

  // Texte rendu une fois dans un petit canevas, avec un contour facultatif. Gardé en cache.
  const cacheTextes = new Map();
  function image(texte, couleur, contour) {
    const cle = texte + "|" + couleur + "|" + (contour || "");
    let c = cacheTextes.get(cle);
    if (c) return c;
    const l = largeur(texte);
    c = document.createElement("canvas");
    c.width = l + 2;
    c.height = HAUTEUR + 2;
    const ctx = c.getContext("2d");
    if (contour) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) dessiner(ctx, texte, 1 + dx, 1 + dy, contour);
    }
    dessiner(ctx, texte, 1, 1, couleur);
    if (cacheTextes.size > 600) cacheTextes.clear();
    cacheTextes.set(cle, c);
    return c;
  }

  // Élément HTML : le texte en pixels, agrandi d'un facteur entier.
  function element(texte, echelle, couleur, contour) {
    const source = image(texte, couleur, contour);
    const c = document.createElement("canvas");
    c.width = source.width;
    c.height = source.height;
    c.getContext("2d").drawImage(source, 0, 0);
    c.style.width = source.width * echelle + "px";
    c.style.height = source.height * echelle + "px";
    c.className = "pixel";
    c.setAttribute("role", "img");
    c.setAttribute("aria-label", texte);
    return c;
  }

  const Police = { HAUTEUR, HAUT, CORPS, largeur, couper, abreger, dessiner, image, element, glyphe };
  if (typeof module !== "undefined" && module.exports) module.exports = Police;
  else racine.Police = Police;
})(typeof window !== "undefined" ? window : globalThis);
