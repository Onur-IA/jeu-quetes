"use strict";
// Le son du jeu, fabriqué dans le navigateur (WebAudio) : aucun fichier audio, tout est calculé.
// - Un bus de mixage : effets et musique passent chacun par leur gain, puis par un gain maître.
// - Rien ne démarre avant un premier geste du joueur : aucun AudioContext n'existe avant.
// - La coupure globale suit le réglage « son » du serveur (Son.activer). Les volumes et la case
//   « Musique » sont gardés dans le navigateur (localStorage, clé jq-son).
// La musique elle-même est dans musique.js ; ce fichier lui fournit le contexte et le bus.
(function (racine) {
  const CLE = "jq-son";
  const DEFAUT = { musique: 0.35, effets: 0.8, musique_active: true };
  const GESTES = ["pointerdown", "keydown", "touchstart", "pointerup", "touchend", "click"];

  const borne = (v, repli) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : repli;
  };

  // ------------------------------------------------------------ réglages mémorisés
  function lire() {
    const r = { ...DEFAUT };
    try {
      const brut = racine.localStorage && racine.localStorage.getItem(CLE);
      const lu = brut ? JSON.parse(brut) : null;
      if (lu && typeof lu === "object") {
        r.musique = borne(lu.musique, DEFAUT.musique);
        r.effets = borne(lu.effets, DEFAUT.effets);
        if (typeof lu.musique_active === "boolean") r.musique_active = lu.musique_active;
      }
    } catch {
      // stockage refusé ou contenu illisible : on garde les valeurs par défaut
    }
    return r;
  }

  function ecrire() {
    try {
      if (racine.localStorage) racine.localStorage.setItem(CLE, JSON.stringify(reglages));
    } catch {
      // stockage plein ou refusé (navigation privée) : le réglage vaut pour cette visite
    }
  }

  const reglages = lire();
  let contexte = null;
  let actif = false;
  let geste = false; // le navigateur exige un premier geste du joueur avant tout son
  let maitre = null;
  let busEffets = null;
  let busMusique = null;
  let tamponBruit = null;
  let veille = null; // minuterie qui endort le contexte une fois le son coupé
  const ecouteurs = [];
  const dernier = {}; // heure du dernier départ de chaque effet (anti-doublon)

  // Le curseur va de 0 à 1 ; l'oreille préfère une courbe. 0,8 redonne le niveau d'origine des effets.
  const gainEffets = () => reglages.effets * reglages.effets * 1.5625;
  const gainMusique = () => reglages.musique * reglages.musique * 1.6;

  function prevenir() {
    for (const f of ecouteurs.slice()) {
      try {
        f(etatPublic());
      } catch {
        // un écouteur fautif ne doit pas couper le son
      }
    }
  }

  function etatPublic() {
    const M = racine.Musique;
    return { musique: reglages.musique, effets: reglages.effets, musique_active: reglages.musique_active, actif, ambiance: M ? M.ambianceCourante : "jour" };
  }

  // ------------------------------------------------------------ contexte et bus
  function geler() {
    if (veille) (racine.clearTimeout || clearTimeout)(veille);
    veille = null;
  }

  function reprendre() {
    if (!contexte || !actif) return;
    if (contexte.state === "running" || contexte.state === "closed") return;
    try {
      const p = contexte.resume();
      if (p && p.catch) p.catch(() => {});
    } catch {
      // le navigateur refuse pour l'instant : le prochain geste réessaiera
    }
  }

  function monterBus(c) {
    maitre = c.createGain();
    maitre.gain.value = actif ? 1 : 0;
    busEffets = c.createGain();
    busEffets.gain.value = gainEffets();
    busMusique = c.createGain();
    busMusique.gain.value = gainMusique();
    busEffets.connect(maitre);
    busMusique.connect(maitre);
    if (c.createDynamicsCompressor) {
      // garde-fou : plusieurs effets en même temps ne saturent pas la sortie
      const limiteur = c.createDynamicsCompressor();
      limiteur.threshold.value = -12;
      limiteur.knee.value = 10;
      limiteur.ratio.value = 6;
      limiteur.attack.value = 0.004;
      limiteur.release.value = 0.18;
      maitre.connect(limiteur);
      limiteur.connect(c.destination);
    } else {
      maitre.connect(c.destination);
    }
  }

  // Le contexte audio n'est créé que si le son est actif et qu'un geste a eu lieu.
  function ctx() {
    if (!actif || !geste) return null;
    if (!contexte) {
      const Classe = racine.AudioContext || racine.webkitAudioContext;
      if (!Classe) return null;
      try {
        contexte = new Classe();
      } catch {
        return null;
      }
      monterBus(contexte);
    }
    reprendre();
    return contexte;
  }

  function bruit() {
    if (!tamponBruit && contexte) {
      const n = Math.floor(contexte.sampleRate || 44100);
      tamponBruit = contexte.createBuffer(1, n, n);
      const d = tamponBruit.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return tamponBruit;
  }

  const cache = () => Boolean(racine.document && racine.document.hidden);

  // Lance ou arrête la musique selon l'état du moment (son actif, case cochée, onglet visible).
  function synchroniser() {
    const M = racine.Musique;
    if (!M) return;
    if (actif && geste && reglages.musique_active && !cache() && ctx()) M.demarrer();
    else M.arreter(cache() ? 0.4 : undefined);
  }

  // ------------------------------------------------------------ premier geste du joueur
  function gesteValide(ev) {
    if (ev && ev.type === "keydown" && ev.key === "Escape") return false;
    const ua = racine.navigator && racine.navigator.userActivation;
    return !ua || ua.hasBeenActive; // un doigt qui se pose ne compte qu'une fois relevé
  }

  function surGeste(ev) {
    if (!geste) {
      if (!gesteValide(ev)) return;
      geste = true;
      if (actif) {
        ctx(); // créé ou repris dans le geste lui-même (exigé par Safari sur iPhone)
        synchroniser();
      }
      return;
    }
    if (contexte && actif && contexte.state !== "running") reprendre();
  }

  if (racine.addEventListener) {
    for (const type of GESTES) racine.addEventListener(type, surGeste, { capture: true, passive: true });
  }
  if (racine.document && racine.document.addEventListener) {
    racine.document.addEventListener("visibilitychange", () => {
      if (!cache()) reprendre();
      synchroniser();
    });
  }

  // ------------------------------------------------------------ briques sonores
  let transposition = 1;

  // Une note. o : f (Hz), t (début, s), d (durée, s), forme, v (volume), a (attaque, s),
  // glisse : [[fréquence, délai], ...] pour faire glisser la hauteur, tenue (s) avant la chute.
  function ton(o) {
    const c = contexte;
    const osc = c.createOscillator();
    const g = c.createGain();
    const v = o.v || 0.06;
    const a = o.a || 0.008;
    osc.type = o.forme || "square";
    osc.frequency.setValueAtTime(o.f * transposition, o.t);
    if (o.glisse) for (const [f, dt] of o.glisse) osc.frequency.exponentialRampToValueAtTime(f * transposition, o.t + dt);
    if (o.desaccord) osc.detune.setValueAtTime(o.desaccord, o.t);
    g.gain.setValueAtTime(0, o.t);
    g.gain.linearRampToValueAtTime(v, o.t + a);
    if (o.tenue) g.gain.setValueAtTime(v, o.t + a + o.tenue);
    g.gain.exponentialRampToValueAtTime(0.0008, o.t + o.d);
    osc.connect(g);
    g.connect(o.vers || busEffets);
    osc.start(o.t);
    osc.stop(o.t + o.d + 0.03);
  }

  // Un souffle de bruit blanc filtré. o : t, d, v, filtre ("bandpass", "highpass", "lowpass"),
  // f (Hz), f2 (fréquence d'arrivée du filtre), q, a (attaque).
  function souffle(o) {
    const c = contexte;
    const tampon = bruit();
    if (!tampon || !c.createBufferSource) return;
    const src = c.createBufferSource();
    const filtre = c.createBiquadFilter();
    const g = c.createGain();
    src.buffer = tampon;
    src.loop = true;
    filtre.type = o.filtre || "bandpass";
    filtre.frequency.setValueAtTime(o.f || 2000, o.t);
    if (o.f2) filtre.frequency.exponentialRampToValueAtTime(o.f2, o.t + o.d);
    filtre.Q.value = o.q || 0.8;
    g.gain.setValueAtTime(0, o.t);
    g.gain.linearRampToValueAtTime(o.v || 0.05, o.t + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0006, o.t + o.d);
    src.connect(filtre);
    filtre.connect(g);
    g.connect(o.vers || busEffets);
    src.start(o.t, Math.random() * 0.8);
    src.stop(o.t + o.d + 0.03);
  }

  const DO = 523.25;
  const demi = (n) => DO * Math.pow(2, n / 12);

  // Suite de notes : liste de [demi-tons, début, durée], même forme et même volume.
  function suite(t, notes, forme, v, a) {
    for (const [n, debut, duree] of notes) ton({ f: demi(n), t: t + debut, d: duree, forme, v, a });
  }

  // Un accord tenu : plusieurs demi-tons en même temps.
  function accord(t, demis, duree, forme, v, a) {
    for (const n of demis) ton({ f: demi(n), t, d: duree, forme, v, a });
  }

  // Les airs d'origine sont des listes de notes [fréquence, début, durée, forme, volume].
  // Les nouveaux sont des fonctions (t) qui posent leurs notes et leurs souffles à partir de t.
  const AIRS = {
    clic: [[demi(7), 0, 0.05, "square", 0.03]],
    piece: [[demi(12), 0, 0.07], [demi(19), 0.07, 0.16]],
    quete: [[demi(0), 0, 0.09], [demi(4), 0.09, 0.09], [demi(7), 0.18, 0.09], [demi(12), 0.27, 0.22]],
    vente: [[demi(0), 0, 0.08], [demi(7), 0.08, 0.08], [demi(12), 0.16, 0.08], [demi(16), 0.24, 0.08], [demi(19), 0.32, 0.1], [demi(24), 0.42, 0.34]],
    achat: [[demi(5), 0, 0.07, "triangle", 0.09], [demi(9), 0.07, 0.07, "triangle", 0.09], [demi(12), 0.14, 0.18, "triangle", 0.09]],
    jalon: [[demi(7), 0, 0.12], [demi(7), 0.14, 0.06], [demi(12), 0.22, 0.12], [demi(16), 0.36, 0.12], [demi(19), 0.5, 0.4]],
    colis: [[demi(12), 0, 0.06, "triangle", 0.09], [demi(14), 0.06, 0.06, "triangle", 0.09], [demi(16), 0.12, 0.06, "triangle", 0.09], [demi(19), 0.18, 0.06, "triangle", 0.09], [demi(24), 0.24, 0.3, "triangle", 0.09]],
    pose: [[demi(-5), 0, 0.06, "triangle", 0.1], [demi(0), 0.05, 0.1, "triangle", 0.1]],
    erreur: [[demi(-8), 0, 0.12, "sawtooth", 0.04], [demi(-12), 0.12, 0.2, "sawtooth", 0.04]],
    // sons doux de la version 3
    journal: [[demi(9), 0, 0.12, "sine", 0.07], [demi(12), 0.1, 0.12, "sine", 0.07], [demi(16), 0.2, 0.3, "sine", 0.07]],
    contrat: [[demi(-5), 0, 0.1, "triangle", 0.09], [demi(2), 0.1, 0.1, "triangle", 0.09], [demi(7), 0.2, 0.22, "triangle", 0.09]],
    tenu: [[demi(0), 0, 0.1, "triangle", 0.1], [demi(4), 0.1, 0.1, "triangle", 0.1], [demi(7), 0.2, 0.1, "triangle", 0.1], [demi(12), 0.3, 0.14, "square", 0.05], [demi(16), 0.44, 0.14, "square", 0.05], [demi(19), 0.58, 0.5, "square", 0.05]],
    eau: [[demi(24), 0, 0.05, "sine", 0.06], [demi(21), 0.07, 0.05, "sine", 0.06], [demi(26), 0.14, 0.05, "sine", 0.06], [demi(19), 0.22, 0.05, "sine", 0.06], [demi(24), 0.3, 0.12, "sine", 0.06]],
    cran: [[demi(7), 0, 0.08, "triangle", 0.09], [demi(14), 0.08, 0.2, "triangle", 0.09]],
    trait: [[demi(12), 0, 0.08, "sine", 0.08], [demi(16), 0.08, 0.08, "sine", 0.08], [demi(19), 0.16, 0.08, "sine", 0.08], [demi(23), 0.24, 0.3, "sine", 0.08]],
    niveau: [[demi(0), 0, 0.09, "square", 0.05], [demi(7), 0.09, 0.09, "square", 0.05], [demi(12), 0.18, 0.09, "square", 0.05], [demi(19), 0.27, 0.4, "square", 0.05]],
    dimanche: [[demi(0), 0, 0.18, "triangle", 0.1], [demi(4), 0.18, 0.18, "triangle", 0.1], [demi(7), 0.36, 0.18, "triangle", 0.1], [demi(12), 0.54, 0.18, "triangle", 0.1], [demi(16), 0.72, 0.18, "triangle", 0.1], [demi(12), 0.9, 0.18, "triangle", 0.1], [demi(16), 1.08, 0.18, "triangle", 0.1], [demi(19), 1.26, 0.7, "triangle", 0.1]],
    doux: [[demi(4), 0, 0.2, "sine", 0.06], [demi(0), 0.18, 0.35, "sine", 0.06]],
    debloque: [[demi(5), 0, 0.08, "triangle", 0.09], [demi(9), 0.08, 0.08, "triangle", 0.09], [demi(12), 0.16, 0.08, "triangle", 0.09], [demi(17), 0.24, 0.3, "triangle", 0.09]],
    lieu: [[demi(0), 0, 0.14], [demi(4), 0.14, 0.14], [demi(7), 0.28, 0.14], [demi(12), 0.42, 0.14], [demi(7), 0.56, 0.14], [demi(12), 0.7, 0.14], [demi(16), 0.84, 0.5]],

    // ---------------------------------------------------------- version 4 : le Système
    // Montée de niveau : fanfare courte et brillante, un élan puis un accord qui scintille.
    niveau_systeme: (t) => {
      suite(t, [[2, 0, 0.08], [6, 0.07, 0.08], [9, 0.14, 0.08], [14, 0.21, 0.1]], "square", 0.045);
      accord(t + 0.32, [14, 18, 21], 0.5, "square", 0.026);
      ton({ f: demi(-10), t: t + 0.32, d: 0.5, forme: "triangle", v: 0.065 });
      suite(t + 0.34, [[26, 0, 0.12], [33, 0.07, 0.14], [30, 0.14, 0.3]], "sine", 0.03);
      souffle({ t: t + 0.32, d: 0.3, v: 0.018, filtre: "highpass", f: 7000 });
    },
    // Changement de rang : plus lent, plus grave, des quintes qui s'élèvent.
    rang: (t) => {
      accord(t, [-12, -5], 0.42, "triangle", 0.075, 0.03);
      accord(t + 0.34, [-10, -3], 0.42, "triangle", 0.075, 0.03);
      accord(t + 0.68, [-5, 2, 7], 1.1, "triangle", 0.06, 0.05);
      ton({ f: demi(14), t: t + 0.72, d: 1.0, forme: "sine", v: 0.03, a: 0.08 });
      ton({ f: demi(-17), t: t + 0.68, d: 1.1, forme: "sine", v: 0.055, a: 0.04 });
      souffle({ t: t + 0.66, d: 0.9, v: 0.02, filtre: "highpass", f: 5200, a: 0.12 });
    },
    // Butin qui tombe : petite pluie de notes hautes, puis un éclat.
    butin: (t) => {
      souffle({ t, d: 0.06, v: 0.04, filtre: "bandpass", f: 5200, q: 2 });
      suite(t + 0.02, [[19, 0, 0.1], [23, 0.045, 0.1], [26, 0.09, 0.1], [31, 0.135, 0.1], [28, 0.18, 0.1], [35, 0.225, 0.34]], "sine", 0.05);
      ton({ f: demi(23), t: t + 0.245, d: 0.3, forme: "triangle", v: 0.04 });
    },
    // Pénalité : deux notes graves et rondes, sans agressivité.
    penalite: (t) => {
      ton({ f: demi(-17), t, d: 0.3, forme: "triangle", v: 0.08, a: 0.03 });
      ton({ f: demi(-21), t: t + 0.26, d: 0.55, forme: "triangle", v: 0.075, a: 0.03 });
      ton({ f: demi(-33), t: t + 0.26, d: 0.55, forme: "sine", v: 0.045, a: 0.04 });
    },
    // Boss vaincu : un choc sourd, une montée, un grand accord (environ 1,5 s).
    boss: (t) => {
      ton({ f: 130, t, d: 0.4, forme: "sine", v: 0.1, glisse: [[42, 0.3]] });
      souffle({ t, d: 0.35, v: 0.05, filtre: "lowpass", f: 900, f2: 180 });
      suite(t + 0.16, [[-5, 0, 0.11], [0, 0.11, 0.11], [4, 0.22, 0.11], [7, 0.33, 0.14]], "square", 0.045);
      accord(t + 0.64, [0, 4, 7, 12], 0.86, "square", 0.024, 0.012);
      accord(t + 0.64, [-24, -12], 0.86, "triangle", 0.06);
      suite(t + 0.7, [[24, 0, 0.14], [28, 0.1, 0.14], [31, 0.2, 0.14], [36, 0.3, 0.45]], "sine", 0.028);
      souffle({ t: t + 0.62, d: 0.8, v: 0.03, filtre: "highpass", f: 6000 });
    },
    // Coup porté à un boss : bref, sec, avec du bruit.
    coup: (t) => {
      souffle({ t, d: 0.1, v: 0.11, filtre: "bandpass", f: 2200, f2: 500, q: 0.7 });
      ton({ f: 240, t, d: 0.11, forme: "square", v: 0.06, a: 0.002, glisse: [[70, 0.09]] });
    },
    // Recrutement d'une ombre : la note descend, se retourne, puis remonte.
    ombre: (t) => {
      ton({ f: 494, t, d: 1.0, forme: "sine", v: 0.075, a: 0.04, glisse: [[196, 0.38], [587, 0.92]], tenue: 0.6 });
      ton({ f: 349, t, d: 1.0, forme: "triangle", v: 0.04, a: 0.06, glisse: [[139, 0.38], [415, 0.92]], tenue: 0.6 });
      souffle({ t, d: 0.95, v: 0.03, filtre: "bandpass", f: 1400, f2: 320, q: 3, a: 0.2 });
      ton({ f: demi(19), t: t + 0.9, d: 0.35, forme: "sine", v: 0.03 });
    },
    // Point de statistique posé : petit blip qui monte.
    stat: (t) => {
      ton({ f: 660, t, d: 0.1, forme: "square", v: 0.04, a: 0.003, glisse: [[990, 0.07]] });
    },
    // Fenêtre du Système : un « ting » de cristal.
    fenetre: (t) => {
      ton({ f: 2093, t, d: 0.5, forme: "sine", v: 0.055, a: 0.002 });
      ton({ f: 3136, t, d: 0.34, forme: "sine", v: 0.022, a: 0.002 });
      ton({ f: 4699, t, d: 0.2, forme: "sine", v: 0.01, a: 0.002 });
      souffle({ t, d: 0.03, v: 0.02, filtre: "highpass", f: 8000 });
    },
    habitude_plus: (t) => suite(t, [[9, 0, 0.07], [14, 0.06, 0.18]], "triangle", 0.09),
    habitude_moins: (t) => suite(t, [[2, 0, 0.09], [-3, 0.08, 0.24]], "triangle", 0.085, 0.02),
    quotidienne: (t) => {
      suite(t, [[7, 0, 0.07], [11, 0.07, 0.07], [14, 0.14, 0.2]], "triangle", 0.09);
      ton({ f: demi(26), t: t + 0.14, d: 0.22, forme: "sine", v: 0.03 });
    },
    // Pièces d'or : trois tintements métalliques.
    or: (t) => {
      for (const [n, debut] of [[26, 0], [29, 0.07], [31, 0.14]]) {
        souffle({ t: t + debut, d: 0.03, v: 0.03, filtre: "bandpass", f: 7000, q: 3 });
        ton({ f: demi(n), t: t + debut, d: debut > 0.1 ? 0.3 : 0.1, forme: "sine", v: 0.05, a: 0.002 });
        ton({ f: demi(n + 7) * 1.006, t: t + debut, d: debut > 0.1 ? 0.2 : 0.08, forme: "square", v: 0.012, a: 0.002 });
      }
    },
    // Embauche : quelqu'un arrive, on lui ouvre la porte.
    embauche: (t) => {
      suite(t, [[-5, 0, 0.1], [2, 0.12, 0.1], [7, 0.24, 0.1], [11, 0.36, 0.12]], "triangle", 0.09);
      accord(t + 0.5, [7, 14], 0.42, "triangle", 0.06);
      ton({ f: demi(19), t: t + 0.5, d: 0.42, forme: "square", v: 0.022 });
    },
    // Recherche : des bulles qui montent, puis une trouvaille.
    recherche: (t) => {
      const bulles = [[0, 0], [5, 0.08], [3, 0.16], [10, 0.24], [8, 0.32]];
      for (const [n, debut] of bulles) ton({ f: demi(n), t: t + debut, d: 0.08, forme: "sine", v: 0.06, a: 0.004, glisse: [[demi(n + 7), 0.06]] });
      ton({ f: demi(22), t: t + 0.42, d: 0.4, forme: "sine", v: 0.05, a: 0.003 });
      ton({ f: demi(29), t: t + 0.42, d: 0.3, forme: "sine", v: 0.02, a: 0.003 });
    },
    // Combo : une course rapide qui finit en claquement. Son.jouer("combo", { ton: n }) la hausse.
    combo: (t) => {
      suite(t, [[12, 0, 0.05], [14, 0.04, 0.05], [16, 0.08, 0.05], [19, 0.12, 0.05], [24, 0.16, 0.16]], "square", 0.04, 0.003);
      souffle({ t: t + 0.16, d: 0.05, v: 0.04, filtre: "highpass", f: 5000 });
    },
    // Événement : un carillon qui appelle sans presser.
    evenement: (t) => {
      for (const [n, debut, duree] of [[7, 0, 0.3], [4, 0.2, 0.3], [12, 0.4, 0.6]]) {
        ton({ f: demi(n), t: t + debut, d: duree, forme: "sine", v: 0.07, a: 0.004 });
        ton({ f: demi(n + 12), t: t + debut, d: duree * 0.7, forme: "triangle", v: 0.025, a: 0.004 });
      }
      souffle({ t: t + 0.4, d: 0.4, v: 0.012, filtre: "highpass", f: 7500 });
    },
    // Saison (prestige) : le grand moment. Un souffle, trois octaves qui s'ouvrent, un accord large.
    saison: (t) => {
      ton({ f: 110, t, d: 0.5, forme: "sine", v: 0.1, glisse: [[40, 0.4]] });
      souffle({ t, d: 0.7, v: 0.04, filtre: "bandpass", f: 300, f2: 4200, q: 1.2, a: 0.3 });
      suite(t + 0.1, [[-12, 0, 0.14], [-5, 0.1, 0.14], [0, 0.2, 0.14], [4, 0.3, 0.14], [7, 0.4, 0.14], [12, 0.5, 0.14], [16, 0.6, 0.14], [19, 0.7, 0.16]], "triangle", 0.085);
      suite(t + 0.15, [[0, 0, 0.1], [7, 0.2, 0.1], [12, 0.4, 0.1], [19, 0.6, 0.12]], "square", 0.028);
      accord(t + 0.95, [0, 7, 12, 16, 19], 1.4, "square", 0.02, 0.02);
      accord(t + 0.95, [-24, -12, -5], 1.4, "triangle", 0.06, 0.02);
      suite(t + 1.05, [[24, 0, 0.16], [28, 0.09, 0.16], [31, 0.18, 0.16], [36, 0.27, 0.16], [40, 0.36, 0.16], [43, 0.45, 0.7]], "sine", 0.032);
      souffle({ t: t + 0.93, d: 1.3, v: 0.035, filtre: "highpass", f: 5500 });
    },
    // Petit gain d'expérience : deux gouttes claires.
    xp: (t) => suite(t, [[19, 0, 0.05], [24, 0.04, 0.09]], "sine", 0.04, 0.003),
    // Version 5, mode express. La coche : un « pop » franc, puis une étincelle (transposée par le combo).
    coche: (t) => {
      souffle({ t, d: 0.05, v: 0.05, filtre: "bandpass", f: 2400 });
      suite(t, [[7, 0, 0.05], [12, 0.035, 0.07], [19, 0.08, 0.12]], "square", 0.045, 0.004);
    },
    // Journée bouclée : une petite fanfare qui monte, puis un accord qui reste.
    journee: (t) => {
      suite(t, [[0, 0, 0.1], [4, 0.1, 0.1], [7, 0.2, 0.1], [12, 0.3, 0.1], [7, 0.42, 0.08], [12, 0.5, 0.08], [16, 0.58, 0.08], [19, 0.66, 0.5]], "square", 0.05);
      accord(t + 0.66, [0, 4, 7, 12], 1.2, "triangle", 0.05, 0.02);
      souffle({ t: t + 0.64, d: 0.9, v: 0.03, filtre: "highpass", f: 6000 });
    },
  };

  // Joue un effet. options.ton : transposition en demi-tons (pour faire monter un combo, par exemple).
  function jouer(nom, options) {
    const air = actif && geste && Object.prototype.hasOwnProperty.call(AIRS, nom) ? AIRS[nom] : null;
    if (!air) return false;
    const c = ctx();
    if (!c) return false;
    const t = c.currentTime + 0.012;
    if (dernier[nom] !== undefined && t - dernier[nom] >= 0 && t - dernier[nom] < 0.03) return false; // deux fois le même son au même instant
    dernier[nom] = t;
    const decalage = options && Number.isFinite(Number(options.ton)) ? Number(options.ton) : 0;
    transposition = Math.pow(2, Math.max(-24, Math.min(24, decalage)) / 12);
    try {
      if (typeof air === "function") air(t);
      else for (const [f, debut, duree, forme, v] of air) ton({ f, t: t + debut, d: duree, forme, v });
    } finally {
      transposition = 1;
    }
    return true;
  }

  // Pose un gain en douceur (sans clic), tout de suite.
  function glisser(noeud, valeur, duree) {
    if (!noeud || !contexte) return;
    const p = noeud.gain;
    const t = contexte.currentTime;
    if (p.cancelScheduledValues) p.cancelScheduledValues(t);
    if (p.setTargetAtTime) p.setTargetAtTime(valeur, t, (duree || 0.05) / 3);
    else p.value = valeur;
  }

  // ------------------------------------------------------------ ce que le reste du jeu utilise
  racine.Son = {
    jouer,
    get actif() {
      return actif;
    },
    // Coupure globale (réglage « son » du serveur). Coupé : ni effet ni musique.
    activer(oui) {
      actif = Boolean(oui);
      geler();
      if (actif) {
        if (geste && ctx()) glisser(maitre, 1, 0.08);
      } else if (contexte) {
        glisser(maitre, 0, 0.08);
        // une fois le fondu passé, le contexte dort : rien ne tourne pendant que le son est coupé
        veille = (racine.setTimeout || setTimeout)(() => {
          veille = null;
          if (!actif && contexte && contexte.state === "running" && contexte.suspend) {
            try {
              const p = contexte.suspend();
              if (p && p.catch) p.catch(() => {});
            } catch {
              // sans importance : le gain maître est déjà à zéro
            }
          }
        }, 500);
      }
      synchroniser();
      prevenir();
    },
    // Volume d'un canal ("musique" ou "effets"), de 0 à 1. Sans valeur : lit le volume.
    volume(canal, valeur) {
      if (canal !== "musique" && canal !== "effets") return undefined;
      if (valeur === undefined) return reglages[canal];
      reglages[canal] = borne(valeur, reglages[canal]);
      if (canal === "musique") glisser(busMusique, gainMusique());
      else glisser(busEffets, gainEffets());
      ecrire();
      prevenir();
      return reglages[canal];
    },
    // Copie de l'état : { musique, effets, musique_active, actif, ambiance }.
    reglages: etatPublic,
    // Lance ou arrête la musique (mémorisé). Elle ne sort que si le son est actif.
    musique(oui) {
      reglages.musique_active = Boolean(oui);
      ecrire();
      synchroniser();
      prevenir();
      return reglages.musique_active;
    },
    // Change de thème musical, avec fondu : "jour", "nuit", "donjon", "fete".
    ambiance(nom) {
      const M = racine.Musique;
      if (!M) return false;
      const ok = M.ambiance(nom);
      if (ok) prevenir();
      return ok;
    },
    ambiances() {
      const M = racine.Musique;
      return M ? M.AMBIANCES.slice() : [];
    },
    // Liste des effets que Son.jouer connaît.
    noms() {
      return Object.keys(AIRS);
    },
    // Prévient à chaque changement (coupure, volume, musique, ambiance). Renvoie de quoi se désabonner.
    ecouter(f) {
      if (typeof f !== "function") return () => {};
      ecouteurs.push(f);
      return () => {
        const i = ecouteurs.indexOf(f);
        if (i >= 0) ecouteurs.splice(i, 1);
      };
    },
    // Pour musique.js : le contexte, le bus musique et le bruit blanc, seulement s'ils existent déjà.
    _audio() {
      return contexte && busMusique ? { contexte, sortie: busMusique, bruit: bruit() } : null;
    },
  };
})(window);
