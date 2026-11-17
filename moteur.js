/* Jeu de quêtes, moteur local (version 6). Généré, ne pas éditer à la main. */
(function (racine) {
  "use strict";

  function sha1hex(octets) {
    function rot(n, s) { return (n << s) | (n >>> (32 - s)); }
    var words = [];
    var i, j;
    for (i = 0; i < octets.length; i++) words[i >> 2] |= octets[i] << (24 - (i % 4) * 8);
    var bitLen = octets.length * 8;
    words[bitLen >> 5] |= 0x80 << (24 - (bitLen % 32));
    words[(((bitLen + 64) >> 9) << 4) + 15] = bitLen;
    var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    var w = new Array(80);
    for (i = 0; i < words.length; i += 16) {
      var a = h0, b = h1, c = h2, d = h3, e = h4, f, k, temp;
      for (j = 0; j < 80; j++) {
        w[j] = j < 16 ? (words[i + j] | 0) : rot(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
        if (j < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
        else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6; }
        temp = (rot(a, 5) + f + e + k + (w[j] | 0)) | 0;
        e = d; d = c; c = rot(b, 30); b = a; a = temp;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    function hex(n) { return ("00000000" + (n >>> 0).toString(16)).slice(-8); }
    return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
  }

  function bytesFrom(x, enc) {
    if (x == null) return new Uint8Array(0);
    if (x instanceof Uint8Array) return x;
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    if (typeof x === "string") {
      if (enc === "hex") {
        var n = x.length / 2, out = new Uint8Array(n);
        for (var i = 0; i < n; i++) out[i] = parseInt(x.substr(i * 2, 2), 16);
        return out;
      }
      return new TextEncoder().encode(x);
    }
    if (typeof x === "object" && x.type === "Buffer" && Array.isArray(x.data)) return Uint8Array.from(x.data);
    return new Uint8Array(0);
  }

  var webCrypto = racine.crypto;

  var nodeCrypto = {
    createHash: function (algo) {
      if (String(algo).toLowerCase() !== "sha1") throw new Error("Empreinte non supportée : " + algo);
      var data = new Uint8Array(0);
      return {
        update: function (x, enc) {
          var add = bytesFrom(x, enc);
          var n = new Uint8Array(data.length + add.length);
          n.set(data);
          n.set(add, data.length);
          data = n;
          return this;
        },
        digest: function (enc) {
          var hex = sha1hex(data);
          if (enc === "hex") return hex;
          return bytesFrom(hex, "hex");
        },
      };
    },
    randomInt: function (n) {
      var max = Number(n);
      if (!Number.isInteger(max) || max <= 0) throw new Error("randomInt : borne invalide");
      var buf = new Uint32Array(1);
      var lim = Math.floor(0x100000000 / max) * max;
      do { webCrypto.getRandomValues(buf); } while (buf[0] >= lim);
      return buf[0] % max;
    },
    randomBytes: function (n) {
      var b = new Uint8Array(n);
      webCrypto.getRandomValues(b);
      return {
        length: n,
        toString: function (enc) {
          if (enc === "hex") {
            var s = "";
            for (var i = 0; i < b.length; i++) s += ("0" + b[i].toString(16)).slice(-2);
            return s;
          }
          return new TextDecoder().decode(b);
        },
      };
    },
  };

  function normaliserChemin(p) {
    if (p == null || p === "") return "/";
    var s = String(p).replace(/\\/g, "/");
    if (s.charAt(0) !== "/") s = "/" + s;
    var parts = [];
    s.split("/").forEach(function (seg) {
      if (!seg || seg === ".") return;
      if (seg === "..") { if (parts.length) parts.pop(); return; }
      parts.push(seg);
    });
    return "/" + parts.join("/");
  }

  var nodePath = {
    sep: "/",
    resolve: function () {
      var cur = "/jeu";
      for (var i = 0; i < arguments.length; i++) {
        var a = String(arguments[i] || "");
        if (!a) continue;
        if (a.charAt(0) === "/" || a.charAt(0) === "\\") cur = a;
        else cur = cur + "/" + a;
      }
      return normaliserChemin(cur);
    },
    join: function () {
      var segs = [];
      for (var i = 0; i < arguments.length; i++) segs.push(String(arguments[i] || ""));
      return normaliserChemin(segs.join("/"));
    },
    dirname: function (p) {
      var n = normaliserChemin(p);
      if (n === "/") return "/";
      return n.replace(/\/[^/]+$/, "") || "/";
    },
    basename: function (p) {
      var n = normaliserChemin(p);
      if (n === "/") return "";
      return n.slice(n.lastIndexOf("/") + 1);
    },
    extname: function (p) {
      var b = nodePath.basename(p);
      var i = b.lastIndexOf(".");
      return i > 0 ? b.slice(i) : "";
    },
    isAbsolute: function (p) { return String(p || "").charAt(0) === "/" || String(p || "").charAt(0) === "\\"; },
    relative: function (from, to) {
      var a = normaliserChemin(from).split("/").filter(Boolean);
      var b = normaliserChemin(to).split("/").filter(Boolean);
      var i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      var out = [];
      for (var j = i; j < a.length; j++) out.push("..");
      return out.concat(b.slice(i)).join("/") || "";
    },
  };

  var disque = Object.create(null);
  var CLE_LS = "jq-v6-disque";
  var IDB_NOM = "jeu-quetes-v6";
  var IDB_STORE = "disque";

  function snapshot() {
    var o = {};
    Object.keys(disque).forEach(function (k) { o[k] = disque[k]; });
    return o;
  }

  function appliquerSnapshot(o) {
    Object.keys(disque).forEach(function (k) { delete disque[k]; });
    if (o && typeof o === "object") Object.keys(o).forEach(function (k) { disque[k] = o[k]; });
  }

  function persisterLocal() {
    try { racine.localStorage.setItem(CLE_LS, JSON.stringify(snapshot())); } catch (e) {}
  }

  function persisterIdb() {
    try {
      if (!racine.indexedDB) return;
      var req = racine.indexedDB.open(IDB_NOM, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(IDB_STORE); };
      req.onsuccess = function () {
        var db = req.result;
        var tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(snapshot(), "racine");
        tx.oncomplete = function () { db.close(); };
        tx.onerror = function () { db.close(); };
      };
    } catch (e) {}
  }

  var persisteMinuteur = null;
  function demanderPersistance() {
    persisterLocal();
    if (persisteMinuteur) racine.clearTimeout(persisteMinuteur);
    persisteMinuteur = racine.setTimeout(function () { persisteMinuteur = null; persisterIdb(); }, 80);
  }

  function restaurerSync() {
    try {
      var t = racine.localStorage.getItem(CLE_LS);
      if (t) appliquerSnapshot(JSON.parse(t));
    } catch (e) {}
  }

  function restaurer() {
    restaurerSync();
    return new Promise(function (ok) {
      if (!racine.indexedDB) return ok();
      var fini = false;
      function done() { if (!fini) { fini = true; ok(); } }
      try {
        var req = racine.indexedDB.open(IDB_NOM, 1);
        req.onupgradeneeded = function () { req.result.createObjectStore(IDB_STORE); };
        req.onerror = function () { done(); };
        req.onsuccess = function () {
          var db = req.result;
          var tx = db.transaction(IDB_STORE, "readonly");
          var g = tx.objectStore(IDB_STORE).get("racine");
          g.onsuccess = function () {
            if (g.result && typeof g.result === "object") appliquerSnapshot(g.result);
            db.close();
            done();
          };
          g.onerror = function () { db.close(); done(); };
        };
      } catch (e) { done(); }
      racine.setTimeout(done, 800);
    });
  }

  function parentDir(p) {
    var n = normaliserChemin(p);
    if (n === "/") return "/";
    return n.replace(/\/[^/]+$/, "") || "/";
  }

  function assurerDossier(p) {
    var n = normaliserChemin(p);
    var cur = "";
    n.split("/").forEach(function (seg) {
      if (!seg) return;
      cur += "/" + seg;
      if (disque[cur] && disque[cur].type === "file") throw Object.assign(new Error("Pas un dossier : " + cur), { code: "ENOTDIR" });
      if (!disque[cur]) disque[cur] = { type: "dir" };
    });
    if (!disque["/"]) disque["/"] = { type: "dir" };
  }

  var nodeFs = {
    existsSync: function (p) { return Object.prototype.hasOwnProperty.call(disque, normaliserChemin(p)); },
    readFileSync: function (p, enc) {
      var f = disque[normaliserChemin(p)];
      if (!f || f.type !== "file") {
        var err = new Error("Fichier introuvable : " + p);
        err.code = "ENOENT";
        throw err;
      }
      if (enc === "utf8" || enc === "utf-8") return f.body;
      return { type: "Buffer", data: Array.from(new TextEncoder().encode(f.body)) };
    },
    writeFileSync: function (p, data) {
      var n = normaliserChemin(p);
      assurerDossier(parentDir(n));
      var body = typeof data === "string" ? data : (data && data.type === "Buffer" ? new TextDecoder().decode(Uint8Array.from(data.data)) : String(data));
      disque[n] = { type: "file", body: body, mtime: Date.now() };
      demanderPersistance();
    },
    mkdirSync: function (p, opts) {
      var n = normaliserChemin(p);
      if (opts && opts.recursive) assurerDossier(n);
      else {
        assurerDossier(parentDir(n));
        if (!disque[n]) disque[n] = { type: "dir" };
      }
      demanderPersistance();
    },
    renameSync: function (a, b) {
      var pa = normaliserChemin(a), pb = normaliserChemin(b);
      if (!disque[pa]) { var err = new Error("Introuvable : " + a); err.code = "ENOENT"; throw err; }
      assurerDossier(parentDir(pb));
      disque[pb] = disque[pa];
      delete disque[pa];
      demanderPersistance();
    },
    unlinkSync: function (p) {
      var n = normaliserChemin(p);
      if (!disque[n]) { var err = new Error("Introuvable : " + p); err.code = "ENOENT"; throw err; }
      delete disque[n];
      demanderPersistance();
    },
    realpathSync: function (p) { return normaliserChemin(p); },
    lstatSync: function (p) {
      var f = disque[normaliserChemin(p)];
      if (!f) { var err = new Error("Introuvable : " + p); err.code = "ENOENT"; throw err; }
      return { isSymbolicLink: function () { return false; }, isFile: function () { return f.type === "file"; }, isDirectory: function () { return f.type === "dir"; }, mtimeMs: f.mtime || 0 };
    },
    statSync: function (p) { return nodeFs.lstatSync(p); },
    readdirSync: function (p) {
      var n = normaliserChemin(p);
      if (!disque[n] || disque[n].type !== "dir") { var err = new Error("Pas un dossier : " + p); err.code = "ENOTDIR"; throw err; }
      var pref = n === "/" ? "/" : n + "/";
      var noms = [];
      Object.keys(disque).forEach(function (k) {
        if (k === n) return;
        if (k.indexOf(pref) !== 0) return;
        var reste = k.slice(pref.length);
        if (reste && reste.indexOf("/") === -1) noms.push(reste);
      });
      return noms;
    },
  };

  var nodeOs = { tmpdir: function () { return "/tmp"; }, homedir: function () { return "/home/joueur"; }, hostname: function () { return "local"; } };
  var nodeProcess = { env: {}, exitCode: 0 };

  var cache = Object.create(null);
  var factories = Object.create(null);

  function definir(id, factory) { factories[id] = factory; }

  function req(id, depuis) {
    var cle = id;
    if (id === "node:crypto" || id === "crypto") return nodeCrypto;
    if (id === "node:fs" || id === "fs") return nodeFs;
    if (id === "node:path" || id === "path") return nodePath;
    if (id === "node:os" || id === "os") return nodeOs;
    if (id.indexOf("./") === 0 || id.indexOf("../") === 0) {
      var base = depuis || "/jeu/serveur";
      cle = nodePath.resolve(base, id);
      if (!cle.endsWith(".js")) cle += ".js";
    }
    if (cache[cle]) return cache[cle].exports;
    var factory = factories[cle] || factories[id];
    if (!factory) throw new Error("Module introuvable : " + id);
    var module = { exports: {} };
    cache[cle] = module;
    factory(function (dep) { return req(dep, nodePath.dirname(cle)); }, module, module.exports);
    return module.exports;
  }

  definir("/jeu/serveur/garde.js", function (require, module, exports) {
    var fs = require("node:fs");
    var path = require("node:path");
    var RE_NOM = /^[a-z0-9-]+\.json$/;
    var TEXTES_PERMIS = { "quetes.md": 1, "quetes-test.md": 1, "but-equipe.md": 1, "but-equipe-test.md": 1 };
    var DATA = "/jeu/data";
    function refus(m) { var e = new Error(m); e.code = "ECRITURE_REFUSEE"; e.nom = "ErreurJeu"; throw e; }
    function dossierDonnees() { fs.mkdirSync(DATA, { recursive: true }); return DATA; }
    function verifierNom(nom) { if (!RE_NOM.test(nom)) refus("Nom de fichier refusé : " + String(nom)); }
    function lireDonnees(nom) {
      verifierNom(nom);
      try { return JSON.parse(fs.readFileSync(path.join(DATA, nom), "utf8")); }
      catch (e) {
        if (e && e.code === "ENOENT") return null;
        var err = new Error("Je n'arrive pas à lire " + nom + "."); err.code = "DONNEES_ILLISIBLES"; err.nom = "ErreurJeu"; throw err;
      }
    }
    function ecrireDonnees(nom, objet) {
      verifierNom(nom);
      dossierDonnees();
      fs.writeFileSync(path.join(DATA, nom), JSON.stringify(objet, null, 2) + "\n", "utf8");
    }
    function effacerDonnees(nom) {
      verifierNom(nom);
      try { fs.unlinkSync(path.join(DATA, nom)); } catch (e) { if (!e || e.code !== "ENOENT") throw e; }
    }
    function mettreDeCote(nom, nouveauNom) {
      verifierNom(nom); verifierNom(nouveauNom);
      fs.renameSync(path.join(DATA, nom), path.join(DATA, nouveauNom));
    }
    function verifierNomTexte(nom) { if (!TEXTES_PERMIS[nom]) refus("Nom de fichier refusé : " + String(nom)); }
    function lireTexte(nom) {
      verifierNomTexte(nom);
      try { return fs.readFileSync(path.join(DATA, nom), "utf8"); } catch (e) { if (e && e.code === "ENOENT") return null; throw e; }
    }
    function ecrireTexte(nom, texte) {
      verifierNomTexte(nom);
      dossierDonnees();
      fs.writeFileSync(path.join(DATA, nom), texte, "utf8");
    }
    function effacerTexte(nom) {
      verifierNomTexte(nom);
      try { fs.unlinkSync(path.join(DATA, nom)); } catch (e) { if (!e || e.code !== "ENOENT") throw e; }
    }
    module.exports = { definirCoffre: function () {}, lireDonnees: lireDonnees, ecrireDonnees: ecrireDonnees, mettreDeCote: mettreDeCote, effacerDonnees: effacerDonnees, dossierVoulu: function () { return DATA; }, lireTexte: lireTexte, ecrireTexte: ecrireTexte, effacerTexte: effacerTexte };
  });

  definir("/jeu/serveur/coffre.js", function (require, module) {
    module.exports = { lireCoffre: function () { return { chemin: null, phase: null, semaine: null, quetes: [], jours: [], strategies: { regle_commune: "", etats: [] }, mission: { texte: "", phrase: "", objectifs: [] }, erreurs: [], avertissements: [] }; } };
  });

  definir("/jeu/serveur/collegues.js", function (require, module) {
    module.exports = { lire: function () { return { collegues: [], sessions: 0 }; }, lireSansCache: function () { return { collegues: [], sessions: 0 }; }, libelleAction: function () { return ""; }, extraire: function () { return null; }, viderCache: function () {} };
  });

  var CONFIG_PUBLIQUE = {"version":6,"coffre":"non","coffre_candidats":[],"chemin_phases":"","port":80,"reseau_local":false,"https":false,"fuseau":"Europe/Paris","rafraichissement_s":30,"son":true,"joueur":"","enseigne":"Mon enseigne","monnaie":"€","objectif_mensuel":1000,"jalons_mensuels":"auto","periode":"mois_civil","sources_encaissement":["Ventes","Abonnements","Ateliers","Livre","Autre"],"points":{"ligne":10,"priorite":15,"degres":[1,2,3],"degre_defaut":2,"multiplicateur_vente":2,"bonus_jour":25,"geste":5},"degres_defaut":["Commencé pour de bon","Fait, comme prévu","Fait, et mieux que prévu"],"quetes_visibles":5,"plafond":{"par_jour":6,"plein":4,"taux_reduit":50},"contrat":{"actif":true,"sur":{"quetes":3,"gain":30},"ambitieux":{"quetes":2,"mise":20,"gain":80,"heure_limite":"12:00","colis":true}},"retour":{"jours":3,"bonus":20},"arrosage":{"bonus_pourcent":20,"duree_h":12},"but_equipe":{"libelle":"","crans":10,"par_cran":3,"par_quete":1,"par_specialite":1,"par_session":1,"sessions_max_par_jour":3,"recompense":60},"dimanche":{"jour":7,"recompense":40},"niveaux":{"seuils":[0,60,150,300,500,800,1200,1700,2400,3200],"noms":["Locataire","Habitué","Artisan","Bâtisseur","Chef d'atelier","Maître d'œuvre","Architecte","Éditeur","Figure du quartier","Légende de l'immeuble"]},"deblocages":{"actif":true,"contrat":2,"boutique":2,"equipe":3,"argent":4,"carte":4,"arrosage":5,"trophees":5,"etat":5},"types":{"admin":{"nom":"Administratif","mode":"payee","mots":["facture","factures","impôts","urssaf","banque","déclaration","contrat","papiers","comptes","compta","assurance","dossier","formulaire","payer","rendez-vous"]},"vente":{"nom":"Vente","mode":"payee","mots":[]},"creation":{"nom":"Création","mode":"racontee","mots":["écrire","rédiger","dessiner","enregistrer","tourner","édition","éditions","brouillon","chapitre","vidéo","leçon","maquette","peindre","composer","publier","monter"]},"relations":{"nom":"Relations","mode":"racontee","mots":["appeler","déjeuner","dîner","remercier","anniversaire","famille","ami","amie","amis","nouvelles","parents","inviter","voir"]},"sante":{"nom":"Santé","mode":"racontee","mots":["sport","marcher","marche","courir","course","dormir","méditer","médecin","dentiste","étirements","repos","yoga","natation","vélo","cuisiner"]}},"type_defaut":"admin","categories_note":{"Deep Focus":"creation","Créatif":"creation","Admin":"admin","Autre":""},"mots_vente":["offre","offres","relance","relances","relancer","prospect","prospects","message à","vente","ventes","inscription","inscriptions","liste d'attente","page de vente","abonné","abonnés","proposer","proposition","devis","client","clients","vendre"],"mots_newsletter":["édition","éditions","newsletter","newsletters","abonné","abonnés","Substack"],"lecteurs_par_quete":3,"temoignages":[],"lieux":{"studio":{"nom":"Le studio sous les toits","sous_titre":"Un ordinateur, une idée."},"coworking":{"nom":"Le poste en coworking","sous_titre":"Un premier résultat. Tu sors de chez toi."},"atelier":{"nom":"L'atelier","sous_titre":"Ton nom sur la porte."},"bureaux":{"nom":"Les grands bureaux","sous_titre":"Deux étages vitrés, une équipe."},"maison-edition":{"nom":"La maison d'édition","sous_titre":"Tout l'immeuble. Tes livres en vitrine."}},"agents":{"plume":{"nom":"Plume","role":"écriture","specialite":"creation"},"boussole":{"nom":"Boussole","role":"vente","specialite":"vente"},"archive":{"nom":"Archive","role":"administratif","specialite":"admin"},"croquis":{"nom":"Croquis","role":"création","specialite":"creation"},"timbre":{"nom":"Timbre","role":"liens et messages","specialite":"relations"},"relais":{"nom":"Relais","role":"forme et santé","specialite":"sante"},"reliure":{"nom":"Reliure","role":"édition","specialite":"creation"},"marge":{"nom":"Marge","role":"relecture","specialite":"admin"}},"caps":[{"id":"cap1","lieu":"coworking","premier":true},{"id":"cap2","lieu":"atelier","part":0.33},{"id":"cap3","lieu":"bureaux","part":1},{"id":"cap4","lieu":"maison-edition","part":1.67}],"caps_effort":[{"id":"eff1","piece":"studio/etagere","compteur":"quetes","seuil":5},{"id":"eff2","piece":"studio/micro","compteur":"contrats","seuil":3},{"id":"eff3","piece":"coworking/cabine","compteur":"vente","seuil":5},{"id":"eff4","piece":"coworking/objectifs","compteur":"semaines","seuil":2},{"id":"eff5","piece":"atelier/studio-son","compteur":"creation","seuil":10},{"id":"eff6","piece":"bureaux/salle-reunion","compteur":"vente","seuil":10},{"id":"eff7","piece":"bureaux/studio-video","compteur":"confiees","seuil":15},{"id":"eff8","piece":"maison-edition/grande-bibliotheque","compteur":"quetes","seuil":100},{"id":"eff9","piece":"maison-edition/salle-lecture","compteur":"relations","seuil":20},{"id":"eff10","piece":"maison-edition/presse","compteur":"contrats","seuil":15},{"id":"eff11","piece":"maison-edition/enseigne","compteur":"semaines","seuil":8}],"collegues":{"actif":false,"racine":"","exclure":"france-ia|franceia|france ia|france_ia","seuil_actif_s":120,"seuil_present_s":600,"nom":"titre","max":6},"systeme":{"actif":true,"xp":{"par_quete":20,"par_habitude":5,"par_quotidienne":10,"base_niveau":100,"pas_niveau":40},"plafonds":{"quetes_pleines":8,"taux_reduit":25,"habitude_par_jour":3,"etapes_par_jour":2},"points_par_niveau":3,"rangs":{"E":1,"D":5,"C":10,"B":18,"A":28,"S":40},"noms_stats":{"force":"Force","endurance":"Endurance","intelligence":"Intelligence","charisme":"Charisme","creativite":"Créativité"},"stats_par_type":{"admin":"endurance","vente":"intelligence","creation":"creativite","relations":"charisme","sante":"force"},"pratique_par_point":5,"pv":{"base":50,"par_force":2,"degats_quotidienne":8,"degats_habitude":3,"soin_quete":2},"or":{"par_quete":5,"par_habitude":2,"par_quotidienne":3},"butin":{"chance":25},"defi":{"quetes":3,"or":15,"butin":true},"penalite":{"actif":true,"quetes":2,"bonus_sortie":15},"quotidiennes":{"graces_par_semaine":1},"ombres":{"serie":14,"bonus":2},"donjon":{"pv_petit":100,"pv_moyen":250,"pv_grand":600,"degats":10,"xp":150,"or":80},"studio":{"prix_embauche":60,"places":3,"production_h_max":24,"recherche_par_quete":1},"saison":{"jours":90,"niveau_prestige":10,"bonus_prestige":10},"recompenses":[{"texte":"Un café en terrasse","prix":30},{"texte":"Un épisode de ta série","prix":40},{"texte":"Une heure de jeu","prix":60},{"texte":"Un bon restaurant","prix":200}]},"energie":{"actif":true,"demander_le_matin":true,"cout_defaut":2,"niveaux":[{"id":"plat","titre":"À plat","cout_max":1,"aide":"Juste les petites quêtes, sans te forcer."},{"id":"calme","titre":"Calme","cout_max":2,"aide":"Les petites, et une ou deux un peu plus longues."},{"id":"bien","titre":"Bien","cout_max":3,"aide":"Le rythme habituel."},{"id":"forme","titre":"En forme","cout_max":4,"aide":"Tu peux viser plus grand."},{"id":"elan","titre":"Plein d'élan","cout_max":5,"aide":"Les grosses quêtes d'abord."}]}};
  definir("/jeu/config.json-brut", function (require, module) { module.exports = CONFIG_PUBLIQUE; });

  definir("/jeu/serveur/energie.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/energie.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// Version 6 : l'énergie du jour.
// Tu choisis le matin comment tu te sens (3 à 5 niveaux, dont tu fixes les noms et les seuils).
// Le jeu te propose alors les quêtes qui collent : les petites quand tu es à plat, les plus grandes quand tu as de l'élan.
// Chaque quête a un coût d'énergie (de 1 à 5), que tu règles toi-même. Rien n'est imposé.

const NIVEAUX_DEFAUT = [
  { id: "plat", titre: "À plat", cout_max: 1, aide: "Juste les petites quêtes, sans te forcer." },
  { id: "calme", titre: "Calme", cout_max: 2, aide: "Les petites, et une ou deux un peu plus longues." },
  { id: "bien", titre: "Bien", cout_max: 3, aide: "Le rythme habituel." },
  { id: "forme", titre: "En forme", cout_max: 4, aide: "Tu peux viser plus grand." },
  { id: "elan", titre: "Plein d'élan", cout_max: 5, aide: "Les grosses quêtes d'abord." },
];

const DEFAUT = {
  actif: true,
  demander_le_matin: true,
  cout_defaut: 2,
  niveaux: NIVEAUX_DEFAUT.map((n) => ({ ...n })),
};

function estObjet(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function slug(titre) {
  return String(titre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function coutValide(v) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function normaliserNiveaux(liste) {
  const source = Array.isArray(liste) && liste.length ? liste : NIVEAUX_DEFAUT;
  const vus = new Set();
  const niveaux = [];
  for (let i = 0; i < source.length && niveaux.length < 5; i++) {
    const brut = source[i];
    const objet = estObjet(brut) ? brut : { titre: String(brut == null ? "" : brut) };
    const titre = typeof objet.titre === "string" && objet.titre.trim() ? objet.titre.trim().slice(0, 40) : "Niveau " + (niveaux.length + 1);
    let id = typeof objet.id === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(objet.id) ? objet.id : slug(titre);
    if (!id || vus.has(id)) id = "n" + (niveaux.length + 1);
    vus.add(id);
    const cout_max = coutValide(objet.cout_max) || Math.min(5, niveaux.length + 1);
    const aide = typeof objet.aide === "string" ? objet.aide.trim().slice(0, 140) : "";
    niveaux.push({ id, titre, cout_max, aide });
  }
  while (niveaux.length < 3) {
    const n = niveaux.length + 1;
    const id = "n" + n;
    if (vus.has(id)) break;
    vus.add(id);
    niveaux.push({ id, titre: "Niveau " + n, cout_max: n, aide: "" });
  }
  return niveaux;
}

// Accepte soit une liste d'objets (niveaux), soit deux listes venues des réglages (titres et coûts).
function completer(lu) {
  const c = estObjet(lu) ? lu : {};
  let liste = c.niveaux;
  if (Array.isArray(c.niveaux_titres) && c.niveaux_titres.some((t) => typeof t === "string" && t.trim())) {
    const titres = c.niveaux_titres.filter((t) => typeof t === "string");
    const couts = Array.isArray(c.niveaux_couts) ? c.niveaux_couts : [];
    const anciens = Array.isArray(c.niveaux) ? c.niveaux : [];
    liste = titres.map((t, i) => ({
      titre: t,
      cout_max: couts[i],
      id: estObjet(anciens[i]) ? anciens[i].id : undefined,
      aide: estObjet(anciens[i]) ? anciens[i].aide : undefined,
    }));
  }
  const niveaux = normaliserNiveaux(liste);
  return {
    actif: typeof c.actif === "boolean" ? c.actif : DEFAUT.actif,
    demander_le_matin: typeof c.demander_le_matin === "boolean" ? c.demander_le_matin : DEFAUT.demander_le_matin,
    cout_defaut: coutValide(c.cout_defaut) || DEFAUT.cout_defaut,
    niveaux,
    niveaux_titres: niveaux.map((n) => n.titre),
    niveaux_couts: niveaux.map((n) => n.cout_max),
  };
}

function trouverNiveau(configEnergie, id) {
  if (!configEnergie || !Array.isArray(configEnergie.niveaux) || typeof id !== "string") return null;
  return configEnergie.niveaux.find((n) => n.id === id) || null;
}

function coutDe(partie, element, configEnergie) {
  const id = element && element.id;
  const defaut = configEnergie && coutValide(configEnergie.cout_defaut) ? configEnergie.cout_defaut : DEFAUT.cout_defaut;
  if (partie && estObjet(partie.couts_energie) && coutValide(partie.couts_energie[id])) return partie.couts_energie[id];
  if (element && coutValide(element.cout_energie)) return element.cout_energie;
  return defaut;
}

function duJour(partie, date) {
  if (!partie || !estObjet(partie.energies) || typeof date !== "string") return null;
  const v = partie.energies[date];
  if (!estObjet(v) || typeof v.id !== "string") return null;
  return {
    id: v.id,
    titre: typeof v.titre === "string" ? v.titre : "",
    cout_max: coutValide(v.cout_max) || 3,
    heure: typeof v.heure === "string" ? v.heure : null,
  };
}

function choisir(partie, date, niveau, heure) {
  if (!estObjet(partie.energies)) partie.energies = {};
  partie.energies[date] = {
    id: niveau.id,
    titre: niveau.titre,
    cout_max: niveau.cout_max,
    heure: typeof heure === "string" ? heure : null,
  };
  const cles = Object.keys(partie.energies).sort();
  if (cles.length > 400) {
    for (const k of cles.slice(0, cles.length - 400)) delete partie.energies[k];
  }
  return partie.energies[date];
}

function poserCout(partie, id, cout) {
  if (!estObjet(partie.couts_energie)) partie.couts_energie = {};
  partie.couts_energie[id] = cout;
}

function suggerer(ouvertes, energie, configEnergie) {
  const defaut = configEnergie && coutValide(configEnergie.cout_defaut) ? configEnergie.cout_defaut : DEFAUT.cout_defaut;
  const liste = Array.isArray(ouvertes) ? ouvertes.filter((q) => q && !q.payee) : [];
  if (!energie) {
    return {
      adaptees: [],
      plus_lourdes: liste.map((q) => q.id),
      ordre: liste.map((q) => q.id),
      message: "Choisis d'abord comment tu te sens aujourd'hui.",
    };
  }
  const max = coutValide(energie.cout_max) || 3;
  const adaptees = [];
  const plus_lourdes = [];
  const cle = (q) => coutValide(q.cout_energie) || defaut;
  for (const q of liste) {
    if (cle(q) <= max) adaptees.push(q);
    else plus_lourdes.push(q);
  }
  if (max <= 2) adaptees.sort((a, b) => cle(a) - cle(b) || String(a.texte || "").localeCompare(String(b.texte || ""), "fr"));
  else if (max >= 4) adaptees.sort((a, b) => cle(b) - cle(a) || String(a.texte || "").localeCompare(String(b.texte || ""), "fr"));
  else adaptees.sort((a, b) => Math.abs(cle(a) - 3) - Math.abs(cle(b) - 3) || cle(a) - cle(b));

  let message;
  const titre = energie.titre || "cette énergie";
  if (!liste.length) message = "Aucune quête ouverte pour l'instant.";
  else if (adaptees.length && plus_lourdes.length) {
    message =
      adaptees.length === 1
        ? "Une quête colle à « " + titre + " ». Les plus lourdes restent en bas, si tu veux."
        : adaptees.length + " quêtes collent à « " + titre + " ». Les plus lourdes restent en bas, si tu veux.";
  } else if (adaptees.length) message = "Tout ce qui est ouvert colle à « " + titre + " ».";
  else message = "Rien d'ouvert ne tient dans « " + titre + " ». Tu peux baisser le coût d'une quête, ou la reporter.";

  return {
    adaptees: adaptees.map((q) => q.id),
    plus_lourdes: plus_lourdes.map((q) => q.id),
    ordre: adaptees.concat(plus_lourdes).map((q) => q.id),
    message,
  };
}

function vue(partie, ouvertes, date, configEnergie) {
  const conf = completer(configEnergie);
  const choisi = duJour(partie, date);
  const a_choisir = conf.actif && conf.demander_le_matin && !choisi;
  const suggestions = conf.actif
    ? suggerer(ouvertes, choisi, conf)
    : { adaptees: [], plus_lourdes: [], ordre: (Array.isArray(ouvertes) ? ouvertes : []).filter((q) => q && !q.payee).map((q) => q.id), message: "" };
  return {
    actif: conf.actif,
    demander_le_matin: conf.demander_le_matin,
    cout_defaut: conf.cout_defaut,
    niveaux: conf.niveaux,
    choisi,
    a_choisir,
    suggestions,
  };
}

function normaliserPartie(lue) {
  const energies = {};
  const couts = {};
  if (estObjet(lue) && estObjet(lue.energies)) {
    for (const date of Object.keys(lue.energies)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const v = lue.energies[date];
      if (!estObjet(v) || typeof v.id !== "string") continue;
      energies[date] = {
        id: String(v.id).slice(0, 32),
        titre: typeof v.titre === "string" ? v.titre.slice(0, 40) : "",
        cout_max: coutValide(v.cout_max) || 3,
        heure: typeof v.heure === "string" ? v.heure : null,
      };
    }
  }
  if (estObjet(lue) && estObjet(lue.couts_energie)) {
    for (const id of Object.keys(lue.couts_energie)) {
      if (typeof id !== "string" || id === "__proto__" || id === "constructor" || id === "prototype") continue;
      const c = coutValide(lue.couts_energie[id]);
      if (c) couts[id] = c;
    }
  }
  return { energies, couts_energie: couts };
}

module.exports = {
  DEFAUT,
  NIVEAUX_DEFAUT,
  completer,
  normaliserNiveaux,
  coutValide,
  coutDe,
  duJour,
  choisir,
  poserCout,
  suggerer,
  trouverNiveau,
  vue,
  normaliserPartie,
};

  });

  definir("/jeu/serveur/parseurs.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/parseurs.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// Fonctions pures : aucun accès disque, aucune horloge cachée.

const crypto = require("node:crypto");

// ---------------------------------------------------------------- préalables

function preparer(texte) {
  let t = String(texte == null ? "" : texte);
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return t.replace(/\r\n?/g, "\n").normalize("NFC");
}

// ---------------------------------------------------------------- frontmatter

function lireFrontmatter(texteBrut) {
  const texte = preparer(texteBrut);
  const lignes = texte.split("\n");
  if (lignes[0].trimEnd() !== "---") return { donnees: {}, corps: texte };
  let fin = -1;
  for (let i = 1; i < lignes.length; i++) {
    if (lignes[i].trimEnd() === "---") {
      fin = i;
      break;
    }
  }
  if (fin === -1) return { donnees: {}, corps: texte };
  const donnees = {};
  for (let i = 1; i < fin; i++) {
    const m = /^([^\s:#][^:]*):(.*)$/.exec(lignes[i]);
    if (!m) continue;
    let v = m[2].trim();
    const guillemet = v[0];
    if (v.length >= 2 && (guillemet === '"' || guillemet === "'") && v[v.length - 1] === guillemet) {
      v = v.slice(1, -1).trim();
    }
    donnees[m[1].trim()] = v;
  }
  return { donnees, corps: lignes.slice(fin + 1).join("\n") };
}

// ---------------------------------------------------------------- dates

function dateValide(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function ajouterJours(dateISO, n) {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function semaineISO(dateISO) {
  const d = new Date(dateISO + "T00:00:00Z");
  const jour = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - jour + 3); // jeudi de la même semaine
  const annee = d.getUTCFullYear();
  const j4 = new Date(Date.UTC(annee, 0, 4)); // le 4 janvier est toujours en semaine 1
  const lundi1 = new Date(j4);
  lundi1.setUTCDate(j4.getUTCDate() - ((j4.getUTCDay() + 6) % 7));
  const semaine = 1 + Math.floor((d - lundi1) / (7 * 86400000));
  return { annee, semaine, id: annee + "-W" + String(semaine).padStart(2, "0") };
}

function lundiDe(idSemaine) {
  const m = /^(\d{4})-W(\d{2})$/.exec(idSemaine);
  if (!m) return null;
  const j4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  j4.setUTCDate(j4.getUTCDate() - ((j4.getUTCDay() + 6) % 7) + (Number(m[2]) - 1) * 7);
  return j4.toISOString().slice(0, 10);
}

// Date du jour dans un fuseau, au format AAAA-MM-JJ.
function dateDuJour(fuseau, maintenant) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseau,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(maintenant || new Date());
}

function partiesHorloge(fuseau, maintenant) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseau,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(maintenant || new Date());
  const o = {};
  for (const p of parts) o[p.type] = p.value;
  return o;
}

// Heure locale "HH:MM" et horodatage ISO avec décalage, pour une date donnée.
function horloge(fuseau, dateISO, maintenant) {
  const m = maintenant || new Date();
  const o = partiesHorloge(fuseau, m);
  const localeUTC = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second);
  const decalageMin = Math.round((localeUTC - Math.floor(m.getTime() / 1000) * 1000) / 60000);
  const signe = decalageMin < 0 ? "-" : "+";
  const abs = Math.abs(decalageMin);
  const decalage = signe + String(Math.floor(abs / 60)).padStart(2, "0") + ":" + String(abs % 60).padStart(2, "0");
  const heure = o.hour + ":" + o.minute;
  const date = dateISO || o.year + "-" + o.month + "-" + o.day;
  return { date, heure, heureNum: Number(o.hour), horodatage: date + "T" + heure + ":" + o.second + decalage };
}

// ---------------------------------------------------------------- semaine

function comparerSemaines(a, b) {
  return a.annee !== b.annee ? a.annee - b.annee : a.semaine - b.semaine;
}

// noms : fichiers du dossier de la phase. Renvoie null si aucun ne convient.
function choisirSemaine(noms, dateISO) {
  const fichiers = [];
  for (const nom of noms) {
    const m = /^(\d{4})-W(\d{2})\.md$/.exec(String(nom).normalize("NFC"));
    if (m) fichiers.push({ fichier: nom, annee: Number(m[1]), semaine: Number(m[2]), id: m[1] + "-W" + m[2] });
  }
  if (fichiers.length === 0) return null;
  const cible = semaineISO(dateISO);
  const exact = fichiers.find((f) => comparerSemaines(f, cible) === 0);
  if (exact) return { id: exact.id, fichier: exact.fichier, statut: "courante" };
  const suivante = semaineISO(ajouterJours(dateISO, 7));
  const avant = fichiers.filter((f) => comparerSemaines(f, suivante) <= 0).sort(comparerSemaines);
  if (avant.length === 0) return null;
  const choisi = avant[avant.length - 1];
  return {
    id: choisi.id,
    fichier: choisi.fichier,
    statut: comparerSemaines(choisi, suivante) === 0 ? "suivante" : "ancienne",
  };
}

// ---------------------------------------------------------------- nettoyage

// [[a]] donne a ; [[a|b]] et [[a\|b]] donnent b.
function remplacerWikilinks(texte) {
  return texte.replace(/\[\[([^\[\]]+)\]\]/g, (_, contenu) => {
    const morceaux = contenu.split(/\\?\|/);
    return morceaux[morceaux.length - 1].trim();
  });
}

function nettoyerLibelle(texte) {
  return remplacerWikilinks(String(texte)).replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();
}

function normaliserPourRecherche(texte) {
  return String(texte)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘ʼ´`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliserPourId(texte) {
  return remplacerWikilinks(String(texte).normalize("NFC").toLowerCase())
    .replace(/[*`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;:!?\s]+$/u, "");
}

function h(x) {
  return crypto.createHash("sha1").update(x, "utf8").digest("hex").slice(0, 12);
}

function idQuete(semaine, categorie, groupe, texte) {
  return "L-" + h(semaine + "\n" + categorie + "\n" + groupe + "\n" + normaliserPourId(texte));
}

function idPriorite(semaine, dateISO, texte) {
  return "P-" + h(semaine + "\n" + dateISO + "\n" + normaliserPourId(texte));
}

function idGeste(titreEtat, nom) {
  return "G-" + h(normaliserPourId(titreEtat) + "\n" + normaliserPourId(nom));
}

// Suffixe -2, -3 pour des identifiants identiques dans une même liste.
function departager(vus, id) {
  const n = (vus.get(id) || 0) + 1;
  vus.set(id, n);
  return n === 1 ? id : id + "-" + n;
}

// ---------------------------------------------------------------- ventes

// Vrai si l'un des mots apparaît en mot entier (ni lettre ni chiffre autour).
function contientMot(texte, mots) {
  const t = normaliserPourRecherche(texte);
  for (const mot of mots || []) {
    const m = normaliserPourRecherche(mot);
    if (!m) continue;
    let depart = 0;
    for (;;) {
      const i = t.indexOf(m, depart);
      if (i === -1) break;
      const avant = i === 0 ? "" : t[i - 1];
      const apres = i + m.length >= t.length ? "" : t[i + m.length];
      if (!/[\p{L}\p{N}]/u.test(avant) && !/[\p{L}\p{N}]/u.test(apres)) return true;
      depart = i + 1;
    }
  }
  return false;
}

function estVente(texte, mots) {
  return contientMot(texte, mots);
}

// Quête secondaire : une ligne liée à l'édition ou aux abonnés.
function estNewsletter(texte, mots) {
  return contientMot(texte, mots);
}

// ---------------------------------------------------------------- quêtes de la semaine

const CATEGORIES = ["Deep Focus", "Créatif", "Admin"];

function categorieDe(titre) {
  const t = normaliserPourRecherche(nettoyerLibelle(titre));
  for (const c of CATEGORIES) {
    const n = normaliserPourRecherche(c);
    if (t === n || (t.startsWith(n) && !/[\p{L}\p{N}]/u.test(t[n.length]))) return c;
  }
  return "Autre";
}

function lireQuetes(texteNote, idSemaine, motsVente, motsNewsletter) {
  const { corps } = lireFrontmatter(texteNote);
  const quetes = [];
  const vus = new Map();
  let categorie = "Autre";
  let groupe = "";
  for (const ligne of corps.split("\n")) {
    let m = /^##\s+(.+?)\s*$/.exec(ligne);
    if (m) {
      categorie = categorieDe(m[1]);
      groupe = "";
      continue;
    }
    m = /^###\s+(.+?)\s*$/.exec(ligne);
    if (m) {
      groupe = nettoyerLibelle(m[1]);
      continue;
    }
    m = /^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/.exec(ligne);
    if (!m) continue;
    const texte = nettoyerLibelle(m[2]);
    if (!texte) continue;
    quetes.push({
      id: departager(vus, idQuete(idSemaine, categorie, groupe, m[2])),
      texte,
      categorie,
      groupe,
      cochee: m[1] !== " ",
      vente_auto: estVente(texte, motsVente),
      newsletter: estNewsletter(texte, motsNewsletter),
    });
  }
  return quetes;
}

// ---------------------------------------------------------------- priorités du jour

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const ABREVIATIONS = new Set(["etc", "cf", "ex", "env", "M", "Mme", "Dr", "St", "vs"]);

function decouperPriorites(cellule) {
  const texte = String(cellule);
  const morceaux = [];
  let profondeur = 0;
  let debut = 0;
  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (ch === "(" || ch === "«") profondeur++;
    else if (ch === ")" || ch === "»") profondeur = Math.max(0, profondeur - 1);
    else if (ch === "." && profondeur === 0) {
      const suite = texte.slice(i + 1);
      if (!(suite.trim() === "" || /^\s+[\p{Lu}\d]/u.test(suite))) continue;
      const mot = /([\p{L}]+)$/u.exec(texte.slice(debut, i));
      if (mot && (ABREVIATIONS.has(mot[1]) || ABREVIATIONS.has(mot[1].toLowerCase()))) continue;
      morceaux.push(texte.slice(debut, i));
      debut = i + 1;
    }
  }
  morceaux.push(texte.slice(debut));
  return morceaux.map((m) => m.replace(/\s+/g, " ").trim().replace(/\.+$/, "").trim()).filter((m) => m !== "");
}

function decouperLigneTableau(ligne) {
  const cellules = ligne.trim().split(/(?<!\\)\|/);
  if (cellules.length && cellules[0].trim() === "") cellules.shift();
  if (cellules.length && cellules[cellules.length - 1].trim() === "") cellules.pop();
  return cellules.map((c) => c.replace(/\\\|/g, "|").trim());
}

function lirePlanJours(texteNote, idSemaine) {
  const { corps } = lireFrontmatter(texteNote);
  const lignes = corps.split("\n");
  const jours = [];
  const avertissements = [];
  const lundi = lundiDe(idSemaine);
  let i = lignes.findIndex((l) => /^##\s+plan jour par jour/i.test(l));
  if (i === -1 || !lundi) return { jours, avertissements };
  i++;
  while (i < lignes.length && lignes[i].trim() === "") i++;
  const vus = new Map();
  for (; i < lignes.length && lignes[i].trimStart().startsWith("|"); i++) {
    const cellules = decouperLigneTableau(lignes[i]);
    if (cellules.length < 2) continue;
    if (cellules.every((c) => /^[-:\s]*$/.test(c))) continue; // ligne de séparation
    const m = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})/i.exec(nettoyerLibelle(cellules[0]));
    if (!m) continue; // en-tête ou ligne libre
    const rang = JOURS.indexOf(m[1].toLowerCase());
    const date = ajouterJours(lundi, rang);
    if (Number(m[2]) !== Number(date.slice(8, 10))) {
      avertissements.push(
        "Dans le plan jour par jour, « " + nettoyerLibelle(cellules[0]) + " » ne tombe pas le " + Number(date.slice(8, 10)) + ". Je garde le jour de la semaine."
      );
    }
    const priorites = decouperPriorites(cellules[1]).map((brut) => ({
      id: departager(vus, idPriorite(idSemaine, date, brut)),
      texte: nettoyerLibelle(brut),
    }));
    jours.push({ date, libelle: nettoyerLibelle(cellules[0]), priorites });
  }
  return { jours, avertissements };
}

// ---------------------------------------------------------------- stratégies par état

function lireStrategies(texteIntention) {
  const { corps } = lireFrontmatter(texteIntention);
  const lignes = corps.split("\n");
  const resultat = { regle_commune: "", etats: [] };
  let i = lignes.findIndex((l) => /^##\s+stratégies par état/i.test(l));
  if (i === -1) return resultat;
  let etat = null;
  for (i++; i < lignes.length; i++) {
    const ligne = lignes[i];
    if (/^##\s/.test(ligne) || /^---\s*$/.test(ligne)) break;
    let m = /^###\s+(.+?)\s*$/.exec(ligne);
    if (m) {
      const titre = nettoyerLibelle(m[1]);
      const sansPrefixe = titre.replace(/^je suis\s+/i, "");
      etat = {
        titre,
        libelle: sansPrefixe.charAt(0).toUpperCase() + sansPrefixe.slice(1),
        signal: "",
        gestes: [],
      };
      resultat.etats.push(etat);
      continue;
    }
    if (!etat && /^\*\*Règle commune/i.test(ligne)) {
      resultat.regle_commune = remplacerWikilinks(ligne).replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
      continue;
    }
    if (!etat) continue;
    m = /^\*Signal\s*:\s*(.+?)\*\s*$/.exec(ligne);
    if (m) {
      etat.signal = nettoyerLibelle(m[1]);
      continue;
    }
    m = /^-\s+\*\*(.+?)\*\*\s*(.*)$/.exec(ligne);
    if (m) {
      const nom = nettoyerLibelle(m[1]);
      const description = nettoyerLibelle(m[2].replace(/^\s*:\s*/, "")).replace(/\*/g, "");
      etat.gestes.push({ id: idGeste(etat.titre, nom), nom, description });
    }
  }
  return resultat;
}

// ---------------------------------------------------------------- mission (intention)

// Première phrase d'un texte : coupe sur . ! ? hors parenthèses, jamais après une abréviation (M., cf., etc.).
function premierePhrase(texte) {
  let profondeur = 0;
  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (ch === "(" || ch === "«") profondeur++;
    else if (ch === ")" || ch === "»") profondeur = Math.max(0, profondeur - 1);
    else if ((ch === "." || ch === "!" || ch === "?" || ch === "…") && profondeur === 0) {
      const suite = texte.slice(i + 1);
      if (!(suite.trim() === "" || /^\s+[\p{Lu}\d«]/u.test(suite))) continue;
      if (ch === ".") {
        const mot = /([\p{L}]+)$/u.exec(texte.slice(0, i));
        if (mot && (ABREVIATIONS.has(mot[1]) || ABREVIATIONS.has(mot[1].toLowerCase()))) continue;
      }
      return texte.slice(0, i + 1);
    }
  }
  return texte;
}

// Premier paragraphe de la section « Mon intention », et les objectifs principaux.
// Sert à l'affiche « Mission » accrochée au mur. Rien n'est inventé : tout vient de la note.
function lireMission(texteIntention) {
  const { corps } = lireFrontmatter(texteIntention);
  const lignes = corps.split("\n");
  const resultat = { texte: "", phrase: "", objectifs: [] };
  let i = lignes.findIndex((l) => /^##\s+mon intention/i.test(l));
  if (i !== -1) {
    const paragraphe = [];
    for (i++; i < lignes.length; i++) {
      const ligne = lignes[i].trim();
      if (/^##\s/.test(ligne) || /^---\s*$/.test(ligne)) break;
      if (ligne === "") {
        if (paragraphe.length) break;
        continue;
      }
      if (/^[*_].*[*_]$/.test(ligne) && paragraphe.length === 0) continue; // ligne d'italique seule
      paragraphe.push(ligne);
    }
    resultat.texte = nettoyerLibelle(paragraphe.join(" ")).replace(/\*/g, "");
    resultat.phrase = premierePhrase(resultat.texte);
  }
  let j = lignes.findIndex((l) => /^##\s+mes objectifs/i.test(l));
  if (j !== -1) {
    for (j++; j < lignes.length; j++) {
      if (/^##\s/.test(lignes[j]) || /^---\s*$/.test(lignes[j])) break;
      const m = /^\s*[-*]\s+(?:\[[ xX]\]\s+)?(.+)$/.exec(lignes[j]);
      if (m) resultat.objectifs.push(nettoyerLibelle(m[1]).replace(/\*/g, ""));
    }
    resultat.objectifs = resultat.objectifs.slice(0, 5);
  }
  return resultat;
}

module.exports = {
  preparer,
  lireFrontmatter,
  dateValide,
  ajouterJours,
  semaineISO,
  lundiDe,
  dateDuJour,
  horloge,
  choisirSemaine,
  remplacerWikilinks,
  nettoyerLibelle,
  normaliserPourRecherche,
  normaliserPourId,
  h,
  idQuete,
  idPriorite,
  idGeste,
  contientMot,
  estVente,
  estNewsletter,
  lireMission,
  categorieDe,
  lireQuetes,
  decouperPriorites,
  lirePlanJours,
  lireStrategies,
};

  });

  definir("/jeu/serveur/quetes.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/quetes.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// Quêtes du jeu : le fichier data/quetes.md. Fonctions pures, aucun accès disque.
// Ce fichier est écrit par le skill /quetes (après validation du joueur), par le joueur à la main,
// ou par le jeu quand le joueur écrit une tâche dans l'écran. Le jeu le relit à chaque passage.
//
// Format :
//   ## Semaine du 16 novembre            (titre libre : il sert de groupe)
//   - [ ] Relancer trois prospects @vente
//     - 1 : un message envoyé
//     - 2 : trois messages envoyés
//     - 3 : trois messages et une réponse
//   - [ ] Appeler Mamie @relations

const P = require("./parseurs");

const ENTETE = [
  "# Quêtes du jeu",
  "",
  "Ce fichier appartient au jeu. Le skill /quetes y écrit les quêtes que tu as validées.",
  "Tu peux aussi l'écrire à la main : une case par quête, un type après l'arobase",
  "(@admin, @vente, @creation, @relations, @sante), et trois lignes en retrait pour les trois degrés.",
  "",
].join("\n");

const ALIAS_TYPES = {
  admin: "admin",
  administratif: "admin",
  vente: "vente",
  ventes: "vente",
  creation: "creation",
  creatif: "creation",
  relation: "relations",
  relations: "relations",
  sante: "sante",
};

const RE_TACHE = /^(\s*)[-*]\s+\[( |x|X)\]\s+(.+?)\s*$/;
const RE_DEGRE = /^\s+[-*]\s+([123])\s*(?:étoiles?|etoiles?)?\s*[:.)]\s*(.+?)\s*$/i;
const RE_TAG = /\s+@([\p{L}]+)\s*$/u;
const RE_COUT = /\s+~([1-5])\s*$/;

function typeDuTag(tag) {
  return ALIAS_TYPES[P.normaliserPourRecherche(tag)] || null;
}

function idLocale(groupe, texte) {
  return "Q-" + P.h(groupe + "\n" + P.normaliserPourId(texte));
}

// Lit le fichier. Renvoie les quêtes dans l'ordre, avec leur numéro de ligne (pour cocher).
function lire(texteBrut, motsVente, motsNewsletter) {
  const lignes = P.preparer(texteBrut).split("\n");
  const quetes = [];
  const avertissements = [];
  const vus = new Map();
  let groupe = "";
  let courante = null;
  lignes.forEach((ligne, numero) => {
    let m = /^#{2,3}\s+(.+?)\s*$/.exec(ligne);
    if (m) {
      groupe = P.nettoyerLibelle(m[1]).slice(0, 60);
      courante = null;
      return;
    }
    m = RE_TACHE.exec(ligne);
    if (m && m[1].length < 2) {
      let brut = m[3];
      let type = null;
      let cout_energie = null;
      const cout = RE_COUT.exec(brut);
      if (cout) {
        cout_energie = Number(cout[1]);
        brut = brut.slice(0, cout.index);
      }
      const tag = RE_TAG.exec(brut);
      if (tag) {
        type = typeDuTag(tag[1]);
        if (type) brut = brut.slice(0, tag.index);
        else avertissements.push("Ligne " + (numero + 1) + " de quetes.md : type inconnu « @" + tag[1] + " ».");
      }
      const texte = P.nettoyerLibelle(brut).slice(0, 200);
      if (!texte) {
        courante = null;
        return;
      }
      let id = idLocale(groupe, brut);
      const n = (vus.get(id) || 0) + 1;
      vus.set(id, n);
      if (n > 1) id += "-" + n;
      courante = {
        id,
        texte,
        categorie: "Jeu",
        groupe,
        origine: "locale",
        cochee: m[2] !== " ",
        tag: type,
        degres_ecrits: [null, null, null],
        ligne: numero,
        vente_auto: type ? type === "vente" : P.estVente(texte, motsVente || []),
        newsletter: P.estNewsletter(texte, motsNewsletter || []),
        cout_energie,
      };
      quetes.push(courante);
      return;
    }
    m = RE_DEGRE.exec(ligne);
    if (m && courante) {
      courante.degres_ecrits[Number(m[1]) - 1] = P.nettoyerLibelle(m[2]).slice(0, 120);
      return;
    }
    if (ligne.trim() !== "" && !/^\s+/.test(ligne)) courante = null;
  });
  return { quetes, avertissements };
}

function ligneQuete(texte, type, cout) {
  return "- [ ] " + texte + (type ? " @" + type : "") + (cout ? " ~" + cout : "");
}

function lignesDegres(degres) {
  if (!Array.isArray(degres)) return [];
  const lignes = [];
  degres.forEach((d, i) => {
    if (typeof d === "string" && d.trim()) lignes.push("  - " + (i + 1) + " : " + d.trim());
  });
  return lignes;
}

// Ajoute une quête à la fin de la section du jour (créée au besoin). Renvoie le nouveau texte.
function ajouter(texteBrut, quete, titreSection) {
  let texte = texteBrut === null || texteBrut === undefined || String(texteBrut).trim() === "" ? ENTETE : P.preparer(texteBrut);
  if (!texte.endsWith("\n")) texte += "\n";
  const lignes = texte.split("\n");
  lignes.pop(); // la dernière entrée vide
  const titre = "## " + titreSection;
  let debut = -1;
  for (let i = lignes.length - 1; i >= 0; i--) {
    if (lignes[i].trim() === titre) {
      debut = i;
      break;
    }
  }
  const nouvelles = [ligneQuete(quete.texte, quete.type, quete.cout_energie), ...lignesDegres(quete.degres)];
  if (debut === -1) {
    if (lignes.length && lignes[lignes.length - 1].trim() !== "") lignes.push("");
    lignes.push(titre, "", ...nouvelles);
  } else {
    let fin = lignes.length;
    for (let i = debut + 1; i < lignes.length; i++) {
      if (/^#{1,3}\s/.test(lignes[i])) {
        fin = i;
        break;
      }
    }
    while (fin > debut + 1 && lignes[fin - 1].trim() === "") fin--;
    lignes.splice(fin, 0, ...nouvelles);
  }
  return lignes.join("\n") + "\n";
}

// Coche ou décoche la case d'une quête (retrouvée par son numéro de ligne). Renvoie le nouveau texte, ou null.
function cocher(texteBrut, quete, cochee) {
  const lignes = P.preparer(texteBrut).split("\n");
  const ligne = lignes[quete.ligne];
  if (typeof ligne !== "string" || !RE_TACHE.test(ligne)) return null;
  const nouvelle = ligne.replace(/\[( |x|X)\]/, cochee ? "[x]" : "[ ]");
  if (nouvelle === ligne) return null;
  lignes[quete.ligne] = nouvelle;
  return lignes.join("\n");
}

// Retire une quête et ses degrés. Renvoie le nouveau texte, ou null.
function retirer(texteBrut, quete) {
  const lignes = P.preparer(texteBrut).split("\n");
  if (typeof lignes[quete.ligne] !== "string" || !RE_TACHE.test(lignes[quete.ligne])) return null;
  let fin = quete.ligne + 1;
  while (fin < lignes.length && RE_DEGRE.test(lignes[fin])) fin++;
  lignes.splice(quete.ligne, fin - quete.ligne);
  return lignes.join("\n");
}

module.exports = { ENTETE, ALIAS_TYPES, lire, ajouter, cocher, retirer, typeDuTag, idLocale };

  });

  definir("/jeu/serveur/catalogue.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/catalogue.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// Données du jeu, version 2 : cinq lieux dans l'immeuble, leurs améliorations,
// les objets décoratifs (boutique du jour, colis surprise), les agents maison, les badges.

// type : "objet" (se place sur la grille) ou "piece" (ouvre une pièce fermée).
// pose : "sol" ou "mur", pour le rangement.
const LIEUX = [
  {
    id: "studio",
    nom: "Le studio sous les toits",
    sous_titre: "Un ordinateur, une idée.",
    etage: "Sous les toits",
    ameliorations: [
      { id: "lampadaire", nom: "Lampe sur pied", prix: 30, type: "objet", pose: "sol", phrase: "Pour les matins d'hiver." },
      { id: "plante", nom: "Plante verte", prix: 40, type: "objet", pose: "sol", phrase: "Un peu de vivant près de l'écran." },
      { id: "tapis", nom: "Tapis tissé", prix: 50, type: "objet", pose: "sol", phrase: "Le parquet grince moins." },
      { id: "etagere", nom: "Étagère de livres", prix: 80, type: "objet", pose: "mur", phrase: "Tes références à portée de main." },
      { id: "micro", nom: "Micro sur pied", prix: 120, type: "objet", pose: "sol", phrase: "Ta voix, en mieux." },
      { id: "fauteuil", nom: "Fauteuil de lecture", prix: 150, type: "objet", pose: "sol", phrase: "Un agent s'y installe pour relire." },
    ],
  },
  {
    id: "coworking",
    nom: "Le poste en coworking",
    sous_titre: "Un premier résultat. Tu sors de chez toi.",
    etage: "Rez-de-chaussée voisin",
    ameliorations: [
      { id: "ficus", nom: "Grand ficus", prix: 50, type: "objet", pose: "sol", phrase: "Il monte presque au plafond." },
      { id: "casier", nom: "Casier à ton nom", prix: 60, type: "objet", pose: "sol", phrase: "Tu laisses tes affaires, tu reviens demain." },
      { id: "fontaine", nom: "Fontaine à eau", prix: 70, type: "objet", pose: "sol", phrase: "Le lieu des petites nouvelles." },
      { id: "objectifs", nom: "Tableau d'objectifs", prix: 90, type: "objet", pose: "mur", phrase: "Trois lignes, une par priorité." },
      { id: "velo", nom: "Vélo accroché", prix: 110, type: "objet", pose: "mur", phrase: "Tu viens en roulant." },
      { id: "cabine", nom: "Cabine d'appel", prix: 140, type: "objet", pose: "sol", phrase: "Pour tes appels de vente." },
    ],
  },
  {
    id: "atelier",
    nom: "L'atelier",
    sous_titre: "Ton nom sur la porte.",
    etage: "Troisième étage",
    ameliorations: [
      { id: "horloge", nom: "Horloge d'atelier", prix: 60, type: "objet", pose: "mur", phrase: "Elle sonne à 8 h, l'heure de l'édition." },
      { id: "tableau-blanc", nom: "Tableau blanc", prix: 90, type: "objet", pose: "mur", phrase: "Une courbe qui monte." },
      { id: "table-dessin", nom: "Table à dessin", prix: 120, type: "objet", pose: "sol", phrase: "De la place pour étaler tes plans." },
      { id: "canape", nom: "Canapé des visiteurs", prix: 150, type: "objet", pose: "sol", phrase: "Tes premiers rendez-vous." },
      { id: "bibliotheque", nom: "Bibliothèque", prix: 180, type: "objet", pose: "sol", phrase: "Un pan de mur en livres." },
      { id: "studio-son", nom: "Salle d'enregistrement", prix: 220, type: "piece", phrase: "Silence, on enregistre." },
    ],
  },
  {
    id: "bureaux",
    nom: "Les grands bureaux",
    sous_titre: "Deux étages vitrés, une équipe.",
    etage: "Premier et deuxième étages",
    ameliorations: [
      { id: "jardiniere", nom: "Jardinière", prix: 100, type: "objet", pose: "sol", phrase: "Trois plantes d'un coup." },
      { id: "banquette", nom: "Banquette", prix: 140, type: "objet", pose: "sol", phrase: "On s'y pose entre deux tâches." },
      { id: "neon", nom: "Néon de l'enseigne", prix: 160, type: "objet", pose: "mur", phrase: "Il s'allume à la tombée du jour." },
      { id: "salle-reunion", nom: "Salle de réunion", prix: 200, type: "piece", phrase: "Une porte vitrée, une grande table." },
      { id: "mur-abonnes", nom: "Mur des abonnés", prix: 240, type: "objet", pose: "mur", phrase: "Un carré par lecteur passé te voir." },
      { id: "studio-video", nom: "Studio vidéo", prix: 260, type: "piece", phrase: "Caméra, lumière, action." },
    ],
  },
  {
    id: "maison-edition",
    nom: "La maison d'édition",
    sous_titre: "Tout l'immeuble. Tes livres en vitrine.",
    etage: "Rez-de-chaussée et façade",
    ameliorations: [
      { id: "lampe-lecture", nom: "Lampe de lecture", prix: 150, type: "objet", pose: "sol", phrase: "Un abat-jour vert, comme dans les grandes salles." },
      { id: "collection", nom: "Ta collection de livres", prix: 250, type: "objet", pose: "sol", phrase: "Un présentoir, tes titres de face." },
      { id: "grande-bibliotheque", nom: "Grande bibliothèque", prix: 300, type: "piece", phrase: "Un mur de livres, avec son échelle qui roule." },
      { id: "salle-lecture", nom: "Salle de lecture", prix: 320, type: "piece", phrase: "On y entre, on baisse la voix." },
      { id: "presse", nom: "Presse à imprimer", prix: 380, type: "piece", phrase: "Elle tourne quand tu avances." },
      { id: "enseigne", nom: "Enseigne en façade", prix: 450, type: "piece", phrase: "Ton nom, vu depuis la rue." },
    ],
  },
];

// Plateaux où l'on peut poser un objet, et lieu qui doit être ouvert pour s'en servir.
const ZONES = {
  studio: "studio",
  coworking: "coworking",
  atelier: "atelier",
  "bureaux-haut": "bureaux",
  "bureaux-bas": "bureaux",
  maison: "maison-edition",
};

// Objets décoratifs. Trois sont en boutique chaque jour. Les colis surprise piochent dans toute la liste.
const DECOS = [
  { id: "globe", nom: "Globe terrestre", prix: 60, pose: "sol", phrase: "Pour rêver à tes lecteurs lointains." },
  { id: "affiche", nom: "Affiche encadrée", prix: 45, pose: "mur", phrase: "Un soleil terracotta sur fond crème." },
  { id: "coucou", nom: "Pendule à coucou", prix: 70, pose: "mur", phrase: "Il sort à chaque heure pleine." },
  { id: "aquarium", nom: "Aquarium", prix: 110, pose: "sol", phrase: "Deux poissons, zéro réunion." },
  { id: "radio", nom: "Poste de radio", prix: 55, pose: "sol", phrase: "Un fond sonore qui ne dérange pas." },
  { id: "cactus", nom: "Cactus en pot", prix: 35, pose: "sol", phrase: "Il ne fane jamais, lui." },
  { id: "guirlande", nom: "Guirlande lumineuse", prix: 65, pose: "mur", phrase: "Le soir, elle fait toute l'ambiance." },
  { id: "tourne-disque", nom: "Tourne-disque", prix: 95, pose: "sol", phrase: "Une face par bloc de travail." },
  { id: "machine-ecrire", nom: "Machine à écrire", prix: 90, pose: "sol", phrase: "Pour te rappeler d'où viennent les livres." },
  { id: "miroir", nom: "Miroir doré", prix: 75, pose: "mur", phrase: "La pièce paraît deux fois plus grande." },
  { id: "bonsai", nom: "Bonsaï", prix: 85, pose: "sol", phrase: "La patience, en pot." },
  { id: "lanterne", nom: "Lanterne", prix: 50, pose: "sol", phrase: "Une petite flamme pour les soirs de bouclage." },
  { id: "carte-monde", nom: "Carte du monde", prix: 80, pose: "mur", phrase: "Une épingle par pays de lecteurs." },
  { id: "panier-chat", nom: "Panier du chat", prix: 60, pose: "sol", phrase: "Le chat de l'immeuble adopte ton étage." },
  { id: "longue-vue", nom: "Longue-vue", prix: 100, pose: "sol", phrase: "Pour regarder loin, par-dessus les toits." },
  { id: "fanions", nom: "Fanions", prix: 40, pose: "mur", phrase: "C'est tous les jours un peu la fête." },
  { id: "chevalet", nom: "Chevalet et toile", prix: 90, pose: "sol", phrase: "Une toile en cours, jamais finie." },
  { id: "tirelire", nom: "Tirelire", prix: 45, pose: "sol", phrase: "Elle tinte à chaque encaissement." },
];

// Agents maison : ils arrivent avec les lieux. Tu en choisis un pour t'accompagner sur une quête.
// Leur nom, leur rôle et leur spécialité se règlent (config.json, clé « agents ») : ceux-ci sont les valeurs de départ.
const AGENTS = [
  { id: "plume", nom: "Plume", role: "écriture", lieu: "studio" },
  { id: "boussole", nom: "Boussole", role: "vente", lieu: "coworking" },
  { id: "archive", nom: "Archive", role: "administratif", lieu: "coworking" },
  { id: "croquis", nom: "Croquis", role: "création", lieu: "atelier" },
  { id: "timbre", nom: "Timbre", role: "liens et messages", lieu: "bureaux" },
  { id: "relais", nom: "Relais", role: "forme et santé", lieu: "bureaux" },
  { id: "reliure", nom: "Reliure", role: "édition", lieu: "maison-edition" },
  { id: "marge", nom: "Marge", role: "relecture", lieu: "maison-edition" },
];

// Avatar : nombre de variantes par réglage.
const AVATAR = { peau: 4, cheveux: 6, pull: 6 };
const AVATAR_DEFAUT = { peau: 1, cheveux: 0, pull: 0, barbe: true, lunettes: true };

function indexLieu(id) {
  return LIEUX.findIndex((l) => l.id === id);
}

function trouverLieu(id) {
  return LIEUX.find((l) => l.id === id) || null;
}

function trouverAmelioration(lieuId, id) {
  const lieu = trouverLieu(lieuId);
  return lieu ? lieu.ameliorations.find((a) => a.id === id) || null : null;
}

function trouverDeco(id) {
  return DECOS.find((d) => d.id === id) || null;
}

function trouverAgent(id) {
  return AGENTS.find((a) => a.id === id) || null;
}

// Trois objets du jour, les mêmes toute la journée, choisis à partir de la date.
function objetsDuJour(dateISO) {
  let graine = 0;
  for (const c of String(dateISO)) graine = (graine * 31 + c.charCodeAt(0)) >>> 0;
  const reste = DECOS.map((d) => d.id);
  const choisis = [];
  while (choisis.length < 3 && reste.length) {
    graine = (Math.imul(graine, 1103515245) + 12345) >>> 0;
    choisis.push(reste.splice((graine >>> 8) % reste.length, 1)[0]);
  }
  return choisis;
}

module.exports = {
  LIEUX,
  ZONES,
  DECOS,
  AGENTS,
  AVATAR,
  AVATAR_DEFAUT,
  indexLieu,
  trouverLieu,
  trouverAmelioration,
  trouverDeco,
  trouverAgent,
  objetsDuJour,
};

  });

  definir("/jeu/serveur/encaissements.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/encaissements.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// Encaissements déclarés par le joueur : validation, période du mois, jalons.
// Fonctions pures : aucun accès disque. Le stockage passe par partie.js et garde.js.

const P = require("./parseurs");
const { ErreurJeu } = require("./config");

const MAX_ENCAISSEMENTS = 5000;
const MONTANT_MAX = 1000000;
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function estObjet(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function nouveauRegistre() {
  return { version: 1, encaissements: [] };
}

function centimes(n) {
  return Math.round(n * 100) / 100;
}

// Complète un registre lu sur disque, écarte les lignes abîmées.
function normaliserRegistre(lu) {
  const registre = nouveauRegistre();
  if (!estObjet(lu) || !Array.isArray(lu.encaissements)) return registre;
  for (const e of lu.encaissements) {
    if (!estObjet(e) || typeof e.id !== "string" || !/^E-[a-f0-9]{6,16}$/.test(e.id)) continue;
    if (typeof e.montant !== "number" || !Number.isFinite(e.montant) || e.montant <= 0) continue;
    if (!P.dateValide(e.date)) continue;
    registre.encaissements.push({
      id: e.id,
      montant: centimes(Math.min(e.montant, MONTANT_MAX)),
      date: e.date,
      source: typeof e.source === "string" && e.source ? e.source.slice(0, 24) : "Autre",
      note: typeof e.note === "string" ? e.note.slice(0, 80) : "",
      cree_le: typeof e.cree_le === "string" ? e.cree_le : "",
    });
  }
  registre.encaissements = registre.encaissements.slice(-MAX_ENCAISSEMENTS);
  return registre;
}

// "1 250,50" ou 1250.5 : un nombre positif, au centime.
function lireMontant(v) {
  let n = v;
  if (typeof v === "string") {
    const propre = v.replace(/[\s  €]/g, "").replace(",", ".");
    n = /^\d+(\.\d{1,2})?$/.test(propre) ? Number(propre) : NaN;
  }
  const arrondi = typeof n === "number" && Number.isFinite(n) ? centimes(n) : NaN;
  if (!(arrondi > 0) || arrondi > MONTANT_MAX) {
    throw new ErreurJeu("MONTANT_INVALIDE", "Le montant doit être un nombre positif, par exemple 39 ou 1250,50.");
  }
  return arrondi;
}

// Vérifie une déclaration. Champs : montant, date (défaut : aujourd'hui), source, note.
function valider(corps, config, aujourdhui) {
  const c = estObjet(corps) ? corps : {};
  const montant = lireMontant(c.montant);
  const date = c.date === undefined || c.date === null || c.date === "" ? aujourdhui : c.date;
  if (!P.dateValide(date)) throw new ErreurJeu("DATE_INVALIDE", "La date doit être au format AAAA-MM-JJ.");
  if (date > aujourdhui) throw new ErreurJeu("DATE_FUTURE", "Un encaissement se déclare une fois l'argent reçu.");
  const voulue = P.normaliserPourRecherche(typeof c.source === "string" ? c.source : "");
  const source = config.sources_encaissement.find((s) => P.normaliserPourRecherche(s) === voulue);
  if (!source) {
    throw new ErreurJeu("SOURCE_INVALIDE", "Choisis une source : " + config.sources_encaissement.join(", ") + ".");
  }
  const note = typeof c.note === "string" ? c.note.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  return { montant, date, source, note };
}

// Montant affiché avec la monnaie du joueur ("€" par défaut).
function formaterEuros(n, monnaie) {
  const entier = Math.floor(Math.abs(n));
  const cents = Math.round((Math.abs(n) - entier) * 100);
  const groupes = String(entier).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (n < 0 ? "-" : "") + groupes + (cents ? "," + String(cents).padStart(2, "0") : "") + " " + (monnaie || "€");
}

function idMois(dateISO) {
  return dateISO.slice(0, 7);
}

function libelleMois(id) {
  return MOIS[Number(id.slice(5, 7)) - 1] + " " + id.slice(0, 4);
}

function dernierJourDuMois(dateISO) {
  const d = new Date(dateISO.slice(0, 7) + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

function joursEntre(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}

// Période de la barre : mois civil (défaut) ou trente jours glissants.
function periode(config, dateISO) {
  if (config.periode === "30_jours") {
    return { id: idMois(dateISO), type: "30_jours", debut: P.ajouterJours(dateISO, -29), fin: dateISO, libelle: "30 derniers jours", jours_restants: 0 };
  }
  const fin = dernierJourDuMois(dateISO);
  return {
    id: idMois(dateISO),
    type: "mois_civil",
    debut: dateISO.slice(0, 7) + "-01",
    fin,
    libelle: libelleMois(idMois(dateISO)),
    jours_restants: joursEntre(dateISO, fin),
  };
}

function total(liste, debut, fin) {
  let somme = 0;
  for (const e of liste) if (e.date >= debut && e.date <= fin) somme += e.montant;
  return centimes(somme);
}

// Totaux par mois civil : { "2026-11": 2100, ... }
function totauxParMois(liste) {
  const totaux = {};
  for (const e of liste) totaux[idMois(e.date)] = centimes((totaux[idMois(e.date)] || 0) + e.montant);
  return totaux;
}

function meilleurMois(liste) {
  return Math.max(0, ...Object.values(totauxParMois(liste)));
}

// Tout ce que la barre du haut affiche.
function vueMois(liste, config, dateISO) {
  const p = periode(config, dateISO);
  const somme = total(liste, p.debut, p.fin);
  const objectif = config.objectif_mensuel;
  const jalons = config.jalons_mensuels.map((montant) => ({ montant, atteint: somme >= montant }));
  const prochain = jalons.find((j) => !j.atteint) || null;
  const reste = Math.max(0, centimes(objectif - somme));
  const duMois = liste.filter((e) => e.date >= p.debut && e.date <= p.fin);
  const sources = [...config.sources_encaissement];
  for (const e of duMois) if (!sources.includes(e.source)) sources.push(e.source); // source retirée de la config
  const parSource = sources
    .map((source) => ({ source, total: centimes(duMois.filter((e) => e.source === source).reduce((s, e) => s + e.montant, 0)) }))
    .filter((s) => s.total > 0);
  let rappel = null;
  if (somme >= objectif) rappel = "Objectif du mois atteint. Bravo.";
  else if (p.type === "mois_civil" && p.jours_restants <= 7) {
    rappel = "Il manque " + formaterEuros(reste, config.monnaie) + " pour ton objectif. Il reste " + (p.jours_restants === 0 ? "aujourd'hui" : p.jours_restants + (p.jours_restants === 1 ? " jour" : " jours")) + ".";
  }
  const totaux = totauxParMois(liste);
  const historique = [];
  let curseur = idMois(dateISO) + "-01";
  for (let i = 0; i < 6; i++) {
    const id = idMois(curseur);
    historique.unshift({ id, libelle: libelleMois(id), total: totaux[id] || 0 });
    curseur = P.ajouterJours(curseur, -1).slice(0, 7) + "-01";
  }
  return {
    id: p.id,
    periode: p.type,
    libelle: p.libelle,
    debut: p.debut,
    fin: p.fin,
    jours_restants: p.jours_restants,
    total: somme,
    objectif,
    pourcentage: Math.min(100, Math.round((somme / objectif) * 1000) / 10),
    jalons,
    prochain_jalon: prochain ? prochain.montant : null,
    reste,
    par_source: parSource,
    rappel,
    historique,
    meilleur_mois: meilleurMois(liste),
  };
}

module.exports = {
  MAX_ENCAISSEMENTS,
  nouveauRegistre,
  normaliserRegistre,
  lireMontant,
  valider,
  formaterEuros,
  idMois,
  libelleMois,
  periode,
  total,
  totauxParMois,
  meilleurMois,
  vueMois,
};

  });

  definir("/jeu/serveur/sysconfig.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/sysconfig.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// Réglages du Système (version 4) : niveaux, rangs, statistiques, points de vie, or, butin,
// donjons, ombres, studio, saisons. Aucun montant n'est imposé : tout ce qui suit est une
// proposition de départ, modifiable dans config.json (clé « systeme ») et dans l'écran Réglages.
// Fonctions pures, sans dépendance.

const STATS = ["force", "endurance", "intelligence", "charisme", "creativite"];
const RANGS = ["E", "D", "C", "B", "A", "S"];
const TYPES = ["admin", "vente", "creation", "relations", "sante"];

const DEFAUT = {
  actif: true,
  xp: { par_quete: 20, par_habitude: 5, par_quotidienne: 10, base_niveau: 100, pas_niveau: 40 },
  // Plafonds doux : ce qui est trop facile à répéter rapporte moins, puis plus rien. Rien n'est jamais retiré.
  plafonds: { quetes_pleines: 8, taux_reduit: 25, habitude_par_jour: 3, etapes_par_jour: 2 },
  points_par_niveau: 3,
  rangs: { E: 1, D: 5, C: 10, B: 18, A: 28, S: 40 },
  noms_stats: { force: "Force", endurance: "Endurance", intelligence: "Intelligence", charisme: "Charisme", creativite: "Créativité" },
  stats_par_type: { admin: "endurance", vente: "intelligence", creation: "creativite", relations: "charisme", sante: "force" },
  pratique_par_point: 5,
  pv: { base: 50, par_force: 2, degats_quotidienne: 8, degats_habitude: 3, soin_quete: 2 },
  or: { par_quete: 5, par_habitude: 2, par_quotidienne: 3 },
  butin: { chance: 25 },
  defi: { quetes: 3, or: 15, butin: true },
  penalite: { actif: true, quetes: 2, bonus_sortie: 15 },
  quotidiennes: { graces_par_semaine: 1 },
  ombres: { serie: 14, bonus: 2 },
  donjon: { pv_petit: 100, pv_moyen: 250, pv_grand: 600, degats: 10, xp: 150, or: 80 },
  studio: { prix_embauche: 60, places: 3, production_h_max: 24, recherche_par_quete: 1 },
  saison: { jours: 90, niveau_prestige: 10, bonus_prestige: 10 },
  recompenses: [
    { texte: "Un café en terrasse", prix: 30 },
    { texte: "Un épisode de ta série", prix: 40 },
    { texte: "Une heure de jeu", prix: 60 },
    { texte: "Un bon restaurant", prix: 200 },
  ],
};

function estObjet(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function nombre(v, defaut, min, max) {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : defaut;
}

function entier(v, defaut, min, max) {
  return Number.isInteger(v) && v >= min && v <= max ? v : defaut;
}

// Complète un groupe de nombres : { cle: [min, max, entier ?] }.
function groupe(lu, defaut, bornes) {
  const o = estObjet(lu) ? lu : {};
  const r = {};
  for (const cle of Object.keys(defaut)) {
    const [min, max, ent] = bornes[cle] || [0, 1000000, true];
    r[cle] = ent === false ? nombre(o[cle], defaut[cle], min, max) : entier(o[cle], defaut[cle], min, max);
  }
  return r;
}

// Fusionne la clé « systeme » lue dans config.json avec les valeurs par défaut. Idempotent.
function completer(lu) {
  const c = estObjet(lu) ? lu : {};
  const d = DEFAUT;
  const rangsLus = estObjet(c.rangs) ? c.rangs : {};
  const rangs = {};
  let precedent = 0;
  for (const r of RANGS) {
    // les rangs se suivent : chaque rang commence au moins un niveau après le précédent
    const v = entier(rangsLus[r], d.rangs[r], 1, 100000);
    rangs[r] = r === "E" ? 1 : Math.max(v, precedent + 1);
    precedent = rangs[r];
  }
  const noms = {};
  const nomsLus = estObjet(c.noms_stats) ? c.noms_stats : {};
  for (const s of STATS) noms[s] = typeof nomsLus[s] === "string" && nomsLus[s].trim() ? nomsLus[s].trim().slice(0, 20) : d.noms_stats[s];
  const parType = {};
  const parTypeLu = estObjet(c.stats_par_type) ? c.stats_par_type : {};
  for (const t of TYPES) parType[t] = STATS.includes(parTypeLu[t]) ? parTypeLu[t] : d.stats_par_type[t];
  const recompenses = Array.isArray(c.recompenses)
    ? c.recompenses
        .filter((x) => estObjet(x) && typeof x.texte === "string" && x.texte.trim() !== "" && Number.isInteger(x.prix) && x.prix >= 0 && x.prix <= 1000000)
        .slice(0, 30)
        .map((x) => ({ texte: x.texte.trim().slice(0, 80), prix: x.prix }))
    : d.recompenses.map((x) => ({ ...x }));
  return {
    actif: typeof c.actif === "boolean" ? c.actif : d.actif,
    xp: groupe(c.xp, d.xp, { base_niveau: [1, 1000000, true], pas_niveau: [0, 1000000, true] }),
    plafonds: groupe(c.plafonds, d.plafonds, { quetes_pleines: [0, 1000, true], taux_reduit: [0, 100, true], habitude_par_jour: [0, 1000, true], etapes_par_jour: [0, 1000, true] }),
    points_par_niveau: entier(c.points_par_niveau, d.points_par_niveau, 0, 100),
    rangs,
    noms_stats: noms,
    stats_par_type: parType,
    pratique_par_point: entier(c.pratique_par_point, d.pratique_par_point, 1, 10000),
    pv: groupe(c.pv, d.pv, { base: [1, 100000, true] }),
    or: groupe(c.or, d.or, {}),
    butin: groupe(c.butin, d.butin, { chance: [0, 100, true] }),
    defi: {
      quetes: entier(estObjet(c.defi) ? c.defi.quetes : undefined, d.defi.quetes, 0, 50),
      or: entier(estObjet(c.defi) ? c.defi.or : undefined, d.defi.or, 0, 100000),
      butin: estObjet(c.defi) && typeof c.defi.butin === "boolean" ? c.defi.butin : d.defi.butin,
    },
    penalite: {
      actif: estObjet(c.penalite) && typeof c.penalite.actif === "boolean" ? c.penalite.actif : d.penalite.actif,
      quetes: entier(estObjet(c.penalite) ? c.penalite.quetes : undefined, d.penalite.quetes, 1, 50),
      bonus_sortie: entier(estObjet(c.penalite) ? c.penalite.bonus_sortie : undefined, d.penalite.bonus_sortie, 0, 100000),
    },
    quotidiennes: groupe(c.quotidiennes, d.quotidiennes, { graces_par_semaine: [0, 7, true] }),
    ombres: groupe(c.ombres, d.ombres, { serie: [1, 3650, true], bonus: [0, 100, true] }),
    donjon: groupe(c.donjon, d.donjon, { pv_petit: [1, 1000000, true], pv_moyen: [1, 1000000, true], pv_grand: [1, 1000000, true], degats: [1, 100000, true] }),
    studio: groupe(c.studio, d.studio, { places: [0, 50, true], production_h_max: [0, 720, true] }),
    saison: groupe(c.saison, d.saison, { jours: [7, 3650, true], niveau_prestige: [2, 100000, true], bonus_prestige: [0, 1000, true] }),
    recompenses,
  };
}

// Les champs de l'écran Réglages (section « Le Système »). Mêmes formes que serveur/reglages.js.
function champs(config) {
  const s = config.systeme;
  const c = (chemin, libelle, type, extra) => ({ chemin: "systeme." + chemin, libelle, type, ...(extra || {}) });
  const liste = [
    c("actif", "Le Système (niveaux, rangs, points de vie, or)", "bascule"),
    c("xp.par_quete", "Expérience d'une quête (par étoile)", "entier", { min: 0 }),
    c("xp.par_habitude", "Expérience d'une habitude notée", "entier", { min: 0 }),
    c("xp.par_quotidienne", "Expérience d'une quotidienne", "entier", { min: 0 }),
    c("xp.base_niveau", "Expérience pour passer du niveau 1 au niveau 2", "entier", { min: 1 }),
    c("xp.pas_niveau", "Expérience en plus à chaque niveau suivant", "entier", { min: 0 }),
    c("plafonds.quetes_pleines", "Quêtes par jour à pleine expérience", "entier", { min: 0, max: 1000, aide: "0 : pas de plafond. Au-delà, la quête compte toujours, avec moins d'expérience et d'or." }),
    c("plafonds.taux_reduit", "Expérience et or des quêtes suivantes", "entier", { min: 0, max: 100, unite: "%" }),
    c("plafonds.habitude_par_jour", "Fois par jour où une même habitude rapporte ou coûte", "entier", { min: 0, max: 1000, aide: "0 : pas de plafond. Au-delà, c'est noté, sans effet." }),
    c("plafonds.etapes_par_jour", "Étapes de donjon par jour", "entier", { min: 0, max: 1000, aide: "0 : pas de plafond. Un donjon se gagne dans la durée." }),
    c("points_par_niveau", "Points de statistiques par niveau gagné", "entier", { min: 0, max: 100 }),
    ...RANGS.filter((r) => r !== "E").map((r) => c("rangs." + r, "Rang " + r + " : à partir du niveau", "entier", { min: 2 })),
    ...STATS.map((x) => c("noms_stats." + x, "Statistique « " + x + " » : nom", "texte", { max: 20 })),
    ...TYPES.map((t) => c("stats_par_type." + t, "Quête « " + config.types[t].nom + " » : statistique entraînée", "choix", { choix: STATS.map((x) => ({ valeur: x, libelle: s.noms_stats[x] })) })),
    c("pratique_par_point", "Quêtes d'un même type pour gagner un point de statistique", "entier", { min: 1 }),
    c("pv.base", "Points de vie de départ", "entier", { min: 1 }),
    c("pv.par_force", "Points de vie par point de Force", "entier", { min: 0 }),
    c("pv.degats_quotidienne", "Points de vie perdus par quotidienne manquée", "entier", { min: 0, aide: "0 : les quotidiennes manquées ne coûtent rien." }),
    c("pv.degats_habitude", "Points de vie perdus par mauvaise habitude notée", "entier", { min: 0 }),
    c("pv.soin_quete", "Points de vie rendus par quête", "entier", { min: 0 }),
    c("or.par_quete", "Or d'une quête (par étoile)", "entier", { min: 0 }),
    c("or.par_habitude", "Or d'une bonne habitude notée", "entier", { min: 0 }),
    c("or.par_quotidienne", "Or d'une quotidienne", "entier", { min: 0 }),
    c("butin.chance", "Chance de butin par quête", "entier", { min: 0, max: 100, unite: "%" }),
    c("defi.quetes", "Défi du jour : quêtes à faire", "entier", { min: 0, max: 50, aide: "0 : pas de défi du jour." }),
    c("defi.or", "Défi du jour : or gagné", "entier", { min: 0 }),
    c("defi.butin", "Défi du jour : un butin en plus", "bascule"),
    c("penalite.actif", "Zone de pénalité quand les points de vie tombent à zéro", "bascule"),
    c("penalite.quetes", "Zone de pénalité : quêtes pour en sortir", "entier", { min: 1, max: 50 }),
    c("penalite.bonus_sortie", "Zone de pénalité : or offert à la sortie", "entier", { min: 0 }),
    c("quotidiennes.graces_par_semaine", "Jours de grâce par semaine (une série survit à un oubli)", "entier", { min: 0, max: 7 }),
    c("ombres.serie", "Série qu'une quotidienne doit atteindre pour devenir une ombre", "entier", { min: 1 }),
    c("ombres.bonus", "Bonus de statistique donné par une ombre", "entier", { min: 0, max: 100 }),
    c("donjon.pv_petit", "Boss d'un petit projet : points de vie", "entier", { min: 1 }),
    c("donjon.pv_moyen", "Boss d'un projet moyen : points de vie", "entier", { min: 1 }),
    c("donjon.pv_grand", "Boss d'un grand projet : points de vie", "entier", { min: 1 }),
    c("donjon.degats", "Dégâts d'une quête sur le boss (par étoile)", "entier", { min: 1 }),
    c("donjon.xp", "Boss vaincu : expérience (petit projet)", "entier", { min: 0 }),
    c("donjon.or", "Boss vaincu : or (petit projet)", "entier", { min: 0 }),
    c("studio.prix_embauche", "Embauche : prix de base en or", "entier", { min: 0 }),
    c("studio.places", "Places d'équipiers au départ", "entier", { min: 0, max: 50 }),
    c("studio.production_h_max", "Production hors ligne : heures comptées au plus", "entier", { min: 0, max: 720, unite: "h" }),
    c("studio.recherche_par_quete", "Points de recherche par quête", "entier", { min: 0 }),
    c("saison.jours", "Durée d'une saison", "entier", { min: 7, unite: "jours" }),
    c("saison.niveau_prestige", "Niveau à atteindre pour le prestige", "entier", { min: 2 }),
    c("saison.bonus_prestige", "Bonus permanent par prestige (expérience et or)", "entier", { min: 0, unite: "%" }),
  ];
  return liste;
}

module.exports = { DEFAUT, STATS, RANGS, TYPES, completer, champs };

  });

  definir("/jeu/serveur/reglages.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/reglages.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// Écran Réglages : la liste de tout ce qui se règle depuis le jeu, et la validation d'un changement.
// Les changements du joueur sont un « patch » posé sur config.json (gardé dans data/reglages.json).
// Fonctions pures : aucun accès disque.

const configuration = require("./config");
const { ErreurJeu, ORDRE_TYPES, COMPTEURS, FONCTIONS, LIBELLES_COMPTEURS } = configuration;

function estObjet(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function champ(chemin, libelle, type, extra) {
  return { chemin, libelle, type, ...(extra || {}) };
}

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// Les sections de l'écran, d'après la configuration effective (les caps, les agents et les lieux y sont listés).
function sections(config) {
  const choixTypes = ORDRE_TYPES.map((t) => ({ valeur: t, libelle: config.types[t].nom }));
  const s = [];
  s.push({
    id: "toi",
    titre: "Toi et ton projet",
    aide: "Ce qui s'affiche dans l'immeuble.",
    champs: [
      champ("joueur", "Ton prénom", "texte", { max: 30, vide: true }),
      champ("enseigne", "Le nom de ton projet (l'enseigne sur le toit)", "texte", { max: 40 }),
      champ("monnaie", "Ta monnaie", "texte", { max: 12, aide: "Le signe affiché après les montants : €, $, CHF..." }),
      champ("son", "Sons doux à chaque geste", "bascule"),
    ],
  });
  s.push({
    id: "objectif",
    titre: "Objectif du mois",
    aide: "Aucun montant n'est imposé : c'est ton objectif, à ta mesure.",
    champs: [
      champ("objectif_mensuel", "Objectif du mois", "nombre", { min: 1, unite: config.monnaie }),
      champ("jalons_mensuels", "Jalons sur la barre", "liste_nombres", { aide: "Des montants séparés par des virgules. Vide : seulement l'objectif. Le dernier jalon est toujours l'objectif." }),
      champ("periode", "Période de la barre", "choix", { choix: [{ valeur: "mois_civil", libelle: "Le mois civil" }, { valeur: "30_jours", libelle: "Trente jours glissants" }] }),
      champ("sources_encaissement", "Sources d'encaissement", "liste_textes", { aide: "Séparées par des virgules." }),
    ],
  });
  s.push({
    id: "energie",
    titre: "Énergie du jour",
    aide: "Chaque matin tu dis comment tu te sens. Le jeu te propose les quêtes qui collent. Les noms et les seuils sont les tiens : 3 à 5 niveaux, aucun n'est imposé.",
    champs: [
      champ("energie.actif", "Proposer les quêtes selon mon énergie du jour", "bascule"),
      champ("energie.demander_le_matin", "Me demander mon énergie en commençant la journée", "bascule"),
      champ("energie.cout_defaut", "Coût d'énergie par défaut d'une quête", "entier", { min: 1, max: 5, aide: "De 1 (toute petite) à 5 (une grosse session). Tu peux le changer quête par quête." }),
      champ("energie.niveaux_titres", "Noms des niveaux (3 à 5, du plus bas au plus haut)", "liste_textes", { aide: "Séparés par des virgules, par exemple : À plat, Calme, Bien, En forme, Plein d'élan." }),
      champ("energie.niveaux_couts", "Coût max de chaque niveau", "liste_nombres", { aide: "Autant de nombres (de 1 à 5) que de noms, dans le même ordre." }),
    ],
  });
  s.push({
    id: "caps",
    titre: "Caps des étages (par résultat)",
    aide: "Un étage s'ouvre quand tu atteins un résultat. C'est toujours toi qui confirmes.",
    champs: config.caps.flatMap((cap) => {
      const lieu = cap.lieu && config.lieux[cap.lieu] ? config.lieux[cap.lieu].nom : "Jalon";
      const liste = [champ("caps." + cap.id + ".libelle", lieu + " : le cap", "texte", { max: 120 })];
      if (!cap.premier) liste.push(champ("caps." + cap.id + ".seuil_mois", lieu + " : seuil sur un mois", "nombre", { min: 1, unite: config.monnaie, aide: "Le jeu te prévient quand ton meilleur mois atteint ce seuil." }));
      return liste;
    }),
  });
  s.push({
    id: "efforts",
    titre: "Caps des pièces (par effort)",
    aide: "Une pièce ou un meuble s'ouvre quand tu as fourni un effort, que le jeu compte.",
    champs: config.caps_effort.flatMap((cap) => [
      champ("caps_effort." + cap.id + ".compteur", cap.piece + " : ce qui compte", "choix", { choix: COMPTEURS.map((c) => ({ valeur: c, libelle: LIBELLES_COMPTEURS[c][1] })) }),
      champ("caps_effort." + cap.id + ".seuil", cap.piece + " : combien", "entier", { min: 1 }),
    ]),
  });
  s.push({
    id: "lieux",
    titre: "Noms des lieux",
    champs: Object.keys(config.lieux).flatMap((id) => [
      champ("lieux." + id + ".nom", "Lieu « " + id + " » : nom", "texte", { max: 40 }),
      champ("lieux." + id + ".sous_titre", "Lieu « " + id + " » : phrase", "texte", { max: 80 }),
    ]),
  });
  s.push({
    id: "points",
    titre: "Points et degrés",
    aide: "Une quête payée rapporte : base x degré, x le multiplicateur pour une vente.",
    champs: [
      champ("points.ligne", "Base d'une quête", "nombre", { min: 0 }),
      champ("points.priorite", "Base d'une priorité du jour", "nombre", { min: 0 }),
      champ("points.degres", "Multiplicateurs des trois degrés", "liste_nombres", { longueur: 3, aide: "Trois nombres : une, deux, trois étoiles." }),
      champ("points.degre_defaut", "Degré d'une case cochée hors du jeu", "choix", { choix: [1, 2, 3].map((n) => ({ valeur: n, libelle: n + (n > 1 ? " étoiles" : " étoile") })) }),
      champ("points.multiplicateur_vente", "Multiplicateur d'une vente", "nombre", { min: 1 }),
      champ("points.bonus_jour", "Bonus : toutes les priorités d'un jour", "nombre", { min: 0 }),
      champ("points.geste", "Un geste de stratégie", "nombre", { min: 0 }),
      champ("degres_defaut", "Les trois degrés proposés par défaut", "liste_textes", { longueur: 3, separateur: ";", aide: "Trois phrases séparées par des points-virgules." }),
    ],
  });
  s.push({
    id: "types",
    titre: "Types de quête",
    aide: "Une quête payée rapporte des points. Une quête racontée laisse une ligne au journal de l'immeuble, sans points.",
    champs: [
      ...ORDRE_TYPES.flatMap((t) => [
        champ("types." + t + ".nom", "Type « " + t + " » : nom", "texte", { max: 24 }),
        champ("types." + t + ".mode", "Type « " + t + " » : payé ou raconté", "choix", { choix: [{ valeur: "payee", libelle: "Payé en points" }, { valeur: "racontee", libelle: "Raconté au journal" }] }),
        champ("types." + t + ".mots", "Type « " + t + " » : mots qui le font reconnaître", "liste_textes"),
      ]),
      champ("mots_vente", "Mots qui font reconnaître une vente", "liste_textes"),
      champ("type_defaut", "Type d'une quête sans indice", "choix", { choix: choixTypes }),
    ],
  });
  s.push({
    id: "journee",
    titre: "La journée",
    champs: [
      champ("quetes_visibles", "Quêtes visibles à la fois", "entier", { min: 1, max: 50 }),
      champ("plafond.par_jour", "Plafond : quêtes payées par jour", "entier", { min: 0, aide: "0 : pas de plafond. Au-delà, la quête compte, mais sans points." }),
      champ("plafond.plein", "Plafond : quêtes payées plein tarif", "entier", { min: 0 }),
      champ("plafond.taux_reduit", "Plafond : taux des suivantes", "entier", { min: 0, max: 100, unite: "%" }),
      champ("arrosage.bonus_pourcent", "Arrosage : bonus sur les quêtes payées", "entier", { min: 0, unite: "%" }),
      champ("arrosage.duree_h", "Arrosage : durée du bonus", "entier", { min: 1, unite: "h" }),
      champ("retour.jours", "Bonus de retour : après combien de jours d'absence", "entier", { min: 1 }),
      champ("retour.bonus", "Bonus de retour", "entier", { min: 0, unite: "points" }),
    ],
  });
  s.push({
    id: "contrat",
    titre: "Contrat du jour",
    aide: "Deux contrats chaque matin. On peut perdre la mise, jamais un acquis.",
    champs: [
      champ("contrat.actif", "Proposer un contrat chaque jour", "bascule"),
      champ("contrat.sur.quetes", "Contrat sûr : nombre de quêtes", "entier", { min: 1, max: 10 }),
      champ("contrat.sur.gain", "Contrat sûr : gain", "entier", { min: 0, unite: "points" }),
      champ("contrat.ambitieux.quetes", "Contrat ambitieux : quêtes en plus de la principale", "entier", { min: 0, max: 10 }),
      champ("contrat.ambitieux.mise", "Contrat ambitieux : mise", "entier", { min: 0, unite: "points" }),
      champ("contrat.ambitieux.gain", "Contrat ambitieux : gain", "entier", { min: 0, unite: "points" }),
      champ("contrat.ambitieux.heure_limite", "Contrat ambitieux : heure limite proposée", "heure"),
      champ("contrat.ambitieux.colis", "Contrat ambitieux : un colis en plus", "bascule"),
    ],
  });
  s.push({
    id: "equipe",
    titre: "But d'équipe et dimanche",
    champs: [
      champ("but_equipe.libelle", "But d'équipe proposé chaque semaine", "texte", { max: 80, vide: true }),
      champ("but_equipe.crans", "Nombre de crans de la barre", "entier", { min: 1, max: 50 }),
      champ("but_equipe.par_cran", "Unités pour un cran", "entier", { min: 1 }),
      champ("but_equipe.par_quete", "Unités par quête faite", "entier", { min: 0 }),
      champ("but_equipe.par_specialite", "Unités en plus : agent dans sa spécialité", "entier", { min: 0 }),
      champ("but_equipe.par_session", "Unités par session de travail active", "entier", { min: 0 }),
      champ("but_equipe.sessions_max_par_jour", "Sessions comptées par jour, au plus", "entier", { min: 0 }),
      champ("but_equipe.recompense", "Récompense du but atteint", "entier", { min: 0, unite: "points" }),
      champ("dimanche.jour", "Jour de la revue de la semaine", "choix", { choix: JOURS.map((j, i) => ({ valeur: i + 1, libelle: j })) }),
      champ("dimanche.recompense", "Récompense de la revue", "entier", { min: 0, unite: "points" }),
    ],
  });
  s.push({
    id: "niveaux",
    titre: "Niveaux",
    aide: "Ton niveau suit le total de points gagnés, qui ne redescend jamais.",
    champs: [
      champ("niveaux.seuils", "Seuils des niveaux", "liste_nombres", { aide: "En points gagnés au total. Le premier est toujours 0." }),
      champ("niveaux.noms", "Noms des niveaux", "liste_textes", { aide: "Dans le même ordre que les seuils." }),
    ],
  });
  s.push({
    id: "agents",
    titre: "Agents",
    aide: "Leur nom, leur rôle, et le type de quête où ils sont dans leur élément.",
    champs: Object.keys(config.agents).flatMap((id) => [
      champ("agents." + id + ".nom", "Agent « " + id + " » : nom", "texte", { max: 16 }),
      champ("agents." + id + ".role", "Agent « " + id + " » : rôle", "texte", { max: 30 }),
      champ("agents." + id + ".specialite", "Agent « " + id + " » : spécialité", "choix", { choix: choixTypes }),
    ]),
  });
  s.push({
    id: "deblocages",
    titre: "Découverte pas à pas",
    aide: "Une fonction de plus au fil des jours. Le chiffre est le jour de jeu où elle s'ouvre (0 : tout de suite).",
    champs: [champ("deblocages.actif", "Ouvrir les fonctions au fil des jours", "bascule"), ...FONCTIONS.map((f) => champ("deblocages." + f, "Jour d'ouverture : " + f, "entier", { min: 0, max: 365 }))],
  });
  s.push({
    id: "systeme",
    titre: "Le Système",
    aide: "Niveaux, rangs, statistiques, points de vie, or, butin, donjons, ombres, studio et saisons. Aucune valeur n'est imposée.",
    champs: require("./sysconfig").champs(config),
  });
  s.push({
    id: "technique",
    titre: "Coffre, collègues, technique",
    champs: [
      champ("coffre", "Lire une note de semaine dans un coffre", "choix", { choix: [{ valeur: "auto", libelle: "Oui, s'il existe" }, { valeur: "non", libelle: "Non, jamais" }, { valeur: "requis", libelle: "Oui, et me prévenir s'il manque" }] }),
      champ("coffre_candidats", "Chemins possibles du coffre", "liste_textes", { separateur: ";", aide: "Séparés par des points-virgules. Le premier qui existe est pris." }),
      champ("chemin_phases", "Dossier des phases dans le coffre", "texte", { max: 200 }),
      champ("mots_newsletter", "Mots de la quête secondaire (lecteurs en visite)", "liste_textes"),
      champ("lecteurs_par_quete", "Lecteurs par quête de ce genre", "nombre", { min: 0 }),
      champ("collegues.actif", "Montrer mes sessions de travail comme des collègues", "bascule"),
      champ("collegues.exclure", "Sessions à ne jamais montrer (motif)", "texte", { max: 200 }),
      champ("collegues.max", "Collègues affichés, au plus", "nombre", { min: 0 }),
      champ("rafraichissement_s", "Relecture des quêtes, toutes les", "nombre", { min: 5, unite: "s" }),
      champ("fuseau", "Fuseau horaire", "texte", { max: 60 }),
      champ("port", "Port du jeu (au prochain lancement)", "entier", { min: 1024, max: 65525 }),
    ],
  });
  return s;
}

function segments(chemin) {
  if (typeof chemin !== "string" || !/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(chemin)) return null;
  const parts = chemin.split(".");
  return parts.some((p) => p === "__proto__" || p === "constructor" || p === "prototype") ? null : parts;
}

// Lit une valeur dans la configuration. Une liste d'objets à identifiant se traverse par identifiant.
function lire(config, chemin) {
  let v = config;
  for (const s of segments(chemin) || []) {
    if (Array.isArray(v)) v = v.find((x) => estObjet(x) && x.id === s);
    else if (estObjet(v) && Object.prototype.hasOwnProperty.call(v, s)) v = v[s];
    else return undefined;
  }
  return v;
}

function poser(patch, chemin, valeur) {
  const parts = segments(chemin);
  const copie = structuredClone(estObjet(patch) ? patch : {});
  let o = copie;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!estObjet(o[parts[i]])) o[parts[i]] = {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = valeur;
  return copie;
}

function retirer(patch, chemin) {
  const parts = segments(chemin);
  const copie = structuredClone(estObjet(patch) ? patch : {});
  const pile = [];
  let o = copie;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!estObjet(o[parts[i]])) return copie;
    pile.push([o, parts[i]]);
    o = o[parts[i]];
  }
  delete o[parts[parts.length - 1]];
  // les branches devenues vides disparaissent
  for (let i = pile.length - 1; i >= 0; i--) {
    const [parent, cle] = pile[i];
    if (Object.keys(parent[cle]).length === 0) delete parent[cle];
    else break;
  }
  return copie;
}

function estModifie(patch, chemin) {
  let v = patch;
  for (const s of segments(chemin) || []) {
    if (!estObjet(v) || !Object.prototype.hasOwnProperty.call(v, s)) return false;
    v = v[s];
  }
  return true;
}

function refus(c, pourquoi) {
  return new ErreurJeu("REGLAGE_INVALIDE", "« " + c.libelle + " » : " + pourquoi);
}

function nombreLu(v) {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return NaN;
  const propre = v.replace(/[\s  ]/g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(propre) ? Number(propre) : NaN;
}

// Met une valeur reçue de l'écran à la forme attendue par config.js.
function convertir(c, valeur) {
  switch (c.type) {
    case "bascule":
      if (typeof valeur !== "boolean") throw refus(c, "réponds par oui ou par non.");
      return valeur;
    case "nombre":
    case "entier": {
      const n = nombreLu(valeur);
      if (!Number.isFinite(n) || (c.type === "entier" && !Number.isInteger(n))) throw refus(c, c.type === "entier" ? "il faut un nombre entier." : "il faut un nombre.");
      if (c.min !== undefined && n < c.min) throw refus(c, "au moins " + c.min + ".");
      if (c.max !== undefined && n > c.max) throw refus(c, "au plus " + c.max + ".");
      return n;
    }
    case "choix": {
      const trouve = c.choix.find((x) => String(x.valeur) === String(valeur));
      if (!trouve) throw refus(c, "choisis une des valeurs proposées.");
      return trouve.valeur;
    }
    case "heure":
      if (!configuration.heureValide(valeur)) throw refus(c, "il faut une heure, par exemple 12:00.");
      return valeur;
    case "liste_nombres": {
      const morceaux = Array.isArray(valeur) ? valeur : String(valeur).split(/[;,]/).map((x) => x.trim()).filter((x) => x !== "");
      const nombres = morceaux.map(nombreLu);
      if (nombres.some((n) => !Number.isFinite(n) || n < 0)) throw refus(c, "il faut des nombres séparés par des virgules.");
      if (c.longueur && nombres.length !== c.longueur) throw refus(c, "il en faut exactement " + c.longueur + ".");
      return nombres;
    }
    case "liste_textes": {
      const sep = c.separateur === ";" ? /;/ : /[;,]/;
      const morceaux = (Array.isArray(valeur) ? valeur : String(valeur).split(sep)).map((x) => String(x).trim()).filter((x) => x !== "");
      if (c.longueur && morceaux.length !== c.longueur) throw refus(c, "il en faut exactement " + c.longueur + ".");
      if (!c.longueur && morceaux.length === 0) throw refus(c, "il en faut au moins un.");
      return morceaux;
    }
    default: {
      if (typeof valeur !== "string") throw refus(c, "il faut un texte.");
      const t = valeur.replace(/\s+/g, " ").trim();
      if (t === "" && !c.vide) throw refus(c, "ce champ ne peut pas rester vide.");
      if (c.max && t.length > c.max) throw refus(c, c.max + " caractères au plus.");
      return t;
    }
  }
}

function trouverChamp(config, chemin) {
  for (const s of sections(config)) {
    const c = s.champs.find((x) => x.chemin === chemin);
    if (c) return c;
  }
  return null;
}

// Applique un changement. Renvoie le nouveau patch. La configuration obtenue doit garder la valeur :
// sinon elle était hors bornes, et le changement est refusé.
function changer(base, patch, chemin, valeur) {
  const avant = configuration.effective(base, patch);
  const c = trouverChamp(avant, chemin);
  if (!c) throw new ErreurJeu("INCONNU", "Je ne connais pas ce réglage.");
  const v = convertir(c, valeur);
  const nouveau = poser(patch, chemin, v);
  const apres = configuration.effective(base, nouveau);
  const obtenu = lire(apres, chemin);
  const pareil = c.type === "liste_nombres" && (chemin === "jalons_mensuels" || chemin === "niveaux.seuils") ? Array.isArray(obtenu) : JSON.stringify(obtenu) === JSON.stringify(v);
  if (!pareil) throw refus(c, "cette valeur n'est pas acceptée.");
  if (chemin === "fuseau") {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: v });
    } catch (e) {
      throw refus(c, "ce fuseau est inconnu. Exemple : Europe/Paris.");
    }
  }
  if (chemin === "collegues.exclure") {
    try {
      new RegExp(v, "i");
    } catch (e) {
      throw refus(c, "ce motif n'est pas valide.");
    }
  }
  return nouveau;
}

// Tout ce que l'écran affiche : sections, valeurs, et ce que le joueur a changé.
function vue(base, patch) {
  const config = configuration.effective(base, patch);
  return {
    sections: sections(config).map((s) => ({
      id: s.id,
      titre: s.titre,
      aide: s.aide || "",
      champs: s.champs.map((c) => ({ ...c, valeur: lire(config, c.chemin), modifie: estModifie(patch, c.chemin), defaut: lire(base, c.chemin) })),
    })),
    nb_modifies: sections(config).reduce((n, s) => n + s.champs.filter((c) => estModifie(patch, c.chemin)).length, 0),
  };
}

module.exports = { sections, lire, poser, retirer, estModifie, convertir, changer, vue, trouverChamp };

  });

  definir("/jeu/serveur/regles.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/regles.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// Règles de la version 3. Fonctions sans accès disque : elles lisent et modifient la partie en mémoire.
// Chaque règle vient des fiches de game design (voir ETAT-V3.md pour le livre et le chapitre).

const P = require("./parseurs");
const catalogue = require("./catalogue");
const { ORDRE_TYPES, FONCTIONS, LIBELLES_COMPTEURS, formaterMontant } = require("./config");

const MAX_JOURNAL = 600;

function estObjet(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function pluriel(n, un, plusieurs) {
  return n + " " + (n > 1 ? plusieurs : un);
}

// Choix stable parmi des variantes : la même quête donne toujours la même phrase.
function variante(liste, graine) {
  let g = 0;
  for (const c of String(graine)) g = (g * 31 + c.charCodeAt(0)) >>> 0;
  return liste[g % liste.length];
}

// ---------------------------------------------------------------- journal de l'immeuble

function noter(partie, ctx, type, texte, extra) {
  partie.journal.push({ quand: ctx.horodatage, type, texte, ...(extra || {}) });
  if (partie.journal.length > MAX_JOURNAL) partie.journal = partie.journal.slice(-MAX_JOURNAL);
}

const RECITS = {
  creation: [
    "Tu as créé : « {q} ».{a} L'immeuble sent l'encre fraîche.",
    "« {q} » existe, maintenant.{a} Ce matin, ce n'était qu'une idée.",
    "Une chose de plus est sortie de tes mains : « {q} ».{a}",
    "« {q} ».{a} La lampe du studio est restée allumée un peu plus tard.",
  ],
  relations: [
    "Tu as pris soin d'un lien : « {q} ».{a} L'immeuble a paru plus chaleureux.",
    "« {q} ».{a} Quelqu'un, quelque part, a pensé à toi aujourd'hui.",
    "Du temps pour les autres : « {q} ».{a} Ça ne se compte pas, alors on le raconte.",
  ],
  sante: [
    "Tu as pris soin de toi : « {q} ».{a} Les plantes aussi respirent mieux.",
    "« {q} ».{a} Le corps suit, la tête aussi.",
    "Une pause qui compte : « {q} ».{a} L'escalier t'a paru moins haut.",
  ],
  autre: ["Fait : « {q} ».{a}", "« {q} » : c'est fait.{a}"],
};

const AGENT_RECIT = [
  " {n} a regardé par-dessus ton épaule.",
  " {n} t'a tenu compagnie.",
  " {n} a hoché la tête.",
  " {n} en a parlé à tout l'étage.",
];

function recit(typeQuete, texte, nomAgent, degre, graine) {
  const modele = variante(RECITS[typeQuete] || RECITS.autre, graine);
  const agent = nomAgent ? variante(AGENT_RECIT, graine + "a").replace("{n}", nomAgent) : "";
  const mention = degre === 3 ? " Trois étoiles." : degre === 1 ? " Une étoile : c'est lancé." : "";
  return modele.replace("{q}", texte).replace("{a}", agent) + mention;
}

// ---------------------------------------------------------------- types de quête

function contient(texte, mots) {
  return Array.isArray(mots) && mots.length > 0 && P.contientMot(texte, mots);
}

// Type deviné : tag du fichier, puis vente, puis relations et santé, puis la catégorie de la note,
// puis administratif et création, puis le type par défaut.
function typeAuto(element, config) {
  if (element.tag && ORDRE_TYPES.includes(element.tag)) return element.tag;
  if (element.vente_auto === true) return "vente";
  const t = config.types;
  if (contient(element.texte, t.relations.mots)) return "relations";
  if (contient(element.texte, t.sante.mots)) return "sante";
  const parCategorie = element.categorie ? config.categories_note[element.categorie] : "";
  if (parCategorie) return parCategorie;
  if (contient(element.texte, t.admin.mots)) return "admin";
  if (contient(element.texte, t.creation.mots)) return "creation";
  return config.type_defaut;
}

// Type effectif : ce que le joueur a choisi passe devant.
function typeDe(partie, element, config) {
  const force = partie.types_forces[element.id];
  if (force && ORDRE_TYPES.includes(force)) return force;
  const auto = typeAuto(element, config);
  if (Object.prototype.hasOwnProperty.call(partie.ventes_forcees, element.id)) {
    if (partie.ventes_forcees[element.id] === true) return "vente";
    if (auto === "vente") return typeAuto({ ...element, vente_auto: false, tag: null }, config);
  }
  return auto;
}

function degresDe(partie, element, config) {
  const choisis = Array.isArray(partie.degres[element.id]) ? partie.degres[element.id] : [];
  const ecrits = Array.isArray(element.degres_ecrits) ? element.degres_ecrits : [];
  return [0, 1, 2].map((i) => choisis[i] || ecrits[i] || config.degres_defaut[i]);
}

// ---------------------------------------------------------------- plafond, arrosage, gain

function payeesCeJour(partie, dateISO) {
  let n = 0;
  for (const p of Object.values(partie.paiements)) if (p.date === dateISO && p.mode === "payee") n++;
  return n;
}

// Taux de la prochaine quête payée du jour : 100, le taux réduit, puis 0.
function tauxPlafond(config, rang) {
  const pl = config.plafond;
  if (!pl.par_jour) return 100;
  if (rang <= pl.plein) return 100;
  if (rang <= pl.par_jour) return pl.taux_reduit;
  return 0;
}

function instant(ctx) {
  return ctx.date + "T" + ctx.heure;
}

function ajouterHeures(dateISO, heure, h) {
  const d = new Date(dateISO + "T" + heure + ":00Z");
  d.setUTCMinutes(d.getUTCMinutes() + Math.round(h * 60));
  return d.toISOString().slice(0, 16);
}

function arrosageActif(partie, ctx) {
  const a = partie.arrosage;
  return Boolean(a && typeof a.jusqua === "string" && instant(ctx) < a.jusqua);
}

function vueArrosage(partie, ctx) {
  const actif = arrosageActif(partie, ctx);
  return {
    actif,
    jusqua: actif ? partie.arrosage.jusqua.slice(11, 16) : null,
    jusqua_date: actif ? partie.arrosage.jusqua.slice(0, 10) : null,
    fait_aujourdhui: Boolean(partie.arrosages[ctx.date]),
    bonus_pourcent: ctx.config.arrosage.bonus_pourcent,
    duree_h: ctx.config.arrosage.duree_h,
    total: Object.keys(partie.arrosages).length,
  };
}

// Ce que rapporte une quête : genre « ligne » ou « priorite », degré 1 à 3.
function calculerGain(partie, element, genre, degre, ctx) {
  const config = ctx.config;
  const typeQuete = typeDe(partie, element, config);
  const mode = config.types[typeQuete].mode;
  const d = Number.isInteger(degre) && degre >= 1 && degre <= 3 ? degre : config.points.degre_defaut;
  const resultat = { type_quete: typeQuete, mode, degre: d, vente: typeQuete === "vente", points: 0, taux: 100, rang: 0, arrosage: false };
  if (mode !== "payee") return resultat;
  const base = (genre === "ligne" ? config.points.ligne : config.points.priorite) * config.points.degres[d - 1];
  resultat.rang = payeesCeJour(partie, ctx.date) + 1;
  resultat.taux = tauxPlafond(config, resultat.rang);
  let points = base * (resultat.vente ? config.points.multiplicateur_vente : 1) * (resultat.taux / 100);
  if (points > 0 && arrosageActif(partie, ctx) && config.arrosage.bonus_pourcent > 0) {
    points *= 1 + config.arrosage.bonus_pourcent / 100;
    resultat.arrosage = true;
  }
  resultat.points = Math.round(points);
  return resultat;
}

function vuePlafond(partie, ctx) {
  const pl = ctx.config.plafond;
  const payees = payeesCeJour(partie, ctx.date);
  return {
    par_jour: pl.par_jour,
    plein: pl.plein,
    taux_reduit: pl.taux_reduit,
    payees,
    taux_prochaine: tauxPlafond(ctx.config, payees + 1),
    restantes: pl.par_jour ? Math.max(0, pl.par_jour - payees) : null,
  };
}

// ---------------------------------------------------------------- niveaux

function niveau(total, config) {
  const { seuils, noms } = config.niveaux;
  let i = 0;
  while (i + 1 < seuils.length && total >= seuils[i + 1]) i++;
  const suivant = i + 1 < seuils.length ? seuils[i + 1] : null;
  return {
    rang: i + 1,
    nom: noms[i],
    seuil: seuils[i],
    suivant,
    nom_suivant: suivant === null ? null : noms[i + 1],
    progression: suivant === null ? 100 : Math.round(((total - seuils[i]) / (suivant - seuils[i])) * 100),
    dernier: suivant === null,
  };
}

// ---------------------------------------------------------------- fonctions qui se débloquent

const NOMS_FONCTIONS = {
  contrat: { nom: "Le contrat du jour", quoi: "Chaque matin, deux contrats au choix : un sûr, un ambitieux avec une mise.", ou: "Il t'attend en haut du panneau Quêtes." },
  boutique: { nom: "La boutique", quoi: "Tes points achètent des meubles, que tu ranges où tu veux.", ou: "Onglet Boutique, puis onglet Ranger." },
  equipe: { nom: "L'équipe et son but", quoi: "Confie une quête à un agent. Un but commun pour la semaine, que vous remplissez ensemble.", ou: "Onglet Équipe." },
  argent: { nom: "L'argent encaissé", quoi: "Déclare ce que tu encaisses. La barre du mois avance vers ton objectif.", ou: "Onglet Argent." },
  carte: { nom: "La carte des caps", quoi: "Les étages s'ouvrent avec un résultat, les pièces avec un effort.", ou: "Onglet Carte." },
  arrosage: { nom: "L'arrosoir", quoi: "Arrose tes plantes une fois par jour : tes quêtes payées rapportent plus pendant quelques heures.", ou: "Clique sur une plante, ou sur l'arrosoir du panneau Quêtes." },
  trophees: { nom: "La collection", quoi: "Les objets des colis, tous visibles à l'avance, et tes badges.", ou: "Onglet Collection." },
  etat: { nom: "Comment je me sens ?", quoi: "Choisis ton état du moment : le jeu te rappelle tes propres gestes.", ou: "Onglet État." },
};

function aJoue(partie) {
  return partie.jours_actifs.length > 0 || Object.keys(partie.paiements).length > 0;
}

// Numéro du jour de jeu : les jours déjà joués avant aujourd'hui, plus un.
function jourDeJeu(partie, dateISO) {
  return partie.jours_actifs.filter((d) => d < dateISO).length + 1;
}

function vueFonctions(partie, config, dateISO) {
  const libre = !config.deblocages.actif || partie.tout_ouvert === true;
  const joue = aJoue(partie);
  const jour = jourDeJeu(partie, dateISO);
  const fonctions = {};
  for (const f of FONCTIONS) {
    const seuil = config.deblocages[f];
    const ouvert = libre || seuil === 0 || (joue && jour >= seuil);
    fonctions[f] = { ouvert, jour: seuil, ...NOMS_FONCTIONS[f] };
  }
  if (!config.contrat.actif) fonctions.contrat.ouvert = false;
  return {
    pas_a_pas: !libre,
    premiere_minute: !libre && !joue,
    jour_de_jeu: jour,
    fonctions,
  };
}

// Relève les fonctions qui viennent de s'ouvrir, une seule fois chacune.
function nouveauxDeblocages(partie, config, ctx) {
  const vue = vueFonctions(partie, config, ctx.date);
  const nouveaux = [];
  for (const f of FONCTIONS) {
    if (!vue.fonctions[f].ouvert || partie.deblocages_vus[f]) continue;
    partie.deblocages_vus[f] = ctx.date;
    if (vue.pas_a_pas) nouveaux.push({ type: "deblocage", fonction: f, nom: NOMS_FONCTIONS[f].nom, quoi: NOMS_FONCTIONS[f].quoi, ou: NOMS_FONCTIONS[f].ou });
  }
  return nouveaux;
}

// ---------------------------------------------------------------- compteurs d'effort

function compteurs(partie) {
  const c = { quetes: 0, admin: 0, vente: 0, creation: 0, relations: 0, sante: 0, confiees: 0, contrats: 0, semaines: 0, arrosages: 0 };
  for (const p of Object.values(partie.paiements)) {
    c.quetes++;
    const t = p.type_quete || (p.vente ? "vente" : null);
    if (t && Object.prototype.hasOwnProperty.call(c, t)) c[t]++;
    if (p.agent) c.confiees++;
  }
  for (const k of Object.values(partie.contrats)) if (k && k.statut === "tenu") c.contrats++;
  c.semaines = Object.keys(partie.semaines).length;
  c.arrosages = Object.keys(partie.arrosages).length;
  return c;
}

function possede(partie, lieuId, id) {
  return Array.isArray(partie.ameliorations[lieuId]) && partie.ameliorations[lieuId].includes(id);
}

// Les caps d'effort atteints ouvrent leur pièce ou posent leur meuble, sans rien coûter.
function verifierEfforts(partie, ctx, lieuOuvert) {
  const gains = [];
  const c = compteurs(partie);
  for (const cap of ctx.config.caps_effort) {
    const [lieuId, id] = cap.piece.split("/");
    const amelioration = catalogue.trouverAmelioration(lieuId, id);
    if (!amelioration) continue;
    if (!partie.efforts[cap.id] && c[cap.compteur] >= cap.seuil) partie.efforts[cap.id] = ctx.date;
    if (!partie.efforts[cap.id] || possede(partie, lieuId, id) || !lieuOuvert(lieuId)) continue;
    if (!Array.isArray(partie.ameliorations[lieuId])) partie.ameliorations[lieuId] = [];
    partie.ameliorations[lieuId].push(id);
    const piece = amelioration.type === "piece";
    noter(partie, ctx, "effort", (piece ? "Une pièce s'ouvre : " : "Un meuble arrive : ") + amelioration.nom + ". " + cap.libelle + ", c'est fait.");
    gains.push({ type: "effort", id: cap.id, cle: cap.piece, libelle: amelioration.nom, condition: cap.libelle, piece, points: 0, vente: false });
  }
  return gains;
}

function vueEfforts(partie, config, lieuOuvert) {
  const c = compteurs(partie);
  return config.caps_effort
    .map((cap) => {
      const [lieuId, id] = cap.piece.split("/");
      const amelioration = catalogue.trouverAmelioration(lieuId, id);
      if (!amelioration) return null;
      return {
        id: cap.id,
        cle: cap.piece,
        lieu: lieuId,
        amelioration: id,
        nom: amelioration.nom,
        piece: amelioration.type === "piece",
        compteur: cap.compteur,
        seuil: cap.seuil,
        valeur: Math.min(c[cap.compteur], cap.seuil),
        libelle: cap.libelle,
        atteint: Boolean(partie.efforts[cap.id]),
        ouvert: possede(partie, lieuId, id),
        lieu_ouvert: lieuOuvert(lieuId),
      };
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------- contrat du jour

const HEURES_PROPOSEES = ["09:00", "10:00", "11:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "23:30"];

function heuresPossibles(config, heure) {
  const possibles = HEURES_PROPOSEES.filter((h) => h > heure);
  const voulue = config.contrat.ambitieux.heure_limite;
  if (voulue > heure && !possibles.includes(voulue)) possibles.push(voulue);
  possibles.sort();
  return possibles.length ? possibles : ["23:59"];
}

function libelleHeure(h) {
  const [hh, mm] = h.split(":");
  return Number(hh) + " h" + (mm === "00" ? "" : " " + mm);
}

// Les deux contrats proposés ce matin, d'après les quêtes ouvertes du jour (dans l'ordre d'affichage).
function propositions(partie, ouvertes, ctx) {
  const k = ctx.config.contrat;
  if (!k.actif || ouvertes.length === 0) return null;
  const court = (q) => ({ id: q.id, texte: q.texte, type_quete: q.type_quete, genre: q.genre });
  const sur = ouvertes.slice(0, k.sur.quetes).map(court);
  const vedette = ouvertes.find((q) => q.type_quete === "vente") || ouvertes.find((q) => q.mode === "payee") || ouvertes[0];
  const autres = ouvertes.filter((q) => q.id !== vedette.id).slice(0, k.ambitieux.quetes).map(court);
  const heures = heuresPossibles(ctx.config, ctx.heure);
  const defaut = heures.includes(k.ambitieux.heure_limite) ? k.ambitieux.heure_limite : heures[0];
  // Pas assez de points pour la mise : tu mises ce que tu as, et le gain baisse du manque.
  // Sans cela, un joueur à zéro point aurait le gros gain sans rien risquer : un « bon contrat » évident.
  const mise = Math.min(k.ambitieux.mise, partie.points);
  const gainAmbitieux = Math.max(k.sur.gain, k.ambitieux.gain - (k.ambitieux.mise - mise));
  return {
    sur: { quetes: sur, gain: k.sur.gain, mise: 0 },
    ambitieux: {
      vedette: court(vedette),
      vedette_vente: vedette.type_quete === "vente",
      quetes: autres,
      mise,
      mise_voulue: k.ambitieux.mise,
      gain: gainAmbitieux,
      gain_plein: k.ambitieux.gain,
      colis: k.ambitieux.colis,
      heure_limite: defaut,
      heures: heures.map((h) => ({ valeur: h, libelle: libelleHeure(h) })),
    },
  };
}

function signer(partie, ouvertes, ctx, choix, heure) {
  const prop = propositions(partie, ouvertes, ctx);
  if (!prop) return null;
  if (choix === "aucun") {
    partie.contrats[ctx.date] = { choix: "aucun", statut: "aucun", signe_a: ctx.heure };
    return partie.contrats[ctx.date];
  }
  if (choix === "sur") {
    partie.contrats[ctx.date] = { choix: "sur", statut: "en_cours", signe_a: ctx.heure, quetes: prop.sur.quetes, gain: prop.sur.gain, mise: 0 };
    noter(partie, ctx, "contrat", "Contrat sûr signé : " + pluriel(prop.sur.quetes.length, "quête", "quêtes") + " pour " + prop.sur.gain + " points. Rien à perdre.");
    return partie.contrats[ctx.date];
  }
  const a = prop.ambitieux;
  const limite = a.heures.some((h) => h.valeur === heure) ? heure : a.heure_limite;
  partie.points -= a.mise;
  partie.contrats[ctx.date] = {
    choix: "ambitieux",
    statut: "en_cours",
    signe_a: ctx.heure,
    vedette: a.vedette,
    quetes: a.quetes,
    heure_limite: limite,
    gain: a.gain,
    mise: a.mise,
    colis: a.colis,
  };
  noter(partie, ctx, "contrat", "Contrat ambitieux signé : « " + a.vedette.texte + " » avant " + libelleHeure(limite) + (a.quetes.length ? ", plus " + pluriel(a.quetes.length, "quête", "quêtes") : "") + ". Mise : " + a.mise + " points.");
  return partie.contrats[ctx.date];
}

function idsContrat(k) {
  return [...(k.vedette ? [k.vedette.id] : []), ...(Array.isArray(k.quetes) ? k.quetes.map((q) => q.id) : [])];
}

// Fait le point sur les contrats en cours. Tenu : le gain tombe. Raté : seule la mise reste sur la table.
function resoudreContrats(partie, ctx) {
  const gains = [];
  for (const [date, k] of Object.entries(partie.contrats)) {
    if (!k || k.statut !== "en_cours" || date > ctx.date) continue;
    const faite = (id) => {
      const p = partie.paiements[id];
      return Boolean(p) && p.date === date;
    };
    const toutes = idsContrat(k).every(faite);
    const vedetteATemps = !k.vedette || (faite(k.vedette.id) && partie.paiements[k.vedette.id].heure <= k.heure_limite);
    if (toutes && vedetteATemps) {
      k.statut = "tenu";
      k.tenu_a = date === ctx.date ? ctx.heure : "23:59";
      partie.points += k.gain;
      partie.total_gagne += k.gain;
      let colis = null;
      if (k.choix === "ambitieux" && k.colis) {
        colis = "C-" + date.replace(/-/g, "");
        partie.colis[colis] = { date: ctx.date, ouvert: false, origine: "contrat" };
      }
      partie.historique.push({ quand: ctx.horodatage, type: "contrat", libelle: k.choix === "ambitieux" ? "Contrat ambitieux tenu" : "Contrat sûr tenu", points: k.gain });
      noter(partie, ctx, "contrat-tenu", (k.choix === "ambitieux" ? "Contrat ambitieux tenu. " : "Contrat sûr tenu. ") + "+" + k.gain + " points" + (colis ? ", et un colis en route." : "."));
      gains.push({ type: "contrat", id: "K-" + date, libelle: k.choix === "ambitieux" ? "Contrat ambitieux tenu" : "Contrat sûr tenu", points: k.gain, vente: false, choix: k.choix, colis: Boolean(colis), mise: k.mise });
      continue;
    }
    const jourPasse = date < ctx.date;
    const tropTard = k.choix === "ambitieux" && k.vedette && !vedetteATemps && (jourPasse || ctx.heure > k.heure_limite || faite(k.vedette.id));
    if (jourPasse || tropTard) {
      k.statut = k.choix === "ambitieux" ? "rate" : "passe";
      if (k.choix === "ambitieux") {
        noter(partie, ctx, "contrat-rate", "Contrat ambitieux non tenu. La mise de " + k.mise + " points reste sur la table. Rien d'autre ne bouge.");
        gains.push({ type: "contrat-rate", id: "K-" + date, libelle: "Contrat ambitieux non tenu", points: 0, vente: false, mise: k.mise, hier: jourPasse });
      }
    }
  }
  return gains;
}

function vueContrat(partie, ouvertes, ctx, ouvert) {
  const k = partie.contrats[ctx.date] || null;
  const tous = Object.values(partie.contrats).filter(Boolean);
  const bilan = {
    surs: tous.filter((x) => x.choix === "sur").length,
    surs_tenus: tous.filter((x) => x.choix === "sur" && x.statut === "tenu").length,
    ambitieux: tous.filter((x) => x.choix === "ambitieux").length,
    ambitieux_tenus: tous.filter((x) => x.choix === "ambitieux" && x.statut === "tenu").length,
  };
  if (!ouvert) return { ouvert: false, actif: ctx.config.contrat.actif, du_jour: null, propositions: null, a_choisir: false, bilan };
  let duJour = null;
  if (k) {
    const fait = (q) => ({ ...q, faite: Boolean(partie.paiements[q.id]) && partie.paiements[q.id].date === ctx.date });
    duJour = {
      choix: k.choix,
      statut: k.statut,
      gain: k.gain || 0,
      mise: k.mise || 0,
      colis: k.colis === true,
      heure_limite: k.heure_limite || null,
      heure_limite_libelle: k.heure_limite ? libelleHeure(k.heure_limite) : null,
      vedette: k.vedette ? fait(k.vedette) : null,
      quetes: (k.quetes || []).map(fait),
    };
  }
  const prop = k ? null : propositions(partie, ouvertes, ctx);
  return { ouvert: true, actif: true, du_jour: duJour, propositions: prop, a_choisir: !k && Boolean(prop), bilan };
}

// ---------------------------------------------------------------- équipe : but de la semaine, traits

const TRAITS = {
  cordee: { nom: "Premier de cordée", description: "La toute première quête faite ensemble." },
  fiable: { nom: "Fiable", description: "Cinq quêtes faites ensemble." },
  infatigable: { nom: "Infatigable", description: "Quinze quêtes faites ensemble." },
  element: { nom: "Dans son élément", description: "Trois quêtes de sa spécialité." },
  "leve-tot": { nom: "Lève-tôt", description: "Une quête bouclée avant 9 h." },
  nuit: { nom: "Oiseau de nuit", description: "Une quête bouclée après 21 h." },
  audacieux: { nom: "Audacieux", description: "A participé à un contrat ambitieux tenu." },
  equipe: { nom: "Esprit d'équipe", description: "A contribué à un but d'équipe atteint." },
  jardinier: { nom: "Main verte", description: "Présent un jour d'arrosage, cinq fois." },
};

function semaineDe(dateISO) {
  return P.semaineISO(dateISO).id;
}

function equipeDe(partie, semaine, config) {
  if (!estObjet(partie.equipe[semaine])) {
    // le libellé de la semaine passée reste, tant que le joueur n'en écrit pas un autre
    const precedentes = Object.keys(partie.equipe).sort();
    const derniere = precedentes.length ? partie.equipe[precedentes[precedentes.length - 1]] : null;
    partie.equipe[semaine] = { libelle: derniere && derniere.libelle ? derniere.libelle : "", unites: 0, par: { quetes: 0, specialite: 0, sessions: 0 }, ids: {}, sessions: {}, agents: {}, atteint: null };
  }
  const e = partie.equipe[semaine];
  if (!estObjet(e.par)) e.par = { quetes: 0, specialite: 0, sessions: 0 };
  if (!estObjet(e.ids)) e.ids = {};
  if (!estObjet(e.sessions)) e.sessions = {};
  if (!estObjet(e.agents)) e.agents = {};
  if (!Number.isFinite(e.unites)) e.unites = 0;
  void config;
  return e;
}

function cransDe(e, config) {
  return Math.min(config.but_equipe.crans, Math.floor(e.unites / config.but_equipe.par_cran));
}

function libelleBut(e, config) {
  return e.libelle || config.but_equipe.libelle || "Avancer ensemble cette semaine";
}

function gagnerTrait(partie, ctx, agentId, traitId, gains) {
  if (!ctx.config.agents[agentId] || !TRAITS[traitId]) return;
  if (!estObjet(partie.traits[agentId])) partie.traits[agentId] = {};
  if (partie.traits[agentId][traitId]) return;
  partie.traits[agentId][traitId] = ctx.date;
  const nom = ctx.config.agents[agentId].nom;
  noter(partie, ctx, "trait", nom + " gagne un trait : " + TRAITS[traitId].nom + ". " + TRAITS[traitId].description);
  gains.push({ type: "trait", id: agentId + "/" + traitId, agent: agentId, nom_agent: nom, libelle: TRAITS[traitId].nom, description: TRAITS[traitId].description, points: 0, vente: false });
}

// Ajoute des unités à la barre commune. Renvoie les événements : cran gagné, but atteint.
function avancerEquipe(partie, ctx, unites, source, gains) {
  if (unites <= 0) return;
  const config = ctx.config;
  const semaine = semaineDe(ctx.date);
  const e = equipeDe(partie, semaine, config);
  const avant = cransDe(e, config);
  e.unites += unites;
  e.par[source] = (e.par[source] || 0) + unites;
  const apres = cransDe(e, config);
  if (apres > avant) {
    gains.push({ type: "cran", id: "T-" + semaine + "-" + apres, libelle: libelleBut(e, config), crans: apres, total: config.but_equipe.crans, source, points: 0, vente: false });
  }
  if (apres >= config.but_equipe.crans && !e.atteint) {
    e.atteint = ctx.date;
    const recompense = config.but_equipe.recompense;
    partie.points += recompense;
    partie.total_gagne += recompense;
    partie.historique.push({ quand: ctx.horodatage, type: "equipe", libelle: "But d'équipe atteint", points: recompense });
    noter(partie, ctx, "equipe", "But d'équipe atteint : « " + libelleBut(e, config) + " ». Toute l'équipe l'a fait ensemble. +" + recompense + " points.");
    gains.push({ type: "but-atteint", id: "T-" + semaine, libelle: libelleBut(e, config), points: recompense, vente: false });
    for (const agentId of Object.keys(e.agents)) gagnerTrait(partie, ctx, agentId, "equipe", gains);
  }
}

// Une quête vient d'être faite : elle compte pour l'équipe, et l'agent qui accompagnait peut gagner un trait.
function apresQuete(partie, ctx, id, paiement, gains) {
  const config = ctx.config;
  const semaine = semaineDe(ctx.date);
  const e = equipeDe(partie, semaine, config);
  const agentId = paiement.agent && config.agents[paiement.agent] ? paiement.agent : null;
  if (!e.ids[id]) {
    e.ids[id] = true;
    avancerEquipe(partie, ctx, config.but_equipe.par_quete, "quetes", gains);
    if (agentId) {
      e.agents[agentId] = (e.agents[agentId] || 0) + 1;
      if (config.agents[agentId].specialite === paiement.type_quete && config.but_equipe.par_specialite > 0) {
        noter(partie, ctx, "agent", config.agents[agentId].nom + " était dans son élément (" + config.types[paiement.type_quete].nom.toLowerCase() + ") : un coup de pouce de plus pour le but d'équipe.");
        avancerEquipe(partie, ctx, config.but_equipe.par_specialite, "specialite", gains);
        gains.push({ type: "specialite", id: "S-" + id, agent: agentId, nom_agent: config.agents[agentId].nom, libelle: config.types[paiement.type_quete].nom, unites: config.but_equipe.par_specialite, points: 0, vente: false });
      }
    }
  }
  if (!agentId) return;
  const siennes = Object.values(partie.paiements).filter((p) => p.agent === agentId);
  gagnerTrait(partie, ctx, agentId, "cordee", gains);
  if (siennes.length >= 5) gagnerTrait(partie, ctx, agentId, "fiable", gains);
  if (siennes.length >= 15) gagnerTrait(partie, ctx, agentId, "infatigable", gains);
  if (siennes.filter((p) => p.type_quete === config.agents[agentId].specialite).length >= 3) gagnerTrait(partie, ctx, agentId, "element", gains);
  if (paiement.heure < "09:00") gagnerTrait(partie, ctx, agentId, "leve-tot", gains);
  if (paiement.heure >= "21:00") gagnerTrait(partie, ctx, agentId, "nuit", gains);
}

// Le vrai travail des agents : chaque session de travail active compte, quelques fois par jour.
function compterSessions(partie, ctx, collegues, gains) {
  const config = ctx.config;
  if (!config.but_equipe.par_session || !config.but_equipe.sessions_max_par_jour) return;
  const actifs = (collegues || []).filter((c) => c && c.statut === "actif" && typeof c.cle === "string");
  if (!actifs.length) return;
  const e = equipeDe(partie, semaineDe(ctx.date), config);
  const duJour = Array.isArray(e.sessions[ctx.date]) ? e.sessions[ctx.date] : (e.sessions[ctx.date] = []);
  for (const c of actifs) {
    if (duJour.length >= config.but_equipe.sessions_max_par_jour) break;
    if (duJour.includes(c.cle)) continue;
    duJour.push(c.cle);
    // le titre de la session n'est jamais gardé sur disque : seulement le fait qu'elle a travaillé
    noter(partie, ctx, "agent", "Une session de travail a avancé aujourd'hui : l'équipe progresse d'un cran de plus vers le but commun.");
    avancerEquipe(partie, ctx, config.but_equipe.par_session, "sessions", gains);
  }
}

// Un contrat ambitieux tenu : les agents qui ont accompagné ses quêtes gagnent le trait « Audacieux ».
function apresContrat(partie, ctx, gain, gains) {
  if (gain.type !== "contrat" || gain.choix !== "ambitieux") return;
  const k = partie.contrats[gain.id.slice(2)];
  if (!k) return;
  for (const id of idsContrat(k)) {
    const p = partie.paiements[id];
    if (p && p.agent) gagnerTrait(partie, ctx, p.agent, "audacieux", gains);
  }
}

function vueEquipe(partie, ctx, agentsOuverts) {
  const config = ctx.config;
  const semaine = semaineDe(ctx.date);
  const e = estObjet(partie.equipe[semaine]) ? partie.equipe[semaine] : { libelle: "", unites: 0, par: { quetes: 0, specialite: 0, sessions: 0 }, agents: {}, atteint: null };
  const precedentes = Object.keys(partie.equipe).filter((s) => s < semaine).sort();
  const derniere = precedentes.length ? partie.equipe[precedentes[precedentes.length - 1]] : null;
  const libelle = e.libelle || (derniere && derniere.libelle) || config.but_equipe.libelle || "";
  const crans = Math.min(config.but_equipe.crans, Math.floor((e.unites || 0) / config.but_equipe.par_cran));
  return {
    semaine,
    libelle: libelle || "Avancer ensemble cette semaine",
    libelle_ecrit: Boolean(libelle),
    crans,
    total: config.but_equipe.crans,
    unites: e.unites || 0,
    par_cran: config.but_equipe.par_cran,
    reste_cran: crans >= config.but_equipe.crans ? 0 : config.but_equipe.par_cran - ((e.unites || 0) % config.but_equipe.par_cran),
    par: { quetes: (e.par && e.par.quetes) || 0, specialite: (e.par && e.par.specialite) || 0, sessions: (e.par && e.par.sessions) || 0 },
    atteint: e.atteint || null,
    recompense: config.but_equipe.recompense,
    regles: { par_quete: config.but_equipe.par_quete, par_specialite: config.but_equipe.par_specialite, par_session: config.but_equipe.par_session, sessions_max_par_jour: config.but_equipe.sessions_max_par_jour },
    agents: agentsOuverts.map((a) => {
      const siennes = Object.values(partie.paiements).filter((p) => p.agent === a.id);
      const traits = estObjet(partie.traits[a.id]) ? partie.traits[a.id] : {};
      return {
        id: a.id,
        nom: a.nom,
        role: a.role,
        specialite: a.specialite,
        nom_specialite: config.types[a.specialite].nom,
        quetes: siennes.length,
        cette_semaine: (e.agents && e.agents[a.id]) || 0,
        traits: Object.keys(TRAITS)
          .filter((t) => traits[t])
          .map((t) => ({ id: t, nom: TRAITS[t].nom, description: TRAITS[t].description, date: traits[t] })),
      };
    }),
    traits_possibles: Object.entries(TRAITS).map(([id, t]) => ({ id, nom: t.nom, description: t.description })),
  };
}

// Le fichier que les sessions de travail peuvent lire : data/but-equipe.md.
function texteButEquipe(vue, ctx) {
  const lignes = [
    "# But d'équipe de la semaine " + vue.semaine,
    "",
    "But : " + vue.libelle,
    "Avancement : " + pluriel(vue.crans, "cran", "crans") + " sur " + vue.total + (vue.atteint ? " (atteint le " + vue.atteint + ")" : ""),
    "Mis à jour : " + ctx.date,
    "",
    "## Ce qui fait avancer la barre",
    "",
    "- Chaque quête faite par le joueur : " + vue.par.quetes + " cette semaine.",
    "- Une quête confiée à un agent dans sa spécialité : " + vue.par.specialite + " cette semaine.",
    "- Chaque session de travail active dans la journée : " + vue.par.sessions + " cette semaine.",
    "",
    "## Pour une session qui lit ce fichier",
    "",
    "Ce but est celui de toute l'équipe cette semaine. Avant de proposer un travail, demande-toi s'il le fait avancer.",
    "Ce fichier est écrit par le jeu, dans son propre dossier. Ne le modifie pas : il est réécrit à chaque changement.",
    "",
  ];
  return lignes.join("\n");
}

// ---------------------------------------------------------------- dimanche : la revue de la semaine

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function rangJour(dateISO) {
  return ((new Date(dateISO + "T00:00:00Z").getUTCDay() + 6) % 7) + 1; // lundi = 1
}

function bilanSemaine(partie, registre, semaine, config) {
  const lundi = P.lundiDe(semaine);
  const dimanche = P.ajouterJours(lundi, 6);
  const dans = (d) => typeof d === "string" && d >= lundi && d <= dimanche;
  const paiements = Object.values(partie.paiements).filter((p) => dans(p.date));
  const parType = {};
  for (const t of ORDRE_TYPES) parType[t] = 0;
  const parJour = {};
  let points = 0;
  let confiees = 0;
  for (const p of paiements) {
    const t = p.type_quete || (p.vente ? "vente" : config.type_defaut);
    if (Object.prototype.hasOwnProperty.call(parType, t)) parType[t]++;
    parJour[p.date] = (parJour[p.date] || 0) + 1;
    points += p.points || 0;
    if (p.agent) confiees++;
  }
  for (const [date, b] of Object.entries(partie.bonus_jours)) if (dans(b.paye_le || date)) points += b.points || 0;
  const contrats = Object.entries(partie.contrats).filter(([d, k]) => dans(d) && k && k.choix !== "aucun");
  for (const [, k] of contrats) if (k.statut === "tenu") points += k.gain || 0;
  const e = estObjet(partie.equipe[semaine]) ? partie.equipe[semaine] : { unites: 0, par: {} };
  const crans = Math.min(config.but_equipe.crans, Math.floor((e.unites || 0) / config.but_equipe.par_cran));
  const encaisse = registre.encaissements.filter((x) => dans(x.date)).reduce((s, x) => s + x.montant, 0);
  const c = compteurs(partie);

  // La leçon : quel type de quête a fait avancer les caps.
  const phrases = [];
  const total = paiements.length;
  const classes = ORDRE_TYPES.filter((t) => parType[t] > 0).sort((a, b) => parType[b] - parType[a]);
  const nomType = (t) => config.types[t].nom.toLowerCase();
  let moteur = null;
  if (total === 0) {
    phrases.push("Semaine calme : aucune quête cochée. Rien n'est perdu, l'immeuble t'attend tel que tu l'as laissé.");
  } else {
    const enTete = classes.filter((t) => parType[t] === parType[classes[0]]);
    if (enTete.length > 1 && total > 1) {
      phrases.push("Semaine partagée : " + enTete.map(nomType).join(", ").replace(/, ([^,]*)$/, " et $1") + " à égalité, sur " + pluriel(total, "quête", "quêtes") + ".");
    } else {
      phrases.push("Tu as surtout fait " + (classes[0] === "admin" ? "de l'administratif" : classes[0] === "vente" ? "de la vente" : classes[0] === "creation" ? "de la création" : classes[0] === "relations" ? "du lien avec les autres" : "du soin pour toi") + " : " + parType[classes[0]] + " sur " + pluriel(total, "quête", "quêtes") + ".");
    }
    // Caps d'effort encore ouverts que cette semaine a nourris.
    const pousses = [];
    for (const cap of config.caps_effort) {
      if (partie.efforts[cap.id] && !dans(partie.efforts[cap.id])) continue;
      const amelioration = catalogue.trouverAmelioration(...cap.piece.split("/"));
      if (!amelioration) continue;
      const apport = cap.compteur === "quetes" ? total : cap.compteur === "confiees" ? confiees : cap.compteur === "contrats" ? contrats.filter(([, k]) => k.statut === "tenu").length : Object.prototype.hasOwnProperty.call(parType, cap.compteur) ? parType[cap.compteur] : 0;
      if (apport > 0) pousses.push({ cap, amelioration, apport, valeur: Math.min(c[cap.compteur], cap.seuil) });
    }
    pousses.sort((a, b) => b.valeur / b.cap.seuil - a.valeur / a.cap.seuil);
    if (encaisse > 0) {
      moteur = "vente";
      phrases.push("Les étages s'ouvrent avec ce que tu encaisses : " + formaterMontant(encaisse, config.monnaie) + " cette semaine" + (parType.vente ? ", après " + pluriel(parType.vente, "action de vente", "actions de vente") + "." : "."));
    } else if (parType.vente > 0) {
      moteur = "vente";
      phrases.push(pluriel(parType.vente, "action de vente", "actions de vente") + " cette semaine. C'est ce type de quête qui ouvre les étages, dès que l'argent arrive.");
    } else {
      phrases.push("Les étages s'ouvrent avec ce que tu encaisses, et aucune action de vente n'est passée cette semaine. Une seule, glissée dans un contrat, suffit à relancer la machine.");
    }
    if (pousses.length) {
      const p = pousses[0];
      const par = p.cap.compteur === "quetes" ? "toutes tes quêtes" : p.cap.compteur === "confiees" ? "tes quêtes faites avec un agent" : p.cap.compteur === "contrats" ? "tes contrats tenus" : "tes quêtes de " + (ORDRE_TYPES.includes(p.cap.compteur) ? nomType(p.cap.compteur) : p.cap.compteur);
      phrases.push("Côté effort, " + par + " ont fait avancer un cap : « " + p.amelioration.nom + " » en est à " + p.valeur + " sur " + p.cap.seuil + ".");
      if (!moteur && ORDRE_TYPES.includes(p.cap.compteur)) moteur = p.cap.compteur;
    }
    const tenus = contrats.filter(([, k]) => k.statut === "tenu").length;
    if (contrats.length) phrases.push("Contrats : " + tenus + " tenu" + (tenus > 1 ? "s" : "") + " sur " + contrats.length + " signé" + (contrats.length > 1 ? "s" : "") + ".");
    const meilleur = Object.keys(parJour).sort((a, b) => parJour[b] - parJour[a])[0];
    if (meilleur && Object.keys(parJour).length > 1) phrases.push("Ton jour le plus plein : " + JOURS[rangJour(meilleur) - 1] + ", avec " + pluriel(parJour[meilleur], "quête", "quêtes") + ".");
  }
  return {
    semaine,
    lundi,
    dimanche,
    chiffres: { quetes: total, points, crans, crans_total: config.but_equipe.crans },
    par_type: ORDRE_TYPES.map((t) => ({ type: t, nom: config.types[t].nom, mode: config.types[t].mode, nombre: parType[t] })),
    encaisse,
    lecon: phrases,
    moteur: moteur || classes[0] || null,
  };
}

function vueDimanche(partie, registre, ctx) {
  const config = ctx.config;
  const semaine = semaineDe(ctx.date);
  const rang = rangJour(ctx.date);
  const precedente = semaineDe(P.ajouterJours(ctx.date, -7));
  let cible = null;
  let enRetard = false;
  if (!partie.semaines[semaine] && rang >= config.dimanche.jour) cible = semaine;
  else if (!partie.semaines[precedente]) {
    // la revue de la semaine passée t'attend, si tu y as joué
    const lundi = P.lundiDe(precedente);
    const dimanche = P.ajouterJours(lundi, 6);
    if (Object.values(partie.paiements).some((p) => p.date >= lundi && p.date <= dimanche)) {
      cible = precedente;
      enRetard = true;
    }
  }
  const nb = Object.keys(partie.semaines).length;
  return {
    jour: config.dimanche.jour,
    nom_jour: JOURS[config.dimanche.jour - 1],
    recompense: config.dimanche.recompense,
    disponible: Boolean(cible),
    semaine: cible,
    en_retard: enRetard,
    dans_jours: partie.semaines[semaine] ? null : Math.max(0, config.dimanche.jour - rang),
    faite: Boolean(partie.semaines[semaine]),
    bilan: cible ? bilanSemaine(partie, registre, cible, config) : null,
    semaines_bouclees: nb,
    dernieres: Object.entries(partie.semaines)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 8)
      .map(([id, s]) => ({ semaine: id, chiffres: s.chiffres, lecon: s.lecon, mot: s.mot || "", cloturee_le: s.cloturee_le })),
  };
}

module.exports = {
  TRAITS,
  NOMS_FONCTIONS,
  HEURES_PROPOSEES,
  pluriel,
  variante,
  noter,
  recit,
  typeAuto,
  typeDe,
  degresDe,
  payeesCeJour,
  tauxPlafond,
  instant,
  ajouterHeures,
  arrosageActif,
  vueArrosage,
  calculerGain,
  vuePlafond,
  niveau,
  aJoue,
  jourDeJeu,
  vueFonctions,
  nouveauxDeblocages,
  compteurs,
  verifierEfforts,
  vueEfforts,
  heuresPossibles,
  libelleHeure,
  propositions,
  signer,
  idsContrat,
  resoudreContrats,
  vueContrat,
  semaineDe,
  equipeDe,
  avancerEquipe,
  apresQuete,
  apresContrat,
  compterSessions,
  gagnerTrait,
  vueEquipe,
  texteButEquipe,
  rangJour,
  bilanSemaine,
  vueDimanche,
  LIBELLES_COMPTEURS,
};

  });

  definir("/jeu/serveur/systeme.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/systeme.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// Le Système (version 4) : expérience, niveaux, rangs de E à S, statistiques, points de vie, or,
// butin, équipement, familiers, habitudes, quotidiennes, zone de pénalité, donjons et boss, ombres,
// studio (équipiers, recherche, voisinages, combos, classement, événements), saisons et prestige.
// Tout vit dans partie.systeme. Fonctions pures : aucun accès disque. Tous les noms sont inventés ici.
//
// Deux principes gardés de la version 3 :
// - un acquis ne se perd jamais (expérience, niveau, or, objets, ombres) ;
// - une absence ne coûte rien : seul un jour où le jeu a été ouvert peut coûter des points de vie.

const crypto = require("node:crypto");
const { ErreurJeu } = require("./config");
const P = require("./parseurs");
const SC = require("./sysconfig");
const { STATS, RANGS } = SC;

const MAX_FIL = 40;
const MAX_LISTE = 40;
const MIETTES_ECLOSION = 3;
const AU_JOURNAL = new Set(["niveau", "rang", "boss", "ombre", "prestige", "ceremonie", "saison", "familier"]);
const PRIX_RARETE = { commun: 60, rare: 150, epique: 400 };
// Nombre d'étapes qu'il faut pour venir à bout d'un boss, sans aucune quête : un grand projet demande plus d'étapes.
const ETAPES_BOSS = { petit: 5, moyen: 8, grand: 12 };
const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// ---------------------------------------------------------------- catalogue (tout est inventé)

const OBJETS = {
  stylo: { nom: "Stylo plume du matin", genre: "outil", rarete: "commun", stats: { creativite: 1 }, poids: 10 },
  clavier: { nom: "Clavier qui claque", genre: "outil", rarete: "rare", stats: { intelligence: 2 }, poids: 5 },
  "plume-doree": { nom: "Plume d'oie dorée", genre: "outil", rarete: "epique", stats: { creativite: 3, charisme: 1 }, poids: 2 },
  gilet: { nom: "Gilet de laine", genre: "tenue", rarete: "commun", stats: { endurance: 1 }, poids: 10 },
  veste: { nom: "Veste de chantier", genre: "tenue", rarete: "rare", stats: { force: 1, endurance: 1 }, poids: 5 },
  cape: { nom: "Cape de l'éditeur", genre: "tenue", rarete: "epique", stats: { endurance: 2, charisme: 2 }, poids: 2 },
  trefle: { nom: "Trèfle séché", genre: "talisman", rarete: "commun", effets: { butin: 3 }, poids: 10 },
  sablier: { nom: "Sablier de poche", genre: "talisman", rarete: "rare", effets: { xp: 5 }, poids: 5 },
  "boussole-cuivre": { nom: "Boussole de cuivre", genre: "talisman", rarete: "epique", effets: { xp: 5, or: 5 }, poids: 2 },
  tisane: { nom: "Tisane du soir", genre: "potion", rarete: "commun", soin: 15, poids: 14, prix: 25 },
  miette: { nom: "Miette de brioche", genre: "nourriture", rarete: "commun", poids: 16, prix: 10 },
  bourse: { nom: "Bourse oubliée", genre: "or", rarete: "commun", or: 15, poids: 12 },
  "oeuf-moineau": { nom: "Œuf de moineau", genre: "oeuf", rarete: "rare", familier: "moineau", poids: 4 },
  "oeuf-chat": { nom: "Panier qui miaule", genre: "oeuf", rarete: "rare", familier: "chat", poids: 4 },
  "oeuf-herisson": { nom: "Boule de feuilles", genre: "oeuf", rarete: "rare", familier: "herisson", poids: 4 },
  "oeuf-salamandre": { nom: "Œuf tiède", genre: "oeuf", rarete: "epique", familier: "salamandre", poids: 2 },
};
const RARETES = { commun: "Commun", rare: "Rare", epique: "Épique" };
const GENRES = { outil: "Outil", tenue: "Tenue", talisman: "Talisman", potion: "Potion", nourriture: "Nourriture", or: "Or", oeuf: "À faire éclore" };
const EMPLACEMENTS = ["outil", "tenue", "talisman"];

const FAMILIERS = {
  moineau: { nom: "Moineau du toit", effets: { xp: 5 }, texte: "+5 % d'expérience" },
  chat: { nom: "Chat de gouttière", effets: { or: 5 }, texte: "+5 % d'or" },
  herisson: { nom: "Hérisson du square", effets: { reduc: 10 }, texte: "10 % de dégâts en moins" },
  salamandre: { nom: "Salamandre de la chaudière", effets: { butin: 3 }, texte: "+3 % de chance de butin" },
};

const BOSS = ["Le Colosse de Paperasse", "L'Hydre des Onglets ouverts", "Le Gardien des Brouillons", "Le Dragon du Dernier Moment", "La Sphinge des Retours", "Le Golem des Reports", "Le Spectre de la Page blanche", "L'Ogre des Petits Détails"];
const NOMS_OMBRES = ["Veilleur", "Sentinelle", "Éclaireuse", "Gardien du seuil", "Passe-muraille", "Vigie", "Lanterne", "Compagnon de l'aube"];
const PRENOMS = ["Lison", "Octave", "Maëlle", "Basile", "Suzon", "Anatole", "Clémence", "Firmin", "Ondine", "Lazare", "Capucine", "Gaspard", "Zélie", "Hippolyte", "Blanche", "Côme"];
const RIVAUX = [
  { nom: "Atelier Pivoine", base: 120, rythme: 22 },
  { nom: "Maison Cormoran", base: 600, rythme: 31 },
  { nom: "Studio Mistral", base: 1500, rythme: 38 },
  { nom: "Les Presses du Canal", base: 4000, rythme: 44 },
  { nom: "Fabrique Lanterne", base: 9000, rythme: 52 },
];

const EVENEMENTS = [
  { id: "facteur", titre: "Le facteur s'est trompé d'étage", texte: "Une enveloppe sans nom, avec quelques pièces dedans.", or: 10 },
  { id: "douche", titre: "Une idée te vient sous la douche", texte: "Tu la notes avant qu'elle ne s'envole.", xp: 15 },
  { id: "chat", titre: "Le chat de l'immeuble dort sur ton clavier", texte: "Il ronfle sur la touche espace.", choix: [
    { libelle: "Le laisser dormir", suite: "Tu souffles, lui aussi.", pv: 6 },
    { libelle: "Le poser sur le fauteuil", suite: "Il te regarde de travers, mais tu avances.", xp: 12 },
  ] },
  { id: "colporteur", titre: "Un colporteur sonne à l'interphone", texte: "Il a des tisanes plein sa valise, et du temps devant lui.", choix: [
    { libelle: "Goûter sa tisane", suite: "Il t'en laisse un sachet.", objet: "tisane" },
    { libelle: "Marchander pour le plaisir", suite: "Tu ne lui achètes rien, il te rend quand même la monnaie d'un pari.", or: 8 },
  ] },
  { id: "cafe", titre: "La voisine du palier propose un café", texte: "Dix minutes, pas plus, promet-elle.", choix: [
    { libelle: "Accepter", suite: "Vingt minutes plus tard, tu remontes le sourire aux lèvres.", pv: 5, xp: 5 },
    { libelle: "Rester sur ta lancée", suite: "Tu notes deux idées pendant que le café refroidit ailleurs.", recherche: 2 },
  ] },
  { id: "malle", titre: "Une vieille malle traîne au grenier", texte: "Personne ne sait à qui elle est.", choix: [
    { libelle: "L'ouvrir tout de suite", suite: "Elle grince, puis elle cède.", butin: true },
    { libelle: "La vendre au brocanteur", suite: "Il la prend sans même l'ouvrir.", or: 12 },
  ] },
  { id: "livreur", titre: "Le livreur s'est trompé de colis", texte: "Le nom sur l'étiquette n'est pas le tien.", choix: [
    { libelle: "Le porter au bon étage", suite: "Tout l'immeuble le saura avant ce soir.", xp: 15 },
    { libelle: "Le garder à l'accueil", suite: "Le voisin passe le prendre et te laisse une miette de brioche.", objet: "miette" },
  ] },
  { id: "reseau", titre: "Panne de réseau dans tout le quartier", texte: "Plus rien ne charge. Le silence est étrange.", choix: [
    { libelle: "Écrire à la main", suite: "Le carnet se remplit plus vite que prévu.", recherche: 2 },
    { libelle: "Sortir marcher", suite: "Le quartier est plus joli que dans ton souvenir.", pv: 6 },
  ] },
  { id: "courant", titre: "Coupure de courant de dix minutes", texte: "Tu réfléchis sur papier, pour une fois.", recherche: 1 },
  { id: "brioche", titre: "La boulangère t'offre une brioche", texte: "Il en reste une miette pour plus tard.", objet: "miette" },
  { id: "voisin", titre: "Un voisin te prête un livre", texte: "Corné à la bonne page.", recherche: 2 },
  { id: "marche", titre: "Jour de marché en bas de l'immeuble", texte: "On te rend la monnaie en trop.", or: 8 },
  { id: "calme", titre: "Rien de spécial, et c'est très bien", texte: "Une journée calme commence.", pv: 3 },
  { id: "pigeon", titre: "Un pigeon voyageur se pose à ta fenêtre", texte: "Il repart sans message, mais l'équipe est de bonne humeur.", xp: 10 },
  { id: "ascenseur", titre: "L'ascenseur est en panne", texte: "Tu montes à pied. Les mollets s'en souviendront.", pv: 4 },
  { id: "concierge", titre: "La concierge te garde un colis depuis mardi", texte: "Dedans, une tisane que tu ne te rappelais pas avoir commandée.", objet: "tisane" },
  { id: "pluie", titre: "Il pleut sur les toits de zinc", texte: "Le bruit parfait pour avancer. Tu notes deux idées.", recherche: 2 },
  { id: "voisine", titre: "La voisine du dessus répète son piano", texte: "Toujours le même morceau, et tu finis par l'aimer.", xp: 8 },
  { id: "monnaie", titre: "Tu retrouves un billet dans une poche de manteau", texte: "L'hiver a du bon.", or: 12 },
  { id: "pigeons", titre: "Deux pigeons se disputent ton rebord de fenêtre", texte: "Tu arbitres. Ils laissent une miette en partant.", objet: "miette" },
  { id: "tiroir", titre: "Tu retrouves un vieux carnet au fond d'un tiroir", texte: "Trois bonnes idées dedans.", recherche: 1, xp: 5 },
];

// Combos : des journées qui marient plusieurs types de quête. On les découvre en jouant.
const COMBOS = [
  { id: "lancement", nom: "Le lancement", types: ["creation", "vente"] },
  { id: "corps-ame", nom: "Corps et âme", types: ["sante", "creation"] },
  { id: "bonne-maison", nom: "Bonne maison", types: ["admin", "relations"] },
  { id: "reseau", nom: "Réseau vivant", types: ["relations", "vente"] },
  { id: "esprit-clair", nom: "Esprit clair", types: ["sante", "admin"] },
  { id: "journee-pleine", nom: "Journée pleine", divers: 4 },
  { id: "grand-chelem", nom: "Grand chelem", divers: 5 },
  { id: "triple", nom: "Triplé d'étoiles", triples: 3 },
];
const OR_COMBO = 10;
const XP_DECOUVERTE = 30;

// Arbre de recherche : chaque niveau d'un nœud se cumule. « apres » : les nœuds à avoir d'abord.
const RECHERCHES = [
  { id: "methode", nom: "Méthode de travail", max: 5, cout: 4, effets: { xp: 5 }, texte: "+5 % d'expérience par niveau", apres: {} },
  { id: "negoce", nom: "Sens du commerce", max: 5, cout: 5, effets: { or: 5 }, texte: "+5 % d'or par niveau", apres: { methode: 1 } },
  { id: "flair", nom: "Flair", max: 5, cout: 5, effets: { butin: 2 }, texte: "+2 % de chance de butin par niveau", apres: { methode: 1 } },
  { id: "constitution", nom: "Bonne constitution", max: 5, cout: 6, effets: { pv: 5 }, texte: "+5 points de vie par niveau", apres: { methode: 2 } },
  { id: "sang-froid", nom: "Sang-froid", max: 4, cout: 7, effets: { reduc: 5 }, texte: "5 % de dégâts en moins par niveau", apres: { constitution: 1 } },
  { id: "siege", nom: "Art du siège", max: 5, cout: 6, effets: { boss: 3 }, texte: "+3 dégâts sur les boss par niveau", apres: { methode: 2 } },
  { id: "talents", nom: "Agence des talents", max: 3, cout: 10, effets: { places: 1 }, texte: "+1 place d'équipier par niveau", apres: { negoce: 2 } },
  { id: "veille", nom: "Veilleurs de nuit", max: 3, cout: 8, effets: { heures: 12 }, texte: "+12 h de production hors ligne par niveau", apres: { talents: 1 } },
  { id: "pacte", nom: "Pacte des ombres", max: 3, cout: 9, effets: { ombres: 2 }, texte: "Une ombre se recrute 2 jours plus tôt par niveau", apres: { "sang-froid": 1, flair: 2 } },
];

// Voisinages : deux aménagements du même lieu qui se renforcent.
const VOISINAGES = [
  { id: "coin-lecture", nom: "Coin lecture", lieu: "studio", pieces: ["etagere", "fauteuil"], noms: "Étagère de livres et fauteuil de lecture", effets: { xp: 3 }, texte: "+3 % d'expérience" },
  { id: "coin-voix", nom: "Coin de la voix", lieu: "studio", pieces: ["micro", "lampadaire"], noms: "Micro sur pied et lampe sur pied", effets: { or: 2 }, texte: "+2 % d'or" },
  { id: "pole-vente", nom: "Pôle vente", lieu: "coworking", pieces: ["cabine", "objectifs"], noms: "Cabine d'appel et tableau d'objectifs", effets: { or: 3 }, texte: "+3 % d'or" },
  { id: "pause-fraiche", nom: "Pause fraîche", lieu: "coworking", pieces: ["fontaine", "ficus"], noms: "Fontaine à eau et grand ficus", effets: { pv: 5 }, texte: "+5 points de vie" },
  { id: "mur-idees", nom: "Mur d'idées", lieu: "atelier", pieces: ["tableau-blanc", "table-dessin"], noms: "Tableau blanc et table à dessin", effets: { recherche: 1 }, texte: "+1 point de recherche par quête" },
  { id: "voix-pages", nom: "Voix et pages", lieu: "atelier", pieces: ["bibliotheque", "studio-son"], noms: "Bibliothèque et salle d'enregistrement", effets: { xp: 3 }, texte: "+3 % d'expérience" },
  { id: "plateau", nom: "Plateau complet", lieu: "bureaux", pieces: ["salle-reunion", "studio-video"], noms: "Salle de réunion et studio vidéo", effets: { or: 3 }, texte: "+3 % d'or" },
  { id: "aile-lecteurs", nom: "Aile des lecteurs", lieu: "maison-edition", pieces: ["grande-bibliotheque", "salle-lecture"], noms: "Grande bibliothèque et salle de lecture", effets: { xp: 5 }, texte: "+5 % d'expérience" },
  { id: "papier-rue", nom: "Du papier à la rue", lieu: "maison-edition", pieces: ["presse", "enseigne"], noms: "Presse à imprimer et enseigne en façade", effets: { or: 5 }, texte: "+5 % d'or" },
];

const EFFETS_STATS = {
  force: (c) => "+" + c.pv.par_force + " points de vie par point",
  endurance: () => "3 % de dégâts en moins par point (60 % au plus)",
  intelligence: () => "+1 % d'expérience par point",
  charisme: () => "+1 % d'or par point",
  creativite: () => "+0,5 % de chance de butin par point",
};

// ---------------------------------------------------------------- état

function etatNeuf() {
  return {
    eveille: null,
    xp: 0,
    points_stats: 0,
    stats: { force: 0, endurance: 0, intelligence: 0, charisme: 0, creativite: 0 },
    pratique: { force: 0, endurance: 0, intelligence: 0, charisme: 0, creativite: 0 },
    pv: null,
    or: 0,
    compteur: 0,
    quetes_comptees: {},
    habitudes: [],
    quotidiennes: [],
    graces: {},
    repos: false,
    jour_regle: null,
    penalite: null,
    defi: null,
    compte_jour: null,
    geste_le: null,
    xp_prestiges: 0,
    reste: { or: 0, recherche: 0 },
    donjons: [],
    donjon_actif: null,
    boss_vaincus: 0,
    ombres: [],
    inventaire: {},
    equipement: { outil: null, tenue: null, talisman: null },
    familiers: {},
    familier_actif: null,
    recompenses: null,
    equipiers: [],
    recherche: 0,
    recherches: {},
    combos: {},
    evenement: null,
    saison: { numero: 1, debut: null },
    prestige: 0,
    annee_fetee: null,
    vu_a: null,
    fil: [],
  };
}

function estObjet(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Lecture d'une clé qui appartient vraiment au catalogue (jamais « constructor » ou « __proto__ »).
function propre(objet, cle) {
  return typeof cle === "string" && Object.prototype.hasOwnProperty.call(objet, cle) ? objet[cle] : undefined;
}

function entierPositif(v, defaut) {
  return Number.isFinite(v) && v >= 0 ? Math.round(v) : defaut;
}

// Complète un état lu sur disque (partie de la version 3 : rien du tout, ou champ manquant).
function normaliser(lu) {
  const s = etatNeuf();
  if (!estObjet(lu)) return s;
  if (typeof lu.eveille === "string") s.eveille = lu.eveille;
  for (const c of ["xp", "points_stats", "or", "compteur", "boss_vaincus", "recherche", "prestige", "xp_prestiges"]) s[c] = entierPositif(lu[c], s[c]);
  if (P.dateValide(lu.geste_le)) s.geste_le = lu.geste_le;
  if (estObjet(lu.reste)) s.reste = { or: entierPositif(lu.reste.or, 0) % 2, recherche: entierPositif(lu.reste.recherche, 0) % 6 };
  if (Number.isFinite(lu.pv)) s.pv = Math.max(0, Math.round(lu.pv));
  for (const groupe of ["stats", "pratique"]) for (const x of STATS) s[groupe][x] = entierPositif(estObjet(lu[groupe]) ? lu[groupe][x] : undefined, 0);
  for (const c of ["quetes_comptees", "graces", "inventaire", "familiers", "recherches", "combos"]) if (estObjet(lu[c])) s[c] = lu[c];
  for (const c of ["habitudes", "quotidiennes", "donjons", "ombres", "equipiers", "fil"]) if (Array.isArray(lu[c])) s[c] = lu[c].filter((x) => estObjet(x) && typeof x.id === "string");
  if (Array.isArray(lu.fil)) s.fil = lu.fil.filter(estObjet).slice(-MAX_FIL);
  // Un fichier abîmé ou retouché à la main ne doit jamais faire planter le jeu : chaque élément retrouve ses champs.
  const date = (v) => (typeof v === "string" ? v : null);
  s.habitudes = s.habitudes.map((h) => ({ ...h, texte: String(h.texte || "Habitude"), sens: h.sens === "-" || h.sens === "+-" ? h.sens : "+", stat: STATS.includes(h.stat) ? h.stat : "endurance", plus: entierPositif(h.plus, 0), moins: entierPositif(h.moins, 0) }));
  s.quotidiennes = s.quotidiennes.map((q) => ({ ...q, texte: String(q.texte || "Quotidienne"), stat: STATS.includes(q.stat) ? q.stat : "endurance", serie: entierPositif(q.serie, 0), record: entierPositif(q.record, 0), total: entierPositif(q.total, 0), faites: estObjet(q.faites) ? q.faites : {}, cree_le: typeof q.cree_le === "string" ? q.cree_le : "" }));
  s.donjons = s.donjons.map((d) => {
    const pvMaxBoss = Math.max(1, entierPositif(d.pv_max, 100));
    return {
      ...d,
      nom: String(d.nom || "Projet"),
      taille: d.taille === "moyen" || d.taille === "grand" ? d.taille : "petit",
      boss: typeof d.boss === "string" && d.boss ? d.boss : BOSS[0],
      pv_max: pvMaxBoss,
      pv: Math.min(pvMaxBoss, entierPositif(d.pv, pvMaxBoss)),
      etapes: Array.isArray(d.etapes) ? d.etapes.filter((x) => estObjet(x) && typeof x.id === "string").map((x) => ({ ...x, texte: String(x.texte || "Étape"), faite: date(x.faite) })) : [],
      cree_le: typeof d.cree_le === "string" ? d.cree_le : "",
      vaincu_le: date(d.vaincu_le),
    };
  });
  s.ombres = s.ombres.map((o) => ({ ...o, nom: String(o.nom || "Ombre"), origine: String(o.origine || ""), stat: STATS.includes(o.stat) ? o.stat : "endurance", bonus: entierPositif(o.bonus, 0) }));
  s.equipiers = s.equipiers.map((x) => ({ ...x, nom: String(x.nom || "Équipier"), metier: SC.TYPES.includes(x.metier) ? x.metier : "admin", talent: Math.min(3, Math.max(1, entierPositif(x.talent, 1))), niveau: Math.min(10, Math.max(1, entierPositif(x.niveau, 1))), pratique: entierPositif(x.pratique, 0) }));
  for (const id of Object.keys(s.inventaire)) if (!propre(OBJETS, id) || !(entierPositif(s.inventaire[id], 0) > 0)) delete s.inventaire[id];
  for (const id of Object.keys(s.inventaire)) s.inventaire[id] = entierPositif(s.inventaire[id], 0);
  for (const id of Object.keys(s.familiers)) if (!propre(FAMILIERS, id)) delete s.familiers[id];
  for (const id of Object.keys(s.recherches)) {
    const r = RECHERCHES.find((x) => x.id === id);
    if (!r) delete s.recherches[id];
    else s.recherches[id] = Math.min(r.max, entierPositif(s.recherches[id], 0));
  }
  if (Array.isArray(lu.recompenses)) s.recompenses = lu.recompenses.filter((x) => estObjet(x) && typeof x.id === "string" && typeof x.texte === "string").map((x) => ({ ...x, prix: entierPositif(x.prix, 0), achats: entierPositif(x.achats, 0) }));
  s.repos = lu.repos === true;
  if (P.dateValide(lu.jour_regle)) s.jour_regle = lu.jour_regle;
  if (estObjet(lu.penalite) && Number.isInteger(lu.penalite.a_faire)) s.penalite = { depuis: String(lu.penalite.depuis || ""), a_faire: lu.penalite.a_faire, fait: entierPositif(lu.penalite.fait, 0) };
  if (estObjet(lu.defi) && P.dateValide(lu.defi.date)) s.defi = { date: lu.defi.date, fait: entierPositif(lu.defi.fait, 0), recu: lu.defi.recu === true };
  if (estObjet(lu.compte_jour) && P.dateValide(lu.compte_jour.date)) s.compte_jour = { date: lu.compte_jour.date, quetes: entierPositif(lu.compte_jour.quetes, 0), etapes: entierPositif(lu.compte_jour.etapes, 0), quotidiennes: entierPositif(lu.compte_jour.quotidiennes, 0), habitudes: entierPositif(lu.compte_jour.habitudes, 0) };
  if (typeof lu.donjon_actif === "string") s.donjon_actif = lu.donjon_actif;
  if (estObjet(lu.equipement)) for (const e of EMPLACEMENTS) if (typeof lu.equipement[e] === "string" && OBJETS[lu.equipement[e]]) s.equipement[e] = lu.equipement[e];
  if (typeof lu.familier_actif === "string" && FAMILIERS[lu.familier_actif]) s.familier_actif = lu.familier_actif;
  if (estObjet(lu.evenement) && P.dateValide(lu.evenement.date) && typeof lu.evenement.id === "string") {
    s.evenement = { date: lu.evenement.date, id: lu.evenement.id };
    if ("choisi" in lu.evenement) s.evenement.choisi = lu.evenement.choisi === 0 || lu.evenement.choisi === 1 ? lu.evenement.choisi : null;
  }
  if (estObjet(lu.saison)) s.saison = { numero: Math.max(1, entierPositif(lu.saison.numero, 1)), debut: P.dateValide(lu.saison.debut) ? lu.saison.debut : null };
  if (Number.isInteger(lu.annee_fetee)) s.annee_fetee = lu.annee_fetee;
  if (typeof lu.vu_a === "string") s.vu_a = lu.vu_a;
  return s;
}

// ---------------------------------------------------------------- calculs

function hasard(ctx, n) {
  if (n <= 0) return 0;
  const v = typeof ctx.hasardSysteme === "function" ? ctx.hasardSysteme(n) : crypto.randomInt(n);
  return Number.isInteger(v) ? Math.min(n - 1, Math.max(0, v)) : 0;
}

function graine(texte) {
  let g = 7;
  for (const c of String(texte)) g = (g * 31 + c.charCodeAt(0)) >>> 0;
  return g;
}

function joursEntre(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}

// Expérience à gagner pour passer du niveau n au niveau n + 1.
function seuilNiveau(n, cfg) {
  return cfg.xp.base_niveau + (n - 1) * cfg.xp.pas_niveau;
}

// Niveau d'après l'expérience totale : { niveau, dans (expérience dans le niveau), suivant (à atteindre) }.
function niveauDe(xp, cfg) {
  let niveau = 1;
  let reste = Math.max(0, xp);
  while (reste >= seuilNiveau(niveau, cfg) && niveau < 100000) {
    reste -= seuilNiveau(niveau, cfg);
    niveau++;
  }
  return { niveau, dans: reste, suivant: seuilNiveau(niveau, cfg) };
}

// Rang d'après le niveau : { id, suivant: { id, niveau } ou null }.
function rangDe(niveau, cfg) {
  let id = "E";
  for (const r of RANGS) if (niveau >= cfg.rangs[r]) id = r;
  const i = RANGS.indexOf(id);
  return { id, suivant: i < RANGS.length - 1 ? { id: RANGS[i + 1], niveau: cfg.rangs[RANGS[i + 1]] } : null };
}

function possedePiece(partie, lieu, id) {
  const liste = partie.ameliorations && partie.ameliorations[lieu];
  return Array.isArray(liste) && liste.includes(id);
}

function voisinagesActifs(partie) {
  return VOISINAGES.filter((v) => v.pieces.every((p) => possedePiece(partie, v.lieu, p)));
}

// Tous les bonus en cours : statistiques totales et pourcentages. Rien n'est stocké, tout se recalcule.
function bonus(partie, cfg) {
  const s = partie.systeme;
  const plus = { force: 0, endurance: 0, intelligence: 0, charisme: 0, creativite: 0 };
  const effets = { xp: 0, or: 0, butin: 0, reduc: 0, pv: 0, boss: 0, places: 0, heures: 0, ombres: 0, recherche: 0 };
  const ajouter = (e, fois) => {
    for (const [cle, v] of Object.entries(e || {})) if (cle in effets) effets[cle] += v * (fois === undefined ? 1 : fois);
  };
  for (const e of EMPLACEMENTS) {
    const o = OBJETS[s.equipement[e]];
    if (!o) continue;
    for (const [stat, v] of Object.entries(o.stats || {})) plus[stat] += v;
    ajouter(o.effets);
  }
  for (const o of s.ombres) if (STATS.includes(o.stat)) plus[o.stat] += entierPositif(o.bonus, 0);
  if (FAMILIERS[s.familier_actif] && s.familiers[s.familier_actif]) ajouter(FAMILIERS[s.familier_actif].effets);
  for (const r of RECHERCHES) ajouter(r.effets, entierPositif(s.recherches[r.id], 0));
  for (const v of voisinagesActifs(partie)) ajouter(v.effets);
  const total = {};
  for (const x of STATS) total[x] = s.stats[x] + plus[x];
  const prestige = s.prestige * cfg.saison.bonus_prestige;
  return {
    plus,
    total,
    xp: effets.xp + total.intelligence + prestige,
    or: effets.or + total.charisme + prestige,
    butin: Math.min(100, cfg.butin.chance + effets.butin + Math.floor(total.creativite / 2)),
    reduc: Math.min(60, effets.reduc + total.endurance * 3),
    pv_max: cfg.pv.base + effets.pv + total.force * cfg.pv.par_force,
    boss: effets.boss + total.force,
    places: cfg.studio.places + effets.places,
    heures: cfg.studio.production_h_max + effets.heures,
    seuil_ombres: Math.max(1, cfg.ombres.serie - effets.ombres),
    recherche: effets.recherche,
    prestige,
  };
}

function pvMax(partie, cfg) {
  return bonus(partie, cfg).pv_max;
}

// Le compteur du jour (quêtes et étapes comptées aujourd'hui), pour les plafonds doux.
function compteDuJour(partie, ctx) {
  const s = partie.systeme;
  if (!s.compte_jour || s.compte_jour.date !== ctx.date) s.compte_jour = { date: ctx.date, quetes: 0, etapes: 0, quotidiennes: 0, habitudes: 0 };
  return s.compte_jour;
}

// Taux d'expérience et d'or de la prochaine quête du jour : plein, puis réduit.
function tauxQuete(partie, ctx) {
  const cfg = ctx.config.systeme;
  const s = partie.systeme;
  const faites = s.compte_jour && s.compte_jour.date === ctx.date ? s.compte_jour.quetes : 0;
  return cfg.plafonds.quetes_pleines > 0 && faites >= cfg.plafonds.quetes_pleines ? cfg.plafonds.taux_reduit : 100;
}

// ---------------------------------------------------------------- fenêtres du Système

// Une annonce du Système : elle part dans la réponse (pour la fête) et reste dans le fil du jour.
function dire(partie, ctx, genre, titre, texte, extra) {
  const e = { genre, titre, texte: texte || "", ...(extra || {}) };
  if (!Array.isArray(ctx.sys)) ctx.sys = [];
  ctx.sys.push(e);
  const s = partie.systeme;
  s.fil.push({ id: "n" + ++s.compteur, date: ctx.date, heure: ctx.heure, genre, titre, texte: e.texte });
  if (s.fil.length > MAX_FIL) s.fil = s.fil.slice(-MAX_FIL);
  // Les grands moments entrent aussi au journal de l'immeuble : rien ne s'efface.
  if (AU_JOURNAL.has(genre) && Array.isArray(partie.journal) && !(extra && extra.retro)) {
    partie.journal.push({ quand: ctx.horodatage, type: "systeme", texte: titre + ". " + e.texte });
    if (partie.journal.length > 600) partie.journal = partie.journal.slice(-600);
  }
  return e;
}

function gagnerXp(partie, ctx, montant) {
  const cfg = ctx.config.systeme;
  const s = partie.systeme;
  if (!(montant > 0)) return 0;
  const avant = niveauDe(s.xp, cfg).niveau;
  s.xp += montant;
  const apres = niveauDe(s.xp, cfg).niveau;
  if (apres > avant) {
    const points = (apres - avant) * cfg.points_par_niveau;
    s.points_stats += points;
    s.pv = pvMax(partie, cfg);
    if (s.penalite) {
      // des points de vie au complet et une zone de pénalité ne vont pas ensemble : le niveau t'en sort
      s.penalite = null;
      dire(partie, ctx, "penalite_fin", "Sortie de la zone de pénalité", "Ta montée de niveau t'en sort, points de vie au complet.");
    }
    dire(partie, ctx, "niveau", "Niveau " + apres, (points ? "+" + points + " points de statistiques à répartir. " : "") + "Tes points de vie sont au complet.", { niveau: apres, points });
    const ra = rangDe(avant, cfg).id;
    const rb = rangDe(apres, cfg).id;
    if (ra !== rb) dire(partie, ctx, "rang", "Rang " + rb, "Tu quittes le rang " + ra + ". Le Système revoit ton dossier à la hausse.", { rang: rb });
  }
  return montant;
}

function gagnerOr(partie, montant) {
  const s = partie.systeme;
  if (!Number.isFinite(montant)) return 0; // une valeur abîmée ne doit jamais emporter tout l'or
  const v = Math.max(0, Math.round(montant));
  s.or += v;
  return v;
}

function soigner(partie, cfg, montant) {
  const s = partie.systeme;
  const max = pvMax(partie, cfg);
  if (s.pv === null) s.pv = max;
  s.pv = Math.min(max, s.pv + Math.max(0, montant));
}

function blesser(partie, ctx, montant, raison) {
  const cfg = ctx.config.systeme;
  const s = partie.systeme;
  if (s.pv === null) s.pv = pvMax(partie, cfg);
  const degats = Math.max(0, Math.round(montant));
  if (!degats) return 0;
  s.pv = Math.max(0, s.pv - degats);
  if (s.pv === 0 && cfg.penalite.actif && !s.penalite) {
    s.penalite = { depuis: ctx.date, a_faire: cfg.penalite.quetes, fait: 0 };
    dire(partie, ctx, "penalite", "Zone de pénalité", "Tes points de vie sont à zéro" + (raison ? " (" + raison + ")" : "") + ". Rien n'est perdu. Fais " + cfg.penalite.quetes + " " + (cfg.penalite.quetes > 1 ? "quêtes, même petites," : "quête, même petite,") + " et tu en sors avec la moitié de tes points de vie.");
  }
  return degats;
}

function donnerObjet(partie, id, n) {
  const s = partie.systeme;
  s.inventaire[id] = entierPositif(s.inventaire[id], 0) + (n || 1);
}

// Tire un objet au sort, selon les poids. minimum : "rare" pour un butin de boss.
function tirerObjet(ctx, minimum) {
  const ids = Object.keys(OBJETS).filter((id) => !minimum || OBJETS[id].rarete !== "commun");
  const total = ids.reduce((n, id) => n + OBJETS[id].poids, 0);
  let tirage = hasard(ctx, total);
  for (const id of ids) {
    tirage -= OBJETS[id].poids;
    if (tirage < 0) return id;
  }
  return ids[ids.length - 1];
}

function butin(partie, ctx, minimum, origine) {
  const id = tirerObjet(ctx, minimum);
  const o = OBJETS[id];
  if (o.genre === "or") {
    gagnerOr(partie, o.or);
    dire(partie, ctx, "butin", "Butin : " + o.nom, "+" + o.or + " or" + (origine ? " (" + origine + ")" : "") + ".", { objet: id, rarete: o.rarete });
  } else {
    donnerObjet(partie, id);
    dire(partie, ctx, "butin", "Butin : " + o.nom, RARETES[o.rarete] + ". " + descriptionObjet(id, ctx.config.systeme) + (origine ? " (" + origine + ")" : ""), { objet: id, rarete: o.rarete });
  }
  return id;
}

function descriptionObjet(id, cfg) {
  const o = OBJETS[id];
  if (!o) return "";
  const morceaux = [];
  for (const [stat, v] of Object.entries(o.stats || {})) morceaux.push("+" + v + " " + cfg.noms_stats[stat]);
  const e = o.effets || {};
  if (e.xp) morceaux.push("+" + e.xp + " % d'expérience");
  if (e.or) morceaux.push("+" + e.or + " % d'or");
  if (e.butin) morceaux.push("+" + e.butin + " % de chance de butin");
  if (o.soin) morceaux.push("Rend " + o.soin + " points de vie");
  if (o.genre === "nourriture") morceaux.push("Il en faut " + MIETTES_ECLOSION + " pour faire éclore un familier");
  if (o.genre === "oeuf") morceaux.push("Un familier attend dedans : " + FAMILIERS[o.familier].nom + " (" + FAMILIERS[o.familier].texte + ")");
  return morceaux.join(", ") + ".";
}

// ---------------------------------------------------------------- éveil

function initialiser(partie, ctx) {
  const cfg = ctx.config.systeme;
  const s = partie.systeme;
  s.eveille = ctx.date;
  s.jour_regle = ctx.date;
  s.vu_a = ctx.horodatage;
  if (!s.saison.debut) s.saison.debut = ctx.date;
  if (s.annee_fetee === null) s.annee_fetee = Number(ctx.date.slice(0, 4));
  if (s.recompenses === null) s.recompenses = cfg.recompenses.map((r) => ({ id: "r" + ++s.compteur, texte: r.texte, prix: r.prix, achats: 0 }));
  if (s.pv === null) s.pv = pvMax(partie, cfg);
}

// Le Système s'éveille à la première quête. Une partie de la version 3 garde tout : son passé est compté.
function eveiller(partie, ctx, retro) {
  const cfg = ctx.config.systeme;
  const s = partie.systeme;
  initialiser(partie, ctx);
  if (!retro) {
    dire(partie, ctx, "eveil", "Le Système s'éveille", "Chaque quête te donne de l'expérience et de l'or. Tu commences au rang E, niveau 1. Ouvre le panneau Système pour voir ta fiche.");
    return;
  }
  let xp = 0;
  let or = 0;
  let nb = 0;
  for (const [id, p] of Object.entries(partie.paiements || {})) {
    const degre = Number.isInteger(p.degre) ? p.degre : 2;
    xp += cfg.xp.par_quete * degre;
    or += cfg.or.par_quete * degre;
    nb++;
    s.quetes_comptees[id] = 1;
    const stat = cfg.stats_par_type[p.type_quete];
    if (stat) s.pratique[stat]++;
  }
  for (const x of STATS) s.stats[x] += Math.floor(s.pratique[x] / cfg.pratique_par_point);
  s.xp += xp;
  s.or += or;
  const n = niveauDe(s.xp, cfg).niveau;
  s.points_stats += (n - 1) * cfg.points_par_niveau;
  s.pv = pvMax(partie, cfg);
  dire(partie, ctx, "eveil", "Le Système s'éveille", "Il a compté ton passé : " + nb + " " + (nb > 1 ? "quêtes déjà faites" : "quête déjà faite") + ", " + xp + " points d'expérience, " + or + " or. Tu commences au niveau " + n + ", rang " + rangDe(n, cfg).id + ". Rien de ta partie n'a changé.", { niveau: n, retro: true });
}

// ---------------------------------------------------------------- après une quête

function typesDuJour(partie, date) {
  const types = new Set();
  let triples = 0;
  for (const p of Object.values(partie.paiements || {})) {
    if (p.date !== date) continue;
    if (p.type_quete) types.add(p.type_quete);
    if (p.degre === 3) triples++;
  }
  return { types, triples };
}

function verifierCombos(partie, ctx) {
  const s = partie.systeme;
  const { types, triples } = typesDuJour(partie, ctx.date);
  for (const c of COMBOS) {
    const reussi = c.types ? c.types.every((t) => types.has(t)) : c.divers ? types.size >= c.divers : triples >= c.triples;
    if (!reussi) continue;
    const k = estObjet(s.combos[c.id]) ? s.combos[c.id] : (s.combos[c.id] = { premier: ctx.date, fois: 0, dernier: null });
    if (k.dernier === ctx.date) continue;
    const decouverte = k.fois === 0;
    k.fois++;
    k.dernier = ctx.date;
    gagnerOr(partie, OR_COMBO);
    dire(partie, ctx, "combo", (decouverte ? "Combo découvert : " : "Combo : ") + c.nom, recetteCombo(c, ctx.config) + ". +" + OR_COMBO + " or" + (decouverte ? ", +" + XP_DECOUVERTE + " points d'expérience pour la découverte." : "."), { combo: c.id, decouverte });
    if (decouverte) gagnerXp(partie, ctx, XP_DECOUVERTE);
  }
}

function recetteCombo(c, config) {
  if (c.types) return c.types.map((t) => config.types[t].nom).join(" et ") + " le même jour";
  if (c.divers) return c.divers + " types de quête différents le même jour";
  return c.triples + " quêtes à trois étoiles le même jour";
}

// Le défi du jour : quelques quêtes dans la journée, une récompense connue d'avance. Le manquer ne coûte rien.
function avancerDefi(partie, ctx) {
  const cfg = ctx.config.systeme;
  const s = partie.systeme;
  if (!cfg.defi.quetes) return;
  if (!s.defi || s.defi.date !== ctx.date) s.defi = { date: ctx.date, fait: 0, recu: false };
  s.defi.fait++;
  if (s.defi.recu || s.defi.fait < cfg.defi.quetes) return;
  s.defi.recu = true;
  const or = gagnerOr(partie, cfg.defi.or);
  dire(partie, ctx, "defi", "Défi du jour réussi", cfg.defi.quetes + " " + (cfg.defi.quetes > 1 ? "quêtes faites" : "quête faite") + " aujourd'hui. +" + or + " or" + (cfg.defi.butin ? ", et un butin." : "."), { or });
  if (cfg.defi.butin) butin(partie, ctx, null, "défi du jour");
}

function frapperBoss(partie, ctx, degats, origine) {
  const cfg = ctx.config.systeme;
  const s = partie.systeme;
  const d = s.donjons.find((x) => x.id === s.donjon_actif && !x.vaincu_le);
  if (!d) return;
  d.pv = Math.max(0, d.pv - Math.max(1, Math.round(degats)));
  if (d.pv > 0) {
    dire(partie, ctx, "coup", d.boss + " : " + d.pv + " sur " + d.pv_max, "Un coup de " + Math.round(degats) + " (" + origine + "). Donjon : " + d.nom + ".", { donjon: d.id, degats: Math.round(degats) });
    return;
  }
  d.vaincu_le = ctx.date;
  // le donjon ouvert suivant devient actif : les quêtes ne frappent jamais dans le vide
  s.donjon_actif = (s.donjons.find((x) => !x.vaincu_le) || { id: null }).id;
  s.boss_vaincus++;
  const facteur = d.taille === "grand" ? 4 : d.taille === "moyen" ? 2 : 1;
  const or = gagnerOr(partie, cfg.donjon.or * facteur);
  const xp = cfg.donjon.xp * facteur;
  dire(partie, ctx, "boss", "Boss vaincu : " + d.boss, "Le donjon « " + d.nom + " » est terminé. +" + xp + " points d'expérience, +" + or + " or, et un butin rare.", { donjon: d.id });
  butin(partie, ctx, "rare", "butin du boss");
  gagnerXp(partie, ctx, xp);
}

function apresQuete(partie, ctx, id, paiement) {
  const cfg = ctx.config.systeme;
  if (!cfg.actif) return;
  const s = partie.systeme;
  if (!s.eveille) eveiller(partie, ctx, false);
  if (s.quetes_comptees[id]) return; // une quête annulée puis refaite ne compte qu'une fois
  s.quetes_comptees[id] = 1;
  s.geste_le = ctx.date;
  const degre = Number.isInteger(paiement.degre) ? paiement.degre : 2;
  const b = bonus(partie, cfg);
  const stat = cfg.stats_par_type[paiement.type_quete] || null;
  // un équipier du bon métier aide : +2 % d'expérience par niveau
  let aide = 0;
  for (const e of s.equipiers) {
    if (e.metier !== paiement.type_quete) continue;
    aide += 2 * e.niveau;
    e.pratique = entierPositif(e.pratique, 0) + 1;
    if (e.pratique >= 5 * e.niveau && e.niveau < 10) {
      e.pratique = 0;
      e.niveau++;
      dire(partie, ctx, "equipier", e.nom + " passe au niveau " + e.niveau, "Son métier : " + ctx.config.types[e.metier].nom + ". Sa production et son aide augmentent.");
    }
  }
  // au-delà d'un certain nombre de quêtes dans la journée, le rendement baisse (la quête compte toujours)
  const taux = tauxQuete(partie, ctx);
  compteDuJour(partie, ctx).quetes++;
  const xp = Math.round((cfg.xp.par_quete * degre * (1 + (b.xp + aide) / 100) * taux) / 100);
  const or = gagnerOr(partie, (cfg.or.par_quete * degre * (1 + b.or / 100) * (s.penalite ? 0.5 : 1) * taux) / 100);
  const plein = taux === 100;
  if (plein) s.recherche += cfg.studio.recherche_par_quete + b.recherche + (paiement.type_quete === "creation" ? 1 : 0);
  soigner(partie, cfg, cfg.pv.soin_quete);
  dire(partie, ctx, "xp", "+" + xp + " expérience, +" + or + " or" + (taux < 100 ? " (rendement " + taux + " %)" : ""), "Quête : " + String(paiement.texte || "").slice(0, 80), { xp, or, stat, taux, discret: true });
  if (stat && plein) {
    s.pratique[stat]++;
    if (s.pratique[stat] % cfg.pratique_par_point === 0) {
      s.stats[stat]++;
      dire(partie, ctx, "stat", cfg.noms_stats[stat] + " +1", "À force de pratique : " + cfg.pratique_par_point + " quêtes de ce genre. " + EFFETS_STATS[stat](cfg) + ".", { stat });
    }
  }
  if (s.penalite) {
    s.penalite.fait++;
    if (s.penalite.fait >= s.penalite.a_faire) {
      s.penalite = null;
      s.pv = Math.max(s.pv || 0, Math.ceil(pvMax(partie, cfg) / 2));
      gagnerOr(partie, cfg.penalite.bonus_sortie);
      dire(partie, ctx, "penalite_fin", "Sortie de la zone de pénalité", "Tu retrouves la moitié de tes points de vie" + (cfg.penalite.bonus_sortie ? ", et " + cfg.penalite.bonus_sortie + " or pour la route." : "."));
    }
  }
  avancerDefi(partie, ctx);
  frapperBoss(partie, ctx, ((cfg.donjon.degats * degre + b.boss) * taux) / 100, "une quête");
  if (hasard(ctx, 100) < (b.butin * taux) / 100) butin(partie, ctx, null, null);
  verifierCombos(partie, ctx);
  gagnerXp(partie, ctx, xp);
}

// ---------------------------------------------------------------- le temps qui passe

function semaineDe(date) {
  return P.semaineISO(date).id;
}

// Bilan du dernier jour où le jeu a été ouvert. Les jours d'absence entre deux visites sont en pause.
function bilanVeille(partie, ctx) {
  const cfg = ctx.config.systeme;
  const s = partie.systeme;
  const veille = s.jour_regle;
  if (s.repos) return;
  const b = bonus(partie, cfg);
  const laissees = s.quotidiennes.filter((q) => !(q.cree_le > veille) && !(estObjet(q.faites) && q.faites[veille]));
  for (const cle of Object.keys(s.graces).sort().slice(0, -8)) delete s.graces[cle];
  const manquees = laissees.length;
  if (!manquees) return;
  // Le jour de grâce vaut pour la journée entière : il protège toutes les séries de ce jour-là.
  const semaine = semaineDe(veille);
  const utilisees = entierPositif(s.graces[semaine], 0);
  const grace = laissees.some((q) => entierPositif(q.serie, 0) > 0) && utilisees < cfg.quotidiennes.graces_par_semaine;
  if (grace) s.graces[semaine] = utilisees + 1;
  let protegees = 0;
  for (const q of laissees) {
    if (grace) protegees += entierPositif(q.serie, 0) > 0 ? 1 : 0;
    else q.serie = Math.floor(entierPositif(q.serie, 0) / 2); // rattrapage doux : la série est coupée en deux, jamais remise à zéro
  }
  const degats = blesser(partie, ctx, manquees * cfg.pv.degats_quotidienne * (1 - b.reduc / 100), "quotidiennes de la dernière fois");
  dire(partie, ctx, "bilan", manquees + " " + (manquees > 1 ? "quotidiennes laissées" : "quotidienne laissée") + " la dernière fois", (degats ? "-" + degats + " points de vie. " : "") + (protegees ? protegees + " " + (protegees > 1 ? "séries protégées" : "série protégée") + " par le jour de grâce de la semaine. " : "") + "Les jours où tu ne joues pas ne comptent pas.", { degats, manquees, protegees });
}

// Ce qu'un événement (ou un de ses choix) promet, en clair.
function texteEffets(e) {
  const t = [];
  if (e.or) t.push("+" + e.or + " or");
  if (e.pv) t.push("+" + e.pv + " points de vie");
  if (e.recherche) t.push("+" + e.recherche + " " + (e.recherche > 1 ? "points de recherche" : "point de recherche"));
  if (e.objet) t.push("+1 " + OBJETS[e.objet].nom);
  if (e.xp) t.push("+" + e.xp + " expérience");
  if (e.butin) t.push("un butin");
  return t.join(", ");
}

// Applique les effets (tous des cadeaux). L'expérience est donnée par l'appelant, après son annonce.
function appliquerEffets(partie, ctx, e) {
  const s = partie.systeme;
  if (e.or) gagnerOr(partie, e.or);
  if (e.pv) soigner(partie, ctx.config.systeme, e.pv);
  if (e.recherche) s.recherche += e.recherche;
  if (e.objet) donnerObjet(partie, e.objet);
}

// Un événement par jour de jeu. Certains arrivent tout seuls, d'autres te laissent choisir entre deux suites.
function evenementDuJour(partie, ctx) {
  const s = partie.systeme;
  const e = EVENEMENTS[hasard(ctx, EVENEMENTS.length)];
  s.evenement = { date: ctx.date, id: e.id };
  if (e.choix) {
    s.evenement.choisi = null;
    dire(partie, ctx, "evenement", e.titre, e.texte + " À toi de choisir : « " + e.choix[0].libelle + " » ou « " + e.choix[1].libelle + " ».", { evenement: e.id, choix: true });
    return;
  }
  appliquerEffets(partie, ctx, e);
  dire(partie, ctx, "evenement", e.titre, e.texte + " " + texteEffets(e) + ".", { evenement: e.id });
  if (e.xp) gagnerXp(partie, ctx, e.xp);
}

function saisons(partie, ctx) {
  const cfg = ctx.config.systeme;
  const s = partie.systeme;
  if (!s.saison.debut) s.saison.debut = ctx.date;
  if (joursEntre(s.saison.debut, ctx.date) < cfg.saison.jours) return;
  const n = niveauDe(s.xp, cfg).niveau;
  const or = gagnerOr(partie, n * 10);
  dire(partie, ctx, "saison", "Fin de la saison " + s.saison.numero, "Tu la termines au niveau " + n + ", rang " + rangDe(n, cfg).id + ". +" + or + " or. La saison " + (s.saison.numero + 1) + " commence, et tu gardes tout.", { saison: s.saison.numero });
  s.saison = { numero: s.saison.numero + 1, debut: ctx.date };
}

// Palmarès d'une année : ce que la cérémonie annonce.
function palmares(partie, annee, config) {
  const prefixe = String(annee) + "-";
  const parType = {};
  const parMois = {};
  let quetes = 0;
  let etoiles = 0;
  for (const p of Object.values(partie.paiements || {})) {
    if (typeof p.date !== "string" || !p.date.startsWith(prefixe)) continue;
    quetes++;
    if (p.degre === 3) etoiles++;
    if (p.type_quete) parType[p.type_quete] = (parType[p.type_quete] || 0) + 1;
    const mois = p.date.slice(0, 7);
    parMois[mois] = (parMois[mois] || 0) + 1;
  }
  const meilleur = (o) => Object.keys(o).sort((a, b) => o[b] - o[a] || a.localeCompare(b))[0] || null;
  const type = meilleur(parType);
  const mois = meilleur(parMois);
  const boss = partie.systeme.donjons.filter((d) => typeof d.vaincu_le === "string" && d.vaincu_le.startsWith(prefixe)).length;
  const prix = [];
  if (quetes) prix.push({ titre: "Prix de la constance", texte: quetes + " " + (quetes > 1 ? "quêtes faites" : "quête faite") + " dans l'année." });
  if (type) prix.push({ titre: "Prix du genre favori", texte: config.types[type] ? config.types[type].nom + " : " + parType[type] + " fois." : type });
  if (mois) prix.push({ titre: "Prix du meilleur mois", texte: NOMS_MOIS[Number(mois.slice(5)) - 1] + " : " + parMois[mois] + " " + (parMois[mois] > 1 ? "quêtes." : "quête.") });
  if (etoiles) prix.push({ titre: "Prix de l'exigence", texte: etoiles + " " + (etoiles > 1 ? "quêtes à trois étoiles." : "quête à trois étoiles.") });
  if (boss) prix.push({ titre: "Prix du chasseur de boss", texte: boss + " " + (boss > 1 ? "boss vaincus." : "boss vaincu.") });
  return { annee, quetes, prix };
}

function ceremonie(partie, ctx) {
  const s = partie.systeme;
  const annee = Number(ctx.date.slice(0, 4));
  if (s.annee_fetee === null || s.annee_fetee >= annee) {
    if (s.annee_fetee === null) s.annee_fetee = annee;
    return;
  }
  const p = palmares(partie, annee - 1, ctx.config);
  s.annee_fetee = annee;
  if (!p.quetes) return;
  const or = gagnerOr(partie, 50 + p.prix.length * 20);
  dire(partie, ctx, "ceremonie", "Cérémonie de l'année " + (annee - 1), p.prix.map((x) => x.titre + " : " + x.texte).join(" ") + " +" + or + " or.", { annee: annee - 1, prix: p.prix });
}

// Ce que l'équipe a produit depuis la dernière fois. Compté par heures pleines.
function production(partie, ctx) {
  const cfg = ctx.config.systeme;
  const s = partie.systeme;
  if (!s.equipiers.length) return; // l'horloge de l'équipe démarre à la première embauche
  const avant = Date.parse(s.vu_a || "");
  const maintenant = Date.parse(ctx.horodatage);
  if (!Number.isFinite(avant) || !Number.isFinite(maintenant) || maintenant < avant) {
    s.vu_a = ctx.horodatage;
    return;
  }
  const heures = Math.floor((maintenant - avant) / 3600000);
  if (heures < 1) return;
  s.vu_a = ctx.horodatage;
  const comptees = Math.min(heures, bonus(partie, cfg).heures);
  // Les restes sont gardés : une heure qui ne fait pas un or entier compte pour la suivante (onglet resté ouvert).
  if (!estObjet(s.reste)) s.reste = { or: 0, recherche: 0 };
  const demis = comptees * s.equipiers.reduce((n, e) => n + e.talent * e.niveau, 0) + entierPositif(s.reste.or, 0);
  const sixiemes = comptees * s.equipiers.length + entierPositif(s.reste.recherche, 0);
  const or = gagnerOr(partie, Math.floor(demis / 2));
  const recherche = Math.floor(sixiemes / 6);
  s.reste = { or: demis % 2, recherche: sixiemes % 6 };
  s.recherche += recherche;
  if (!or && !recherche) return;
  const absence = heures >= 3;
  dire(partie, ctx, absence ? "hors_ligne" : "production", absence ? "Pendant ton absence" : "Production de l'équipe", "En " + comptees + " h, ton équipe a produit " + or + " or" + (recherche ? " et " + recherche + " " + (recherche > 1 ? "points de recherche" : "point de recherche") : "") + "." + (heures > comptees ? " Au-delà de " + comptees + " h, l'équipe se repose." : ""), { heures: comptees, or, recherche, discret: !absence });
}

// La fenêtre du matin : ce que le Système attend de toi aujourd'hui.
function quetesDuJour(partie, ctx) {
  const s = partie.systeme;
  if (s.repos || !s.quotidiennes.length) return;
  const noms = s.quotidiennes.slice(0, 4).map((q) => q.texte);
  const reste = s.quotidiennes.length - noms.length;
  dire(partie, ctx, "jour", "Quêtes du jour", s.quotidiennes.length + " " + (s.quotidiennes.length > 1 ? "quotidiennes t'attendent" : "quotidienne t'attend") + " : " + noms.join(", ") + (reste > 0 ? ", et " + reste + " de plus" : "") + "." + (s.penalite ? " Tu es en zone de pénalité : chaque quête t'en rapproche de la sortie." : ""));
}

// À chaque passage : éveil d'une partie existante, bilan du jour précédent, événement, saison, production.
function tic(partie, ctx, aJoue) {
  const cfg = ctx.config.systeme;
  if (!cfg.actif) return;
  const s = partie.systeme;
  if (!s.eveille) {
    if (!aJoue) return;
    eveiller(partie, ctx, true);
  }
  if (s.pv === null) s.pv = pvMax(partie, cfg);
  if (!s.jour_regle) s.jour_regle = ctx.date;
  if (s.jour_regle < ctx.date) {
    // Une journée n'est comptée que si tu y as joué (une quête, un geste). Un onglet resté ouvert ne suffit pas.
    if (s.geste_le === s.jour_regle) bilanVeille(partie, ctx);
    s.jour_regle = ctx.date;
    ceremonie(partie, ctx);
    saisons(partie, ctx);
    evenementDuJour(partie, ctx);
    quetesDuJour(partie, ctx);
  }
  production(partie, ctx);
  s.pv = Math.min(s.pv, pvMax(partie, cfg));
}

// ---------------------------------------------------------------- gestes du joueur

function refus(code, message) {
  return new ErreurJeu(code, message);
}

function texteLu(v, max, quoi) {
  if (typeof v !== "string") throw refus("REQUETE_INVALIDE", "Il manque " + quoi + ".");
  const t = v.normalize("NFC").replace(/\s+/g, " ").trim();
  if (t === "") throw refus("REQUETE_INVALIDE", "Il manque " + quoi + ".");
  if (t.length > max) throw refus("REQUETE_INVALIDE", quoi.charAt(0).toUpperCase() + quoi.slice(1) + " : " + max + " caractères au plus.");
  return t;
}

function trouver(liste, id, quoi) {
  const x = liste.find((e) => e.id === id);
  if (!x) throw refus("INCONNU", "Je ne trouve pas " + quoi + ".");
  return x;
}

function payerOr(partie, prix, quoi) {
  const s = partie.systeme;
  if (!Number.isInteger(prix) || prix < 0) throw refus("REQUETE_INVALIDE", "Ce prix n'est pas lisible.");
  if (s.or < prix) throw refus("POINTS_INSUFFISANTS", "Il te manque " + (prix - s.or) + " or pour " + quoi + ".");
  s.or -= prix;
}

function statLue(v, defaut) {
  return STATS.includes(v) ? v : defaut;
}

// Le marchand : deux articles de toujours (tisane, miette) et deux pièces d'équipement qui changent chaque semaine.
function etalage(ctx) {
  const fixes = Object.keys(OBJETS).filter((id) => OBJETS[id].prix).map((id) => ({ id, prix: OBJETS[id].prix, semaine: false }));
  const equipements = Object.keys(OBJETS).filter((id) => EMPLACEMENTS.includes(OBJETS[id].genre));
  const g = graine("marchand/" + semaineDe(ctx.date));
  const choisis = [equipements[g % equipements.length], equipements[(g % equipements.length + 1 + ((g >>> 4) % (equipements.length - 1))) % equipements.length]];
  return [...fixes, ...choisis.map((id) => ({ id, prix: PRIX_RARETE[OBJETS[id].rarete], semaine: true }))];
}

// Les trois candidats de la semaine : les mêmes pour toute la semaine, différents la suivante.
function candidats(partie, ctx) {
  const cfg = ctx.config.systeme;
  const s = partie.systeme;
  const semaine = semaineDe(ctx.date);
  const liste = [];
  for (let i = 0; i < 3; i++) {
    const g = graine(semaine + "/" + i);
    const talent = 1 + (g % 3);
    const metier = SC.TYPES[(g >>> 3) % SC.TYPES.length];
    const nom = PRENOMS[(g >>> 6) % PRENOMS.length];
    const id = "c-" + semaine + "-" + i;
    if (s.equipiers.some((e) => e.id === id)) continue;
    liste.push({ id, nom, metier, talent, prix: cfg.studio.prix_embauche * talent });
  }
  return liste;
}

const GESTES = {
  // statistiques
  "stats/*/augmenter"(partie, ctx, [stat], corps) {
    const s = partie.systeme;
    if (!STATS.includes(stat)) throw refus("INCONNU", "Je ne connais pas cette statistique.");
    const n = Number.isInteger(corps.n) && corps.n > 0 ? corps.n : 1;
    if (s.points_stats < n) throw refus("POINTS_INSUFFISANTS", "Tu n'as plus de point de statistique à poser. Ils arrivent à chaque niveau.");
    s.points_stats -= n;
    s.stats[stat] += n;
    if (stat === "force") soigner(partie, ctx.config.systeme, n * ctx.config.systeme.pv.par_force);
    dire(partie, ctx, "stat", ctx.config.systeme.noms_stats[stat] + " +" + n, EFFETS_STATS[stat](ctx.config.systeme) + ".", { stat, discret: true });
  },

  // habitudes
  "habitudes/ajouter"(partie, ctx, m, corps) {
    const s = partie.systeme;
    if (s.habitudes.length >= MAX_LISTE) throw refus("REQUETE_INVALIDE", "Tu as déjà beaucoup d'habitudes. Retires-en une d'abord.");
    const sens = corps.sens === "-" || corps.sens === "+-" ? corps.sens : "+";
    s.habitudes.push({ id: "h" + ++s.compteur, texte: texteLu(corps.texte, 80, "le nom de l'habitude"), sens, stat: statLue(corps.stat, "endurance"), plus: 0, moins: 0, cree_le: ctx.date });
  },
  "habitudes/*/noter"(partie, ctx, [id], corps) {
    const cfg = ctx.config.systeme;
    const s = partie.systeme;
    const h = trouver(s.habitudes, id, "cette habitude");
    const sens = corps.sens === "-" ? "-" : "+";
    if (typeof h.sens !== "string" || !h.sens.includes(sens)) throw refus("REQUETE_INVALIDE", "Cette habitude ne se note pas dans ce sens.");
    // la même habitude ne rapporte (ou ne coûte) que quelques fois par jour : ensuite elle est notée, sans effet
    if (!estObjet(h.jour) || h.jour.date !== ctx.date) h.jour = { date: ctx.date, plus: 0, moins: 0 };
    const cle = sens === "+" ? "plus" : "moins";
    h.jour[cle] = entierPositif(h.jour[cle], 0) + 1;
    const compte = compteDuJour(partie, ctx);
    compte.habitudes = entierPositif(compte.habitudes, 0) + 1;
    if (cfg.plafonds.habitude_par_jour > 0 && (h.jour[cle] > cfg.plafonds.habitude_par_jour || compte.habitudes > MAX_LISTE * cfg.plafonds.habitude_par_jour)) {
      h[cle] = entierPositif(h[cle], 0) + 1;
      dire(partie, ctx, "habitude_notee", "C'est noté", "Habitude : " + h.texte + ". Elle a déjà compté " + cfg.plafonds.habitude_par_jour + " fois aujourd'hui.", { discret: true });
      return;
    }
    if (sens === "+") {
      h.plus = entierPositif(h.plus, 0) + 1;
      const b = bonus(partie, cfg);
      const xp = Math.round(cfg.xp.par_habitude * (1 + b.xp / 100));
      const or = gagnerOr(partie, cfg.or.par_habitude * (1 + b.or / 100));
      dire(partie, ctx, "habitude_plus", "+" + xp + " expérience, +" + or + " or", "Habitude : " + h.texte, { xp, or, discret: true });
      gagnerXp(partie, ctx, xp);
    } else {
      h.moins = entierPositif(h.moins, 0) + 1;
      const degats = blesser(partie, ctx, cfg.pv.degats_habitude * (1 - bonus(partie, cfg).reduc / 100), "une habitude à lâcher");
      dire(partie, ctx, "habitude_moins", degats ? "-" + degats + " points de vie" : "C'est noté", "Habitude : " + h.texte + ". C'est noté, sans jugement.", { degats, discret: true });
    }
  },
  "habitudes/*/retirer"(partie, ctx, [id]) {
    const s = partie.systeme;
    trouver(s.habitudes, id, "cette habitude");
    s.habitudes = s.habitudes.filter((h) => h.id !== id);
  },

  // quotidiennes
  "quotidiennes/ajouter"(partie, ctx, m, corps) {
    const s = partie.systeme;
    if (s.quotidiennes.length >= MAX_LISTE) throw refus("REQUETE_INVALIDE", "Tu as déjà beaucoup de quotidiennes. Retires-en une d'abord.");
    s.quotidiennes.push({ id: "q" + ++s.compteur, texte: texteLu(corps.texte, 80, "le nom de la quotidienne"), stat: statLue(corps.stat, "endurance"), serie: 0, record: 0, total: 0, faites: {}, cree_le: ctx.date });
  },
  "quotidiennes/*/cocher"(partie, ctx, [id]) {
    const cfg = ctx.config.systeme;
    const s = partie.systeme;
    const q = trouver(s.quotidiennes, id, "cette quotidienne");
    if (!estObjet(q.faites)) q.faites = {};
    if (q.faites[ctx.date]) throw refus("DEJA_PAYE", "Cette quotidienne est déjà faite aujourd'hui.");
    q.faites[ctx.date] = true;
    for (const d of Object.keys(q.faites).sort().slice(0, -60)) delete q.faites[d];
    q.serie = entierPositif(q.serie, 0) + 1;
    q.total = entierPositif(q.total, 0) + 1;
    q.record = Math.max(entierPositif(q.record, 0), q.serie);
    const b = bonus(partie, cfg);
    // ajouter, cocher, retirer, recommencer : au-delà du nombre de quotidiennes qu'on peut avoir, cocher ne rapporte plus
    const compte = compteDuJour(partie, ctx);
    compte.quotidiennes = entierPositif(compte.quotidiennes, 0) + 1;
    const paye = compte.quotidiennes <= MAX_LISTE;
    const xp = paye ? Math.round(cfg.xp.par_quotidienne * (1 + b.xp / 100)) : 0;
    const or = paye ? gagnerOr(partie, cfg.or.par_quotidienne * (1 + b.or / 100)) : 0;
    dire(partie, ctx, "quotidienne", "+" + xp + " expérience, +" + or + " or", "Quotidienne : " + q.texte + ". Série de " + q.serie + " " + (q.serie > 1 ? "jours." : "jour."), { xp, or, serie: q.serie, discret: true });
    if (!q.ombre && q.serie === b.seuil_ombres) dire(partie, ctx, "ombre_prete", "Une ombre se lève", "« " + q.texte + " » tient depuis " + q.serie + " jours. Tu peux la recruter comme ombre, dans le panneau Système.");
    gagnerXp(partie, ctx, xp);
  },
  "quotidiennes/*/retirer"(partie, ctx, [id]) {
    const s = partie.systeme;
    trouver(s.quotidiennes, id, "cette quotidienne");
    s.quotidiennes = s.quotidiennes.filter((q) => q.id !== id);
  },
  // Une quotidienne tenue longtemps devient une ombre : une alliée qui renforce une statistique, pour toujours.
  "quotidiennes/*/recruter"(partie, ctx, [id]) {
    const cfg = ctx.config.systeme;
    const s = partie.systeme;
    const q = trouver(s.quotidiennes, id, "cette quotidienne");
    const seuil = bonus(partie, cfg).seuil_ombres;
    if (q.ombre) throw refus("DEJA_ACHETE", "Cette quotidienne a déjà son ombre.");
    if (entierPositif(q.record, 0) < seuil) throw refus("POINTS_INSUFFISANTS", "Il faut une série de " + seuil + " jours pour lever une ombre. Record de celle-ci : " + entierPositif(q.record, 0) + ".");
    q.ombre = true;
    const nom = NOMS_OMBRES[s.ombres.length % NOMS_OMBRES.length] + (s.ombres.length >= NOMS_OMBRES.length ? " " + (Math.floor(s.ombres.length / NOMS_OMBRES.length) + 1) : "");
    s.ombres.push({ id: "o" + ++s.compteur, nom, origine: q.texte, stat: statLue(q.stat, "endurance"), bonus: cfg.ombres.bonus, recrutee_le: ctx.date });
    dire(partie, ctx, "ombre", "Ombre recrutée : " + nom, "Née de « " + q.texte + " ». +" + cfg.ombres.bonus + " " + cfg.noms_stats[statLue(q.stat, "endurance")] + ", pour toujours.", { stat: q.stat });
  },
  repos(partie, ctx, m, corps) {
    const s = partie.systeme;
    s.repos = corps.oui !== false;
    dire(partie, ctx, "repos", s.repos ? "Mode repos" : "Fin du repos", s.repos ? "Tes quotidiennes sont en pause : aucune ne peut te coûter de points de vie, et tes séries attendent." : "Tes quotidiennes reprennent demain.", { discret: true });
  },

  // donjons
  "donjons/ajouter"(partie, ctx, m, corps) {
    const cfg = ctx.config.systeme;
    const s = partie.systeme;
    if (s.donjons.filter((d) => !d.vaincu_le).length >= 12) throw refus("REQUETE_INVALIDE", "Tu as déjà beaucoup de donjons ouverts. Termines-en un d'abord.");
    const taille = corps.taille === "grand" || corps.taille === "moyen" ? corps.taille : "petit";
    const pv = cfg.donjon["pv_" + taille];
    const nom = texteLu(corps.nom, 60, "le nom du projet");
    const d = { id: "d" + ++s.compteur, nom, taille, boss: BOSS[graine(nom + s.compteur) % BOSS.length], pv_max: pv, pv, etapes: [], cree_le: ctx.date, vaincu_le: null };
    s.donjons.push(d);
    if (!s.donjon_actif) s.donjon_actif = d.id;
    dire(partie, ctx, "donjon", "Donjon ouvert : " + nom, d.boss + " t'y attend, avec " + pv + " points de vie. Chaque quête faite pendant que ce donjon est actif le frappe.", { donjon: d.id });
  },
  "donjons/*/activer"(partie, ctx, [id]) {
    const s = partie.systeme;
    const d = trouver(s.donjons, id, "ce donjon");
    if (d.vaincu_le) throw refus("NON_ANNULABLE", "Ce donjon est déjà terminé.");
    s.donjon_actif = d.id;
  },
  "donjons/*/retirer"(partie, ctx, [id]) {
    const s = partie.systeme;
    const d = trouver(s.donjons, id, "ce donjon");
    if (d.vaincu_le) throw refus("NON_ANNULABLE", "Un donjon terminé reste dans ton palmarès.");
    s.donjons = s.donjons.filter((x) => x.id !== id);
    if (s.donjon_actif === id) s.donjon_actif = (s.donjons.find((x) => !x.vaincu_le) || { id: null }).id;
  },
  "donjons/*/etapes"(partie, ctx, [id], corps) {
    const s = partie.systeme;
    const d = trouver(s.donjons, id, "ce donjon");
    if (d.vaincu_le) throw refus("NON_ANNULABLE", "Ce donjon est déjà terminé.");
    if (d.etapes.length >= 20) throw refus("REQUETE_INVALIDE", "Vingt étapes au plus par donjon.");
    d.etapes.push({ id: "e" + ++s.compteur, texte: texteLu(corps.texte, 80, "le nom de l'étape"), faite: null });
  },
  // Une étape du projet : un grand coup. Un cinquième des points de vie d'un petit boss, un huitième d'un moyen, un douzième d'un grand.
  "donjons/*/etapes/*/cocher"(partie, ctx, [id, etapeId]) {
    const cfg = ctx.config.systeme;
    const s = partie.systeme;
    const d = trouver(s.donjons, id, "ce donjon");
    const e = trouver(d.etapes, etapeId, "cette étape");
    if (e.faite) throw refus("DEJA_PAYE", "Cette étape est déjà faite.");
    if (d.vaincu_le) throw refus("NON_ANNULABLE", "Ce donjon est déjà terminé.");
    const compte = compteDuJour(partie, ctx);
    if (cfg.plafonds.etapes_par_jour > 0 && compte.etapes >= cfg.plafonds.etapes_par_jour) throw refus("JOUR_FUTUR", "Tu as déjà franchi " + cfg.plafonds.etapes_par_jour + " " + (cfg.plafonds.etapes_par_jour > 1 ? "étapes" : "étape") + " aujourd'hui. Un donjon se gagne dans la durée : la suite demain.");
    compte.etapes++;
    e.faite = ctx.date;
    s.donjon_actif = d.id;
    const xp = cfg.xp.par_quete;
    frapperBoss(partie, ctx, Math.ceil(d.pv_max / (ETAPES_BOSS[d.taille] || 5)) + bonus(partie, cfg).boss, "une étape : " + e.texte);
    gagnerXp(partie, ctx, xp);
  },

  // objets
  "objets/*/equiper"(partie, ctx, [id]) {
    const s = partie.systeme;
    const o = propre(OBJETS, id);
    if (!o || !entierPositif(s.inventaire[id], 0)) throw refus("INCONNU", "Tu n'as pas cet objet.");
    if (!EMPLACEMENTS.includes(o.genre)) throw refus("REQUETE_INVALIDE", "Cet objet ne s'équipe pas.");
    s.equipement[o.genre] = s.equipement[o.genre] === id ? null : id;
    s.pv = Math.min(s.pv === null ? Infinity : s.pv, pvMax(partie, ctx.config.systeme));
  },
  "objets/*/utiliser"(partie, ctx, [id]) {
    const cfg = ctx.config.systeme;
    const s = partie.systeme;
    const o = propre(OBJETS, id);
    if (!o || !entierPositif(s.inventaire[id], 0)) throw refus("INCONNU", "Tu n'as pas cet objet.");
    if (o.genre === "potion") {
      if (s.pv !== null && s.pv >= pvMax(partie, cfg)) throw refus("REQUETE_INVALIDE", "Tes points de vie sont déjà au complet.");
      s.inventaire[id]--;
      soigner(partie, cfg, o.soin);
      dire(partie, ctx, "soin", o.nom, "+" + o.soin + " points de vie.", { discret: true });
    } else if (o.genre === "oeuf") {
      if (s.familiers[o.familier]) throw refus("DEJA_ACHETE", FAMILIERS[o.familier].nom + " vit déjà chez toi.");
      if (entierPositif(s.inventaire.miette, 0) < MIETTES_ECLOSION) throw refus("POINTS_INSUFFISANTS", "Il faut " + MIETTES_ECLOSION + " miettes de brioche pour l'apprivoiser. Tu en as " + entierPositif(s.inventaire.miette, 0) + ". Elles tombent en butin, et le marchand en vend.");
      s.inventaire[id]--;
      s.inventaire.miette -= MIETTES_ECLOSION;
      s.familiers[o.familier] = { depuis: ctx.date };
      if (!s.familier_actif) s.familier_actif = o.familier;
      dire(partie, ctx, "familier", "Nouveau familier : " + FAMILIERS[o.familier].nom, FAMILIERS[o.familier].texte + ", tant qu'il t'accompagne.", { familier: o.familier });
    } else throw refus("REQUETE_INVALIDE", "Cet objet ne s'utilise pas comme ça.");
    if (!s.inventaire[id]) delete s.inventaire[id];
    if (!s.inventaire.miette) delete s.inventaire.miette;
  },
  "familiers/*/choisir"(partie, ctx, [id]) {
    const s = partie.systeme;
    if (!propre(FAMILIERS, id) || !propre(s.familiers, id)) throw refus("INCONNU", "Ce familier ne vit pas encore chez toi.");
    s.familier_actif = s.familier_actif === id ? null : id;
  },
  "marchand/*/acheter"(partie, ctx, [id]) {
    const o = propre(OBJETS, id);
    const article = etalage(ctx).find((x) => x.id === id);
    if (!o || !article) throw refus("INCONNU", "Le marchand ne vend pas cet objet cette semaine.");
    payerOr(partie, article.prix, "acheter « " + o.nom + " »");
    donnerObjet(partie, id);
    dire(partie, ctx, "achat", "Acheté : " + o.nom, "-" + article.prix + " or.", { discret: true });
  },

  // récompenses que le joueur s'offre : c'est lui qui les écrit et qui fixe leur prix
  "recompenses/ajouter"(partie, ctx, m, corps) {
    const s = partie.systeme;
    if (!Array.isArray(s.recompenses)) s.recompenses = [];
    if (s.recompenses.length >= MAX_LISTE) throw refus("REQUETE_INVALIDE", "Tu as déjà beaucoup de récompenses. Retires-en une d'abord.");
    const prix = typeof corps.prix === "string" ? (corps.prix.trim() === "" ? NaN : Number(corps.prix.replace(/\s/g, ""))) : corps.prix;
    if (!Number.isInteger(prix) || prix < 0 || prix > 1000000) throw refus("REQUETE_INVALIDE", "Le prix est un nombre entier d'or.");
    s.recompenses.push({ id: "r" + ++s.compteur, texte: texteLu(corps.texte, 80, "le nom de la récompense"), prix, achats: 0 });
  },
  "recompenses/*/acheter"(partie, ctx, [id]) {
    const s = partie.systeme;
    const r = trouver(s.recompenses || [], id, "cette récompense");
    payerOr(partie, r.prix, "t'offrir « " + r.texte + " »");
    r.achats = entierPositif(r.achats, 0) + 1;
    dire(partie, ctx, "recompense", "Récompense : " + r.texte, "Tu l'as gagnée. -" + r.prix + " or. Profites-en vraiment.");
  },
  "recompenses/*/retirer"(partie, ctx, [id]) {
    const s = partie.systeme;
    trouver(s.recompenses || [], id, "cette récompense");
    s.recompenses = s.recompenses.filter((r) => r.id !== id);
  },

  // studio
  "studio/embaucher"(partie, ctx, m, corps) {
    const cfg = ctx.config.systeme;
    const s = partie.systeme;
    const c = trouver(candidats(partie, ctx), typeof corps.id === "string" ? corps.id : "", "ce candidat");
    if (s.equipiers.length >= bonus(partie, cfg).places) throw refus("LIEU_FERME", "Toutes tes places d'équipiers sont prises. La recherche « Agence des talents » en ouvre d'autres.");
    payerOr(partie, c.prix, "embaucher " + c.nom);
    if (!s.equipiers.length) {
      // l'horloge de la production démarre à la première embauche
      s.vu_a = ctx.horodatage;
      s.reste = { or: 0, recherche: 0 };
    }
    s.equipiers.push({ id: c.id, nom: c.nom, metier: c.metier, talent: c.talent, niveau: 1, pratique: 0, depuis: ctx.date });
    dire(partie, ctx, "embauche", c.nom + " rejoint le studio", "Métier : " + ctx.config.types[c.metier].nom + ". Talent " + c.talent + " sur 3. " + c.nom + " produit de l'or pendant ton absence et t'aide sur les quêtes de son métier.");
  },
  "studio/recherche/*"(partie, ctx, [id]) {
    const s = partie.systeme;
    const r = RECHERCHES.find((x) => x.id === id);
    if (!r) throw refus("INCONNU", "Je ne connais pas cette recherche.");
    const niveau = entierPositif(s.recherches[id], 0);
    if (niveau >= r.max) throw refus("DEJA_ACHETE", "Cette recherche est au maximum.");
    for (const [autre, n] of Object.entries(r.apres)) {
      if (entierPositif(s.recherches[autre], 0) < n) throw refus("LIEU_FERME", "Il faut d'abord « " + RECHERCHES.find((x) => x.id === autre).nom + " » au niveau " + n + ".");
    }
    const cout = r.cout * (niveau + 1);
    if (s.recherche < cout) throw refus("POINTS_INSUFFISANTS", "Il te manque " + (cout - s.recherche) + " points de recherche. Chaque quête en donne.");
    s.recherche -= cout;
    s.recherches[id] = niveau + 1;
    dire(partie, ctx, "recherche", "Recherche : " + r.nom + " niveau " + (niveau + 1), r.texte + ".", { recherche: id });
  },
  // L'événement du jour, quand il laisse le choix : deux suites, toutes deux bonnes à prendre.
  "evenement/choisir"(partie, ctx, m, corps) {
    const s = partie.systeme;
    const e = s.evenement && s.evenement.date === ctx.date ? EVENEMENTS.find((x) => x.id === s.evenement.id) : null;
    if (!e || !e.choix) throw refus("INCONNU", "Il n'y a pas de choix à faire aujourd'hui.");
    if (s.evenement.choisi !== null && s.evenement.choisi !== undefined) throw refus("DEJA_PAYE", "Tu as déjà choisi pour aujourd'hui.");
    const i = corps.choix === 1 || corps.choix === "1" ? 1 : corps.choix === 0 || corps.choix === "0" ? 0 : -1;
    if (i < 0) throw refus("REQUETE_INVALIDE", "Choisis une des deux suites.");
    const c = e.choix[i];
    s.evenement.choisi = i;
    appliquerEffets(partie, ctx, c);
    dire(partie, ctx, "evenement_choix", c.libelle, c.suite + " " + texteEffets(c) + ".", { evenement: e.id });
    if (c.butin) butin(partie, ctx, null, "la malle du grenier");
    if (c.xp) gagnerXp(partie, ctx, c.xp);
  },
  // Prestige : volontaire. Le niveau repart à 1, tout le reste est gardé, et un bonus permanent s'ajoute.
  "saison/prestige"(partie, ctx) {
    const cfg = ctx.config.systeme;
    const s = partie.systeme;
    const n = niveauDe(s.xp, cfg).niveau;
    if (n < cfg.saison.niveau_prestige) throw refus("POINTS_INSUFFISANTS", "Le prestige s'ouvre au niveau " + cfg.saison.niveau_prestige + ". Tu es au niveau " + n + ".");
    s.prestige++;
    s.xp_prestiges = entierPositif(s.xp_prestiges, 0) + s.xp; // l'expérience des vies passées compte toujours au classement
    s.xp = 0;
    dire(partie, ctx, "prestige", "Prestige " + s.prestige, "Ton niveau repart à 1. Tu gardes tes statistiques, ton or, tes objets, tes ombres et ton studio. Bonus permanent : +" + s.prestige * cfg.saison.bonus_prestige + " % d'expérience et d'or.", { prestige: s.prestige });
  },
};

const MOTIFS = Object.keys(GESTES).map((motif) => ({
  motif,
  re: new RegExp("^" + motif.split("/").map((x) => (x === "*" ? "([^/]+)" : x.replace(/[-]/g, "\\-"))).join("/") + "$"),
}));

// Applique un geste du joueur : chemin = ce qui suit /api/systeme/.
function agir(partie, ctx, chemin, corps) {
  const cfg = ctx.config.systeme;
  if (!cfg.actif) throw refus("LIEU_FERME", "Le Système est coupé. Il se rallume dans Réglages.");
  const s = partie.systeme;
  if (!s.eveille) throw refus("LIEU_FERME", "Le Système s'éveillera à ta première quête.");
  for (const { motif, re } of MOTIFS) {
    const m = re.exec(String(chemin));
    if (!m) continue;
    GESTES[motif](partie, ctx, m.slice(1), estObjet(corps) ? corps : {});
    s.geste_le = ctx.date;
    return;
  }
  throw refus("INCONNU", "Cette adresse n'existe pas.");
}

// ---------------------------------------------------------------- ce que l'écran affiche

function classement(partie, ctx) {
  const s = partie.systeme;
  const creation = String(partie.cree_le || "").slice(0, 10);
  const jours = Math.max(0, joursEntre(P.dateValide(creation) ? creation : ctx.date, ctx.date));
  const totalXp = s.xp + entierPositif(s.xp_prestiges, 0) + s.prestige * 1000;
  const liste = RIVAUX.map((r) => ({ nom: r.nom, score: r.base + r.rythme * jours, toi: false }));
  liste.push({ nom: ctx.config.enseigne || "Ton studio", score: totalXp + s.boss_vaincus * 100, toi: true });
  liste.sort((a, b) => b.score - a.score || (a.toi ? -1 : 1));
  return liste.map((x, i) => ({ rang: i + 1, ...x }));
}

function vueObjet(id, n, s, cfg) {
  const o = OBJETS[id];
  return {
    id,
    nom: o.nom,
    genre: o.genre,
    nom_genre: GENRES[o.genre],
    rarete: o.rarete,
    nom_rarete: RARETES[o.rarete],
    n,
    description: descriptionObjet(id, cfg),
    equipe: EMPLACEMENTS.includes(o.genre) && s.equipement[o.genre] === id,
    action: EMPLACEMENTS.includes(o.genre) ? "equiper" : o.genre === "potion" || o.genre === "oeuf" ? "utiliser" : null,
  };
}

function vue(partie, ctx) {
  const config = ctx.config;
  const cfg = config.systeme;
  const s = partie.systeme;
  const evenements = Array.isArray(ctx.sys) ? ctx.sys : [];
  if (!cfg.actif) return { actif: false, eveille: false, evenements: [], notifications: [] };
  const b = bonus(partie, cfg);
  const n = niveauDe(s.xp, cfg);
  const rang = rangDe(n.niveau, cfg);
  const pvmax = b.pv_max;
  const pv = s.pv === null ? pvmax : Math.min(s.pv, pvmax);
  const donjons = s.donjons
    .map((d) => {
      const facteur = d.taille === "grand" ? 4 : d.taille === "moyen" ? 2 : 1;
      return { id: d.id, nom: d.nom, taille: d.taille, boss: d.boss, pv: d.pv, pv_max: d.pv_max, actif: d.id === s.donjon_actif && !d.vaincu_le, vaincu_le: d.vaincu_le, cree_le: d.cree_le, etapes: d.etapes.map((e) => ({ id: e.id, texte: e.texte, faite: Boolean(e.faite) })), coup_etape: Math.ceil(d.pv_max / (ETAPES_BOSS[d.taille] || 5)), recompense: { xp: cfg.donjon.xp * facteur, or: cfg.donjon.or * facteur } };
    })
    .sort((x, y) => Number(Boolean(x.vaincu_le)) - Number(Boolean(y.vaincu_le)) || Number(y.actif) - Number(x.actif));
  const jourSaison = s.saison.debut ? joursEntre(s.saison.debut, ctx.date) + 1 : 1;
  const evenementJour = s.evenement && s.evenement.date === ctx.date ? EVENEMENTS.find((e) => e.id === s.evenement.id) : null;
  return {
    actif: true,
    eveille: Boolean(s.eveille),
    hud: {
      niveau: n.niveau,
      rang: rang.id,
      rang_suivant: rang.suivant,
      xp: s.xp,
      xp_niveau: n.dans,
      xp_suivant: n.suivant,
      pv,
      pv_max: pvmax,
      or: s.or,
      points_stats: s.points_stats,
      penalite: Boolean(s.penalite),
      repos: s.repos,
      prestige: s.prestige,
    },
    stats: STATS.map((x) => ({ id: x, nom: cfg.noms_stats[x], valeur: s.stats[x], bonus: b.plus[x], total: b.total[x], effet: EFFETS_STATS[x](cfg), pratique: s.pratique[x] % cfg.pratique_par_point, pratique_seuil: cfg.pratique_par_point })),
    bonus: { xp: b.xp, or: b.or, butin: b.butin, reduc: b.reduc, boss: b.boss, prestige: b.prestige },
    // ce qu'une quête rapporte au Système, par étoile (hors aide d'un équipier)
    par_etoile: { xp: Math.round((cfg.xp.par_quete * (1 + b.xp / 100) * tauxQuete(partie, ctx)) / 100), or: Math.round((cfg.or.par_quete * (1 + b.or / 100) * (s.penalite ? 0.5 : 1) * tauxQuete(partie, ctx)) / 100), degats: cfg.donjon.degats, taux: tauxQuete(partie, ctx) },
    plafonds: { quetes_pleines: cfg.plafonds.quetes_pleines, quetes_du_jour: s.compte_jour && s.compte_jour.date === ctx.date ? s.compte_jour.quetes : 0, etapes_par_jour: cfg.plafonds.etapes_par_jour, etapes_du_jour: s.compte_jour && s.compte_jour.date === ctx.date ? s.compte_jour.etapes : 0, habitude_par_jour: cfg.plafonds.habitude_par_jour },
    habitudes: s.habitudes.map((h) => ({ id: h.id, texte: h.texte, sens: typeof h.sens === "string" ? h.sens : "+", stat: h.stat, plus: entierPositif(h.plus, 0), moins: entierPositif(h.moins, 0), aujourdhui: estObjet(h.jour) && h.jour.date === ctx.date ? entierPositif(h.jour.plus, 0) + entierPositif(h.jour.moins, 0) : 0 })),
    quotidiennes: s.quotidiennes.map((q) => ({ id: q.id, texte: q.texte, stat: q.stat, faite: Boolean(estObjet(q.faites) && q.faites[ctx.date]), serie: entierPositif(q.serie, 0), record: entierPositif(q.record, 0), ombre: q.ombre === true, recrutable: !q.ombre && entierPositif(q.record, 0) >= b.seuil_ombres })),
    repos: s.repos,
    defi: cfg.defi.quetes ? { fait: s.defi && s.defi.date === ctx.date ? Math.min(s.defi.fait, cfg.defi.quetes) : 0, objectif: cfg.defi.quetes, reussi: Boolean(s.defi && s.defi.date === ctx.date && s.defi.recu), or: cfg.defi.or, butin: cfg.defi.butin } : null,
    penalite: s.penalite ? { texte: "Zone de pénalité : rien n'est perdu. Fais " + s.penalite.a_faire + " " + (s.penalite.a_faire > 1 ? "quêtes" : "quête") + " pour en sortir avec la moitié de tes points de vie. En attendant, l'or des quêtes est divisé par deux.", fait: s.penalite.fait, a_faire: s.penalite.a_faire } : null,
    donjons,
    ombres: s.ombres.map((o) => ({ id: o.id, nom: o.nom, origine: o.origine, stat: o.stat, nom_stat: cfg.noms_stats[o.stat] || "", bonus: o.bonus, recrutee_le: o.recrutee_le })),
    ombres_seuil: b.seuil_ombres,
    inventaire: Object.keys(s.inventaire).filter((id) => OBJETS[id] && s.inventaire[id] > 0).map((id) => vueObjet(id, s.inventaire[id], s, cfg)),
    equipement: Object.fromEntries(EMPLACEMENTS.map((e) => [e, s.equipement[e] && OBJETS[s.equipement[e]] ? { id: s.equipement[e], nom: OBJETS[s.equipement[e]].nom, description: descriptionObjet(s.equipement[e], cfg) } : null])),
    familiers: Object.keys(FAMILIERS).map((id) => ({ id, nom: FAMILIERS[id].nom, effet: FAMILIERS[id].texte, present: Boolean(s.familiers[id]), actif: s.familier_actif === id })),
    recompenses: (s.recompenses || []).map((r) => ({ id: r.id, texte: r.texte, prix: r.prix, achats: entierPositif(r.achats, 0) })),
    marchand: etalage(ctx).map((x) => ({ id: x.id, nom: OBJETS[x.id].nom, prix: x.prix, semaine: x.semaine, genre: OBJETS[x.id].genre, nom_rarete: RARETES[OBJETS[x.id].rarete], description: descriptionObjet(x.id, cfg) })),
    collection: Object.keys(OBJETS).filter((id) => OBJETS[id].genre !== "or").map((id) => ({ id, nom: OBJETS[id].nom, rarete: OBJETS[id].rarete, nom_genre: GENRES[OBJETS[id].genre] })),
    studio: {
      equipiers: s.equipiers.map((e) => ({ id: e.id, nom: e.nom, metier: e.metier, nom_metier: config.types[e.metier] ? config.types[e.metier].nom : e.metier, talent: e.talent, niveau: e.niveau, production: e.talent * e.niveau * 0.5 })),
      places: b.places,
      candidats: s.eveille ? candidats(partie, ctx).map((c) => ({ ...c, nom_metier: config.types[c.metier].nom })) : [],
      heures_max: b.heures,
      recherche: {
        points: s.recherche,
        noeuds: RECHERCHES.map((r) => {
          const niveau = entierPositif(s.recherches[r.id], 0);
          const manque = Object.entries(r.apres).filter(([autre, k]) => entierPositif(s.recherches[autre], 0) < k);
          return { id: r.id, nom: r.nom, effet: r.texte, niveau, max: r.max, cout: niveau < r.max ? r.cout * (niveau + 1) : null, ouvert: manque.length === 0, prerequis: manque.map(([autre, k]) => RECHERCHES.find((x) => x.id === autre).nom + " niveau " + k).join(", ") };
        }),
      },
      voisinages: VOISINAGES.map((v) => ({ id: v.id, nom: v.nom, lieu: config.lieux[v.lieu] ? config.lieux[v.lieu].nom : v.lieu, pieces: v.noms, effet: v.texte, actif: v.pieces.every((p) => possedePiece(partie, v.lieu, p)) })),
      combos: COMBOS.map((c) => {
        const k = estObjet(s.combos[c.id]) ? s.combos[c.id] : null;
        return { id: c.id, nom: k ? c.nom : "???", recette: k ? recetteCombo(c, config) : "À découvrir en jouant", decouvert: Boolean(k), fois: k ? k.fois : 0 };
      }),
      classement: classement(partie, ctx),
      evenement: evenementJour
        ? {
            titre: evenementJour.titre,
            texte: evenementJour.texte,
            choix: evenementJour.choix ? evenementJour.choix.map((c) => ({ libelle: c.libelle, effet: texteEffets(c) })) : null,
            choisi: evenementJour.choix && Number.isInteger(s.evenement.choisi) ? s.evenement.choisi : null,
            suite: evenementJour.choix && Number.isInteger(s.evenement.choisi) ? evenementJour.choix[s.evenement.choisi].suite : evenementJour.choix ? "" : texteEffets(evenementJour) + ".",
          }
        : null,
      saison: { numero: s.saison.numero, jour: Math.min(jourSaison, cfg.saison.jours), jours: cfg.saison.jours, prestige: s.prestige, prestige_possible: n.niveau >= cfg.saison.niveau_prestige, niveau_prestige: cfg.saison.niveau_prestige, bonus_prestige: cfg.saison.bonus_prestige },
      palmares: palmares(partie, Number(ctx.date.slice(0, 4)), config),
      boss_vaincus: s.boss_vaincus,
    },
    notifications: s.fil.filter((f) => f.date === ctx.date && !["xp", "habitude_plus", "habitude_moins", "habitude_notee", "quotidienne", "coup", "soin", "achat", "repos", "production"].includes(f.genre)).slice(-8).reverse(),
    fil: s.fil.slice(-30).reverse(),
    evenements,
  };
}

// La démo montre un Système déjà vivant : quelques niveaux, des habitudes, un donjon, une ombre, une équipe.
function semerDemo(partie, ctx) {
  const cfg = ctx.config.systeme;
  const s = partie.systeme;
  if (s.eveille || !cfg.actif) return;
  initialiser(partie, ctx);
  s.xp = 1480;
  s.or = 245;
  s.points_stats = 3;
  s.stats = { force: 3, endurance: 5, intelligence: 4, charisme: 3, creativite: 6 };
  s.pv = Math.round(pvMax(partie, cfg) * 0.7);
  s.recherche = 14;
  s.recherches = { methode: 2, flair: 1 };
  s.inventaire = { stylo: 1, gilet: 1, tisane: 2, miette: 3, "oeuf-chat": 1, trefle: 1 };
  s.equipement = { outil: "stylo", tenue: "gilet", talisman: null };
  s.familiers = { moineau: { depuis: ctx.date } };
  s.familier_actif = "moineau";
  s.habitudes = [
    { id: "h-demo1", texte: "Boire un verre d'eau", sens: "+", stat: "force", plus: 12, moins: 0, cree_le: ctx.date },
    { id: "h-demo2", texte: "Ouvrir les réseaux sans raison", sens: "-", stat: "endurance", plus: 0, moins: 4, cree_le: ctx.date },
    { id: "h-demo3", texte: "Écrire avant de lire", sens: "+-", stat: "creativite", plus: 7, moins: 2, cree_le: ctx.date },
  ];
  s.quotidiennes = [
    { id: "q-demo1", texte: "Dix minutes de marche", stat: "force", serie: 15, record: 15, total: 31, faites: {}, cree_le: ctx.date },
    { id: "q-demo2", texte: "Une page écrite", stat: "creativite", serie: 6, record: 9, total: 22, faites: {}, cree_le: ctx.date },
    { id: "q-demo3", texte: "Boîte de réception à zéro", stat: "endurance", serie: 2, record: 4, total: 9, faites: {}, cree_le: ctx.date },
  ];
  s.ombres = [{ id: "o-demo1", nom: "Veilleur", origine: "Lire vingt minutes", stat: "intelligence", bonus: cfg.ombres.bonus, recrutee_le: ctx.date }];
  s.donjons = [
    { id: "d-demo1", nom: "Le guide de l'automne", taille: "moyen", boss: BOSS[2], pv_max: cfg.donjon.pv_moyen, pv: Math.round(cfg.donjon.pv_moyen * 0.3), etapes: [{ id: "e-demo1", texte: "Plan validé", faite: ctx.date }, { id: "e-demo2", texte: "Premier jet", faite: ctx.date }, { id: "e-demo3", texte: "Relecture", faite: null }], cree_le: ctx.date, vaincu_le: null },
    { id: "d-demo2", nom: "Refonte de la page d'accueil", taille: "petit", boss: BOSS[1], pv_max: cfg.donjon.pv_petit, pv: 0, etapes: [], cree_le: ctx.date, vaincu_le: ctx.date },
  ];
  s.donjon_actif = "d-demo1";
  s.boss_vaincus = 1;
  s.equipiers = [{ id: "c-demo-1", nom: "Maëlle", metier: "creation", talent: 2, niveau: 2, pratique: 1, depuis: ctx.date }];
  s.combos = { lancement: { premier: ctx.date, fois: 3, dernier: null }, "corps-ame": { premier: ctx.date, fois: 1, dernier: null } };
  s.fil = [{ id: "n-demo1", date: ctx.date, heure: ctx.heure, genre: "evenement", titre: EVENEMENTS[0].titre, texte: EVENEMENTS[0].texte + " +10 or." }];
  s.evenement = { date: ctx.date, id: EVENEMENTS[0].id };
}

module.exports = {
  OBJETS,
  FAMILIERS,
  RECHERCHES,
  VOISINAGES,
  COMBOS,
  EVENEMENTS,
  etatNeuf,
  normaliser,
  seuilNiveau,
  niveauDe,
  rangDe,
  bonus,
  pvMax,
  eveiller,
  apresQuete,
  tic,
  agir,
  vue,
  palmares,
  candidats,
  classement,
  semerDemo,
};

  });

  definir("/jeu/serveur/demo.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/demo.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// Mode démo (?demo=1) : une partie d'exemple riche, gardée en mémoire.
// Rien n'est lu ni écrit dans data/, et aucun coffre n'est ouvert : les quêtes sont inventées.
// Tout disparaît à l'arrêt du serveur.

const P = require("./parseurs");
const Q = require("./quetes");

let memoire = null;

function oublier() {
  memoire = null;
}

function jourDuMois(dateISO, jour) {
  const max = Number(dateISO.slice(8, 10));
  return dateISO.slice(0, 8) + String(Math.max(1, Math.min(jour, max))).padStart(2, "0");
}

function moisPrecedent(dateISO, jour) {
  const fin = P.ajouterJours(dateISO.slice(0, 8) + "01", -1);
  return fin.slice(0, 8) + String(Math.min(jour, Number(fin.slice(8, 10)))).padStart(2, "0");
}

// Réglages de la démo : un objectif d'exemple, tout ouvert, aucun coffre lu.
function patchDemo() {
  return {
    joueur: "Camille",
    enseigne: "L'Atelier des Mots",
    objectif_mensuel: 3000,
    jalons_mensuels: [500, 1000, 1500, 2000],
    sources_encaissement: ["Abonnements", "Coaching", "Ateliers", "Livre", "Autre"],
    caps: { cap1: { libelle: "Ton premier abonné payant" } },
    but_equipe: { libelle: "La nouvelle offre prête à vendre vendredi" },
    deblocages: { actif: false },
    coffre: "non",
  };
}

// Quêtes inventées pour la démo, au format de data/quetes.md.
function quetesDemo(dateISO) {
  return [
    "# Quêtes du jeu",
    "",
    "## Semaine de démonstration",
    "",
    "- [ ] Relancer trois clients par message @vente",
    "  - 1 : un message envoyé",
    "  - 2 : trois messages envoyés",
    "  - 3 : trois messages et une réponse",
    "- [ ] Déclarer le chiffre du mois @admin",
    "  - 1 : le formulaire ouvert et les chiffres réunis",
    "  - 2 : la déclaration envoyée",
    "  - 3 : envoyée, et le reçu classé",
    "- [ ] Écrire la lettre de la semaine @creation",
    "  - 1 : le plan et l'accroche",
    "  - 2 : le premier jet complet",
    "  - 3 : relue et programmée",
    "- [ ] Appeler Sacha pour prendre des nouvelles @relations",
    "- [ ] Marcher trente minutes au soleil @sante",
    "- [ ] Envoyer le devis de l'atelier de juin @vente",
    "- [ ] Ranger les factures du trimestre @admin",
    "- [ ] Dessiner la couverture du guide @creation",
    "- [ ] Remercier les trois premiers lecteurs @relations",
    "- [ ] Préparer la page de vente de l'offre @vente",
    "",
    "## Écrites le " + dateISO,
    "",
    "- [ ] Répondre au message de la banque @admin",
    "",
  ].join("\n");
}

// Registre d'exemple : 3 200 le mois dernier, 2 100 ce mois-ci.
function registreDemo(ctx) {
  const d = ctx.date;
  const lignes = [
    [moisPrecedent(d, 3), 390, "Abonnements", "Dix abonnés"],
    [moisPrecedent(d, 9), 900, "Coaching", "Trois séances"],
    [moisPrecedent(d, 14), 1200, "Ateliers", "Atelier en entreprise"],
    [moisPrecedent(d, 21), 585, "Abonnements", "Quinze abonnés"],
    [moisPrecedent(d, 27), 125, "Livre", "Droits d'auteur"],
    [jourDuMois(d, 2), 468, "Abonnements", "Douze abonnés"],
    [jourDuMois(d, 5), 600, "Coaching", "Deux séances"],
    [jourDuMois(d, 9), 750, "Ateliers", "Atelier du jeudi"],
    [jourDuMois(d, 12), 82, "Livre", "Ventes du mois"],
    [jourDuMois(d, 15), 200, "Abonnements", "Abonnements annuels"],
  ];
  return {
    version: 1,
    encaissements: lignes.map(([date, montant, source, note], i) => ({
      id: "E-de" + String(i + 1).padStart(6, "0"),
      montant,
      date,
      source,
      note,
      cree_le: date + "T10:00:00+01:00",
    })),
  };
}

function creer(ctx, outils) {
  const partie = outils.nouvellePartie(ctx.horodatage);
  const registre = registreDemo(ctx);
  const jour = (n) => P.ajouterJours(ctx.date, n);
  partie.accueil_vu = true;
  partie.assistant_fait = true;
  partie.tout_ouvert = true;
  partie.derniere_visite = ctx.date;
  partie.points = 480;
  partie.total_gagne = 1120;
  partie.niveau_fete = 6;
  partie.caps = {
    cap1: { date: jour(-75), coche_le: ctx.horodatage },
    cap2: { date: jour(-48), coche_le: ctx.horodatage },
    cap3: { date: jour(-19), coche_le: ctx.horodatage },
  };
  partie.ameliorations = {
    studio: ["lampadaire", "plante", "tapis", "etagere", "micro", "fauteuil"],
    coworking: ["ficus", "casier", "fontaine", "objectifs", "velo", "cabine"],
    atelier: ["horloge", "tableau-blanc", "table-dessin", "canape", "bibliotheque", "studio-son"],
    bureaux: ["jardiniere", "banquette", "mur-abonnes"],
  };
  for (const id of ["globe", "guirlande", "aquarium", "panier-chat", "affiche", "tourne-disque"]) {
    partie.objets[id] = { date: jour(-10), origine: "colis" };
  }
  // Des quêtes déjà faites les jours passés, de tous les types.
  const types = ["vente", "admin", "creation", "relations", "sante", "vente", "creation", "admin"];
  const agents = ["boussole", "archive", "plume", "timbre", "relais", "boussole", "croquis", null];
  for (let i = 0; i < 26; i++) {
    const type = types[i % types.length];
    const payee = type === "vente" || type === "admin";
    const p = { type: "ligne", points: payee ? (type === "vente" ? 40 : 20) : 0, vente: type === "vente", source: "jeu", date: jour(-1 - (i % 9)), heure: i % 5 === 0 ? "08:40" : "10:" + String(10 + i).padStart(2, "0"), semaine: "", texte: "Quête d'exemple", type_quete: type, mode: payee ? "payee" : "racontee", degre: 1 + (i % 3) };
    // quatorze quêtes faites avec un agent : le cap d'effort suivant (quinze) reste à une quête
    if (agents[i % agents.length] && i < 16) p.agent = agents[i % agents.length];
    if (i % 4 === 0) p.newsletter = true;
    partie.paiements["L-demo" + i] = p;
  }
  partie.jours_actifs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 15].map((n) => jour(-n)).filter((d) => d < ctx.date).sort();
  partie.serie.record = 9;
  partie.contrats[jour(-1)] = { choix: "ambitieux", statut: "tenu", signe_a: "08:30", quetes: [], gain: 80, mise: 20, colis: true, heure_limite: "12:00" };
  partie.contrats[jour(-2)] = { choix: "sur", statut: "tenu", signe_a: "09:00", quetes: [], gain: 30, mise: 0 };
  partie.contrats[jour(-3)] = { choix: "ambitieux", statut: "rate", signe_a: "09:10", quetes: [], gain: 80, mise: 20, colis: true, heure_limite: "12:00" };
  partie.contrats[jour(-4)] = { choix: "ambitieux", statut: "tenu", signe_a: "08:50", quetes: [], gain: 80, mise: 20, colis: true, heure_limite: "12:00" };
  partie.traits = {
    plume: { cordee: jour(-9), fiable: jour(-3) },
    boussole: { cordee: jour(-8), "leve-tot": jour(-5), audacieux: jour(-1) },
    archive: { cordee: jour(-7) },
    croquis: { cordee: jour(-6) },
  };
  const semaine = P.semaineISO(ctx.date).id;
  // Les sessions d'exemple du jour sont déjà comptées : rien ne se fête au chargement.
  partie.equipe[semaine] = { libelle: "", unites: 25, par: { quetes: 16, specialite: 5, sessions: 4 }, ids: {}, sessions: { [ctx.date]: EXEMPLES.filter((x) => x[2][0] !== "en pause").slice(0, ctx.config.but_equipe.sessions_max_par_jour).map((x) => x[0]) }, agents: { plume: 4, boussole: 5, archive: 3, croquis: 2 }, atteint: null };
  // La semaine passée n'est pas encore bouclée : sa revue attend le joueur, sans rien lui retirer.
  const precedente = P.semaineISO(jour(-7)).id;
  if (precedente !== semaine) partie.equipe[precedente] = { libelle: "La nouvelle offre prête à vendre vendredi", unites: 24, par: { quetes: 15, specialite: 5, sessions: 4 }, ids: {}, sessions: {}, agents: { plume: 4, boussole: 4 }, atteint: null };
  partie.semaines[P.semaineISO(jour(-14)).id] = { cloturee_le: jour(-14), chiffres: { quetes: 14, points: 310, crans: 10, crans_total: 10 }, lecon: ["Tu as surtout fait de la création : 6 sur 14 quêtes.", "Les étages s'ouvrent avec ce que tu encaisses, après 3 actions de vente."], moteur: "vente", mot: "Vendre le matin, créer l'après-midi." };
  partie.semaines[P.semaineISO(jour(-21)).id] = { cloturee_le: jour(-21), chiffres: { quetes: 11, points: 240, crans: 7, crans_total: 10 }, lecon: [], moteur: "creation", mot: "" };
  partie.efforts = { eff1: jour(-12), eff2: jour(-6), eff3: jour(-5), eff4: jour(-7), eff5: jour(-4) };
  partie.deblocages_vus = { contrat: jour(-12), boutique: jour(-12), equipe: jour(-11), argent: jour(-10), carte: jour(-10), arrosage: jour(-9), trophees: jour(-9), etat: jour(-9) };
  const lignes = [
    [-6, "debut", "Camille, l'immeuble « L'Atelier des Mots » a maintenant un cap : 3 000 € par mois."],
    [-5, "recit", "Tu as créé : « Le plan du guide ». Plume a regardé par-dessus ton épaule. L'immeuble sent l'encre fraîche."],
    [-4, "contrat-tenu", "Contrat ambitieux tenu. +80 points, et un colis en route."],
    [-4, "trait", "Boussole gagne un trait : Lève-tôt. Une quête bouclée avant 9 h."],
    [-3, "contrat-rate", "Contrat ambitieux non tenu. La mise de 20 points reste sur la table. Rien d'autre ne bouge."],
    [-3, "recit", "Tu as pris soin d'un lien : « Déjeuner avec Noa ». L'immeuble a paru plus chaleureux."],
    [-2, "effort", "Une pièce s'ouvre : Salle d'enregistrement. 10 quêtes de création, c'est fait."],
    [-1, "recit", "Tu as pris soin de toi : « Courir au parc ». Les plantes aussi respirent mieux."],
    [-1, "contrat-tenu", "Contrat ambitieux tenu. +80 points, et un colis en route."],
  ];
  partie.journal = lignes.map(([n, type, texte]) => ({ quand: jour(n) + "T10:30:00+01:00", type, texte }));
  registre.encaissements.forEach((e, i) => {
    partie.colis[e.id] = i === registre.encaissements.length - 1 ? { date: e.date, ouvert: false } : { date: e.date, ouvert: true, ouvert_le: e.date };
  });
  // Rien à fêter au chargement : jalons et badges déjà notés.
  const total = registre.encaissements.filter((e) => e.date.slice(0, 7) === ctx.date.slice(0, 7)).reduce((s, e) => s + e.montant, 0);
  partie.jalons_fetes[ctx.date.slice(0, 7)] = ctx.config.jalons_mensuels.filter((j) => j <= total);
  for (const badge of outils.listeBadges(partie, registre, ctx.config)) {
    if (badge.obtenu) partie.badges[badge.id] = jour(-3);
  }
  return { partie, registre };
}

function memoireDe(dateISO) {
  if (!memoire || memoire.date !== dateISO) memoire = { date: dateISO, partie: null, registre: null, patch: patchDemo(), quetes: quetesDemo(dateISO) };
  return memoire;
}

let dateCourante = null;

// Aucune vraie note n'est lue en démo : une intention et un plan du jour inventés.
function sources(ctx) {
  dateCourante = ctx.date;
  memoireDe(ctx.date);
  const semaine = P.semaineISO(ctx.date).id;
  const lundi = P.lundiDe(semaine);
  return {
    chemin: null,
    phase: null,
    semaine: { id: semaine, statut: "courante", lundi, dimanche: P.ajouterJours(lundi, 6) },
    quetes: [],
    jours: [],
    strategies: {
      regle_commune: "Règle commune : si je sens cet état, alors je fais le premier geste, sans réfléchir.",
      etats: [
        {
          titre: "Je suis dispersé",
          libelle: "Dispersé",
          signal: "trois onglets ouverts, aucun fini.",
          gestes: [
            { id: P.idGeste("Je suis dispersé", "Noter et fermer"), nom: "Noter et fermer", description: "j'écris l'idée sur une ligne, je ferme l'onglet." },
            { id: P.idGeste("Je suis dispersé", "Une seule fenêtre"), nom: "Une seule fenêtre", description: "plein écran sur la tâche en cours, vingt minutes." },
          ],
        },
        {
          titre: "Je suis fatigué",
          libelle: "Fatigué",
          signal: "je relis trois fois la même phrase.",
          gestes: [
            { id: P.idGeste("Je suis fatigué", "Dix minutes dehors"), nom: "Dix minutes dehors", description: "je marche sans téléphone, puis je reprends." },
            { id: P.idGeste("Je suis fatigué", "La plus petite étape"), nom: "La plus petite étape", description: "je ne fais que la première ligne." },
          ],
        },
      ],
    },
    mission: { texte: "Faire d'un petit studio sous les toits une maison qui aide des milliers de gens à écrire.", phrase: "Aider des milliers de gens à écrire.", objectifs: ["Trois mille par mois d'ici l'été.", "Une lettre chaque semaine.", "Un guide publié cette année."] },
    erreurs: [],
    avertissements: [],
  };
}

function patch() {
  return dateCourante && memoire && memoire.date === dateCourante ? memoire.patch : memoire ? memoire.patch : {};
}

function quetes() {
  return memoire ? memoire.quetes : null;
}

// La démo est recréée quand la date change.
function charger(ctx, outils) {
  const m = memoireDe(ctx.date);
  if (!m.partie) Object.assign(m, creer(ctx, outils));
  return { partie: m.partie, registre: m.registre };
}

function enregistrer(etat) {
  if (!memoire) return;
  memoire.partie = etat.partie;
  memoire.registre = etat.registre;
  if (etat.patch) memoire.patch = etat.patch;
  if (typeof etat.quetes === "string") memoire.quetes = etat.quetes;
}

// Les réglages de la démo sont prêts avant le premier appel : la configuration en dépend.
function preparer(dateISO) {
  dateCourante = dateISO;
  return memoireDe(dateISO).patch;
}

// Six collègues inventés, pour voir l'immeuble plein. Aucune vraie session n'est lue en démo.
const EXEMPLES = [
  ["d0000001", "Lettre de la semaine", ["écrit", "lit un fichier", "rédige sa réponse"], 0],
  ["d0000002", "Page de vente", ["cherche sur le web", "lit une page web", "écrit"], 2],
  ["d0000003", "Site des ateliers", ["lance une commande", "écrit", "cherche dans les fichiers"], 0],
  ["d0000004", "Leçon du jour", ["lit un fichier", "réfléchit", "écrit"], 0],
  ["d0000005", "Bibliothèque de modèles", ["organise ses tâches", "délègue à un renfort", "écrit"], 1],
  ["d0000006", "Relecture du guide", ["en pause"], 0],
];

function collegues() {
  const tic = Math.floor(Date.now() / 9000);
  return {
    collegues: EXEMPLES.map(([cle, nom, actions, renforts], i) => {
      const pause = actions[0] === "en pause";
      return {
        cle,
        nom,
        statut: pause ? "pause" : "actif",
        action: pause ? "en pause" : actions[(tic + i) % actions.length],
        age_s: pause ? 300 : 5 + i * 9,
        renforts,
      };
    }),
    autres: 0,
  };
}

module.exports = { charger, enregistrer, oublier, collegues, sources, patch, quetes, preparer, patchDemo, quetesDemo, lireQuetes: Q.lire };

  });

  definir("/jeu/serveur/sauvegarde.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/sauvegarde.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// Version 5 : la synchro simple entre appareils, sans compte.
// Une sauvegarde est un seul fichier JSON qui contient ta partie (partie, encaissements, réglages,
// quêtes écrites dans le jeu, but d'équipe). On l'exporte sur un Mac, on l'importe sur l'autre.
// Le téléphone, lui, n'a besoin de rien : il joue sur le serveur du Mac, et rejoue ses gestes hors ligne.
// Avant chaque import, la partie en place est mise de côté dans data/ (rien n'est jamais perdu).
// Les certificats (data/https.json) ne sont jamais exportés : ils restent propres à chaque Mac.
// Toutes les écritures passent par garde.js.

const garde = require("./garde");
const { ErreurJeu, VERSION } = require("./config");

const JSONS = ["partie.json", "encaissements.json", "reglages.json"];
const TEXTES = ["quetes.md", "but-equipe.md"];
const MARQUE = "jeu-quetes-sauvegarde";
const TAILLE_MAX = 4 * 1024 * 1024;

function horodatage(date) {
  return (date || new Date()).toISOString().replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "-").toLowerCase();
}

// Ce que contient la partie en ce moment, prêt à être téléchargé.
function exporter(maintenant) {
  const fichiers = {};
  for (const nom of JSONS) {
    const objet = garde.lireDonnees(nom);
    if (objet) fichiers[nom] = objet;
  }
  const textes = {};
  for (const nom of TEXTES) {
    const t = garde.lireTexte(nom);
    if (typeof t === "string") textes[nom] = t;
  }
  return { jeu: MARQUE, version: VERSION, cree_le: (maintenant || new Date()).toISOString(), fichiers, textes };
}

function verifier(sauvegarde) {
  if (!sauvegarde || typeof sauvegarde !== "object" || sauvegarde.jeu !== MARQUE) {
    throw new ErreurJeu("REQUETE_INVALIDE", "Ce fichier n'est pas une sauvegarde du Jeu de quêtes.");
  }
  const fichiers = sauvegarde.fichiers && typeof sauvegarde.fichiers === "object" ? sauvegarde.fichiers : {};
  const textes = sauvegarde.textes && typeof sauvegarde.textes === "object" ? sauvegarde.textes : {};
  for (const nom of Object.keys(fichiers)) {
    if (!JSONS.includes(nom)) throw new ErreurJeu("REQUETE_INVALIDE", "Fichier inattendu dans la sauvegarde : " + nom + ".");
    const v = fichiers[nom];
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new ErreurJeu("REQUETE_INVALIDE", "Le fichier " + nom + " de la sauvegarde est abîmé.");
  }
  for (const nom of Object.keys(textes)) {
    if (!TEXTES.includes(nom)) throw new ErreurJeu("REQUETE_INVALIDE", "Fichier inattendu dans la sauvegarde : " + nom + ".");
    if (typeof textes[nom] !== "string") throw new ErreurJeu("REQUETE_INVALIDE", "Le fichier " + nom + " de la sauvegarde est abîmé.");
  }
  if (!fichiers["partie.json"]) throw new ErreurJeu("REQUETE_INVALIDE", "La sauvegarde ne contient pas de partie.");
  return { fichiers, textes };
}

// Remplace la partie en place par la sauvegarde. La partie d'avant est gardée en entier dans
// data/avant-import-<date>.json : un second import de ce fichier la remet en place.
function importer(sauvegarde, maintenant) {
  const { fichiers, textes } = verifier(sauvegarde);
  const avant = exporter(maintenant);
  const nomAvant = "avant-import-" + horodatage(maintenant) + ".json";
  garde.ecrireDonnees(nomAvant, avant);
  for (const nom of JSONS) {
    if (fichiers[nom]) garde.ecrireDonnees(nom, fichiers[nom]);
    else garde.effacerDonnees(nom);
  }
  for (const nom of TEXTES) {
    if (typeof textes[nom] === "string") garde.ecrireTexte(nom, textes[nom]);
    else garde.effacerTexte(nom);
  }
  return { importe: Object.keys(fichiers).concat(Object.keys(textes)), mise_de_cote: nomAvant, cree_le: sauvegarde.cree_le || null };
}

module.exports = { exporter, importer, verifier, TAILLE_MAX, JSONS, TEXTES, MARQUE };

  });

  definir("/jeu/serveur/config.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/config.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// Charge config.json, applique les valeurs par défaut, résout le coffre.
// Lecture seule : ce module n'écrit jamais sur le disque.
// Version 3 : tout se règle. Aucun montant n'est imposé : les valeurs ci-dessous sont des
// propositions de départ, que le joueur change dans config.json ou dans l'écran Réglages
// (gardé dans data/reglages.json, qui passe devant config.json).

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DOSSIER_JEU = path.resolve(__dirname, "..");
const VERSION = "6.0.0";

// Motif qui protège les dossiers de l'employeur précédent : jamais ouverts.
const MOTIF_INTERDIT = /france[-_ ]?ia/i;

class ErreurJeu extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "ErreurJeu";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

// Les cinq lieux de l'immeuble et les agents maison : seuls leurs noms se règlent
// (les dessins, eux, sont dans le code).
const LIEUX_DEFAUT = {
  studio: { nom: "Le studio sous les toits", sous_titre: "Un ordinateur, une idée." },
  coworking: { nom: "Le poste en coworking", sous_titre: "Un premier résultat. Tu sors de chez toi." },
  atelier: { nom: "L'atelier", sous_titre: "Ton nom sur la porte." },
  bureaux: { nom: "Les grands bureaux", sous_titre: "Deux étages vitrés, une équipe." },
  "maison-edition": { nom: "La maison d'édition", sous_titre: "Tout l'immeuble. Tes livres en vitrine." },
};

const AGENTS_DEFAUT = {
  plume: { nom: "Plume", role: "écriture", specialite: "creation" },
  boussole: { nom: "Boussole", role: "vente", specialite: "vente" },
  archive: { nom: "Archive", role: "administratif", specialite: "admin" },
  croquis: { nom: "Croquis", role: "création", specialite: "creation" },
  timbre: { nom: "Timbre", role: "liens et messages", specialite: "relations" },
  relais: { nom: "Relais", role: "forme et santé", specialite: "sante" },
  reliure: { nom: "Reliure", role: "édition", specialite: "creation" },
  marge: { nom: "Marge", role: "relecture", specialite: "admin" },
};

// Cinq types de quête. « payee » : des points. « racontee » : une ligne au journal de l'immeuble, pas de points.
const TYPES_DEFAUT = {
  admin: { nom: "Administratif", mode: "payee", mots: ["facture", "factures", "impôts", "urssaf", "banque", "déclaration", "contrat", "papiers", "comptes", "compta", "assurance", "dossier", "formulaire", "payer", "rendez-vous"] },
  vente: { nom: "Vente", mode: "payee", mots: [] },
  creation: { nom: "Création", mode: "racontee", mots: ["écrire", "rédiger", "dessiner", "enregistrer", "tourner", "édition", "éditions", "brouillon", "chapitre", "vidéo", "leçon", "maquette", "peindre", "composer", "publier", "monter"] },
  relations: { nom: "Relations", mode: "racontee", mots: ["appeler", "déjeuner", "dîner", "remercier", "anniversaire", "famille", "ami", "amie", "amis", "nouvelles", "parents", "inviter", "voir"] },
  sante: { nom: "Santé", mode: "racontee", mots: ["sport", "marcher", "marche", "courir", "course", "dormir", "méditer", "médecin", "dentiste", "étirements", "repos", "yoga", "natation", "vélo", "cuisiner"] },
};
const ORDRE_TYPES = ["admin", "vente", "creation", "relations", "sante"];

const COMPTEURS = ["quetes", "admin", "vente", "creation", "relations", "sante", "confiees", "contrats", "semaines", "arrosages"];
const FONCTIONS = ["contrat", "boutique", "equipe", "argent", "carte", "arrosage", "trophees", "etat"];

const DEFAUT = {
  version: 3,
  coffre: "non", // "auto" : lu s'il existe ; "requis" : une erreur s'il manque ; "non" : jamais lu
  coffre_candidats: [],
  chemin_phases: "",
  port: 4760,
  https: false, // version 5 : true (ou --https) chiffre la connexion sur le réseau local, pour le vrai hors ligne sur l'iPhone. Implique le réseau local.
  reseau_local: false, // true : le jeu s'ouvre aussi depuis un téléphone du même Wi-Fi. Se règle ici ou avec --lan, jamais depuis l'écran Réglages.
  fuseau: "Europe/Paris",
  rafraichissement_s: 30,
  son: true,
  joueur: "",
  enseigne: "Mon enseigne",
  monnaie: "€",
  objectif_mensuel: 1000,
  jalons_mensuels: "auto", // "auto" : quatre paliers égaux jusqu'à l'objectif. Sinon une liste : [250, 500, 750]
  periode: "mois_civil",
  sources_encaissement: ["Ventes", "Abonnements", "Ateliers", "Livre", "Autre"],
  points: { ligne: 10, priorite: 15, degres: [1, 2, 3], degre_defaut: 2, multiplicateur_vente: 2, bonus_jour: 25, geste: 5 },
  degres_defaut: ["Commencé pour de bon", "Fait, comme prévu", "Fait, et mieux que prévu"],
  types: TYPES_DEFAUT,
  type_defaut: "admin",
  categories_note: { "Deep Focus": "creation", "Créatif": "creation", Admin: "admin", Autre: "" },
  quetes_visibles: 5,
  plafond: { par_jour: 6, plein: 4, taux_reduit: 50 },
  contrat: {
    actif: true,
    sur: { quetes: 3, gain: 30 },
    ambitieux: { quetes: 2, mise: 20, gain: 80, heure_limite: "12:00", colis: true },
  },
  retour: { jours: 3, bonus: 20 },
  arrosage: { bonus_pourcent: 20, duree_h: 12 },
  but_equipe: { libelle: "", crans: 10, par_cran: 3, par_quete: 1, par_specialite: 1, par_session: 1, sessions_max_par_jour: 3, recompense: 60 },
  dimanche: { jour: 7, recompense: 40 },
  niveaux: {
    seuils: [0, 60, 150, 300, 500, 800, 1200, 1700, 2400, 3200],
    noms: ["Locataire", "Habitué", "Artisan", "Bâtisseur", "Chef d'atelier", "Maître d'œuvre", "Architecte", "Éditeur", "Figure du quartier", "Légende de l'immeuble"],
  },
  deblocages: { actif: true, contrat: 2, boutique: 2, equipe: 3, argent: 4, carte: 4, arrosage: 5, trophees: 5, etat: 5 },
  energie: require("./energie").DEFAUT,
  lieux: LIEUX_DEFAUT,
  agents: AGENTS_DEFAUT,
  mots_vente: [
    "offre", "offres", "relance", "relances", "relancer",
    "prospect", "prospects", "message à", "vente", "ventes",
    "inscription", "inscriptions", "liste d'attente", "page de vente",
    "abonné", "abonnés", "proposer", "proposition", "devis", "client", "clients", "vendre",
  ],
  mots_newsletter: ["édition", "éditions", "newsletter", "newsletters", "abonné", "abonnés", "Substack"],
  lecteurs_par_quete: 3,
  temoignages: [],
  // Étages : ils s'ouvrent avec un résultat. « part » : une part de ton objectif du mois.
  caps: [
    { id: "cap1", lieu: "coworking", premier: true },
    { id: "cap2", lieu: "atelier", part: 0.33 },
    { id: "cap3", lieu: "bureaux", part: 1 },
    { id: "cap4", lieu: "maison-edition", part: 1.67 },
  ],
  // Pièces et meubles : ils s'ouvrent avec un effort, que le jeu compte lui-même.
  caps_effort: [
    { id: "eff1", piece: "studio/etagere", compteur: "quetes", seuil: 5 },
    { id: "eff2", piece: "studio/micro", compteur: "contrats", seuil: 3 },
    { id: "eff3", piece: "coworking/cabine", compteur: "vente", seuil: 5 },
    { id: "eff4", piece: "coworking/objectifs", compteur: "semaines", seuil: 2 },
    { id: "eff5", piece: "atelier/studio-son", compteur: "creation", seuil: 10 },
    { id: "eff6", piece: "bureaux/salle-reunion", compteur: "vente", seuil: 10 },
    { id: "eff7", piece: "bureaux/studio-video", compteur: "confiees", seuil: 15 },
    { id: "eff8", piece: "maison-edition/grande-bibliotheque", compteur: "quetes", seuil: 100 },
    { id: "eff9", piece: "maison-edition/salle-lecture", compteur: "relations", seuil: 20 },
    { id: "eff10", piece: "maison-edition/presse", compteur: "contrats", seuil: 15 },
    { id: "eff11", piece: "maison-edition/enseigne", compteur: "semaines", seuil: 8 },
  ],
  collegues: {
    actif: true,
    racine: "",
    exclure: "france-ia|franceia|france ia|france_ia",
    seuil_actif_s: 120,
    seuil_present_s: 600,
    nom: "titre",
    max: 6,
  },
};

function estObjet(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function propre(objet, cle) {
  return estObjet(objet) && Object.prototype.hasOwnProperty.call(objet, cle) ? objet[cle] : undefined;
}

function nombre(v, defaut, min, max) {
  return typeof v === "number" && Number.isFinite(v) && v >= min && (max === undefined || v <= max) ? v : defaut;
}

function entier(v, defaut, min, max) {
  return Number.isInteger(v) && v >= min && (max === undefined || v <= max) ? v : defaut;
}

function texte(v, defaut, max) {
  return typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max || 80) : defaut;
}

function tilde(chemin) {
  if (typeof chemin !== "string") return chemin;
  if (chemin === "~") return os.homedir();
  if (chemin.startsWith("~/")) return path.join(os.homedir(), chemin.slice(2));
  return chemin;
}

function listeDeTextes(v, defaut) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : defaut;
}

// Arrondi lisible : 333 devient 350, 1 670 devient 1 700, 0,33 x 100 devient 35.
function arrondiLisible(n) {
  if (!(n > 0)) return 1;
  const pas = n < 20 ? 1 : n < 200 ? 5 : n < 2000 ? 50 : n < 20000 ? 250 : 1000;
  return Math.max(1, Math.round(n / pas) * pas);
}

function formaterMontant(n, monnaie) {
  const entierN = Math.floor(Math.abs(n));
  const cents = Math.round((Math.abs(n) - entierN) * 100);
  const groupes = String(entierN).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (n < 0 ? "-" : "") + groupes + (cents ? "," + String(cents).padStart(2, "0") : "") + " " + (monnaie || "€");
}

function heureValide(v) {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

// ---------------------------------------------------------------- morceaux

function completerCaps(lu, objectif, monnaie) {
  const source = Array.isArray(lu) ? lu : DEFAUT.caps;
  const caps = [];
  for (const x of source) {
    if (!estObjet(x) || typeof x.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(x.id)) continue;
    const cap = { id: x.id, libelle: "" };
    if (typeof x.lieu === "string" && x.lieu) cap.lieu = x.lieu;
    const part = typeof x.part === "number" && Number.isFinite(x.part) && x.part > 0 ? x.part : null;
    const seuilEcrit = typeof x.seuil_mois === "number" && Number.isFinite(x.seuil_mois) && x.seuil_mois > 0 && x.seuil_auto !== true ? x.seuil_mois : null;
    if (seuilEcrit !== null) cap.seuil_mois = seuilEcrit;
    else if (part !== null) {
      cap.part = part;
      // une part de 1, c'est l'objectif lui-même : il n'est jamais arrondi
      cap.seuil_mois = part === 1 ? objectif : arrondiLisible(part * objectif);
      cap.seuil_auto = true;
    }
    if (x.premier === true && !cap.seuil_mois) cap.premier = true;
    const libelleEcrit = typeof x.libelle === "string" && x.libelle.trim() !== "" && x.libelle_auto !== true ? x.libelle.trim().slice(0, 120) : null;
    if (libelleEcrit !== null) cap.libelle = libelleEcrit;
    else if (cap.premier) {
      cap.libelle = "Ton premier encaissement";
      cap.libelle_auto = true;
    } else if (cap.seuil_mois) {
      cap.libelle = formaterMontant(cap.seuil_mois, monnaie) + " encaissés sur un mois";
      cap.libelle_auto = true;
    } else continue; // ni libellé ni seuil : rien à afficher
    caps.push(cap);
  }
  return caps;
}

const LIBELLES_COMPTEURS = {
  quetes: ["quête faite", "quêtes faites"],
  admin: ["quête d'administratif", "quêtes d'administratif"],
  vente: ["action de vente", "actions de vente"],
  creation: ["quête de création", "quêtes de création"],
  relations: ["quête de relations", "quêtes de relations"],
  sante: ["quête de santé", "quêtes de santé"],
  confiees: ["quête faite avec un agent", "quêtes faites avec un agent"],
  contrats: ["contrat tenu", "contrats tenus"],
  semaines: ["semaine bouclée", "semaines bouclées"],
  arrosages: ["arrosage", "arrosages"],
};

function completerCapsEffort(lu) {
  const source = Array.isArray(lu) ? lu : DEFAUT.caps_effort;
  const caps = [];
  const vus = new Set();
  for (const x of source) {
    if (!estObjet(x) || typeof x.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(x.id) || vus.has(x.id)) continue;
    if (typeof x.piece !== "string" || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(x.piece)) continue;
    if (!COMPTEURS.includes(x.compteur)) continue;
    const seuil = entier(x.seuil, 0, 1, 100000);
    if (!seuil) continue;
    vus.add(x.id);
    const cap = { id: x.id, piece: x.piece, compteur: x.compteur, seuil, libelle: "" };
    const ecrit = typeof x.libelle === "string" && x.libelle.trim() !== "" && x.libelle_auto !== true ? x.libelle.trim().slice(0, 120) : null;
    if (ecrit !== null) cap.libelle = ecrit;
    else {
      cap.libelle = seuil + " " + LIBELLES_COMPTEURS[x.compteur][seuil > 1 ? 1 : 0];
      cap.libelle_auto = true;
    }
    caps.push(cap);
  }
  return caps;
}

function completerTypes(lu) {
  const types = {};
  for (const id of ORDRE_TYPES) {
    const d = TYPES_DEFAUT[id];
    const x = estObjet(propre(lu, id)) ? lu[id] : {};
    types[id] = {
      nom: texte(x.nom, d.nom, 24),
      mode: x.mode === "payee" || x.mode === "racontee" ? x.mode : d.mode,
      mots: listeDeTextes(x.mots, d.mots).slice(0, 60),
    };
  }
  return types;
}

function completerNommes(lu, defauts, champs) {
  const resultat = {};
  for (const id of Object.keys(defauts)) {
    const x = estObjet(propre(lu, id)) ? lu[id] : {};
    resultat[id] = {};
    for (const [champ, max] of champs) resultat[id][champ] = texte(x[champ], defauts[id][champ], max);
  }
  return resultat;
}

function completerNiveaux(lu) {
  const d = DEFAUT.niveaux;
  const x = estObjet(lu) ? lu : {};
  let seuils = Array.isArray(x.seuils) ? [...new Set(x.seuils.filter((n) => Number.isInteger(n) && n >= 0 && n <= 10000000))].sort((a, b) => a - b) : d.seuils;
  if (seuils.length === 0) seuils = d.seuils;
  if (seuils[0] !== 0) seuils = [0, ...seuils];
  seuils = seuils.slice(0, 30);
  const nomsLus = Array.isArray(x.noms) ? x.noms.map((n) => (typeof n === "string" ? n.trim().slice(0, 30) : "")) : d.noms;
  const noms = seuils.map((s, i) => nomsLus[i] || d.noms[i] || "Niveau " + (i + 1));
  return { seuils, noms };
}

// ---------------------------------------------------------------- completer

// Fusionne un objet lu dans config.json avec les valeurs par défaut.
// Idempotent : completer(completer(x)) vaut completer(x).
function completer(lu) {
  const c = estObjet(lu) ? lu : {};
  const d = DEFAUT;
  const points = estObjet(c.points) ? c.points : {};
  const col = estObjet(c.collegues) ? c.collegues : {};
  const monnaie = texte(c.monnaie, d.monnaie, 12);
  const objectif = nombre(c.objectif_mensuel, d.objectif_mensuel, 1, 100000000);

  // Jalons : une liste écrite à la main, ou "auto" (quatre paliers égaux jusqu'à l'objectif).
  const jalonsAuto = !Array.isArray(c.jalons_mensuels) || c.jalons_auto === true;
  let jalons = jalonsAuto
    ? [...new Set([0.25, 0.5, 0.75].map((k) => arrondiLisible(k * objectif)))]
    : [...new Set(c.jalons_mensuels.filter((x) => typeof x === "number" && Number.isFinite(x) && x > 0))].sort((a, b) => a - b);
  jalons = jalons.filter((x) => x < objectif);
  jalons.push(objectif); // le dernier jalon est toujours l'objectif

  const sources = listeDeTextes(c.sources_encaissement, d.sources_encaissement).map((x) => x.slice(0, 24));
  const degres = Array.isArray(points.degres) && points.degres.length === 3 && points.degres.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 100) ? points.degres.slice() : d.points.degres.slice();
  const degresDefaut = Array.isArray(c.degres_defaut) && c.degres_defaut.length === 3 && c.degres_defaut.every((x) => typeof x === "string" && x.trim() !== "") ? c.degres_defaut.map((x) => x.trim().slice(0, 80)) : d.degres_defaut.slice();
  const plafond = estObjet(c.plafond) ? c.plafond : {};
  const parJour = entier(plafond.par_jour, d.plafond.par_jour, 0, 1000);
  const contrat = estObjet(c.contrat) ? c.contrat : {};
  const sur = estObjet(contrat.sur) ? contrat.sur : {};
  const amb = estObjet(contrat.ambitieux) ? contrat.ambitieux : {};
  const retour = estObjet(c.retour) ? c.retour : {};
  const arrosage = estObjet(c.arrosage) ? c.arrosage : {};
  const but = estObjet(c.but_equipe) ? c.but_equipe : {};
  const dim = estObjet(c.dimanche) ? c.dimanche : {};
  const deb = estObjet(c.deblocages) ? c.deblocages : {};
  const cat = estObjet(c.categories_note) ? c.categories_note : {};
  const types = completerTypes(c.types);
  const deblocages = { actif: typeof deb.actif === "boolean" ? deb.actif : d.deblocages.actif };
  for (const f of FONCTIONS) deblocages[f] = entier(deb[f], d.deblocages[f], 0, 365);
  const categories = {};
  for (const nom of Object.keys(d.categories_note)) {
    const v = propre(cat, nom);
    categories[nom] = v === "" || ORDRE_TYPES.includes(v) ? v : d.categories_note[nom];
  }

  const config = {
    version: 3,
    coffre: c.coffre === "requis" || c.coffre === "non" ? c.coffre : "auto",
    coffre_candidats: Array.isArray(c.coffre_candidats)
      ? c.coffre_candidats.filter((x) => typeof x === "string" && x.trim() !== "")
      : d.coffre_candidats,
    chemin_phases: typeof c.chemin_phases === "string" && c.chemin_phases ? c.chemin_phases : d.chemin_phases,
    port: entier(c.port, d.port, 1, 65525),
    reseau_local: c.reseau_local === true,
    https: c.https === true,
    fuseau: typeof c.fuseau === "string" && c.fuseau ? c.fuseau : d.fuseau,
    rafraichissement_s: nombre(c.rafraichissement_s, d.rafraichissement_s, 5, 3600),
    son: typeof c.son === "boolean" ? c.son : d.son,
    joueur: typeof c.joueur === "string" ? c.joueur.trim().slice(0, 30) : d.joueur,
    enseigne: typeof c.enseigne === "string" && c.enseigne.trim() ? c.enseigne.trim().slice(0, 40) : d.enseigne,
    monnaie,
    objectif_mensuel: objectif,
    jalons_mensuels: jalons,
    periode: c.periode === "30_jours" ? "30_jours" : "mois_civil",
    sources_encaissement: sources.length ? sources : d.sources_encaissement,
    points: {
      ligne: nombre(points.ligne, d.points.ligne, 0, 100000),
      priorite: nombre(points.priorite, d.points.priorite, 0, 100000),
      degres,
      degre_defaut: entier(points.degre_defaut, d.points.degre_defaut, 1, 3),
      multiplicateur_vente: nombre(points.multiplicateur_vente, d.points.multiplicateur_vente, 1, 100),
      bonus_jour: nombre(points.bonus_jour, d.points.bonus_jour, 0, 100000),
      geste: nombre(points.geste, d.points.geste, 0, 100000),
    },
    degres_defaut: degresDefaut,
    types,
    type_defaut: ORDRE_TYPES.includes(c.type_defaut) ? c.type_defaut : d.type_defaut,
    categories_note: categories,
    quetes_visibles: entier(c.quetes_visibles, d.quetes_visibles, 1, 50),
    plafond: {
      par_jour: parJour,
      plein: Math.min(entier(plafond.plein, d.plafond.plein, 0, 1000), parJour || 1000),
      taux_reduit: entier(plafond.taux_reduit, d.plafond.taux_reduit, 0, 100),
    },
    contrat: {
      actif: typeof contrat.actif === "boolean" ? contrat.actif : d.contrat.actif,
      sur: { quetes: entier(sur.quetes, d.contrat.sur.quetes, 1, 10), gain: entier(sur.gain, d.contrat.sur.gain, 0, 100000) },
      ambitieux: {
        quetes: entier(amb.quetes, d.contrat.ambitieux.quetes, 0, 10),
        mise: entier(amb.mise, d.contrat.ambitieux.mise, 0, 100000),
        gain: entier(amb.gain, d.contrat.ambitieux.gain, 0, 100000),
        heure_limite: heureValide(amb.heure_limite) ? amb.heure_limite : d.contrat.ambitieux.heure_limite,
        colis: typeof amb.colis === "boolean" ? amb.colis : d.contrat.ambitieux.colis,
      },
    },
    retour: { jours: entier(retour.jours, d.retour.jours, 1, 365), bonus: entier(retour.bonus, d.retour.bonus, 0, 100000) },
    arrosage: { bonus_pourcent: entier(arrosage.bonus_pourcent, d.arrosage.bonus_pourcent, 0, 500), duree_h: entier(arrosage.duree_h, d.arrosage.duree_h, 1, 168) },
    but_equipe: {
      libelle: typeof but.libelle === "string" ? but.libelle.trim().slice(0, 80) : d.but_equipe.libelle,
      crans: entier(but.crans, d.but_equipe.crans, 1, 50),
      par_cran: entier(but.par_cran, d.but_equipe.par_cran, 1, 100),
      par_quete: entier(but.par_quete, d.but_equipe.par_quete, 0, 100),
      par_specialite: entier(but.par_specialite, d.but_equipe.par_specialite, 0, 100),
      par_session: entier(but.par_session, d.but_equipe.par_session, 0, 100),
      sessions_max_par_jour: entier(but.sessions_max_par_jour, d.but_equipe.sessions_max_par_jour, 0, 100),
      recompense: entier(but.recompense, d.but_equipe.recompense, 0, 100000),
    },
    dimanche: { jour: entier(dim.jour, d.dimanche.jour, 1, 7), recompense: entier(dim.recompense, d.dimanche.recompense, 0, 100000) },
    niveaux: completerNiveaux(c.niveaux),
    deblocages,
    energie: require("./energie").completer(c.energie),
    lieux: completerNommes(c.lieux, LIEUX_DEFAUT, [["nom", 40], ["sous_titre", 80]]),
    agents: (() => {
      const agents = completerNommes(c.agents, AGENTS_DEFAUT, [["nom", 16], ["role", 30]]);
      for (const id of Object.keys(AGENTS_DEFAUT)) {
        const x = estObjet(propre(c.agents, id)) ? c.agents[id] : {};
        agents[id].specialite = ORDRE_TYPES.includes(x.specialite) ? x.specialite : AGENTS_DEFAUT[id].specialite;
      }
      return agents;
    })(),
    mots_vente: Array.isArray(c.mots_vente) ? c.mots_vente.filter((x) => typeof x === "string" && x.trim() !== "") : d.mots_vente,
    mots_newsletter: listeDeTextes(c.mots_newsletter, d.mots_newsletter),
    lecteurs_par_quete: nombre(c.lecteurs_par_quete, d.lecteurs_par_quete, 0, 1000),
    temoignages: Array.isArray(c.temoignages)
      ? c.temoignages
          .filter((x) => estObjet(x) && typeof x.texte === "string" && x.texte.trim() !== "")
          .slice(0, 12)
          .map((x) => ({ texte: x.texte.trim().slice(0, 240), auteur: typeof x.auteur === "string" ? x.auteur.trim().slice(0, 40) : "" }))
      : d.temoignages,
    caps: completerCaps(c.caps, objectif, monnaie),
    caps_effort: completerCapsEffort(c.caps_effort),
    // Version 4 : le Système (niveaux, rangs, points de vie, or, donjons, studio). Tout se règle.
    systeme: require("./sysconfig").completer(c.systeme),
    collegues: {
      actif: typeof col.actif === "boolean" ? col.actif : d.collegues.actif,
      racine: typeof col.racine === "string" && col.racine ? col.racine : d.collegues.racine,
      exclure: typeof col.exclure === "string" && col.exclure ? col.exclure : d.collegues.exclure,
      seuil_actif_s: nombre(col.seuil_actif_s, d.collegues.seuil_actif_s, 1),
      seuil_present_s: nombre(col.seuil_present_s, d.collegues.seuil_present_s, 1),
      nom: col.nom === "dossier" ? "dossier" : "titre",
      max: nombre(col.max, d.collegues.max, 0),
    },
  };
  if (jalonsAuto) config.jalons_auto = true;
  return config;
}

// ---------------------------------------------------------------- réglages du joueur

// Pose un patch (data/reglages.json) sur une configuration. Une liste d'objets à identifiant
// (caps, caps_effort) se corrige par identifiant : { caps: { cap2: { seuil_mois: 1500 } } }.
function fusionner(base, patch) {
  if (!estObjet(patch)) return patch === undefined ? base : patch;
  if (Array.isArray(base) && base.every((x) => estObjet(x) && typeof x.id === "string")) {
    return base.map((x) => {
      const p = propre(patch, x.id);
      if (!estObjet(p)) return x;
      const fusion = { ...x, ...p };
      // un champ écrit par le joueur n'est plus calculé
      if (Object.prototype.hasOwnProperty.call(p, "libelle")) delete fusion.libelle_auto;
      if (Object.prototype.hasOwnProperty.call(p, "seuil_mois")) {
        delete fusion.seuil_auto;
        delete fusion.part;
      }
      return fusion;
    });
  }
  if (!estObjet(base)) return patch;
  const resultat = { ...base };
  for (const cle of Object.keys(patch)) {
    if (cle === "__proto__" || cle === "constructor" || cle === "prototype") continue;
    resultat[cle] = fusionner(propre(base, cle), patch[cle]);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "jalons_mensuels")) delete resultat.jalons_auto;
  return resultat;
}

// Configuration effective : config.json, puis les réglages du joueur par-dessus.
function effective(base, patch) {
  return estObjet(patch) && Object.keys(patch).length ? completer(fusionner(base, patch)) : base;
}

// Lit config.json. JSON invalide : ErreurJeu("CONFIG_INVALIDE").
function charger(fichier) {
  const chemin = fichier || path.join(DOSSIER_JEU, "config.json");
  let lu = {};
  if (fs.existsSync(chemin)) {
    let contenu;
    try {
      contenu = fs.readFileSync(chemin, "utf8");
    } catch (e) {
      throw new ErreurJeu("CONFIG_INVALIDE", "Je n'arrive pas à lire config.json : " + e.message);
    }
    try {
      lu = JSON.parse(contenu.replace(/^﻿/, ""));
    } catch (e) {
      throw new ErreurJeu("CONFIG_INVALIDE", "config.json n'est pas un JSON valide : " + e.message);
    }
  }
  const config = completer(lu);
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: config.fuseau });
  } catch (e) {
    throw new ErreurJeu("CONFIG_INVALIDE", "Le fuseau « " + config.fuseau + " » de config.json est inconnu.");
  }
  return config;
}

function dansDossier(enfant, parent) {
  const rel = path.relative(parent, enfant);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function reel(chemin) {
  try {
    return fs.realpathSync(chemin);
  } catch (e) {
    return path.resolve(chemin);
  }
}

// Premier candidat qui existe et contient chemin_phases.
// JEU_COFFRE, s'il est défini, remplace toute la liste (isolation des tests).
function resoudreCoffre(config) {
  const env = process.env.JEU_COFFRE;
  const candidats = env ? [env] : config.coffre_candidats;
  for (const brut of candidats) {
    const chemin = path.resolve(tilde(brut));
    if (MOTIF_INTERDIT.test(chemin)) continue;
    try {
      if (fs.statSync(path.join(chemin, config.chemin_phases)).isDirectory()) return chemin;
    } catch (e) {
      // candidat suivant
    }
  }
  throw new ErreurJeu(
    "COFFRE_INTROUVABLE",
    "Je ne trouve pas ton coffre. Vérifie coffre_candidats dans config.json.",
    { candidats }
  );
}

// Refus de démarrer si le jeu est dans le coffre, ou le coffre dans le jeu.
function verifierSeparation(coffre) {
  const jeu = reel(DOSSIER_JEU);
  const c = reel(coffre);
  if (dansDossier(jeu, c) || dansDossier(c, jeu)) {
    throw new ErreurJeu(
      "COFFRE_MELANGE",
      "Le dossier du jeu et le coffre doivent être séparés. Déplace le jeu hors du coffre."
    );
  }
}

function racineCollegues(config) {
  return path.resolve(tilde(process.env.JEU_CLAUDE_PROJECTS || config.collegues.racine));
}

module.exports = {
  DOSSIER_JEU,
  VERSION,
  DEFAUT,
  LIEUX_DEFAUT,
  AGENTS_DEFAUT,
  TYPES_DEFAUT,
  ORDRE_TYPES,
  COMPTEURS,
  FONCTIONS,
  LIBELLES_COMPTEURS,
  MOTIF_INTERDIT,
  ErreurJeu,
  charger,
  completer,
  fusionner,
  effective,
  formaterMontant,
  arrondiLisible,
  heureValide,
  resoudreCoffre,
  verifierSeparation,
  racineCollegues,
  dansDossier,
  reel,
  tilde,
};

  });

  definir("/jeu/serveur/partie.js", function (require, module, exports) {
    var __dirname = "/jeu/serveur";
    var __filename = "/jeu/serveur/partie.js";
    var process = nodeProcess;
    var Buffer = undefined;
"use strict";
// État du jeu : points, paiements, série, achats, caps, encaissements, rangement, badges.
// Toute écriture passe par garde.js. En mode démo, rien n'est écrit : tout reste en mémoire.

const crypto = require("node:crypto");
const garde = require("./garde");
const coffreLecture = require("./coffre");
const catalogue = require("./catalogue");
const collegues = require("./collegues");
const encaissements = require("./encaissements");
const demo = require("./demo");
const configuration = require("./config");
const { ErreurJeu, resoudreCoffre } = configuration;
const P = require("./parseurs");
const R = require("./regles");
const Q = require("./quetes");
const reglages = require("./reglages");
const S = require("./systeme");
const E = require("./energie");

const FICHIER_PARTIE = "partie.json";
const FICHIER_TEST = "partie-test.json";
const FICHIER_ENCAISSEMENTS = "encaissements.json";
const FICHIER_ENCAISSEMENTS_TEST = "encaissements-test.json";
const FICHIER_REGLAGES = "reglages.json";
const FICHIER_REGLAGES_TEST = "reglages-test.json";
const FICHIER_QUETES = "quetes.md";
const FICHIER_QUETES_TEST = "quetes-test.md";
const FICHIER_BUT = "but-equipe.md";
const FICHIER_BUT_TEST = "but-equipe-test.md";
const MAX_HISTORIQUE = 2000;
const MAX_ETATS = 2000;
const POINTS_DOUBLON = 20;
const CADEAU_PREMIERE_QUETE = { lieu: "studio", id: "plante" };

// ---------------------------------------------------------------- chargement

function nouvellePartie(horodatage) {
  return {
    version: 3,
    cree_le: horodatage,
    accueil_vu: false,
    assistant_fait: false,
    tout_ouvert: false,
    derniere_visite: null,
    retours: [],
    contrats: {},
    degres: {},
    types_forces: {},
    reportees: {},
    journal: [],
    arrosage: null,
    arrosages: {},
    equipe: {},
    traits: {},
    semaines: {},
    efforts: {},
    deblocages_vus: {},
    avant_jeu: {},
    niveau_fete: 1,
    points: 0,
    total_gagne: 0,
    caps: {},
    ameliorations: {},
    paiements: {},
    bonus_jours: {},
    gestes: {},
    etats: [],
    ventes_forcees: {},
    jours_actifs: [],
    serie: { record: 0 },
    historique: [],
    avatar: { ...catalogue.AVATAR_DEFAUT },
    placements: {},
    objets: {},
    colis: {},
    en_cours: {},
    badges: {},
    jalons_fetes: {},
    systeme: S.etatNeuf(),
    energies: {},
    couts_energie: {},
  };
}

function estObjet(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Lecture d'une clé qui appartient vraiment à l'objet (jamais « constructor » ou « __proto__ »).
function propre(objet, cle) {
  return estObjet(objet) && typeof cle === "string" && Object.prototype.hasOwnProperty.call(objet, cle) ? objet[cle] : undefined;
}

function entierBorne(v, max, defaut) {
  return Number.isInteger(v) && v >= 0 && v < max ? v : defaut;
}

function normaliserAvatar(lu) {
  const d = catalogue.AVATAR_DEFAUT;
  const a = estObjet(lu) ? lu : {};
  return {
    peau: entierBorne(a.peau, catalogue.AVATAR.peau, d.peau),
    cheveux: entierBorne(a.cheveux, catalogue.AVATAR.cheveux, d.cheveux),
    pull: entierBorne(a.pull, catalogue.AVATAR.pull, d.pull),
    barbe: typeof a.barbe === "boolean" ? a.barbe : d.barbe,
    lunettes: typeof a.lunettes === "boolean" ? a.lunettes : d.lunettes,
  };
}

// Prix des améliorations de la version 1 : elles n'existent plus, leurs points sont rendus.
const PRIX_V1 = {
  chambre: { lampe: 30, plante: 40, ecran2: 60, fauteuil: 80, etagere: 120, micro: 150 },
  coworking: { casque: 40, casier: 60, ecran: 80, tasse: 100, cabine: 140, objectifs: 180 },
  "bureau-privatif": { plaque: 60, "tableau-blanc": 90, "grand-bureau": 120, canape: 150, bibliotheque: 180, recrue: 200 },
  "premiers-bureaux": { enseigne: 100, "coin-cafe": 140, "salle-reunion": 180, recrues: 200, "studio-son": 220, "mur-abonnes": 260 },
  siege: { accueil: 150, "grande-salle": 200, "studio-video": 250, equipe: 280, terrasse: 300, logo: 320 },
  campus: { jardin: 200, amphitheatre: 300, "bibliotheque-campus": 300, "studio-tournage": 350, residence: 400, horloge: 450 },
};

function rembourserV1(lue) {
  let rendu = 0;
  for (const [lieu, prix] of Object.entries(PRIX_V1)) {
    const achats = propre(lue.ameliorations, lieu);
    if (!Array.isArray(achats)) continue;
    for (const id of new Set(achats)) rendu += propre(prix, id) || 0;
  }
  return rendu;
}

// Complète une partie lue sur disque (champ manquant, type inattendu, partie de la version 1).
function normaliser(lue, horodatage) {
  const p = nouvellePartie(horodatage);
  if (!estObjet(lue)) return p;
  if (lue.version === 1 && estObjet(lue.ameliorations)) {
    // Les lieux ont changé : les points dépensés en version 1 reviennent dans le solde.
    lue = { ...lue, points: (Number.isFinite(lue.points) ? lue.points : 0) + rembourserV1(lue), ameliorations: {} };
  }
  if (typeof lue.cree_le === "string") p.cree_le = lue.cree_le;
  p.accueil_vu = lue.accueil_vu === true;
  // Une partie d'une version précédente qui a déjà servi garde toutes ses fonctions ouvertes.
  const ancienne = lue.version === 1 || lue.version === 2;
  p.assistant_fait = lue.assistant_fait === true;
  p.tout_ouvert = lue.tout_ouvert === true || (ancienne && estObjet(lue.paiements) && Object.keys(lue.paiements).length > 0);
  if (P.dateValide(lue.derniere_visite)) p.derniere_visite = lue.derniere_visite;
  if (Array.isArray(lue.retours)) p.retours = lue.retours.filter(P.dateValide).slice(-200);
  for (const champ of ["contrats", "degres", "types_forces", "reportees", "arrosages", "equipe", "traits", "semaines", "efforts", "deblocages_vus", "avant_jeu"]) {
    if (estObjet(lue[champ])) p[champ] = lue[champ];
  }
  if (Array.isArray(lue.journal)) p.journal = lue.journal.filter(estObjet).slice(-600);
  if (estObjet(lue.arrosage) && typeof lue.arrosage.jusqua === "string") p.arrosage = { jusqua: lue.arrosage.jusqua };
  if (Number.isInteger(lue.niveau_fete) && lue.niveau_fete >= 1) p.niveau_fete = lue.niveau_fete;
  if (Number.isFinite(lue.points)) p.points = Math.max(0, Math.round(lue.points));
  if (Number.isFinite(lue.total_gagne)) p.total_gagne = Math.max(0, Math.round(lue.total_gagne));
  for (const champ of ["caps", "ameliorations", "paiements", "bonus_jours", "gestes", "ventes_forcees", "placements", "objets", "colis", "en_cours", "badges", "jalons_fetes"]) {
    if (estObjet(lue[champ])) p[champ] = lue[champ];
  }
  if (Array.isArray(lue.etats)) p.etats = lue.etats.filter(estObjet);
  if (Array.isArray(lue.jours_actifs)) p.jours_actifs = [...new Set(lue.jours_actifs.filter(P.dateValide))].sort();
  if (estObjet(lue.serie) && Number.isFinite(lue.serie.record)) p.serie.record = Math.max(0, Math.round(lue.serie.record));
  if (Array.isArray(lue.historique)) p.historique = lue.historique.filter(estObjet).slice(-MAX_HISTORIQUE);
  p.avatar = normaliserAvatar(lue.avatar);
  // Version 4 : le Système. Une partie de la version 3 n'en a pas : elle le reçoit, sans rien perdre.
  p.systeme = S.normaliser(lue.systeme);
  // Version 6 : énergie du jour et coût de chaque quête.
  const energiePartie = E.normaliserPartie(lue);
  p.energies = energiePartie.energies;
  p.couts_energie = energiePartie.couts_energie;
  return p;
}

function nomFichier(simulation) {
  return simulation ? FICHIER_TEST : FICHIER_PARTIE;
}

function nomRegistre(simulation) {
  return simulation ? FICHIER_ENCAISSEMENTS_TEST : FICHIER_ENCAISSEMENTS;
}

// Lit un fichier de données. Fichier abîmé : mis de côté, avertissement.
function lireOuMettreDeCote(nom, horloge, quoi) {
  try {
    return { lu: garde.lireDonnees(nom), avertissement: null };
  } catch (e) {
    if (!(e instanceof ErreurJeu) || e.code !== "DONNEES_ILLISIBLES") throw e;
    const tampon = horloge.horodatage.replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    const deCote = nom.replace(/\.json$/, "") + "-illisible-" + tampon + ".json";
    garde.mettreDeCote(nom, deCote);
    return { lu: null, avertissement: quoi + " (" + deCote + ")" };
  }
}

// Charge la partie et le registre des encaissements.
function charger(simulation, horloge) {
  const avertissements = [];
  const a = lireOuMettreDeCote(nomFichier(simulation), horloge, "Ta partie était illisible. Je l'ai mise de côté et j'en ai créé une neuve");
  if (a.avertissement) avertissements.push(a.avertissement + ".");
  const partie = normaliser(a.lu, horloge.horodatage);
  if (a.lu === null) garde.ecrireDonnees(nomFichier(simulation), partie);
  const b = lireOuMettreDeCote(nomRegistre(simulation), horloge, "Ton registre d'encaissements était illisible. Je l'ai mis de côté");
  if (b.avertissement) avertissements.push(b.avertissement + ".");
  const registre = encaissements.normaliserRegistre(b.lu);
  return { partie, registre, avertissements, neuve: a.lu === null };
}

function borner(partie) {
  if (partie.historique.length > MAX_HISTORIQUE) partie.historique = partie.historique.slice(-MAX_HISTORIQUE);
  if (partie.etats.length > MAX_ETATS) partie.etats = partie.etats.slice(-MAX_ETATS);
}

// ---------------------------------------------------------------- série

function serieCourante(jours, dateISO) {
  const actifs = new Set(jours);
  let d = actifs.has(dateISO) ? dateISO : P.ajouterJours(dateISO, -1);
  let n = 0;
  while (actifs.has(d)) {
    n++;
    d = P.ajouterJours(d, -1);
  }
  return n;
}

function plusLongueSerie(jours) {
  const tries = [...new Set(jours)].sort();
  let max = 0;
  let courant = 0;
  let precedent = null;
  for (const d of tries) {
    courant = precedent && P.ajouterJours(precedent, 1) === d ? courant + 1 : 1;
    if (courant > max) max = courant;
    precedent = d;
  }
  return max;
}

function marquerJourActif(partie, dateISO) {
  if (!partie.jours_actifs.includes(dateISO)) {
    partie.jours_actifs.push(dateISO);
    partie.jours_actifs.sort();
  }
  partie.serie.record = Math.max(partie.serie.record || 0, plusLongueSerie(partie.jours_actifs));
}

// Les plantes ne fanent plus (règle 5). Le champ reste pour l'affichage : il dit seulement depuis quand.
function etatPlantes(partie, dateISO) {
  const passes = partie.jours_actifs.filter((d) => d <= dateISO);
  const dernier = passes.length ? passes[passes.length - 1] : String(partie.cree_le).slice(0, 10);
  const jours = P.dateValide(dernier) ? Math.max(0, Math.round((new Date(dateISO + "T00:00:00Z") - new Date(dernier + "T00:00:00Z")) / 86400000)) : 0;
  return { fanees: false, jours_sans_quete: jours };
}

// ---------------------------------------------------------------- lieux

function lieuCourant(partie, config) {
  let index = 0;
  for (const cap of config.caps) {
    if (!cap.lieu || !partie.caps[cap.id]) continue;
    const i = catalogue.indexLieu(cap.lieu);
    if (i > index) index = i;
  }
  return catalogue.LIEUX[index];
}

function lieuOuvert(partie, config, lieuId) {
  const i = catalogue.indexLieu(lieuId);
  return i !== -1 && i <= catalogue.indexLieu(lieuCourant(partie, config).id);
}

function possede(partie, lieuId, id) {
  return Array.isArray(partie.ameliorations[lieuId]) && partie.ameliorations[lieuId].includes(id);
}

// ---------------------------------------------------------------- paiements

function historiser(partie, ctx, type, libelle, points) {
  partie.historique.push({ quand: ctx.horodatage, type, libelle, points });
}

function venteEffective(partie, element, config) {
  return R.typeDe(partie, element, config) === "vente";
}

function nomAgent(config, id) {
  return id && config.agents[id] ? config.agents[id].nom : null;
}

// Le fichier des quêtes du jeu vient de changer : on le relit pour garder les numéros de ligne justes.
function majFichierQuetes(ctx, lu, texte) {
  ctx.texteQuetes = texte;
  ctx.quetesModifiees = true;
  const relu = Q.lire(texte, ctx.config.mots_vente, ctx.config.mots_newsletter);
  lu.quetes = [...lu.quetes.filter((q) => q.origine !== "locale"), ...relu.quetes];
}

// Paie une quête ou une priorité, une seule fois. Renvoie la liste des gains (vide si déjà payée).
// degre : 1, 2 ou 3. Absent : le degré par défaut (case cochée hors du jeu).
function payer(partie, lu, element, type, source, ctx, jour, degre) {
  if (partie.paiements[element.id]) return [];
  const calcul = R.calculerGain(partie, element, type, degre, ctx);
  const agent = partie.en_cours[element.id] || null;
  const premiere = !R.aJoue(partie);
  const paiement = {
    type,
    points: calcul.points,
    vente: calcul.vente,
    source,
    date: ctx.date,
    heure: ctx.heure,
    semaine: ctx.semaine,
    texte: element.texte,
    type_quete: calcul.type_quete,
    mode: calcul.mode,
    degre: calcul.degre,
  };
  if (calcul.mode === "payee" && calcul.taux !== 100) paiement.taux = calcul.taux;
  if (calcul.arrosage) paiement.arrosage = true;
  if (agent) paiement.agent = agent;
  if (element.newsletter) paiement.newsletter = true;
  if (jour) paiement.jour = jour;
  delete partie.en_cours[element.id];
  partie.paiements[element.id] = paiement;
  partie.points += calcul.points;
  partie.total_gagne += calcul.points;
  marquerJourActif(partie, ctx.date);
  historiser(partie, ctx, type, element.texte, calcul.points);
  const gain = {
    type,
    id: element.id,
    libelle: element.texte,
    points: calcul.points,
    vente: calcul.vente,
    newsletter: element.newsletter === true,
    agent,
    type_quete: calcul.type_quete,
    mode: calcul.mode,
    degre: calcul.degre,
    taux: calcul.taux,
    arrosage: calcul.arrosage,
  };
  if (calcul.mode === "racontee") {
    gain.recit = R.recit(calcul.type_quete, element.texte, nomAgent(ctx.config, agent), calcul.degre, element.id);
    R.noter(partie, ctx, "recit", gain.recit, { type_quete: calcul.type_quete, degre: calcul.degre });
  } else if (calcul.taux === 0) {
    gain.recit = "Plafond du jour atteint : « " + element.texte + " » est faite, et elle entre au journal.";
    R.noter(partie, ctx, "plafond", gain.recit);
  }
  const gains = [gain];
  // La case du fichier du jeu suit le geste du joueur.
  if (source === "jeu" && element.origine === "locale" && typeof ctx.texteQuetes === "string") {
    const coche = Q.cocher(ctx.texteQuetes, element, true);
    if (coche !== null) majFichierQuetes(ctx, lu, coche);
  }
  // Première quête de la partie : un meuble apparaît.
  if (premiere && ctx.config.deblocages.actif && !possede(partie, CADEAU_PREMIERE_QUETE.lieu, CADEAU_PREMIERE_QUETE.id)) {
    const cadeau = catalogue.trouverAmelioration(CADEAU_PREMIERE_QUETE.lieu, CADEAU_PREMIERE_QUETE.id);
    if (!Array.isArray(partie.ameliorations[CADEAU_PREMIERE_QUETE.lieu])) partie.ameliorations[CADEAU_PREMIERE_QUETE.lieu] = [];
    partie.ameliorations[CADEAU_PREMIERE_QUETE.lieu].push(CADEAU_PREMIERE_QUETE.id);
    R.noter(partie, ctx, "debut", "Première quête faite : « " + element.texte + " ». Une plante verte arrive dans le studio. L'histoire de l'immeuble commence ici.");
    gains.push({ type: "cadeau", id: CADEAU_PREMIERE_QUETE.lieu + "/" + CADEAU_PREMIERE_QUETE.id, libelle: cadeau.nom, points: 0, vente: false });
  }
  R.apresQuete(partie, ctx, element.id, paiement, gains);
  S.apresQuete(partie, ctx, element.id, paiement);
  return gains;
}

// Bonus du jour : toutes les priorités d'un jour du tableau sont payées.
function payerBonus(partie, jour, ctx) {
  if (!jour || jour.priorites.length === 0 || partie.bonus_jours[jour.date]) return null;
  if (!jour.priorites.every((p) => partie.paiements[p.id])) return null;
  const points = ctx.config.points.bonus_jour;
  if (!points) return null;
  partie.bonus_jours[jour.date] = { points, heure: ctx.heure, paye_le: ctx.date };
  partie.points += points;
  partie.total_gagne += points;
  const libelle = "Journée complète : " + jour.libelle;
  historiser(partie, ctx, "bonus", libelle, points);
  return { type: "bonus", id: "B-" + jour.date, libelle, points, vente: false };
}

// Paie toute quête cochée dans la note (ou dans le fichier du jeu) et pas encore payée.
function synchroniser(partie, lu, ctx) {
  const gains = [];
  for (const quete of [...lu.quetes]) {
    if (!quete.cochee || partie.avant_jeu[quete.id]) continue;
    gains.push(...payer(partie, lu, quete, "ligne", "note", ctx));
  }
  return gains;
}

function trouverPriorite(lu, id) {
  for (const jour of lu.jours) {
    const priorite = jour.priorites.find((p) => p.id === id);
    if (priorite) return { jour, priorite };
  }
  return null;
}

function trouverElement(lu, id) {
  return lu.quetes.find((q) => q.id === id) || (trouverPriorite(lu, id) || {}).priorite || null;
}

function inconnu(quoi) {
  return new ErreurJeu("INCONNU", "Je ne trouve pas " + quoi + ".");
}

// Clé de rangement : "lieu/amelioration" ou "deco/objet". Renvoie l'objet du catalogue, ou null.
function objetRangeable(partie, cle) {
  const m = /^([a-z0-9-]+)\/([a-z0-9-]+)$/.exec(String(cle));
  if (!m) return null;
  if (m[1] === "deco") {
    const deco = catalogue.trouverDeco(m[2]);
    return deco && partie.objets[deco.id] ? deco : null;
  }
  const amelioration = catalogue.trouverAmelioration(m[1], m[2]);
  return amelioration && amelioration.type === "objet" && possede(partie, m[1], m[2]) ? amelioration : null;
}

function nouvelId(registre) {
  for (;;) {
    const id = "E-" + crypto.randomBytes(5).toString("hex");
    if (!registre.encaissements.some((e) => e.id === id)) return id;
  }
}

function libelleEncaissement(e, config) {
  return e.source + " : " + encaissements.formaterEuros(e.montant, config.monnaie);
}

function degreLu(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" || (typeof v === "string" && /^[123]$/.test(v.trim())) ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 3) throw new ErreurJeu("REQUETE_INVALIDE", "Le degré vaut 1, 2 ou 3.");
  return n;
}

function texteCourt(v, max, quoi) {
  if (typeof v !== "string") throw new ErreurJeu("REQUETE_INVALIDE", quoi + " : un texte est attendu.");
  const t = v.normalize("NFC").replace(/\s+/g, " ").trim();
  if (t === "" || t.length > max) throw new ErreurJeu("REQUETE_INVALIDE", quoi + " : entre 1 et " + max + " caractères.");
  return t;
}

// Les quêtes ouvertes du jour, dans l'ordre où le jeu les montre : priorités d'aujourd'hui,
// quêtes du jeu (les plus récentes d'abord), puis lignes de la note. Celles remises à plus tard passent au bout.
function ouvertesDuJour(partie, lu, ctx) {
  const config = ctx.config;
  const liste = [];
  const ajouter = (element, genre) => {
    if (partie.paiements[element.id] || partie.avant_jeu[element.id]) return;
    const typeQuete = R.typeDe(partie, element, config);
    liste.push({ id: element.id, texte: element.texte, genre, type_quete: typeQuete, mode: config.types[typeQuete].mode });
  };
  const jour = lu.jours.find((j) => j.date === ctx.date);
  if (jour) for (const p of jour.priorites) ajouter(p, "priorite");
  const locales = lu.quetes.filter((q) => q.origine === "locale");
  const groupes = [];
  for (const q of locales) if (!groupes.includes(q.groupe)) groupes.push(q.groupe);
  for (const g of groupes.reverse()) for (const q of locales.filter((x) => x.groupe === g)) ajouter(q, "ligne");
  const note = lu.quetes.filter((q) => q.origine !== "locale");
  for (const q of [...note.filter((x) => R.typeDe(partie, x, config) === "vente"), ...note.filter((x) => R.typeDe(partie, x, config) !== "vente")]) ajouter(q, "ligne");
  const reportees = Array.isArray(partie.reportees[ctx.date]) ? partie.reportees[ctx.date] : [];
  const k = partie.contrats[ctx.date];
  const epinglees = k && k.statut === "en_cours" ? R.idsContrat(k) : [];
  const rang = (q) => (epinglees.includes(q.id) ? 0 : reportees.includes(q.id) ? 2 : 1);
  return liste.map((q, i) => ({ q, i })).sort((a, b) => rang(a.q) - rang(b.q) || a.i - b.i).map((x) => x.q);
}

const ACTIONS = {
  // Version 4 : tous les gestes du Système (habitudes, quotidiennes, donjons, objets, studio...).
  systeme(partie, lu, ctx, { chemin, corps }) {
    S.agir(partie, ctx, chemin, corps);
    return [];
  },

  validerQuete(partie, lu, ctx, { id, degre }) {
    const quete = lu.quetes.find((q) => q.id === id);
    if (!quete) throw inconnu("cette quête dans ta liste");
    if (partie.paiements[id]) throw new ErreurJeu("DEJA_PAYE", "Cette quête est déjà payée.");
    return payer(partie, lu, quete, "ligne", "jeu", ctx, null, degreLu(degre));
  },

  validerPriorite(partie, lu, ctx, { id, degre }) {
    const trouve = trouverPriorite(lu, id);
    if (!trouve) throw inconnu("cette priorité dans ton plan jour par jour");
    if (trouve.jour.date > ctx.date) throw new ErreurJeu("JOUR_FUTUR", "Ce jour n'est pas encore arrivé.");
    if (partie.paiements[id]) throw new ErreurJeu("DEJA_PAYE", "Cette priorité est déjà payée.");
    const gains = payer(partie, lu, trouve.priorite, "priorite", "jeu", ctx, trouve.jour.date, degreLu(degre));
    const bonus = payerBonus(partie, trouve.jour, ctx);
    if (bonus) gains.push(bonus);
    return gains;
  },

  annuler(partie, lu, ctx, { id }) {
    const paiement = propre(partie.paiements, id);
    if (!paiement) throw inconnu("ce paiement");
    if (paiement.source !== "jeu" || paiement.date !== ctx.date) {
      throw new ErreurJeu("NON_ANNULABLE", "Seul un clic du jour même peut être annulé.");
    }
    const k = partie.contrats[ctx.date];
    if (k && k.statut === "tenu" && R.idsContrat(k).includes(id)) {
      throw new ErreurJeu("NON_ANNULABLE", "Cette quête a servi à tenir ton contrat du jour. Elle reste faite.");
    }
    let retrait = paiement.points;
    const bonus = paiement.type === "priorite" && paiement.jour ? partie.bonus_jours[paiement.jour] : null;
    if (bonus) retrait += bonus.points;
    if (partie.points - retrait < 0) {
      throw new ErreurJeu("POINTS_DEPENSES", "Tu as déjà dépensé ces points. L'annulation n'est plus possible.");
    }
    const element = lu.quetes.find((q) => q.id === id);
    if (element && element.origine === "locale" && element.cochee && typeof ctx.texteQuetes === "string") {
      const decoche = Q.cocher(ctx.texteQuetes, element, false);
      if (decoche === null) throw new ErreurJeu("NON_ANNULABLE", "Décoche d'abord cette case dans data/quetes.md.");
      majFichierQuetes(ctx, lu, decoche);
    }
    delete partie.paiements[id];
    // l'agent qui accompagnait reprend sa place sur la quête, s'il est toujours libre
    if (paiement.agent && catalogue.trouverAgent(paiement.agent) && !Object.values(partie.en_cours).includes(paiement.agent)) partie.en_cours[id] = paiement.agent;
    if (bonus) delete partie.bonus_jours[paiement.jour];
    partie.points -= retrait;
    partie.total_gagne = Math.max(0, partie.total_gagne - retrait);
    const resteAujourdhui = Object.values(partie.paiements).some((p) => p.date === ctx.date);
    if (!resteAujourdhui) partie.jours_actifs = partie.jours_actifs.filter((d) => d !== ctx.date);
    partie.serie.record = plusLongueSerie(partie.jours_actifs);
    historiser(partie, ctx, "annulation", paiement.texte, -retrait);
    return [];
  },

  forcerVente(partie, lu, ctx, { id, vente }) {
    const element = trouverElement(lu, id);
    if (!element) throw inconnu("cette quête");
    if (partie.paiements[id]) throw new ErreurJeu("DEJA_PAYE", "Cette quête est déjà payée, sa pastille ne change plus.");
    delete partie.types_forces[id];
    if (vente === element.vente_auto) delete partie.ventes_forcees[id];
    else partie.ventes_forcees[id] = vente;
    return [];
  },

  // Le joueur corrige le type deviné : administratif, vente, création, relations, santé.
  changerType(partie, lu, ctx, { id, type }) {
    const element = trouverElement(lu, id);
    if (!element) throw inconnu("cette quête");
    if (partie.paiements[id]) throw new ErreurJeu("DEJA_PAYE", "Cette quête est déjà faite, son type ne change plus.");
    if (!configuration.ORDRE_TYPES.includes(type)) throw new ErreurJeu("REQUETE_INVALIDE", "Type inconnu.");
    delete partie.ventes_forcees[id];
    if (R.typeAuto(element, ctx.config) === type) delete partie.types_forces[id];
    else partie.types_forces[id] = type;
    return [];
  },

  // Les trois degrés de réussite, fixés avant de commencer.
  definirDegres(partie, lu, ctx, { id, degres }) {
    const element = trouverElement(lu, id);
    if (!element) throw inconnu("cette quête");
    if (partie.paiements[id]) throw new ErreurJeu("DEJA_PAYE", "Cette quête est déjà faite : ses degrés étaient fixés à l'avance.");
    if (!Array.isArray(degres) || degres.length !== 3) throw new ErreurJeu("REQUETE_INVALIDE", "Il faut trois degrés.");
    const propres = degres.map((d) => (typeof d === "string" ? d.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 120) : ""));
    if (propres.every((d) => d === "")) delete partie.degres[id];
    else partie.degres[id] = propres;
    return [];
  },

  // « Pas aujourd'hui » : la quête passe au bout de la liste du jour. Rien n'est perdu.
  reporter(partie, lu, ctx, { id }) {
    const element = trouverElement(lu, id);
    if (!element) throw inconnu("cette quête");
    const k = partie.contrats[ctx.date];
    if (k && k.statut === "en_cours" && R.idsContrat(k).includes(id)) throw new ErreurJeu("NON_ANNULABLE", "Cette quête fait partie de ton contrat du jour.");
    for (const date of Object.keys(partie.reportees)) if (date !== ctx.date) delete partie.reportees[date];
    const liste = Array.isArray(partie.reportees[ctx.date]) ? partie.reportees[ctx.date] : (partie.reportees[ctx.date] = []);
    const i = liste.indexOf(id);
    if (i === -1) liste.push(id);
    else liste.splice(i, 1);
    return [];
  },

  // Le joueur écrit une tâche dans le jeu : elle va dans data/quetes.md.
  ajouterQuete(partie, lu, ctx, { texte, type, degres, cout_energie }) {
    // Un mot précédé d'une arobase en fin de ligne serait lu comme un type : l'arobase tombe, le mot reste.
    // Une adresse de courriel, elle, est gardée telle quelle.
    const propreTexte = texteCourt(texte, 160, "La quête").replace(/\s+@+(?=[\p{L}]*\s*$)/u, " ").trim();
    if (propreTexte === "") throw new ErreurJeu("REQUETE_INVALIDE", "La quête : entre 1 et 160 caractères.");
    if (type !== undefined && type !== null && type !== "" && !configuration.ORDRE_TYPES.includes(type)) throw new ErreurJeu("REQUETE_INVALIDE", "Type inconnu.");
    const lesDegres = Array.isArray(degres) && degres.length === 3 ? degres.map((d) => (typeof d === "string" ? d.replace(/\s+/g, " ").trim().slice(0, 120) : "")) : null;
    if (lu.quetes.filter((q) => q.origine === "locale").length >= 400) throw new ErreurJeu("REQUETE_INVALIDE", "Le fichier des quêtes est plein. Fais un peu de ménage dans data/quetes.md.");
    const titre = "Écrites le " + ctx.date;
    const avant = new Set(lu.quetes.map((q) => q.id));
    const cout = E.coutValide(cout_energie);
    majFichierQuetes(ctx, lu, Q.ajouter(ctx.texteQuetes, { texte: propreTexte, type: type || null, degres: lesDegres, cout_energie: cout }, titre));
    const nouvelle = lu.quetes.find((q) => q.origine === "locale" && !avant.has(q.id));
    if (nouvelle && cout) E.poserCout(partie, nouvelle.id, cout);
    return nouvelle ? [{ type: "quete-ajoutee", id: nouvelle.id, libelle: nouvelle.texte, points: 0, vente: false }] : [];
  },

  retirerQuete(partie, lu, ctx, { id }) {
    const element = lu.quetes.find((q) => q.id === id && q.origine === "locale");
    if (!element) throw inconnu("cette quête dans le fichier du jeu");
    if (partie.paiements[id]) throw new ErreurJeu("DEJA_PAYE", "Cette quête est faite : elle reste dans ton histoire.");
    const k = partie.contrats[ctx.date];
    if (k && k.statut === "en_cours" && R.idsContrat(k).includes(id)) throw new ErreurJeu("NON_ANNULABLE", "Cette quête fait partie de ton contrat du jour.");
    const texte = Q.retirer(ctx.texteQuetes, element);
    if (texte === null) throw inconnu("cette ligne dans data/quetes.md");
    majFichierQuetes(ctx, lu, texte);
    delete partie.en_cours[id];
    delete partie.degres[id];
    delete partie.types_forces[id];
    if (partie.couts_energie) delete partie.couts_energie[id];
    return [];
  },

  // Le contrat du jour : « sur », « ambitieux », ou « aucun ». Une fois signé, il ne se change plus.
  signerContrat(partie, lu, ctx, { choix, heure }) {
    if (!ctx.config.contrat.actif) throw new ErreurJeu("INCONNU", "Le contrat du jour est coupé dans tes réglages.");
    if (!["sur", "ambitieux", "aucun"].includes(choix)) throw new ErreurJeu("REQUETE_INVALIDE", "Choisis le contrat sûr, le contrat ambitieux, ou aucun.");
    if (partie.contrats[ctx.date]) throw new ErreurJeu("DEJA_PAYE", "Ton choix du jour est déjà fait. Demain, nouveau contrat.");
    const k = R.signer(partie, ouvertesDuJour(partie, lu, ctx), ctx, choix, heure);
    if (!k) throw new ErreurJeu("INCONNU", "Il faut au moins une quête ouverte pour signer un contrat.");
    // un contrat de plus de trente jours ne sert plus qu'aux comptes : on allège
    for (const date of Object.keys(partie.contrats)) {
      if (date < P.ajouterJours(ctx.date, -400)) delete partie.contrats[date];
    }
    return k.choix === "aucun" ? [] : [{ type: "contrat-signe", id: "K-" + ctx.date, libelle: k.choix === "ambitieux" ? "Contrat ambitieux signé" : "Contrat sûr signé", points: -(k.mise || 0), vente: false, choix: k.choix, mise: k.mise || 0 }];
  },

  // Arroser les plantes : un bonus temporaire sur les quêtes payées. Une fois par jour.
  arroser(partie, lu, ctx) {
    if (partie.arrosages[ctx.date]) throw new ErreurJeu("DEJA_PAYE", "Tes plantes sont déjà arrosées aujourd'hui.");
    const a = ctx.config.arrosage;
    partie.arrosages[ctx.date] = ctx.heure;
    partie.arrosage = { jusqua: R.ajouterHeures(ctx.date, ctx.heure, a.duree_h) };
    const jours = Object.keys(partie.arrosages).sort();
    if (jours.length > 800) for (const d of jours.slice(0, jours.length - 800)) delete partie.arrosages[d];
    R.noter(partie, ctx, "arrosage", "Plantes arrosées. Pendant " + a.duree_h + " h, tes quêtes payées rapportent " + a.bonus_pourcent + " % de plus.");
    return [{ type: "arrosage", id: "A-" + ctx.date, libelle: "Plantes arrosées", points: 0, vente: false, bonus_pourcent: a.bonus_pourcent, duree_h: a.duree_h, jusqua: partie.arrosage.jusqua.slice(11, 16) }];
  },

  // Le but d'équipe de la semaine, écrit par le joueur.
  definirBut(partie, lu, ctx, { libelle }) {
    const e = R.equipeDe(partie, R.semaineDe(ctx.date), ctx.config);
    const texte = texteCourt(libelle, 80, "Le but d'équipe");
    if (e.libelle === texte) return [];
    e.libelle = texte;
    R.noter(partie, ctx, "equipe", "Nouveau but d'équipe pour la semaine : « " + texte + " ».");
    return [];
  },

  // La revue de la semaine : trois chiffres, une leçon, une récompense connue à l'avance.
  cloturerSemaine(partie, lu, ctx, { mot }) {
    const vue = R.vueDimanche(partie, ctx.registre, ctx);
    if (!vue.disponible) throw new ErreurJeu("INCONNU", vue.faite ? "La revue de cette semaine est déjà faite." : "La revue de la semaine s'ouvre " + vue.nom_jour + ".");
    const note = typeof mot === "string" ? mot.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 240) : "";
    const recompense = ctx.config.dimanche.recompense;
    partie.semaines[vue.semaine] = { cloturee_le: ctx.date, chiffres: vue.bilan.chiffres, lecon: vue.bilan.lecon, moteur: vue.bilan.moteur, mot: note };
    partie.points += recompense;
    partie.total_gagne += recompense;
    historiser(partie, ctx, "dimanche", "Revue de la semaine " + vue.semaine, recompense);
    R.noter(partie, ctx, "dimanche", "Revue de la semaine " + vue.semaine + " : " + R.pluriel(vue.bilan.chiffres.quetes, "quête", "quêtes") + ", " + vue.bilan.chiffres.points + " points, " + vue.bilan.chiffres.crans + " crans du but d'équipe. Un fanion de plus sur le toit." + (note ? " Ce que tu retiens : « " + note + " »." : ""));
    return [{ type: "dimanche", id: "D-" + vue.semaine, libelle: "Revue de la semaine", points: recompense, vente: false, semaine: vue.semaine, bilan: vue.bilan, fanions: Object.keys(partie.semaines).length }];
  },

  // Réglages : un changement à la fois, validé, gardé dans data/reglages.json.
  reglage(partie, lu, ctx, { chemin, valeur }) {
    ctx.patch = reglages.changer(ctx.base, ctx.patch, chemin, valeur);
    ctx.patchModifie = true;
    return [];
  },

  reglageDefaut(partie, lu, ctx, { chemin }) {
    if (!reglages.trouverChamp(ctx.config, chemin)) throw inconnu("ce réglage");
    ctx.patch = reglages.retirer(ctx.patch, chemin);
    ctx.patchModifie = true;
    return [];
  },

  reglagesDefaut(partie, lu, ctx) {
    ctx.patch = {};
    ctx.patchModifie = true;
    return [];
  },

  ouvrirTout(partie, lu, ctx, { oui }) {
    partie.tout_ouvert = oui !== false;
    return [];
  },

  // L'assistant de premier lancement : il demande les objectifs, après la première quête.
  assistant(partie, lu, ctx, corps) {
    let patch = ctx.patch;
    for (const chemin of ["joueur", "enseigne", "monnaie", "objectif_mensuel"]) {
      const v = corps[chemin];
      if (v === undefined || v === null || v === "") continue;
      patch = reglages.changer(ctx.base, patch, chemin, v);
    }
    ctx.patch = patch;
    ctx.patchModifie = true;
    const apres = configuration.effective(ctx.base, patch);
    if (typeof corps.but === "string" && corps.but.trim() !== "") {
      R.equipeDe(partie, R.semaineDe(ctx.date), apres).libelle = texteCourt(corps.but, 80, "Le but d'équipe");
    }
    if (corps.rythme === "tout") partie.tout_ouvert = true;
    else if (corps.rythme === "pas_a_pas") partie.tout_ouvert = false;
    if (!partie.assistant_fait) {
      R.noter(partie, ctx, "debut", (apres.joueur ? apres.joueur + ", l'" : "L'") + "immeuble « " + apres.enseigne + " » a maintenant un cap : " + configuration.formaterMontant(apres.objectif_mensuel, apres.monnaie) + " par mois.");
    }
    partie.assistant_fait = true;
    partie.accueil_vu = true;
    return [];
  },

  // Tu choisis l'agent qui t'accompagne sur une quête. Il ne fait rien à ta place.
  confier(partie, lu, ctx, { id, agent }) {
    const element = trouverElement(lu, id);
    if (!element) throw inconnu("cette quête");
    if (partie.paiements[id]) throw new ErreurJeu("DEJA_PAYE", "Cette quête est déjà payée.");
    if (agent === null || agent === undefined || agent === "") {
      delete partie.en_cours[id];
      return [];
    }
    const trouve = catalogue.trouverAgent(agent);
    if (!trouve || !lieuOuvert(partie, ctx.config, trouve.lieu)) throw inconnu("cet agent dans ton immeuble");
    for (const autre of Object.keys(partie.en_cours)) {
      if (partie.en_cours[autre] === trouve.id) delete partie.en_cours[autre];
    }
    partie.en_cours[id] = trouve.id;
    return [];
  },

  noterEtat(partie, lu, ctx, { titre }) {
    const etat = lu.strategies.etats.find((e) => e.titre === titre);
    if (!etat) throw inconnu("cet état dans ton intention");
    partie.etats.push({ date: ctx.date, heure: ctx.heure, etat: etat.titre });
    return [];
  },

  cocherGeste(partie, lu, ctx, { id }) {
    let geste = null;
    for (const etat of lu.strategies.etats) {
      geste = etat.gestes.find((g) => g.id === id) || geste;
    }
    if (!geste) throw inconnu("ce geste dans ton intention");
    const duJour = partie.gestes[ctx.date] || (partie.gestes[ctx.date] = {});
    if (duJour[id]) throw new ErreurJeu("DEJA_PAYE", "Ce geste est déjà compté aujourd'hui.");
    const points = ctx.config.points.geste;
    duJour[id] = { points, heure: ctx.heure, nom: geste.nom };
    partie.points += points;
    partie.total_gagne += points;
    historiser(partie, ctx, "geste", geste.nom, points);
    return [{ type: "geste", id, libelle: geste.nom, points, vente: false }];
  },

  acheter(partie, lu, ctx, { lieu, id }) {
    const amelioration = catalogue.trouverAmelioration(lieu, id);
    if (!amelioration) throw inconnu("cette amélioration");
    if (!lieuOuvert(partie, ctx.config, lieu)) throw new ErreurJeu("LIEU_FERME", "Ce lieu n'est pas encore ouvert.");
    const achetees = Array.isArray(partie.ameliorations[lieu]) ? partie.ameliorations[lieu] : (partie.ameliorations[lieu] = []);
    if (achetees.includes(id)) throw new ErreurJeu("DEJA_ACHETE", "Tu as déjà cette amélioration.");
    const effort = ctx.config.caps_effort.find((c) => c.piece === lieu + "/" + id);
    if (effort) throw new ErreurJeu("PAR_EFFORT", "Celle-ci ne s'achète pas : elle s'ouvre avec un effort (" + effort.libelle + ").");
    if (partie.points < amelioration.prix) {
      throw new ErreurJeu("POINTS_INSUFFISANTS", "Il te manque " + (amelioration.prix - partie.points) + " points.");
    }
    partie.points -= amelioration.prix;
    achetees.push(id);
    historiser(partie, ctx, "achat", amelioration.nom, -amelioration.prix);
    return [{ type: "achat", id: lieu + "/" + id, libelle: amelioration.nom, points: -amelioration.prix, vente: false }];
  },

  // Objet du jour : en boutique seulement aujourd'hui.
  acheterDeco(partie, lu, ctx, { id }) {
    const deco = catalogue.trouverDeco(id);
    if (!deco || !catalogue.objetsDuJour(ctx.date).includes(id)) throw inconnu("cet objet dans la boutique du jour");
    if (partie.objets[id]) throw new ErreurJeu("DEJA_ACHETE", "Tu as déjà cet objet.");
    if (partie.points < deco.prix) {
      throw new ErreurJeu("POINTS_INSUFFISANTS", "Il te manque " + (deco.prix - partie.points) + " points.");
    }
    partie.points -= deco.prix;
    partie.objets[id] = { date: ctx.date, origine: "boutique" };
    historiser(partie, ctx, "achat", deco.nom, -deco.prix);
    return [{ type: "achat", id: "deco/" + id, libelle: deco.nom, points: -deco.prix, vente: false }];
  },

  // Rangement : tu poses un objet où tu veux, dans un lieu ouvert.
  placer(partie, lu, ctx, { cle, zone, x, defaut }) {
    if (!objetRangeable(partie, cle)) throw inconnu("cet objet parmi les tiens");
    if (defaut === true) {
      delete partie.placements[cle];
      return [];
    }
    const lieu = propre(catalogue.ZONES, zone);
    if (!lieu) throw inconnu("cet endroit dans l'immeuble");
    if (!lieuOuvert(partie, ctx.config, lieu)) throw new ErreurJeu("LIEU_FERME", "Ce lieu n'est pas encore ouvert.");
    if (!Number.isInteger(x) || x < 0 || x > 2000) throw new ErreurJeu("REQUETE_INVALIDE", "Position invalide.");
    partie.placements[cle] = { zone, x };
    return [];
  },

  changerAvatar(partie, lu, ctx, avatar) {
    const voulu = {};
    for (const [cle, valeur] of Object.entries(avatar || {})) if (valeur !== undefined) voulu[cle] = valeur;
    partie.avatar = normaliserAvatar({ ...partie.avatar, ...voulu });
    return [];
  },

  cocherCap(partie, lu, ctx, { id, date }) {
    const cap = ctx.config.caps.find((c) => c.id === id);
    if (!cap) throw inconnu("ce cap dans config.json");
    const jour = date === undefined || date === null || date === "" ? ctx.date : date;
    if (!P.dateValide(jour)) throw new ErreurJeu("DATE_INVALIDE", "La date doit être au format AAAA-MM-JJ.");
    const nouveau = !partie.caps[id];
    partie.caps[id] = { date: jour, coche_le: ctx.horodatage };
    if (nouveau) {
      historiser(partie, ctx, "cap", cap.libelle, 0);
      R.noter(partie, ctx, "cap", "Cap passé : " + cap.libelle + "." + (cap.lieu && ctx.config.lieux[cap.lieu] ? " Un nouvel étage s'ouvre : " + ctx.config.lieux[cap.lieu].nom + "." : ""));
    }
    return nouveau && cap.lieu && catalogue.indexLieu(cap.lieu) !== -1 ? [{ type: "cap", id, libelle: cap.libelle, points: 0, vente: false, lieu: cap.lieu }] : [];
  },

  decocherCap(partie, lu, ctx, { id }) {
    const cap = ctx.config.caps.find((c) => c.id === id);
    if (!cap || !partie.caps[id]) throw inconnu("ce cap parmi tes caps atteints");
    delete partie.caps[id];
    historiser(partie, ctx, "cap-corrige", cap.libelle, 0);
    return [];
  },

  // Encaissement déclaré par le joueur. Le jeu ne lit aucun compte : c'est toi qui dis.
  declarerEncaissement(partie, lu, ctx, corps) {
    const valide = encaissements.valider(corps, ctx.config, ctx.date);
    if (ctx.registre.encaissements.length >= encaissements.MAX_ENCAISSEMENTS) {
      throw new ErreurJeu("REQUETE_INVALIDE", "Le registre est plein.");
    }
    const e = { id: nouvelId(ctx.registre), ...valide, cree_le: ctx.horodatage };
    ctx.registre.encaissements.push(e);
    partie.colis[e.id] = { date: ctx.date, ouvert: false };
    const libelle = libelleEncaissement(e, ctx.config);
    historiser(partie, ctx, "encaissement", libelle, 0);
    R.noter(partie, ctx, "encaissement", "Encaissé : " + libelle + ". Un trophée sur l'étagère, un colis en route.");
    return [{ type: "encaissement", id: e.id, libelle, points: 0, vente: true, montant: e.montant, source: e.source }];
  },

  modifierEncaissement(partie, lu, ctx, corps) {
    const e = ctx.registre.encaissements.find((x) => x.id === corps.id);
    if (!e) throw inconnu("cet encaissement");
    const voulu = {
      montant: corps.montant === undefined ? e.montant : corps.montant,
      date: corps.date === undefined || corps.date === null || corps.date === "" ? e.date : corps.date,
      source: corps.source === undefined ? e.source : corps.source,
      note: corps.note === undefined ? e.note : corps.note,
    };
    Object.assign(e, encaissements.valider(voulu, ctx.config, ctx.date));
    historiser(partie, ctx, "encaissement-corrige", libelleEncaissement(e, ctx.config), 0);
    return [];
  },

  supprimerEncaissement(partie, lu, ctx, { id }) {
    const i = ctx.registre.encaissements.findIndex((x) => x.id === id);
    if (i === -1) throw inconnu("cet encaissement");
    const [e] = ctx.registre.encaissements.splice(i, 1);
    if (partie.colis[id] && !partie.colis[id].ouvert) delete partie.colis[id];
    historiser(partie, ctx, "encaissement-supprime", libelleEncaissement(e, ctx.config), 0);
    return [];
  },

  // Colis : un objet de la collection, parmi ceux que tu n'as pas. La collection se voit à l'avance.
  ouvrirColis(partie, lu, ctx, { id }) {
    const colis = propre(partie.colis, id);
    if (!colis) throw inconnu("ce colis");
    if (colis.ouvert) throw new ErreurJeu("DEJA_PAYE", "Ce colis est déjà ouvert.");
    const restants = catalogue.DECOS.filter((d) => !partie.objets[d.id]);
    colis.ouvert = true;
    colis.ouvert_le = ctx.date;
    if (restants.length === 0) {
      colis.points = POINTS_DOUBLON;
      partie.points += POINTS_DOUBLON;
      partie.total_gagne += POINTS_DOUBLON;
      historiser(partie, ctx, "colis", "Colis surprise", POINTS_DOUBLON);
      return [{ type: "colis", id, libelle: "Tu as déjà tous les objets.", points: POINTS_DOUBLON, vente: false, objet: null, possedes: catalogue.DECOS.length, total: catalogue.DECOS.length }];
    }
    const deco = restants[ctx.hasard(restants.length)];
    colis.objet = deco.id;
    partie.objets[deco.id] = { date: ctx.date, origine: "colis" };
    historiser(partie, ctx, "colis", deco.nom, 0);
    R.noter(partie, ctx, "colis", "Colis ouvert : " + deco.nom + ". " + deco.phrase + " Collection : " + Object.keys(partie.objets).length + " sur " + catalogue.DECOS.length + ".");
    return [{ type: "colis", id, libelle: deco.nom, points: 0, vente: false, objet: { id: deco.id, nom: deco.nom, pose: deco.pose, phrase: deco.phrase }, possedes: Object.keys(partie.objets).length, total: catalogue.DECOS.length }];
  },

  accueilVu(partie) {
    partie.accueil_vu = true;
    return [];
  },

  // Version 6 : énergie du jour, et coût d'une quête (de 1 à 5, à toi de le régler).
  choisirEnergie(partie, lu, ctx, { niveau }) {
    const conf = ctx.config.energie || E.completer();
    if (!conf.actif) throw new ErreurJeu("REQUETE_INVALIDE", "Le mode énergie est coupé dans les réglages.");
    const n = E.trouverNiveau(conf, niveau);
    if (!n) throw new ErreurJeu("REQUETE_INVALIDE", "Ce niveau d'énergie est inconnu.");
    E.choisir(partie, ctx.date, n, ctx.heure);
    return [{ type: "energie", id: "EN-" + ctx.date, libelle: n.titre, points: 0, vente: false, niveau: n.id, cout_max: n.cout_max }];
  },

  definirCoutEnergie(partie, lu, ctx, { id, cout }) {
    const element = trouverElement(lu, id);
    if (!element) throw inconnu("cette quête");
    const c = E.coutValide(cout);
    if (!c) throw new ErreurJeu("REQUETE_INVALIDE", "Le coût d'énergie va de 1 à 5.");
    E.poserCout(partie, id, c);
    return [];
  },
};

// ---------------------------------------------------------------- badges et jalons

function compter(objet, test) {
  return Object.values(objet).filter(test).length;
}

function listeBadges(partie, registre, config) {
  const paiements = Object.values(partie.paiements);
  const joues = partie.jours_actifs.length;
  const meilleur = encaissements.meilleurMois(registre.encaissements);
  const nbAchats = Object.values(partie.ameliorations).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
  const nbGestes = Object.values(partie.gestes).reduce((n, j) => n + Object.keys(j).length, 0);
  const courant = catalogue.indexLieu(lieuCourant(partie, config).id);
  const contrats = Object.values(partie.contrats).filter(Boolean);
  const badges = [
    { id: "premier-pas", nom: "Premier pas", description: "Ta première quête faite.", obtenu: paiements.length >= 1 },
    { id: "journee-complete", nom: "Journée complète", description: "Toutes les priorités d'un jour.", obtenu: Object.keys(partie.bonus_jours).length >= 1 },
    { id: "jours-3", nom: "Trois jours joués", description: "Trois jours avec une quête, d'affilée ou non.", obtenu: joues >= 3 },
    { id: "jours-7", nom: "Sept jours joués", description: "Sept jours avec une quête. Les pauses ne comptent pas contre toi.", obtenu: joues >= 7 },
    { id: "jours-30", nom: "Trente jours joués", description: "Trente jours avec une quête, à ton rythme.", obtenu: joues >= 30 },
    { id: "contrat", nom: "Parole tenue", description: "Ton premier contrat du jour tenu.", obtenu: contrats.some((k) => k.statut === "tenu") },
    { id: "ambitieux", nom: "Goût du risque", description: "Trois contrats ambitieux tenus.", obtenu: contrats.filter((k) => k.choix === "ambitieux" && k.statut === "tenu").length >= 3 },
    { id: "conteur", nom: "Dix lignes au journal", description: "Dix quêtes racontées : création, relations, santé.", obtenu: paiements.filter((p) => p.mode === "racontee").length >= 10 },
    { id: "equipe", nom: "Tous ensemble", description: "Un but d'équipe atteint.", obtenu: Object.values(partie.equipe).some((e) => e && e.atteint) },
    { id: "dimanche", nom: "Première revue", description: "Une revue de la semaine bouclée.", obtenu: Object.keys(partie.semaines).length >= 1 },
    { id: "arrosoir", nom: "Main verte", description: "Cinq arrosages.", obtenu: Object.keys(partie.arrosages).length >= 5 },
    { id: "vendeur", nom: "Dix actions de vente", description: "Dix quêtes de vente faites.", obtenu: paiements.filter((p) => p.vente).length >= 10 },
    { id: "plume", nom: "Cinq quêtes newsletter", description: "Cinq lignes liées à l'édition ou aux abonnés.", obtenu: paiements.filter((p) => p.newsletter).length >= 5 },
    { id: "premier-encaissement", nom: "Premier encaissement", description: "Ton premier paiement déclaré.", obtenu: registre.encaissements.length >= 1 },
  ];
  for (const jalon of config.jalons_mensuels) {
    const objectif = jalon === config.objectif_mensuel;
    badges.push({
      id: "jalon-" + jalon,
      nom: (objectif ? "Objectif " : "Jalon ") + encaissements.formaterEuros(jalon, config.monnaie),
      description: encaissements.formaterEuros(jalon, config.monnaie) + " encaissés sur un mois.",
      obtenu: meilleur >= jalon,
    });
  }
  badges.push(
    { id: "decorateur", nom: "Décorateur", description: "Cinq améliorations installées.", obtenu: nbAchats >= 5 },
    { id: "collectionneur", nom: "Collectionneur", description: "Cinq objets de la collection.", obtenu: Object.keys(partie.objets).length >= 5 },
    { id: "prendre-soin", nom: "Prendre soin", description: "Cinq gestes de stratégie cochés.", obtenu: nbGestes >= 5 },
    { id: "colis", nom: "Premier colis", description: "Un colis ouvert.", obtenu: compter(partie.colis, (c) => c.ouvert) >= 1 }
  );
  catalogue.LIEUX.forEach((lieu, i) => {
    if (i === 0) return;
    badges.push({ id: "lieu-" + lieu.id, nom: "Emménagement : " + config.lieux[lieu.id].nom, description: "Un nouveau lieu ouvert.", obtenu: courant >= i });
  });
  return badges;
}

// Relève ce qui vient d'arriver (badges, jalons, niveau, fonctions ouvertes) et le note pour ne le fêter qu'une fois.
function releverEvenements(partie, registre, ctx, gains) {
  const evenements = [];
  const mois = encaissements.vueMois(registre.encaissements, ctx.config, ctx.date);
  // Mois civil : une fête par jalon et par mois. Fenêtre glissante : une seule clé, et un jalon
  // qui n'est plus atteint pourra être fêté de nouveau.
  const cle = mois.periode === "30_jours" ? "glissant" : mois.id;
  let fetes = Array.isArray(partie.jalons_fetes[cle]) ? partie.jalons_fetes[cle] : [];
  if (mois.periode === "30_jours") fetes = fetes.filter((m) => mois.jalons.some((j) => j.montant === m && j.atteint));
  for (const jalon of mois.jalons) {
    if (!jalon.atteint || fetes.includes(jalon.montant)) continue;
    fetes.push(jalon.montant);
    evenements.push({ type: "jalon", montant: jalon.montant, objectif: jalon.montant === mois.objectif });
  }
  if (fetes.length === 0) delete partie.jalons_fetes[cle];
  else partie.jalons_fetes[cle] = fetes;
  for (const badge of listeBadges(partie, registre, ctx.config)) {
    if (!badge.obtenu || partie.badges[badge.id]) continue;
    partie.badges[badge.id] = ctx.date;
    evenements.push({ type: "badge", id: badge.id, nom: badge.nom });
  }
  const lecteurs = gains.filter((g) => g.newsletter).length * ctx.config.lecteurs_par_quete;
  if (lecteurs > 0) evenements.push({ type: "lecteurs", nombre: lecteurs });
  // Niveau : il suit le total gagné, qui ne redescend jamais.
  const niveau = R.niveau(partie.total_gagne, ctx.config);
  if (niveau.rang > partie.niveau_fete) {
    partie.niveau_fete = niveau.rang;
    R.noter(partie, ctx, "niveau", "Niveau " + niveau.rang + " : " + niveau.nom + ".");
    evenements.push({ type: "niveau", rang: niveau.rang, nom: niveau.nom });
  }
  evenements.push(...R.nouveauxDeblocages(partie, ctx.config, ctx));
  return evenements;
}

// ---------------------------------------------------------------- vues

function vueElement(partie, element, type, ctx, extra) {
  const config = ctx.config;
  const paiement = partie.paiements[element.id] || null;
  const typeQuete = paiement && paiement.type_quete ? paiement.type_quete : R.typeDe(partie, element, config);
  const vente = paiement ? paiement.vente === true : typeQuete === "vente";
  const mode = paiement && paiement.mode ? paiement.mode : config.types[typeQuete].mode;
  let gains = [0, 0, 0];
  if (!paiement) gains = [1, 2, 3].map((d) => R.calculerGain(partie, element, type, d, ctx).points);
  return {
    id: element.id,
    texte: element.texte,
    ...extra,
    genre: type,
    origine: element.origine === "locale" ? "locale" : type === "priorite" ? "plan" : "note",
    vente,
    vente_auto: element.vente_auto === true,
    newsletter: element.newsletter === true,
    type_quete: typeQuete,
    nom_type: config.types[typeQuete].nom,
    mode,
    degres: R.degresDe(partie, element, config),
    degres_perso: Array.isArray(partie.degres[element.id]) || (Array.isArray(element.degres_ecrits) && element.degres_ecrits.some(Boolean)),
    gains,
    points: paiement ? paiement.points : gains[config.points.degre_defaut - 1],
    payee: Boolean(paiement),
    degre: paiement ? paiement.degre || null : null,
    taux: paiement && paiement.taux !== undefined ? paiement.taux : null,
    faite_le: paiement ? paiement.date : null,
    avant_jeu: !paiement && Boolean(partie.avant_jeu[element.id]),
    source: paiement ? paiement.source : null,
    annulable: Boolean(paiement) && paiement.source === "jeu" && paiement.date === ctx.date,
    agent: paiement ? paiement.agent || null : partie.en_cours[element.id] || null,
    cout_energie: E.coutDe(partie, element, ctx.config.energie || E.completer()),
  };
}

function vueCap(partie, cap, registre) {
  const atteint = partie.caps[cap.id] || null;
  const vue = { id: cap.id, libelle: cap.libelle, atteint: Boolean(atteint), date: atteint ? atteint.date : null, suggere: false };
  if (!atteint && cap.seuil_mois) {
    const meilleur = encaissements.meilleurMois(registre.encaissements);
    vue.seuil_mois = cap.seuil_mois;
    vue.meilleur_mois = meilleur;
    vue.suggere = meilleur >= cap.seuil_mois;
  } else if (!atteint && cap.premier) {
    vue.premier = true;
    vue.suggere = registre.encaissements.length > 0;
  }
  return vue;
}

function vuePartie(partie, ctx) {
  const dernierEtat = [...partie.etats].reverse().find((e) => e.date === ctx.date) || null;
  return {
    points: partie.points,
    total_gagne: partie.total_gagne,
    serie: {
      courante: serieCourante(partie.jours_actifs, ctx.date),
      record: Math.max(partie.serie.record || 0, plusLongueSerie(partie.jours_actifs)),
    },
    jours_joues: partie.jours_actifs.length,
    quetes_faites: Object.keys(partie.paiements).length,
    lieu_courant: lieuCourant(partie, ctx.config).id,
    accueil_vu: partie.accueil_vu,
    assistant_fait: partie.assistant_fait,
    tout_ouvert: partie.tout_ouvert,
    ameliorations: partie.ameliorations,
    caps: partie.caps,
    avatar: partie.avatar,
    placements: partie.placements,
    etat_du_jour: dernierEtat ? { titre: dernierEtat.etat, heure: dernierEtat.heure } : null,
    historique: partie.historique.slice(-30).reverse(),
  };
}

function vueLieux(partie, registre, config) {
  const courant = catalogue.indexLieu(lieuCourant(partie, config).id);
  return catalogue.LIEUX.map((lieu, index) => {
    const cap = config.caps.find((c) => c.lieu === lieu.id) || null;
    const achetees = Array.isArray(partie.ameliorations[lieu.id]) ? partie.ameliorations[lieu.id] : [];
    return {
      id: lieu.id,
      index,
      nom: config.lieux[lieu.id].nom,
      sous_titre: config.lieux[lieu.id].sous_titre,
      etage: lieu.etage,
      ouvert: index <= courant,
      cap: cap ? vueCap(partie, cap, registre) : null,
      agents: catalogue.AGENTS.filter((a) => a.lieu === lieu.id).map((a) => config.agents[a.id].nom),
      ameliorations: lieu.ameliorations.map((a) => {
        const effort = config.caps_effort.find((c) => c.piece === lieu.id + "/" + a.id) || null;
        return { ...a, achetee: achetees.includes(a.id), effort: effort ? effort.id : null };
      }),
    };
  });
}

// La prochaine action de vente : priorité du jour, puis jours passés, puis quêtes de la semaine.
// Sans vente en vue, la prochaine priorité du jour sert de repère.
function etoileDuBerger(jours, quetes) {
  const ouvertes = jours.filter((j) => j.statut !== "futur");
  const ordre = [...ouvertes.filter((j) => j.statut === "aujourdhui"), ...ouvertes.filter((j) => j.statut === "passe").reverse()];
  for (const jour of ordre) {
    const p = jour.priorites.find((x) => !x.payee && x.vente);
    if (p) return { id: p.id, type: "priorite", texte: p.texte, vente: true };
  }
  const q = quetes.find((x) => !x.payee && x.vente);
  if (q) return { id: q.id, type: "ligne", texte: q.texte, vente: true };
  const duJour = jours.find((j) => j.statut === "aujourdhui");
  const p = duJour ? duJour.priorites.find((x) => !x.payee) : null;
  if (p) return { id: p.id, type: "priorite", texte: p.texte, vente: false };
  const libre = quetes.find((x) => !x.payee);
  return libre ? { id: libre.id, type: "ligne", texte: libre.texte, vente: false } : null;
}

function vueEtat(partie, registre, lu, ctx, gains, evenements, avertissements, lesCollegues) {
  const config = ctx.config;
  const jours = lu.jours.map((jour) => ({
    date: jour.date,
    libelle: jour.libelle,
    statut: jour.date < ctx.date ? "passe" : jour.date === ctx.date ? "aujourdhui" : "futur",
    bonus_paye: Boolean(partie.bonus_jours[jour.date]),
    priorites: jour.priorites.map((p) => vueElement(partie, p, "priorite", ctx)),
  }));
  const quetes = lu.quetes.map((q) =>
    vueElement(partie, q, "ligne", ctx, { categorie: q.categorie, groupe: q.groupe, cochee_note: q.cochee })
  );
  const jourCourant = jours.find((j) => j.statut === "aujourdhui") || null;
  const premierFutur = jours.find((j) => j.statut === "futur") || null;
  const gestesDuJour = partie.gestes[ctx.date] || {};
  const jalonsInconnus = config.caps.filter((c) => c.lieu && catalogue.indexLieu(c.lieu) === -1);
  const liste = registre.encaissements;
  const nbNewsletter = compter(partie.paiements, (p) => p.newsletter === true);
  const lignesNewsletter = [...quetes, ...jours.flatMap((j) => j.priorites)].filter((q) => q.newsletter);
  const duJour = catalogue.objetsDuJour(ctx.date);
  // Un badge obtenu reste obtenu, même si tu corriges un encaissement ensuite.
  const badges = listeBadges(partie, registre, config).map((b) => ({ ...b, obtenu: b.obtenu || Boolean(partie.badges[b.id]), date: partie.badges[b.id] || null }));
  const ouvert = (lieuId) => lieuOuvert(partie, config, lieuId);
  const fonctions = R.vueFonctions(partie, config, ctx.date);
  const ouvertes = ouvertesDuJour(partie, lu, ctx);
  const faitesAujourdhui = [...quetes, ...(jourCourant ? jourCourant.priorites : [])].filter((q) => q.payee && q.faite_le === ctx.date).map((q) => q.id);
  const agents = catalogue.AGENTS.filter((a) => ouvert(a.lieu)).map((a) => ({
    id: a.id,
    lieu: a.lieu,
    nom: config.agents[a.id].nom,
    role: config.agents[a.id].role,
    specialite: config.agents[a.id].specialite,
    nom_specialite: config.types[config.agents[a.id].specialite].nom,
    quete: Object.keys(partie.en_cours).find((id) => partie.en_cours[id] === a.id) || null,
  }));
  return {
    date: ctx.date,
    heure: ctx.heure,
    heure_num: ctx.heureNum,
    simulation: ctx.simulation,
    demo: ctx.demo,
    erreurs: lu.erreurs,
    avertissements: [
      ...avertissements,
      ...lu.avertissements,
      ...jalonsInconnus.map((c) => "Le cap « " + c.libelle + " » vise un lieu inconnu (" + c.lieu + "). Je le traite comme un jalon."),
    ],
    coffre: { chemin: lu.chemin },
    phase: lu.phase ? { numero: lu.phase.numero, nom: lu.phase.nom } : null,
    semaine: lu.semaine,
    mission: lu.mission || { texte: "", phrase: "", objectifs: [] },
    jours,
    jour_courant: jourCourant ? jourCourant.date : null,
    apercu: !jourCourant && premierFutur ? premierFutur.date : null,
    quetes,
    du_jour: {
      visibles: ouvertes.slice(0, config.quetes_visibles).map((q) => q.id),
      reserve: Math.max(0, ouvertes.length - config.quetes_visibles),
      ouvertes: ouvertes.length,
      faites: faitesAujourdhui,
      reportees: Array.isArray(partie.reportees[ctx.date]) ? partie.reportees[ctx.date] : [],
    },
    etoile: etoileDuBerger(jours, quetes),
    newsletter: {
      total: lignesNewsletter.length,
      faites: lignesNewsletter.filter((q) => q.payee).length,
      lecteurs: nbNewsletter * config.lecteurs_par_quete,
    },
    strategies: {
      regle_commune: lu.strategies.regle_commune,
      etats: lu.strategies.etats.map((e) => ({
        titre: e.titre,
        libelle: e.libelle,
        signal: e.signal,
        gestes: e.gestes.map((g) => ({
          id: g.id,
          nom: g.nom,
          description: g.description,
          fait_aujourdhui: Boolean(gestesDuJour[g.id]),
          points: config.points.geste,
        })),
      })),
    },
    mois: encaissements.vueMois(liste, config, ctx.date),
    encaissements: [...liste]
      .sort((a, b) => (a.date === b.date ? (a.cree_le < b.cree_le ? 1 : -1) : a.date < b.date ? 1 : -1))
      .slice(0, 300),
    trophees: [...liste]
      .sort((a, b) => (a.date === b.date ? (a.cree_le < b.cree_le ? -1 : 1) : a.date < b.date ? -1 : 1))
      .slice(-48)
      .map((e) => ({ id: e.id, source: e.source, montant: e.montant, date: e.date })),
    colis: Object.entries(partie.colis)
      .filter(([, c]) => !c.ouvert)
      .map(([id, c]) => ({ id, date: c.date, origine: c.origine || "encaissement" })),
    objets: Object.entries(partie.objets)
      .map(([id, o]) => ({ ...catalogue.trouverDeco(id), origine: o.origine, date: o.date }))
      .filter((o) => o.id),
    // La collection se voit à l'avance : tous les objets, possédés ou non.
    collection: catalogue.DECOS.map((d) => ({ id: d.id, nom: d.nom, pose: d.pose, phrase: d.phrase, possede: Boolean(partie.objets[d.id]), origine: partie.objets[d.id] ? partie.objets[d.id].origine : null })),
    boutique: {
      du_jour: duJour.map((id) => ({ ...catalogue.trouverDeco(id), possede: Boolean(partie.objets[id]) })),
    },
    agents,
    badges,
    plantes: etatPlantes(partie, ctx.date),
    temoignages: config.temoignages,
    fonctions,
    niveau: R.niveau(partie.total_gagne, config),
    plafond: R.vuePlafond(partie, ctx),
    arrosage: R.vueArrosage(partie, ctx),
    contrat: R.vueContrat(partie, ouvertes, ctx, fonctions.fonctions.contrat.ouvert),
    equipe: R.vueEquipe(partie, ctx, agents),
    dimanche: R.vueDimanche(partie, registre, ctx),
    efforts: R.vueEfforts(partie, config, ouvert),
    journal: partie.journal.slice(-120).reverse(),
    systeme: S.vue(partie, ctx),
    energie: E.vue(
      partie,
      [...quetes, ...(jourCourant ? jourCourant.priorites : [])],
      ctx.date,
      config.energie || E.completer()
    ),
    assistant: { fait: partie.assistant_fait, a_proposer: !partie.assistant_fait && R.aJoue(partie), coffre_trouve: Boolean(lu.chemin) },
    partie: vuePartie(partie, ctx),
    lieux: vueLieux(partie, registre, config),
    jalons: config.caps.filter((c) => !c.lieu || catalogue.indexLieu(c.lieu) === -1).map((c) => vueCap(partie, c, registre)),
    gains,
    evenements,
    collegues: lesCollegues,
    config: {
      rafraichissement_s: config.rafraichissement_s,
      enseigne: config.enseigne,
      joueur: config.joueur,
      monnaie: config.monnaie,
      son: config.son,
      fuseau: config.fuseau,
      points: config.points,
      sources_encaissement: config.sources_encaissement,
      avatar: catalogue.AVATAR,
      types: configuration.ORDRE_TYPES.map((t) => ({ id: t, nom: config.types[t].nom, mode: config.types[t].mode })),
      quetes_visibles: config.quetes_visibles,
      objectif_mensuel: config.objectif_mensuel,
      contrat: config.contrat,
      deblocages: config.deblocages,
    },
  };
}

// ---------------------------------------------------------------- point d'entrée

// options : { config, date (simulée, facultative), demo, maintenant et hasard (pour les tests) }
function contexte(options, config) {
  const simulation = Boolean(options.date);
  if (simulation && !P.dateValide(options.date)) {
    throw new ErreurJeu("DATE_INVALIDE", "La date doit être au format AAAA-MM-JJ.");
  }
  const horloge = P.horloge(config.fuseau, options.date || null, options.maintenant);
  const hasard = typeof options.hasard === "function" ? options.hasard : (n) => crypto.randomInt(n);
  // le hasard du Système (butin, événement du jour) a sa propre source, pour ne pas décaler celui des colis
  const hasardSysteme = typeof options.hasardSysteme === "function" ? options.hasardSysteme : (n) => crypto.randomInt(n);
  return { config, base: options.config, patch: {}, simulation, demo: options.demo === true, hasard, hasardSysteme, sys: [], ...horloge, semaine: null, registre: null, texteQuetes: null };
}

function sourceVide(erreurs) {
  return {
    chemin: null,
    phase: null,
    semaine: null,
    quetes: [],
    jours: [],
    strategies: { regle_commune: "", etats: [] },
    mission: { texte: "", phrase: "", objectifs: [] },
    erreurs: erreurs || [],
    avertissements: [],
  };
}

// Le coffre est facultatif : sans lui, le jeu vit avec data/quetes.md.
function lireLeCoffre(ctx) {
  if (ctx.config.coffre === "non") return sourceVide();
  let chemin;
  try {
    chemin = resoudreCoffre(ctx.config);
  } catch (e) {
    if (!(e instanceof ErreurJeu)) throw e;
    return sourceVide(ctx.config.coffre === "requis" ? [{ code: e.code, message: e.message }] : []);
  }
  garde.definirCoffre(chemin);
  return coffreLecture.lireCoffre(chemin, ctx.config, ctx.date);
}

function nomReglages(simulation) {
  return simulation ? FICHIER_REGLAGES_TEST : FICHIER_REGLAGES;
}

function nomQuetes(simulation) {
  return simulation ? FICHIER_QUETES_TEST : FICHIER_QUETES;
}

// Les réglages du joueur : un patch posé sur config.json. Fichier abîmé : ignoré, jamais bloquant.
function lirePatch(simulation) {
  try {
    const lu = garde.lireDonnees(nomReglages(simulation));
    return lu && estObjet(lu.modifs) ? lu.modifs : {};
  } catch (e) {
    if (e instanceof ErreurJeu && e.code === "DONNEES_ILLISIBLES") return {};
    throw e;
  }
}

function configEffective(options) {
  if (options.demo) {
    const horloge = P.horloge(options.config.fuseau, options.date || null, options.maintenant);
    return configuration.effective(options.config, demo.preparer(horloge.date));
  }
  return configuration.effective(options.config, lirePatch(Boolean(options.date)));
}

// Oublie les accompagnements dont la quête a disparu de la note, ou dont l'agent n'est plus là.
function nettoyerEnCours(partie, lu, config) {
  for (const id of Object.keys(partie.en_cours)) {
    const agent = catalogue.trouverAgent(partie.en_cours[id]);
    if (!agent || !lieuOuvert(partie, config, agent.lieu)) delete partie.en_cours[id];
    else if (!lu.erreurs.length && (!trouverElement(lu, id) || partie.paiements[id])) delete partie.en_cours[id];
  }
}

// Bonus de retour : après une pause, le jeu dit merci d'être revenu. Jamais de reproche pour l'absence.
function bonusDeRetour(partie, ctx) {
  const gains = [];
  const derniere = partie.derniere_visite;
  if (derniere && derniere < ctx.date && R.aJoue(partie)) {
    const jours = Math.round((new Date(ctx.date + "T00:00:00Z") - new Date(derniere + "T00:00:00Z")) / 86400000);
    const bonus = ctx.config.retour.bonus;
    if (jours >= ctx.config.retour.jours && bonus > 0 && !partie.retours.includes(ctx.date)) {
      partie.retours.push(ctx.date);
      partie.retours = partie.retours.slice(-200);
      partie.points += bonus;
      partie.total_gagne += bonus;
      historiser(partie, ctx, "retour", "Bonus de retour", bonus);
      R.noter(partie, ctx, "retour", "Te revoilà, après " + jours + " jours. Rien n'a bougé pendant ton absence. Les agents ont gardé la maison : +" + bonus + " points pour ton retour.");
      gains.push({ type: "retour", id: "R-" + ctx.date, libelle: "Bonus de retour", points: bonus, vente: false, jours });
    }
  }
  if (!derniere || derniere < ctx.date) partie.derniere_visite = ctx.date;
  return gains;
}

// Synchronise, applique une action éventuelle, enregistre, renvoie l'état complet.
function jouer(options, action, parametres) {
  let ctx = contexte(options, configEffective(options));
  ctx.patch = options.demo ? demo.patch() : lirePatch(ctx.simulation);
  let lu = options.demo ? demo.sources(ctx) : lireLeCoffre(ctx);
  ctx.semaine = lu.semaine ? lu.semaine.id : P.semaineISO(ctx.date).id;
  let partie;
  let registre;
  let avertissements = [];
  let neuve = false;
  if (ctx.demo) {
    ({ partie, registre } = structuredClone(demo.charger(ctx, { nouvellePartie, listeBadges })));
    ctx.texteQuetes = demo.quetes();
  } else {
    ({ partie, registre, avertissements, neuve } = charger(ctx.simulation, ctx));
    ctx.texteQuetes = garde.lireTexte(nomQuetes(ctx.simulation));
  }
  // Les quêtes du jeu (data/quetes.md) s'ajoutent à celles de la note.
  if (typeof ctx.texteQuetes === "string") {
    const locales = Q.lire(ctx.texteQuetes, ctx.config.mots_vente, ctx.config.mots_newsletter);
    lu = { ...lu, quetes: [...lu.quetes, ...locales.quetes], avertissements: [...lu.avertissements, ...locales.avertissements] };
  }
  ctx.registre = registre;
  // Partie toute neuve en découverte pas à pas : les cases déjà cochées avant le jeu ne sont pas payées
  // d'un coup. La première minute garde sa seule action, et l'histoire commence à la première vraie quête.
  if (neuve && ctx.config.deblocages.actif) {
    for (const q of lu.quetes) if (q.cochee) partie.avant_jeu[q.id] = true;
  }
  const avant = neuve ? "" : JSON.stringify(partie);
  const avantRegistre = JSON.stringify(registre);
  if (ctx.demo) S.semerDemo(partie, ctx);
  // Le Système : éveil d'une partie existante, bilan du dernier jour joué, événement du jour, production de l'équipe.
  S.tic(partie, ctx, R.aJoue(partie));
  const gains = synchroniser(partie, lu, ctx);
  gains.push(...bonusDeRetour(partie, ctx));
  nettoyerEnCours(partie, lu, ctx.config);
  // Action refusée : rien n'est écrit. Les cases cochées dans la note seront payées et annoncées à l'appel suivant.
  if (action) gains.push(...ACTIONS[action](partie, lu, ctx, parametres || {}).filter(Boolean));
  if (ctx.patchModifie) {
    // les réglages viennent de changer : la suite se calcule avec la nouvelle configuration
    const config = configuration.effective(ctx.base, ctx.patch);
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: config.fuseau });
    } catch (e) {
      throw new ErreurJeu("REGLAGE_INVALIDE", "Ce fuseau est inconnu.");
    }
    const sys = ctx.sys;
    ctx = { ...ctx, config, sys };
  }
  for (const g of R.resoudreContrats(partie, ctx)) {
    gains.push(g);
    R.apresContrat(partie, ctx, g, gains);
  }
  const lesCollegues = ctx.demo ? demo.collegues() : collegues.lire(ctx.config);
  // Les sessions de travail comptent pour l'équipe une fois que l'équipe est présentée au joueur.
  if (R.vueFonctions(partie, ctx.config, ctx.date).fonctions.equipe.ouvert) R.compterSessions(partie, ctx, lesCollegues.collegues, gains);
  gains.push(...R.verifierEfforts(partie, ctx, (lieuId) => lieuOuvert(partie, ctx.config, lieuId)));
  const evenements = releverEvenements(partie, registre, ctx, gains);
  borner(partie);
  const etatVu = vueEtat(partie, registre, lu, ctx, gains, evenements, avertissements, lesCollegues);
  const texteBut = R.texteButEquipe(etatVu.equipe, ctx);
  if (ctx.demo) demo.enregistrer({ partie, registre, patch: ctx.patch, quetes: ctx.texteQuetes });
  else {
    if (ctx.patchModifie) garde.ecrireDonnees(nomReglages(ctx.simulation), { version: 1, modifs: ctx.patch });
    if (ctx.quetesModifiees) garde.ecrireTexte(nomQuetes(ctx.simulation), ctx.texteQuetes);
    if (JSON.stringify(registre) !== avantRegistre) garde.ecrireDonnees(nomRegistre(ctx.simulation), registre);
    if (JSON.stringify(partie) !== avant) garde.ecrireDonnees(nomFichier(ctx.simulation), partie);
    // Le but d'équipe vit aussi dans un fichier du jeu, que les sessions de travail peuvent lire.
    const nomBut = ctx.simulation ? FICHIER_BUT_TEST : FICHIER_BUT;
    if (R.aJoue(partie) && garde.lireTexte(nomBut) !== texteBut) garde.ecrireTexte(nomBut, texteBut);
  }
  return etatVu;
}

function etat(options) {
  return jouer(options, null, null);
}

// L'écran Réglages : tout ce qui se règle, avec les valeurs en cours.
function vueReglages(options) {
  const patch = options.demo ? demo.preparer(P.horloge(options.config.fuseau, options.date || null, options.maintenant).date) : lirePatch(Boolean(options.date));
  return reglages.vue(options.config, patch);
}

// Seulement en date simulée ou en démo : efface la partie d'essai.
function reinitialiserTest(options) {
  if (options.demo) {
    demo.oublier();
    return etat(options);
  }
  if (!options.date) throw new ErreurJeu("INTERDIT", "La remise à zéro ne concerne que la partie de test (date simulée) ou la démo.");
  garde.effacerDonnees(FICHIER_TEST);
  garde.effacerDonnees(FICHIER_ENCAISSEMENTS_TEST);
  garde.effacerDonnees(FICHIER_REGLAGES_TEST);
  garde.effacerTexte(FICHIER_QUETES_TEST);
  garde.effacerTexte(FICHIER_BUT_TEST);
  return etat(options);
}

module.exports = {
  FICHIER_PARTIE,
  FICHIER_TEST,
  FICHIER_ENCAISSEMENTS,
  FICHIER_ENCAISSEMENTS_TEST,
  FICHIER_REGLAGES,
  FICHIER_QUETES,
  FICHIER_BUT,
  nouvellePartie,
  normaliser,
  serieCourante,
  plusLongueSerie,
  lieuCourant,
  etatPlantes,
  etoileDuBerger,
  listeBadges,
  configEffective,
  vueReglages,
  etat,
  jouer,
  reinitialiserTest,
  ACTIONS,
};

  });

  racine.JeuMoteur = {
    require: req,
    configuration: function () { return req("/jeu/serveur/config.js"); },
    partie: function () { return req("/jeu/serveur/partie.js"); },
    sauvegarde: function () { return req("/jeu/serveur/sauvegarde.js"); },
    energie: function () { return req("/jeu/serveur/energie.js"); },
    restaurer: restaurer,
    restaurerSync: restaurerSync,
    persister: demanderPersistance,
    disque: disque,
    ecrireFichier: function (chemin, texte) { nodeFs.writeFileSync(chemin, texte, "utf8"); },
    lireFichier: function (chemin) { try { return nodeFs.readFileSync(chemin, "utf8"); } catch (e) { return null; } },
    snapshot: snapshot,
    vider: function () { appliquerSnapshot({}); demanderPersistance(); },
  };
})(typeof window !== "undefined" ? window : globalThis);
