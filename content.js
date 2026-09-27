/* ==========================================================================
   Le Labo des Déclics — contenu (données)
   Séparé de la logique (app.js) pour que le contenu reste facile à modifier
   par quelqu'un qui n'est pas développeur, ou par une autre IA plus tard.
   ========================================================================== */

// ------------------------------------------------------------------------
// Accès payant : codes valides pour déverrouiller l'application, et le
// texte affiché sur l'écran d'entrée. Pour changer ou ajouter un code,
// modifie seulement la liste ACCESS_CODES ci-dessous (pas besoin de
// toucher au reste du site). Le code entré n'est pas sensible à la casse.
// Attention : ce verrou vit uniquement dans le navigateur (localStorage),
// donc il empêche un accès accidentel mais peut être contourné par une
// personne qui connaît les outils de développement. Pour un vrai contrôle
// par personne (comptes, paiement en ligne), il faudrait un serveur.
// ------------------------------------------------------------------------
const ACCESS_CODES = ["LABO2026"];
const ACCESS_GATE_TEXTE = {
  intro: "L'accès complet au Labo des Déclics est réservé aux personnes qui ont obtenu un code d'accès.",
  commentObtenir: "[À REMPLACER PAR NELLY : indiquer ici comment obtenir un code, par exemple un courriel de contact ou un lien de paiement.]",
};

// ------------------------------------------------------------------------
// Aide : fabrique une illustration d'objets répétés (emoji) pour un exercice
// ------------------------------------------------------------------------
function objIllustration(emoji, count, groupSize) {
  return { emoji, count, groupSize: groupSize || null };
}

// ------------------------------------------------------------------------
// PÉTALES — les appuis (outils d'aide), classés par catégorie
// ------------------------------------------------------------------------
const PETALES_APPUIS = [
  {
    id: "respire",
    emoji: "🟦",
    label: "Je respire avec le carré",
    categorie: "methode",
    type: "respiration",
    description: "Suivre les côtés d'un carré du regard pour ralentir ma respiration : j'inspire, je retiens, j'expire, je retiens.",
  },
  {
    id: "dessine",
    emoji: "✏️",
    label: "Je dessine",
    categorie: "emotion",
    type: "dessin",
    description: "Mettre de côté ce qui bloque en dessinant un instant, avant de revenir à la tâche.",
  },
  {
    id: "pause",
    emoji: "🏝️",
    label: "Je prends une pause",
    categorie: "emotion",
    type: "phrases",
    description: "S'arrêter un instant avant de continuer.",
    phrases: [
      "J'ai besoin d'une pause de 2 minutes.",
      "Je reviens dans un instant.",
      "Je bois un peu d'eau et je reviens.",
    ],
  },
  {
    id: "aide",
    emoji: "🆘",
    label: "Je demande de l'aide",
    categorie: "methode",
    type: "phrases",
    description: "Dire précisément ce dont j'ai besoin.",
    phrases: [
      "Je ne comprends pas la consigne.",
      "J'ai besoin d'un exemple, s'il te plaît.",
      "Je connais le début mais je bloque après.",
      "Peux-tu relire avec moi ?",
    ],
  },
  {
    id: "premier-geste",
    emoji: "🚀",
    label: "Mon premier geste",
    categorie: "methode",
    type: "phrases",
    description: "Trouver juste le tout premier petit geste à faire, sans penser à tout le reste.",
    phrases: [
      "Je lis juste la première ligne.",
      "Je touche le premier objet.",
      "J'écris juste le premier chiffre.",
    ],
  },
  {
    id: "une-etape",
    emoji: "🪜",
    label: "Une étape à la fois",
    categorie: "methode",
    type: "phrases",
    description: "Ne regarder qu'une seule étape à la fois, cacher le reste.",
    phrases: [
      "Je cache la suite avec ma main.",
      "Je fais une étape, puis je m'arrête.",
    ],
  },
  {
    id: "dabord-ensuite",
    emoji: "🗂️",
    label: "D'abord, ensuite",
    categorie: "methode",
    type: "phrases",
    description: "Découper la tâche en deux morceaux : ce que je fais d'abord, ce que je fais ensuite.",
    phrases: [
      "D'abord je lis, ensuite je réponds.",
      "D'abord j'écoute, ensuite j'écris.",
    ],
  },
  {
    id: "prepare-changer",
    emoji: "🚦",
    label: "Je me prépare à changer",
    categorie: "emotion",
    type: "phrases",
    description: "Se donner un petit signal avant de passer à autre chose.",
    phrases: [
      "Encore une minute et je change d'activité.",
      "Je termine cette phrase, puis j'arrête.",
    ],
  },
  {
    id: "jai-le-choix",
    emoji: "👉",
    label: "J'ai le choix",
    categorie: "emotion",
    type: "phrases",
    description: "Se rappeler qu'il y a plus d'une façon de faire.",
    phrases: [
      "Je peux répondre à l'oral ou à l'écrit.",
      "Je peux dessiner ma réponse.",
    ],
  },
  {
    id: "je-bouge",
    emoji: "🙆",
    label: "Je bouge",
    categorie: "emotion",
    type: "phrases",
    description: "Se lever, bouger un peu, puis revenir quand on se sent prêt.",
    phrases: [
      "Je me lève et je reviens dans une minute.",
      "Je secoue mes mains, puis je continue.",
    ],
  },
  {
    id: "ilot-pause",
    emoji: "🏝️",
    label: "Mon îlot de pause",
    categorie: "emotion",
    type: "phrases",
    description: "Avoir un endroit ou un moment à moi, prévu à l'avance, pour souffler.",
    phrases: [
      "Je vais à mon coin calme.",
      "Je regarde mon objet réconfortant.",
    ],
  },
  {
    id: "ressenti",
    emoji: "🌡️",
    label: "Je montre mon ressenti",
    categorie: "emotion",
    type: "ressenti",
    description: "Indiquer comment je me sens en ce moment, sans avoir à l'expliquer avec des mots.",
  },
  {
    id: "consigne-morceaux",
    emoji: "✂️",
    label: "Ma consigne en morceaux",
    categorie: "methode",
    type: "phrases",
    description: "Séparer une longue consigne en petits morceaux plus faciles à suivre.",
    phrases: [
      "Peux-tu me redire juste la première partie ?",
      "Je fais un morceau, je vérifie, puis le suivant.",
    ],
  },
  {
    id: "etapes-cocher",
    emoji: "✅",
    label: "Mes étapes à cocher",
    categorie: "methode",
    type: "checklist",
    description: "Cocher chaque étape terminée pour voir sa progression.",
  },
];

// ------------------------------------------------------------------------
// Lexique : méthodes vs stratégies de régulation émotionnelle
// (réutilise PETALES_APPUIS, séparées par catégorie, plus les méthodes
//  d'exercice qui ne sont pas des appuis PÉTALES)
// ------------------------------------------------------------------------
const LEXIQUE_METHODES_EXERCICE = [
  {
    label: "D'abord → Ensuite (adapter un exercice)",
    description: "Découper un exercice en petites étapes, pour ne pas se sentir submergé par tout ce qu'il y a à faire d'un coup.",
  },
  {
    label: "Suivre la méthode étape par étape",
    description: "Revoir chaque étape d'un calcul ou d'une consigne, une par une, avant de répondre.",
  },
  {
    label: "Choisir un outil pour cet exercice",
    description: "Utiliser un support concret (dessin, ligne numérique, blocs) pour résoudre plutôt que de calculer seulement dans sa tête.",
  },
  {
    label: "Écouter la consigne",
    description: "Entendre la question lue à voix haute quand lire seul est difficile ou fatigant.",
  },
  {
    label: "Voir un indice",
    description: "Recevoir un petit coup de pouce, sans qu'on donne directement la réponse.",
  },
];

// ------------------------------------------------------------------------
// Parcours adaptés : regroupent les appuis PÉTALES déjà définis autour
// d'un besoin fonctionnel, pour entrer directement dans les exercices
// avec ces appuis épinglés et un rythme plus simple (un exercice à la
// fois, étapes ouvertes d'avance). Le nom vu par l'élève ne nomme jamais
// un diagnostic ; la note pour l'adulte donne des repères cliniques.
// ------------------------------------------------------------------------
const PARCOURS_BESOINS = [
  {
    id: "structure",
    emoji: "🪜",
    titre: "Suivre un chemin clair, étape par étape",
    description: "Les étapes sont annoncées à l'avance, une seule à la fois, sans surprise.",
    noteAdulte: "Souvent utile pour les élèves avec un TSA, ou tout élève qui a besoin de prévisibilité et d'un cadre explicite.",
    appuiIds: ["une-etape", "dabord-ensuite", "consigne-morceaux", "etapes-cocher"],
  },
  {
    id: "mouvement",
    emoji: "🙆",
    titre: "Bouger et faire des pauses en cours de route",
    description: "Des moments de pause et de mouvement sont prévus, sans que ça compte contre moi.",
    noteAdulte: "Utile pour les élèves qui ont besoin de réguler leur énergie ou leur attention (ex. profil TDAH), ou simplement après une longue période assise.",
    appuiIds: ["je-bouge", "ilot-pause", "pause", "premier-geste"],
  },
  {
    id: "regulation",
    emoji: "🟦",
    titre: "M'aider à me calmer et à dire comment je me sens",
    description: "Des outils pour ralentir, nommer ce qui se passe en moi, avant de continuer.",
    noteAdulte: "Utile en cas d'anxiété, de surcharge sensorielle, ou de besoin de transition entre deux activités.",
    appuiIds: ["respire", "ressenti", "dessine", "prepare-changer"],
  },
  {
    id: "autonomie",
    emoji: "👉",
    titre: "Avoir des choix et demander de l'aide facilement",
    description: "Plus d'une façon de répondre, et une façon simple de dire quand j'ai besoin d'aide.",
    noteAdulte: "Utile pour tout élève, avec ou sans diagnostic, qui a besoin de sentir qu'il garde un peu de contrôle sur la tâche.",
    appuiIds: ["aide", "jai-le-choix"],
  },
  {
    id: "soutien-general",
    emoji: "🌱",
    titre: "Un défi classique, sans besoin précis identifié",
    description: "Le même contenu, présenté un peu plus lentement, avec les outils de base à portée de main.",
    noteAdulte: "Pour tout élève qui bénéficierait d'un rythme plus doux, avec ou sans PEI, sans qu'un besoin spécifique ait été nommé.",
    appuiIds: ["aide", "une-etape", "premier-geste"],
  },
];

// ------------------------------------------------------------------------
// Fonctions exécutives : ce qui aide un adulte (parent ou professionnel)
// à comprendre POURQUOI une stratégie aide, et à choisir la bonne appui
// PÉTALES selon la fonction touchée plutôt qu'au hasard.
// ------------------------------------------------------------------------
const EXECUTIVE_FUNCTIONS = [
  {
    id: "inhibition",
    emoji: "🛑",
    label: "Inhibition (contrôle des impulsions)",
    description: "La capacité de retenir une réaction immédiate pour réfléchir avant d'agir.",
    defis: "L'enfant répond avant d'avoir fini de lire ou d'entendre la consigne, interrompt, ou choisit la première réponse qui lui vient.",
    astuce: "Proposer un seul choix visible à la fois, ou demander de répéter la consigne dans ses mots avant de répondre.",
    profilNote: "Souvent une des fonctions les plus touchées chez les élèves avec un profil TDAH.",
    appuiIds: ["une-etape", "premier-geste"],
  },
  {
    id: "memoire-travail",
    emoji: "🧩",
    label: "Mémoire de travail",
    description: "La capacité de garder une information en tête le temps de s'en servir, par exemple se rappeler la consigne pendant qu'on répond.",
    defis: "L'enfant oublie le début d'une consigne en cours de route, ou a besoin qu'on répète plusieurs fois.",
    astuce: "Découper la consigne en petits morceaux qu'on peut relire, plutôt que de tout redire de mémoire.",
    profilNote: "Peut être touchée dans plusieurs profils, dont le TDAH et certains troubles du langage.",
    appuiIds: ["consigne-morceaux", "etapes-cocher"],
  },
  {
    id: "flexibilite",
    emoji: "🔀",
    label: "Flexibilité cognitive",
    description: "La capacité de changer de stratégie ou de point de vue quand la première approche ne fonctionne pas, ou de passer d'une activité à une autre.",
    defis: "L'enfant reste bloqué sur une seule façon de faire, ou réagit fortement à un changement de plan imprévu.",
    astuce: "Annoncer les changements à l'avance, et proposer plus d'une façon valable de répondre.",
    profilNote: "Souvent une priorité chez les élèves avec un TSA, qui bénéficient de prévisibilité.",
    appuiIds: ["jai-le-choix", "prepare-changer"],
  },
  {
    id: "planification",
    emoji: "🗺️",
    label: "Planification et organisation",
    description: "La capacité de prévoir les étapes nécessaires pour arriver au but, dans le bon ordre.",
    defis: "L'enfant ne sait pas par où commencer, saute des étapes, ou se sent submergé par l'ensemble de la tâche.",
    astuce: "Découper la tâche en étapes visibles et cocher chaque étape terminée, une à la fois.",
    profilNote: "",
    appuiIds: ["dabord-ensuite", "etapes-cocher"],
  },
  {
    id: "initiation",
    emoji: "🚀",
    label: "Initiation de la tâche",
    description: "La capacité de démarrer une tâche, même quand elle demande un effort ou ne semble pas intéressante au premier abord.",
    defis: "L'enfant reste figé devant la page, retarde le début, ou dit qu'il ne sait pas comment commencer alors qu'il en est capable.",
    astuce: "Trouver ensemble le tout premier petit geste à faire, sans penser à toute la suite de la tâche.",
    profilNote: "",
    appuiIds: ["premier-geste", "aide"],
  },
  {
    id: "autoregulation-emotionnelle",
    emoji: "🌡️",
    label: "Autorégulation émotionnelle",
    description: "La capacité de gérer ses réactions pour rester disponible à la tâche, même face à une erreur ou une frustration.",
    defis: "L'enfant se décourage vite, réagit fortement à une erreur, ou refuse de continuer après un premier échec.",
    astuce: "Vérifier comment l'enfant se sent avant même de commencer : c'est souvent le meilleur indice pour anticiper la suite et prévoir les transitions entre les exercices.",
    profilNote: "Souvent une priorité chez les élèves anxieux ou avec un TSA, en cas de surcharge sensorielle.",
    appuiIds: ["respire", "ressenti", "pause", "ilot-pause"],
  },
];

// ------------------------------------------------------------------------
// Textes de présentation pour la page /fonctions-executives.
// Ordre voulu : d'abord comprendre ce qu'est une fonction exécutive,
// ensuite la posture du Labo (social avant clinique), puis le pont vers
// les outils, puis le modèle PÉTALES, puis les autres stratégies du
// quotidien avec le message le plus important en dernier (la pause).
// ------------------------------------------------------------------------
const FONCTIONS_EXECUTIVES_TEXTES = {
  intro:
    "Les fonctions exécutives, c'est un peu la tour de contrôle du cerveau : ce sont les capacités qui permettent de démarrer une tâche, de s'organiser, de rester concentré, de changer de stratégie au besoin, et de gérer ses réactions. On en distingue généralement six : l'inhibition, la mémoire de travail, la flexibilité cognitive, la planification et l'organisation, l'initiation de la tâche, et l'autorégulation émotionnelle. Chaque enfant les développe à son propre rythme, et la plupart des difficultés d'apprentissage touchent au moins une de ces fonctions.",
  philosophie:
    "Le Labo des Déclics a été conçu par une travailleuse sociale scolaire, à partir de ce qui s'observe sur le terrain : une difficulté d'apprentissage crée souvent de la frustration, et cette frustration peut mener à de l'anxiété, à une perte de confiance, ou à de l'évitement. Mais un élève qui vit ces difficultés reste un élève capable de réussir : il a besoin de temps, de structure et de méthode. C'est pourquoi Le Labo des Déclics choisit une approche sociale avant clinique : comprendre et accompagner l'élève dans son rythme, avec ou sans diagnostic, plutôt que de partir d'un enjeu clinique.",
  pontVersOutils:
    "Une fois le défi mieux compris, l'étape suivante est de choisir le bon outil. Pour chacune des six fonctions exécutives, Le Labo des Déclics propose au moins un outil PÉTALES pensé pour répondre spécifiquement à ce défi.",
  petalesIntro:
    "PÉTALES est le modèle d'intervention conçu par Nelly Folefack, travailleuse sociale, pour accompagner les enfants en contexte scolaire. Le nom vient d'une fleur à sept pétales : Posture, Évaluation, Transitions, Ajustement, Lien, Équité, Soutien. Dans Le Labo des Déclics, les outils PÉTALES sont une version concrète de ce modèle, pensée pour les moments d'apprentissage : chaque outil répond à une ou plusieurs fonctions exécutives précises.",
  autresStrategiesIntro:
    "En plus des outils PÉTALES liés à chaque fonction, quelques stratégies simples aident à bien commencer une tâche, surtout quand la frustration pointe déjà le bout du nez.",
  pauseMessage:
    "Un enfant qui vit des défis d'apprentissage n'est pas prêt pour de longues périodes de travail. Toujours prévoir un moment de pause entre les activités, avant que la fatigue ou la frustration ne s'installe.",
  outilsCodesIntro:
    "Pour les professionnels, le guide PÉTALES 2026 de Nelly Folefack propose aussi sept outils d'intervention codés, choisis selon la fonction exécutive touchée et la situation vécue par l'élève.",
};

// ------------------------------------------------------------------------
// Les 7 outils d'intervention codés du guide PÉTALES 2026 (volet
// professionnel), tels que nommés par Nelly. Seul le nom et le sens de
// l'acronyme sont repris ici ; le protocole détaillé de chacun vit dans
// le guide complet.
// ------------------------------------------------------------------------
const PETALES_OUTILS_CODES = [
  { code: "SVT", nom: "Séquence Visuelle Transition" },
  { code: "SIT", nom: "Support d'Initiation de Tâche" },
  { code: "RES", nom: "Routine d'Exécution Séquentielle" },
  { code: "DAE", nom: "D'abord-Ensuite" },
  { code: "CGC", nom: "Choix Guidés de Coopération" },
  { code: "RMI", nom: "Régulation Motrice Intégrée" },
  { code: "RAP", nom: "Routine d'Autorégulation Progressive" },
];

// ------------------------------------------------------------------------
// Situations vécues par l'adulte (rubrique « Que faire quand c'est
// difficile ? » de l'espace parents/professionnels). Chaque situation
// relie une observation concrète à un ou deux appuis PÉTALES déjà
// définis plus haut, plutôt que de proposer un contenu séparé : le but
// est que l'adulte retrouve exactement les mêmes outils que l'enfant
// voit dans sa propre boîte à outils.
// ------------------------------------------------------------------------
const ADULT_SITUATIONS = [
  {
    id: "demarrer",
    emoji: "🚀",
    titre: "Il ou elle n'arrive pas à démarrer une tâche",
    observe: "L'enfant reste devant la page sans rien écrire, retarde le début, ou dit qu'il ne sait pas comment commencer alors qu'il en est capable une fois lancé.",
    essayer: [
      "Réduire la première demande à un seul petit geste, pas à toute la tâche.",
      "Montrer ce premier geste plutôt que de l'expliquer une deuxième fois.",
      "Rester à côté le temps de ce premier geste, puis s'éloigner un peu.",
    ],
    phrase: "On fait juste la toute première ligne ensemble, le reste attend.",
    eviter: "Répéter la consigne en entier plusieurs fois, ou demander « pourquoi tu ne commences pas ? ».",
    siInsuffisant: "Si le blocage revient à chaque tâche, ce n'est pas un manque de volonté : il peut s'agir d'un vrai défi d'initiation, à observer plutôt qu'à corriger.",
    appuiIds: ["premier-geste", "aide"],
    fonctionId: "initiation",
  },
  {
    id: "frustration",
    emoji: "😤",
    titre: "Il ou elle se sent frustré après une erreur",
    observe: "L'enfant froisse sa feuille, dit « je suis nul », abandonne l'exercice ou hausse le ton après avoir vu une réponse marquée incorrecte.",
    essayer: [
      "Nommer ce qu'on observe, sans minimiser : « Je vois que ça t'a fâché. »",
      "Proposer une pause courte avant de regarder l'erreur ensemble.",
      "Revenir sur l'erreur plus tard, une fois calmé, pas dans l'instant.",
    ],
    phrase: "On arrête une minute. On y revient après.",
    eviter: "Dire « ce n'est pas grave » tout de suite, ou insister pour continuer l'exercice pendant la frustration.",
    siInsuffisant: "Si la frustration revient à chaque erreur, quelle que soit la matière, un outil de régulation peut être introduit avant même de commencer l'activité, pas seulement après coup.",
    appuiIds: ["pause", "respire", "je-bouge"],
    fonctionId: "autoregulation-emotionnelle",
  },
  {
    id: "inquietude",
    emoji: "😟",
    titre: "Il ou elle est inquiet avant même de commencer",
    observe: "L'enfant pose beaucoup de questions avant de débuter, dit qu'il a peur de se tromper, ou évite carrément d'essayer.",
    essayer: [
      "Vérifier comment l'enfant se sent avant de parler du contenu de la tâche.",
      "Rappeler qu'essayer et se tromper font partie de la façon d'apprendre ici.",
      "Offrir un choix simple sur la façon de répondre (à l'oral, à l'écrit, en dessin).",
    ],
    phrase: "Tu peux essayer, ce n'est pas grave si ce n'est pas parfait du premier coup.",
    eviter: "Minimiser l'inquiétude avec « il n'y a pas de quoi s'en faire », ou multiplier les encouragements avant même d'avoir nommé ce qui inquiète.",
    siInsuffisant: "Une inquiétude qui revient avant chaque tâche, même familière, mérite d'être partagée avec l'école : ce n'est pas une question de motivation.",
    appuiIds: ["ressenti", "respire", "jai-le-choix"],
    fonctionId: "autoregulation-emotionnelle",
  },
  {
    id: "fil",
    emoji: "🧵",
    titre: "Il ou elle perd le fil en cours de route",
    observe: "L'enfant commence bien, puis semble se perdre au milieu de l'exercice, oublie une consigne donnée plus tôt, ou revient sur une étape déjà faite.",
    essayer: [
      "Découper la tâche en petits morceaux qu'on peut relire un à la fois.",
      "Cocher chaque étape terminée pour garder une trace visible de l'avancement.",
      "Cacher la suite avec la main ou une feuille, pour ne montrer qu'une étape.",
    ],
    phrase: "On fait un petit bout, on vérifie, puis on continue.",
    eviter: "Redire toute la consigne d'un coup, plus vite, en pensant que ça aidera à la retenir.",
    siInsuffisant: "Si l'enfant garde le fil facilement à l'oral mais le perd à l'écrit (ou l'inverse), c'est une piste utile à partager avec l'école.",
    appuiIds: ["consigne-morceaux", "etapes-cocher", "dabord-ensuite"],
    fonctionId: "memoire-travail",
  },
  {
    id: "consigne",
    emoji: "✂️",
    titre: "Il ou elle ne comprend pas la consigne",
    observe: "L'enfant répond à côté, demande de répéter plusieurs fois, ou reste silencieux sans dire qu'il n'a pas compris.",
    essayer: [
      "Demander de redire la consigne dans ses propres mots, sans jugement sur la réponse.",
      "Donner un exemple concret avant de demander une réponse.",
      "Séparer une longue consigne en deux ou trois phrases plus courtes.",
    ],
    phrase: "Redis-moi ce que tu as compris, avec tes mots.",
    eviter: "Supposer qu'un silence veut dire un refus plutôt qu'une incompréhension.",
    siInsuffisant: "Si comprendre une consigne orale est systématiquement plus difficile qu'une consigne écrite (ou l'inverse), le préciser à l'équipe-école aide à mieux adapter les prochaines tâches.",
    appuiIds: ["consigne-morceaux", "aide"],
    fonctionId: "memoire-travail",
  },
  {
    id: "bouger",
    emoji: "🙆",
    titre: "Il ou elle a besoin de bouger",
    observe: "L'enfant s'agite sur sa chaise, se lève sans le dire, ou devient plus difficile à rejoindre après une longue période assise.",
    essayer: [
      "Prévoir une courte pause de mouvement avant que l'agitation ne monte, pas seulement après.",
      "Autoriser un déplacement court et prévu (aller chercher un objet, changer de place) plutôt que de l'interdire.",
      "Revenir à la tâche tout de suite après la pause, sans faire durer la transition.",
    ],
    phrase: "Trente secondes pour bouger, puis on reprend.",
    eviter: "Considérer le mouvement comme un manque de respect plutôt qu'un besoin réel de régulation.",
    siInsuffisant: "Un besoin de mouvement très fréquent, plusieurs fois par activité, vaut la peine d'être documenté avec l'école pour ajuster le rythme des tâches proposées.",
    appuiIds: ["je-bouge", "ilot-pause"],
    fonctionId: "inhibition",
  },
  {
    id: "transition",
    emoji: "🚦",
    titre: "Il ou elle a du mal à changer d'activité",
    observe: "L'enfant proteste, ralentit volontairement, ou semble ne pas entendre quand vient le moment de passer à autre chose.",
    essayer: [
      "Annoncer le changement à l'avance, pas au moment même où il doit se produire.",
      "Donner un signal simple et toujours le même (un mot, un geste) avant la transition.",
      "Laisser terminer une toute petite portion de ce qui est en cours, plutôt que d'arrêter net.",
    ],
    phrase: "Encore une minute, puis on change d'activité.",
    eviter: "Changer d'activité sans prévenir, même pour une transition qui semble anodine pour l'adulte.",
    siInsuffisant: "Des transitions difficiles de façon répétée, dans plusieurs contextes, sont un repère utile à partager, surtout si un changement de routine est prévu.",
    appuiIds: ["prepare-changer", "jai-le-choix"],
    fonctionId: "flexibilite",
  },
  {
    id: "deborde",
    emoji: "🏝️",
    titre: "Il ou elle semble débordé, submergé",
    observe: "L'enfant dit qu'il y a trop de choses à faire, regarde la tâche sans bouger, ou multiplie les petites plaintes sans lien direct avec l'exercice.",
    essayer: [
      "Réduire ce qui est visible à un seul élément à la fois (cacher ou ranger le reste).",
      "Offrir un moment de pause dans un endroit prévu à l'avance, avant de reprendre.",
      "Reformuler la tâche en une seule question simple, plutôt qu'en plusieurs consignes.",
    ],
    phrase: "On met le reste de côté. On ne regarde que ça, pour l'instant.",
    eviter: "Ajouter des explications supplémentaires pendant que l'enfant est déjà submergé : ça peut alourdir plutôt qu'aider.",
    siInsuffisant: "Si le sentiment d'être débordé apparaît même pour des tâches courtes et familières, il peut être utile d'en discuter avec l'école pour revoir la charge proposée.",
    appuiIds: ["ilot-pause", "dessine", "une-etape"],
    fonctionId: "autoregulation-emotionnelle",
  },
];

// ------------------------------------------------------------------------
// Matières
// ------------------------------------------------------------------------
const SUBJECTS = [
  {
    id: "numeratie",
    emoji: "🧱",
    label: "Numératie",
    labelAvecArticle: "la numératie",
    sontOuEst: "est",
    tagline: "Compter, comparer, reconnaître les quantités.",
    pourquoi:
      "Les nombres sont partout autour de toi : pour compter tes jouets, savoir combien de temps il reste, ou partager équitablement. Apprendre à les reconnaître et à les comparer, c'est un peu comme apprendre un nouveau langage secret qui t'aide dans plein de moments de tous les jours.",
  },
  {
    id: "maths",
    emoji: "🚗",
    label: "Mathématiques",
    labelAvecArticle: "les mathématiques",
    sontOuEst: "sont",
    tagline: "Additionner, soustraire, faire des groupes égaux.",
    pourquoi:
      "Les mathématiques t'aident à résoudre des petits problèmes du quotidien : combien il te reste d'argent de poche, combien de temps avant la récréation, comment partager équitablement entre amis. Chaque fois que tu additionnes ou soustrais, tu deviens un peu plus fort pour résoudre des défis, à l'école et ailleurs.",
  },
  {
    id: "lecture",
    emoji: "📖",
    label: "Lecture",
    labelAvecArticle: "la lecture",
    sontOuEst: "est",
    tagline: "Comprendre un texte : qui, où, quand, début, événements, fin.",
    pourquoi:
      "Lire, c'est une clé qui ouvre plein de portes : comprendre une histoire, suivre une consigne, découvrir un monde imaginaire. Plus tu pratiques, plus cette clé devient facile à utiliser, et plus tu deviens libre de découvrir ce qui t'intéresse.",
  },
];

const LEVELS = [1, 2, 3, 4, 5];

// ------------------------------------------------------------------------
// Intro "à quoi ça sert" par matière et niveau (avec lien aux amis en numératie)
// ------------------------------------------------------------------------
const SUBJECT_INTRO = {
  numeratie: {
    1: { why: "Compter m'aide à savoir combien j'ai de choses, comme mes jouets ou mes crayons.", example: "Avec mes amis, on compte les cartes qu'on a chacun avant de commencer à jouer, pour être justes." },
    2: { why: "Comparer des quantités m'aide à partager également.", example: "Je prépare une assiette pour chaque ami : est-ce que j'en ai assez pour tout le monde ?" },
    3: { why: "Faire des groupes égaux m'aide à organiser des choses en équipe.", example: "On est 12 amis à la récréation, on veut faire des équipes de 4 pour un jeu : combien d'équipes ça fait ?" },
    4: { why: "Représenter un nombre de plusieurs façons m'aide à vérifier que j'ai bien compris une quantité.", example: "Je compte les jetons de mon jeu de société avec mes amis, et je vérifie qu'on est tous d'accord sur le total." },
    5: { why: "Comprendre les fractions m'aide à partager équitablement.", example: "On partage une pizza entre amis : est-ce que tout le monde a vraiment la même part ?" },
  },
  maths: {
    1: { why: "Additionner et enlever sert à savoir ce qu'il reste : après avoir donné 2 cartes, après avoir mangé 1 biscuit, quand on reçoit un cadeau.", example: "J'ai 3 voitures. On m'en donne 2. Je cherche combien j'en ai maintenant." },
    2: { why: "Représenter un nombre de plusieurs façons m'aide à mieux le comprendre, pas juste à le mémoriser.", example: "13 + 4 : je peux le voir avec des objets, avec des dizaines et des unités, ou sur une ligne numérique." },
    3: { why: "Faire des groupes égaux, c'est le début de la multiplication.", example: "J'ai 4 sacs de 3 billes chacun. Combien de billes en tout ?" },
    4: { why: "Multiplier m'aide à calculer plus vite quand il y a plusieurs groupes identiques.", example: "5 amis ont chacun 6 autocollants. Combien d'autocollants en tout ?" },
    5: { why: "Les fractions m'aident à parler de parts d'un tout.", example: "J'ai mangé la moitié de ma barre de céréales. Combien m'en reste-t-il ?" },
  },
  lecture: {
    1: { why: "Reconnaître les lettres et leurs sons est la toute première étape pour apprendre à lire.", example: "Je reconnais le son au début du mot 'ami' pour savoir comment il commence." },
    2: { why: "Comprendre un texte m'aide à suivre une histoire ou une consigne.", example: "Je lis une invitation pour savoir où et quand retrouver mes amis." },
    3: { why: "Repérer les idées d'un texte m'aide à en parler avec quelqu'un d'autre.", example: "Je raconte à un ami ce qui s'est passé dans l'histoire que je viens de lire." },
    4: { why: "Résumer un texte m'aide à retenir l'essentiel sans tout réécrire.", example: "Je résume en une phrase ce qui arrive au personnage principal." },
    5: { why: "Expliquer un texte m'aide à donner mon avis sur ce que j'ai compris.", example: "Je explique à un ami pourquoi un personnage a fait ce choix." },
  },
};

// ------------------------------------------------------------------------
// Générateur d'exercices "calcul" (addition / soustraction) avec illustration
// ------------------------------------------------------------------------
function calcExercise(id, a, b, op, emoji) {
  const correct = op === "+" ? a + b : a - b;
  const choices = [correct - 1, correct, correct + 1].sort(() => Math.random() - 0.5);
  return {
    id,
    type: "choix",
    prompt: `${a} ${op} ${b} = ?`,
    illustration: op === "+" ? objIllustration(emoji, a) : objIllustration(emoji, a),
    choices,
    correct,
    listenText: `${a} ${op === "+" ? "plus" : "moins"} ${b}`,
    hint: op === "+" ? "Compte d'abord le premier groupe, puis ajoute le deuxième." : "Compte le groupe de départ, puis enlève ce qu'on retire.",
    abordEnsuite: [
      "Je regarde le premier nombre.",
      op === "+" ? "J'ajoute le deuxième nombre, un par un." : "J'enlève le deuxième nombre, un par un.",
      "Je vérifie mon résultat avec mes doigts ou un dessin.",
      "Je choisis ma réponse.",
    ],
  };
}

function compareExercise(id, a, b, emoji) {
  const correct = a > b ? "plus grand" : a < b ? "plus petit" : "égal";
  return {
    id,
    type: "choix",
    prompt: `${a} et ${b} : lequel est le plus grand ?`,
    // Les deux groupes doivent être visibles pour que l'enfant puisse
    // compter et comparer concrètement (un enfant qui sort du jardin ne
    // compare pas encore deux chiffres seulement dans sa tête).
    illustrationCompare: [objIllustration(emoji, a), objIllustration(emoji, b)],
    choices: [String(a), String(b), "Ils sont égaux"],
    correct: a === b ? "Ils sont égaux" : String(Math.max(a, b)),
    listenText: `Compare ${a} et ${b}`,
    hint: "Compte les objets de chaque groupe, puis compare.",
    abordEnsuite: [
      "Je compte le premier groupe.",
      "Je compte le deuxième groupe.",
      "Je compare les deux nombres.",
      "Je choisis le plus grand, ou je dis qu'ils sont égaux.",
    ],
  };
}

// ------------------------------------------------------------------------
// Ranger des nombres en ordre croissant (du plus petit au plus grand) ou
// décroissant (du plus grand au plus petit). Question à choix, cohérente
// avec le reste du moteur d'exercices.
// ------------------------------------------------------------------------
function orderExercise(id, numbers, direction) {
  const correct = direction === "croissant" ? Math.min(...numbers) : Math.max(...numbers);
  const choices = numbers.slice().sort(() => Math.random() - 0.5);
  const directionTexte =
    direction === "croissant" ? "l'ordre croissant (du plus petit au plus grand)" : "l'ordre décroissant (du plus grand au plus petit)";
  return {
    id,
    type: "choix",
    prompt: `Parmi ${numbers.join(", ")}, lequel vient en premier si on range dans ${directionTexte} ?`,
    choices,
    correct,
    listenText: `Range ${numbers.join(", ")} ${direction === "croissant" ? "du plus petit au plus grand" : "du plus grand au plus petit"}`,
    hint:
      direction === "croissant"
        ? "Cherche d'abord le plus petit nombre : c'est lui qui vient en premier."
        : "Cherche d'abord le plus grand nombre : c'est lui qui vient en premier.",
    abordEnsuite: [
      "Je regarde les nombres, un par un.",
      direction === "croissant" ? "Je cherche le plus petit de tous." : "Je cherche le plus grand de tous.",
      "Je vérifie en comparant les nombres deux par deux.",
      "Je choisis ma réponse.",
    ],
  };
}

// ------------------------------------------------------------------------
// Choisir le signe < > = entre deux quantités. On commence avec de petits
// nombres (pas un grand saut du genre 35 puis 508 tout de suite) et on
// s'appuie d'abord sur le moyen mnémotechnique du crocodile (la bouche
// grande ouverte va vers la plus grande quantité, la pointe vers la plus
// petite) avant de le retirer progressivement, une fois que le signe seul
// suffit — même logique que "je fais, on fait, tu fais".
// crocoStage: "grand" (crocodile affiché en grand, expliqué), "petit"
// (crocodile qui rapetisse, transition), "aucun" (signe seul, avec un
// bouton pour revoir le crocodile au besoin).
// ------------------------------------------------------------------------
function signeExercise(id, a, b, crocoStage, emoji) {
  const correct = a < b ? "<" : a > b ? ">" : "=";
  return {
    id,
    type: "signe",
    prompt: `Quel signe convient entre ${a} et ${b} ?`,
    illustrationCompare: [objIllustration(emoji || "🔵", a), objIllustration(emoji || "🔵", b)],
    choices: ["<", ">", "="],
    correct,
    crocoStage: crocoStage || "aucun",
    listenText: `Compare ${a} et ${b}`,
    hint: "Compare d'abord les deux quantités, puis choisis le signe : le crocodile peut t'aider si tu en as besoin.",
    abordEnsuite: [
      "Je compte le premier groupe.",
      "Je compte le deuxième groupe.",
      "Je me demande lequel a le plus, ou s'ils sont pareils.",
      "Je choisis le signe qui va avec.",
    ],
  };
}

function countExercise(id, count, emoji) {
  const choices = [count - 1, count, count + 1].filter((n) => n > 0).sort(() => Math.random() - 0.5);
  return {
    id,
    type: "choix",
    prompt: "Combien y a-t-il d'objets ?",
    illustration: objIllustration(emoji, count),
    choices,
    correct: count,
    listenText: `Combien y a-t-il de ${emoji} ?`,
    hint: "Touche chaque objet du doigt en comptant un par un.",
    abordEnsuite: [
      "Je touche le premier objet et je dis 1.",
      "Je continue à toucher chaque objet en comptant.",
      "Je dis le dernier nombre à voix haute : c'est le total.",
      "Je choisis ma réponse.",
    ],
  };
}

function groupsExercise(id, groupCount, groupSize, emoji) {
  const correct = groupCount * groupSize;
  const choices = [correct - groupSize, correct, correct + groupSize].sort(() => Math.random() - 0.5);
  return {
    id,
    type: "choix",
    prompt: `${groupCount} groupes de ${groupSize} : combien en tout ?`,
    illustration: objIllustration(emoji, groupCount * groupSize, groupSize),
    choices,
    correct,
    listenText: `${groupCount} groupes de ${groupSize}`,
    hint: "Compte un groupe à la fois, puis additionne tous les groupes.",
    abordEnsuite: [
      "Je compte les objets dans un seul groupe.",
      "Je fais la même chose pour chaque groupe.",
      "J'additionne le total de tous les groupes.",
      "Je choisis ma réponse.",
    ],
  };
}

function fractionExercise(id, whole, eaten, emoji) {
  const remaining = whole - eaten;
  return {
    id,
    type: "choix",
    prompt: `J'ai ${whole} parts. J'en ai mangé ${eaten}. Combien m'en reste-t-il ?`,
    illustration: objIllustration(emoji, whole),
    choices: [remaining - 1, remaining, remaining + 1].filter((n) => n >= 0).sort(() => Math.random() - 0.5),
    correct: remaining,
    listenText: `${whole} parts, j'en mange ${eaten}`,
    hint: "Compte le total, puis enlève les parts déjà mangées.",
    abordEnsuite: [
      "Je compte le nombre total de parts.",
      "J'enlève les parts déjà mangées.",
      "Je compte ce qu'il reste.",
      "Je choisis ma réponse.",
    ],
  };
}

// ------------------------------------------------------------------------
// Le calendrier : ancrer les nombres et l'ordre dans le monde réel de
// l'enfant (les jours de l'école), plutôt que seulement sur une ligne
// de chiffres abstraite.
// ------------------------------------------------------------------------
const JOURS_SEMAINE = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function jourSuivantExercise(id, jour, distracteurs) {
  const idx = JOURS_SEMAINE.indexOf(jour);
  const suivant = JOURS_SEMAINE[(idx + 1) % 7];
  return {
    id,
    type: "choix",
    prompt: `Quel jour vient juste après ${jour} ?`,
    choices: [suivant, ...distracteurs].sort(() => Math.random() - 0.5),
    correct: suivant,
    listenText: `Quel jour vient après ${jour} ?`,
    hint: "Récite les jours de la semaine dans l'ordre, en partant de lundi, jusqu'à trouver celui qui vient juste après.",
    abordEnsuite: [
      "Je récite les jours de la semaine dans l'ordre : lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche.",
      "Je m'arrête au jour donné dans la question.",
      "Je dis le jour qui vient juste après.",
      "Je choisis ma réponse.",
    ],
  };
}

function joursJusquaExercise(id, jourDepart, jourArrivee, nbJours) {
  return {
    id,
    type: "choix",
    prompt: `On est ${jourDepart}. Il reste combien de jours avant ${jourArrivee} ?`,
    choices: [nbJours - 1, nbJours, nbJours + 1].filter((n) => n > 0).sort(() => Math.random() - 0.5),
    correct: nbJours,
    listenText: `Combien de jours entre ${jourDepart} et ${jourArrivee} ?`,
    hint: "Compte les jours un par un, en partant du lendemain, jusqu'à arriver au jour demandé.",
    abordEnsuite: [
      "Je pars du lendemain du jour de départ.",
      "Je compte chaque jour un par un.",
      "Je m'arrête quand j'arrive au jour d'arrivée.",
      "Je choisis ma réponse.",
    ],
  };
}

// ------------------------------------------------------------------------
// La monnaie et le magasin : la monnaie canadienne, dans une mise en
// situation d'achat, pour montrer que l'addition et la soustraction
// servent tous les jours (l'argent de poche, un achat).
// ------------------------------------------------------------------------
function monnaieAdditionExercise(id, a, b) {
  const correct = a + b;
  return {
    id,
    type: "choix",
    prompt: `Tu as une pièce de ${a} ¢ et une pièce de ${b} ¢. Combien as-tu en tout ?`,
    choices: [correct - 5, correct, correct + 5].filter((n) => n > 0).map((n) => n + " ¢").sort(() => Math.random() - 0.5),
    correct: correct + " ¢",
    listenText: `${a} cents plus ${b} cents`,
    hint: "Additionne la valeur des deux pièces, comme pour une addition normale.",
    abordEnsuite: [
      "Je regarde la valeur de la première pièce.",
      "J'ajoute la valeur de la deuxième pièce.",
      "Je vérifie mon calcul.",
      "Je choisis ma réponse.",
    ],
  };
}

function magasinAdditionExercise(id, objet1, prix1, objet2, prix2) {
  const correct = prix1 + prix2;
  return {
    id,
    type: "choix",
    prompt: `Au magasin, tu achètes ${objet1} à ${prix1} ¢ et ${objet2} à ${prix2} ¢. Combien ça coûte en tout ?`,
    choices: [correct - 5, correct, correct + 5].filter((n) => n > 0).map((n) => n + " ¢").sort(() => Math.random() - 0.5),
    correct: correct + " ¢",
    listenText: `Le prix de ${objet1} plus le prix de ${objet2}`,
    hint: "Additionne le prix des deux objets, comme pour une addition normale.",
    abordEnsuite: [
      "Je regarde le prix du premier objet.",
      "J'ajoute le prix du deuxième objet.",
      "Je vérifie mon calcul.",
      "Je choisis ma réponse.",
    ],
  };
}

function monnaieRenduExercise(id, montantPaye, prixArticle) {
  const correct = montantPaye - prixArticle;
  return {
    id,
    type: "choix",
    prompt: `Un objet coûte ${prixArticle} ¢. Tu payes avec ${montantPaye} ¢. Combien la caissière doit-elle te remettre ?`,
    choices: [correct - 5, correct, correct + 5].filter((n) => n >= 0).map((n) => n + " ¢").sort(() => Math.random() - 0.5),
    correct: correct + " ¢",
    listenText: `${montantPaye} cents moins ${prixArticle} cents`,
    hint: "Calcule ce qu'il reste après avoir payé, comme pour une soustraction.",
    abordEnsuite: [
      "Je regarde le montant payé.",
      "J'enlève le prix de l'objet.",
      "Je vérifie mon calcul.",
      "Je choisis ma réponse.",
    ],
  };
}

function magasinResteExercise(id, argentDepart, prixArticle) {
  const correct = argentDepart - prixArticle;
  return {
    id,
    type: "choix",
    prompt: `Tu as ${argentDepart} ¢ d'argent de poche. Tu achètes un objet à ${prixArticle} ¢. Combien te reste-t-il ?`,
    choices: [correct - 5, correct, correct + 5].filter((n) => n >= 0).map((n) => n + " ¢").sort(() => Math.random() - 0.5),
    correct: correct + " ¢",
    listenText: `${argentDepart} cents moins ${prixArticle} cents`,
    hint: "Calcule ce qu'il te reste après avoir payé.",
    abordEnsuite: [
      "Je regarde combien j'avais au départ.",
      "J'enlève le prix payé.",
      "Je vérifie mon calcul.",
      "Je choisis ma réponse.",
    ],
  };
}

// ------------------------------------------------------------------------
// Questions de réflexion pour accompagner la lecture d'un vrai livre,
// dans l'esprit d'un dé de compréhension : avant, pendant et après la
// lecture. Six questions par phase, pour correspondre aux six faces
// d'un vrai dé. Pas de bonne ou de mauvaise réponse ici, l'important
// est de réfléchir et d'en discuter avec un adulte ou seul·e.
// ------------------------------------------------------------------------
const REFLEXION_AVANT = [
  "Regarde la couverture du livre : que remarques-tu ? Décris ce que tu vois.",
  "D'après le titre, à ton avis, de quoi va parler cette histoire ?",
  "Est-ce que tu connais déjà quelque chose sur ce sujet ? Raconte ce que tu sais.",
  "Pourquoi as-tu envie de lire ce livre ?",
  "Regarde les images à l'intérieur du livre : qu'est-ce qu'elles t'apprennent avant même de lire le texte ?",
  "As-tu déjà lu un livre qui ressemble à celui-ci ? Lequel, et en quoi ?",
];
const REFLEXION_PENDANT = [
  "Y a-t-il un mot que tu ne connais pas ? Essaie de deviner ce qu'il veut dire grâce aux mots autour.",
  "Que penses-tu qu'il va se passer ensuite dans l'histoire ?",
  "Si tu étais le personnage principal, que ferais-tu à sa place ?",
  "Peux-tu expliquer, dans tes mots, ce qui vient de se passer ?",
  "Fais une pause : que comprends-tu jusqu'à maintenant de l'histoire ?",
  "Y a-t-il quelque chose que tu ne comprends pas encore ? Qu'est-ce que tu pourrais faire pour mieux comprendre ?",
];
const REFLEXION_APRES = [
  "Raconte, dans tes mots, ce qui s'est passé dans l'histoire.",
  "Quel est ton personnage préféré ? Explique pourquoi.",
  "As-tu trouvé ce livre facile ou difficile ? Pourquoi ?",
  "Si tu pouvais poser une question au personnage principal, laquelle serait-ce ?",
  "Quel était le problème dans l'histoire, et comment a-t-il été réglé ?",
  "Est-ce que le titre du livre te semble bien choisi ? Pourquoi ?",
];

function reflexionExercise(id, phase, questions) {
  return { id, type: "reflexion", phase, questions };
}

// ------------------------------------------------------------------------
// Exercices de lecture : "je lis les mots" (clique pour entendre le son)
// ------------------------------------------------------------------------
function readWordExercise(id, word, question, choices, correct) {
  return {
    id,
    type: "lecture-mot",
    word,
    prompt: question,
    choices,
    correct,
    listenText: question,
    hint: "Clique sur le mot pour entendre comment il se prononce, puis choisis ta réponse.",
    abordEnsuite: [
      "J'écoute le mot en cliquant dessus.",
      "Je répète le mot dans ma tête ou à voix haute.",
      "Je pense à ce que ce mot veut dire.",
      "Je choisis ma réponse.",
    ],
  };
}

// ------------------------------------------------------------------------
// Présentation du projet, affichée en sections dépliables sur l'accueil,
// AVANT le choix d'un rôle (élève/parent/professionnel) : un visiteur qui
// ne se présente pas encore doit comprendre ce qu'est la plateforme, ses
// objectifs, à qui elle s'adresse, et d'où vient l'idée, avant de choisir.
// ------------------------------------------------------------------------
const HOME_PRESENTATION = [
  {
    titre: "Pourquoi ce projet ?",
    texte:
      "Ce projet a été conçu par une travailleuse sociale scolaire, à partir de ce qu'elle observe sur le terrain : il est parfois difficile pour un élève de trouver sa propre stratégie, de repérer ce qui fonctionne pour lui, de reconnaître ses forces, et de savoir comment s'autoréguler quand une matière devient difficile à comprendre.",
  },
  {
    titre: "Pourquoi « labo » et pourquoi « déclic » ?",
    texte:
      "Un laboratoire, c'est un endroit où on essaie, on observe, on ajuste, sans qu'il y ait de bonne ou de mauvaise façon de faire. Un déclic, c'est ce moment où une stratégie fonctionne enfin pour soi. Le nom rappelle que chaque enfant a ses propres déclics, à découvrir à son rythme.",
  },
  {
    titre: "Quels sont les objectifs ?",
    liste: [
      "Permettre à l'élève d'apprendre à son rythme, à l'école comme à la maison, et de trouver ses stratégies quand une tâche devient difficile.",
      "Aider les parents à mieux connaître ce qui soutient leur enfant et à construire un plan d'appui à la maison.",
      "Faciliter la collaboration et le partage de stratégies entre la famille et l'école.",
    ],
  },
  {
    titre: "À qui s'adresse cette plateforme ?",
    texte:
      "Aux élèves ayant des défis d'apprentissage, à leurs parents, aux enseignants et autres professionnels de l'école, et à tout autre adulte qui les accompagne, avec ou sans diagnostic. Même un élève sans TDAH ni TSA peut avoir une fonction exécutive touchée : ça peut être lié à l'anxiété, à la peur de l'échec, ou simplement à un rythme d'apprentissage différent.",
  },
  {
    titre: "D'où vient l'idée de ce projet ?",
    texte:
      "Le Labo des Déclics est né de l'observation des fonctions exécutives : les capacités du cerveau qui permettent de démarrer une tâche, de s'organiser, de rester concentré, de changer de stratégie au besoin, et de gérer ses réactions. On en distingue généralement six : l'inhibition, la mémoire de travail, la flexibilité cognitive, la planification et l'organisation, l'initiation de la tâche, et l'autorégulation émotionnelle. Le Labo des Déclics a été conçu par Nelly Folefack, travailleuse sociale inscrite (MSW, RSW), qui a constaté sur le terrain que la plupart des échecs ou des défis vécus à l'école sont souvent liés à de l'anxiété, à une perte de confiance ou à de l'évitement, bien avant tout diagnostic officiel. C'est pourquoi elle a développé des stratégies adaptées à chacune des fonctions exécutives, réunies dans son modèle PÉTALES : un ensemble d'outils concrets, pensés pour accompagner l'élève selon le défi précis qu'il vit, avec ou sans diagnostic.",
    lienHref: "#/fonctions-executives",
    lienLabel: "En savoir plus sur les fonctions exécutives et le modèle PÉTALES →",
  },
  {
    titre: "Pourquoi PÉTALES ?",
    texte:
      "PÉTALES est le modèle d'intervention conçu par Nelly Folefack pour accompagner les enfants en contexte scolaire. Le nom vient d'une fleur à sept pétales : Posture, Évaluation, Transitions, Ajustement, Lien, Équité, Soutien. Dans Le Labo des Déclics, les outils PÉTALES sont une version concrète de ce modèle, pensée pour les moments d'apprentissage. Pour les professionnels, le guide PÉTALES 2026 propose aussi sept outils d'intervention codés (dont SIT, RES et DAE) choisis selon la fonction exécutive touchée.",
    lienHref: "#/fonctions-executives",
    lienLabel: "Voir les sept outils du guide PÉTALES →",
  },
  {
    titre: "Faut-il créer un compte ?",
    texte:
      "Aucun compte ni mot de passe n'est nécessaire. Un prénom facultatif permet de garder les progrès dans ce navigateur, séparément pour chaque enfant. Ces progrès ne se synchronisent pas automatiquement entre les appareils, et peuvent être perdus si les données du navigateur sont effacées. L'espace adulte (parents ou professionnels) permet de télécharger une sauvegarde et de la récupérer plus tard, ou sur un autre appareil. Aucune donnée n'est envoyée automatiquement à l'école.",
    lienHref: "#/sauvegarde",
    lienLabel: "Sauvegarder ou récupérer des progrès →",
  },
];

// ------------------------------------------------------------------------
// Contenu complet par matière / niveau / thème
// ------------------------------------------------------------------------
const SUBJECT_CONTENT = {
  numeratie: {
    1: [
      {
        id: "compter-comparer",
        label: "Compter et comparer",
        desc: "Je découvre une méthode, je regarde un exemple, puis je m'entraîne.",
        method: [
          "Je touche chaque objet une seule fois en comptant.",
          "Je dis le dernier nombre à voix haute : c'est le total.",
          "Pour comparer, je compte les deux groupes puis je regarde lequel a le plus.",
        ],
        example: "6 pommes : je touche chaque pomme en comptant 1, 2, 3, 4, 5, 6. Il y a 6 pommes.",
        exampleIllustration: objIllustration("🍎", 6),
        exercises: [
          countExercise("num-1-1", 4, "🍎"),
          countExercise("num-1-2", 7, "⭐"),
          countExercise("num-1-3", 3, "🚗"),
          compareExercise("num-1-4", 5, 3, "🟦"),
          compareExercise("num-1-5", 4, 4, "🟨"),
          countExercise("num-1-6", 9, "🎈"),
          compareExercise("num-1-7", 6, 8, "🍬"),
        ],
      },
      {
        id: "ordre-nombres",
        label: "Ranger les nombres en ordre",
        desc: "Je découvre ce que veut dire croissant et décroissant, et je m'entraîne à ranger des nombres.",
        method: [
          "Croissant, ça veut dire ranger du plus petit au plus grand. Décroissant, ça veut dire ranger du plus grand au plus petit.",
          "Avant de comparer des nombres, je peux comparer des amis selon leur taille : le plus petit d'abord, puis celui qui est un peu plus grand, et ainsi de suite. C'est la même idée avec les nombres.",
          "Je compare les nombres deux par deux pour trouver lequel est le plus petit ou le plus grand.",
          "Pour écrire ma comparaison, j'utilise aussi les signes < et > : j'imagine un crocodile affamé dont la bouche grande ouverte se tourne toujours vers le plus grand nombre, et dont la pointe montre le plus petit.",
        ],
        example: "3, 9, 1 rangés en ordre croissant : 1, 3, 9. Rangés en ordre décroissant : 9, 3, 1.",
        // Illustration "dans mon quotidien" : d'abord une image (des dés qui
        // grandissent ou rapetissent) pour comprendre le MOT croissant/
        // décroissant, puis des groupes d'objets réels avec le chiffre écrit
        // en dessous, pour relier la quantité vue et le nombre écrit.
        illustrationQuotidien: { emojiTaille: "🎲", emojiGroupe: "🚗" },
        exercises: [
          orderExercise("num-1-8", [4, 9, 2], "croissant"),
          orderExercise("num-1-9", [7, 1, 5], "croissant"),
          orderExercise("num-1-10", [6, 3, 8], "décroissant"),
          // On commence avec de petits nombres, et le crocodile reste bien
          // visible au début, puis rapetisse, puis disparaît (on garde un
          // bouton pour le faire revenir au besoin) : on retire l'appui
          // seulement une fois que le signe seul suffit.
          signeExercise("num-1-s1", 2, 3, "grand", "🔵"),
          signeExercise("num-1-s2", 6, 4, "grand", "🟢"),
          signeExercise("num-1-s3", 5, 5, "petit", "🟡"),
          signeExercise("num-1-s4", 6, 8, "aucun", "🔴"),
          signeExercise("num-1-s5", 8, 7, "aucun", "🟣"),
        ],
      },
      {
        id: "le-calendrier",
        label: "Le calendrier",
        desc: "Les jours de l'école reviennent toujours dans le même ordre : je m'en sers pour pratiquer l'ordre des nombres, dans la vraie vie.",
        method: [
          "Je récite les jours de la semaine dans l'ordre : lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche.",
          "Après dimanche, on recommence à lundi : la semaine tourne toujours dans le même ordre.",
          "Pour trouver le jour suivant, je pars du jour donné et je dis celui d'après.",
        ],
        example: "Après mardi vient mercredi. Après vendredi vient samedi.",
        exampleIllustration: null,
        exercises: [
          jourSuivantExercise("num-1-11", "lundi", ["mercredi", "vendredi"]),
          jourSuivantExercise("num-1-12", "jeudi", ["lundi", "dimanche"]),
          jourSuivantExercise("num-1-13", "samedi", ["mardi", "jeudi"]),
        ],
      },
    ],
    2: [
      {
        id: "nombres-vraie-vie",
        label: "Les nombres dans la vraie vie",
        desc: "Je compte, je compare et je m'organise avec des exemples adaptés à mon niveau.",
        method: [
          "Je regroupe les objets par 10 quand c'est possible, ça va plus vite.",
          "Je compte les dizaines, puis les unités qui restent.",
        ],
        example: "23 jetons : 2 groupes de 10, plus 3 tout seuls. Ça fait 23.",
        exampleIllustration: objIllustration("🔵", 23, 10),
        exercises: [
          countExercise("num-2-1", 14, "🟠"),
          compareExercise("num-2-2", 12, 17, "🔵"),
          countExercise("num-2-3", 21, "⭐"),
          compareExercise("num-2-4", 30, 25, "🟢"),
          countExercise("num-2-5", 18, "🍓"),
          compareExercise("num-2-6", 40, 40, "🟨"),
        ],
      },
      {
        id: "ordre-nombres",
        label: "Ranger les nombres en ordre",
        desc: "Je comprends croissant et décroissant, le signe < et >, et je m'entraîne avec des nombres plus grands.",
        method: [
          "Croissant, ça veut dire ranger du plus petit au plus grand. Décroissant, ça veut dire ranger du plus grand au plus petit.",
          "Avant de comparer des nombres, je peux comparer des amis selon leur taille : le plus petit d'abord, puis celui qui est un peu plus grand, et ainsi de suite. C'est la même idée avec les nombres.",
          "Le signe > veut dire « est plus grand que », et < veut dire « est plus petit que » : la pointe du signe montre toujours vers le plus petit nombre.",
          "Un crocodile affamé peut m'aider à me rappeler : sa bouche grande ouverte se tourne vers le plus grand nombre, et sa pointe montre le plus petit.",
        ],
        example: "23, 40, 15 rangés en ordre croissant : 15, 23, 40. On peut écrire 15 < 23 < 40.",
        illustrationQuotidien: { emojiTaille: "🎲", emojiGroupe: "🚗" },
        exercises: [
          orderExercise("num-2-7", [23, 17, 34], "croissant"),
          orderExercise("num-2-8", [40, 15, 28], "croissant"),
          orderExercise("num-2-9", [19, 37, 22], "décroissant"),
          // Même logique qu'en 1re année : petits nombres d'abord, crocodile
          // qui rapetisse puis disparaît (avec un rappel possible).
          signeExercise("num-2-s1", 3, 5, "grand", "🔵"),
          signeExercise("num-2-s2", 6, 2, "grand", "🟢"),
          signeExercise("num-2-s3", 6, 6, "petit", "🟡"),
          signeExercise("num-2-s4", 5, 8, "aucun", "🔴"),
          signeExercise("num-2-s5", 8, 6, "aucun", "🟣"),
        ],
      },
      {
        id: "le-calendrier",
        label: "Le calendrier",
        desc: "Je me sers du calendrier de la classe pour compter combien de jours il reste avant un évènement.",
        method: [
          "Je pars du lendemain du jour où je suis.",
          "Je compte chaque jour un par un, en avançant dans la semaine.",
          "Je m'arrête quand j'arrive au jour que je cherche : le nombre de jours comptés, c'est ma réponse.",
        ],
        example: "On est lundi, la sortie est vendredi : je compte mardi (1), mercredi (2), jeudi (3), vendredi (4). Il reste 4 jours.",
        exampleIllustration: null,
        exercises: [
          joursJusquaExercise("num-2-10", "lundi", "vendredi", 4),
          joursJusquaExercise("num-2-11", "mercredi", "dimanche", 4),
          joursJusquaExercise("num-2-12", "samedi", "mardi", 3),
        ],
      },
    ],
    3: [
      {
        id: "groupes-egaux",
        label: "Faire des groupes égaux",
        desc: "Je découvre comment organiser une quantité en équipes égales.",
        method: [
          "Je décide combien de groupes je veux faire.",
          "Je répartis les objets un par un dans chaque groupe, jusqu'à épuiser tous les objets.",
        ],
        example: "12 amis, équipes de 4 : je fais 3 équipes.",
        exampleIllustration: objIllustration("🧑", 12, 4),
        exercises: [
          groupsExercise("num-3-1", 3, 4, "🧑"),
          groupsExercise("num-3-2", 4, 2, "🎈"),
          groupsExercise("num-3-3", 2, 5, "⭐"),
          groupsExercise("num-3-4", 5, 2, "🟦"),
        ],
      },
    ],
    4: [
      {
        id: "representer-nombre",
        label: "Représenter un nombre",
        desc: "Je construis le même nombre de plusieurs façons pour bien le comprendre.",
        method: [
          "Je choisis une méthode : objets, dizaines et unités, ou ligne numérique.",
          "Je vérifie que toutes mes représentations donnent le même total.",
        ],
        example: "24, c'est 2 dizaines et 4 unités, ou 24 objets comptés un par un.",
        exampleIllustration: objIllustration("🔵", 24, 10),
        exercises: [
          countExercise("num-4-1", 24, "🔵"),
          countExercise("num-4-2", 36, "🟠"),
          compareExercise("num-4-3", 45, 39, "🟩"),
        ],
      },
    ],
    5: [
      {
        id: "fractions-simples",
        label: "Fractions simples",
        desc: "Je découvre comment partager équitablement.",
        // Avant les étapes et les exercices : expliquer le MOT "fraction"
        // en mots simples, avec un exemple concret et un visage visuel
        // (une barre divisée en parts égales, certaines coloriées).
        conceptIntro: {
          title: "Qu'est-ce qu'une fraction ?",
          text:
            "Une fraction, ça sert à parler d'un morceau d'un tout, quand on partage quelque chose en parts égales. Par exemple, si je partage une pizza en 4 parts égales et que j'en mange 1, j'ai mangé une fraction de la pizza : 1 part sur 4. Ça s'écrit 1/4.",
          illustrationFraction: { total: 4, parts: 1 },
        },
        method: [
          "Je compte le nombre total de parts égales.",
          "Je compte les parts dont on parle (mangées, données, coloriées).",
        ],
        example: "Une pizza en 4 parts égales, j'en mange 1 : il en reste 3.",
        exampleIllustration: objIllustration("🍕", 4),
        exercises: [
          fractionExercise("num-5-1", 4, 1, "🍕"),
          fractionExercise("num-5-2", 6, 2, "🍫"),
          fractionExercise("num-5-3", 8, 3, "🍓"),
        ],
      },
    ],
  },

  maths: {
    1: [
      {
        id: "additionner-enlever",
        label: "Additionner et enlever",
        desc: "Je découvre une méthode, je regarde un exemple, puis je m'entraîne.",
        method: [
          "Pour additionner, je pars du premier nombre et j'ajoute le deuxième, un par un.",
          "Pour enlever, je pars du premier nombre et j'enlève le deuxième, un par un.",
        ],
        example: "3 + 2 : je pars de 3, j'ajoute 1 (ça fait 4), j'ajoute encore 1 (ça fait 5).",
        exampleIllustration: objIllustration("🚗", 5),
        exercises: [
          calcExercise("mat-1-1", 3, 2, "+", "🚗"),
          calcExercise("mat-1-2", 5, 1, "-", "🍪"),
          calcExercise("mat-1-3", 4, 3, "+", "⭐"),
          calcExercise("mat-1-4", 6, 2, "-", "🎈"),
          calcExercise("mat-1-5", 2, 5, "+", "🟦"),
          calcExercise("mat-1-6", 7, 4, "-", "🍓"),
          calcExercise("mat-1-7", 3, 3, "+", "🟨"),
        ],
      },
      {
        id: "la-monnaie",
        label: "La monnaie",
        desc: "Additionner et enlever, c'est ce qu'on fait vraiment avec de l'argent : compter ses pièces, ou payer au magasin.",
        method: [
          "Je regarde la valeur écrite sur chaque pièce.",
          "Pour savoir combien j'ai en tout, j'additionne la valeur des pièces.",
          "Pour savoir combien coûtent deux objets ensemble, j'additionne leur prix.",
        ],
        example: "Une pièce de 10 ¢ et une pièce de 5 ¢, ça fait 15 ¢ en tout.",
        exampleIllustration: null,
        exercises: [
          monnaieAdditionExercise("mat-1-8", 10, 5),
          monnaieAdditionExercise("mat-1-9", 25, 10),
          magasinAdditionExercise("mat-1-10", "une gomme à effacer", 15, "un crayon", 10),
        ],
      },
    ],
    2: [
      {
        id: "calculs",
        label: "Calculs",
        desc: "Je découvre une méthode, je regarde un exemple, puis je m'entraîne.",
        method: [
          "J'écris les nombres l'un sous l'autre.",
          "J'additionne les unités.",
          "Si j'ai 10 unités ou plus, je fais une retenue.",
          "J'additionne les dizaines.",
        ],
        example: "13 + 4 : 3 + 4 = 7 unités, 1 dizaine. Ça fait 17.",
        exampleIllustration: objIllustration("🚗", 17, 10),
        exercises: [
          calcExercise("mat-2-1", 13, 4, "+", "🚗"),
          calcExercise("mat-2-2", 18, 7, "-", "🍪"),
          calcExercise("mat-2-3", 12, 9, "+", "⭐"),
          calcExercise("mat-2-4", 20, 8, "-", "🎈"),
          calcExercise("mat-2-5", 15, 6, "-", "🟦"),
          calcExercise("mat-2-6", 11, 6, "+", "🍓"),
          calcExercise("mat-2-7", 14, 5, "+", "🟨"),
          calcExercise("mat-2-8", 19, 9, "-", "🟩"),
        ],
      },
      {
        id: "representer-nombre",
        label: "Représenter un nombre : quatre méthodes",
        desc: "Je construis le même nombre avec des objets, des dizaines et unités, une décomposition, ou une ligne numérique.",
        method: [
          "Méthode 1, les objets : je dessine ou je compte le nombre exact d'objets.",
          "Méthode 2, dizaines et unités : je sépare le nombre en groupes de 10 et le reste.",
          "Méthode 3, décomposition additive : j'écris le nombre comme une addition, par exemple 19 + 19.",
          "Méthode 4, la ligne numérique : je place le nombre entre deux repères connus.",
        ],
        example: "38, c'est 3 dizaines et 8 unités, ou 19 + 19, ou 38 objets comptés un par un.",
        exampleIllustration: objIllustration("🔵", 38, 10),
        exercises: [
          countExercise("mat-2r-1", 24, "🔵"),
          countExercise("mat-2r-2", 36, "🟠"),
          countExercise("mat-2r-3", 47, "🟢"),
          compareExercise("mat-2r-4", 38, 47, "🟩"),
        ],
      },
      {
        id: "rendre-la-monnaie",
        label: "Rendre la monnaie",
        desc: "Au magasin, la caissière calcule combien elle doit te remettre : c'est une soustraction bien réelle.",
        method: [
          "Je regarde combien j'ai payé.",
          "J'enlève le prix de l'objet acheté.",
          "Ce qu'il reste, c'est la monnaie qu'on me remet.",
        ],
        example: "Un objet coûte 75 ¢, je paye avec 100 ¢ : on me remet 25 ¢.",
        exampleIllustration: null,
        exercises: [
          monnaieRenduExercise("mat-2-9", 100, 75),
          monnaieRenduExercise("mat-2-10", 50, 30),
          magasinResteExercise("mat-2-11", 200, 85),
        ],
      },
    ],
    3: [
      {
        id: "groupes-egaux",
        label: "Faire des groupes égaux",
        desc: "Je découvre le tout début de la multiplication.",
        method: [
          "Je compte combien il y a d'objets dans un seul groupe.",
          "Je répète ce compte pour chaque groupe, puis j'additionne le tout.",
        ],
        example: "4 sacs de 3 billes : 3 + 3 + 3 + 3 = 12 billes.",
        exampleIllustration: objIllustration("🔴", 12, 3),
        exercises: [
          groupsExercise("mat-3-1", 4, 3, "🔴"),
          groupsExercise("mat-3-2", 3, 5, "🟡"),
          groupsExercise("mat-3-3", 5, 2, "🟢"),
        ],
      },
    ],
    4: [
      {
        id: "multiplication",
        label: "Multiplier",
        desc: "Je calcule plus vite quand il y a plusieurs groupes identiques.",
        method: [
          "Je repère combien de groupes il y a, et combien il y a d'objets dans chaque groupe.",
          "Je multiplie les deux nombres, ou j'additionne groupe par groupe si j'ai besoin.",
        ],
        example: "5 amis, 6 autocollants chacun : 5 × 6 = 30 autocollants.",
        exampleIllustration: objIllustration("⭐", 30, 6),
        exercises: [
          groupsExercise("mat-4-1", 5, 6, "⭐"),
          groupsExercise("mat-4-2", 3, 7, "🔵"),
          groupsExercise("mat-4-3", 4, 4, "🟩"),
        ],
      },
    ],
    5: [
      {
        id: "fractions",
        label: "Fractions",
        desc: "Je parle de parts d'un tout.",
        conceptIntro: {
          title: "Qu'est-ce qu'une fraction ?",
          text:
            "Une fraction, c'est une façon d'écrire une part d'un tout, quand on partage en parts égales. Par exemple, une tablette de chocolat coupée en 2 parts égales : si j'en mange 1, j'ai mangé une fraction de la tablette, 1 part sur 2. Ça s'écrit 1/2, et ça se dit aussi « la moitié ».",
          illustrationFraction: { total: 2, parts: 1 },
        },
        method: [
          "Je compte le nombre total de parts égales.",
          "Je compte les parts dont on parle.",
        ],
        example: "J'ai mangé la moitié d'une barre en 2 parts : il en reste 1.",
        exampleIllustration: objIllustration("🍫", 2),
        exercises: [
          fractionExercise("mat-5-1", 2, 1, "🍫"),
          fractionExercise("mat-5-2", 4, 3, "🍕"),
          fractionExercise("mat-5-3", 10, 4, "🍓"),
        ],
      },
    ],
  },

  lecture: {
    1: [
      {
        id: "lettres-sons",
        label: "Je découvre les lettres et leurs sons",
        desc: "Avant de lire des mots complets, je reconnais chaque lettre et le son qu'elle fait.",
        method: [
          "Je regarde la lettre.",
          "J'écoute son son en cliquant dessus.",
          "Je répète le son à voix haute.",
        ],
        example: "La lettre a fait le son \"a\", comme dans \"ami\".",
        exampleIllustration: null,
        exercises: [
          readWordExercise("lec-1-1", "a", "Quel est le son de cette lettre ?", ["a", "e", "i"], "a"),
          readWordExercise("lec-1-2", "l", "Quel est le son de cette lettre ?", ["l", "m", "r"], "l"),
          readWordExercise("lec-1-3", "sa", "Écoute ce mot : qu'est-ce que ça dit ?", ["sa", "sol", "la"], "sa"),
        ],
      },
      {
        id: "syllabes-consonne-voyelle",
        label: "Je fusionne une consonne et une voyelle",
        desc: "Une consonne toute seule ne dit presque rien : collée à une voyelle, elle devient une syllabe qu'on peut lire.",
        method: [
          "Je regarde la consonne (par exemple d).",
          "Je regarde la voyelle juste après (par exemple a).",
          "Je fusionne les deux sons sans m'arrêter entre les deux : d et a collés font \"da\".",
          "Je vérifie avec un mot qui commence par cette syllabe.",
        ],
        example: "d + a = da, comme dans \"dame\". d + o = do, comme dans \"dos\".",
        exampleIllustration: null,
        exercises: [
          readWordExercise("lec-1-4", "da", "d + a, qu'est-ce que ça fait ?", ["da", "do", "di"], "da"),
          readWordExercise("lec-1-5", "de", "d + e, qu'est-ce que ça fait ?", ["du", "de", "da"], "de"),
          readWordExercise("lec-1-6", "di", "d + i, qu'est-ce que ça fait ?", ["do", "du", "di"], "di"),
          readWordExercise("lec-1-7", "do", "d + o, qu'est-ce que ça fait ?", ["do", "da", "de"], "do"),
          readWordExercise("lec-1-8", "du", "d + u, qu'est-ce que ça fait ?", ["di", "da", "du"], "du"),
          readWordExercise("lec-1-9", "pa", "p + a, qu'est-ce que ça fait ?", ["pa", "po", "pi"], "pa"),
          readWordExercise("lec-1-10", "pi", "p + i, qu'est-ce que ça fait ?", ["pu", "po", "pi"], "pi"),
          readWordExercise("lec-1-11", "po", "p + o, qu'est-ce que ça fait ?", ["po", "pa", "pu"], "po"),
        ],
      },
      {
        id: "je-lis-un-mot",
        label: "Je lis un mot avec mes syllabes",
        desc: "Je viens d'apprendre des syllabes : maintenant je les recolle pour lire un vrai mot.",
        method: [
          "Je repère les syllabes dans le mot (par exemple pa-pa).",
          "Je lis chaque syllabe une par une, sans m'arrêter trop longtemps entre les deux.",
          "Je recolle les syllabes pour dire le mot en entier.",
          "Je vérifie que le mot que j'ai lu existe vraiment et qu'il a un sens.",
        ],
        example: "pa + pa = papa.",
        exampleIllustration: null,
        exercises: [
          readWordExercise("lec-1-12", "papa", "Quel mot lis-tu : pa + pa ?", ["papa", "pipo", "dodo"], "papa"),
          readWordExercise("lec-1-13", "dodo", "Quel mot lis-tu : do + do ?", ["dada", "dodo", "papi"], "dodo"),
        ],
      },
      {
        id: "avant-la-lecture",
        label: "Je me prépare avant de lire",
        desc: "Avant même d'ouvrir un livre, réfléchir à quelques questions m'aide à mieux comprendre ce que je vais lire.",
        method: [
          "Je regarde la couverture du livre.",
          "Je réfléchis à ce que le titre m'annonce.",
          "Je me demande pourquoi j'ai envie de lire ce livre.",
        ],
        example: "Avant de lire, je regarde l'image sur la couverture et j'essaie de deviner de quoi parle l'histoire.",
        exampleIllustration: null,
        exercises: [reflexionExercise("lec-1-14", "avant", REFLEXION_AVANT)],
      },
    ],
    2: [
      {
        id: "preparer-comprehension",
        label: "Préparer ma compréhension",
        desc: "Je découvre les mots du récit avant de le lire.",
        method: [
          "J'écoute le mot en cliquant dessus.",
          "Je réfléchis à ce que ce mot pourrait vouloir dire.",
          "Je vérifie avec le choix qui correspond le mieux.",
        ],
        example: "Le mot \"boulon\" : une petite pièce de métal qui tient deux morceaux ensemble.",
        exampleIllustration: null,
        exercises: [
          readWordExercise("lec-2-1", "boulon", "Que veut dire \"boulon\" ?", ["Tourner fort pour que ça tienne bien.", "Une petite pièce de métal qui tient deux morceaux ensemble."], "Une petite pièce de métal qui tient deux morceaux ensemble."),
          readWordExercise("lec-2-2", "invitation", "Que veut dire \"invitation\" ?", ["Un papier qui dit où et quand retrouver quelqu'un.", "Un jouet qu'on partage."], "Un papier qui dit où et quand retrouver quelqu'un."),
        ],
      },
      {
        id: "je-lis-les-mots",
        label: "Je lis les mots",
        desc: "Je clique sur chaque mot pour entendre le son, puis je réponds.",
        method: [
          "Je clique sur le mot pour l'entendre.",
          "Je répète le mot dans ma tête.",
          "Je choisis la bonne réponse.",
        ],
        example: "Le mot \"ami\" se lit a-m-i.",
        exampleIllustration: null,
        exercises: [
          readWordExercise("lec-2r-1", "ami", "Quel mot as-tu entendu ?", ["ami", "avril", "ami"], "ami"),
          readWordExercise("lec-2r-2", "maison", "Quel mot as-tu entendu ?", ["maison", "raison", "saison"], "maison"),
          readWordExercise("lec-2r-3", "tomate", "Quel mot as-tu entendu ?", ["tomate", "tornade", "tomate"], "tomate"),
        ],
      },
      {
        id: "avant-et-pendant-la-lecture",
        label: "Je me prépare et je m'arrête pendant ma lecture",
        desc: "Je réfléchis avant de commencer à lire, puis je m'arrête un instant pendant ma lecture pour vérifier que je comprends bien.",
        method: [
          "Avant de lire, je regarde la couverture et je réfléchis au titre.",
          "Pendant ma lecture, je m'arrête une fois pour vérifier que je comprends bien.",
          "Si un mot me bloque, j'essaie de deviner son sens avec les mots autour.",
        ],
        example: "Avant de lire, je me demande de quoi parle le livre. Pendant ma lecture, je m'arrête pour me demander ce qui va se passer ensuite.",
        exampleIllustration: null,
        exercises: [
          reflexionExercise("lec-2-9", "avant", REFLEXION_AVANT),
          reflexionExercise("lec-2-10", "pendant", REFLEXION_PENDANT.slice(0, 2)),
        ],
      },
    ],
    3: [
      {
        id: "comprendre-texte",
        label: "Comprendre le texte",
        desc: "Je lis ou j'écoute, puis je cherche des indices pour répondre.",
        method: [
          "Je lis ou j'écoute le texte une première fois en entier.",
          "Je relis la question.",
          "Je retourne chercher l'indice dans le texte.",
        ],
        example: "\"Léa a trouvé son chat sous le lit.\" Où était le chat ? Sous le lit.",
        exampleIllustration: null,
        exercises: [
          readWordExercise("lec-3-1", "Léa a trouvé son chat sous le lit.", "Où était le chat ?", ["Sous le lit.", "Dans la cuisine.", "Dehors."], "Sous le lit."),
          readWordExercise("lec-3-2", "Sam a mangé une pomme avant l'école.", "Qu'est-ce que Sam a mangé ?", ["Une pomme.", "Une banane.", "Du pain."], "Une pomme."),
        ],
      },
      {
        id: "de-comprehension",
        label: "Le dé de la compréhension",
        desc: "Avant, pendant et après avoir lu un livre, quelques questions m'aident à mieux comprendre et à en parler.",
        method: [
          "Je lance le dé avant de commencer ma lecture.",
          "Je m'arrête une fois pendant ma lecture pour lancer le dé à nouveau.",
          "Une fois le livre terminé, je lance le dé une dernière fois.",
        ],
        example: "Le dé me pose une question différente à chaque étape de ma lecture : avant, pendant, et après.",
        exampleIllustration: null,
        exercises: [
          reflexionExercise("lec-3-3", "avant", REFLEXION_AVANT),
          reflexionExercise("lec-3-4", "pendant", REFLEXION_PENDANT),
          reflexionExercise("lec-3-5", "apres", REFLEXION_APRES),
        ],
      },
    ],
    4: [
      {
        id: "resumer",
        label: "Résumer un récit",
        desc: "Je dis l'essentiel de l'histoire en une phrase.",
        method: [
          "Je me demande : qui est le personnage principal ?",
          "Je me demande : qu'est-ce qui lui arrive ?",
        ],
        example: "Un lapin qui a perdu sa carotte la retrouve grâce à son ami l'écureuil.",
        exampleIllustration: null,
        exercises: [
          readWordExercise("lec-4-1", "Le lapin cherche sa carotte partout, puis son ami écureuil l'aide à la retrouver.", "Qui aide le lapin ?", ["L'écureuil.", "Le renard.", "Personne."], "L'écureuil."),
        ],
      },
      {
        id: "de-comprehension",
        label: "Le dé de la compréhension",
        desc: "Avant, pendant et après avoir lu un livre, quelques questions m'aident à mieux comprendre et à en parler.",
        method: [
          "Je lance le dé avant de commencer ma lecture.",
          "Je m'arrête une fois pendant ma lecture pour lancer le dé à nouveau.",
          "Une fois le livre terminé, je lance le dé une dernière fois.",
        ],
        example: "Le dé me pose une question différente à chaque étape de ma lecture : avant, pendant, et après.",
        exampleIllustration: null,
        exercises: [
          reflexionExercise("lec-4-2", "avant", REFLEXION_AVANT),
          reflexionExercise("lec-4-3", "pendant", REFLEXION_PENDANT),
          reflexionExercise("lec-4-4", "apres", REFLEXION_APRES),
        ],
      },
    ],
    5: [
      {
        id: "expliquer-texte",
        label: "Expliquer un texte",
        desc: "Je donne mon avis sur ce que j'ai compris.",
        method: [
          "Je relis le passage important.",
          "Je me demande pourquoi le personnage a fait ce choix.",
        ],
        example: "Le personnage a partagé son repas parce qu'il voulait aider son ami.",
        exampleIllustration: null,
        exercises: [
          readWordExercise("lec-5-1", "Mia a donné son parapluie à son ami sous la pluie, même si elle s'est mouillée.", "Pourquoi Mia a-t-elle fait ça, selon toi ?", ["Parce qu'elle voulait aider son ami.", "Parce qu'elle n'aimait pas son parapluie."], "Parce qu'elle voulait aider son ami."),
        ],
      },
      {
        id: "de-comprehension",
        label: "Le dé de la compréhension",
        desc: "Avant, pendant et après avoir lu un livre, quelques questions m'aident à mieux comprendre et à en parler.",
        method: [
          "Je lance le dé avant de commencer ma lecture.",
          "Je m'arrête une fois pendant ma lecture pour lancer le dé à nouveau.",
          "Une fois le livre terminé, je lance le dé une dernière fois.",
        ],
        example: "Le dé me pose une question différente à chaque étape de ma lecture : avant, pendant, et après.",
        exampleIllustration: null,
        exercises: [
          reflexionExercise("lec-5-2", "avant", REFLEXION_AVANT),
          reflexionExercise("lec-5-3", "pendant", REFLEXION_PENDANT),
          reflexionExercise("lec-5-4", "apres", REFLEXION_APRES),
        ],
      },
    ],
  },
};

// ------------------------------------------------------------------------
// Mes premiers pas en français (accueil des nouveaux arrivants)
// ------------------------------------------------------------------------
const PREMIERS_PAS_CONTENT = {
  comprehension: [
    { consigne: "Montre le grand cercle.", choices: ["⭕ grand", "⭕ petit"], correct: "⭕ grand" },
    { consigne: "Entoure le chat.", choices: ["🐱 chat", "🐶 chien"], correct: "🐱 chat" },
    { consigne: "Place le livre sur la table.", choices: ["📖 sur la table", "📖 sous la table"], correct: "📖 sur la table" },
    { consigne: "Compare les deux groupes : lequel a le plus ?", choices: ["🔵🔵🔵", "🔵🔵"], correct: "🔵🔵🔵" },
  ],
  sons: [
    { lettre: "a", mot: "ami" },
    { lettre: "l", mot: "lune" },
    { lettre: "u", mot: "usine" },
    { lettre: "y", mot: "yoga" },
    { lettre: "la", mot: "la" },
    { lettre: "lu", mot: "lu" },
    { lettre: "ma", mot: "ma" },
    { lettre: "mi", mot: "mi" },
    { lettre: "to", mot: "tomate" },
    { lettre: "ta", mot: "tomate" },
    { lettre: "te", mot: "tomate" },
  ],
};
