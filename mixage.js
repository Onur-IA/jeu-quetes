"use strict";
// Petite fenêtre « Musique et volumes », ouverte par le bouton à côté du bouton son (data-action="mixage").
// Elle règle tout en direct par Son.volume et Son.musique, qui gardent les valeurs dans le navigateur.
// « Tout couper » passe par le bouton son de la barre : la coupure reste le réglage « son » du jeu.
(function (racine) {
  const { Son, Meubles, Police, Palette } = racine;
  const doc = racine.document;
  if (!Son || !doc) return;

  // L'icône du bouton : deux croches, dessinées comme les autres icônes (12 x 12).
  const NOTE = ["............", "....0000000.", "....0000000.", "....0.....0.", "....0.....0.", "....0.....0.", "....0.....0.", "..000...000.", ".0000..0000.", ".0000..0000.", "..00....00..", "............"];
  if (Meubles && Meubles.def) {
    Meubles.def("icone-musique", 12, 12, (g) => g.m(NOTE, 0, 0));
    if (Array.isArray(Meubles.ICONES) && !Meubles.ICONES.includes("musique")) Meubles.ICONES.push("musique");
  }

  let fenetre = null;
  let ancre = null; // le bouton qui a ouvert la fenêtre
  const champs = {};

  function dessin(nom, z) {
    const s = Meubles && Meubles.sprite ? Meubles.sprite(nom, {}) : null;
    if (!s) return null;
    const c = doc.createElement("canvas");
    c.width = s.width;
    c.height = s.height;
    c.getContext("2d").drawImage(s, 0, 0);
    c.style.width = s.width * z + "px";
    c.style.height = s.height * z + "px";
    return c;
  }

  function construire() {
    fenetre = doc.createElement("div");
    fenetre.id = "mixage";
    fenetre.className = "cadre-pixel";
    fenetre.hidden = true;
    fenetre.setAttribute("role", "dialog");
    fenetre.setAttribute("aria-label", "Musique et volumes");
    fenetre.innerHTML =
      '<div class="tete"><span class="titre-pixel" id="mixage-titre"></span>' +
      '<button type="button" class="bouton-icone" data-action="mixage" title="Fermer"><span class="croix">x</span></button></div>' +
      '<div class="corps-mixage">' +
      '<label class="ligne-mixage case-mixage"><input type="checkbox" id="mixage-musique"><span class="pix" id="mixage-icone"></span><span>Musique</span></label>' +
      '<label class="ligne-mixage"><span class="petit"><span>Volume de la musique</span><b id="mixage-valeur-musique"></b></span>' +
      '<input type="range" class="curseur-mixage" id="mixage-volume-musique" min="0" max="100" step="1"></label>' +
      '<label class="ligne-mixage"><span class="petit"><span>Volume des effets</span><b id="mixage-valeur-effets"></b></span>' +
      '<input type="range" class="curseur-mixage" id="mixage-volume-effets" min="0" max="100" step="1"></label>' +
      '<div class="pied-mixage"><button type="button" class="bouton second" id="mixage-couper"></button>' +
      '<button type="button" class="bouton-texte" id="mixage-essai" title="Joue un petit son pour juger du volume">Écouter</button></div>' +
      '<p class="petit" id="mixage-note"></p>' +
      "</div>";
    (doc.getElementById("jeu") || doc.body).appendChild(fenetre);
    for (const cle of ["titre", "musique", "icone", "valeur-musique", "volume-musique", "valeur-effets", "volume-effets", "couper", "essai", "note"]) {
      champs[cle] = doc.getElementById("mixage-" + cle);
    }
    if (Police && Police.element && Palette) champs.titre.replaceChildren(Police.element("Son", 2, Palette.C["6"]));
    else champs.titre.textContent = "Son";
    const note = dessin("icone-musique", 2);
    if (note) champs.icone.replaceChildren(note);

    champs.musique.addEventListener("change", () => Son.musique(champs.musique.checked));
    for (const canal of ["musique", "effets"]) {
      const curseur = champs["volume-" + canal];
      curseur.addEventListener("input", () => Son.volume(canal, Number(curseur.value) / 100));
    }
    // en lâchant le curseur des effets, un petit son donne le niveau
    champs["volume-effets"].addEventListener("change", () => Son.jouer("stat"));
    champs.essai.addEventListener("click", () => Son.jouer("fenetre"));
    champs.couper.addEventListener("click", basculerSon);
  }

  // Coupe ou remet tout le son, comme un clic sur le bouton son de la barre.
  function basculerSon() {
    const avant = Son.actif;
    const bouton = doc.getElementById("bouton-son");
    if (bouton) bouton.click();
    if (Son.actif === avant) Son.activer(!avant); // pas de barre sur cette page : on agit directement
  }

  function maj() {
    if (!fenetre) return;
    const r = Son.reglages();
    champs.musique.checked = r.musique_active;
    for (const canal of ["musique", "effets"]) {
      const pourcent = Math.round(r[canal] * 100);
      const curseur = champs["volume-" + canal];
      if (doc.activeElement !== curseur || Number(curseur.value) !== pourcent) curseur.value = String(pourcent);
      curseur.style.setProperty("--plein", pourcent + "%");
      curseur.setAttribute("aria-valuetext", pourcent + " sur 100");
      champs["valeur-" + canal].textContent = String(pourcent);
    }
    fenetre.classList.toggle("coupe", !r.actif);
    champs.couper.textContent = r.actif ? "Tout couper" : "Remettre le son";
    champs.note.textContent = r.actif ? "Tes réglages sont gardés sur cet appareil." : "Le son est coupé : ni musique ni effets pour l'instant.";
  }

  // Place la fenêtre sous le bouton qui l'ouvre (ou au-dessus s'il est en bas de l'écran), sans sortir de l'écran.
  function placer() {
    if (!fenetre || fenetre.hidden) return;
    const marge = 8;
    const largeur = fenetre.offsetWidth;
    const hauteur = fenetre.offsetHeight;
    const r = ancre && ancre.isConnected ? ancre.getBoundingClientRect() : { left: racine.innerWidth - marge, right: racine.innerWidth - marge, top: 0, bottom: 84 };
    let gauche = r.right - largeur;
    gauche = Math.max(marge, Math.min(gauche, racine.innerWidth - largeur - marge));
    let haut = r.bottom + 10;
    if (haut + hauteur > racine.innerHeight - marge && r.top - hauteur - 10 >= marge) haut = r.top - hauteur - 10;
    haut = Math.max(marge, Math.min(haut, racine.innerHeight - hauteur - marge));
    fenetre.style.left = Math.round(gauche) + "px";
    fenetre.style.top = Math.round(haut) + "px";
  }

  function boutons() {
    return doc.querySelectorAll('[data-action="mixage"][aria-haspopup]');
  }

  function ouvrir(depuis) {
    if (!fenetre) construire();
    ancre = depuis || doc.getElementById("bouton-mixage");
    fenetre.hidden = false;
    for (const b of boutons()) b.setAttribute("aria-expanded", "true");
    maj();
    placer();
    Son.jouer("fenetre");
  }

  function fermer() {
    if (!fenetre || fenetre.hidden) return;
    fenetre.hidden = true;
    for (const b of boutons()) b.setAttribute("aria-expanded", "false");
    Son.jouer("clic");
  }

  const ouverte = () => Boolean(fenetre && !fenetre.hidden);

  // Un curseur qu'on lâche hors de la fenêtre ne doit pas la refermer : on retient où le geste a commencé.
  let gesteDedans = false;
  doc.addEventListener("pointerdown", (ev) => {
    gesteDedans = Boolean(ev.target && ev.target.closest && ev.target.closest("#mixage"));
  }, true);

  doc.addEventListener("click", (ev) => {
    const cible = ev.target && ev.target.closest ? ev.target : null;
    if (!cible) return;
    const bouton = cible.closest('[data-action="mixage"]');
    if (bouton) {
      ev.preventDefault();
      if (ouverte()) fermer();
      else ouvrir(bouton);
      return;
    }
    // un clic ailleurs referme la fenêtre (sauf sur le bouton son, pour entendre le résultat)
    if (ouverte() && !gesteDedans && !cible.closest("#mixage") && !cible.closest('[data-action="son"]')) fermer();
  });

  racine.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape" || !ouverte()) return;
    ev.stopPropagation(); // Échap ne ferme que cette fenêtre, pas le panneau derrière
    fermer();
    if (ancre && ancre.focus) ancre.focus();
  }, true);
  racine.addEventListener("resize", placer);

  Son.ecouter(maj);

  racine.Mixage = {
    ouvrir,
    fermer,
    get ouverte() {
      return ouverte();
    },
  };
})(window);
