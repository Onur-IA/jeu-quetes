"use strict";
// Recherche de chemin A* sur un graphe quelconque. Sert aux agents pour traverser l'immeuble.
// Module partagé : chargé par le navigateur et par les tests Node.
(function (racine) {
  // Tas binaire minimal (file de priorité).
  function Tas() {
    this.t = [];
  }
  Tas.prototype.pousser = function (priorite, valeur) {
    const t = this.t;
    t.push([priorite, valeur]);
    let i = t.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (t[parent][0] <= t[i][0]) break;
      [t[parent], t[i]] = [t[i], t[parent]];
      i = parent;
    }
  };
  Tas.prototype.tirer = function () {
    const t = this.t;
    const tete = t[0];
    const dernier = t.pop();
    if (t.length) {
      t[0] = dernier;
      let i = 0;
      for (;;) {
        const g = 2 * i + 1;
        const d = g + 1;
        let m = i;
        if (g < t.length && t[g][0] < t[m][0]) m = g;
        if (d < t.length && t[d][0] < t[m][0]) m = d;
        if (m === i) break;
        [t[m], t[i]] = [t[i], t[m]];
        i = m;
      }
    }
    return tete ? tete[1] : undefined;
  };

  // options : { depart, arrivee, voisins(noeud) -> [{ noeud, cout, lien }], heuristique(noeud), cle(noeud) }
  // Renvoie la liste des étapes [{ noeud, lien }] du départ à l'arrivée, ou null s'il n'y a pas de chemin.
  function aEtoile(options) {
    const { depart, arrivee, voisins, heuristique, cle } = options;
    const max = options.max || 20000;
    const cleArrivee = cle(arrivee);
    const ouverts = new Tas();
    const couts = new Map([[cle(depart), 0]]);
    const origine = new Map();
    ouverts.pousser(heuristique(depart), depart);
    let visites = 0;
    while (ouverts.t.length) {
      const courant = ouverts.tirer();
      const k = cle(courant);
      if (k === cleArrivee) {
        const etapes = [{ noeud: courant, lien: null }];
        let c = k;
        while (origine.has(c)) {
          const o = origine.get(c);
          etapes[0].lien = o.lien;
          etapes.unshift({ noeud: o.noeud, lien: null });
          c = cle(o.noeud);
        }
        return etapes;
      }
      if (++visites > max) return null;
      const g = couts.get(k);
      for (const v of voisins(courant)) {
        const kv = cle(v.noeud);
        const essai = g + v.cout;
        if (couts.has(kv) && couts.get(kv) <= essai) continue;
        couts.set(kv, essai);
        origine.set(kv, { noeud: courant, lien: v.lien || "marche" });
        ouverts.pousser(essai + heuristique(v.noeud), v.noeud);
      }
    }
    return null;
  }

  const Chemin = { aEtoile };
  if (typeof module !== "undefined" && module.exports) module.exports = Chemin;
  else racine.Chemin = Chemin;
})(typeof window !== "undefined" ? window : globalThis);
