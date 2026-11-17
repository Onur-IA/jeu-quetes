"use strict";
// Version 5 : les vibrations, quand l'appareil sait en faire.
// - Android, Chrome : navigator.vibrate, avec un motif par moment.
// - iPhone (Safari 18 et plus) : pas de navigator.vibrate. Safari donne en revanche un petit retour
//   tactile quand on bascule un interrupteur <input type="checkbox" switch>. On en garde un, invisible,
//   et on le bascule au moment voulu. Ça ne marche que pendant un geste du joueur (un toucher) : c'est le cas ici.
// - Ailleurs : rien, sans erreur.
// Coupure : localStorage « jq-haptique » = "0".
(function (racine) {
  const CLE = "jq-haptique";
  const MOTIFS = {
    leger: [8],
    coche: [12],
    reussite: [14, 40, 22],
    combo: [10, 30, 10, 30, 18],
    journee: [20, 60, 20, 60, 40, 80, 60],
    erreur: [40, 50, 40],
  };
  // Nombre de « tocs » de l'interrupteur iPhone pour chaque moment (un toc = une bascule).
  const TOCS = { leger: 1, coche: 1, reussite: 2, combo: 3, journee: 4, erreur: 2 };

  let interrupteur = null;
  let etiquette = null;

  function actif() {
    try {
      return racine.localStorage.getItem(CLE) !== "0";
    } catch (e) {
      return true;
    }
  }

  function activer(oui) {
    try {
      racine.localStorage.setItem(CLE, oui ? "1" : "0");
    } catch (e) {
      // stockage refusé : le réglage ne sera pas gardé, rien de grave
    }
    return actif();
  }

  function preparerInterrupteur() {
    if (etiquette || !racine.document || !racine.document.body) return etiquette;
    etiquette = racine.document.createElement("label");
    etiquette.setAttribute("aria-hidden", "true");
    etiquette.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    interrupteur = racine.document.createElement("input");
    interrupteur.type = "checkbox";
    interrupteur.setAttribute("switch", "");
    interrupteur.tabIndex = -1;
    etiquette.appendChild(interrupteur);
    racine.document.body.appendChild(etiquette);
    return etiquette;
  }

  const sait = () => typeof racine.navigator !== "undefined" && typeof racine.navigator.vibrate === "function";

  function toc(moment) {
    if (!actif()) return false;
    const nom = Object.prototype.hasOwnProperty.call(MOTIFS, moment) ? moment : "leger";
    try {
      if (sait()) return racine.navigator.vibrate(MOTIFS[nom]) !== false;
      const e = preparerInterrupteur();
      if (!e) return false;
      const n = TOCS[nom];
      e.click();
      for (let i = 1; i < n; i++) racine.setTimeout(() => e.click(), i * 70);
      return true;
    } catch (err) {
      return false;
    }
  }

  racine.Haptique = { toc, actif, activer, MOMENTS: Object.keys(MOTIFS) };
})(typeof window !== "undefined" ? window : globalThis);
