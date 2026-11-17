"use strict";
// Écrans de la version 3 : première minute, contrat du matin, colis, revue du dimanche,
// assistant de premier lancement, fonctions qui s'ouvrent, réglages.
// Chaque fonction renvoie du HTML. Les clics passent par data-action (voir app.js).
(function (racine) {
  const P = racine.Panneaux;
  const e = P.e;

  // ------------------------------------------------------------ première minute : une seule action
  // etape "ecrire" : une tâche à écrire. etape "cocher" : la faire, puis la cocher.
  function premiere(etat, quete, suggestions) {
    if (quete) {
      return `<div class="carte-premiere cadre-pixel">
        <div class="tete">${P.pixel("Ta première quête", 2, "6")}</div>
        <div class="corps">
          <p>Fais-la pour de vrai. Puis reviens cocher la case.</p>
          <div class="quete-premiere">
            <button type="button" class="case grande" data-action="premiere-fait" data-id="${e(quete.id)}" data-type="${e(quete.genre)}" aria-label="C'est fait : ${e(quete.texte)}"></button>
            <span>${e(quete.texte)}</span>
          </div>
          <p class="petit">En attendant, l'immeuble est à toi : molette pour zoomer, glisse pour te promener, clique sur ce qui t'intrigue. <button type="button" class="lien" data-action="premiere-changer">Changer de tâche</button></p>
        </div>
      </div>`;
    }
    const puces = suggestions.length
      ? `<p class="petit">Ou prends-en une dans ta note :</p><div class="suggestions">${suggestions.map((q) => `<button type="button" class="puce" data-action="premiere-choisir" data-id="${e(q.id)}">${e(q.texte)}</button>`).join("")}</div>`
      : "";
    return `<div class="carte-premiere cadre-pixel">
      <div class="tete">${P.pixel("Bienvenue chez toi", 2, "6")}</div>
      <div class="corps">
        <p>Cet immeuble grandit quand tu avances pour de vrai. Tout commence par une seule chose.</p>
        <form class="ajout" data-formulaire="premiere">
          <input type="text" name="texte" maxlength="160" autocomplete="off" placeholder="Une tâche que tu vas faire aujourd'hui" aria-label="Une tâche que tu vas faire aujourd'hui" autofocus>
          <button type="submit" class="bouton">C'est noté</button>
        </form>
        ${puces}
      </div>
    </div>`;
  }

  // ------------------------------------------------------------ contrat du matin : deux options côte à côte
  function contratMatin(etat) {
    const p = etat.contrat.propositions;
    if (!p) return "";
    const b = etat.contrat.bilan;
    const a = p.ambitieux;
    const liste = (quetes) => quetes.map((q) => `<li>${e(q.texte)}</li>`).join("");
    const bilan = b.surs + b.ambitieux > 0 ? `<p class="petit centre">Jusqu'ici : contrat sûr tenu ${b.surs_tenus} fois sur ${b.surs}, contrat ambitieux tenu ${b.ambitieux_tenus} fois sur ${b.ambitieux}.</p>` : `<p class="petit centre">C'est ton premier contrat. Aucun des deux n'est le bon choix : ça dépend de ta journée.</p>`;
    return `<p class="centre">Deux contrats pour aujourd'hui. Tu n'en signes qu'un, et il ne se change plus.</p>
    <div class="contrats">
      <div class="contrat-carte">
        <div class="bandeau-contrat sur">${P.pixel("Le sûr", 2, "0")}</div>
        <ul>${liste(p.sur.quetes)}</ul>
        <dl>
          <dt>Tu mises</dt><dd>rien</dd>
          <dt>Si tu le tiens</dt><dd><span class="puce points">+${p.sur.gain} points</span></dd>
          <dt>Si tu le rates</dt><dd>rien ne bouge</dd>
        </dl>
        <button type="button" class="bouton second" data-action="signer" data-choix="sur">Je signe le sûr</button>
      </div>
      <div class="contrat-carte">
        <div class="bandeau-contrat ambitieux">${P.pixel("L'ambitieux", 2, "6")}</div>
        <ul>
          <li><span class="puce vente">avant <select id="heure-contrat" aria-label="Heure limite">${a.heures.map((h) => `<option value="${h.valeur}"${h.valeur === a.heure_limite ? " selected" : ""}>${e(h.libelle)}</option>`).join("")}</select></span> ${e(a.vedette.texte)}${a.vedette_vente ? "" : ' <span class="petit">(pas d\'action de vente en vue : ta quête la plus utile)</span>'}</li>
          ${liste(a.quetes)}
        </ul>
        <dl>
          <dt>Tu mises</dt><dd><span class="puce">${a.mise} points</span>${a.mise < a.mise_voulue ? ' <span class="petit">(tout ce que tu as)</span>' : ""}</dd>
          <dt>Si tu le tiens</dt><dd><span class="puce points">+${a.gain} points</span>${a.gain < a.gain_plein ? ` <span class="petit">(au lieu de ${a.gain_plein} : il te manquait ${a.mise_voulue - a.mise} points de mise)</span>` : ""}${a.colis ? ` <span class="puce">${P.sprite("icone-colis", 1)} un colis</span>` : ""}</dd>
          <dt>Si tu le rates</dt><dd>la mise reste sur la table, rien d'autre</dd>
        </dl>
        <button type="button" class="bouton" data-action="signer" data-choix="ambitieux">Je signe l'ambitieux</button>
      </div>
    </div>
    ${bilan}`;
  }

  // ------------------------------------------------------------ colis : la boîte tremble, s'ouvre, l'objet rejoint la collection
  function colis(etat, gain) {
    const o = gain.objet;
    const col = etat.collection;
    const bande = `<div class="bande-collection">${col.map((x) => `<span class="${x.possede ? "eu" : ""}${o && x.id === o.id ? " neuf" : ""}" title="${e(x.nom)}"><span class="pix" data-sprite="${e(x.id)}" data-z="1"${x.possede ? "" : ' data-etat="ombre"'}></span></span>`).join("")}</div>`;
    if (!o) {
      return `<div class="grand">${P.sprite("colis", 6)}</div><p>Tu as déjà toute la collection. Le colis contenait ${gain.points} points.</p>${bande}`;
    }
    return `<div class="grand scene-colis"><span class="boite">${P.sprite("colis", 6)}</span><span class="contenu">${P.sprite(o.id, o.id === "guirlande" || o.id === "fanions" ? 3 : 4)}</span></div>
      <div class="apres-colis"><p><b>${e(o.nom)}</b></p><p>${e(o.phrase)}</p>
      <p class="petit">Collection : ${gain.possedes} sur ${gain.total}. Il est posé près de ton poste.</p>${bande}</div>`;
  }

  // ------------------------------------------------------------ revue de la semaine : trois chiffres, une leçon, une récompense connue
  function dimanche(etat) {
    const d = etat.dimanche;
    const b = d.bilan;
    if (!b) return "";
    const max = Math.max(1, ...b.par_type.map((t) => t.nombre));
    const types = b.par_type
      .map((t) => `<div class="barre-type"><span>${e(t.nom)}</span><i class="type-${t.type}" style="width:${Math.round((t.nombre / max) * 100)}%"></i><b class="chiffres">${t.nombre}</b><span class="petit">${t.mode === "payee" ? "payée" : "racontée"}</span></div>`)
      .join("");
    const lecon = b.lecon.map((l, i) => `<p style="animation-delay:${3 + i * 0.55}s">${e(l)}</p>`).join("");
    return `<div class="revue">
      <p class="centre petit">Semaine ${e(b.semaine.slice(6))}, du ${e(P.dateLongue(b.lundi))} au ${e(P.dateLongue(b.dimanche))}${d.en_retard ? ". Elle t'attendait." : "."}</p>
      <div class="chiffres-revue">
        <div class="tuile" style="animation-delay:0.3s"><b class="chiffres" data-compte="${b.chiffres.quetes}">0</b><span>${b.chiffres.quetes > 1 ? "quêtes faites" : "quête faite"}</span></div>
        <div class="tuile" style="animation-delay:1.1s"><b class="chiffres" data-compte="${b.chiffres.points}">0</b><span>points gagnés</span></div>
        <div class="tuile" style="animation-delay:1.9s"><b class="chiffres" data-compte="${b.chiffres.crans}">0</b><span>crans sur ${b.chiffres.crans_total}, ensemble</span></div>
      </div>
      <div class="types-revue" style="animation-delay:2.6s">${types}</div>
      <div class="lecon"><h3 style="animation-delay:2.8s">Ce que la semaine t'apprend</h3>${lecon}</div>
      <label class="mot" style="animation-delay:${3.2 + b.lecon.length * 0.55}s">Ce que tu retiens, en une phrase (facultatif)
        <input type="text" id="mot-semaine" maxlength="240" autocomplete="off" placeholder="Pour la semaine prochaine, je...">
      </label>
      <p class="centre recompense" style="animation-delay:${3.5 + b.lecon.length * 0.55}s">Récompense connue d'avance : <span class="puce points">+${d.recompense} points</span> et ${P.sprite("icone-fanion", 1)} un fanion de plus sur le toit.</p>
    </div>`;
  }

  // ------------------------------------------------------------ assistant de premier lancement
  function assistant(etat) {
    const c = etat.config;
    const coffre = etat.assistant.coffre_trouve
      ? "J'ai trouvé ta note de semaine : ses lignes sont déjà tes quêtes. Je la lis, je n'y écris jamais."
      : "Tes quêtes vivent dans le fichier data/quetes.md du jeu. Écris-les ici, ou lance /quetes dans Claude Code : il t'en propose, tu valides.";
    return `<form class="assistant" data-formulaire="assistant">
      <p>Première quête faite. Maintenant, dis-moi où tu vas. Rien n'est imposé, et tout se change plus tard dans Réglages.</p>
      <div class="formulaire">
        <label>Ton prénom<input type="text" name="joueur" maxlength="30" autocomplete="off" value="${e(c.joueur)}" placeholder="Facultatif"></label>
        <label>Le nom de ton projet<input type="text" name="enseigne" maxlength="40" autocomplete="off" value="${e(c.enseigne === "Mon enseigne" ? "" : c.enseigne)}" placeholder="Il ira sur le toit"></label>
        <label>Ton objectif par mois<input type="text" name="objectif_mensuel" inputmode="decimal" autocomplete="off" value="${e(String(c.objectif_mensuel))}"></label>
        <label>Ta monnaie<input type="text" name="monnaie" maxlength="12" autocomplete="off" value="${e(c.monnaie)}"></label>
        <p class="petit large">C'est ce que tu veux encaisser sur un mois. Les étages de l'immeuble s'ouvriront à un tiers de cet objectif, à l'objectif, puis au-delà. Chaque seuil reste réglable.</p>
        <label class="large">Le but de ton équipe cette semaine<input type="text" name="but" maxlength="80" autocomplete="off" placeholder="Par exemple : la page de vente en ligne vendredi"></label>
        <fieldset class="large rythme"><legend>Ton rythme de découverte</legend>
          <label><input type="radio" name="rythme" value="pas_a_pas" checked> <span><b>Pas à pas.</b> Une fonction de plus chaque jour de jeu : le contrat demain, puis l'équipe, l'argent, la carte.</span></label>
          <label><input type="radio" name="rythme" value="tout"> <span><b>Tout ouvrir.</b> Toutes les fonctions tout de suite.</span></label>
        </fieldset>
      </div>
      <p class="petit">${e(coffre)}</p>
      <div class="actions"><button type="button" class="bouton second" data-action="assistant-plus-tard">Plus tard</button><button type="submit" class="bouton vert">C'est parti</button></div>
    </form>`;
  }

  // ------------------------------------------------------------ une fonction s'ouvre
  function deblocage(liste) {
    return `<div class="carte-deblocage cadre-pixel">
      <div class="tete">${P.pixel(liste.length > 1 ? "Du nouveau aujourd'hui" : "Nouveau aujourd'hui", 2, "6")}</div>
      <div class="corps">${liste.map((d) => `<p><b>${e(d.nom)}.</b> ${e(d.quoi)} <span class="petit">${e(d.ou)}</span></p>`).join("")}
        <div class="actions"><button type="button" class="bouton" data-action="deblocage-vu">Compris</button></div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------ réglages : tout se change ici
  function champReglage(c) {
    const id = "r-" + c.chemin.replace(/\./g, "-");
    let saisie;
    if (c.type === "bascule") {
      saisie = `<button type="button" id="${id}" class="bascule${c.valeur ? " oui" : ""}" data-action="reglage-bascule" data-chemin="${e(c.chemin)}" data-valeur="${c.valeur ? "non" : "oui"}" aria-pressed="${c.valeur ? "true" : "false"}">${c.valeur ? "Oui" : "Non"}</button>`;
    } else if (c.type === "choix") {
      saisie = `<select id="${id}" data-reglage="${e(c.chemin)}">${c.choix.map((x) => `<option value="${e(x.valeur)}"${String(x.valeur) === String(c.valeur) ? " selected" : ""}>${e(x.libelle)}</option>`).join("")}</select>`;
    } else {
      const sep = c.separateur === ";" ? "; " : ", ";
      const valeur = Array.isArray(c.valeur) ? c.valeur.join(sep) : c.valeur === undefined || c.valeur === null ? "" : String(c.valeur);
      saisie = `<span class="saisie"><input type="text" id="${id}" data-reglage="${e(c.chemin)}" value="${e(valeur)}" autocomplete="off"${c.type === "nombre" || c.type === "entier" ? ' inputmode="decimal" class="court"' : ""}>${c.unite ? `<span class="unite">${e(c.unite)}</span>` : ""}</span>`;
    }
    return `<div class="reglage${c.modifie ? " modifie" : ""}">
      <label for="${id}">${e(c.libelle)}${c.modifie ? ' <span class="puce points">changé</span>' : ""}</label>
      ${saisie}
      ${c.aide ? `<span class="petit aide">${e(c.aide)}</span>` : ""}
      ${c.modifie ? `<button type="button" class="lien" data-action="reglage-defaut" data-chemin="${e(c.chemin)}">revenir à config.json</button>` : ""}
    </div>`;
  }

  function reglages(vue, section, etat) {
    const active = vue.sections.find((s) => s.id === section) || vue.sections[0];
    const pasAPas = etat.fonctions.pas_a_pas;
    return `<div class="ecran-reglages">
      <nav>${vue.sections.map((s) => `<button type="button" class="${s.id === active.id ? "actif" : ""}" data-action="reglages-section" data-section="${s.id}">${e(s.titre)}${s.champs.some((c) => c.modifie) ? ' <i class="point"></i>' : ""}</button>`).join("")}</nav>
      <div class="champs">
        <h3>${e(active.titre)}</h3>
        ${active.aide ? `<p class="petit">${e(active.aide)}</p>` : ""}
        ${active.id === "deblocages" ? `<div class="carte">${pasAPas ? "Tu découvres le jeu pas à pas." : "Toutes les fonctions sont ouvertes."} <button type="button" class="bouton mini" data-action="tout-ouvrir" data-oui="${pasAPas ? "oui" : "non"}">${pasAPas ? "Tout ouvrir maintenant" : "Revenir au pas à pas"}</button></div>` : ""}
        ${active.champs.map(champReglage).join("")}
      </div>
    </div>
    <p class="petit pied-reglages">Chaque changement est enregistré tout de suite dans data/reglages.json, qui passe devant config.json. ${vue.nb_modifies ? `${P.pluriel(vue.nb_modifies, "réglage changé", "réglages changés")}. <button type="button" class="lien" data-action="reglages-tout-defaut">Tout remettre comme dans config.json</button>` : "Rien n'est changé pour l'instant."} <button type="button" class="lien" data-action="assistant">Rouvrir l'assistant</button></p>`;
  }

  racine.V3 = { premiere, contratMatin, colis, dimanche, assistant, deblocage, reglages };
})(window);
