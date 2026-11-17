"use strict";
// Personnages en pixel art : cartes de caractères, assemblées et recolorées dans le code.
// Aucune image externe. Cadre de 20 x 28 pixels (personnage d'environ 12 x 21), pieds à la ligne 25.
(function (racine) {
  const Palette = racine.Palette;
  const L = 20;
  const H = 28;
  const OX = 2; // marge à gauche du cadre de 16
  const OY = 3; // marge en haut
  const ANCRE = { x: 10, y: 25 };

  // ------------------------------------------------------------ têtes (10 x 10)
  // K contour, S peau, s ombre de peau, E œil, M bouche, H cheveux, h ombre des cheveux.
  const TETE = {
    face: [
      "..KKKKKK..",
      ".KSSSSSSK.",
      "KSSSSSSSsK",
      "KSSSSSSSsK",
      "KSSSSSSSsK",
      "KSESSSSEsK",
      "KSSSSSSSsK",
      "KSSSMMSSsK",
      ".KSSSSSsK.",
      "..KKKKKK..",
    ],
    cote: [
      "..KKKKKK..",
      ".KSSSSSSK.",
      "KsSSSSSSSK",
      "KsSSSSSSSK",
      "KsSSSSSSSK",
      "KsSSSSSESK",
      "KsSSSSSSSK",
      "KsSSSSSMMK",
      ".KsSSSSSK.",
      "..KKKKKK..",
    ],
    dos: [
      "..KKKKKK..",
      ".KHHHHHHK.",
      "KHHHHHHHhK",
      "KHHHHHHHhK",
      "KHHHHHHHhK",
      "KHHHHHHHhK",
      "KHHHHHHHhK",
      "KHHHHHHhhK",
      ".KSSSSSsK.",
      "..KKKKKK..",
    ],
  };

  // Coiffures : calques de 12 x 12 (une colonne de marge de chaque côté, deux lignes au-dessus).
  // "." laisse voir la tête. A = couleur d'accent (casquette).
  const COIFFURES = [
    {
      nom: "court",
      face: ["............", "............", "...KKKKKK...", "..KHHHHHHK..", ".KHHHHHHHhK.", ".KHH....HhK.", "............"],
      cote: ["............", "............", "...KKKKKK...", "..KHHHHHHK..", ".KHHHHHHHHK.", ".KHHHHHH....", ".KHHHH......", ".KHHH.......", ".KHH........"],
      dos: [],
    },
    {
      nom: "long",
      face: ["............", "............", "...KKKKKK...", "..KHHHHHHK..", ".KHHHHHHHhK.", ".KHHHHHHHhK.", "KHHH....HhhK", "KHH......hhK", "KHH......hhK", "KHH......hhK", "KHHK....KhhK", ".KK......KK."],
      cote: ["............", "............", "...KKKKKK...", "..KHHHHHHK..", ".KHHHHHHHHK.", "KHHHHHHHH...", "KHHHHH......", "KHHHH.......", "KHHHH.......", "KHHHH.......", "KHHHK.......", ".KKK........"],
      dos: ["............", "............", "............", "............", "............", "............", "KHHHHHHHHHhK", "KHHHHHHHHHhK", "KHHHHHHHHHhK", "KHHHHHHHHhhK", "KHHHHHHHHhhK", ".KKKKKKKKKK."],
    },
    {
      nom: "chignon",
      face: ["....KKKK....", "...KHHHhK...", "...KHHHhK...", "..KHHHHHHK..", ".KHHHHHHHhK.", ".KHH....HhK.", "............"],
      cote: [".KK.........", "KHHK........", "KHHKKKKKK...", ".KKHHHHHHK..", ".KHHHHHHHHK.", ".KHHHHHHH...", ".KHHHH......", ".KHHH.......", ".KHH........"],
      dos: ["....KKKK....", "...KHHHhK...", "...KHHHhK..."],
    },
    {
      nom: "boucle",
      face: ["............", "...KKKKKK...", "..KHHHHHHK..", ".KHHHHHHHHK.", "KHHHHHHHHHhK", "KHHHHHHHHHhK", "KHHH....HHhK", "KHH......HhK", ".K........K.", "............"],
      cote: ["............", "..KKKKKKK...", ".KHHHHHHHK..", "KHHHHHHHHHK.", "KHHHHHHHHHK.", "KHHHHHHHH...", "KHHHHH......", "KHHHH.......", ".KHHH.......", "..KK........"],
      dos: ["............", "...KKKKKK...", "..KHHHHHHK..", ".KHHHHHHHHK.", "KHHHHHHHHHhK", "KHHHHHHHHHhK", "KHHHHHHHHHhK", "KHHHHHHHHHhK", ".KHHHHHHHhK."],
    },
    {
      nom: "casquette",
      face: ["............", "............", "...KKKKKK...", "..KAAAAAAK..", ".KAAAAAAAaK.", ".KKKKKKKKKK.", ".KH......hK.", "............"],
      cote: ["............", "............", "...KKKKKK...", "..KAAAAAAK..", ".KAAAAAAAAK.", ".KAAAAAAAAKK", ".KHHHKKKKKKK", ".KHH........"],
      dos: ["............", "............", "...KKKKKK...", "..KAAAAAAK..", ".KAAAAAAAaK.", ".KAAAAAAAaK."],
    },
    {
      nom: "carre",
      face: ["............", "............", "...KKKKKK...", "..KHHHHHHK..", ".KHHHHHHHhK.", ".KHHHHHHHhK.", ".KH......hK.", ".KH......hK.", ".KH......hK.", ".KK......KK."],
      cote: ["............", "............", "...KKKKKK...", "..KHHHHHHK..", ".KHHHHHHHHK.", ".KHHHHHHHHK.", ".KHHHHH.....", ".KHHHH......", ".KHHHH......", ".KKKKK......"],
      dos: ["............", "............", "............", "............", "............", "............", "............", "............", "............", ".KHHHHHHHhK.", ".KKKKKKKKKK."],
    },
  ];

  // Barbe courte et lunettes rondes (calques de 10 x 10 sur la tête).
  // B barbe, G monture, V verre clair.
  const BARBE = {
    face: ["", "", "", "", "", "", ".B......B.", ".BBBMMBBB.", "..BBBBBB.."],
    cote: ["", "", "", "", "", "", ".......BB.", "....BBBMM.", "...BBBBB.."],
  };
  const LUNETTES = {
    face: ["", "", "", "", ".GGG..GGG.", ".VEVGGVEV.", ".VVV..VVV."],
    cote: ["", "", "", "", "......GGG.", "..GGGGVEV.", "......VVV."],
  };

  // ------------------------------------------------------------ corps (16 x 13, à partir de la ligne 10)
  // T haut, t ombre du haut, P pantalon, p ombre, C chaussures, L pastille des collègues.
  const CORPS = {
    face: [
      "................",
      "....KTTTTTTK....",
      "...KTTTTTTTtK...",
      "...KTTTTLTTtK...",
      "...KStTTTTtSK...",
      "....KTTTTTtK....",
      "....KPPPPPpK....",
      "....KPPPPPpK....",
      "....KPPKKPpK....",
      "....KPPKKPpK....",
      "...KCCCKKCCCK...",
      "...KKKKKKKKKK...",
    ],
    bravo: [
      ".KSK........KSK.",
      ".KTKKTTTTTTKKTK.",
      "..KTTTTTTTTTtK..",
      "...KTTTTLTTtK...",
      "...KTTTTTTTtK...",
      "....KTTTTTtK....",
      "....KPPPPPpK....",
      "....KPPPPPpK....",
      "....KPPKKPpK....",
      "....KPPKKPpK....",
      "...KCCCKKCCCK...",
      "...KKKKKKKKKK...",
    ],
    parle: [
      "................",
      "....KTTTTTTK....",
      "...KTTTTTTTtKK..",
      "...KTTTTLTTtTSK.",
      "...KStTTTTtKKK..",
      "....KTTTTTtK....",
      "....KPPPPPpK....",
      "....KPPPPPpK....",
      "....KPPKKPpK....",
      "....KPPKKPpK....",
      "...KCCCKKCCCK...",
      "...KKKKKKKKKK...",
    ],
    dos: [
      "................",
      "....KTTTTTTK....",
      "...KTTTTTTTtK...",
      "...KTTTTTTTtK...",
      "...KtTTTTTTtK...",
      "....KTTTTTtK....",
      "....KPPPPPpK....",
      "....KPPPPPpK....",
      "....KPPKKPpK....",
      "....KPPKKPpK....",
      "...KCCCKKCCCK...",
      "...KKKKKKKKKK...",
    ],
    dosMarche: [
      "................",
      "....KTTTTTTK....",
      "...KTTTTTTTtK...",
      "...KTTTTTTTtK...",
      "...KtTTTTTTtK...",
      "....KTTTTTtK....",
      "....KPPPPPpK....",
      "....KPPPPPpK....",
      "....KPPKKPpK....",
      "....KCCKKPpK....",
      "....KKKKKCCCK...",
      "........KKKKK...",
    ],
    // Marche de profil (regard à droite) : contact, passage, contact inverse, passage.
    marche0: [
      "................",
      ".....KTTTTK.....",
      "....KTTTTTTK....",
      "....KTTtTLTK....",
      "....KTTtTTTSK...",
      ".....KTTTTKK....",
      ".....KPPPPK.....",
      "....KpPKPPPK....",
      "...KppK.KPPK....",
      "..KppK...KPPK...",
      "..KCCK...KCCCK..",
      "..KKKK...KKKKK..",
    ],
    marche1: [
      ".....KTTTTK.....",
      "....KTTTTTTK....",
      "....KTtTTLTK....",
      "....KTtTTTTK....",
      "....KKSTTTK.....",
      ".....KPPPPK.....",
      ".....KPPPPK.....",
      ".....KpPPK......",
      ".....KpPPK......",
      ".....KCCCCK.....",
      ".....KKKKKK.....",
      "................",
    ],
    marche2: [
      "................",
      ".....KTTTTK.....",
      "....KTTTTTTK....",
      "...KtTTTTLTK....",
      "..KStTTTTTTK....",
      "..KK.KTTTTK.....",
      ".....KPPPPK.....",
      "....KPPKpPPK....",
      "...KPPK.KppK....",
      "..KPPK...KppK...",
      "..KCCK...KCCCK..",
      "..KKKK...KKKKK..",
    ],
    // Assis de profil : cuisses en avant. Deux poses de mains pour la frappe.
    assis0: [
      "................",
      ".....KTTTTK.....",
      "....KTTTTTTK....",
      "....KTTtTLTKKK..",
      "....KTTttttSSK..",
      ".....KTTTTKKK...",
      ".....KPPPPPPPK..",
      ".....KpPPPPPPK..",
      "......KKKKpPPK..",
      "..........KpPK..",
      "..........KCCCK.",
      "..........KKKKK.",
    ],
    assis1: [
      "................",
      ".....KTTTTK.....",
      "....KTTTTTTKKK..",
      "....KTTtttLSSK..",
      "....KTTtTTTKK...",
      ".....KTTTTK.....",
      ".....KPPPPPPPK..",
      ".....KpPPPPPPK..",
      "......KKKKpPPK..",
      "..........KpPK..",
      "..........KCCCK.",
      "..........KKKKK.",
    ],
    // Assis, bras relevé (tasse ou livre tenu devant le visage).
    assisLeve: [
      "............KK..",
      ".....KTTTTKKSK..",
      "....KTTTTTTtTK..",
      "....KTTtttLKK...",
      "....KTTTTTTK....",
      ".....KTTTTK.....",
      ".....KPPPPPPPK..",
      ".....KpPPPPPPK..",
      "......KKKKpPPK..",
      "..........KpPK..",
      "..........KCCCK.",
      "..........KKKKK.",
    ],
    // Debout de profil, bras relevé (tasse au comptoir).
    deboutLeve: [
      "............KK..",
      ".....KTTTTKKSK..",
      "....KTTTTTTtTK..",
      "....KTTtttLKK...",
      "....KTTTTTTK....",
      ".....KTTTTK.....",
      ".....KPPPPK.....",
      ".....KpPPPK.....",
      ".....KpPPPK.....",
      ".....KpPPPK.....",
      ".....KCCCCCK....",
      ".....KKKKKKK....",
    ],
    deboutCote: [
      "................",
      ".....KTTTTK.....",
      "....KTTTTTTK....",
      "....KTTtTLTK....",
      "....KTTtTTTK....",
      ".....KTSTTK.....",
      ".....KPPPPK.....",
      ".....KpPPPK.....",
      ".....KpPPPK.....",
      ".....KpPPPK.....",
      ".....KCCCCCK....",
      ".....KKKKKKK....",
    ],
    // Porte un carton devant lui (déménagement, livraison).
    porte0: [
      "................",
      ".....KTTTTK.....",
      "....KTTTTTTKKKKK",
      "....KTTtttLSXXXK",
      "....KTTTTTTKXxXK",
      ".....KTTTTKKXXXK",
      ".....KPPPPK.KKKK",
      "....KpPKPPPK....",
      "...KppK.KPPK....",
      "..KppK...KPPK...",
      "..KCCK...KCCCK..",
      "..KKKK...KKKKK..",
    ],
    porte1: [
      ".....KTTTTK.....",
      "....KTTTTTTKKKKK",
      "....KTTtttLSXXXK",
      "....KTTTTTTKXxXK",
      ".....KTTTTKKXXXK",
      ".....KPPPPK.KKKK",
      ".....KPPPPK.....",
      ".....KpPPK......",
      ".....KpPPK......",
      ".....KCCCCK.....",
      ".....KKKKKK.....",
      "................",
    ],
  };

  // ------------------------------------------------------------ variantes de couleurs
  const PEAUX = [["e", "d"], ["i", "h"], ["h", "g"], ["g", "f"]];
  const CHEVEUX = [["0", "1"], ["f", "0"], ["g", "f"], ["t", "x"], ["x", "b"], ["3", "2"]];
  const HAUTS = [["c", "b"], ["p", "o"], ["k", "j"], ["t", "x"], ["w", "o"], ["5", "3"], ["v", "a"], ["1", "0"], ["q", "p"], ["l", "k"]];
  const BAS = [["o", "n"], ["1", "0"], ["f", "0"], ["2", "1"], ["g", "f"]];

  function poser(ctx, carte, x0, y0, roles) {
    for (let y = 0; y < carte.length; y++) {
      const ligne = carte[y];
      for (let x = 0; x < ligne.length; x++) {
        const car = ligne[x];
        if (car === "." || car === " ") continue;
        const cle = roles[car];
        if (!cle) continue;
        ctx.fillStyle = Palette.C[cle];
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  }

  function cadre() {
    const c = document.createElement("canvas");
    c.width = L;
    c.height = H;
    return c;
  }

  function miroir(source) {
    const c = cadre();
    const ctx = c.getContext("2d");
    ctx.translate(L, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(source, 0, 0);
    return c;
  }

  // Assemble une image : corps, puis tête décalée de (dx, dy), coiffure, barbe, lunettes.
  function assembler(look, roles, corps, vue, options) {
    const o = options || {};
    const c = cadre();
    const ctx = c.getContext("2d");
    const dy = o.dy || 0;
    poser(ctx, CORPS[corps], OX, OY + 10 + (o.corpsDy || 0), roles);
    const tx = OX + 3 + (o.dx || 0);
    const ty = OY + 1 + dy;
    const tete = TETE[vue].slice();
    if (o.clin && vue !== "dos") tete[5] = tete[5].replace(/E/g, "s");
    if (o.bouche && vue !== "dos") tete[7] = tete[7].replace(/M/g, "K");
    poser(ctx, tete, tx, ty, roles);
    const coiffure = COIFFURES[look.coiffure % COIFFURES.length];
    if (vue === "dos" && coiffure.nom === "court") {
      // cheveux courts de dos : la tête de dos suffit
    } else if (coiffure[vue] && coiffure[vue].length) {
      poser(ctx, coiffure[vue], tx - 1, ty - 2, roles);
    }
    if (look.barbe && BARBE[vue]) poser(ctx, BARBE[vue], tx, ty, roles);
    if (look.lunettes && LUNETTES[vue]) poser(ctx, LUNETTES[vue], tx, ty, roles);
    if (look.antenne) {
      ctx.fillStyle = Palette.C["0"];
      ctx.fillRect(tx + 4, ty - 2, 1, 2);
      ctx.fillStyle = Palette.C[look.antenne];
      ctx.fillRect(tx + 4, ty - 3, 1, 1);
    }
    return c;
  }

  // look : { peau, cheveux, coiffure, haut, bas, barbe, lunettes, pastille, antenne, accent }
  const cache = new Map();
  function fabriquer(look) {
    const cle = JSON.stringify(look);
    if (cache.has(cle)) return cache.get(cle);
    const peau = PEAUX[look.peau % PEAUX.length];
    const cheveux = CHEVEUX[look.cheveux % CHEVEUX.length];
    const haut = HAUTS[look.haut % HAUTS.length];
    const bas = BAS[(look.bas || 0) % BAS.length];
    const roles = {
      K: "0", S: peau[0], s: peau[1], E: "0", M: peau[1],
      H: cheveux[0], h: cheveux[1], B: cheveux[1], G: look.monture || "0", V: "6",
      T: haut[0], t: haut[1], L: look.pastille || haut[0],
      P: bas[0], p: bas[1], C: look.chaussures || "0",
      A: look.accent || "c", a: look.accentOmbre || "b", X: "h", x: "g",
    };
    const f = (corps, vue, options) => assembler(look, roles, corps, vue, options);
    const droite = {
      marche: [f("marche0", "cote"), f("marche1", "cote", { dy: -1 }), f("marche2", "cote"), f("marche1", "cote", { dy: -1 })],
      debout: [f("deboutCote", "cote"), f("deboutCote", "cote", { dy: 1 })],
      assis: [f("assis0", "cote", { dy: 1 }), f("assis1", "cote", { dy: 1 })],
      assisCalme: [f("assis0", "cote", { dy: 1 }), f("assis0", "cote", { dy: 2 })],
      assisLeve: [f("assis0", "cote", { dy: 1 }), f("assisLeve", "cote", { dy: 1 })],
      boit: [f("deboutCote", "cote"), f("deboutLeve", "cote")],
      parleCote: [f("deboutCote", "cote"), f("deboutCote", "cote", { bouche: true })],
      porte: [f("porte0", "cote"), f("porte1", "cote", { dy: -1 }), f("porte0", "cote"), f("porte1", "cote", { dy: -1 })],
    };
    const jeu = {
      droite,
      gauche: {},
      face: {
        debout: [f("face", "face"), f("face", "face", { dy: 1 }), f("face", "face"), f("face", "face", { dy: 1, clin: true })],
        parle: [f("parle", "face", { bouche: true }), f("face", "face"), f("parle", "face"), f("face", "face", { bouche: true })],
        bravo: [f("bravo", "face", { dy: -1, bouche: true }), f("face", "face")],
      },
      dos: {
        debout: [f("dos", "dos"), f("dos", "dos", { dy: 1 })],
        marche: [f("dosMarche", "dos"), miroirCorps(f("dosMarche", "dos"))],
      },
    };
    for (const nom of Object.keys(droite)) jeu.gauche[nom] = droite[nom].map(miroir);
    cache.set(cle, jeu);
    return jeu;
  }

  function miroirCorps(source) {
    return miroir(source);
  }

  // ------------------------------------------------------------ apparences
  // Toi : barbe courte, lunettes, pull terracotta. Personnalisable depuis le jeu.
  const PULLS_AVATAR = [0, 1, 2, 3, 4, 7];
  function lookToi(avatar) {
    const a = avatar || {};
    return {
      peau: a.peau === undefined ? 1 : a.peau,
      cheveux: a.cheveux === undefined ? 0 : a.cheveux,
      coiffure: 0,
      haut: PULLS_AVATAR[(a.pull || 0) % PULLS_AVATAR.length],
      bas: 0,
      barbe: a.barbe !== false,
      lunettes: a.lunettes !== false,
    };
  }

  // Agents maison : chacun sa couleur, une petite antenne qui clignote.
  const LOOKS_AGENTS = {
    plume: { peau: 0, cheveux: 4, coiffure: 2, haut: 8, bas: 1, antenne: "t" },
    boussole: { peau: 2, cheveux: 0, coiffure: 3, haut: 3, bas: 0, antenne: "t" },
    archive: { peau: 1, cheveux: 5, coiffure: 5, haut: 2, bas: 3, antenne: "t", lunettes: true },
    croquis: { peau: 3, cheveux: 0, coiffure: 1, haut: 6, bas: 1, antenne: "t" },
    timbre: { peau: 0, cheveux: 1, coiffure: 0, haut: 4, bas: 0, antenne: "t" },
    relais: { peau: 2, cheveux: 2, coiffure: 5, haut: 9, bas: 2, antenne: "t" },
    reliure: { peau: 1, cheveux: 3, coiffure: 1, haut: 1, bas: 4, antenne: "t" },
    marge: { peau: 3, cheveux: 5, coiffure: 0, haut: 5, bas: 0, antenne: "t", lunettes: true },
  };

  // Collègues (sessions) : haut anthracite, pastille terracotta clair, antenne turquoise. Stable selon la clé.
  function lookCollegue(cle) {
    const g = Palette.graineDe(String(cle));
    return { peau: g % 4, cheveux: (g >>> 3) % 6, coiffure: [0, 1, 2, 3, 5][(g >>> 7) % 5], haut: 7, bas: 3, pastille: "d", antenne: "s", lunettes: (g >>> 11) % 4 === 0 };
  }

  // Visiteurs lecteurs : habits de ville, sans antenne.
  function lookVisiteur(n) {
    const g = Palette.graineDe("visiteur" + n);
    return { peau: g % 4, cheveux: (g >>> 3) % 6, coiffure: [0, 1, 2, 3, 5][(g >>> 7) % 5], haut: [1, 2, 3, 4, 5, 6, 8, 9][(g >>> 10) % 8], bas: (g >>> 14) % 5 };
  }

  const LOOK_LIVREUR = { peau: 2, cheveux: 0, coiffure: 4, haut: 2, bas: 1, accent: "t", accentOmbre: "x" };

  const Personnages = {
    L,
    H,
    ANCRE,
    fabriquer,
    lookToi,
    lookCollegue,
    lookVisiteur,
    LOOKS_AGENTS,
    LOOK_LIVREUR,
    NB: { peaux: PEAUX.length, cheveux: CHEVEUX.length, pulls: PULLS_AVATAR.length },
    PEAUX,
    CHEVEUX,
    HAUTS,
    PULLS_AVATAR,
  };
  racine.Personnages = Personnages;
})(window);
