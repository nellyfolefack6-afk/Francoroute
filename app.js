/* ==========================================================================
   Le Labo des Déclics — logique de l'application
   Vanilla JS, sans framework, sans étape de compilation : ce fichier peut
   être ouvert et modifié directement par une IA ou une personne technique,
   sans avoir besoin de reconstruire un "bundle".
   ========================================================================== */

// ------------------------------------------------------------------------
// État et stockage (localStorage)
// ------------------------------------------------------------------------
const STORAGE_KEY = "labo_declics_v1";

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const store = raw ? JSON.parse(raw) : { profiles: {}, currentProfile: null };
    store.soundRecordings = store.soundRecordings || {};
    return store;
  } catch (e) {
    return { profiles: {}, currentProfile: null, soundRecordings: {} };
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    /* stockage plein ou indisponible : on continue sans bloquer l'enfant */
  }
}

let STORE = loadStore();

function ensureProfile(name) {
  if (!name) return null;
  if (!STORE.profiles[name]) {
    STORE.profiles[name] = {
      name,
      exerciseStatus: {},
      appuisLog: [],
      appuisHelpful: {},
      drawings: [],
      rewardStars: 0,
      entryAnswers: [],
      livret: [],
      schoolHomeNotes: [],
    };
    saveStore(STORE);
  }
  return STORE.profiles[name];
}

function currentProfile() {
  if (!STORE.currentProfile) return null;
  return STORE.profiles[STORE.currentProfile] || null;
}

function setCurrentProfile(name) {
  STORE.currentProfile = name;
  ensureProfile(name);
  saveStore(STORE);
}

function markExercise(exId, status) {
  const p = currentProfile();
  if (!p) return;
  // "réussi" l'emporte toujours sur "essayé" une fois atteint (ne jamais reculer)
  const existing = p.exerciseStatus[exId];
  if (existing === "reussi") return;
  p.exerciseStatus[exId] = status;
  saveStore(STORE);
}

function logAppuiUsed(appuiId, context, confirmed) {
  const p = currentProfile();
  if (!p) return;
  // "confirmed" distingue une déclaration explicite de l'enfant ("j'ai
  // utilisé cette stratégie") d'une simple ouverture d'outil : seule la
  // première nourrit l'arbre des petits pas (voir treeRecords).
  p.appuisLog.push({ appuiId, context: context || null, confirmed: confirmed === true, at: new Date().toISOString() });
  saveStore(STORE);
}

// Un outil OUVERT n'est pas forcément un outil qui a AIDÉ : on garde les
// deux informations séparées, déclarées par l'enfant lui-même quand il
// vérifie sa réponse. Sert à bâtir un vrai bilan (voir homeSchoolRecords),
// pas seulement un historique de clics.
function markAppuiHelpful(exId, appuiId) {
  const p = currentProfile();
  if (!p) return;
  p.appuisHelpful = p.appuisHelpful || {};
  p.appuisHelpful[exId + "|" + appuiId] = true;
  saveStore(STORE);
}

function isAppuiHelpful(p, exId, appuiId) {
  return !!(p && p.appuisHelpful && p.appuisHelpful[exId + "|" + appuiId]);
}

function addRewardStar() {
  const p = currentProfile();
  if (!p) return;
  p.rewardStars = (p.rewardStars || 0) + 1;
  saveStore(STORE);
}

function saveDrawing(dataUrl) {
  const p = currentProfile();
  if (!p) return;
  p.drawings.push({ dataUrl, at: new Date().toISOString() });
  saveStore(STORE);
}

function logEntryAnswer(reponse) {
  const p = currentProfile();
  if (!p) return;
  p.entryAnswers.push({ reponse, at: new Date().toISOString() });
  saveStore(STORE);
}

function logLivretEntry(exId, texte) {
  const p = currentProfile();
  if (!p) return;
  p.livret = p.livret || [];
  if (p.livret.some((e) => e.exId === exId)) return; // déjà noté, on n'ajoute pas de doublon
  p.livret.push({ exId, texte, at: new Date().toISOString() });
  saveStore(STORE);
}

// ------------------------------------------------------------------------
// Petit utilitaire de création d'éléments (évite le HTML-en-chaîne partout)
// ------------------------------------------------------------------------
function el(tag, attrs, children) {
  const node = document.createElement(tag);
  attrs = attrs || {};
  Object.keys(attrs).forEach((key) => {
    if (attrs[key] === undefined || attrs[key] === null) return;
    if (key === "class") node.className = attrs[key];
    else if (key === "html") node.innerHTML = attrs[key];
    else if (key.startsWith("on") && typeof attrs[key] === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
    } else if (key === "style" && typeof attrs[key] === "object") {
      Object.assign(node.style, attrs[key]);
    } else {
      node.setAttribute(key, attrs[key]);
    }
  });
  (children || []).forEach((child) => {
    if (child === null || child === undefined) return;
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  });
  return node;
}

function textEl(tag, text, attrs) {
  return el(tag, attrs, [text]);
}

// ------------------------------------------------------------------------
// Voix (lecture à voix haute) — vitesse ralentie par défaut pour un enfant
// ------------------------------------------------------------------------
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "fr-FR";
    utter.rate = 0.82; // plus lent que la valeur par défaut du navigateur
    utter.pitch = 1.05;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    /* la synthèse vocale n'est pas disponible partout : on continue sans */
  }
}

function speakButton(text, label) {
  return el(
    "button",
    { class: "btn btn-secondary", type: "button", onclick: () => speak(text) },
    ["🔊 ", label || "Écouter"]
  );
}

// ------------------------------------------------------------------------
// Routeur (basé sur le hash de l'URL)
// ------------------------------------------------------------------------
const ROUTES = [];
function route(pattern, render) {
  ROUTES.push({ pattern, render });
}

function parseHash() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [path, queryString] = hash.split("?");
  const params = new URLSearchParams(queryString || "");
  return { path: path || "/", params };
}

function navigate(path) {
  location.hash = path;
}

let lastRenderedPath = null;
function renderRoute() {
  const { path, params } = parseHash();
  const match = ROUTES.find((r) => r.pattern === path) || ROUTES.find((r) => r.pattern === "/404");
  const main = document.getElementById("main-content");
  const samePathAsBefore = path === lastRenderedPath;
  main.innerHTML = "";
  main.appendChild(match.render(params));
  updateActiveNav(path);
  renderProgressSidebar();
  const stepMarker = samePathAsBefore ? document.getElementById("current-step") : null;
  if (stepMarker) {
    stepMarker.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }
  lastRenderedPath = path;
}

window.addEventListener("hashchange", renderRoute);

// ------------------------------------------------------------------------
// Navigation (menu principal)
// ------------------------------------------------------------------------
const NAV_ITEMS = [
  { path: "/", emoji: "🏠", label: "Accueil" },
  { path: "/eleve", emoji: "🎒", label: "Espace élève" },
  { path: "/premiers-pas", emoji: "🗣️", label: "Mes premiers pas en français" },
  { path: "/besoins", emoji: "🌟", label: "Mes besoins particuliers" },
  { path: "/progres", emoji: "🗺️", label: "Ma carte de progression" },
  { path: "/lexique", emoji: "📚", label: "Lexique des stratégies" },
  { path: "/recompense", emoji: "🎁", label: "Ma récompense" },
  { path: "/livret", emoji: "📖", label: "Mon livret de récits" },
  { path: "/medailles", emoji: "🏅", label: "Mon mur des médailles" },
  { path: "/parents", emoji: "👨‍👩‍👧", label: "Espace parents" },
  { path: "/professionnels", emoji: "🧑‍🏫", label: "Espace professionnels" },
  { path: "/fonctions-executives", emoji: "🧠", label: "Fonctions exécutives" },
  { path: "/sauvegarde", emoji: "💾", label: "Sauvegarder mes progrès" },
  { path: "/sons-adulte", emoji: "🔊", label: "Préparer les sons enregistrés" },
];

function buildNav(container) {
  const ul = container.querySelector("ul");
  ul.innerHTML = "";
  NAV_ITEMS.forEach((item) => {
    const li = el("li", {}, []);
    const a = el(
      "a",
      {
        class: "nav-link",
        href: "#" + item.path,
        "data-path": item.path,
      },
      [el("span", { class: "nav-emoji" }, [item.emoji]), " " + item.label]
    );
    li.appendChild(a);
    ul.appendChild(li);
  });
}

function updateActiveNav(path) {
  document.querySelectorAll(".nav-link").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("data-path") === path);
  });
}

// ------------------------------------------------------------------------
// Page : Accueil
// ------------------------------------------------------------------------
route("/", function renderHome() {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h1", "Le Labo des Déclics", { class: "page-title" }));
  wrap.appendChild(
    textEl("p", "Comprendre une méthode, l'essayer, repérer ce qui est difficile, choisir un appui et découvrir ce qui m'aide à apprendre.", { class: "lede" })
  );

  wrap.appendChild(
    el("div", { class: "welcome-card" }, [
      el("p", { style: { margin: 0 } }, [
        "Bienvenue sur Le Labo des Déclics : une plateforme conçue pour aider les élèves ayant des défis d'apprentissage, avec ou sans diagnostic, à identifier ce qui les bloque, à choisir une stratégie adaptée, et à progresser à leur rythme, à l'école comme à la maison.",
      ]),
    ])
  );

  const accordion = el("div", { class: "home-accordion" }, []);
  HOME_PRESENTATION.forEach((item) => {
    const body = [];
    if (item.liste) {
      const ul = el("ul", { style: { margin: "0.6rem 0 0", paddingLeft: "1.2rem" } }, []);
      item.liste.forEach((pt) => {
        ul.appendChild(el("li", { style: { margin: "0 0 0.4rem" } }, [pt]));
      });
      body.push(ul);
    } else {
      body.push(el("p", { style: { margin: "0.6rem 0 0" } }, [item.texte]));
    }
    if (item.lienHref) {
      body.push(el("a", { class: "small", href: item.lienHref, style: { display: "inline-block", marginTop: "0.5rem" } }, [item.lienLabel]));
    }
    accordion.appendChild(
      el("details", { class: "home-accordion-item" }, [el("summary", {}, [item.titre]), ...body])
    );
  });
  wrap.appendChild(accordion);

  wrap.appendChild(textEl("h2", "Maintenant, à vous de découvrir la plateforme", { class: "section-title" }));
  const roleGrid = el("div", { class: "role-grid" }, [
    el("a", { class: "role-card role-eleve", href: "#/eleve" }, [
      el("span", { class: "role-title" }, ["🎒 Je suis un élève"]),
      el("span", { class: "role-desc" }, ["Je choisis mon niveau, ma matière, et j'avance étape par étape."]),
    ]),
    el("a", { class: "role-card role-parent", href: "#/parents" }, [
      el("span", { class: "role-title" }, ["👨‍👩‍👧 Je suis un parent"]),
      el("span", { class: "role-desc" }, ["Des conseils par difficulté : quoi essayer, quoi dire, quoi éviter."]),
    ]),
    el("a", { class: "role-card role-pro", href: "#/professionnels" }, [
      el("span", { class: "role-title" }, ["🧑‍🏫 Je suis un professionnel"]),
      el("span", { class: "role-desc" }, ["Les mêmes repères, avec des nuances d'observation et de suivi."]),
    ]),
    el("a", { class: "role-card role-decouverte", href: "#/besoins" }, [
      el("span", { class: "role-title" }, ["🌟 Besoins particuliers"]),
      el("span", { class: "role-desc" }, ["Un programme visuel avec des appuis dans la page."]),
    ]),
  ]);
  wrap.appendChild(roleGrid);

  wrap.appendChild(textEl("h2", "Ce qu'on y trouve", { class: "section-title" }));
  wrap.appendChild(
    textEl(
      "p",
      "Trois matières (numératie, mathématiques, lecture), cinq niveaux toujours accessibles, des méthodes expliquées, des exemples liés à la vraie vie, des exercices groupés en petites étapes, et une boîte à outils toujours disponible.",
      { class: "lede" }
    )
  );

  const note = el("div", { class: "note-box" }, [
    "Les progrès et observations restent dans ce navigateur, séparément pour chaque prénom. Aucun compte n'est créé et aucune donnée n'est envoyée à l'école. Ils ne se synchronisent pas automatiquement entre appareils et peuvent être perdus si les données du navigateur sont effacées : l'espace adulte permet de télécharger une sauvegarde et de la récupérer sur un autre appareil. Une pause ne retire jamais un progrès déjà obtenu.",
  ]);
  wrap.appendChild(note);

  wrap.appendChild(
    el("p", { class: "small muted", style: { marginTop: "2rem" } }, [
      "Le Labo des Déclics, Nelly Folefack, MSW, RSW, Travailleuse sociale. Les activités s'inspirent des apprentissages du primaire ; aucune conformité complète au curriculum n'est revendiquée sans vérification par l'équipe-école.",
    ])
  );

  return wrap;
});

// ------------------------------------------------------------------------
// Sélecteur de prénom (réutilisé sur plusieurs pages)
// ------------------------------------------------------------------------
function renderProfilePicker() {
  const wrap = el("div", { class: "card-soft" }, []);
  wrap.appendChild(textEl("h3", "Qui travaille en ce moment ?", { style: { margin: "0 0 0.4rem" } }));
  wrap.appendChild(
    textEl(
      "p",
      "Les progrès restent dans ce navigateur, séparément pour chaque prénom. Aucun compte n'est créé.",
      { class: "small muted" }
    )
  );

  const current = currentProfile();
  const row = el("div", { class: "btn-row", style: { alignItems: "center" } }, []);
  const input = el("input", {
    type: "text",
    placeholder: "Ton prénom",
    value: current ? current.name : "",
    style: { padding: "0.6rem 0.8rem", borderRadius: "0.6rem", border: "2px solid var(--border)", fontSize: "1rem" },
  });
  const button = el(
    "button",
    {
      class: "btn btn-primary",
      type: "button",
      onclick: () => {
        const name = input.value.trim();
        if (!name) return;
        setCurrentProfile(name);
        renderRoute();
      },
    },
    ["C'est moi"]
  );
  row.appendChild(input);
  row.appendChild(button);
  wrap.appendChild(row);

  if (current) {
    wrap.appendChild(textEl("p", "Prénom actif : " + current.name, { class: "small", style: { marginTop: "0.6rem", fontWeight: "700" } }));
  }
  return wrap;
}

// ------------------------------------------------------------------------
// Page : Espace élève (matière → niveau → thème → méthode → exemple → exercices)
// ------------------------------------------------------------------------
route("/eleve", function renderEleve(params) {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h1", "Espace élève", { class: "page-title" }));
  wrap.appendChild(
    textEl(
      "p",
      "Mon parcours : niveau → matière → pourquoi ça compte → thème → méthode → exemple → exercices. Je peux changer de niveau quand je veux, sans créer de compte.",
      { class: "lede" }
    )
  );

  wrap.appendChild(renderProfilePicker());

  const welcomeProfile = currentProfile();
  if (welcomeProfile) {
    wrap.appendChild(
      el("div", { class: "welcome-card" }, [
        el("p", { style: { margin: 0 } }, [
          "Bienvenue dans le laboratoire, " + welcomeProfile.name + " ! Ici, tu vas découvrir tes stratégies, celles qui t'aident quand une tâche est plus difficile. Tu avances à ton rythme, tu as le droit de te tromper, et le but, c'est aussi de t'amuser en comprenant ce que tu fais.",
        ]),
      ])
    );
  }

  wrap.appendChild(
    el("a", { class: "besoins-callout", href: "#/besoins" }, [
      el("span", { style: { fontSize: "1.3rem" } }, ["🌟"]),
      el("span", {}, ["J'ai des besoins particuliers ? Commencer par un parcours adapté →"]),
    ])
  );

  const subject = params.get("matiere");
  const level = params.get("niveau") ? parseInt(params.get("niveau"), 10) : null;
  const theme = params.get("theme");
  const adapte = params.get("adapte") === "1";
  const profilId = params.get("profil");
  const profil = profilId ? PARCOURS_BESOINS.find((p) => p.id === profilId) : null;
  const adaptSuffix = adapte ? "&adapte=1" + (profilId ? "&profil=" + profilId : "") : "";

  if (adapte) {
    const banner = el("div", { class: "adapt-banner" }, [
      el("div", { style: { fontWeight: "800" } }, [
        profil ? profil.emoji + " Mode adapté : " + profil.titre : "🌱 Mode adapté actif",
      ]),
      el("div", { class: "small", style: { marginTop: "0.2rem" } }, [
        "Un exercice à la fois, étapes ouvertes d'avance" + (profil ? ", outils déjà prêts plus bas." : "."),
      ]),
      el("a", { class: "small", href: "#/eleve" + (level ? "?niveau=" + level + (subject ? "&matiere=" + subject : "") : ""), style: { display: "inline-block", marginTop: "0.4rem" } }, [
        "Revenir au mode habituel",
      ]),
    ]);
    wrap.appendChild(banner);
  }

  wrap.appendChild(textEl("h2", "1. Je choisis mon niveau", { class: "section-title", id: !level ? "current-step" : undefined }));
  const levelRow = el("div", { class: "level-row" }, []);
  LEVELS.forEach((n) => {
    levelRow.appendChild(
      el(
        "a",
        {
          class: "level-btn" + (level === n ? " selected" : ""),
          href: "#/eleve?niveau=" + n + (subject ? "&matiere=" + subject : "") + adaptSuffix,
        },
        [n + (n === 1 ? "re" : "e") + " année"]
      )
    );
  });
  wrap.appendChild(levelRow);

  if (!level) return wrap;

  wrap.appendChild(textEl("h2", "2. Je choisis ma matière", { class: "section-title", id: !subject ? "current-step" : undefined }));
  const subjGrid = el("div", { class: "subject-grid" }, []);
  SUBJECTS.forEach((s) => {
    const isSelected = subject === s.id;
    subjGrid.appendChild(
      el(
        "a",
        {
          class: "subject-card subj-" + s.id + (isSelected ? " selected" : ""),
          href: "#/eleve?niveau=" + level + "&matiere=" + s.id + adaptSuffix,
        },
        [
          el("span", { class: "subj-emoji" }, [s.emoji]),
          el("span", {}, [s.label]),
          el("div", { class: "small", style: { marginTop: "0.3rem", fontWeight: "600" } }, [s.tagline]),
        ]
      )
    );
  });
  wrap.appendChild(subjGrid);

  if (!subject) return wrap;

  const intro = SUBJECT_INTRO[subject][level];
  const subjData = SUBJECTS.find((s) => s.id === subject);
  const subjLabel = subjData.label;

  wrap.appendChild(
    textEl("h2", "3. Pourquoi ça compte", { class: "section-title", id: !theme ? "current-step" : undefined })
  );
  wrap.appendChild(
    el("div", { class: "welcome-card" }, [
      el("p", { style: { margin: "0 0 0.5rem", fontWeight: "800" } }, [
        "Bienvenue en " + level + (level === 1 ? "re" : "e") + " année !",
      ]),
      el("p", { style: { margin: 0 } }, [
        "Nous allons apprendre " + subjData.labelAvecArticle + ". Je vais d'abord te dire pourquoi " + subjData.labelAvecArticle + " " + subjData.sontOuEst + " important" + (subjData.sontOuEst === "sont" ? "es" : "e") + ".",
      ]),
      el("p", { style: { margin: "0.6rem 0 0" } }, [subjData.pourquoi]),
      el("p", { style: { margin: "0.6rem 0 0", fontWeight: "700" } }, ["Es-tu prêt à commencer ?"]),
    ])
  );

  wrap.appendChild(
    textEl("h2", subjLabel + " · " + level + (level === 1 ? "re" : "e") + " année", { class: "section-title" })
  );

  const whyCard = el("div", { class: "why-card" }, [
    el("h3", {}, ["À quoi ça me sert ?"]),
    el("p", { style: { margin: 0 } }, [intro.why]),
    el("div", { class: "why-example" }, ["Par exemple : " + intro.example]),
  ]);
  wrap.appendChild(whyCard);
  wrap.appendChild(speakButton(intro.why + ". Par exemple : " + intro.example, "Écouter la présentation"));

  const themes = SUBJECT_CONTENT[subject][level] || [];
  wrap.appendChild(textEl("h2", "4. Je choisis mon thème", { class: "section-title" }));
  const themeGrid = el("div", { class: "theme-grid" }, []);
  themes.forEach((t) => {
    themeGrid.appendChild(
      el("div", { class: "theme-card" }, [
        el("div", {}, [
          el("div", { style: { fontWeight: "800" } }, [t.label]),
          el("div", { class: "theme-desc" }, [t.desc]),
        ]),
        el(
          "a",
          { class: "btn btn-primary", href: "#/eleve?niveau=" + level + "&matiere=" + subject + "&theme=" + t.id + adaptSuffix },
          ["Découvrir"]
        ),
      ])
    );
  });
  wrap.appendChild(themeGrid);

  if (!theme) return wrap;

  const themeData = themes.find((t) => t.id === theme);
  if (!themeData) return wrap;

  wrap.appendChild(renderThemeWorkspace(subject, level, themeData, { adapte, profil }));

  return wrap;
});

// ------------------------------------------------------------------------
// Espace de travail d'un thème : méthode, exemple, exercices groupés
// ------------------------------------------------------------------------
function renderThemeWorkspace(subject, level, themeData, adaptOptions) {
  const wrap = el("div", {}, []);
  adaptOptions = adaptOptions || { adapte: false, profil: null };

  if (themeData.conceptIntro) {
    wrap.appendChild(renderConceptIntro(themeData.conceptIntro));
  }

  wrap.appendChild(textEl("h2", "Ma méthode", { class: "section-title", id: "current-step" }));
  const methodList = el("ul", { class: "method-list" }, []);
  themeData.method.forEach((step) => methodList.appendChild(textEl("li", step)));
  wrap.appendChild(methodList);
  wrap.appendChild(speakButton(themeData.method.join(". "), "Écouter la méthode"));

  wrap.appendChild(textEl("h2", "Un exemple concret", { class: "section-title" }));
  const exampleCard = el("div", { class: "card-soft" }, [textEl("p", themeData.example, { style: { margin: 0 } })]);
  if (themeData.exampleIllustration) {
    exampleCard.appendChild(renderIllustration(themeData.exampleIllustration));
  }
  wrap.appendChild(exampleCard);

  if (themeData.illustrationQuotidien) {
    wrap.appendChild(renderOrdreQuotidien(themeData.illustrationQuotidien));
  }

  if (adaptOptions.adapte && adaptOptions.profil && adaptOptions.profil.appuiIds.length) {
    wrap.appendChild(textEl("h2", "Mes outils pour ce parcours", { class: "section-title" }));
    wrap.appendChild(
      textEl("p", "Ces outils restent ouverts pendant que tu fais les exercices.", { class: "small muted" })
    );
    const pinnedWrap = el("div", { class: "pinned-appuis" }, []);
    adaptOptions.profil.appuiIds.forEach((id) => {
      const appui = PETALES_APPUIS.find((a) => a.id === id);
      if (!appui) return;
      pinnedWrap.appendChild(renderAppuiPanel(appui));
    });
    wrap.appendChild(pinnedWrap);
  }

  wrap.appendChild(textEl("h2", "Mes exercices", { class: "section-title" }));
  wrap.appendChild(
    textEl(
      "p",
      adaptOptions.adapte
        ? "Un exercice à la fois. Tu peux ouvrir la boîte à outils à tout moment, même avant d'essayer."
        : "Les exercices sont regroupés en petites étapes. Tu peux ouvrir la boîte à outils à tout moment, même avant d'essayer.",
      { class: "small muted" }
    )
  );

  wrap.appendChild(renderExerciseGroups(themeData.exercises, subject, adaptOptions));

  return wrap;
}

// Explique un concept en mots simples AVANT la méthode et les exercices
// (ex. : "qu'est-ce qu'une fraction ?"), avec une illustration au besoin.
// Générique : réutilisable pour d'autres concepts qui ont besoin d'être
// définis avant qu'on commence à s'exercer.
function renderConceptIntro(intro) {
  const box = el("div", { class: "card-soft concept-intro" }, []);
  box.appendChild(textEl("h2", intro.title, { class: "section-title", style: { marginTop: 0 } }));
  box.appendChild(textEl("p", intro.text, { style: { margin: 0 } }));
  if (intro.illustrationFraction) {
    box.appendChild(renderFractionIllustration(intro.illustrationFraction));
  }
  box.appendChild(speakButton(intro.text, "Écouter l'explication"));
  return box;
}

// Une barre divisée en parts égales, certaines coloriées, pour VOIR ce
// qu'une fraction représente avant de lire le nombre 1/4, par exemple.
function renderFractionIllustration(data) {
  const wrap = el("div", { class: "fraction-illustration" }, []);
  const bar = el("div", { class: "fraction-bar" }, []);
  for (let i = 0; i < data.total; i++) {
    bar.appendChild(el("span", { class: "fraction-part" + (i < data.parts ? " filled" : "") }, []));
  }
  wrap.appendChild(bar);
  wrap.appendChild(
    textEl("p", `${data.parts} part${data.parts > 1 ? "s" : ""} sur ${data.total}, ça s'écrit ${data.parts}/${data.total}.`, {
      class: "small",
      style: { fontWeight: 800, textAlign: "center", margin: "0.5rem 0 0" },
    })
  );
  return wrap;
}

function renderIllustration(illustration) {
  const box = el("div", { class: "exo-illustration" }, []);
  const count = Math.min(illustration.count, 30); // on ne surcharge jamais visuellement l'écran
  for (let i = 0; i < count; i++) {
    if (illustration.groupSize && i > 0 && i % illustration.groupSize === 0) {
      box.appendChild(el("span", { style: { width: "100%", height: "0" } }, []));
    }
    box.appendChild(el("span", { class: "obj" }, [illustration.emoji]));
  }
  if (illustration.count > 30) {
    box.appendChild(el("span", { class: "small muted" }, [" (+" + (illustration.count - 30) + ")"]));
  }
  return box;
}

// Deux groupes d'objets, l'un sous l'autre, pour comparer deux quantités.
// Toujours montrer les deux groupes en vrai (pas seulement le plus grand) :
// un enfant qui débute ne compare pas encore deux chiffres seulement dans
// sa tête, il a besoin de compter chaque groupe pour voir lequel est plus grand.
function renderCompareIllustration(groups) {
  const wrap = el("div", { class: "exo-illustration-compare" }, []);
  const labels = ["Premier groupe", "Deuxième groupe"];
  groups.forEach((group, i) => {
    const groupBox = el("div", { class: "exo-illustration-compare-group" }, []);
    groupBox.appendChild(el("div", { class: "small muted exo-illustration-compare-label" }, [labels[i] || ""]));
    groupBox.appendChild(renderIllustration(group));
    wrap.appendChild(groupBox);
  });
  return wrap;
}

// ------------------------------------------------------------------------
// "Dans mon quotidien" : illustre croissant/décroissant en deux temps.
// 1) une image de tailles (par ex. des dés qui grandissent/rapetissent)
//    pour comprendre le MOT croissant/décroissant, sans encore compter ;
// 2) des groupes d'objets réels (par ex. des voitures), avec le chiffre
//    écrit sous chaque groupe, pour relier la quantité vue au nombre écrit.
// ------------------------------------------------------------------------
function renderOrdreQuotidien(data) {
  const emojiTaille = data.emojiTaille || "🎲";
  const emojiGroupe = data.emojiGroupe || "🚗";
  const box = el("div", { class: "card-soft ordre-quotidien" }, []);
  box.appendChild(textEl("h3", "Dans mon quotidien", { style: { marginTop: 0 } }));
  let direction = "croissant";

  const toggleRow = el("div", { class: "btn-row", style: { marginTop: 0 } }, []);
  const btnCroissant = el("button", { type: "button", class: "btn" }, ["Ordre croissant"]);
  const btnDecroissant = el("button", { type: "button", class: "btn" }, ["Ordre décroissant"]);
  toggleRow.append(btnCroissant, btnDecroissant);
  box.appendChild(toggleRow);

  const body = el("div", {}, []);
  box.appendChild(body);

  function draw() {
    btnCroissant.className = "btn " + (direction === "croissant" ? "btn-primary" : "btn-secondary");
    btnDecroissant.className = "btn " + (direction === "decroissant" ? "btn-primary" : "btn-secondary");
    const monte = direction === "croissant";
    const tailles = monte ? [1, 2, 3] : [3, 2, 1];
    const groupes = monte ? [2, 3, 4] : [4, 3, 2];

    body.replaceChildren();
    body.appendChild(
      textEl("p", monte ? "Ces dés grandissent : c'est l'ordre croissant, du plus petit au plus grand." : "Ces dés rapetissent : c'est l'ordre décroissant, du plus grand au plus petit.", {
        class: "small muted",
      })
    );
    const tailleRow = el("div", { class: "ordre-taille-row" }, []);
    tailles.forEach((t) => {
      tailleRow.appendChild(el("span", { class: "ordre-taille-item", style: { fontSize: 1 + t * 0.55 + "rem" } }, [emojiTaille]));
    });
    body.appendChild(tailleRow);

    body.appendChild(
      textEl("p", "Maintenant je compte des objets de la vraie vie, et j'écris le nombre en dessous.", {
        class: "small muted",
        style: { marginTop: "0.9rem" },
      })
    );
    const groupeRow = el("div", { class: "ordre-groupe-row" }, []);
    groupes.forEach((n) => {
      const group = el("div", { class: "ordre-groupe" }, []);
      const objs = el("div", { class: "ordre-groupe-objets" }, []);
      for (let i = 0; i < n; i++) objs.appendChild(el("span", {}, [emojiGroupe]));
      group.append(objs, textEl("strong", String(n), { class: "ordre-groupe-nombre" }));
      groupeRow.appendChild(group);
    });
    body.appendChild(groupeRow);
    body.appendChild(textEl("p", groupes.join(monte ? " < " : " > "), { class: "small", style: { fontWeight: 800 } }));
    body.appendChild(
      speakButton(
        monte
          ? `Les dés grandissent. ${groupes.join(", ")}, les quantités augmentent. C'est l'ordre croissant.`
          : `Les dés rapetissent. ${groupes.join(", ")}, les quantités diminuent. C'est l'ordre décroissant.`,
        "Écouter"
      )
    );
  }
  btnCroissant.onclick = () => {
    direction = "croissant";
    draw();
  };
  btnDecroissant.onclick = () => {
    direction = "decroissant";
    draw();
  };
  draw();
  return box;
}

// ------------------------------------------------------------------------
// Exercices groupés en blocs escaladants (jamais tout affiché d'un coup)
// ------------------------------------------------------------------------
const GROUP_SIZE = 3;
const ENCOURAGEMENTS = [
  "Tu commences : prends ton temps.",
  "Tu avances bien, encore un petit effort.",
  "Tu deviens de plus en plus fort·e !",
  "Regarde tout ce que tu as déjà essayé.",
];

function renderExerciseGroups(exercises, subject, adaptOptions) {
  adaptOptions = adaptOptions || { adapte: false, profil: null };
  const groupSize = adaptOptions.adapte ? 1 : GROUP_SIZE;
  const wrap = el("div", {}, []);
  const groups = [];
  for (let i = 0; i < exercises.length; i += groupSize) {
    groups.push(exercises.slice(i, i + groupSize));
  }

  let currentGroup = 0;
  const groupContainer = el("div", {}, []);
  const navRow = el("div", { class: "exo-nav-row" }, []);
  const closingWrap = el("div", {}, []);

  function renderGroup() {
    groupContainer.innerHTML = "";
    const group = groups[currentGroup];

    const header = el("div", { class: "exo-block-header" }, [
      el("div", { class: "exo-block-title" }, ["🧩 Exercice " + (currentGroup + 1) + (groups.length > 1 ? " sur " + groups.length : "")]),
      el("div", { class: "exo-block-sub" }, [ENCOURAGEMENTS[Math.min(currentGroup, ENCOURAGEMENTS.length - 1)]]),
    ]);
    groupContainer.appendChild(header);

    group.forEach((ex, idxInGroup) => {
      groupContainer.appendChild(renderSingleExercise(ex, subject, currentGroup * groupSize + idxInGroup + 1, exercises.length, adaptOptions));
    });

    navRow.innerHTML = "";
    closingWrap.innerHTML = "";
    if (currentGroup > 0) {
      navRow.appendChild(
        el(
          "button",
          {
            class: "btn btn-secondary",
            type: "button",
            onclick: () => {
              currentGroup -= 1;
              renderGroup();
              groupContainer.scrollIntoView({ behavior: "smooth", block: "start" });
            },
          },
          ["← Exercice précédent"]
        )
      );
    }
    if (currentGroup < groups.length - 1) {
      navRow.appendChild(
        el(
          "button",
          {
            class: "btn btn-primary",
            type: "button",
            onclick: () => {
              currentGroup += 1;
              renderGroup();
              groupContainer.scrollIntoView({ behavior: "smooth", block: "start" });
            },
          },
          ["Exercice suivant →"]
        )
      );
    } else {
      navRow.appendChild(
        el("a", { class: "btn btn-secondary", href: "#/progres" }, ["🗺️ Voir ma carte de progression"])
      );
      closingWrap.appendChild(
        renderPratiqueGuideeEtSolo(() => {
          currentGroup = 0;
          renderGroup();
          groupContainer.scrollIntoView({ behavior: "smooth", block: "start" });
        })
      );
    }
  }

  renderGroup();
  wrap.appendChild(groupContainer);
  wrap.appendChild(navRow);
  wrap.appendChild(closingWrap);
  return wrap;
}

// Une fois tous les exercices d'un thème terminés une première fois, on
// propose deux temps distincts : d'abord recommencer accompagné par un
// adulte en utilisant les stratégies apprises, puis recommencer seul·e
// pour vérifier ce qu'on a vraiment compris.
function renderPratiqueGuideeEtSolo(onRestart) {
  const wrap = el("div", { class: "stack", style: { marginTop: "1.4rem" } }, []);
  wrap.appendChild(textEl("h2", "Je continue à m'entraîner", { class: "section-title" }));

  wrap.appendChild(
    el("div", { class: "card-soft" }, [
      textEl("h3", "👩‍👧 Je m'exerce avec mon adulte", { style: { margin: "0 0 0.4rem" } }),
      textEl(
        "p",
        "Reprends ces exercices avec ton adulte, en utilisant tes stratégies (D'abord → Ensuite, tes outils personnels). Discutez de chaque réponse ensemble.",
        { class: "muted", style: { margin: "0 0 0.7rem" } }
      ),
      el("button", { class: "btn btn-secondary", type: "button", onclick: onRestart }, ["🔁 Recommencer avec mon adulte"]),
    ])
  );

  wrap.appendChild(
    el("div", { class: "card-soft" }, [
      textEl("h3", "🌟 Je m'exerce seul·e", { style: { margin: "0 0 0.4rem" } }),
      textEl(
        "p",
        "Maintenant, essaie de refaire ces exercices tout seul, sans demander d'aide, pour voir tout ce que tu as bien compris.",
        { class: "muted", style: { margin: "0 0 0.7rem" } }
      ),
      el("button", { class: "btn btn-secondary", type: "button", onclick: onRestart }, ["🔁 Recommencer seul·e"]),
    ])
  );

  return wrap;
}

// ------------------------------------------------------------------------
// Un exercice : illustration, choix, indice, D'abord → Ensuite, appui
// ------------------------------------------------------------------------
// Un exercice de réflexion (dé de compréhension avant/pendant/après la
// lecture) : pas de bonne ou de mauvaise réponse, l'important est de
// réfléchir et d'en discuter avec un adulte ou seul·e.
const REFLEXION_PHASE_INFO = {
  avant: { emoji: "🔍", label: "Avant la lecture" },
  pendant: { emoji: "📖", label: "Pendant la lecture" },
  apres: { emoji: "💬", label: "Après la lecture" },
};

// Faces d'un vrai dé à six côtés (un caractère par face), pour que le dé
// affiché montre vraiment le chiffre tiré, pas seulement un texte.
const DIE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function renderReflexionExercise(ex, position, total) {
  const card = el("div", { class: "exo-card" }, []);
  const info = REFLEXION_PHASE_INFO[ex.phase] || { emoji: "🎲", label: "" };

  card.appendChild(el("div", { class: "exo-tag" }, [position <= total - 1 ? "Exercice accompagné " + position : "Exercice autonome"]));
  card.appendChild(textEl("div", info.emoji + " " + info.label, { class: "exo-prompt" }));
  card.appendChild(textEl("p", "Lance le dé pour découvrir une question. Réponds à voix haute, avec un adulte ou seul·e.", { class: "muted" }));

  const dieFace = el("div", { class: "reflexion-die" }, ["🎲"]);
  const questionText = el("p", { style: { fontWeight: "700", margin: 0 } }, ["Clique sur le dé pour voir ta question."]);
  const questionCard = el("div", { class: "card-soft", style: { margin: "0.8rem 0" } }, [questionText]);

  function rollDice() {
    const i = Math.floor(Math.random() * ex.questions.length);
    dieFace.classList.remove("rolling");
    void dieFace.offsetWidth; // relance l'animation même si on clique plusieurs fois de suite
    dieFace.classList.add("rolling");
    setTimeout(() => {
      dieFace.textContent = DIE_FACES[i] || "🎲";
      questionText.textContent = ex.questions[i];
      speak(ex.questions[i]);
    }, 350);
  }

  card.appendChild(el("div", { class: "reflexion-die-wrap" }, [dieFace]));
  card.appendChild(el("button", { class: "btn btn-primary", type: "button", onclick: rollDice }, ["🎲 Lancer le dé de compréhension"]));
  card.appendChild(questionCard);

  const feedback = el("div", {}, []);
  card.appendChild(
    el(
      "button",
      {
        class: "btn btn-secondary",
        type: "button",
        onclick: () => {
          markExercise(ex.id, "reussi");
          addRewardStar();
          renderProgressSidebar();
          feedback.innerHTML = "";
          feedback.appendChild(el("div", { class: "exo-feedback ok" }, ["✅ Merci d'avoir réfléchi à cette question !"]));
        },
      },
      ["✅ J'ai réfléchi ou j'en ai discuté"]
    )
  );
  card.appendChild(feedback);

  if (!currentProfile()) {
    card.appendChild(
      el("p", { class: "small muted", style: { marginTop: "0.6rem" } }, [
        "Tu peux répondre sans prénom. Pour garder tes progrès après cette visite, choisis un prénom en haut de la page.",
      ])
    );
  }

  return card;
}

// Petite illustration originale du moyen mnémotechnique du crocodile pour
// les signes < > = : la bouche grande ouverte se tourne vers le plus grand
// nombre, la pointe montre le plus petit. Pour =, pas de crocodile, juste
// le signe.
function crocMouthSVG(sign) {
  if (sign === "=") return '<span class="croc-equal">=</span>';
  const flip = sign === ">" ? "scaleX(-1)" : "none";
  return (
    '<svg viewBox="0 0 110 90" aria-hidden="true" style="transform:' +
    flip +
    '"><polygon points="14,45 96,12 96,78" fill="#4f9d6e" stroke="#1d5a3c" stroke-width="4" stroke-linejoin="round"/>' +
    '<path d="M40,26 L48,34 M40,64 L48,56" stroke="#eafff0" stroke-width="4" stroke-linecap="round"/>' +
    '<circle cx="30" cy="24" r="7" fill="#eafff0"/><circle cx="31" cy="24" r="2.6" fill="#173829"/></svg>'
  );
}

function renderSingleExercise(ex, subject, position, total, adaptOptions) {
  adaptOptions = adaptOptions || { adapte: false, profil: null };

  if (ex.type === "reflexion") {
    return renderReflexionExercise(ex, position, total);
  }

  const card = el("div", { class: "exo-card" }, []);
  const profile = currentProfile();
  const status = profile ? profile.exerciseStatus[ex.id] : null;

  card.appendChild(el("div", { class: "exo-tag" }, [position <= total - 1 ? "Exercice accompagné " + position : "Exercice autonome"]));
  card.appendChild(textEl("div", ex.prompt, { class: "exo-prompt" }));

  if (ex.illustrationCompare) {
    card.appendChild(renderCompareIllustration(ex.illustrationCompare));
  } else if (ex.illustration) {
    card.appendChild(renderIllustration(ex.illustration));
  }

  card.appendChild(speakButton(ex.listenText, "Écouter la consigne"));

  // D'abord -> Ensuite (adapter cet exercice) — ouvert d'avance en mode adapté
  card.appendChild(renderDabordEnsuite(ex, adaptOptions.adapte));

  // Choisir un outil pour cet exercice (appuis PÉTALES rapides)
  card.appendChild(renderQuickToolPicker(ex.id));

  // Réponse
  const feedback = el("div", {}, []);
  if (ex.type === "lecture-mot") {
    const wordBtn = el(
      "button",
      { class: "btn btn-secondary", type: "button", onclick: () => speak(ex.word) },
      ["🔊 Cliquer pour entendre : " + ex.word]
    );
    card.appendChild(wordBtn);
  }

  const choicesRow = el("div", { class: "exo-choices" }, []);
  let selected = null;
  ex.choices.forEach((choice) => {
    const btn = el(
      "button",
      {
        class: "choice-btn",
        type: "button",
        onclick: () => {
          selected = choice;
          Array.from(choicesRow.children).forEach((c) => c.classList.remove("selected"));
          btn.classList.add("selected");
        },
      },
      [String(choice)]
    );
    choicesRow.appendChild(btn);
  });
  card.appendChild(choicesRow);

  // Signes < > = : on affiche d'abord le crocodile en grand (avec
  // l'explication), puis en plus petit, puis on le retire (bouton pour le
  // faire revenir au besoin) — l'appui diminue progressivement.
  if (ex.type === "signe") {
    choicesRow.classList.add("signe-choices");
    const paintCroc = (size) => {
      Array.from(choicesRow.children).forEach((b, i) => {
        const sign = ex.choices[i];
        b.classList.remove("signe-btn-grand", "signe-btn-petit");
        b.classList.add("signe-btn", "signe-btn-" + size);
        b.innerHTML = crocMouthSVG(sign) + (sign === "=" ? "" : '<span class="signe-btn-label">' + sign + "</span>");
      });
    };
    if (ex.crocoStage === "grand") {
      paintCroc("grand");
      card.appendChild(
        textEl("p", "La bouche grande ouverte se tourne vers le plus grand nombre. La pointe montre le plus petit. Si c'est pareil, je choisis =.", {
          class: "small muted",
        })
      );
    } else if (ex.crocoStage === "petit") {
      paintCroc("petit");
      card.appendChild(textEl("p", "Le crocodile devient plus petit : je regarde surtout le signe, maintenant.", { class: "small muted" }));
    } else {
      card.appendChild(
        el(
          "button",
          { type: "button", class: "btn btn-ghost", onclick: () => paintCroc("petit") },
          ["🐊 Revoir le crocodile"]
        )
      );
    }
  }

  const verifyBtn = el(
    "button",
    {
      class: "btn btn-primary",
      type: "button",
      onclick: () => {
        feedback.innerHTML = "";
        if (selected === null) {
          feedback.appendChild(el("div", { class: "exo-feedback essai" }, ["Choisis une réponse avant de vérifier."]));
          return;
        }
        const isCorrect = String(selected) === String(ex.correct);
        Array.from(choicesRow.children).forEach((c) => {
          if (c.textContent === String(ex.correct)) c.classList.add("correct");
          else if (c.classList.contains("selected") && !isCorrect) c.classList.add("incorrect");
        });
        markExercise(ex.id, isCorrect ? "reussi" : "essaye");
        addRewardStar();
        if (ex.type === "lecture-mot" && ex.word) {
          logLivretEntry(ex.id, ex.word);
        }
        renderProgressSidebar();
        feedback.appendChild(
          el("div", { class: "exo-feedback " + (isCorrect ? "ok" : "essai") }, [
            isCorrect ? "✅ Bonne réponse !" : "🌱 Tu as essayé, c'est déjà une réussite en soi.",
          ])
        );
        // Un outil OUVERT pendant cet exercice n'est pas forcément un outil
        // qui a aidé : on le demande directement à l'enfant, pour que le
        // bilan (espace parents/professionnels) distingue les deux.
        if (profile) {
          const usedIds = Array.from(
            new Set((profile.appuisLog || []).filter((l) => l.context === ex.id).map((l) => l.appuiId))
          );
          if (usedIds.length) {
            const reviewWrap = el("div", { class: "helpful-review" }, []);
            reviewWrap.appendChild(
              textEl("p", "Un de ces outils t'a aidé ? Tu peux le dire (facultatif) :", { class: "small muted" })
            );
            usedIds.forEach((appuiId) => {
              const appui = PETALES_APPUIS.find((a) => a.id === appuiId);
              if (!appui) return;
              const label = appui.emoji + " " + appui.label;
              const btn = el("button", { type: "button", class: "btn btn-secondary" }, [
                (isAppuiHelpful(profile, ex.id, appuiId) ? "✓ " : "") + label,
              ]);
              btn.addEventListener("click", () => {
                markAppuiHelpful(ex.id, appuiId);
                btn.textContent = "✓ " + label;
              });
              reviewWrap.appendChild(btn);
            });
            feedback.appendChild(reviewWrap);
          }
        }
      },
    },
    ["Vérifier ma réponse"]
  );
  card.appendChild(verifyBtn);
  card.appendChild(feedback);

  const hintBtn = el(
    "button",
    {
      class: "btn btn-ghost",
      type: "button",
      onclick: () => {
        if (card.querySelector(".hint-text")) return;
        card.appendChild(el("p", { class: "small muted hint-text" }, ["💡 " + ex.hint]));
      },
    },
    ["Voir un indice"]
  );
  card.appendChild(hintBtn);

  if (!profile) {
    card.appendChild(
      el("p", { class: "small muted", style: { marginTop: "0.6rem" } }, [
        "Tu peux répondre sans prénom. Pour garder tes progrès après cette visite, choisis un prénom en haut de la page.",
      ])
    );
  } else if (status) {
    card.appendChild(el("p", { class: "small", style: { marginTop: "0.4rem", fontWeight: "700", color: "var(--role-pro-dark)" } }, [
      status === "reussi" ? "✅ Déjà réussi" : "🌱 Déjà essayé",
    ]));
  }

  return card;
}

function renderDabordEnsuite(ex, startOpen) {
  const wrap = el("div", { class: "card-soft", style: { marginBottom: "0.9rem" } }, []);
  const toggleBtn = el(
    "button",
    { class: "btn btn-secondary", type: "button" },
    ["🗂️ D'abord → Ensuite : adapter cet exercice"]
  );
  const body = el("div", { style: { display: startOpen ? "block" : "none", marginTop: "0.8rem" } }, []);

  let stepIndex = 0;
  const stepView = el("div", {}, []);
  function renderStep() {
    stepView.innerHTML = "";
    stepView.appendChild(
      el("p", { style: { fontWeight: "700", margin: "0 0 0.4rem" } }, ["Étape " + (stepIndex + 1) + " sur " + ex.abordEnsuite.length])
    );
    stepView.appendChild(el("p", { style: { margin: 0 } }, [ex.abordEnsuite[stepIndex]]));
    const nav = el("div", { class: "btn-row" }, []);
    if (stepIndex > 0) {
      nav.appendChild(el("button", { class: "btn btn-ghost", type: "button", onclick: () => { stepIndex -= 1; renderStep(); } }, ["← Précédent"]));
    }
    if (stepIndex < ex.abordEnsuite.length - 1) {
      nav.appendChild(el("button", { class: "btn btn-secondary", type: "button", onclick: () => { stepIndex += 1; renderStep(); } }, ["Suivant →"]));
    } else {
      nav.appendChild(
        el(
          "button",
          {
            class: "btn btn-primary",
            type: "button",
            onclick: () => {
              logAppuiUsed("dabord-ensuite", ex.id, true);
              stepView.appendChild(el("p", { class: "exo-feedback ok", style: { marginTop: "0.6rem" } }, ["🌱 J'ai suivi les étapes pour cet exercice."]));
            },
          },
          ["J'ai suivi cette étape"]
        )
      );
    }
    stepView.appendChild(nav);
  }
  renderStep();
  body.appendChild(stepView);

  toggleBtn.addEventListener("click", () => {
    body.style.display = body.style.display === "none" ? "block" : "none";
  });

  wrap.appendChild(toggleBtn);
  wrap.appendChild(body);
  return wrap;
}

const QUICK_STRATEGY_IDS = ["aide", "pause", "respire", "dessine", "une-etape"];

function renderQuickToolPicker(exId) {
  const wrap = el("div", { class: "quick-strategy-wrap" }, []);
  const toggleBtn = el(
    "button",
    { class: "quick-strategy-toggle", type: "button" },
    ["🔍 Je cherche une stratégie"]
  );
  const body = el("div", { style: { display: "none", marginTop: "0.8rem" } }, []);
  body.appendChild(
    textEl(
      "p",
      "C'est normal que ce soit parfois difficile. Voici quelques outils qui peuvent aider :",
      { class: "small muted", style: { margin: "0 0 0.6rem" } }
    )
  );
  const quickGrid = el("div", { class: "appui-grid" }, []);
  const panelHolder = el("div", {}, []);
  QUICK_STRATEGY_IDS.forEach((id) => {
    const appui = PETALES_APPUIS.find((a) => a.id === id);
    if (!appui) return;
    const btn = el(
      "button",
      { class: "appui-btn", type: "button" },
      [el("span", { class: "appui-emoji" }, [appui.emoji]), appui.label]
    );
    btn.addEventListener("click", () => {
      Array.from(quickGrid.children).forEach((c) => c.classList.remove("selected"));
      btn.classList.add("selected");
      panelHolder.innerHTML = "";
      panelHolder.appendChild(renderAppuiPanel(appui));
      logAppuiUsed(appui.id, exId);
      renderProgressSidebar();
    });
    quickGrid.appendChild(btn);
  });
  body.appendChild(quickGrid);
  body.appendChild(panelHolder);
  body.appendChild(el("a", { class: "small", href: "#/besoins", style: { display: "inline-block", marginTop: "0.4rem" } }, ["Voir tous mes appuis →"]));

  toggleBtn.addEventListener("click", () => {
    body.style.display = body.style.display === "none" ? "block" : "none";
  });

  wrap.appendChild(toggleBtn);
  wrap.appendChild(body);
  return wrap;
}

// ------------------------------------------------------------------------
// Page : Mes premiers pas en français
// ------------------------------------------------------------------------
route("/premiers-pas", function renderPremiersPas() {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h1", "Mes premiers pas en français", { class: "page-title" }));
  wrap.appendChild(
    textEl(
      "p",
      "Pour les élèves qui découvrent le français à l'oral avant l'écrit. Le silence ou l'absence de réponse ne veut jamais dire un échec : ça veut dire qu'on prend le temps.",
      { class: "lede" }
    )
  );

  wrap.appendChild(renderProfilePicker());

  wrap.appendChild(textEl("h2", "🗣️ Je comprends ce qu'on me demande", { class: "section-title" }));
  wrap.appendChild(textEl("p", "J'écoute une consigne simple, puis je montre ou j'entoure la bonne réponse.", { class: "small muted" }));

  const compWrap = el("div", { class: "card" }, []);
  let compIndex = 0;
  function renderComp() {
    compWrap.innerHTML = "";
    const item = PREMIERS_PAS_CONTENT.comprehension[compIndex];
    compWrap.appendChild(textEl("p", item.consigne, { style: { fontWeight: "800", fontSize: "1.1rem" } }));
    compWrap.appendChild(speakButton(item.consigne, "Écouter la consigne"));
    const choices = el("div", { class: "exo-choices" }, []);
    item.choices.forEach((c) => {
      choices.appendChild(
        el(
          "button",
          {
            class: "choice-btn",
            type: "button",
            onclick: (e) => {
              const isCorrect = c === item.correct;
              e.target.classList.add(isCorrect ? "correct" : "incorrect");
              setTimeout(() => {
                compIndex = (compIndex + 1) % PREMIERS_PAS_CONTENT.comprehension.length;
                renderComp();
              }, 700);
            },
          },
          [c]
        )
      );
    });
    compWrap.appendChild(choices);
    compWrap.appendChild(
      el("p", { class: "small muted", style: { marginTop: "0.6rem" } }, [
        "Pas de réponse tout de suite, ce n'est pas grave. Je peux réessayer ou passer à autre chose.",
      ])
    );
  }
  renderComp();
  wrap.appendChild(compWrap);

  wrap.appendChild(textEl("h2", "🔤 Touche pour prononcer : les lettres et leurs sons", { class: "section-title" }));
  wrap.appendChild(
    textEl(
      "p",
      "Une progression complète, de la lettre isolée jusqu'aux mots complets. L'ordre peut être ajusté par l'adulte.",
      { class: "small muted" }
    )
  );
  const sonsStatus = textEl("p", "", { role: "status", class: "small muted" });
  const sonsGrid = el("div", { class: "chip-grid" }, []);
  PREMIERS_PAS_CONTENT.sons.forEach((s) => {
    const rec = (STORE.soundRecordings || {})[s.lettre];
    sonsGrid.appendChild(
      el(
        "button",
        { class: "chip-btn", type: "button", onclick: () => playRecordedOrSpoken(s, sonsStatus) },
        [(rec && rec.approved ? "🔊 " : "🔈 ") + s.lettre]
      )
    );
  });
  wrap.appendChild(sonsGrid);
  wrap.appendChild(sonsStatus);
  wrap.appendChild(
    el("details", { class: "note-box", style: { marginTop: "1rem" } }, [
      el("summary", { style: { cursor: "pointer", fontWeight: "700" } }, ["Préparer les enregistrements des lettres et des sons (adulte)"]),
      el("p", { class: "small", style: { marginTop: "0.6rem" } }, [
        "La voix automatique peut mal prononcer certains sons isolés du français. Un adulte peut préparer un vrai enregistrement humain pour chaque son : il remplace alors la voix automatique ici.",
      ]),
      el("a", { class: "btn btn-secondary", href: "#/sons-adulte" }, ["🔊 Préparer les sons enregistrés"]),
    ])
  );

  return wrap;
});

// ------------------------------------------------------------------------
// Page : Mes besoins particuliers (PÉTALES)
// ------------------------------------------------------------------------
route("/besoins", function renderBesoins() {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h1", "Mes besoins particuliers", { class: "page-title" }));
  wrap.appendChild(
    textEl(
      "p",
      "Tu peux utiliser un outil quand tu veux, même avant de commencer. Ce n'est pas réservé aux moments difficiles.",
      { class: "lede" }
    )
  );

  wrap.appendChild(renderProfilePicker());

  wrap.appendChild(textEl("h2", "Mes outils personnels", { class: "section-title" }));
  const grid = el("div", { class: "appui-grid" }, []);
  const panelHolder = el("div", {}, []);

  function selectAppui(appui, btn) {
    Array.from(grid.children).forEach((c) => c.classList.remove("selected"));
    btn.classList.add("selected");
    panelHolder.innerHTML = "";
    panelHolder.appendChild(renderAppuiPanel(appui));
  }

  PETALES_APPUIS.forEach((appui) => {
    const btn = el(
      "button",
      { class: "appui-btn", type: "button" },
      [el("span", { class: "appui-emoji" }, [appui.emoji]), appui.label]
    );
    btn.addEventListener("click", () => selectAppui(appui, btn));
    grid.appendChild(btn);
  });

  wrap.appendChild(grid);
  wrap.appendChild(panelHolder);

  wrap.appendChild(textEl("h2", "Mes parcours adaptés", { class: "section-title" }));
  wrap.appendChild(
    textEl(
      "p",
      "Je choisis ce qui m'aiderait le plus en ce moment. Les exercices restent les mêmes matières, mais ils s'ouvrent avec ces outils déjà prêts et un exercice à la fois.",
      { class: "small muted" }
    )
  );
  const parcoursGrid = el("div", { class: "parcours-grid" }, []);
  PARCOURS_BESOINS.forEach((p) => {
    const card = el("div", { class: "parcours-card" }, [
      el("div", { class: "parcours-emoji" }, [p.emoji]),
      el("div", { class: "parcours-titre" }, [p.titre]),
      el("div", { class: "small muted" }, [p.description]),
      el(
        "a",
        { class: "btn btn-primary", href: "#/eleve?adapte=1&profil=" + p.id, style: { marginTop: "0.7rem" } },
        ["Commencer avec ce parcours"]
      ),
      el("details", { class: "parcours-note" }, [
        el("summary", {}, ["Pour l'adulte"]),
        el("p", { class: "small muted", style: { margin: "0.4rem 0 0" } }, [p.noteAdulte]),
      ]),
    ]);
    parcoursGrid.appendChild(card);
  });
  wrap.appendChild(parcoursGrid);

  wrap.appendChild(textEl("h2", "Ou sans parcours particulier", { class: "section-title" }));
  wrap.appendChild(
    textEl("p", "Je garde les matières scolaires telles quelles, sans outils épinglés d'avance.", { class: "small muted" })
  );
  wrap.appendChild(el("a", { class: "btn btn-secondary", href: "#/eleve" }, ["Aller à l'espace élève"]));

  wrap.appendChild(
    el("details", { class: "note-box", style: { marginTop: "1.4rem" } }, [
      el("summary", { style: { cursor: "pointer", fontWeight: "700" } }, ["Pour l'adulte qui accompagne"]),
      el("p", { class: "small", style: { marginTop: "0.6rem", marginBottom: "0.6rem" } }, [
        "Ces outils viennent du modèle PÉTALES, conçu par Nelly Folefack, travailleuse sociale, pour choisir un appui selon la fonction exécutive touchée plutôt qu'au hasard.",
      ]),
      el("a", { class: "btn btn-secondary", href: "#/fonctions-executives" }, ["Comprendre PÉTALES et les fonctions exécutives"]),
    ])
  );

  return wrap;
});

function renderAppuiPanel(appui) {
  const panel = el("div", { class: "appui-panel" }, []);
  panel.appendChild(textEl("h3", appui.emoji + " " + appui.label, {}));
  panel.appendChild(textEl("p", appui.description, { class: "small muted" }));

  if (appui.type === "phrases") {
    const list = el("div", { class: "appui-phrase-list" }, []);
    appui.phrases.forEach((p) => {
      list.appendChild(
        el(
          "button",
          {
            class: "appui-phrase-btn",
            type: "button",
            onclick: () => speak(p),
          },
          ["🔊 " + p]
        )
      );
    });
    panel.appendChild(list);
  } else if (appui.type === "respiration") {
    panel.appendChild(renderBreathingSquare());
  } else if (appui.type === "dessin") {
    panel.appendChild(renderDrawingTool());
  } else if (appui.type === "ressenti") {
    panel.appendChild(renderRessentiPicker());
  } else if (appui.type === "checklist") {
    panel.appendChild(renderChecklist());
  }

  const triedRow = el("div", {}, []);
  const triedBtn = el(
    "button",
    {
      class: "btn btn-primary",
      type: "button",
      onclick: () => {
        logAppuiUsed(appui.id, "besoins-particuliers", true);
        renderProgressSidebar();
        triedRow.innerHTML = "";
        triedRow.appendChild(
          el("div", { class: "appui-tried-confirm" }, [
            "🌱 J'ai utilisé cet appui. Ça s'affiche maintenant sur ma carte de progression.",
          ])
        );
      },
    },
    ["🌱 J'ai utilisé cette stratégie"]
  );
  triedRow.appendChild(triedBtn);
  panel.appendChild(triedRow);

  return panel;
}

function renderBreathingSquare() {
  const wrap = el("div", { style: { textAlign: "center", padding: "1rem 0" } }, []);
  const square = el(
    "div",
    {
      style: {
        width: "120px",
        height: "120px",
        margin: "0 auto",
        border: "6px solid var(--role-decouverte-dark)",
        borderRadius: "1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "800",
        color: "var(--role-decouverte-dark)",
        transition: "transform 4s ease-in-out",
      },
    },
    ["🟦"]
  );
  const label = el("p", { style: { fontWeight: "700", marginTop: "0.8rem" } }, ["Inspire..."]);
  wrap.appendChild(square);
  wrap.appendChild(label);

  const cycle = ["Inspire...", "Retiens...", "Expire...", "Retiens..."];
  let step = 0;
  let timer = null;
  const startBtn = el(
    "button",
    {
      class: "btn btn-secondary",
      type: "button",
      onclick: () => {
        if (timer) return;
        timer = setInterval(() => {
          step = (step + 1) % cycle.length;
          label.textContent = cycle[step];
          square.style.transform = step % 2 === 0 ? "scale(1.15)" : "scale(1)";
        }, 4000);
        label.textContent = cycle[0];
      },
    },
    ["Commencer à respirer"]
  );
  const stopBtn = el(
    "button",
    {
      class: "btn btn-ghost",
      type: "button",
      onclick: () => {
        if (timer) clearInterval(timer);
        timer = null;
        label.textContent = "Inspire...";
        square.style.transform = "scale(1)";
      },
    },
    ["Arrêter"]
  );
  wrap.appendChild(el("div", { class: "btn-row", style: { justifyContent: "center" } }, [startBtn, stopBtn]));
  return wrap;
}

function renderDrawingTool() {
  const wrap = el("div", {}, []);
  const canvasWrap = el("div", { class: "draw-canvas-wrap" }, []);
  const canvas = el("canvas", { width: "400", height: "260" }, []);
  canvasWrap.appendChild(canvas);
  wrap.appendChild(canvasWrap);

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#5b3d8a";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  let drawing = false;
  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = e.touches ? e.touches[0] : e;
    return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY };
  }
  function start(e) {
    drawing = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  }
  function move(e) {
    if (!drawing) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  }
  function end() {
    drawing = false;
  }
  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);

  const gallery = el("div", { class: "draw-gallery" }, []);
  const profile = currentProfile();
  if (profile && profile.drawings.length) {
    profile.drawings.slice(-6).forEach((d) => {
      gallery.appendChild(el("img", { src: d.dataUrl, alt: "Dessin gardé" }, []));
    });
  }

  const btnRow = el("div", { class: "btn-row" }, [
    el(
      "button",
      {
        class: "btn btn-secondary",
        type: "button",
        onclick: () => {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        },
      },
      ["Effacer l'ardoise"]
    ),
    el(
      "button",
      {
        class: "btn btn-primary",
        type: "button",
        onclick: () => {
          if (!currentProfile()) {
            alert("Choisis un prénom en haut de la page pour garder ton dessin.");
            return;
          }
          const dataUrl = canvas.toDataURL("image/png");
          saveDrawing(dataUrl);
          gallery.appendChild(el("img", { src: dataUrl, alt: "Dessin gardé" }, []));
        },
      },
      ["💾 Garder mon dessin"]
    ),
  ]);
  wrap.appendChild(btnRow);
  wrap.appendChild(el("p", { class: "small muted" }, ["Tes dessins gardés apparaissent ici, et sur ta carte de progression."]));
  wrap.appendChild(gallery);

  return wrap;
}

function renderRessentiPicker() {
  const options = [
    { emoji: "😊", label: "Ça va bien" },
    { emoji: "😐", label: "Ça va, moyen" },
    { emoji: "😟", label: "C'est difficile" },
    { emoji: "😢", label: "J'ai besoin d'aide" },
  ];
  const wrap = el("div", { class: "exo-choices" }, []);
  options.forEach((o) => {
    wrap.appendChild(
      el(
        "button",
        {
          class: "choice-btn",
          type: "button",
          onclick: (e) => {
            Array.from(wrap.children).forEach((c) => c.classList.remove("selected"));
            e.currentTarget.classList.add("selected");
          },
        },
        [o.emoji + " " + o.label]
      )
    );
  });
  return wrap;
}

function renderChecklist() {
  const items = ["Je lis la consigne", "J'essaie une première fois", "Je vérifie ma réponse", "Je dis si un appui m'a aidé"];
  const wrap = el("div", { class: "stack" }, []);
  items.forEach((item) => {
    const id = "chk-" + Math.random().toString(36).slice(2);
    const row = el("label", { style: { display: "flex", gap: "0.6rem", alignItems: "center" } }, [
      el("input", { type: "checkbox", id }, []),
      item,
    ]);
    wrap.appendChild(row);
  });
  return wrap;
}

// ------------------------------------------------------------------------
// Page : Ma carte de progression
// ------------------------------------------------------------------------
route("/progres", function renderProgres() {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h1", "Ma carte de progression", { class: "page-title" }));
  wrap.appendChild(
    textEl("p", "Choisis ton arbre ou ton train pour retrouver tes petits pas. Une pause ne retire jamais un progrès.", { class: "lede" })
  );
  wrap.appendChild(renderProfilePicker());

  const profile = currentProfile();
  if (!profile) {
    wrap.appendChild(el("p", { class: "muted" }, ["Choisis un prénom pour voir ta carte de progression."]));
    return wrap;
  }

  wrap.appendChild(renderProgressChoice(profile, false));

  wrap.appendChild(textEl("h2", "Mes appuis utilisés récemment", { class: "section-title" }));
  const appuisList = el("div", { class: "stack" }, []);
  if (!profile.appuisLog.length) {
    appuisList.appendChild(el("p", { class: "muted small" }, ["Aucun appui utilisé pour l'instant."]));
  } else {
    profile.appuisLog.slice(-8).reverse().forEach((log) => {
      const appui = PETALES_APPUIS.find((a) => a.id === log.appuiId);
      appuisList.appendChild(
        el("div", { class: "card-soft" }, [
          (appui ? appui.emoji + " " + appui.label : log.appuiId) + " (" + new Date(log.at).toLocaleDateString("fr-CA") + ")",
        ])
      );
    });
  }
  wrap.appendChild(appuisList);

  if (profile.drawings.length) {
    wrap.appendChild(textEl("h2", "Mes dessins gardés", { class: "section-title" }));
    const gallery = el("div", { class: "draw-gallery" }, []);
    profile.drawings.slice(-8).forEach((d) => gallery.appendChild(el("img", { src: d.dataUrl }, [])));
    wrap.appendChild(gallery);
  }

  return wrap;
});

function computeSubjectStats(subjectId, profile) {
  let total = 0;
  let done = 0;
  LEVELS.forEach((lvl) => {
    (SUBJECT_CONTENT[subjectId][lvl] || []).forEach((theme) => {
      theme.exercises.forEach((ex) => {
        total += 1;
        if (profile.exerciseStatus[ex.id]) done += 1;
      });
    });
  });
  return { total, done };
}

function renderSubjectProgress(subject, profile) {
  const wrap = el("div", {}, []);
  const stats = computeSubjectStats(subject.id, profile);
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  wrap.appendChild(textEl("h3", subject.emoji + " " + subject.label, { style: { margin: "0 0 0.3rem" } }));
  wrap.appendChild(textEl("p", stats.done + " exercice(s) touché(s) sur " + stats.total, { class: "small muted" }));

  const track = el("div", { class: "progress-track" }, []);
  track.appendChild(el("div", { class: "progress-track-fill", style: { width: Math.max(pct, 4) + "%" } }, []));
  track.appendChild(el("div", { class: "progress-track-char", style: { left: Math.max(pct, 4) + "%" } }, ["🚂"]));
  wrap.appendChild(track);

  wrap.appendChild(
    el("div", { class: "progress-legend" }, [
      el("span", {}, [el("span", { class: "legend-dot", style: { background: "var(--role-decouverte-dark)" } }, []), "avancement"]),
      el("span", {}, ["🌱 essayé", " · ", "✅ réussi"]),
    ])
  );

  return wrap;
}

// ------------------------------------------------------------------------
// Barre latérale de progression (toujours visible sur grand écran)
// ------------------------------------------------------------------------
function renderProgressSidebar() {
  const sidebar = document.getElementById("progress-sidebar");
  if (!sidebar) return;
  sidebar.innerHTML = "";
  sidebar.appendChild(el("div", { class: "sidebar-title" }, ["🗺️ Ma carte de progression"]));
  const body = el("div", { class: "sidebar-body" }, []);
  const profile = currentProfile();
  if (!profile) {
    body.appendChild(el("p", { class: "small muted" }, ["Choisis un prénom pour voir ta progression ici."]));
  } else {
    body.appendChild(renderProgressChoice(profile, true));
    body.appendChild(el("a", { class: "btn btn-secondary", href: "#/progres" }, ["Voir le détail"]));
  }
  sidebar.appendChild(body);
}

// ------------------------------------------------------------------------
// Vue alternative de la progression : « l'arbre des petits pas ». Elle ne
// crée aucune nouvelle donnée : elle raconte ce qui existe déjà (exercices
// essayés/réussis, appuis confirmés par l'enfant) sous forme de feuilles,
// fleurs et fruits plutôt que de trains par matière, pour les enfants qui
// se retrouvent mieux dans cette image-là. Le choix de vue est mémorisé
// par profil.
// ------------------------------------------------------------------------
const TREE_TOKEN_ICONS = {
  leaf: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 30 C4 14 16 6 32 8 C33 24 18 34 8 30Z" fill="#5c9a4a"/><path d="M9 29 L27 11" stroke="#2c5626" stroke-width="2.5" fill="none"/></svg>',
  flower:
    '<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="#e997ba"><circle cx="20" cy="10" r="8"/><circle cx="30" cy="18" r="8"/><circle cx="26" cy="29" r="8"/><circle cx="14" cy="29" r="8"/><circle cx="10" cy="18" r="8"/></g><circle cx="20" cy="20" r="7" fill="#ffce54"/></svg>',
  fruit:
    '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 12 C2 2 2 32 15 35 Q20 32 25 35 C38 32 38 2 20 12Z" fill="#e0605c"/><path d="M20 13 L22 4" stroke="#77502f" stroke-width="2.5"/><path d="M23 8 Q26 2 34 6 Q30 13 23 8" fill="#4a9150"/></svg>',
};
const TREE_TOKEN_EMOJI = { leaf: "🍃", flower: "🌸", fruit: "🍎" };

function treeRecords(profile) {
  const catalog = buildExerciseCatalog();
  const records = [];
  Object.entries(profile.exerciseStatus || {}).forEach(([id, status]) => {
    if (status !== "essaye" && status !== "reussi") return;
    const label = catalog[id] || "une activité";
    records.push({ type: "leaf", label: "J'ai essayé : " + label });
    if (status === "reussi") {
      records.push({ type: "fruit", label: "J'ai réussi cette étape, avec ou sans aide : " + label });
    }
  });
  const seen = new Set();
  const addFlower = (appuiId, context) => {
    const key = appuiId + "|" + (context || "general");
    if (seen.has(key)) return;
    seen.add(key);
    const appui = PETALES_APPUIS.find((a) => a.id === appuiId);
    const appuiLabel = appui ? appui.emoji + " " + appui.label : "ma stratégie";
    const contextLabel = catalog[context] ? "Pour : " + catalog[context] : "Utilisation générale, sans exercice associé.";
    records.push({ type: "flower", label: "J'ai utilisé une aide : " + appuiLabel + ". " + contextLabel });
  };
  (profile.appuisLog || []).filter((log) => log.confirmed === true).forEach((log) => addFlower(log.appuiId, log.context));
  Object.entries(profile.appuisHelpful || {}).filter(([, helpful]) => helpful).forEach(([key]) => {
    const sep = key.lastIndexOf("|");
    if (sep >= 0) addFlower(key.slice(sep + 1), key.slice(0, sep));
  });
  return records;
}

function renderSmallStepsTree(profile, compact) {
  const records = treeRecords(profile);
  const panel = el("section", { class: "small-steps-tree" }, []);
  panel.appendChild(textEl(compact ? "h3" : "h2", "Mon arbre des petits pas"));
  panel.appendChild(textEl("p", "Chaque petit pas laisse une trace, même les jours où j'ai eu besoin d'aide.", { class: "small" }));

  const stage = el("div", { class: "tree-stage" }, []);
  // Illustration décorative d'origine (pas un dessin technique) : un tronc
  // simple et un feuillage fait de cercles superposés.
  stage.innerHTML =
    '<svg viewBox="0 0 300 280" aria-hidden="true">' +
    '<ellipse cx="150" cy="262" rx="105" ry="11" fill="#dcefc9"/>' +
    '<rect x="140" y="150" width="20" height="112" rx="9" fill="#8a5c3a"/>' +
    '<circle cx="95" cy="150" r="55" fill="#e3f0d0"/>' +
    '<circle cx="205" cy="150" r="55" fill="#e3f0d0"/>' +
    '<circle cx="150" cy="90" r="60" fill="#f0f8e3" stroke="#c7dfa9" stroke-width="2"/>' +
    "</svg>";

  const visible = records.slice(-18);
  const feedback = textEl(
    "p",
    records.length
      ? "Touche une feuille, une fleur ou un fruit pour le relire."
      : "L'arbre est prêt. Une première feuille apparaîtra après ton premier exercice essayé.",
    { class: "tree-feedback small", role: "status", "aria-live": "polite" }
  );

  visible.forEach((record, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const left = 14 + col * 14 + (row % 2) * 6;
    const top = 24 + row * 22;
    const btn = el(
      "button",
      {
        type: "button",
        class: "tree-token",
        "aria-label": record.label,
        style: { left: left + "%", top: top + "%" },
        onclick: () => {
          feedback.textContent = record.label;
        },
      },
      []
    );
    btn.innerHTML = TREE_TOKEN_ICONS[record.type];
    stage.appendChild(btn);
  });

  panel.appendChild(stage);
  panel.appendChild(feedback);

  if (!compact) {
    panel.appendChild(textEl("p", "🍃 Un exercice essayé · 🌸 Une aide confirmée · 🍎 Une étape réussie", { class: "small" }));
    panel.appendChild(textEl("p", "Une erreur, une pause ou une absence ne retire jamais rien à cet arbre.", { class: "small" }));
    if (records.length) {
      const details = el("details", {}, [el("summary", {}, ["Retrouver tous mes petits pas (" + records.length + ")"])]);
      const list = el("ul", { class: "tree-history" }, []);
      records.forEach((r) => {
        list.appendChild(textEl("li", TREE_TOKEN_EMOJI[r.type] + " " + r.label));
      });
      details.appendChild(list);
      panel.appendChild(details);
      if (records.length > 18) {
        panel.appendChild(
          textEl("p", "L'arbre affiche tes 18 dernières traces. Les autres restent dans la liste complète ci-dessus.", { class: "small" })
        );
      }
    }
  }
  return panel;
}

function renderProgressChoice(profile, compact) {
  const wrap = el("div", { class: "tree-choice" }, []);
  const controls = el("div", { class: "btn-row", role: "group", "aria-label": "Choisir la présentation de mes progrès" }, []);
  const content = el("div", {}, []);
  const views = [
    ["arbre", "🌳 Mon arbre"],
    ["train", "🚂 Mon train"],
  ];
  const buttons = [];

  function draw() {
    const selected = profile.progressView || "arbre";
    buttons.forEach(([value, btn]) => btn.setAttribute("aria-pressed", String(value === selected)));
    content.innerHTML = "";
    if (selected === "train") {
      SUBJECTS.forEach((s) => {
        content.appendChild(
          compact
            ? renderSubjectProgress(s, profile)
            : el("div", { class: "progress-mat-block card" }, [renderSubjectProgress(s, profile)])
        );
      });
    } else {
      content.appendChild(renderSmallStepsTree(profile, compact));
    }
  }

  views.forEach(([value, label]) => {
    const btn = el(
      "button",
      {
        class: "btn btn-secondary",
        type: "button",
        onclick: () => {
          profile.progressView = value;
          saveStore(STORE);
          draw();
          if (!compact) renderProgressSidebar();
        },
      },
      [label]
    );
    buttons.push([value, btn]);
    controls.appendChild(btn);
  });

  wrap.appendChild(controls);
  wrap.appendChild(content);
  draw();
  return wrap;
}

// ------------------------------------------------------------------------
// Page : Lexique des stratégies
// ------------------------------------------------------------------------
function renderLexiqueContent() {
  const wrap = el("div", {}, []);

  wrap.appendChild(textEl("h2", "🧩 Mes méthodes pour organiser une tâche", { class: "section-title" }));
  const methodSection = el("div", { class: "lex-section" }, []);
  LEXIQUE_METHODES_EXERCICE.forEach((m) => {
    methodSection.appendChild(
      el("div", { class: "lex-item" }, [el("b", {}, [m.label]), el("p", {}, [m.description])])
    );
  });
  PETALES_APPUIS.filter((a) => a.categorie === "methode").forEach((a) => {
    methodSection.appendChild(
      el("div", { class: "lex-item" }, [el("b", {}, [a.emoji + " " + a.label]), el("p", {}, [a.description])])
    );
  });
  wrap.appendChild(methodSection);

  wrap.appendChild(textEl("h2", "💛 Mes stratégies pour réguler mes émotions", { class: "section-title" }));
  const emoSection = el("div", { class: "lex-section" }, []);
  PETALES_APPUIS.filter((a) => a.categorie === "emotion").forEach((a) => {
    emoSection.appendChild(
      el("div", { class: "lex-item emotion" }, [el("b", {}, [a.emoji + " " + a.label]), el("p", {}, [a.description])])
    );
  });
  wrap.appendChild(emoSection);
  wrap.appendChild(
    el("p", { class: "small muted" }, [
      "Ces stratégies ne sont pas des méthodes de travail : elles aident à se sentir prêt à essayer, surtout face à une émotion forte comme l'anxiété.",
    ])
  );

  return wrap;
}

route("/lexique", function renderLexique() {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h1", "Lexique des stratégies", { class: "page-title" }));
  wrap.appendChild(
    textEl("p", "Utile surtout pour les parents : ce que chaque méthode ou stratégie veut dire, et à quoi elle sert.", { class: "lede" })
  );
  wrap.appendChild(renderLexiqueContent());
  return wrap;
});

// ------------------------------------------------------------------------
// Page : Ma récompense
// ------------------------------------------------------------------------
route("/recompense", function renderRecompense() {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h1", "Ma récompense", { class: "page-title" }));
  wrap.appendChild(
    textEl(
      "p",
      "Ce parcours est séparé de la carte de progression scolaire. Le contenu de la récompense n'est pas choisi par l'application : il se décide ensemble, en famille.",
      { class: "lede" }
    )
  );
  wrap.appendChild(renderProfilePicker());

  const profile = currentProfile();
  const count = profile ? profile.rewardStars || 0 : 0;
  const filled = Math.min(count, 10);
  let stars = "";
  for (let i = 0; i < 10; i++) stars += i < filled ? "⭐" : "☆";

  wrap.appendChild(
    el("div", { class: "reward-visual" }, [
      el("div", { class: "reward-stars" }, [stars]),
      el("p", { style: { fontWeight: "800", marginTop: "0.6rem" } }, [count + " essai(s) marqué(s) d'une étoile"]),
    ])
  );

  wrap.appendChild(
    el("div", { class: "note-box" }, [
      "Idée pour l'adulte : à chaque petit palier (5, 10, 20 étoiles...), discutez ensemble de ce qui ferait plaisir à l'enfant. La récompense peut être toute simple : un moment choisi, une activité, un privilège.",
    ])
  );

  return wrap;
});

// ------------------------------------------------------------------------
// Pages simples : livret, médailles, parents, professionnels
// ------------------------------------------------------------------------
route("/livret", function renderLivret() {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h1", "Mon livret de récits", { class: "page-title" }));
  wrap.appendChild(textEl("p", "Les textes que tu as lus ou écoutés en lecture s'ajoutent ici au fil de tes visites.", { class: "lede" }));
  const profile = currentProfile();
  if (!profile) {
    wrap.appendChild(renderProfilePicker());
    return wrap;
  }
  const livret = profile.livret || [];
  if (!livret.length) {
    wrap.appendChild(
      el("p", { class: "muted" }, ["Ton livret est encore vide. Explore la matière Lecture dans l'espace élève pour commencer à le remplir."])
    );
    wrap.appendChild(el("a", { class: "btn btn-primary", href: "#/eleve" }, ["Aller à l'espace élève"]));
    return wrap;
  }
  const list = el("div", { class: "stack" }, []);
  livret.slice().reverse().forEach((entry) => {
    list.appendChild(
      el("div", { class: "card-soft" }, [
        el("p", { style: { margin: "0 0 0.4rem", fontWeight: "700" } }, [entry.texte]),
        speakButton(entry.texte, "Réécouter"),
        el("p", { class: "small muted", style: { margin: "0.4rem 0 0" } }, [
          new Date(entry.at).toLocaleDateString("fr-CA"),
        ]),
      ])
    );
  });
  wrap.appendChild(list);
  return wrap;
});

route("/medailles", function renderMedailles() {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h1", "Mon mur des médailles", { class: "page-title" }));
  const profile = currentProfile();
  if (!profile) {
    wrap.appendChild(renderProfilePicker());
    return wrap;
  }
  let earned = 0;
  SUBJECTS.forEach((s) => {
    const stats = computeSubjectStats(s.id, profile);
    if (stats.total && stats.done === stats.total) earned += 1;
  });
  wrap.appendChild(textEl("p", earned + " médaille(s) obtenue(s) sur " + SUBJECTS.length + ".", { class: "lede" }));
  wrap.appendChild(
    el("p", { class: "small muted" }, [
      "Une médaille récompense un niveau entier terminé. Elle ne dit rien du temps passé ni du nombre d'essais : reprendre un exercice plus tard n'enlève aucune médaille.",
    ])
  );
  return wrap;
});

// ------------------------------------------------------------------------
// Bilan maison-école : rassemble ce qui existe déjà (exercices essayés ou
// réussis, outils ouverts, outils déclarés aidants PAR l'enfant, réponses
// d'entrée) et ce que l'adulte ajoute lui-même (une observation). Sert à
// repérer les défis qui reviennent souvent et les outils qui aident
// vraiment, jamais à conclure une causalité ou un diagnostic.
// ------------------------------------------------------------------------
function buildExerciseCatalog() {
  const catalog = {};
  Object.entries(SUBJECT_CONTENT).forEach(([subjId, levels]) => {
    const subject = SUBJECTS.find((s) => s.id === subjId);
    Object.entries(levels).forEach(([level, themes]) => {
      (themes || []).forEach((theme) => {
        (theme.exercises || []).forEach((ex, i) => {
          catalog[ex.id] = (subject ? subject.label : subjId) + ", " + level + "e année, " + theme.label + ", exercice " + (i + 1);
        });
      });
    });
  });
  return catalog;
}

function homeSchoolRecords(p) {
  const rows = new Map();
  const catalog = buildExerciseCatalog();
  const appuiLabel = (id) => {
    const a = PETALES_APPUIS.find((x) => x.id === id);
    return a ? a.emoji + " " + a.label : id;
  };
  const add = (id, title, status, used, helpful, source) => {
    const old = rows.get(id);
    if (old) {
      old.used = Array.from(new Set([...old.used, ...(used || [])]));
      old.helpful = Array.from(new Set([...old.helpful, ...(helpful || [])]));
      return old;
    }
    const r = {
      id,
      title,
      status: status || "Non précisé",
      used: Array.from(new Set(used || [])),
      helpful: Array.from(new Set(helpful || [])),
      source: source || "Activité dans le Labo",
    };
    rows.set(id, r);
    return r;
  };

  Object.entries(p.exerciseStatus || {}).forEach(([id, status]) => {
    add(id, catalog[id] || id, status === "reussi" ? "Réussi au moins une fois" : "Essayé");
  });

  (p.appuisLog || []).forEach((log) => {
    if (!log.context) return;
    const label = appuiLabel(log.appuiId);
    const helpful = isAppuiHelpful(p, log.context, log.appuiId) ? [label] : [];
    add(log.context, catalog[log.context] || log.context, null, [label], helpful);
  });

  (p.entryAnswers || []).forEach((r, i) => {
    const row = add("entree:" + i, "À l'entrée dans l'espace élève", "Réponse facultative", [], [], "Déclaration de l'enfant");
    row.challenge = r.reponse;
    row.at = r.at;
  });

  (p.schoolHomeNotes || []).forEach((n) => {
    const row = add(n.id, n.task || "Observation générale", "Observation", n.strategy ? [n.strategy] : [], [], "Observation de l'adulte");
    row.note = n;
    row.challenge = n.challenge;
    row.at = n.at;
  });

  return Array.from(rows.values());
}

function homeSchoolRecordText(r) {
  const lines = [
    r.title,
    "Source : " + r.source,
    r.at ? "Date : " + new Date(r.at).toLocaleDateString("fr-CA") : "Date non enregistrée",
    r.note ? "Contexte : " + r.note.setting : "Participation : " + r.status,
    "Défi signalé : " + (r.challenge || "non précisé"),
    (r.note ? "Stratégie rapportée par l'adulte : " : "Outils consignés : ") + (r.used.join(", ") || "non précisé"),
    "Outils déclarés aidants par l'enfant : " + (r.helpful.join(", ") || "non précisé"),
  ];
  if (r.note) {
    lines.push("Faits observés par l'adulte : " + r.note.facts);
    lines.push("Paroles de l'enfant rapportées par l'adulte : " + (r.note.child || "non précisées"));
    lines.push("Prochain petit pas : " + (r.note.next || "à discuter"));
  }
  return lines.join("\n");
}

function homeSchoolPanel(pro) {
  const root = el("section", { class: "home-school card" }, []);
  root.appendChild(textEl("h2", pro ? "Ce qui aide l'élève" : "Ce qui aide mon enfant", { class: "section-title", style: { marginTop: 0 } }));

  const profile = currentProfile();
  if (!profile) {
    root.appendChild(
      textEl("p", "Choisis un prénom pour voir ce suivi. Les autres conseils restent accessibles sans prénom.", { class: "small muted" })
    );
    return root;
  }

  root.appendChild(
    textEl(
      "p",
      "Ce suivi rassemble les traces disponibles sur cet appareil, pour " + profile.name + ". Un outil utilisé n'est pas forcément un outil aidant. Une réussite après un appui ne prouve pas que cet appui en est la cause.",
      { class: "small muted" }
    )
  );

  const summary = el("div", { class: "card-soft" }, []);
  const list = el("div", { class: "stack" }, []);
  const status = textEl("p", "", { role: "status", class: "small" });
  const report = el("textarea", { rows: "12", readonly: "true", class: "home-school-report", "aria-label": "Bilan à relire et à copier" }, []);
  report.style.display = "none";
  const selected = new Set();

  function invalidate() {
    report.style.display = "none";
    report.value = "";
  }

  // Formulaire pour ajouter une observation de l'adulte (facultatif, distinct
  // de ce que le Labo enregistre déjà automatiquement).
  const fields = {};
  const form = el("details", { class: "card-soft" }, [el("summary", {}, ["Ajouter une observation"])]);
  [
    ["task", "Matière et tâche"],
    ["challenge", "Défi observé ou signalé"],
    ["strategy", "Méthode ou appui essayé"],
    ["facts", "Ce que j'ai observé concrètement"],
    ["child", "Ce que l'enfant en dit, si précisé"],
    ["next", "Prochain petit pas"],
  ].forEach(([key, label]) => {
    fields[key] = el("textarea", { rows: "2", "aria-label": label }, []);
    form.appendChild(el("label", { class: "adult-field", style: { display: "block", margin: "0.5rem 0" } }, [textEl("span", label, { style: { fontWeight: "700", display: "block" } }), fields[key]]));
  });
  const setting = el("select", { "aria-label": "Lieu de l'observation" }, ["À la maison", "En classe", "Autre contexte"].map((t) => el("option", { value: t }, [t])));
  form.appendChild(el("label", { class: "adult-field", style: { display: "block", margin: "0.5rem 0" } }, [textEl("span", "Contexte", { style: { fontWeight: "700", display: "block" } }), setting]));

  let editingId = null;
  function clearForm() {
    editingId = null;
    Object.values(fields).forEach((x) => (x.value = ""));
    setting.value = "À la maison";
    form.open = false;
  }
  form.appendChild(
    el(
      "button",
      {
        class: "btn btn-primary",
        type: "button",
        style: { marginTop: "0.6rem" },
        onclick: () => {
          if (!fields.facts.value.trim()) {
            status.textContent = "Décris au moins un fait observé avant d'enregistrer.";
            return;
          }
          const note = { id: editingId || "note:" + Date.now(), at: new Date().toISOString(), setting: setting.value };
          Object.entries(fields).forEach(([k, x]) => (note[k] = x.value.trim()));
          profile.schoolHomeNotes = profile.schoolHomeNotes || [];
          const i = profile.schoolHomeNotes.findIndex((n) => n.id === note.id);
          if (i >= 0) profile.schoolHomeNotes[i] = note;
          else profile.schoolHomeNotes.push(note);
          saveStore(STORE);
          clearForm();
          draw();
          status.textContent = "Observation enregistrée.";
        },
      },
      ["Enregistrer mon observation"]
    )
  );
  form.appendChild(el("button", { class: "btn btn-secondary", type: "button", style: { marginTop: "0.6rem", marginLeft: "0.5rem" }, onclick: clearForm }, ["Annuler"]));

  const comment = el("textarea", { rows: "2", "aria-label": "Question pour l'échange", placeholder: "Par exemple : observez-vous la même chose en classe ?" }, []);
  comment.addEventListener("input", invalidate);

  function build() {
    const records = homeSchoolRecords(profile).filter((r) => selected.has(r.id));
    if (!records.length) {
      status.textContent = "Choisis au moins un élément à partager.";
      return "";
    }
    const parts = [
      "Le Labo des Déclics, bilan maison et école",
      "Profil : " + profile.name,
      "Préparé le " + new Date().toLocaleDateString("fr-CA"),
      "Sélection relue par l'adulte. Traces disponibles sur cet appareil, sans conclusion diagnostique.",
      ...records.map(homeSchoolRecordText),
    ];
    if (comment.value.trim()) parts.push("Question ou commentaire pour l'échange :\n" + comment.value.trim());
    return parts.join("\n\n");
  }

  function draw() {
    invalidate();
    const records = homeSchoolRecords(profile);

    summary.innerHTML = "";
    summary.appendChild(textEl("h3", "Des repères pour en discuter", { style: { marginTop: 0 } }));
    const counts = new Map();
    records
      .filter((r) => !r.note && !r.id.startsWith("entree:"))
      .forEach((r) => {
        r.used.forEach((t) => {
          const n = counts.get(t) || { used: 0, helpful: 0 };
          n.used += 1;
          if (r.helpful.includes(t)) n.helpful += 1;
          counts.set(t, n);
        });
      });
    if (!counts.size) {
      summary.appendChild(textEl("p", "Aucun outil lié à une activité n'est encore consigné.", { class: "small" }));
    } else {
      counts.forEach((n, t) => {
        summary.appendChild(
          textEl("p", t + " : consigné dans " + n.used + " activité(s), déclaré aidant par l'enfant dans " + n.helpful + " de ces activités.", {
            class: "small",
          })
        );
      });
    }
    const challenges = new Map();
    records
      .filter((r) => r.challenge)
      .forEach((r) => {
        const key = String(r.challenge).trim().toLowerCase();
        const c = challenges.get(key) || { label: r.challenge, count: 0 };
        c.count += 1;
        challenges.set(key, c);
      });
    if (challenges.size) {
      summary.appendChild(textEl("h3", "Défis signalés à plusieurs reprises", { style: { marginTop: "0.8rem" } }));
      let recurrent = false;
      challenges.forEach((c) => {
        if (c.count > 1) {
          recurrent = true;
          summary.appendChild(textEl("p", c.label + " : " + c.count + " mentions dans les traces disponibles.", { class: "small" }));
        }
      });
      if (!recurrent) {
        summary.appendChild(textEl("p", "Aucun même défi répété pour l'instant. Cela ne veut pas dire qu'il n'y a pas de difficulté.", { class: "small" }));
      }
    }
    summary.appendChild(
      textEl("p", "Ces repères restent ceux exprimés ou observés. Une mauvaise réponse ne permet pas, à elle seule, d'en déduire un défi.", {
        class: "small muted",
      })
    );

    list.innerHTML = "";
    if (!records.length) {
      list.appendChild(textEl("p", "Aucune trace pour ce profil pour l'instant.", { class: "small muted" }));
    }
    records.forEach((r) => {
      const check = el("input", { type: "checkbox", "aria-label": "Inclure : " + r.title }, []);
      check.checked = selected.has(r.id);
      check.addEventListener("change", () => {
        if (check.checked) selected.add(r.id);
        else selected.delete(r.id);
        invalidate();
      });
      const details = el("details", { class: "card-soft" }, [
        el("summary", {}, [r.title]),
        textEl("pre", homeSchoolRecordText(r), { class: "home-school-record-text" }),
      ]);
      const card = el("div", { class: "home-school-record" }, [el("label", { style: { display: "flex", gap: "0.5rem", alignItems: "center" } }, [check, "Inclure dans le bilan"]), details]);
      if (r.note) {
        card.appendChild(
          el(
            "button",
            {
              class: "btn btn-secondary",
              type: "button",
              style: { marginTop: "0.4rem" },
              onclick: () => {
                editingId = r.id;
                Object.entries(fields).forEach(([k, x]) => (x.value = r.note[k] || ""));
                setting.value = r.note.setting;
                form.open = true;
                form.scrollIntoView({ block: "start", behavior: "smooth" });
              },
            },
            ["Modifier"]
          )
        );
        card.appendChild(
          el(
            "button",
            {
              class: "btn btn-ghost",
              type: "button",
              style: { marginTop: "0.4rem", marginLeft: "0.4rem" },
              onclick: () => {
                profile.schoolHomeNotes = (profile.schoolHomeNotes || []).filter((n) => n.id !== r.id);
                selected.delete(r.id);
                saveStore(STORE);
                draw();
                status.textContent = "Observation supprimée.";
              },
            },
            ["Supprimer"]
          )
        );
      }
      list.appendChild(card);
    });
  }

  root.append(summary, form);
  root.appendChild(textEl("h3", "Choisir ce que je veux partager", { style: { margin: "0.8rem 0 0.2rem" } }));
  root.appendChild(textEl("p", "Coche seulement ce que tu veux inclure. Tu peux relire le bilan avant de le copier ou l'imprimer. Rien n'est envoyé automatiquement.", { class: "small muted" }));
  root.appendChild(list);
  root.appendChild(el("label", { class: "adult-field", style: { display: "block", margin: "0.6rem 0" } }, [textEl("span", "Mon commentaire pour l'échange (facultatif)", { style: { fontWeight: "700", display: "block" } }), comment]));
  root.appendChild(
    el(
      "button",
      {
        class: "btn btn-primary",
        type: "button",
        onclick: () => {
          const text = build();
          if (text) {
            report.value = text;
            report.style.display = "block";
            status.textContent = "Bilan prêt à relire. Seuls les éléments cochés sont inclus.";
          }
        },
      },
      ["Préparer mon bilan"]
    )
  );
  root.appendChild(
    el(
      "button",
      {
        class: "btn btn-secondary",
        type: "button",
        style: { marginLeft: "0.5rem" },
        onclick: async () => {
          const text = build();
          if (!text) return;
          report.value = text;
          report.style.display = "block";
          try {
            await navigator.clipboard.writeText(text);
            status.textContent = "Bilan copié.";
          } catch (e) {
            report.focus();
            report.select();
            status.textContent = "Sélectionne « Copier » dans le menu de ton appareil : le texte est déjà sélectionné.";
          }
        },
      },
      ["Copier le bilan"]
    )
  );
  root.appendChild(
    el(
      "button",
      {
        class: "btn btn-secondary",
        type: "button",
        style: { marginLeft: "0.5rem" },
        onclick: () => {
          const text = build();
          if (!text) return;
          const existing = document.getElementById("school-report-print");
          if (existing) existing.remove();
          const page = el("pre", { id: "school-report-print" }, [text]);
          document.body.appendChild(page);
          document.body.classList.add("printing-school-report");
          const cleanup = () => {
            page.remove();
            document.body.classList.remove("printing-school-report");
          };
          window.addEventListener("afterprint", cleanup, { once: true });
          window.print();
        },
      },
      ["Imprimer le bilan"]
    )
  );
  root.append(report, status);

  draw();
  return root;
}

// ------------------------------------------------------------------------
// Rubrique « Que faire quand c'est difficile ? » : une situation à la
// fois, avec ce qu'on observe, quoi essayer, une phrase possible, quoi
// éviter, et les mêmes appuis PÉTALES que l'enfant retrouve dans sa
// propre boîte à outils (voir /besoins).
// ------------------------------------------------------------------------
function renderAdultSituations(pro) {
  const wrap = el("div", {}, []);
  wrap.appendChild(
    textEl(
      "p",
      "Choisissez ce que vous observez. Un même comportement peut avoir plusieurs explications : ces repères ne posent pas de diagnostic.",
      { class: "small muted" }
    )
  );
  const choices = el("div", { class: "situation-grid" }, []);
  const detail = el("div", { class: "card-soft situation-detail", "aria-live": "polite" }, []);
  wrap.append(choices, detail);

  function show(s, btn) {
    Array.from(choices.children).forEach((b) => b.classList.remove("selected"));
    if (btn) btn.classList.add("selected");
    detail.innerHTML = "";
    detail.appendChild(textEl("h3", s.emoji + " " + s.titre, { style: { marginTop: 0 } }));
    detail.appendChild(
      el("p", { class: "small", style: { margin: "0 0 0.5rem" } }, [el("b", {}, ["Ce qu'on observe : "]), s.observe])
    );
    const steps = el("ol", { style: { margin: "0 0 0.6rem", paddingLeft: "1.2rem" } }, []);
    s.essayer.forEach((t) => steps.appendChild(textEl("li", t, { style: { margin: "0 0 0.3rem" } })));
    detail.appendChild(textEl("h4", "Quoi essayer maintenant", { style: { margin: "0.4rem 0 0.2rem" } }));
    detail.appendChild(steps);
    detail.appendChild(
      el("p", { class: "small", style: { margin: "0 0 0.5rem" } }, [el("b", {}, ["Une phrase possible : "]), "« " + s.phrase + " »"])
    );
    detail.appendChild(
      el("p", { class: "small", style: { margin: "0 0 0.5rem" } }, [el("b", {}, ["À éviter : "]), s.eviter])
    );
    detail.appendChild(
      el("p", { class: "small muted", style: { margin: "0 0 0.5rem" } }, [el("b", {}, ["Si cela ne suffit pas : "]), s.siInsuffisant])
    );
    if (pro) {
      detail.appendChild(
        el("p", { class: "small muted", style: { margin: "0 0 0.5rem" } }, [
          el("b", {}, ["En classe ou en équipe-école : "]),
          "Ce repère peut être partagé tel quel avec la famille, pour garder les mêmes mots des deux côtés.",
        ])
      );
    }
    const fn = EXECUTIVE_FUNCTIONS.find((f) => f.id === s.fonctionId);
    if (fn) {
      detail.appendChild(
        el("p", { class: "small muted", style: { margin: "0 0 0.5rem" } }, [
          "Fonction exécutive liée : " + fn.emoji + " " + fn.label,
        ])
      );
    }
    const tags = el("div", { class: "func-appui-tags" }, []);
    s.appuiIds
      .map((id) => PETALES_APPUIS.find((a) => a.id === id))
      .filter(Boolean)
      .forEach((a) => tags.appendChild(el("span", { class: "func-appui-tag" }, [a.emoji + " " + a.label])));
    detail.appendChild(tags);
    detail.appendChild(el("a", { class: "btn btn-secondary", href: "#/besoins", style: { marginTop: "0.6rem" } }, ["Ouvrir ces outils avec l'enfant"]));
  }

  ADULT_SITUATIONS.forEach((s) => {
    const btn = el("button", { type: "button", class: "situation-btn" }, [
      el("span", { class: "situation-emoji" }, [s.emoji]),
      el("span", {}, [s.titre]),
    ]);
    btn.addEventListener("click", () => show(s, btn));
    choices.appendChild(btn);
  });

  return wrap;
}

// ------------------------------------------------------------------------
// Rubrique « Préparer et suivre une séance » : avant / pendant / après,
// avec une mise en garde explicite sur ce que montre vraiment le suivi
// (essayé, réussi une fois, outil utilisé, outil déclaré aidant sont
// quatre informations différentes, aucune ne prouve une maîtrise durable).
// ------------------------------------------------------------------------
function renderAdultSuivi(pro) {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h3", pro ? "Observer, ajuster, échanger" : "Une séance courte, préparée ensemble", { marginTop: "0" }));
  const points = pro
    ? [
        "Nommer l'objectif : la notion à apprendre, et le mode de réponse possible pour cet élève.",
        "Observer les faits : la tâche proposée, la consigne donnée, et l'appui disponible sur le moment.",
        "Choisir un seul ajustement à la fois avec l'élève, en gardant les autres conditions stables pour en observer l'effet.",
        "Distinguer une réponse autonome, une réponse avec appui, et une simple observation de l'adulte.",
        "Échanger avec la famille sur ce qui facilite l'engagement, et choisir ensemble un prochain petit pas.",
      ]
    : [
        "Avant : choisir une petite activité, préparer le matériel, et demander à l'enfant quel appui lui serait utile aujourd'hui.",
        "Pendant : une seule consigne à la fois, du temps pour répondre, et une pause disponible sans condition.",
        "Après : demander « Qu'est-ce qui t'a aidé ? » et reconnaître un geste précis, même si l'exercice reste à poursuivre.",
        "Avec l'école : partager une observation concrète, et demander si le même appui peut être essayé en classe.",
      ];
  wrap.appendChild(el("ol", {}, points.map((t) => textEl("li", t, { style: { margin: "0 0 0.4rem" } }))));
  wrap.appendChild(
    el("div", { class: "card-soft" }, [
      textEl("h4", "Lire le suivi avec prudence", { style: { marginTop: 0 } }),
      textEl(
        "p",
        "« Essayé » montre une participation, pas une maîtrise. « Réussi au moins une fois » n'est pas une preuve de maîtrise durable. « Outil utilisé » et « outil déclaré aidant » sont deux informations différentes : un outil peut être ouvert sans avoir vraiment aidé, ou aider sans avoir été ouvert à chaque essai. Ces quatre informations se complètent, elles ne se remplacent pas.",
        { class: "small", style: { margin: 0 } }
      ),
    ])
  );
  wrap.appendChild(el("a", { class: "btn btn-secondary", href: "#/progres", style: { marginTop: "0.6rem" } }, ["Consulter la carte de progression"]));
  return wrap;
}

// ------------------------------------------------------------------------
// Rubrique « Mes outils PÉTALES » : un résumé, puis un renvoi vers la
// page complète /fonctions-executives (pour ne pas dupliquer tout son
// contenu ici).
// ------------------------------------------------------------------------
function renderAdultPetalesSummary() {
  const wrap = el("div", {}, []);
  wrap.appendChild(
    el("div", { class: "welcome-card" }, [
      el("p", { style: { margin: 0 } }, [FONCTIONS_EXECUTIVES_TEXTES.petalesIntro]),
    ])
  );
  wrap.appendChild(
    textEl(
      "p",
      "La fleur réunit sept repères : Posture, Évaluation, Transitions, Ajustement, Lien, Équité et Soutien. Les outils que l'enfant utilise traduisent ces repères en actions concrètes ; ce ne sont pas les lettres de la fleur elle-même.",
      { class: "small" }
    )
  );
  wrap.appendChild(el("a", { class: "btn btn-primary", href: "#/fonctions-executives" }, ["🧠 Comprendre PÉTALES et les fonctions exécutives"]));
  return wrap;
}

// ------------------------------------------------------------------------
// Guide adulte partagé entre /parents et /professionnels : cinq
// rubriques présentées une à la fois, pour garder chaque écran dégagé
// plutôt que d'empiler tout le contenu sur une seule longue page.
// ------------------------------------------------------------------------
function renderAdultGuide(pro) {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h1", pro ? "Espace professionnels" : "Espace parents", { class: "page-title" }));
  wrap.appendChild(
    textEl(
      "p",
      pro
        ? "Observer une situation, choisir un ajustement, et vérifier son effet avec l'élève et l'équipe."
        : "Comprendre ce qui se passe, essayer un petit appui ensemble, et garder ce qui aide.",
      { class: "lede" }
    )
  );

  const pages = [
    ["situations", "Que faire quand c'est difficile ?", () => renderAdultSituations(pro)],
    ["methodes", "Comprendre les méthodes", () => renderLexiqueContent()],
    ["petales", "Mes outils PÉTALES", () => renderAdultPetalesSummary()],
    ["bilan", pro ? "Ce qui aide l'élève" : "Ce qui aide mon enfant", () => homeSchoolPanel(pro)],
    ["suivi", pro ? "Observer et collaborer" : "Préparer et suivre une séance", () => renderAdultSuivi(pro)],
  ];
  const tabs = el("div", { class: "adult-tabs", "aria-label": "Rubriques" }, []);
  const panel = el("div", { class: "adult-panel" }, []);
  let active = "situations";

  function draw() {
    panel.innerHTML = "";
    Array.from(tabs.children).forEach((b, i) => b.setAttribute("aria-pressed", String(pages[i][0] === active)));
    const page = pages.find((p) => p[0] === active);
    panel.appendChild(page[2]());
  }
  pages.forEach(([id, label]) => {
    const btn = el(
      "button",
      { type: "button", class: "btn btn-secondary", "aria-pressed": "false", onclick: () => { active = id; draw(); } },
      [label]
    );
    tabs.appendChild(btn);
  });

  wrap.append(tabs, panel);
  draw();

  wrap.appendChild(
    el("details", { class: "note-box", style: { marginTop: "1.4rem" } }, [
      el("summary", { style: { cursor: "pointer", fontWeight: "700" } }, ["Mes données et les enregistrements audio"]),
      el("p", { class: "small", style: { marginTop: "0.6rem" } }, [
        "Les progrès restent dans ce navigateur. Vous pouvez en garder une copie ou préparer les sons entendus par l'enfant.",
      ]),
      el("a", { class: "btn btn-secondary", href: "#/sauvegarde" }, ["💾 Exporter ou récupérer les progrès"]),
      el("a", { class: "btn btn-secondary", href: "#/sons-adulte", style: { marginLeft: "0.5rem" } }, ["🔊 Préparer les sons enregistrés"]),
    ])
  );

  return wrap;
}

route("/parents", function renderParents() {
  return renderAdultGuide(false);
});

route("/professionnels", function renderProfessionnels() {
  return renderAdultGuide(true);
});

route("/fonctions-executives", function renderFonctionsExecutives() {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h1", "Les fonctions exécutives", { class: "page-title" }));
  wrap.appendChild(
    textEl(
      "p",
      "Comprendre pourquoi une stratégie aide, pour choisir le bon appui plutôt que d'essayer au hasard.",
      { class: "lede" }
    )
  );

  // 1. Qu'est-ce qu'une fonction exécutive, en général
  wrap.appendChild(textEl("h2", "Qu'est-ce qu'une fonction exécutive ?", { class: "section-title" }));
  wrap.appendChild(
    el("div", { class: "welcome-card" }, [
      el("p", { style: { margin: 0 } }, [FONCTIONS_EXECUTIVES_TEXTES.intro]),
    ])
  );
  const quickChips = el("div", { class: "func-quick-chips" }, []);
  EXECUTIVE_FUNCTIONS.forEach((fn) => {
    quickChips.appendChild(
      el("span", { class: "func-quick-chip" }, [el("span", {}, [fn.emoji]), el("span", {}, [fn.label])])
    );
  });
  wrap.appendChild(quickChips);

  // 2. La posture du Labo : social avant clinique
  wrap.appendChild(textEl("h2", "Pourquoi Le Labo des Déclics existe", { class: "section-title" }));
  wrap.appendChild(
    el("div", { class: "welcome-card" }, [
      el("p", { style: { margin: 0 } }, [FONCTIONS_EXECUTIVES_TEXTES.philosophie]),
    ])
  );

  // 3. Pont vers les outils, puis le détail des six fonctions
  wrap.appendChild(textEl("p", FONCTIONS_EXECUTIVES_TEXTES.pontVersOutils, { class: "lede" }));

  const funcGrid = el("div", { class: "func-list" }, []);
  EXECUTIVE_FUNCTIONS.forEach((fn) => {
    const card = el("div", { class: "func-card" }, []);
    card.appendChild(
      el("div", { class: "func-header" }, [
        el("span", { class: "func-emoji" }, [fn.emoji]),
        el("span", { class: "func-label" }, [fn.label]),
      ])
    );
    card.appendChild(textEl("p", fn.description, { style: { margin: "0.5rem 0" } }));
    card.appendChild(
      el("p", { class: "small", style: { margin: "0.5rem 0" } }, [
        el("strong", {}, ["Comment ça se manifeste : "]),
        fn.defis,
      ])
    );
    card.appendChild(
      el("p", { class: "small", style: { margin: "0.5rem 0" } }, [
        el("strong", {}, ["Une astuce : "]),
        fn.astuce,
      ])
    );
    if (fn.profilNote) {
      card.appendChild(el("p", { class: "small muted", style: { margin: "0.5rem 0" } }, [fn.profilNote]));
    }
    const appuiLabels = fn.appuiIds
      .map((id) => PETALES_APPUIS.find((a) => a.id === id))
      .filter(Boolean);
    if (appuiLabels.length) {
      const tagsRow = el("div", { class: "func-appui-tags" }, []);
      appuiLabels.forEach((a) => {
        tagsRow.appendChild(el("span", { class: "func-appui-tag" }, [a.emoji + " " + a.label]));
      });
      card.appendChild(tagsRow);
    }
    funcGrid.appendChild(card);
  });
  wrap.appendChild(funcGrid);

  // 4. Qu'est-ce que PÉTALES, avec les outils reliés à chaque fonction
  wrap.appendChild(textEl("h2", "Qu'est-ce que PÉTALES ?", { class: "section-title" }));
  wrap.appendChild(
    el("div", { class: "welcome-card" }, [
      el("p", { style: { margin: 0 } }, [FONCTIONS_EXECUTIVES_TEXTES.petalesIntro]),
    ])
  );
  const petalesList = el("div", { class: "petales-outil-list" }, []);
  PETALES_APPUIS.forEach((appui) => {
    const relatedFns = EXECUTIVE_FUNCTIONS.filter((fn) => fn.appuiIds.includes(appui.id));
    const card = el("div", { class: "petales-outil-card" }, [
      el("span", { class: "petales-outil-emoji" }, [appui.emoji]),
      el("div", {}, [
        el("p", { style: { margin: "0 0 0.2rem", fontWeight: "700" } }, [appui.label]),
        el("p", { class: "small muted", style: { margin: "0 0 0.4rem" } }, [appui.description]),
        relatedFns.length
          ? el("p", { class: "small", style: { margin: 0 } }, [
              el("strong", {}, ["Répond à : "]),
              relatedFns.map((fn) => fn.label).join(", "),
            ])
          : el("p", { class: "small muted", style: { margin: 0 } }, ["Un outil d'appui général."]),
      ]),
    ]);
    petalesList.appendChild(card);
  });
  wrap.appendChild(petalesList);

  // 4b. Les outils codés du guide PÉTALES (volet professionnel)
  wrap.appendChild(textEl("h2", "Les outils du guide PÉTALES (volet professionnel)", { class: "section-title" }));
  wrap.appendChild(
    el("div", { class: "welcome-card" }, [
      el("p", { style: { margin: 0 } }, [FONCTIONS_EXECUTIVES_TEXTES.outilsCodesIntro]),
    ])
  );
  const codesList = el("div", { class: "petales-outil-list" }, []);
  PETALES_OUTILS_CODES.forEach((outil) => {
    codesList.appendChild(
      el("div", { class: "petales-outil-card" }, [
        el("span", { class: "petales-outil-code" }, [outil.code]),
        el("div", {}, [el("p", { style: { margin: 0, fontWeight: "700" } }, [outil.nom])]),
      ])
    );
  });
  wrap.appendChild(codesList);

  // 5. Les autres stratégies du quotidien, avec le message le plus important en dernier
  wrap.appendChild(textEl("h2", "D'autres stratégies pour bien commencer", { class: "section-title" }));
  wrap.appendChild(textEl("p", FONCTIONS_EXECUTIVES_TEXTES.autresStrategiesIntro, { class: "lede" }));
  wrap.appendChild(
    el("div", { class: "card-soft" }, [
      textEl(
        "p",
        "Avant toute chose : prendre la température des émotions. Vérifier comment l'enfant se sent avant de commencer une tâche est souvent le meilleur indice pour anticiper la suite et choisir le bon appui dès le départ. L'outil « Je montre mon ressenti » (dans la boîte à outils PÉTALES) peut servir de point de départ à ce moment-là.",
        { style: { margin: 0 } }
      ),
    ])
  );
  wrap.appendChild(
    el("div", { class: "card-soft" }, [
      textEl(
        "p",
        "Ensuite, quelques petits outils simples : « Je respire avec le carré » pour ralentir avant de continuer, et « Je dessine » pour mettre de côté ce qui bloque, le temps d'un instant, avant de revenir à la tâche.",
        { style: { margin: 0 } }
      ),
    ])
  );
  wrap.appendChild(
    el("div", { class: "pause-callout" }, [
      el("span", { class: "pause-icon" }, ["🌤️"]),
      el("p", {}, [FONCTIONS_EXECUTIVES_TEXTES.pauseMessage]),
    ])
  );

  wrap.appendChild(el("a", { class: "btn btn-primary", href: "#/besoins" }, ["🌟 Voir tous les appuis PÉTALES"]));

  return wrap;
});

// ------------------------------------------------------------------------
// Sauvegarde : télécharger et récupérer les progrès (espace adulte).
// Le fichier contient les profils, les progrès, les observations, les
// dessins et les sons enregistrés sur cet appareil. Il ne crée pas de
// compte et ne synchronise pas les appareils entre eux.
// ------------------------------------------------------------------------
function downloadBackupFile(name, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const a = el("a", { href: url, download: name }, []);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function validateBackupFile(value) {
  if (!value || value.format !== "labo-declics-backup" || value.version !== 1 || !value.store || typeof value.store.profiles !== "object" || Array.isArray(value.store.profiles) || !value.store.profiles) {
    throw new Error("Ce fichier n'est pas une sauvegarde compatible du Labo des Déclics.");
  }
  const recordings = value.store.soundRecordings || {};
  Object.values(recordings).forEach((r) => {
    if (!r || typeof r.data !== "string" || !/^data:audio\/(mpeg|mp3|wav|x-wav|ogg|webm|mp4|aac);base64,[A-Za-z0-9+/=]+$/.test(r.data) || r.data.length > 1500000 || typeof r.approved !== "boolean") {
      throw new Error("Un enregistrement audio de la sauvegarde n'est pas valide.");
    }
  });
  return value;
}

function mergeBackupFile(backup) {
  const next = JSON.parse(JSON.stringify(STORE));
  const names = [];
  Object.entries(backup.store.profiles).forEach(([name, p]) => {
    let target = name;
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(next.profiles, target)) {
      target = name + " (import " + i++ + ")";
    }
    next.profiles[target] = Object.assign({}, p, { name: target });
    names.push(target);
  });
  // Les sons déjà présents sur cet appareil sont conservés en priorité sur ceux importés.
  next.soundRecordings = Object.assign({}, backup.store.soundRecordings || {}, next.soundRecordings || {});
  if (!next.currentProfile && names.length) next.currentProfile = names[0];
  saveStore(next);
  STORE = next;
  return names;
}

route("/sauvegarde", function renderSauvegarde() {
  const root = el("div", {}, []);
  root.appendChild(textEl("h1", "Sauvegarder et récupérer les progrès", { class: "page-title" }));
  root.appendChild(
    textEl(
      "p",
      "Espace adulte. Le fichier téléchargé contient les profils, les progrès, les observations, les dessins et les sons ajoutés sur cet appareil. Gardez-le dans un endroit privé : il ne crée pas de compte et ne synchronise pas les appareils entre eux.",
      { class: "lede" }
    )
  );

  const status = textEl("p", "", { role: "status", class: "small" });

  root.appendChild(
    el(
      "button",
      {
        class: "btn btn-primary",
        type: "button",
        onclick: () => {
          downloadBackupFile("labo-sauvegarde-" + new Date().toISOString().slice(0, 10) + ".json", {
            format: "labo-declics-backup",
            version: 1,
            exportedAt: new Date().toISOString(),
            store: STORE,
          });
          status.textContent = "Le téléchargement a été demandé. Vérifiez qu'il est bien arrivé dans vos téléchargements.";
        },
      },
      ["💾 Télécharger ma sauvegarde"]
    )
  );

  root.appendChild(textEl("h2", "Récupérer une sauvegarde", { class: "section-title" }));
  root.appendChild(
    textEl(
      "p",
      "Les profils importés sont ajoutés à ceux déjà présents. Si un prénom existe déjà sur cet appareil, une copie portant la mention « import » est créée pour ne rien écraser.",
      { class: "small muted" }
    )
  );

  const input = el("input", { type: "file", accept: ".json,application/json", "aria-label": "Choisir une sauvegarde" }, []);
  const preview = el("div", {}, []);
  let pending = null;
  input.addEventListener("change", async () => {
    pending = null;
    preview.innerHTML = "";
    const file = input.files[0];
    if (!file) return;
    try {
      if (file.size > 20000000) throw new Error("Le fichier dépasse 20 Mo.");
      const text = await file.text();
      pending = validateBackupFile(JSON.parse(text));
      const names = Object.keys(pending.store.profiles);
      preview.appendChild(
        textEl("p", names.length + " profil(s) trouvé(s) : " + (names.join(", ") || "aucun") + ". Les sons enregistrés seront aussi récupérés.", { class: "small" })
      );
      preview.appendChild(
        el(
          "button",
          {
            class: "btn btn-primary",
            type: "button",
            onclick: () => {
              try {
                if (!pending) return;
                const names = mergeBackupFile(pending);
                pending = null;
                preview.innerHTML = "";
                status.textContent = "Import terminé : " + names.join(", ") + ".";
                renderProgressSidebar();
              } catch (e) {
                status.textContent = "Import impossible : " + e.message + ". Vos profils précédents sont conservés.";
              }
            },
          },
          ["Ajouter ces données à cet appareil"]
        )
      );
      status.textContent = "Fichier vérifié. Relisez les profils avant de les ajouter.";
    } catch (e) {
      pending = null;
      status.textContent = "Fichier refusé : " + e.message;
    }
  });

  root.append(input, preview, status);
  root.appendChild(el("a", { class: "btn btn-secondary", href: "#/parents", style: { marginTop: "1rem" } }, ["← Retour à l'espace adulte"]));
  return root;
});

// ------------------------------------------------------------------------
// Préparer les sons pour l'enfant : un vrai enregistrement humain, plutôt
// que la synthèse vocale, pour chaque lettre ou son de /premiers-pas.
// ------------------------------------------------------------------------
function playRecordedOrSpoken(soundItem, statusEl) {
  const rec = (STORE.soundRecordings || {})[soundItem.lettre];
  if (rec && rec.approved && rec.data) {
    if (window.__laboActiveSound) window.__laboActiveSound.pause();
    const audio = new Audio(rec.data);
    window.__laboActiveSound = audio;
    audio.play().catch(() => speak(soundItem.lettre));
    if (statusEl) statusEl.textContent = "🔊 " + soundItem.lettre + " (voix enregistrée)";
  } else {
    speak(soundItem.lettre);
    if (statusEl) statusEl.textContent = "🔊 " + soundItem.lettre + " (voix automatique)";
  }
}

route("/sons-adulte", function renderSonsAdulte() {
  const root = el("div", {}, []);
  root.appendChild(textEl("h1", "Préparer les sons pour l'enfant", { class: "page-title" }));
  root.appendChild(
    textEl(
      "p",
      "Importez un court enregistrement humain (réalisé avec un téléphone ou un autre outil) pour chaque lettre ou son. Pour un son isolé, faites entendre le son lui-même, pas le nom de la lettre. Une lettre peut changer de son selon le mot : vérifiez le contexte avec Aurélie ou Laura avant d'approuver.",
      { class: "lede" }
    )
  );

  const select = el(
    "select",
    { "aria-label": "Son à préparer" },
    PREMIERS_PAS_CONTENT.sons.map((s) => el("option", { value: s.lettre }, [s.lettre + " · repère : " + s.mot]))
  );
  const panel = el("div", { style: { marginTop: "1rem" } }, []);
  root.append(select, panel);

  function draw() {
    const key = select.value;
    const existing = (STORE.soundRecordings || {})[key];
    let pendingData = existing ? existing.data : null;
    panel.innerHTML = "";
    panel.appendChild(textEl("h2", "Enregistrement : " + key, { class: "section-title" }));

    const player = el("audio", { controls: "true", "aria-label": "Écouter l'enregistrement" }, []);
    if (pendingData) player.src = pendingData;

    const fileInput = el("input", { type: "file", accept: "audio/*", "aria-label": "Importer un fichier audio" }, []);
    const approve = el("input", { type: "checkbox" }, []);
    approve.checked = !!(existing && existing.approved);
    const status = textEl("p", "", { role: "status", class: "small" });

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 1000000 || !/^audio\/(mpeg|mp3|wav|x-wav|ogg|webm|mp4|aac)$/.test(file.type)) {
        status.textContent = "Choisissez un fichier audio MP3, WAV, OGG, WebM, MP4 ou AAC de moins de 1 Mo.";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        pendingData = reader.result;
        player.src = pendingData;
        approve.checked = false;
        status.textContent = "Écoutez le fichier avant de le valider.";
      };
      reader.readAsDataURL(file);
    });

    panel.append(
      fileInput,
      player,
      el("label", { class: "adult-field", style: { display: "block", margin: "0.6rem 0" } }, [
        approve,
        " J'ai écouté ce fichier et vérifié le son attendu avec son contexte.",
      ]),
      el(
        "button",
        {
          class: "btn btn-primary",
          type: "button",
          onclick: () => {
            if (!pendingData) {
              status.textContent = "Ajoutez d'abord un fichier audio.";
              return;
            }
            STORE.soundRecordings = STORE.soundRecordings || {};
            STORE.soundRecordings[key] = { data: pendingData, approved: approve.checked, at: new Date().toISOString() };
            saveStore(STORE);
            status.textContent = approve.checked
              ? "Son enregistré et disponible pour l'enfant."
              : "Son enregistré comme brouillon, pas encore disponible pour l'enfant.";
          },
        },
        ["Enregistrer ce son"]
      ),
      status
    );
  }
  select.addEventListener("change", draw);
  draw();

  root.appendChild(textEl("p", "Les fichiers sont conservés dans ce navigateur, et inclus dans la sauvegarde du Labo.", { class: "small muted", style: { marginTop: "1rem" } }));
  root.appendChild(el("a", { class: "btn btn-secondary", href: "#/sauvegarde" }, ["Sauvegarder mes données"]));
  root.appendChild(el("a", { class: "btn btn-secondary", href: "#/parents", style: { marginLeft: "0.5rem" } }, ["← Retour à l'espace adulte"]));
  return root;
});

route("/404", function render404() {
  const wrap = el("div", {}, []);
  wrap.appendChild(textEl("h1", "Page introuvable", { class: "page-title" }));
  wrap.appendChild(el("a", { class: "btn btn-primary", href: "#/" }, ["Retour à l'accueil"]));
  return wrap;
});

// ------------------------------------------------------------------------
// Boîte à outils flottante (accès rapide aux appuis depuis n'importe où)
// ------------------------------------------------------------------------
function setupToolboxFab() {
  const fab = el("button", { id: "toolbox-fab", type: "button" }, ["🧰 Boîte à outils"]);
  fab.addEventListener("click", () => navigate("/besoins"));
  document.body.appendChild(fab);
}

function setupProgressFab() {
  const fab = el("button", { id: "progress-fab", type: "button" }, ["🗺️ Ma carte"]);
  fab.addEventListener("click", () => navigate("/progres"));
  document.body.appendChild(fab);
}

// ------------------------------------------------------------------------
// Démarrage
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// Accès payant : vérifie un code déjà mémorisé dans ce navigateur, ou
// affiche l'écran d'entrée du code. Une fois déverrouillé, ça reste
// déverrouillé sur cet appareil (pas besoin de retaper le code à chaque
// visite). Voir ACCESS_CODES dans content.js pour changer les codes valides.
// ------------------------------------------------------------------------
const ACCESS_STORAGE_KEY = "labo-access-granted";

function isUnlocked() {
  try {
    return localStorage.getItem(ACCESS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function renderAccessGate() {
  document.body.classList.add("locked");
  const gate = document.getElementById("access-gate");
  gate.innerHTML = "";
  gate.appendChild(textEl("h1", "Le Labo des Déclics", { class: "page-title" }));
  gate.appendChild(textEl("p", ACCESS_GATE_TEXTE.intro, { class: "lede" }));

  const input = el("input", {
    type: "text",
    placeholder: "Code d'accès",
    style: { padding: "0.6rem 0.8rem", borderRadius: "0.6rem", border: "2px solid var(--border)", fontSize: "1rem" },
  });
  const errorMsg = el("p", { class: "small", style: { color: "#b3261e", margin: "0.6rem 0 0" } }, []);

  function tryUnlock() {
    const code = input.value.trim().toUpperCase();
    const valid = ACCESS_CODES.some((c) => c.toUpperCase() === code);
    if (valid) {
      try {
        localStorage.setItem(ACCESS_STORAGE_KEY, "1");
      } catch {}
      document.body.classList.remove("locked");
      startApp();
    } else {
      errorMsg.textContent = "Ce code n'est pas valide. Vérifie l'orthographe.";
    }
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryUnlock();
  });
  const button = el("button", { class: "btn btn-primary", type: "button", onclick: tryUnlock }, ["Déverrouiller"]);
  const row = el("div", { class: "btn-row", style: { alignItems: "center", justifyContent: "center", marginTop: "0.8rem" } }, [input, button]);
  gate.appendChild(row);
  gate.appendChild(errorMsg);
  gate.appendChild(textEl("p", ACCESS_GATE_TEXTE.commentObtenir, { class: "small muted", style: { marginTop: "1.4rem" } }));
}

function startApp() {
  buildNav(document.getElementById("main-nav"));

  const topbarBtn = document.getElementById("topbar-menu-btn");
  if (topbarBtn) {
    topbarBtn.addEventListener("click", () => {
      const nav = document.getElementById("main-nav");
      nav.style.display = nav.style.display === "flex" ? "none" : "flex";
    });
  }

  setupToolboxFab();
  setupProgressFab();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  renderRoute();
}

function init() {
  if (isUnlocked()) {
    startApp();
  } else {
    renderAccessGate();
  }
}

document.addEventListener("DOMContentLoaded", init);
