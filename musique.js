"use strict";
// La musique du jeu : une boucle douce, façon vieille console, fabriquée note par note pendant qu'elle joue.
// Rien n'est enregistré ni recopié : une suite d'accords tirée au sort, une basse, un arpège ou une nappe,
// une petite mélodie pentatonique (un motif qui revient et qui varie) et une batterie légère au bruit filtré.
// Quatre ambiances : jour, nuit, donjon, fete. Le son sort par le bus « musique » de son.js.
(function (racine) {
  const MAJEUR = [0, 2, 4, 5, 7, 9, 11];
  const MINEUR = [0, 2, 3, 5, 7, 8, 10];
  const PENTA_MAJEUR = [0, 2, 4, 7, 9];
  const PENTA_MINEUR = [0, 3, 5, 7, 10];

  // Les progressions sont des degrés de la gamme (0 = tonique), un accord par mesure.
  const AMBIANCES = {
    jour: {
      tempo: 90, mode: MAJEUR, penta: PENTA_MAJEUR, toniques: [0, 2, 5, 7],
      progressions: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 5, 4], [5, 3, 0, 4], [0, 2, 3, 4], [3, 0, 4, 5]],
      balancement: 0.12, densite: 0.5, arpege: "croches", basse: "ronde", batterie: "legere",
      coupureArpege: 1500, coupureMelodie: 2600, formeMelodie: "square", volumeMelodie: 0.062, echo: 0.22,
    },
    nuit: {
      tempo: 84, mode: MINEUR, penta: PENTA_MINEUR, toniques: [9, 4, 2],
      progressions: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [3, 0, 5, 6], [0, 2, 3, 4]],
      balancement: 0, densite: 0.3, arpege: "nappe", basse: "longue", batterie: "feutree",
      coupureArpege: 750, coupureMelodie: 1500, formeMelodie: "triangle", volumeMelodie: 0.1, echo: 0.32,
    },
    donjon: {
      tempo: 88, mode: MINEUR, penta: PENTA_MINEUR, toniques: [2, 4, 11],
      progressions: [[0, 0, 5, 4], [0, 3, 0, 4], [0, 5, 3, 4], [0, 6, 5, 4], [0, 0, 3, 6]],
      balancement: 0, densite: 0.26, arpege: "pulse", basse: "pulsee", batterie: "sourde",
      coupureArpege: 900, coupureMelodie: 1700, formeMelodie: "square", volumeMelodie: 0.05, echo: 0.3,
    },
    fete: {
      tempo: 96, mode: MAJEUR, penta: PENTA_MAJEUR, toniques: [7, 0, 9, 5],
      progressions: [[0, 3, 4, 3], [0, 4, 3, 4], [0, 5, 1, 4], [0, 3, 0, 4], [3, 4, 0, 5]],
      balancement: 0.1, densite: 0.62, arpege: "doubles", basse: "rebond", batterie: "enlevee",
      coupureArpege: 2000, coupureMelodie: 3000, formeMelodie: "square", volumeMelodie: 0.058, echo: 0.18,
    },
    // Version 5 : l'élan du mode express. Plus vive, une basse qui rebondit, une batterie franche.
    // Elle s'étoffe à mesure que la journée avance (voir Musique.intensite).
    elan: {
      tempo: 108, mode: MAJEUR, penta: PENTA_MAJEUR, toniques: [0, 7, 5, 2],
      progressions: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4], [3, 4, 0, 0], [0, 2, 5, 4], [5, 4, 3, 4]],
      balancement: 0.08, densite: 0.56, arpege: "doubles", basse: "rebond", batterie: "enlevee",
      coupureArpege: 2300, coupureMelodie: 3200, formeMelodie: "square", volumeMelodie: 0.056, echo: 0.2,
    },
  };
  const NOMS = Object.keys(AMBIANCES);
  const FONDU = 1.5;
  const AVANCE = 0.25; // on écrit les notes un quart de seconde avant qu'elles sonnent
  const TIC = 50;

  const tirer = (liste) => liste[Math.floor(Math.random() * liste.length)];
  const chance = (p) => Math.random() < p;
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const minuteur = {
    lancer: (f, ms) => (racine.setInterval || setInterval)(f, ms),
    stopper: (id) => (racine.clearInterval || clearInterval)(id),
    plusTard: (f, ms) => (racine.setTimeout || setTimeout)(f, ms),
  };

  let courante = "jour";
  let scene = null; // les nœuds de la musique en cours (un jeu par démarrage ou par ambiance)
  let horloge = null;
  let prochain = 0; // heure (du contexte audio) du prochain pas
  let pas = 0; // double croche dans la mesure, de 0 à 15
  const etat = { tonique: 0, progression: null, mesure: 0, phrase: 0, motif: null, partition: null, couches: null, suiteArpege: null, accord: null, varianteBasse: 0, muette: false };

  // ------------------------------------------------------------ harmonie
  function accordDe(degre) {
    const A = AMBIANCES[courante];
    const ton = (i) => A.mode[(degre + i) % 7] + (degre + i >= 7 ? 12 : 0);
    const racineAccord = (etat.tonique + ton(0)) % 12;
    const intervalles = [0, ton(2) - ton(0), ton(4) - ton(0)];
    const grave = 40 + ((racineAccord + 8) % 12); // basse entre mi grave et ré dièse
    const milieu = 53 + ((racineAccord + 7) % 12); // arpège sous la mélodie, du fa grave au mi du milieu
    return {
      classes: intervalles.map((i) => (racineAccord + i) % 12),
      basse: grave,
      quinte: grave + intervalles[2],
      tons: [milieu, milieu + intervalles[1], milieu + intervalles[2], milieu + 12],
    };
  }

  // L'échelle de la mélodie : toutes les notes pentatoniques sur un peu plus d'une octave et demie (du fa au do aigu).
  function echelle() {
    const A = AMBIANCES[courante];
    const notes = [];
    for (let m = 65; m <= 84; m++) if (A.penta.includes((m - etat.tonique + 120) % 12)) notes.push(m);
    return notes;
  }

  // ------------------------------------------------------------ mélodie : motifs qui reviennent
  // Un motif tient sur deux mesures, en croches (16 cases). Chaque note : case, longueur, saut dans l'échelle.
  function creerMotif(densiteBrute, final) {
    // Version 5 : l'intensité (0 à 1) rend la mélodie plus bavarde, sans jamais la saturer.
    const densite = Math.min(0.9, densiteBrute * (1 + 0.35 * (etat.intensite || 0)));
    const notes = [];
    let c = 0;
    while (c < 16) {
      const fort = c % 4 === 0;
      const p = c === 0 ? 0.9 : fort ? 0.75 : c % 2 === 0 ? densite : densite * 0.55;
      if (chance(p)) {
        const longues = densite > 0.55 ? [1, 1, 2, 2, 3] : [1, 2, 2, 3, 4];
        const longueur = Math.min(16 - c, tirer(fort ? longues : [1, 1, 2, 2, 3]));
        notes.push({ c, longueur, saut: tirer([-2, -2, -1, -1, 0, 1, 1, 2, 2, 3]) });
        c += longueur;
      } else c += 1;
    }
    if (final) {
      // une fin de phrase se pose : on coupe après le milieu de la deuxième mesure et la dernière note s'allonge
      const gardees = notes.filter((n) => n.c < 12);
      const fin = gardees[gardees.length - 1];
      if (fin) {
        fin.longueur = Math.min(6, 16 - fin.c);
        fin.saut = tirer([-1, -1, 0, 1]);
      }
      return gardees;
    }
    return notes;
  }

  function varier(motif) {
    const copie = motif.map((n) => ({ ...n }));
    for (let i = Math.max(0, copie.length - 2); i < copie.length; i++) copie[i].saut = tirer([-2, -1, 1, 2]);
    if (copie.length > 3 && chance(0.4)) copie.splice(1 + Math.floor(Math.random() * (copie.length - 2)), 1);
    return copie;
  }

  // Écrit les huit mesures de mélodie : motif, motif varié, motif, fin.
  function ecrirePartition() {
    const A = AMBIANCES[courante];
    const notes = echelle();
    const partition = Array.from({ length: 8 }, () => ({}));
    const blocs = [etat.motif, varier(etat.motif), etat.motif, creerMotif(A.densite * 0.8, true)];
    const milieu = Math.floor(notes.length / 2);
    blocs.forEach((motif, b) => {
      const depart = accordDe(etat.progression[(b * 2) % 4]);
      let pos = milieu + (b === 1 ? tirer([-1, 1, 2]) : 0);
      pos = poser(notes, pos, depart.classes);
      for (const n of motif) {
        const mesure = b * 2 + Math.floor(n.c / 8);
        const accord = accordDe(etat.progression[mesure % 4]);
        pos = Math.max(0, Math.min(notes.length - 1, pos + n.saut));
        if (n.c % 4 === 0) pos = poser(notes, pos, accord.classes); // temps fort : une note de l'accord
        partition[mesure][(n.c % 8) * 2] = { midi: notes[pos], pas: n.longueur * 2 };
      }
    });
    return partition;
  }

  // Trouve, tout près de pos, une note de l'échelle qui appartient à l'accord.
  function poser(notes, pos, classes) {
    for (const ecart of [0, -1, 1, -2, 2]) {
      const i = pos + ecart;
      if (i >= 0 && i < notes.length && classes.includes(notes[i] % 12)) return i;
    }
    return pos;
  }

  // ------------------------------------------------------------ déroulé : phrases de huit mesures
  function nouvellePhrase(premiere) {
    const A = AMBIANCES[courante];
    if (premiere) {
      etat.phrase = 0;
      etat.tonique = tirer(A.toniques);
      etat.progression = tirer(A.progressions);
      etat.motif = creerMotif(A.densite, false);
    } else {
      etat.phrase++;
      if (chance(0.15)) etat.tonique = tirer(A.toniques);
      if (chance(0.6)) etat.progression = tirer(A.progressions.filter((p) => p !== etat.progression));
      if (chance(0.5)) etat.motif = creerMotif(A.densite, false);
    }
    etat.mesure = 0;
    etat.partition = ecrirePartition();
    // Les couches vont et viennent pour ne pas lasser. La première phrase entre doucement.
    // jamais deux phrases de suite sans mélodie, et toujours une mélodie après l'entrée
    const elan = etat.intensite || 0;
    const melodie = premiere ? "tard" : etat.phrase === 1 || etat.muette ? true : chance(0.75 + 0.2 * elan);
    etat.muette = !melodie;
    const arpege = premiere || !melodie ? true : chance(0.85);
    etat.couches = { melodie, arpege, batterie: premiere ? false : chance(Math.min(0.97, (A.batterie === "feutree" ? 0.5 : 0.7) + 0.3 * elan)) };
    etat.suiteArpege = tirer([[0, 1, 2, 1, 0, 1, 2, 1], [0, 2, 1, 2, 0, 2, 1, 2], [2, 1, 0, 1, 2, 1, 0, 1], [0, 1, 2, 3, 2, 1, 2, 1]]);
  }

  function preparer(nom) {
    courante = nom;
    pas = 0;
    nouvellePhrase(true);
  }

  // ------------------------------------------------------------ instruments
  // Note pincée (attaque vive, chute) ou tenue (monte doucement, reste, redescend).
  function note(vers, forme, midi, t, duree, volume, tenue) {
    const c = scene.contexte;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = forme;
    osc.frequency.setValueAtTime(hz(midi), t);
    g.gain.setValueAtTime(0, t);
    if (tenue) {
      const monte = Math.min(0.35, duree * 0.3);
      g.gain.linearRampToValueAtTime(volume, t + monte);
      g.gain.setValueAtTime(volume, t + duree * 0.7);
      g.gain.linearRampToValueAtTime(0, t + duree);
    } else {
      g.gain.linearRampToValueAtTime(volume, t + 0.012);
      g.gain.exponentialRampToValueAtTime(volume * 0.5, t + duree * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0006, t + duree);
    }
    osc.connect(g);
    g.connect(vers);
    osc.start(t);
    osc.stop(t + duree + 0.03);
  }

  function grosseCaisse(t, volume) {
    const c = scene.contexte;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(108, t);
    osc.frequency.exponentialRampToValueAtTime(46, t + 0.09);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.17);
    osc.connect(g);
    g.connect(scene.sortie);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Un coup de bruit filtré : vers le filtre « caisse » (médium) ou « chapeau » (aigu).
  function frappe(vers, t, duree, volume) {
    const c = scene.contexte;
    if (!scene.bruit || !c.createBufferSource) return;
    const src = c.createBufferSource();
    const g = c.createGain();
    src.buffer = scene.bruit;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0005, t + duree);
    src.connect(g);
    g.connect(vers);
    src.start(t, Math.random() * 0.8);
    src.stop(t + duree + 0.02);
  }

  // ------------------------------------------------------------ un pas (une double croche)
  function programmer(p, t0) {
    const A = AMBIANCES[courante];
    const d = 60 / A.tempo / 4;
    if (p === 0) {
      etat.accord = accordDe(etat.progression[etat.mesure % 4]);
      etat.varianteBasse = chance(0.35) ? 1 : 0;
    }
    const acc = etat.accord;
    const derniere = etat.mesure === 7;
    // léger balancement : les croches à contretemps arrivent un rien en retard
    const t = t0 + (p % 4 === 2 ? A.balancement * d : p % 2 === 1 ? A.balancement * 0.5 * d : 0);

    // --- basse (triangle)
    const B = (midi, longueur, force) => note(scene.sortie, "triangle", midi, t, longueur * d, 0.2 * force);
    if (A.basse === "ronde") {
      if (etat.varianteBasse) {
        if (p === 0) B(acc.basse, 6, 1);
        else if (p === 8) B(acc.basse, 2, 0.85);
        else if (p === 10) B(acc.quinte, 2, 0.7);
        else if (p === 12) B(acc.basse + 12, 3, 0.65);
      } else if (p === 0) B(acc.basse, 5, 1);
      else if (p === 6) B(acc.quinte, 2, 0.7);
      else if (p === 8) B(acc.basse, 4, 0.9);
      else if (p === 14) B(acc.quinte, 2, 0.65);
    } else if (A.basse === "longue") {
      if (p === 0) B(acc.basse, 10, 0.95);
      else if (p === 10 && etat.varianteBasse) B(acc.quinte, 5, 0.6);
    } else if (A.basse === "pulsee") {
      if (p % 2 === 0) B(derniere && p >= 12 ? acc.basse - 2 : acc.basse, 1.6, p % 8 === 0 ? 1 : 0.62);
    } else if (p % 2 === 0) {
      B(p === 12 ? acc.quinte : p % 4 === 0 ? acc.basse : acc.basse + 12, 1.7, p % 4 === 0 ? 0.95 : 0.6);
    }

    // --- arpège ou nappe (onde carrée douce, filtrée passe-bas)
    if (etat.couches.arpege) {
      const N = (midi, longueur, volume, tenue) => note(scene.filtreArpege, "square", midi, t, longueur * d, volume, tenue);
      if (A.arpege === "croches") {
        if (p % 2 === 0) N(acc.tons[etat.suiteArpege[p / 2]], 2.4, 0.034);
      } else if (A.arpege === "nappe") {
        if (p === 0) for (const m of acc.tons.slice(0, 3)) N(m, 15.5, 0.024, true);
        if ((p === 6 || p === 14) && chance(0.35)) note(scene.sortie, "sine", tirer(acc.tons) + 12, t, 4 * d, 0.022);
      } else if (A.arpege === "pulse") {
        if ([0, 3, 6, 8, 11, 14].includes(p)) N(p % 2 === 0 ? acc.tons[0] : acc.tons[2] - 12, 1.3, 0.04);
      } else {
        N(acc.tons[[0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3][p]], 1.4, p % 4 === 0 ? 0.03 : 0.022);
      }
    }

    // --- mélodie pentatonique
    const joueMelodie = etat.couches.melodie === "tard" ? etat.mesure >= 4 : etat.couches.melodie;
    const n = joueMelodie ? etat.partition[etat.mesure][p] : null;
    if (n) note(scene.entreeMelodie, A.formeMelodie, n.midi, t, Math.max(1.6, n.pas * 0.92) * d, A.volumeMelodie);

    // --- batterie douce (bruit filtré)
    if (etat.couches.batterie) {
      const K = (v) => grosseCaisse(t, 0.2 * v);
      const C = (v, long) => frappe(scene.filtreCaisse, t, long || 0.09, 0.055 * v);
      const H = (v) => frappe(scene.filtreChapeau, t, 0.035, 0.02 * v);
      if (A.batterie === "legere") {
        if (p === 0 || p === 8 || (p === 11 && etat.varianteBasse)) K(p === 0 ? 1 : 0.8);
        if (p === 4 || p === 12) C(1);
        if (derniere && p >= 14) C(0.6, 0.05);
        if (p % 2 === 0) H(p % 4 === 2 ? 1.1 : 0.7);
      } else if (A.batterie === "feutree") {
        if (p === 0 || (p === 10 && etat.varianteBasse)) K(0.7);
        if (p === 8) C(0.5, 0.04);
        if (p === 4 || p === 12) H(0.6);
      } else if (A.batterie === "sourde") {
        if (p === 0 || p === 3 || p === 8 || (p === 11 && etat.varianteBasse)) K(p === 3 ? 0.6 : 0.95);
        if (p === 12) C(0.7);
        if (p % 4 === 2) H(0.6);
      } else {
        if (p % 4 === 0) K(p === 0 ? 1 : 0.8);
        if (p === 4 || p === 12) C(1);
        if (derniere && p >= 13) C(0.55, 0.05);
        if (p % 4 === 2) H(1.2);
        else if (p === 15 || p === 7) H(0.6);
      }
    }
  }

  function avancer() {
    prochain += 60 / AMBIANCES[courante].tempo / 4;
    pas++;
    if (pas < 16) return;
    pas = 0;
    etat.mesure++;
    if (etat.mesure >= 8) nouvellePhrase(false);
  }

  function tic() {
    if (!scene) return;
    const maintenant = scene.contexte.currentTime;
    if (prochain < maintenant - 0.2) prochain = maintenant + 0.05; // onglet ralenti : on repart d'ici
    let garde = 0;
    while (prochain < maintenant + AVANCE && garde++ < 24) {
      programmer(pas, prochain);
      avancer();
    }
  }

  // ------------------------------------------------------------ scène : les nœuds d'une ambiance
  function creerScene(audio, fondu, delai) {
    const A = AMBIANCES[courante];
    const c = audio.contexte;
    const t = c.currentTime + delai;
    const s = { contexte: c, bruit: audio.bruit, noeuds: [] };
    const gain = (v) => {
      const g = c.createGain();
      g.gain.value = v;
      s.noeuds.push(g);
      return g;
    };
    const filtre = (type, f, q) => {
      const b = c.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q || 0.7;
      s.noeuds.push(b);
      return b;
    };
    s.sortie = gain(0);
    s.sortie.gain.setValueAtTime(0, t);
    s.sortie.gain.linearRampToValueAtTime(1, t + fondu);
    s.sortie.connect(audio.sortie);
    s.filtreArpege = filtre("lowpass", A.coupureArpege);
    s.filtreArpege.connect(s.sortie);
    s.entreeMelodie = filtre("lowpass", A.coupureMelodie);
    s.entreeMelodie.connect(s.sortie);
    if (c.createDelay) {
      // un écho léger derrière la mélodie (trois doubles croches plus tard)
      const echo = c.createDelay(1);
      echo.delayTime.value = (60 / A.tempo / 4) * 3;
      const retour = gain(0.28);
      const humide = gain(A.echo);
      s.noeuds.push(echo);
      s.entreeMelodie.connect(echo);
      echo.connect(retour);
      retour.connect(echo);
      echo.connect(humide);
      humide.connect(s.sortie);
    }
    s.filtreCaisse = filtre("bandpass", 1700, 0.9);
    s.filtreCaisse.connect(s.sortie);
    s.filtreChapeau = filtre("highpass", 7500);
    s.filtreChapeau.connect(s.sortie);
    return s;
  }

  // Fait taire une scène en douceur, puis la débranche.
  function fondre(s, duree) {
    if (!s) return;
    const p = s.sortie.gain;
    const t = s.contexte.currentTime;
    if (p.cancelScheduledValues) p.cancelScheduledValues(t);
    p.setTargetAtTime(0, t, duree / 4);
    minuteur.plusTard(() => {
      for (const n of s.noeuds) {
        try {
          n.disconnect();
        } catch {
          // déjà débranché
        }
      }
    }, duree * 1000 + 400);
  }

  // ------------------------------------------------------------ commandes (appelées par son.js)
  function demarrer() {
    if (horloge) return true;
    const audio = racine.Son && racine.Son._audio();
    if (!audio) return false;
    if (!etat.progression) preparer(courante);
    pas = 0; // on reprend au début de la mesure en cours
    scene = creerScene(audio, FONDU, 0.05);
    prochain = audio.contexte.currentTime + 0.1;
    horloge = minuteur.lancer(tic, TIC);
    tic();
    return true;
  }

  function arreter(duree) {
    if (!horloge) return;
    minuteur.stopper(horloge);
    horloge = null;
    fondre(scene, duree || FONDU);
    scene = null;
  }

  function ambiance(nom) {
    if (!Object.prototype.hasOwnProperty.call(AMBIANCES, nom)) return false;
    if (nom === courante && etat.progression) return true;
    preparer(nom);
    if (horloge && scene) {
      // fondu d'une seconde et demie : l'ancienne ambiance s'efface, la nouvelle entre
      const audio = racine.Son && racine.Son._audio();
      fondre(scene, FONDU * 0.5);
      if (!audio) {
        arreter(0.1);
        return true;
      }
      scene = creerScene(audio, FONDU * 0.6, FONDU * 0.4);
      prochain = audio.contexte.currentTime + FONDU * 0.4 + 0.05;
    }
    return true;
  }

  racine.Musique = {
    AMBIANCES: NOMS,
    demarrer,
    arreter,
    ambiance,
    get ambianceCourante() {
      return courante;
    },
    get joue() {
      return Boolean(horloge);
    },
    // Version 5 : 0 au calme, 1 quand la journée est presque bouclée. Prend effet à la phrase suivante.
    intensite(v) {
      const n = Number(v);
      if (Number.isFinite(n)) etat.intensite = Math.max(0, Math.min(1, n));
      return etat.intensite || 0;
    },
    // Pour les tests et les curieux : tempo et mode de chaque ambiance.
    fiche(nom) {
      const A = AMBIANCES[nom];
      return A ? { tempo: A.tempo, mineur: A.mode === MINEUR, progressions: A.progressions.length } : null;
    },
  };
})(window);
